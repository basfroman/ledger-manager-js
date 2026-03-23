// Ledger + Bittensor signing page.
//
// mode=1 (CheckMetadataHash) is ALWAYS ON when signing with Ledger. Ledger's signWithMetadata validates the metadata
// proof against the metadataHash field in the payload — if mode=0 (hash=None), the Ledger device itself rejects with
// 27012 "wrong metadata digest".
//
// Metadata is capped at V15.
// V16 produces different type ordering → different merkle hash → chain rejects with "bad signature". Talisman hit the
// same thing:
// https://github.com/TalismanSociety/talisman/issues/2180
// https://github.com/TalismanSociety/talisman/pull/2183
// Root cause: https://github.com/polkadot-api/polkadot-api/issues/1172

import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;

import {
  LedgerManager,
  LEDGER_STATUS,
  LEDGER_ERROR,
  classifyLedgerError,
  ledgerErrorMessage,
  normalizeLedgerSignature,
} from './ledger-manager.js';

const [
  { ApiPromise, WsProvider },
  { LedgerGeneric },
  { u8aToHex },
  { merkleizeMetadata },
] = await Promise.all([
  import('@polkadot/api'),
  import('@polkadot/hw-ledger'),
  import('@polkadot/util'),
  import('@polkadot-api/merkleize-metadata'),
]);

const SS58_PREFIX = 42;
const SLIP44 = 0x00000162;
const CHAIN = 'bittensor';
const RAO_PER_TAO = 1_000_000_000n;
const TAO_DECIMALS = 9;
const TOKEN_SYMBOL = 'TAO';

let api = null;
let selectedAccount = null;
let accountsLoaded = false;
let lastLoadedAccounts = [];

const $ = (id) => document.getElementById(id);
const networkPreset = $('networkPreset');
const customUrlWrap = $('customUrlWrap');
const customUrl = $('customUrl');
const connectBtn = $('connectBtn');
const disconnectBtn = $('disconnectBtn');
const networkStatus = $('networkStatus');
const addDeviceBtn = $('addDeviceBtn');
const loadAccountsBtn = $('loadAccountsBtn');
const singleAccountIndex = $('singleAccountIndex');
const loadSingleAccountBtn = $('loadSingleAccountBtn');
const ledgerStatusEl = $('ledgerStatus');
const deviceListBody = $('deviceListBody');
const accountsBody = $('accountsBody');
const refreshBalancesBtn = $('refreshBalancesBtn');
const fromAddress = $('fromAddress');
const toAddress = $('toAddress');
const amountInput = $('amount');
const sendBtn = $('sendBtn');
const txStatusEl = $('txStatus');
const txResultWrap = $('txResultWrap');
const txResult = $('txResult');
const logPanel = $('logPanel');

// ── Ledger device monitor ──

const monitor = new LedgerManager({
  LedgerGeneric,
  chain: CHAIN,
  slip44: SLIP44,
  ss58Prefix: SS58_PREFIX,
  debug: true,
  onStatusChange(status, detail) {
    switch (status) {
      case LEDGER_STATUS.IDLE:
        setLedgerStatus('No device selected', 'neutral');
        loadAccountsBtn.disabled = true;
        loadSingleAccountBtn.disabled = true;
        break;
      case LEDGER_STATUS.NO_DEVICE:
        setLedgerStatus('Ledger is not connected. Plug in your device via USB.', 'warn');
        onDeviceBecameNotReady();
        break;
      case LEDGER_STATUS.LOCKED:
        setLedgerStatus('Ledger is locked. Enter your PIN to unlock the device.', 'warn');
        onDeviceBecameNotReady();
        break;
      case LEDGER_STATUS.APP_NOT_OPEN:
        setLedgerStatus('Polkadot app is not running on Ledger. Please open it.', 'warn');
        onDeviceBecameNotReady();
        break;
      case LEDGER_STATUS.READY: {
        const ver = detail.appVersion || '?';
        const firstReady = detail.previousStatus !== LEDGER_STATUS.READY;
        loadAccountsBtn.disabled = false;
        loadSingleAccountBtn.disabled = false;
        const suffix = accountsLoaded ? ` | ${lastLoadedAccounts.length} accounts loaded` : '';
        setLedgerStatus(`Device ready — Polkadot app v${ver}${suffix}`, 'ok');
        if (firstReady && !accountsLoaded) loadAccountsBtn.click();
        break;
      }
    }
  },
  onDevicesChange(devices) {
    renderDeviceList(devices);
  },
});

monitor.start();

// ── UI helpers ──

function setLedgerStatus(text, tone) {
  ledgerStatusEl.textContent = text;
  ledgerStatusEl.className = `status-box mt-12 status-${tone}`;
}

function setStatus(el, text, tone = 'neutral') {
  el.textContent = text;
  el.className = `status-box mt-12 status-${tone}`;
}

function truncAddr(addr) {
  if (!addr || addr.length < 16) return addr;
  return addr.slice(0, 8) + '...' + addr.slice(-6);
}

function getRpcUrl() {
  const preset = networkPreset.value;
  return preset === 'custom' ? customUrl.value.trim() : preset;
}

function log(msg) {
  const ts = new Date().toISOString().slice(11, 23);
  logPanel.textContent += `[${ts}] ${msg}\n`;
  logPanel.scrollTop = logPanel.scrollHeight;
}

function clearLog() {
  logPanel.textContent = '';
}

// Checks runtime metadata for CheckMetadataHash signed extension.
// Without it the chain can't verify metadata proofs → Ledger signing is impossible.
// Talisman keeps this as a per-network toggle for the same reason (#2180).
function chainSupportsMetadataHash(apiInst) {
  try {
    const exts = apiInst.registry.signedExtensions;
    return Array.isArray(exts) && exts.includes('CheckMetadataHash');
  } catch {
    return false;
  }
}

function getChainDecimals(apiInst) {
  const raw = Array.isArray(apiInst.registry.chainDecimals) ? Number(apiInst.registry.chainDecimals[0] ?? TAO_DECIMALS) : TAO_DECIMALS;
  return Number.isFinite(raw) ? raw : TAO_DECIMALS;
}

function getChainToken(apiInst) {
  const token = Array.isArray(apiInst.registry.chainTokens) ? String(apiInst.registry.chainTokens[0] ?? TOKEN_SYMBOL) : TOKEN_SYMBOL;
  return token || TOKEN_SYMBOL;
}

// Dev chains (--dev nodes) report symbol="Unit" decimals=0.
// merkleizeMetadata needs real token info to produce a valid digest,
// so metadata hash signing is broken on these chains by design.
// Same check exists in Talisman (useSubstratePayloadMetadata.ts).
function isDevChain(apiInst) {
  return getChainToken(apiInst) === 'Unit' && getChainDecimals(apiInst) === 0;
}

// ── Network ──

networkPreset.addEventListener('change', () => {
  customUrlWrap.classList.toggle('hidden', networkPreset.value !== 'custom');
});

connectBtn.addEventListener('click', async () => {
  const url = getRpcUrl();
  if (!url) { setStatus(networkStatus, 'Enter a valid RPC URL', 'err'); return; }

  connectBtn.disabled = true;
  setStatus(networkStatus, `Connecting to ${url}...`, 'busy');

  try {
    if (api) { try { await api.disconnect(); } catch {} }
    const provider = new WsProvider(url);
    api = await ApiPromise.create({ provider, noInitWarn: true });
    const [chain, runtime, header] = await Promise.all([
      api.rpc.system.chain(),
      api.rpc.state.getRuntimeVersion(),
      api.rpc.chain.getHeader(),
    ]);
    const blockNum = header.number.toNumber().toLocaleString();
    const hasMetaHash = chainSupportsMetadataHash(api);
    const devChain = isDevChain(api);

    let statusLine = `Connected: ${chain} v${runtime.specVersion} | Block #${blockNum}`;
    statusLine += ` | CheckMetadataHash: ${hasMetaHash ? 'yes' : 'NO'}`;
    if (devChain) statusLine += ' | DEV CHAIN (metadata hash will be broken)';
    if (!hasMetaHash) statusLine += ' | WARNING: Ledger signing not possible without CheckMetadataHash';

    setStatus(networkStatus, statusLine, hasMetaHash && !devChain ? 'ok' : 'warn');
    disconnectBtn.disabled = false;
    updateSendButton();
  } catch (err) {
    setStatus(networkStatus, `Connection failed: ${err.message}`, 'err');
    api = null;
  } finally {
    connectBtn.disabled = false;
  }
});

disconnectBtn.addEventListener('click', async () => {
  if (api) { try { await api.disconnect(); } catch {} }
  api = null;
  disconnectBtn.disabled = true;
  setStatus(networkStatus, 'Disconnected', 'neutral');
  updateSendButton();
});

// ── Ledger device UI ──

function renderDeviceList(devices) {
  deviceListBody.innerHTML = '';

  if (devices.length === 0) {
    deviceListBody.innerHTML = '<tr><td colspan="2" class="text-muted">No authorized devices. Click "+ Add Device" to pair.</td></tr>';
    return;
  }

  for (const dev of devices) {
    const isSelected = dev.key === monitor.selectedDeviceKey;
    const tr = document.createElement('tr');
    tr.setAttribute('data-selectable', '');
    if (isSelected) tr.classList.add('selected');

    const nameTd = document.createElement('td');
    nameTd.textContent = dev.label;

    const actionTd = document.createElement('td');
    actionTd.classList.add('text-right');
    const forgetBtn = document.createElement('button');
    forgetBtn.className = 'btn-danger btn-sm';
    forgetBtn.textContent = 'Forget';
    forgetBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await monitor.forgetDevice(dev.key);
      } catch (err) {
        setLedgerStatus(`Failed to forget device: ${err.message}`, 'err');
      }
    });
    actionTd.appendChild(forgetBtn);

    tr.append(nameTd, actionTd);

    tr.addEventListener('click', () => {
      if (isSelected) {
        monitor.deselectDevice();
      } else {
        monitor.selectDevice(dev.key);
      }
    });

    deviceListBody.appendChild(tr);
  }
}

addDeviceBtn.addEventListener('click', async () => {
  addDeviceBtn.disabled = true;
  try {
    await monitor.requestDevice();
  } catch (err) {
    if (!err.message?.includes('cancelled') && !err.message?.includes('No device selected')) {
      setLedgerStatus(`Failed to add device: ${err.message}`, 'err');
    }
  } finally {
    addDeviceBtn.disabled = false;
  }
});

// ── Accounts ──

function onDeviceBecameNotReady() {
  accountsLoaded = false;
  loadAccountsBtn.disabled = true;
  loadSingleAccountBtn.disabled = true;
  clearAccountsTable();
}

function clearAccountsTable() {
  accountsBody.innerHTML = '<tr><td colspan="4" class="text-muted">No accounts loaded</td></tr>';
  lastLoadedAccounts = [];
  selectedAccount = null;
  refreshBalancesBtn.disabled = true;
  fromAddress.value = '';
  updateSendButton();
}

loadAccountsBtn.addEventListener('click', async () => {
  if (monitor.status !== LEDGER_STATUS.READY) {
    setLedgerStatus('Device is not ready.', 'err');
    return;
  }

  loadAccountsBtn.disabled = true;
  loadSingleAccountBtn.disabled = true;
  setLedgerStatus('Loading accounts from Ledger...', 'busy');

  try {
    const newAccounts = await monitor.getAccounts(5, {
      onProgress({ current, total }) {
        setLedgerStatus(`Fetching account ${current}/${total} from Ledger...`, 'busy');
      },
    });

    mergeAccounts(newAccounts);
    accountsLoaded = true;
    setLedgerStatus(`Device ready | ${lastLoadedAccounts.length} accounts loaded`, 'ok');
    updateSendButton();

    if (api) {
      setLedgerStatus('Fetching balances...', 'busy');
      await fetchBalances(lastLoadedAccounts);
      setLedgerStatus(`Device ready | ${lastLoadedAccounts.length} accounts loaded`, 'ok');
    }
  } catch (err) {
    const code = classifyLedgerError(err);
    setLedgerStatus(ledgerErrorMessage(code, err), 'err');
  } finally {
    loadAccountsBtn.disabled = false;
    loadSingleAccountBtn.disabled = false;
  }
});

loadSingleAccountBtn.addEventListener('click', async () => {
  if (monitor.status !== LEDGER_STATUS.READY) {
    setLedgerStatus('Device is not ready.', 'err');
    return;
  }

  const idx = parseInt(singleAccountIndex.value, 10);
  if (isNaN(idx) || idx < 0) {
    setLedgerStatus('Enter a valid account index (0 or higher).', 'err');
    return;
  }

  loadAccountsBtn.disabled = true;
  loadSingleAccountBtn.disabled = true;
  setLedgerStatus(`Fetching account #${idx} from Ledger...`, 'busy');

  try {
    const account = await monitor.getAccount(idx);

    mergeAccounts([account]);
    accountsLoaded = true;
    setLedgerStatus(`Device ready | ${lastLoadedAccounts.length} accounts loaded`, 'ok');
    updateSendButton();

    if (api) {
      setLedgerStatus(`Fetching balance for account #${idx}...`, 'busy');
      await fetchBalances([account]);
      setLedgerStatus(`Device ready | ${lastLoadedAccounts.length} accounts loaded`, 'ok');
    }
  } catch (err) {
    const code = classifyLedgerError(err);
    setLedgerStatus(ledgerErrorMessage(code, err), 'err');
  } finally {
    loadAccountsBtn.disabled = false;
    loadSingleAccountBtn.disabled = false;
  }
});

function mergeAccounts(newAccounts) {
  for (const acct of newAccounts) {
    const existing = lastLoadedAccounts.findIndex(a => a.accountIndex === acct.accountIndex);
    if (existing >= 0) {
      lastLoadedAccounts[existing] = acct;
    } else {
      lastLoadedAccounts.push(acct);
    }
  }
  lastLoadedAccounts.sort((a, b) => a.accountIndex - b.accountIndex);
  renderAccounts(lastLoadedAccounts);
}

function renderAccounts(accounts) {
  accountsBody.innerHTML = '';
  for (const acct of accounts) {
    const tr = document.createElement('tr');
    tr.setAttribute('data-selectable', '');
    if (selectedAccount?.address === acct.address) tr.classList.add('selected');
    const balStr = acct.balance != null ? acct.balance.toFixed(4) : '...';
    tr.innerHTML = `
      <td>${acct.accountIndex}</td>
      <td title="${acct.address}">${truncAddr(acct.address)}</td>
      <td>${acct.derivationPath || `m/44'/${SLIP44}'/${acct.accountIndex}'/0'/0'`}</td>
      <td>${balStr}</td>
    `;
    tr.addEventListener('click', () => {
      selectedAccount = acct;
      fromAddress.value = acct.address;
      renderAccounts(lastLoadedAccounts);
      updateSendButton();
    });
    accountsBody.appendChild(tr);
  }
}

async function fetchBalances(accounts) {
  if (!api || !accounts.length) return;
  refreshBalancesBtn.disabled = true;
  refreshBalancesBtn.textContent = 'Loading...';
  for (const acct of accounts) {
    try {
      const { data } = await api.query.system.account(acct.address);
      acct.balance = Number(data.free.toBigInt()) / Number(RAO_PER_TAO);
    } catch {
      acct.balance = null;
    }
  }
  renderAccounts(lastLoadedAccounts);
  refreshBalancesBtn.textContent = 'Refresh Balances';
  refreshBalancesBtn.disabled = false;
}

refreshBalancesBtn.addEventListener('click', () => {
  if (lastLoadedAccounts.length) fetchBalances(lastLoadedAccounts);
});

function updateSendButton() {
  sendBtn.disabled = !(api && selectedAccount && toAddress.value.trim() && amountInput.value);
  refreshBalancesBtn.disabled = !(api && lastLoadedAccounts.length);
}

toAddress.addEventListener('input', updateSendButton);
amountInput.addEventListener('input', updateSendButton);

// ── Transfer ──

sendBtn.addEventListener('click', async () => {
  if (!api || !selectedAccount) return;

  const to = toAddress.value.trim();
  const taoAmount = parseFloat(amountInput.value);
  if (!to || isNaN(taoAmount) || taoAmount <= 0) {
    setTxStatus('Invalid input', 'err');
    return;
  }

  clearLog();
  const amountRao = BigInt(Math.round(taoAmount * 1e9));
  const { address: fromAddr, accountIndex, addressOffset } = selectedAccount;

  sendBtn.disabled = true;
  txResultWrap.classList.add('hidden');
  txResult.textContent = '';

  log('═══ CHAIN CONTEXT ═══');
  log(`RPC: ${getRpcUrl()}`);
  log(`specVersion: ${api.runtimeVersion.specVersion.toNumber()}`);
  log(`transactionVersion: ${api.runtimeVersion.transactionVersion.toNumber()}`);
  log(`genesisHash: ${api.genesisHash.toHex()}`);
  log(`signedExtensions: ${JSON.stringify(api.registry.signedExtensions)}`);

  try {
    const meta = api.runtimeMetadata;
    const versions = meta.asLatest?.extrinsic?.version?.toJSON?.()
      ?? meta.asV15?.extrinsic?.version?.toJSON?.()
      ?? meta.asV14?.extrinsic?.version;
    log(`metadata extrinsic versions: ${JSON.stringify(versions)}`);
  } catch (e) {
    log(`metadata extrinsic versions: (could not read: ${e.message})`);
  }

  const hasMetaHash = chainSupportsMetadataHash(api);
  const devChain = isDevChain(api);
  log(`CheckMetadataHash in runtime: ${hasMetaHash}`);
  log(`devChain (Unit/0): ${devChain}`);

  if (!hasMetaHash) {
    log('FATAL: chain has no CheckMetadataHash → Ledger cannot sign on this network');
    setTxStatus('This network does not support CheckMetadataHash. Ledger signing is impossible.', 'err');
    sendBtn.disabled = false;
    return;
  }
  if (devChain) {
    log('WARNING: dev chain detected (Unit/0). merkleizeMetadata needs real token info — hash will likely be wrong');
  }

  log('');
  log('═══ TRANSFER ═══');
  log(`from: ${fromAddr}`);
  log(`to:   ${to}`);
  log(`amount: ${taoAmount} TAO = ${amountRao.toString()} RAO`);

  try {
    setTxStatus('Building transaction...', 'busy');
    const tx = api.tx.balances.transferKeepAlive(to, amountRao);
    log(`call hex: ${tx.method.toHex()}`);
    log(`call hash: ${tx.method.hash.toHex()}`);

    log('');
    log('═══ METADATA ═══');
    setTxStatus('Fetching metadata V15 for Ledger signing...', 'busy');
    const metadataV15 = await getMetadataV15Bytes(api);
    log(`metadata size: ${metadataV15.length} bytes`);
    const chainDecimals = getChainDecimals(api);
    const chainToken = getChainToken(api);
    log(`chainDecimals: ${chainDecimals}, chainToken: ${chainToken}`);

    // build.rs hardcodes enable_metadata_hash("TAO", 9) for ALL Bittensor networks.
    // Chain properties may differ (e.g. testnet reports "testTAO"), but the hash
    // embedded in the WASM always uses "TAO"/9. We must match that.
    const merkleized = merkleizeMetadata(metadataV15, { decimals: 9, tokenSymbol: 'TAO' });
    log(`merkleize params: decimals=9, tokenSymbol=TAO (hardcoded to match build.rs)`);
    const metadataDigest = u8aToHex(merkleized.digest());
    log(`merkleized digest: ${metadataDigest}`);

    const signer = createLedgerSigner(api, merkleized, accountIndex, addressOffset);
    const signOptions = {
      signer,
      era: 64,
      withSignedTransaction: true,
      mode: 1,
      metadataHash: metadataDigest,
    };
    log(`signOptions: mode=1, metadataHash=${metadataDigest}`);

    log('');
    log('═══ SIGNING ═══');
    setTxStatus('Confirm on Ledger device...', 'warn');
    const signedTx = await tx.signAsync(fromAddr, signOptions);

    const txHash = signedTx.hash.toHex();
    const fullHex = signedTx.toHex();
    log(`signedTx hash: ${txHash}`);
    log(`signedTx hex (${(fullHex.length - 2) / 2} bytes): ${fullHex}`);
    log(`signedTx isSigned: ${signedTx.isSigned}`);
    log(`signedTx signer: ${signedTx.signer?.toString()}`);
    log(`signedTx version: ${signedTx.version}`);

    log('');
    log('═══ SENDING ═══');
    setTxStatus(`Signed. Broadcasting ${truncAddr(txHash)}...`, 'busy');

    const result = await new Promise((resolve, reject) => {
      let done = false;
      const finish = (fn) => { if (done) return; done = true; fn(); };

      signedTx.send((submitResult) => {
        if (done) return;
        const status = submitResult.status;
        log(`status: ${status.type}`);

        if (submitResult.dispatchError) {
          let errText;
          const de = submitResult.dispatchError;
          if (de.isModule) {
            try {
              const decoded = api.registry.findMetaError(de.asModule);
              errText = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
            } catch { errText = de.toString(); }
          } else {
            errText = de.toString();
          }
          log(`dispatchError: ${errText}`);
          finish(() => reject(new Error(`On-chain error: ${errText}`)));
          return;
        }

        if (status.isReady) {
          log('Ready (in tx pool)');
          setTxStatus('Transaction broadcast. Waiting for block inclusion...', 'busy');
        } else if (status.isBroadcast) {
          log('Broadcast to network');
          setTxStatus('Transaction broadcast to network. Waiting for block...', 'busy');
        } else if (status.isInBlock) {
          const blockHash = status.asInBlock.toHex();
          log(`InBlock: ${blockHash}`);
          setTxStatus('Included in block. Decoding events...', 'busy');

          const failedEvent = submitResult.events?.find(({ event }) =>
            api.events.system?.ExtrinsicFailed?.is(event)
          );
          if (failedEvent) {
            const errData = failedEvent.event.data[0];
            let errMsg = 'ExtrinsicFailed';
            if (errData?.isModule) {
              try {
                const decoded = api.registry.findMetaError(errData.asModule);
                errMsg = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
              } catch {}
            }
            log(`ExtrinsicFailed: ${errMsg}`);
            finish(() => reject(new Error(`Transaction failed: ${errMsg}`)));
            return;
          }

          log(`Events: ${submitResult.events?.map(e => `${e.event.section}.${e.event.method}`).join(', ')}`);

          api.rpc.chain.getHeader(blockHash).then(header => {
            const blockNum = header.number.toNumber();
            log(`Block #${blockNum}`);
            finish(() => resolve({ txHash, blockHash, blockNumber: blockNum }));
          }).catch(() => {
            finish(() => resolve({ txHash, blockHash, blockNumber: '?' }));
          });
        } else if (status.isDropped || status.isInvalid || status.isUsurped) {
          log(`Dropped/Invalid: ${status.type}`);
          finish(() => reject(new Error(`Transaction dropped: ${status.type}`)));
        }
      }).catch(err => {
        log(`send() error: ${err.message}`);
        finish(() => reject(err));
      });
    });

    log('');
    log('═══ RESULT ═══');
    log(`txHash: ${result.txHash}`);
    log(`blockHash: ${result.blockHash}`);
    log(`blockNumber: ${result.blockNumber}`);

    setTxStatus(`Success! Included in block #${result.blockNumber}`, 'ok');
    txResultWrap.classList.remove('hidden');
    txResult.textContent = [
      `Transaction Hash: ${result.txHash}`,
      `Block Hash:       ${result.blockHash}`,
      `Block Number:     ${result.blockNumber}`,
    ].join('\n');

  } catch (err) {
    log(`ERROR: ${err.message}`);
    log(`Stack: ${err.stack}`);

    const code = classifyLedgerError(err);
    if (code !== LEDGER_ERROR.UNKNOWN) {
      setTxStatus(ledgerErrorMessage(code, err), 'err');
    } else {
      setTxStatus(`Error: ${err.message}`, 'err');
    }
    txResultWrap.classList.remove('hidden');
    txResult.textContent = `${err.stack ?? err.message}`;
  } finally {
    sendBtn.disabled = false;
    updateSendButton();
  }
});

function setTxStatus(text, tone) {
  txStatusEl.textContent = text;
  txStatusEl.className = `status-box status-${tone}`;
}

// Explicitly fetch metadata V15. Never V16.
// V16 has a different type ordering that produces a different merkle hash
// than what the chain's frame_metadata_hash_extension computes.
// This is the same fix Talisman applied in PR #2183.
async function getMetadataV15Bytes(apiInst) {
  try {
    const opaque = await apiInst.call.metadata.metadataAtVersion(15);
    if (opaque && opaque.isEmpty === false) {
      log('metadata: got V15 via metadataAtVersion(15)');
      if (typeof opaque.unwrap === 'function') return opaque.unwrap().toU8a();
      return opaque.toU8a();
    }
    log('metadata: V15 not available, falling back to api.runtimeMetadata (may be V14 or V16!)');
  } catch (err) {
    log(`metadata: metadataAtVersion(15) failed: ${err.message}, using fallback`);
  }
  return apiInst.runtimeMetadata.toU8a();
}

// Builds a polkadot.js-compatible signer object for Ledger.
// signPayload is called by tx.signAsync(). We serialize the payload,
// generate a merkle proof, then delegate actual device communication
// to monitor.signWithMetadata() which handles exclusive access.
function createLedgerSigner(apiInst, merkleized, accountIndex, addressOffset) {
  let nextId = 1;
  return {
    signPayload: async (payload) => {
      const requestId = nextId++;

      log(`── signPayload #${requestId} ──`);
      log(`address: ${payload.address}`);
      log(`method: ${payload.method?.slice(0, 40)}...`);
      log(`nonce: ${payload.nonce}, era: ${payload.era}, tip: ${payload.tip}`);
      log(`mode: ${payload.mode}, metadataHash: ${payload.metadataHash ?? 'null'}`);
      log(`specVersion: ${payload.specVersion}, txVersion: ${payload.transactionVersion}`);
      log(`genesisHash: ${payload.genesisHash}`);
      log(`blockHash: ${payload.blockHash}`);
      log(`signedExtensions: ${JSON.stringify(payload.signedExtensions)}`);
      log(`version: ${payload.version}`);

      const extrinsicPayload = apiInst.registry.createTypeUnsafe('ExtrinsicPayload', [payload, { version: payload.version }]);
      const payloadBytes = extrinsicPayload.toU8a({ method: true });
      log(`payload: ${payloadBytes.length} bytes ${payloadBytes.length > 256 ? '(will be blake2-256 hashed)' : ''}`);
      log(`payload hex: ${u8aToHex(payloadBytes)}`);

      const payloadHex = u8aToHex(payloadBytes);
      const metadataProof = merkleized.getProofForExtrinsicPayload(payloadHex);
      log(`metadata proof: ${metadataProof.length} bytes`);
      log(`sending to Ledger signWithMetadata (index=${accountIndex}, offset=${addressOffset})...`);

      const rawSig = await monitor.signWithMetadata(payloadBytes, metadataProof, accountIndex, { addressOffset });
      log(`raw signature: ${rawSig}`);
      const normalizedSig = normalizeLedgerSignature(rawSig);
      log(`normalized (Ed25519 MultiSignature): ${normalizedSig}`);

      return { id: requestId, signature: normalizedSig };
    },
  };
}

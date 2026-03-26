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

import {
  TAO_DECIMALS, TOKEN_SYMBOL,
  MERKLE_DECIMALS, MERKLE_TOKEN,
  truncAddr, chainSupportsMetadataHash,
  getChainDecimals, getChainToken, isDevChain,
  getArgTypeName, parseExtrinsicArgs,
  formatDocs, copyToClipboard, txExplorerUrl,
} from './chain-utils.js';

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

let api = null;
let selectedAccount = null;
let accountsLoaded = false;
let lastLoadedAccounts = [];

const $ = (id) => document.getElementById(id);
const topRow = $('topRow');
const networkPresetTrigger = $('networkPresetTrigger');
const networkPresetDropdown = $('networkPresetDropdown');
const customUrlWrap = $('customUrlWrap');
const customUrl = $('customUrl');
let networkPresetValue = 'wss://lite.sub.latent.to:443';
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
const accountsTitle = $('accountsTitle');
const refreshBalancesBtn = $('refreshBalancesBtn');
const fromAddress = $('fromAddress');
const toAddress = $('toAddress');
const amountInput = $('amount');
const sendBtn = $('sendBtn');
const txStatusEl = $('txStatus');
const txResultWrap = $('txResultWrap');
const txResult = $('txResult');
const logPanel = $('logPanel');
const palletSelectTrigger = $('palletSelectTrigger');
const palletSelectDropdown = $('palletSelectDropdown');
const methodSelectTrigger = $('methodSelectTrigger');
const methodSelectDropdown = $('methodSelectDropdown');
let palletSelectValue = '';
let methodSelectValue = '';
const extrinsicDocs = $('extrinsicDocs');
const extrinsicArgs = $('extrinsicArgs');
const extrinsicSendBtn = $('extrinsicSendBtn');
const transferPane = $('transferPane');
const builderPane = $('builderPane');
const txModeToggle = $('txModeToggle');
const logCopyBtn = $('logCopyBtn');
const resultCopyBtn = $('resultCopyBtn');
const explorerLink = $('explorerLink');
const explorerLinkLabel = $('explorerLinkLabel');

const ICON_COPY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
const ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
const COPY_FEEDBACK_MS = 1500;

logCopyBtn.innerHTML = ICON_COPY;
resultCopyBtn.innerHTML = ICON_COPY;

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

function getRpcUrl() {
  return networkPresetValue === 'custom' ? customUrl.value.trim() : networkPresetValue;
}

function log(msg) {
  const ts = new Date().toISOString().slice(11, 23);
  logPanel.textContent += `[${ts}] ${msg}\n`;
  logPanel.scrollTop = logPanel.scrollHeight;
}

function clearLog() {
  logPanel.textContent = '';
}

function positionDropdown(trigger, dropdown) {
  const rect = trigger.getBoundingClientRect();
  dropdown.style.top = `${rect.bottom + 4}px`;
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.width = `${rect.width}px`;
  dropdown.style.maxHeight = 'none';
  const available = window.innerHeight - rect.bottom - 16;
  const natural = dropdown.scrollHeight;
  if (natural > available && available > 80) {
    dropdown.style.maxHeight = `${available}px`;
  }
}

function setupCustomDropdown(trigger, dropdown, wrapId, onChange) {
  trigger.addEventListener('click', () => {
    if (trigger.disabled) return;
    const wasHidden = dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden');
    if (wasHidden) positionDropdown(trigger, dropdown);
  });
  dropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('.custom-select-option');
    if (!opt) return;
    dropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    trigger.querySelector('.custom-select-label').textContent = opt.querySelector('.custom-select-label').textContent;
    dropdown.classList.add('hidden');
    onChange(opt.dataset.value);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest(`#${wrapId}`)) dropdown.classList.add('hidden');
  });
}

function populateCustomDropdown(trigger, dropdown, items, placeholder) {
  dropdown.innerHTML = '';
  for (const item of items) {
    const div = document.createElement('div');
    div.className = 'custom-select-option';
    div.dataset.value = item;
    div.innerHTML = `<span class="custom-select-label">${item}</span>`;
    dropdown.appendChild(div);
  }
  trigger.querySelector('.custom-select-label').textContent = placeholder;
  trigger.disabled = items.length === 0;
}

function swapTopSections(swap) {
  const slideClass = swap ? 'swap-slide-out' : 'swap-slide-back';
  topRow.classList.add(slideClass);
  setTimeout(() => {
    topRow.querySelectorAll('section').forEach(s => s.style.transition = 'none');
    topRow.classList.remove(slideClass);
    topRow.classList.toggle('swapped', swap);
    void topRow.offsetHeight;
    topRow.querySelectorAll('section').forEach(s => s.style.transition = '');
  }, 420);
}

// ── Network ──

networkPresetTrigger.addEventListener('click', () => {
  const wasHidden = networkPresetDropdown.classList.contains('hidden');
  networkPresetDropdown.classList.toggle('hidden');
  if (wasHidden) positionDropdown(networkPresetTrigger, networkPresetDropdown);
});

networkPresetDropdown.addEventListener('click', (e) => {
  const opt = e.target.closest('.custom-select-option');
  if (!opt) return;
  const value = opt.dataset.value;
  networkPresetValue = value;

  networkPresetDropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
  opt.classList.add('selected');

  const labelEl = opt.querySelector('.custom-select-label');
  const urlEl = opt.querySelector('.custom-select-url');
  networkPresetTrigger.querySelector('.custom-select-label').textContent = labelEl.textContent;
  const triggerUrl = networkPresetTrigger.querySelector('.custom-select-url');
  triggerUrl.textContent = urlEl ? urlEl.textContent : '';

  customUrlWrap.classList.toggle('hidden', value !== 'custom');
  networkPresetDropdown.classList.add('hidden');
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#networkPresetWrap')) {
    networkPresetDropdown.classList.add('hidden');
  }
});

setupCustomDropdown(palletSelectTrigger, palletSelectDropdown, 'palletSelectWrap', (value) => {
  palletSelectValue = value;
  onPalletChanged(value);
});

setupCustomDropdown(methodSelectTrigger, methodSelectDropdown, 'methodSelectWrap', (value) => {
  methodSelectValue = value;
  onMethodChanged(value);
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
    if (devChain) statusLine += ' | DEV CHAIN (metadata hash will be broken)';
    if (!hasMetaHash) statusLine += ' | WARNING: Ledger signing not possible without CheckMetadataHash';

    setStatus(networkStatus, statusLine, hasMetaHash && !devChain ? 'ok' : 'warn');
    connectBtn.disabled = true;
    disconnectBtn.disabled = false;
    swapTopSections(true);
    updateSendButton();
    populatePallets(api);
  } catch (err) {
    setStatus(networkStatus, `Connection failed: ${err.message}`, 'err');
    api = null;
    connectBtn.disabled = false;
  }
});

disconnectBtn.addEventListener('click', async () => {
  if (api) { try { await api.disconnect(); } catch {} }
  api = null;
  connectBtn.disabled = false;
  disconnectBtn.disabled = true;
  swapTopSections(false);
  setStatus(networkStatus, 'Disconnected', 'neutral');
  updateSendButton();
  resetExtrinsicBuilder();
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
  accountsTitle.textContent = 'Accounts';
  accountsBody.innerHTML = '<tr><td colspan="5" class="text-muted">No accounts loaded</td></tr>';
  lastLoadedAccounts = [];
  selectedAccount = null;
  refreshBalancesBtn.disabled = true;
  fromAddress.value = '';
  loadAccountsBtn.textContent = 'Load 5 Accounts';
  updateSendButton();
  updateExtrinsicSendButton();
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
    const startIndex = lastLoadedAccounts.length > 0
      ? lastLoadedAccounts[lastLoadedAccounts.length - 1].accountIndex + 1
      : 0;
    const newAccounts = await monitor.getAccounts(5, {
      startIndex,
      onProgress({ current, total }) {
        setLedgerStatus(`Fetching account ${current}/${total} from Ledger...`, 'busy');
      },
    });

    mergeAccounts(newAccounts);
    accountsLoaded = true;
    loadAccountsBtn.textContent = 'Load 5 More';
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
  renderAccounts(lastLoadedAccounts, true);
}

function renderAccounts(accounts, animate = false) {
  accountsTitle.textContent = accounts.length > 0 ? `Accounts (${accounts.length})` : 'Accounts';
  accountsBody.innerHTML = '';
  for (let i = 0; i < accounts.length; i++) {
    const acct = accounts[i];
    const tr = document.createElement('tr');
    tr.setAttribute('data-selectable', '');
    if (animate) {
      tr.classList.add('fade-in');
      tr.style.animationDelay = `${i * 40}ms`;
    }
    if (selectedAccount?.address === acct.address) tr.classList.add('selected');
    const balStr = acct.balance != null ? acct.balance.toFixed(4) : '...';
    tr.innerHTML = `
      <td>${acct.accountIndex}</td>
      <td title="${acct.address}">${truncAddr(acct.address)}</td>
      <td>${acct.derivationPath || `m/44'/${SLIP44}'/${acct.accountIndex}'/0'/0'`}</td>
      <td>${balStr}</td>
      <td class="text-right">
        <button class="copy-btn" title="Copy address" data-copy="${acct.address}">${ICON_COPY}</button>
      </td>
    `;
    tr.addEventListener('click', () => {
      selectedAccount = acct;
      fromAddress.value = acct.address;
      renderAccounts(lastLoadedAccounts);
      updateSendButton();
      updateExtrinsicSendButton();
    });
    const copyBtn = tr.querySelector('.copy-btn');
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await copyToClipboard(copyBtn.dataset.copy);
      if (ok) {
        copyBtn.innerHTML = ICON_CHECK;
        setTimeout(() => { copyBtn.innerHTML = ICON_COPY; }, COPY_FEEDBACK_MS);
      }
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

// ── Segmented control ──

txModeToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-mode]');
  if (!btn) return;
  for (const b of txModeToggle.querySelectorAll('button')) {
    b.classList.toggle('active', b === btn);
  }
  transferPane.classList.toggle('hidden', btn.dataset.mode !== 'transfer');
  builderPane.classList.toggle('hidden', btn.dataset.mode !== 'builder');
});

// ── Log copy ──

logCopyBtn.addEventListener('click', async () => {
  const ok = await copyToClipboard(logPanel.textContent);
  if (ok) {
    logCopyBtn.innerHTML = ICON_CHECK;
    setTimeout(() => { logCopyBtn.innerHTML = ICON_COPY; }, COPY_FEEDBACK_MS);
  }
});

resultCopyBtn.addEventListener('click', async () => {
  const ok = await copyToClipboard(txResult.textContent);
  if (ok) {
    resultCopyBtn.innerHTML = ICON_CHECK;
    setTimeout(() => { resultCopyBtn.innerHTML = ICON_COPY; }, COPY_FEEDBACK_MS);
  }
});

// ── Shared transaction helpers ──

function handleTxError(err) {
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
}

function logChainContext() {
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
  return { hasMetaHash, devChain };
}

async function signAndSendTx(tx, fromAddr, accountIndex, addressOffset) {
  setTxStatus('Building transaction...', 'busy');
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

  const merkleized = merkleizeMetadata(metadataV15, { decimals: MERKLE_DECIMALS, tokenSymbol: MERKLE_TOKEN });
  log(`merkleize params: decimals=${MERKLE_DECIMALS}, tokenSymbol=${MERKLE_TOKEN} (hardcoded to match build.rs)`);
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

  const explorer = txExplorerUrl(
    result.txHash,
    api.genesisHash.toHex(),
    getRpcUrl(),
    result.blockHash,
  );
  if (explorer) {
    explorerLink.href = explorer.url;
    explorerLinkLabel.textContent = explorer.label;
    explorerLink.classList.remove('hidden');
  } else {
    explorerLink.classList.add('hidden');
  }

  matrixRain();

  return result;
}

function matrixRain() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;opacity:1;transition:opacity 0.8s';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);

  const W = window.innerWidth;
  const H = window.innerHeight;
  const chars = 'τΤɃ₿ΞΣ01αβγδ0123456789ABCDEF⟨⟩{}[]≡≈∞∫Δ';
  const size = 14;
  const cols = Math.ceil(W / size);
  const drops = Array.from({ length: cols }, () => Math.random() * -40 | 0);
  const speeds = Array.from({ length: cols }, () => 0.3 + Math.random() * 0.7);

  const DURATION = 2800;
  const FADE_AT = 1800;
  const start = performance.now();
  let raf;

  function draw(now) {
    const elapsed = now - start;
    if (elapsed > DURATION) {
      canvas.style.opacity = '0';
      setTimeout(() => canvas.remove(), 800);
      return;
    }

    if (elapsed > FADE_AT) {
      canvas.style.opacity = String(1 - (elapsed - FADE_AT) / (DURATION - FADE_AT));
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < cols; i++) {
      const ch = chars[(Math.random() * chars.length) | 0];
      const y = drops[i] * size;

      const bright = Math.random();
      if (bright > 0.92) {
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#6ec85c';
        ctx.shadowBlur = 12;
      } else {
        const g = 100 + (Math.random() * 155) | 0;
        ctx.fillStyle = `rgba(${30 + (Math.random() * 40) | 0}, ${g}, ${40 + (Math.random() * 30) | 0}, ${0.6 + Math.random() * 0.4})`;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      ctx.font = `${size}px JetBrains Mono, monospace`;
      ctx.fillText(ch, i * size, y);
      ctx.shadowBlur = 0;

      drops[i] += speeds[i];
      if (y > H && Math.random() > 0.98) {
        drops[i] = Math.random() * -20 | 0;
      }
    }

    raf = requestAnimationFrame(draw);
  }

  raf = requestAnimationFrame(draw);
}

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
  explorerLink.classList.add('hidden');
  const { hasMetaHash, devChain } = logChainContext();
  if (!hasMetaHash) {
    log('FATAL: chain has no CheckMetadataHash');
    setTxStatus('This network does not support CheckMetadataHash. Ledger signing is impossible.', 'err');
    sendBtn.disabled = false;
    return;
  }
  if (devChain) {
    log('WARNING: dev chain detected (Unit/0)');
  }
  log('');
  log('═══ TRANSFER ═══');
  log(`from: ${fromAddr}`);
  log(`to:   ${to}`);
  log(`amount: ${taoAmount} TAO = ${amountRao.toString()} RAO`);
  try {
    const tx = api.tx.balances.transferKeepAlive(to, amountRao);
    await signAndSendTx(tx, fromAddr, accountIndex, addressOffset);
  } catch (err) {
    handleTxError(err);
  } finally {
    sendBtn.disabled = false;
    updateSendButton();
  }
});

// ── Extrinsic Builder ──

function populatePallets(apiInst) {
  const pallets = Object.keys(apiInst.tx).sort();
  populateCustomDropdown(palletSelectTrigger, palletSelectDropdown, pallets, '-- select pallet --');
  palletSelectValue = '';
  populateCustomDropdown(methodSelectTrigger, methodSelectDropdown, [], 'Select a pallet first');
  methodSelectTrigger.disabled = true;
  methodSelectValue = '';
  extrinsicDocs.textContent = '';
  extrinsicDocs.classList.add('hidden');
  extrinsicArgs.innerHTML = '';
}

function resetExtrinsicBuilder() {
  populateCustomDropdown(palletSelectTrigger, palletSelectDropdown, [], 'Connect to load pallets...');
  palletSelectTrigger.disabled = true;
  palletSelectValue = '';
  populateCustomDropdown(methodSelectTrigger, methodSelectDropdown, [], 'Select a pallet first');
  methodSelectTrigger.disabled = true;
  methodSelectValue = '';
  extrinsicDocs.textContent = '';
  extrinsicDocs.classList.add('hidden');
  extrinsicArgs.innerHTML = '';
  extrinsicSendBtn.disabled = true;
}

function createArgInput(arg) {
  const typeName = getArgTypeName(arg, api.registry).toLowerCase();

  if (typeName === 'bool') {
    const sel = document.createElement('select');
    sel.innerHTML = '<option value="false">false</option><option value="true">true</option>';
    sel.addEventListener('change', updateExtrinsicSendButton);
    return sel;
  }

  if (/bytes|vec<u8>/.test(typeName)) {
    const ta = document.createElement('textarea');
    ta.className = 'arg-textarea';
    ta.rows = 2;
    ta.placeholder = '0x... (hex) or raw text';
    ta.addEventListener('input', updateExtrinsicSendButton);
    return ta;
  }

  const input = document.createElement('input');
  input.addEventListener('input', updateExtrinsicSendButton);

  if (/^(u8|u16|u32|u64|u128|compact)/i.test(typeName)) {
    input.type = 'text';
    input.placeholder = '0';
    input.inputMode = 'numeric';
  } else if (/accountid|multiaddress|address/i.test(typeName)) {
    input.placeholder = '5...';
  } else if (/h256|hash/i.test(typeName)) {
    input.placeholder = '0x...';
  } else {
    input.placeholder = `${getArgTypeName(arg, api.registry)} (string or JSON)`;
  }

  return input;
}

function collectArgs() {
  const inputs = extrinsicArgs.querySelectorAll('[data-arg-name]');
  const argDefs = [];
  const values = [];
  for (const input of inputs) {
    argDefs.push({ typeName: input.dataset.argType ?? '', name: input.dataset.argName });
    values.push(input.value?.trim() ?? '');
  }
  return parseExtrinsicArgs(argDefs, values);
}

function updateExtrinsicSendButton() {
  if (!api || !selectedAccount || !palletSelectValue || !methodSelectValue) {
    extrinsicSendBtn.disabled = true;
    return;
  }
  const inputs = [...extrinsicArgs.querySelectorAll('[data-arg-name]')];
  const allFilled = inputs.length === 0 || inputs.every(i => i.value?.trim());
  extrinsicSendBtn.disabled = !allFilled;
}

function onPalletChanged(pallet) {
  methodSelectValue = '';
  extrinsicDocs.textContent = '';
  extrinsicDocs.classList.add('hidden');
  extrinsicArgs.innerHTML = '';
  extrinsicSendBtn.disabled = true;
  if (!pallet || !api?.tx[pallet]) {
    populateCustomDropdown(methodSelectTrigger, methodSelectDropdown, [], '-- select method --');
    methodSelectTrigger.disabled = true;
    return;
  }
  const methods = Object.keys(api.tx[pallet]).sort().filter(
    m => typeof api.tx[pallet][m] === 'function' && api.tx[pallet][m].meta
  );
  populateCustomDropdown(methodSelectTrigger, methodSelectDropdown, methods, '-- select method --');
  methodSelectTrigger.disabled = false;
}

function onMethodChanged(method) {
  const pallet = palletSelectValue;
  extrinsicDocs.textContent = '';
  extrinsicDocs.classList.add('hidden');
  extrinsicArgs.innerHTML = '';
  extrinsicSendBtn.disabled = true;
  if (!pallet || !method || !api?.tx[pallet]?.[method]) return;

  const fn = api.tx[pallet][method];
  const meta = fn.meta;

  const docsHtml = formatDocs(meta.docs.map(d => d.toString()));
  if (docsHtml) {
    extrinsicDocs.innerHTML = docsHtml;
    extrinsicDocs.classList.remove('hidden');
  }

  const args = meta.args;
  if (args.length === 0) {
    extrinsicArgs.innerHTML = '<div class="text-muted text-sm">No arguments required</div>';
    updateExtrinsicSendButton();
    return;
  }

  for (const arg of args) {
    const div = document.createElement('div');
    div.className = 'arg-field';

    const label = document.createElement('label');
    const tn = getArgTypeName(arg, api.registry);
    label.innerHTML = `${arg.name.toString()} <span class="arg-type">${tn}</span>`;
    div.appendChild(label);

    const input = createArgInput(arg);
    input.dataset.argName = arg.name.toString();
    input.dataset.argType = tn;
    div.appendChild(input);

    extrinsicArgs.appendChild(div);
  }
  updateExtrinsicSendButton();
}

extrinsicSendBtn.addEventListener('click', async () => {
  if (!api || !selectedAccount) return;
  const pallet = palletSelectValue;
  const method = methodSelectValue;
  if (!pallet || !method) return;

  clearLog();
  const { address: fromAddr, accountIndex, addressOffset } = selectedAccount;

  extrinsicSendBtn.disabled = true;
  txResultWrap.classList.add('hidden');
  txResult.textContent = '';
  explorerLink.classList.add('hidden');

  const { hasMetaHash, devChain } = logChainContext();

  if (!hasMetaHash) {
    log('FATAL: chain has no CheckMetadataHash');
    setTxStatus('This network does not support CheckMetadataHash. Ledger signing is impossible.', 'err');
    extrinsicSendBtn.disabled = false;
    return;
  }
  if (devChain) {
    log('WARNING: dev chain detected');
  }

  try {
    const args = collectArgs();
    log('');
    log(`═══ EXTRINSIC: ${pallet}.${method} ═══`);
    log(`from: ${fromAddr}`);
    log(`args: ${JSON.stringify(args)}`);

    const tx = api.tx[pallet][method](...args);
    await signAndSendTx(tx, fromAddr, accountIndex, addressOffset);
  } catch (err) {
    handleTxError(err);
  } finally {
    extrinsicSendBtn.disabled = false;
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

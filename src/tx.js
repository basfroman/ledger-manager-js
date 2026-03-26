import {
  chainSupportsMetadataHash,
  formatDocs,
  getArgTypeName,
  getChainDecimals,
  getChainToken,
  isDevChain,
  parseExtrinsicArgs,
  truncAddr,
  txExplorerUrl,
} from './chain-utils.js';
import {
  classifyLedgerError,
  LEDGER_ERROR,
  ledgerErrorMessage,
  normalizeLedgerSignature,
} from './ledger-manager.js';
import { MERKLE_DECIMALS, MERKLE_TOKEN } from './constants.js';
import { u8aToHex, merkleizeMetadata } from './deps.js';
import { monitor, updateSendButton } from './accounts.js';
import { getRpcUrl } from './network.js';
import { state } from './state.js';
import {
  dom,
  log,
  clearLog,
  matrixRain,
  populateCustomDropdown,
  setupCustomDropdown,
  setTxStatus,
} from './ui.js';

function handleTxError(err) {
  log(`ERROR: ${err.message}`);
  log(`Stack: ${err.stack}`);
  const code = classifyLedgerError(err);
  if (code !== LEDGER_ERROR.UNKNOWN) {
    setTxStatus(ledgerErrorMessage(code, err), 'err');
  } else {
    setTxStatus(`Error: ${err.message}`, 'err');
  }
  dom.txResultWrap.classList.remove('hidden');
  dom.txResult.textContent = `${err.stack ?? err.message}`;
}

function logChainContext() {
  log('═══ CHAIN CONTEXT ═══');
  log(`RPC: ${getRpcUrl()}`);
  log(`specVersion: ${state.api.runtimeVersion.specVersion.toNumber()}`);
  log(`transactionVersion: ${state.api.runtimeVersion.transactionVersion.toNumber()}`);
  log(`genesisHash: ${state.api.genesisHash.toHex()}`);
  log(`signedExtensions: ${JSON.stringify(state.api.registry.signedExtensions)}`);
  try {
    const meta = state.api.runtimeMetadata;
    const versions = meta.asLatest?.extrinsic?.version?.toJSON?.()
      ?? meta.asV15?.extrinsic?.version?.toJSON?.()
      ?? meta.asV14?.extrinsic?.version;
    log(`metadata extrinsic versions: ${JSON.stringify(versions)}`);
  } catch (e) {
    log(`metadata extrinsic versions: (could not read: ${e.message})`);
  }
  const hasMetaHash = chainSupportsMetadataHash(state.api);
  const devChain = isDevChain(state.api);
  log(`CheckMetadataHash in runtime: ${hasMetaHash}`);
  log(`devChain (Unit/0): ${devChain}`);
  return { hasMetaHash, devChain };
}

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

async function signAndSendTx(tx, fromAddr, accountIndex, addressOffset) {
  setTxStatus('Building transaction...', 'busy');
  log(`call hex: ${tx.method.toHex()}`);
  log(`call hash: ${tx.method.hash.toHex()}`);

  log('');
  log('═══ METADATA ═══');
  setTxStatus('Fetching metadata V15 for Ledger signing...', 'busy');
  const metadataV15 = await getMetadataV15Bytes(state.api);
  log(`metadata size: ${metadataV15.length} bytes`);
  const chainDecimals = getChainDecimals(state.api);
  const chainToken = getChainToken(state.api);
  log(`chainDecimals: ${chainDecimals}, chainToken: ${chainToken}`);

  const merkleized = merkleizeMetadata(metadataV15, { decimals: MERKLE_DECIMALS, tokenSymbol: MERKLE_TOKEN });
  log(`merkleize params: decimals=${MERKLE_DECIMALS}, tokenSymbol=${MERKLE_TOKEN} (hardcoded to match build.rs)`);
  const metadataDigest = u8aToHex(merkleized.digest());
  log(`merkleized digest: ${metadataDigest}`);

  const signer = createLedgerSigner(state.api, merkleized, accountIndex, addressOffset);
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
            const decoded = state.api.registry.findMetaError(de.asModule);
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
          state.api.events.system?.ExtrinsicFailed?.is(event)
        );
        if (failedEvent) {
          const errData = failedEvent.event.data[0];
          let errMsg = 'ExtrinsicFailed';
          if (errData?.isModule) {
            try {
              const decoded = state.api.registry.findMetaError(errData.asModule);
              errMsg = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
            } catch {}
          }
          log(`ExtrinsicFailed: ${errMsg}`);
          finish(() => reject(new Error(`Transaction failed: ${errMsg}`)));
          return;
        }

        log(`Events: ${submitResult.events?.map(e => `${e.event.section}.${e.event.method}`).join(', ')}`);

        state.api.rpc.chain.getHeader(blockHash).then(header => {
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
  dom.txResultWrap.classList.remove('hidden');
  dom.txResult.textContent = [
    `Transaction Hash: ${result.txHash}`,
    `Block Hash:       ${result.blockHash}`,
    `Block Number:     ${result.blockNumber}`,
  ].join('\n');

  const explorer = txExplorerUrl(
    result.txHash,
    state.api.genesisHash.toHex(),
    getRpcUrl(),
    result.blockHash,
  );
  if (explorer) {
    dom.explorerLink.href = explorer.url;
    dom.explorerLinkLabel.textContent = explorer.label;
    dom.explorerLink.classList.remove('hidden');
  } else {
    dom.explorerLink.classList.add('hidden');
  }

  matrixRain();

  return result;
}

export function populatePallets(apiInst) {
  const pallets = Object.keys(apiInst.tx).sort();
  populateCustomDropdown(dom.palletSelectTrigger, dom.palletSelectDropdown, pallets, '-- select pallet --');
  state.palletSelectValue = '';
  populateCustomDropdown(dom.methodSelectTrigger, dom.methodSelectDropdown, [], 'Select a pallet first');
  dom.methodSelectTrigger.disabled = true;
  state.methodSelectValue = '';
  dom.extrinsicDocs.textContent = '';
  dom.extrinsicDocs.classList.add('hidden');
  dom.extrinsicArgs.innerHTML = '';
}

export function resetExtrinsicBuilder() {
  populateCustomDropdown(dom.palletSelectTrigger, dom.palletSelectDropdown, [], 'Connect to load pallets...');
  dom.palletSelectTrigger.disabled = true;
  state.palletSelectValue = '';
  populateCustomDropdown(dom.methodSelectTrigger, dom.methodSelectDropdown, [], 'Select a pallet first');
  dom.methodSelectTrigger.disabled = true;
  state.methodSelectValue = '';
  dom.extrinsicDocs.textContent = '';
  dom.extrinsicDocs.classList.add('hidden');
  dom.extrinsicArgs.innerHTML = '';
  dom.extrinsicSendBtn.disabled = true;
}

export function createArgInput(arg) {
  const typeName = getArgTypeName(arg, state.api.registry).toLowerCase();

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
    input.placeholder = `${getArgTypeName(arg, state.api.registry)} (string or JSON)`;
  }

  return input;
}

export function collectArgs() {
  const inputs = dom.extrinsicArgs.querySelectorAll('[data-arg-name]');
  const argDefs = [];
  const values = [];
  for (const input of inputs) {
    argDefs.push({ typeName: input.dataset.argType ?? '', name: input.dataset.argName });
    values.push(input.value?.trim() ?? '');
  }
  return parseExtrinsicArgs(argDefs, values);
}

export function updateExtrinsicSendButton() {
  if (!state.api || !state.selectedAccount || !state.palletSelectValue || !state.methodSelectValue) {
    dom.extrinsicSendBtn.disabled = true;
    return;
  }
  const inputs = [...dom.extrinsicArgs.querySelectorAll('[data-arg-name]')];
  const allFilled = inputs.length === 0 || inputs.every(i => i.value?.trim());
  dom.extrinsicSendBtn.disabled = !allFilled;
}

function onPalletChanged(pallet) {
  state.methodSelectValue = '';
  dom.extrinsicDocs.textContent = '';
  dom.extrinsicDocs.classList.add('hidden');
  dom.extrinsicArgs.innerHTML = '';
  dom.extrinsicSendBtn.disabled = true;
  if (!pallet || !state.api?.tx[pallet]) {
    populateCustomDropdown(dom.methodSelectTrigger, dom.methodSelectDropdown, [], '-- select method --');
    dom.methodSelectTrigger.disabled = true;
    return;
  }
  const methods = Object.keys(state.api.tx[pallet]).sort().filter(
    m => typeof state.api.tx[pallet][m] === 'function' && state.api.tx[pallet][m].meta
  );
  populateCustomDropdown(dom.methodSelectTrigger, dom.methodSelectDropdown, methods, '-- select method --');
  dom.methodSelectTrigger.disabled = false;
}

function onMethodChanged(method) {
  const pallet = state.palletSelectValue;
  dom.extrinsicDocs.textContent = '';
  dom.extrinsicDocs.classList.add('hidden');
  dom.extrinsicArgs.innerHTML = '';
  dom.extrinsicSendBtn.disabled = true;
  if (!pallet || !method || !state.api?.tx[pallet]?.[method]) return;

  const fn = state.api.tx[pallet][method];
  const meta = fn.meta;

  const docsHtml = formatDocs(meta.docs.map(d => d.toString()));
  if (docsHtml) {
    dom.extrinsicDocs.innerHTML = docsHtml;
    dom.extrinsicDocs.classList.remove('hidden');
  }

  const args = meta.args;
  if (args.length === 0) {
    dom.extrinsicArgs.innerHTML = '<div class="text-muted text-sm">No arguments required</div>';
    updateExtrinsicSendButton();
    return;
  }

  for (const arg of args) {
    const div = document.createElement('div');
    div.className = 'arg-field';

    const label = document.createElement('label');
    const tn = getArgTypeName(arg, state.api.registry);
    label.innerHTML = `${arg.name.toString()} <span class="arg-type">${tn}</span>`;
    div.appendChild(label);

    const input = createArgInput(arg);
    input.dataset.argName = arg.name.toString();
    input.dataset.argType = tn;
    div.appendChild(input);

    dom.extrinsicArgs.appendChild(div);
  }
  updateExtrinsicSendButton();
}

export function initTx() {
  setupCustomDropdown(dom.palletSelectTrigger, dom.palletSelectDropdown, 'palletSelectWrap', (value) => {
    state.palletSelectValue = value;
    onPalletChanged(value);
  });

  setupCustomDropdown(dom.methodSelectTrigger, dom.methodSelectDropdown, 'methodSelectWrap', (value) => {
    state.methodSelectValue = value;
    onMethodChanged(value);
  });

  dom.sendBtn.addEventListener('click', async () => {
    if (!state.api || !state.selectedAccount) return;
    const to = dom.toAddress.value.trim();
    const taoAmount = parseFloat(dom.amountInput.value);
    if (!to || isNaN(taoAmount) || taoAmount <= 0) {
      setTxStatus('Invalid input', 'err');
      return;
    }
    clearLog();
    const amountRao = BigInt(Math.round(taoAmount * 1e9));
    const { address: fromAddr, accountIndex, addressOffset } = state.selectedAccount;
    dom.sendBtn.disabled = true;
    dom.txResultWrap.classList.add('hidden');
    dom.txResult.textContent = '';
    dom.explorerLink.classList.add('hidden');
    const { hasMetaHash, devChain } = logChainContext();
    if (!hasMetaHash) {
      log('FATAL: chain has no CheckMetadataHash');
      setTxStatus('This network does not support CheckMetadataHash. Ledger signing is impossible.', 'err');
      dom.sendBtn.disabled = false;
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
      const tx = state.api.tx.balances.transferKeepAlive(to, amountRao);
      await signAndSendTx(tx, fromAddr, accountIndex, addressOffset);
    } catch (err) {
      handleTxError(err);
    } finally {
      dom.sendBtn.disabled = false;
      updateSendButton();
    }
  });

  dom.extrinsicSendBtn.addEventListener('click', async () => {
    if (!state.api || !state.selectedAccount) return;
    const pallet = state.palletSelectValue;
    const method = state.methodSelectValue;
    if (!pallet || !method) return;

    clearLog();
    const { address: fromAddr, accountIndex, addressOffset } = state.selectedAccount;

    dom.extrinsicSendBtn.disabled = true;
    dom.txResultWrap.classList.add('hidden');
    dom.txResult.textContent = '';
    dom.explorerLink.classList.add('hidden');

    const { hasMetaHash, devChain } = logChainContext();

    if (!hasMetaHash) {
      log('FATAL: chain has no CheckMetadataHash');
      setTxStatus('This network does not support CheckMetadataHash. Ledger signing is impossible.', 'err');
      dom.extrinsicSendBtn.disabled = false;
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

      const tx = state.api.tx[pallet][method](...args);
      await signAndSendTx(tx, fromAddr, accountIndex, addressOffset);
    } catch (err) {
      handleTxError(err);
    } finally {
      dom.extrinsicSendBtn.disabled = false;
    }
  });
}

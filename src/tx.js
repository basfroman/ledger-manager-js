import {
  buildCallDocHtml,
  chainSupportsMetadataHash,
  getArgTypeName,
  getChainDecimals,
  getChainToken,
  isDevChain,
  truncAddr,
  txExplorerUrl,
} from './chain-utils.js';
import { createArgInput, collectInputValues } from './arg-input.js';
import {
  classifyLedgerError,
  LEDGER_ERROR,
  ledgerErrorMessage,
  normalizeLedgerSignature,
} from './ledger-manager.js';
import { ACCOUNT_SOURCE, MERKLE_DECIMALS, MERKLE_TOKEN, MORTAL_ERA_PERIOD, MSG_LEDGER_NO_METADATA_HASH, SIGNING_MODE_METADATA_HASH } from './constants.js';
import { web3FromAddress } from '@polkadot/extension-dapp';
import { u8aToHex, merkleizeMetadata } from './deps.js';
import { monitor } from './accounts.js';
import { getRpcUrl } from './network.js';
import { isExtrinsicReady } from './readiness.js';
import { state } from './state.js';
import { computePreflight, renderPreflightDOM } from './preflight.js';
import { pushTimelineEvent } from './timeline.js';
import {
  dom,
  log,
  clearLog,
  matrixRain,
  populateCustomDropdown,
  setupCustomDropdown,
  setTxStatus,
  renderTimeline,
} from './ui.js';

let walletHintShown = false;

export function handleTxError(err) {
  const error = err instanceof Error ? err : new Error(err != null ? String(err) : 'Unknown error');
  log(`ERROR: ${error.message}`);
  log(`Stack: ${error.stack}`);
  pushTimelineEvent('error', `TX Error: ${error.message}`);
  renderTimeline();
  if (state.selectedAccount?.accountSource === ACCOUNT_SOURCE.WALLET) {
    setTxStatus(`Error: ${error.message}`, 'err');
    dom.txResultWrap.classList.remove('hidden');
    dom.txResult.textContent = `${error.stack ?? error.message}`;
    return;
  }
  const code = classifyLedgerError(error);
  if (code !== LEDGER_ERROR.UNKNOWN) {
    setTxStatus(ledgerErrorMessage(code, error), 'err');
  } else {
    setTxStatus(`Error: ${error.message}`, 'err');
  }
  dom.txResultWrap.classList.remove('hidden');
  dom.txResult.textContent = `${error.stack ?? error.message}`;
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

export async function signAndSendLedger(tx, fromAddr, accountIndex, addressOffset) {
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
    era: MORTAL_ERA_PERIOD,
    withSignedTransaction: true,
    mode: SIGNING_MODE_METADATA_HASH,
    metadataHash: metadataDigest,
  };
  log(`signOptions: mode=${SIGNING_MODE_METADATA_HASH}, metadataHash=${metadataDigest}`);

  log('');
  log('═══ SIGNING ═══');
  setTxStatus('Confirm on Ledger device...', 'warn');
  const signedTx = await tx.signAsync(fromAddr, signOptions);
  return broadcastSignedTx(signedTx);
}

export async function signAndSendExtension(tx, address) {
  setTxStatus('Building transaction...', 'busy');
  log(`call hex: ${tx.method.toHex()}`);
  log(`call hash: ${tx.method.hash.toHex()}`);
  log('');
  log('═══ EXTENSION SIGNING ═══');
  setTxStatus('Confirm in browser extension...', 'warn');
  const injector = await web3FromAddress(address);
  if (!injector?.signer) {
    throw new Error('No extension signer for this address. Load extension accounts and approve access.');
  }
  const signedTx = await tx.signAsync(address, {
    signer: injector.signer,
    withSignedTransaction: true,
  });
  return broadcastSignedTx(signedTx);
}

export async function broadcastSignedTx(signedTx) {
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

  const TX_TIMEOUT_MS = 120_000;
  const result = await new Promise((resolve, reject) => {
    let done = false;
    let unsub = null;

    const cleanup = () => {
      clearTimeout(timer);
      if (typeof unsub === 'function') {
        try { unsub(); } catch {}
        unsub = null;
      }
    };

    const finish = (fn) => { if (done) return; done = true; cleanup(); fn(); };

    const timer = setTimeout(() => {
      finish(() => reject(new Error(`Transaction timed out after ${TX_TIMEOUT_MS / 1000}s without block inclusion`)));
    }, TX_TIMEOUT_MS);

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
      } else if (status.isFinalized) {
        const blockHash = status.asFinalized.toHex();
        log(`Finalized: ${blockHash}`);
        setTxStatus('Transaction finalized.', 'busy');
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

        const decodedEvents = submitResult.events;
        state.api.rpc.chain.getHeader(blockHash).then(header => {
          const blockNum = header.number.toNumber();
          log(`Block #${blockNum}`);
          finish(() => resolve({ txHash, blockHash, blockNumber: blockNum, events: decodedEvents }));
        }).catch(() => {
          finish(() => resolve({ txHash, blockHash, blockNumber: '?', events: decodedEvents }));
        });
      } else if (status.isDropped || status.isInvalid || status.isUsurped) {
        log(`Dropped/Invalid: ${status.type}`);
        finish(() => reject(new Error(`Transaction dropped: ${status.type}`)));
      } else if (status.isRetracted) {
        log(`Retracted: block retracted, tx may be re-included`);
        finish(() => reject(new Error('Transaction retracted: block was retracted by the network')));
      } else if (status.isFinalityTimeout) {
        log(`FinalityTimeout: finality could not be achieved`);
        finish(() => reject(new Error('Transaction finality timeout: the network could not finalize the block')));
      }
    }).then(u => {
      unsub = u;
      if (done) cleanup();
    }).catch(err => {
      log(`send() error: ${err.message}`);
      finish(() => reject(err));
    });
  });

  displayTxResult(result);
  return result;
}

function displayTxResult(result) {
  log('');
  log('═══ RESULT ═══');
  log(`txHash: ${result.txHash}`);
  log(`blockHash: ${result.blockHash}`);
  log(`blockNumber: ${result.blockNumber}`);

  setTxStatus(`Success! Included in block #${result.blockNumber}`, 'ok');
  dom.txResultWrap.classList.remove('hidden');
  const lines = [
    `Transaction Hash: ${result.txHash}`,
    `Block Hash:       ${result.blockHash}`,
    `Block Number:     ${result.blockNumber}`,
  ];
  if (result.events?.length) {
    lines.push('', 'Events:');
    for (const { event } of result.events) {
      lines.push(`  ${event.section}.${event.method}: ${JSON.stringify(event.data.toHuman())}`);
    }
  }
  dom.txResult.textContent = lines.join('\n');

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

  pushTimelineEvent('success', `TX Success: ${result.txHash.slice(0, 18)}… in block #${result.blockNumber}`, '', explorer);
  renderTimeline();
  matrixRain();
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
  dom.feeEstimateBtn.disabled = true;
  dom.feeEstimate.textContent = '';
  dom.feeEstimate.classList.add('hidden');
}

export function collectArgs() {
  return collectInputValues(dom.extrinsicArgs);
}

export function updateExtrinsicSendButton() {
  if (!isExtrinsicReady(state)) {
    dom.extrinsicSendBtn.disabled = true;
    dom.feeEstimateBtn.disabled = true;
    dom.dryRunBtn.disabled = true;
    dom.addToBatchBtn.disabled = true;
    return;
  }
  const inputs = [...dom.extrinsicArgs.querySelectorAll('[data-arg-name]')];
  const allFilled = inputs.length === 0 || inputs.every(i => i.value?.trim());
  dom.extrinsicSendBtn.disabled = !allFilled;
  dom.feeEstimateBtn.disabled = !allFilled;
  dom.dryRunBtn.disabled = !allFilled;
  dom.addToBatchBtn.disabled = !allFilled;
}

function onPalletChanged(pallet) {
  state.methodSelectValue = '';
  dom.extrinsicDocs.textContent = '';
  dom.extrinsicDocs.classList.add('hidden');
  dom.extrinsicArgs.innerHTML = '';
  dom.extrinsicSendBtn.disabled = true;
  dom.feeEstimate.classList.add('hidden');
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
  dom.feeEstimate.classList.add('hidden');
  if (!pallet || !method || !state.api?.tx[pallet]?.[method]) return;

  const fn = state.api.tx[pallet][method];
  const meta = fn.meta;

  const docsHtml = buildCallDocHtml(meta, state.api.registry);
  if (docsHtml) {
    dom.extrinsicDocs.innerHTML = docsHtml;
    dom.extrinsicDocs.classList.remove('hidden');
  }

  const args = meta.args;
  if (args.length === 0) {
    dom.extrinsicArgs.innerHTML = '<div class="text-muted text-sm">No arguments required</div>';
    updateExtrinsicSendButton();
    renderPreflight();
    return;
  }

  for (const arg of args) {
    const div = document.createElement('div');
    div.className = 'arg-field';

    const label = document.createElement('label');
    const tn = getArgTypeName(arg, state.api.registry);
    label.innerHTML = `${arg.name.toString()} <span class="arg-type">${tn}</span>`;
    div.appendChild(label);

    const input = createArgInput(arg, state.api.registry, () => {
      updateExtrinsicSendButton();
      renderPreflight();
    });
    div.appendChild(input);

    dom.extrinsicArgs.appendChild(div);
  }
  updateExtrinsicSendButton();
  renderPreflight();
}

function renderPreflight() {
  const checks = computePreflight(state, monitor);
  state.preflightChecks = checks;
  renderPreflightDOM(checks, dom.preflightChecklist);
}

/** Programmatic selection for command palette / deep links. */
export function selectExtrinsic(pallet, method) {
  if (!state.api?.tx[pallet]?.[method]) return;
  state.palletSelectValue = pallet;
  onPalletChanged(pallet);
  state.methodSelectValue = method;
  onMethodChanged(method);
  dom.palletSelectTrigger.querySelector('.custom-select-label').textContent = pallet;
  dom.methodSelectTrigger.querySelector('.custom-select-label').textContent = method;
  dom.palletSelectDropdown.querySelectorAll('.custom-select-option').forEach(o => {
    o.classList.toggle('selected', o.dataset.value === pallet);
  });
  dom.methodSelectDropdown.querySelectorAll('.custom-select-option').forEach(o => {
    o.classList.toggle('selected', o.dataset.value === method);
  });
}

async function dryRunExtrinsic() {
  const pallet = state.palletSelectValue;
  const method = state.methodSelectValue;
  if (!pallet || !method || !state.api) return;

  dom.dryRunBtn.disabled = true;
  setTxStatus('Dry running...', 'busy');
  try {
    const args = collectArgs();
    const tx = state.api.tx[pallet][method](...args);
    const result = await state.api.rpc.system.dryRun(tx.toHex());
    const str = result.toString();
    if (result.isOk) {
      const inner = result.asOk;
      if (inner.isOk) {
        setTxStatus('Dry run: Would succeed ✓', 'ok');
      } else {
        let errText = inner.asErr.toString();
        try {
          if (inner.asErr.isModule) {
            const decoded = state.api.registry.findMetaError(inner.asErr.asModule);
            errText = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
          }
        } catch {}
        setTxStatus(`Dry run: Would fail — ${errText}`, 'err');
      }
    } else {
      setTxStatus(`Dry run: Transaction invalid — ${str}`, 'err');
    }
    log(`Dry run result: ${str}`);
  } catch (err) {
    setTxStatus(`Dry run error: ${err.message}`, 'err');
    log(`Dry run error: ${err.message}`);
  } finally {
    dom.dryRunBtn.disabled = false;
  }
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

  dom.dryRunBtn.addEventListener('click', dryRunExtrinsic);

  dom.feeEstimateBtn.addEventListener('click', async () => {
    if (!state.api || !state.selectedAccount) return;
    const pallet = state.palletSelectValue;
    const method = state.methodSelectValue;
    if (!pallet || !method) return;
    dom.feeEstimateBtn.disabled = true;
    dom.feeEstimate.classList.remove('hidden');
    dom.feeEstimate.textContent = 'Estimating...';
    try {
      const args = collectArgs();
      const tx = state.api.tx[pallet][method](...args);
      const info = await tx.paymentInfo(state.selectedAccount.address);
      dom.feeEstimate.textContent = `Estimated fee: ${info.partialFee.toHuman()}`;
    } catch (err) {
      dom.feeEstimate.textContent = `Fee estimation failed: ${err.message}`;
    } finally {
      dom.feeEstimateBtn.disabled = false;
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

    if (state.selectedAccount?.accountSource === ACCOUNT_SOURCE.LEDGER) {
      if (!hasMetaHash) {
        log('FATAL: chain has no CheckMetadataHash');
        setTxStatus(MSG_LEDGER_NO_METADATA_HASH, 'err');
        dom.extrinsicSendBtn.disabled = false;
        return;
      }
      if (devChain) {
        log('WARNING: dev chain detected');
      }
    } else {
      log(`Wallet mode: CheckMetadataHash in runtime: ${hasMetaHash} (extension uses standard signing)`);
      if (devChain) log('WARNING: dev chain detected');
    }

    try {
      const args = collectArgs();
      log('');
      log(`═══ EXTRINSIC: ${pallet}.${method} ═══`);
      log(`from: ${fromAddr}`);
      log(`args: ${JSON.stringify(args)}`);

      const tx = state.api.tx[pallet][method](...args);
      if (state.selectedAccount?.accountSource === ACCOUNT_SOURCE.WALLET) {
        await signAndSendExtension(tx, fromAddr);
      } else {
        await signAndSendLedger(tx, fromAddr, accountIndex, addressOffset);
      }
      if (!walletHintShown && /multisig|proxy/i.test(`${pallet}.${method}`)) {
        walletHintShown = true;
        pushTimelineEvent('info', 'Tip: For multi-sig management, try Tao Wallet',
          null, { url: 'https://tao.app/wallet', label: 'Get Tao Wallet' });
        renderTimeline();
      }
    } catch (err) {
      handleTxError(err);
    } finally {
      dom.extrinsicSendBtn.disabled = false;
    }
  });
}

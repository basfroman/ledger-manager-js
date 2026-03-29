import { MAX_BATCH_CALLS, ACCOUNT_SOURCE, MSG_LEDGER_NO_METADATA_HASH } from './constants.js';
import { chainSupportsMetadataHash } from './chain-utils.js';
import { state } from './state.js';
import { dom, log, renderTimeline, setTxStatus } from './ui.js';
import { collectArgs, signAndSendLedger, signAndSendExtension, handleTxError } from './tx.js';
import { pushTimelineEvent } from './timeline.js';

let nextBatchId = 1;

export function addToBatch(pallet, method, args) {
  if (state.batchQueue.length >= MAX_BATCH_CALLS) return false;
  state.batchQueue.push({
    id: nextBatchId++,
    pallet,
    method,
    args,
  });
  renderBatchQueue();
  return true;
}

export function removeFromBatch(id) {
  const idx = state.batchQueue.findIndex(item => item.id === id);
  if (idx !== -1) {
    state.batchQueue.splice(idx, 1);
    renderBatchQueue();
  }
}

export function clearBatch() {
  state.batchQueue = [];
  renderBatchQueue();
}

export function renderBatchQueue() {
  if (!dom.batchList) return;

  if (state.batchQueue.length === 0) {
    dom.batchList.classList.add('hidden');
    dom.batchList.innerHTML = '';
    return;
  }

  dom.batchList.classList.remove('hidden');
  dom.batchList.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'batch-list-header';
  const title = document.createElement('h3');
  title.textContent = `Batch Queue (${state.batchQueue.length})`;
  const btns = document.createElement('div');
  btns.className = 'batch-list-actions';

  const modes = ['batch', 'batchAll', 'forceBatch'];
  for (const mode of modes) {
    const btn = document.createElement('button');
    btn.className = 'btn-primary btn-sm';
    btn.textContent = mode === 'batch' ? 'Send Batch' : mode === 'batchAll' ? 'Batch All' : 'Force';
    btn.addEventListener('click', () => executeBatch(mode));
    btns.appendChild(btn);
  }

  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn-danger btn-sm';
  clearBtn.textContent = 'Clear';
  clearBtn.addEventListener('click', clearBatch);
  btns.appendChild(clearBtn);

  header.append(title, btns);
  dom.batchList.appendChild(header);

  for (const item of state.batchQueue) {
    const row = document.createElement('div');
    row.className = 'batch-item';
    const methodSpan = document.createElement('span');
    methodSpan.className = 'batch-item-method';
    methodSpan.textContent = `${item.pallet}.${item.method}`;
    const removeBtn = document.createElement('button');
    removeBtn.className = 'batch-item-remove';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => removeFromBatch(item.id));
    row.append(methodSpan, removeBtn);
    dom.batchList.appendChild(row);
  }
}

export async function executeBatch(mode = 'batch') {
  if (!state.api || !state.selectedAccount || state.batchQueue.length === 0) return;

  const { address: fromAddr, accountIndex, addressOffset } = state.selectedAccount;

  try {
    const calls = state.batchQueue.map(item =>
      state.api.tx[item.pallet][item.method](...item.args)
    );

    const tx = state.api.tx.utility[mode](calls);
    log(`Batch ${mode}: ${calls.length} calls`);

    if (state.accountSource === ACCOUNT_SOURCE.WALLET) {
      await signAndSendExtension(tx, fromAddr);
    } else {
      if (!chainSupportsMetadataHash(state.api)) {
        setTxStatus(MSG_LEDGER_NO_METADATA_HASH, 'err');
        return;
      }
      await signAndSendLedger(tx, fromAddr, accountIndex, addressOffset);
    }

    clearBatch();
  } catch (err) {
    handleTxError(err);
  }
}

export function initBatch() {
  dom.addToBatchBtn.addEventListener('click', () => {
    const pallet = state.palletSelectValue;
    const method = state.methodSelectValue;
    if (!pallet || !method) return;
    const args = collectArgs();
    addToBatch(pallet, method, args);
    pushTimelineEvent('info', `Added ${pallet}.${method} to batch`);
    renderTimeline();
  });
}

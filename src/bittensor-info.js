import { FINNEY_GENESIS_HASH, truncAddr } from './chain-utils.js';
import { getContactName } from './address-book.js';
import { appendKvRow } from './event-card.js';
import { state } from './state.js';
import { dom, setDataHubTab } from './ui.js';

function isBittensorChain() {
  if (!state.api) return false;
  try {
    return state.api.genesisHash.toHex() === FINNEY_GENESIS_HASH ||
           Boolean(state.api.query.subtensorModule);
  } catch {
    return false;
  }
}

export function initBittensorInfo() {
  dom.neuronFetchBtn.addEventListener('click', fetchNeuron);
  dom.regFetchBtn.addEventListener('click', fetchRegistration);
}

export async function populateBittensorInfo() {
  if (!isBittensorChain()) return;
  dom.bittensorTabBtn.classList.remove('hidden');
  dom.neuronFetchBtn.disabled = false;
  dom.regFetchBtn.disabled = false;

  try {
    const totalNetworks = await state.api.query.subtensorModule?.totalNetworks?.();
    if (totalNetworks == null) {
      dom.bittensorSubnets.textContent = 'subtensorModule storage not available on this chain';
      return;
    }
    const count = totalNetworks.toNumber ? totalNetworks.toNumber() : Number(totalNetworks);
    dom.bittensorSubnets.innerHTML = '';
    appendKvRow(dom.bittensorSubnets, 'Total Subnets', count);

    const MAX_DISPLAY = 32;
    const limit = Math.min(count, MAX_DISPLAY);
    for (let netuid = 0; netuid < limit; netuid++) {
      const [owner, tempo, maxUids] = await Promise.all([
        state.api.query.subtensorModule.subnetOwner?.(netuid).catch(() => null),
        state.api.query.subtensorModule.tempo?.(netuid).catch(() => null),
        state.api.query.subtensorModule.maxAllowedUids?.(netuid).catch(() => null),
      ]);
      const ownerAddr = owner?.toString?.() ?? '—';
      const contactName = getContactName(ownerAddr);
      const ownerLabel = contactName ? `${contactName} (${truncAddr(ownerAddr)})` : truncAddr(ownerAddr);
      const tempoVal = tempo?.toNumber?.() ?? '—';
      const maxVal = maxUids?.toNumber?.() ?? '—';
      appendKvRow(dom.bittensorSubnets, `SN ${netuid} owner`, ownerLabel);
      appendKvRow(dom.bittensorSubnets, `SN ${netuid} tempo`, tempoVal);
      appendKvRow(dom.bittensorSubnets, `SN ${netuid} max UIDs`, maxVal);
    }
    if (count > MAX_DISPLAY) {
      appendKvRow(dom.bittensorSubnets, '...', `${count - MAX_DISPLAY} more subnets`);
    }
  } catch (err) {
    dom.bittensorSubnets.textContent = `Error: ${err.message}`;
  }
}

async function fetchNeuron() {
  const netuid = Number(dom.neuronNetuid.value);
  const uid = Number(dom.neuronUid.value);
  if (isNaN(netuid) || isNaN(uid)) {
    dom.neuronResult.textContent = 'Enter valid NetUID and UID';
    dom.neuronResult.className = 'status-box status-err mt-8';
    return;
  }
  dom.neuronResult.innerHTML = '';
  dom.neuronFetchBtn.disabled = true;
  try {
    const neuron = await state.api.query.subtensorModule.neurons?.(netuid, uid);
    if (!neuron || neuron.isNone) {
      dom.neuronResult.textContent = `No neuron found at SN ${netuid}, UID ${uid}`;
      dom.neuronResult.className = 'status-box status-warn mt-8';
      return;
    }
    const data = neuron.toHuman ? neuron.toHuman() : neuron.toJSON?.() ?? neuron;
    dom.neuronResult.className = 'mt-8';
    if (typeof data === 'object' && data !== null) {
      for (const [key, val] of Object.entries(data)) {
        appendKvRow(dom.neuronResult, key, typeof val === 'object' ? JSON.stringify(val) : String(val));
      }
    } else {
      appendKvRow(dom.neuronResult, 'Value', JSON.stringify(data));
    }
  } catch (err) {
    dom.neuronResult.textContent = `Error: ${err.message}`;
    dom.neuronResult.className = 'status-box status-err mt-8';
  } finally {
    dom.neuronFetchBtn.disabled = false;
  }
}

async function fetchRegistration() {
  const netuid = Number(dom.regNetuid.value);
  if (isNaN(netuid)) {
    dom.regResult.textContent = 'Enter valid NetUID';
    dom.regResult.className = 'status-box status-err mt-8';
    return;
  }
  dom.regResult.innerHTML = '';
  dom.regFetchBtn.disabled = true;
  try {
    const [difficulty, burn, maxUids, currentUids] = await Promise.all([
      state.api.query.subtensorModule.difficulty?.(netuid).catch(() => null),
      state.api.query.subtensorModule.burn?.(netuid).catch(() => null),
      state.api.query.subtensorModule.maxAllowedUids?.(netuid).catch(() => null),
      state.api.query.subtensorModule.subnetworkN?.(netuid).catch(() => null),
    ]);
    dom.regResult.className = 'mt-8';
    appendKvRow(dom.regResult, 'NetUID', netuid);
    appendKvRow(dom.regResult, 'Difficulty', difficulty?.toNumber?.() ?? difficulty?.toString?.() ?? '—');
    appendKvRow(dom.regResult, 'Burn', burn?.toString?.() ?? '—');
    appendKvRow(dom.regResult, 'Max UIDs', maxUids?.toNumber?.() ?? '—');
    appendKvRow(dom.regResult, 'Current UIDs', currentUids?.toNumber?.() ?? '—');
    const slots = (maxUids?.toNumber?.() ?? 0) - (currentUids?.toNumber?.() ?? 0);
    if (slots > 0) {
      appendKvRow(dom.regResult, 'Open Slots', slots);
    } else {
      appendKvRow(dom.regResult, 'Open Slots', '0 (full)');
    }
  } catch (err) {
    dom.regResult.textContent = `Error: ${err.message}`;
    dom.regResult.className = 'status-box status-err mt-8';
  } finally {
    dom.regFetchBtn.disabled = false;
  }
}

export function resetBittensorInfo() {
  dom.bittensorTabBtn.classList.add('hidden');
  dom.bittensorSubnets.innerHTML = '';
  dom.neuronResult.innerHTML = '';
  dom.regResult.innerHTML = '';
  dom.neuronFetchBtn.disabled = true;
  dom.regFetchBtn.disabled = true;
  if (!dom.bittensorPane.classList.contains('hidden')) {
    setDataHubTab('queryPane');
  }
}

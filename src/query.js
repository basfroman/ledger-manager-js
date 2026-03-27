import { createArgInput, collectInputValues } from './arg-input.js';
import { getArgTypeName, formatDocs } from './chain-utils.js';
import { state } from './state.js';
import { dom, setupCustomDropdown, populateCustomDropdown, log } from './ui.js';

function onQueryPalletChanged(pallet) {
  state.qStorageSelectValue = '';
  dom.queryDocs.textContent = '';
  dom.queryDocs.classList.add('hidden');
  dom.queryKeys.innerHTML = '';
  dom.queryResultWrap.classList.add('hidden');
  dom.queryResult.textContent = '';
  dom.queryExecuteBtn.disabled = true;

  if (!pallet || !state.api?.query[pallet]) {
    populateCustomDropdown(dom.qStorageSelectTrigger, dom.qStorageSelectDropdown, [], '-- select storage --');
    dom.qStorageSelectTrigger.disabled = true;
    return;
  }

  const items = Object.keys(state.api.query[pallet]).sort().filter(
    k => typeof state.api.query[pallet][k] === 'function',
  );
  populateCustomDropdown(dom.qStorageSelectTrigger, dom.qStorageSelectDropdown, items, '-- select storage --');
  dom.qStorageSelectTrigger.disabled = false;
}

function updateQueryButton() {
  if (!state.api || !state.qPalletSelectValue || !state.qStorageSelectValue) {
    dom.queryExecuteBtn.disabled = true;
    return;
  }
  const inputs = [...dom.queryKeys.querySelectorAll('[data-arg-name]')];
  const allFilled = inputs.length === 0 || inputs.every(i => i.value?.trim());
  dom.queryExecuteBtn.disabled = !allFilled;
}

function onStorageItemChanged(item) {
  const pallet = state.qPalletSelectValue;
  dom.queryDocs.textContent = '';
  dom.queryDocs.classList.add('hidden');
  dom.queryKeys.innerHTML = '';
  dom.queryResultWrap.classList.add('hidden');
  dom.queryResult.textContent = '';
  dom.queryExecuteBtn.disabled = true;

  if (!pallet || !item || !state.api?.query[pallet]?.[item]) return;

  const entry = state.api.query[pallet][item];
  const meta = entry.meta;
  const registry = state.api.registry;

  const docsHtml = formatDocs(meta.docs.map(d => d.toString()));
  if (docsHtml) {
    dom.queryDocs.innerHTML = docsHtml;
    dom.queryDocs.classList.remove('hidden');
  }

  const storageType = meta.type;

  if (storageType.isPlain) {
    dom.queryKeys.innerHTML = '<div class="text-muted text-sm">No keys required (plain storage)</div>';
    updateQueryButton();
    return;
  }

  if (storageType.isMap) {
    const mapType = storageType.asMap;
    const hashersCount = mapType.hashers.length;

    if (hashersCount === 1) {
      const keyDef = registry.lookup.getTypeDef(mapType.key);
      const syntheticArg = { name: 'key', typeName: keyDef.type, type: mapType.key };

      const div = document.createElement('div');
      div.className = 'arg-field';
      const label = document.createElement('label');
      label.innerHTML = `key <span class="arg-type">${keyDef.type}</span>`;
      div.appendChild(label);
      div.appendChild(createArgInput(syntheticArg, registry, updateQueryButton));
      dom.queryKeys.appendChild(div);
    } else {
      const tupleDef = registry.lookup.getTypeDef(mapType.key);
      const subTypes = tupleDef.sub;
      for (let i = 0; i < hashersCount; i++) {
        const sub = subTypes[i];
        const syntheticArg = { name: `key${i}`, typeName: sub.type, type: sub.lookupIndex ?? mapType.key };

        const div = document.createElement('div');
        div.className = 'arg-field';
        const label = document.createElement('label');
        label.innerHTML = `key${i} <span class="arg-type">${sub.type}</span>`;
        div.appendChild(label);
        div.appendChild(createArgInput(syntheticArg, registry, updateQueryButton));
        dom.queryKeys.appendChild(div);
      }
    }
    updateQueryButton();
    return;
  }

  dom.queryKeys.innerHTML = '<div class="text-muted text-sm">Unsupported storage type</div>';
}

async function executeQuery() {
  const pallet = state.qPalletSelectValue;
  const item = state.qStorageSelectValue;
  if (!pallet || !item || !state.api?.query[pallet]?.[item]) return;

  dom.queryExecuteBtn.disabled = true;
  dom.queryResult.className = 'result-block query-result-block';
  dom.queryResultWrap.classList.remove('hidden');
  dom.queryResult.textContent = 'Querying...';

  try {
    const keys = collectInputValues(dom.queryKeys);
    const result = await state.api.query[pallet][item](...keys);
    dom.queryResult.textContent = JSON.stringify(result.toHuman(), null, 2);
    log(`Query ${pallet}.${item} OK`);
  } catch (err) {
    dom.queryResult.textContent = `Error: ${err.message}`;
    dom.queryResult.classList.add('status-err');
    log(`Query ${pallet}.${item} FAILED: ${err.message}`);
  } finally {
    dom.queryExecuteBtn.disabled = false;
  }
}

export function populateQueryPallets(api) {
  const pallets = Object.keys(api.query).sort();
  populateCustomDropdown(dom.qPalletSelectTrigger, dom.qPalletSelectDropdown, pallets, '-- select pallet --');
  dom.qPalletSelectTrigger.disabled = false;
}

export function resetQueryBuilder() {
  state.qPalletSelectValue = '';
  state.qStorageSelectValue = '';
  populateCustomDropdown(dom.qPalletSelectTrigger, dom.qPalletSelectDropdown, [], 'Connect to load pallets...');
  dom.qPalletSelectTrigger.disabled = true;
  populateCustomDropdown(dom.qStorageSelectTrigger, dom.qStorageSelectDropdown, [], 'Select a pallet first');
  dom.qStorageSelectTrigger.disabled = true;
  dom.queryKeys.innerHTML = '';
  dom.queryDocs.textContent = '';
  dom.queryDocs.classList.add('hidden');
  dom.queryResultWrap.classList.add('hidden');
  dom.queryResult.textContent = '';
  dom.queryExecuteBtn.disabled = true;
}

export function initQuery() {
  setupCustomDropdown(dom.qPalletSelectTrigger, dom.qPalletSelectDropdown, 'qPalletSelectWrap', (value) => {
    state.qPalletSelectValue = value;
    onQueryPalletChanged(value);
  });

  setupCustomDropdown(dom.qStorageSelectTrigger, dom.qStorageSelectDropdown, 'qStorageSelectWrap', (value) => {
    state.qStorageSelectValue = value;
    onStorageItemChanged(value);
  });

  dom.queryExecuteBtn.addEventListener('click', executeQuery);
}

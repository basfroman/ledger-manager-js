import { createArgInput, collectInputValues } from './arg-input.js';
import { escapeHtml, formatDocs, highlightJson } from './chain-utils.js';
import { state } from './state.js';
import { dom, setupCustomDropdown, populateCustomDropdown, log, renderTimeline } from './ui.js';
import { pushTimelineEvent } from './timeline.js';

function buildStorageDocHtml(meta, registry) {
  let html = '';

  const docsHtml = formatDocs(meta.docs.map(d => d.toString()));
  if (docsHtml) html += docsHtml;

  const parts = [];

  if (meta.modifier) {
    const mod = meta.modifier.toString();
    parts.push(`<span class="doc-arg-name">Modifier</span> <span class="doc-arg-type">${mod}</span>`);
  }

  const storageType = meta.type;
  if (storageType.isPlain) {
    try {
      const valDef = registry.lookup.getTypeDef(storageType.asPlain);
      parts.push(`<span class="doc-arg-name">Returns</span> <span class="doc-arg-type">${escapeHtml(valDef.type)}</span>`);
    } catch {}
  } else if (storageType.isMap) {
    const mapType = storageType.asMap;
    try {
      const valDef = registry.lookup.getTypeDef(mapType.value);
      parts.push(`<span class="doc-arg-name">Returns</span> <span class="doc-arg-type">${escapeHtml(valDef.type)}</span>`);
    } catch {}
    try {
      const keyDef = registry.lookup.getTypeDef(mapType.key);
      const hashers = mapType.hashers.map(h => h.toString()).join(', ');
      parts.push(`<span class="doc-arg-name">Key</span> <span class="doc-arg-type">${escapeHtml(keyDef.type)}</span> <span class="doc-arg-desc">— ${escapeHtml(hashers)}</span>`);
    } catch {}
  }

  if (parts.length) {
    html += '<div class="doc-section"><div class="doc-section-title">Storage info</div>';
    html += '<ul class="doc-list">';
    for (const p of parts) html += `<li>${p}</li>`;
    html += '</ul></div>';
  }

  return html;
}

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
    k => typeof state.api.query[pallet][k] === 'function' && state.api.query[pallet][k].meta,
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

  const docsHtml = buildStorageDocHtml(meta, registry);
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
      label.innerHTML = `key <span class="arg-type">${escapeHtml(keyDef.type)}</span>`;
      div.appendChild(label);
      div.appendChild(createArgInput(syntheticArg, registry, updateQueryButton));
      dom.queryKeys.appendChild(div);
    } else {
      const tupleDef = registry.lookup.getTypeDef(mapType.key);
      const subTypes = Array.isArray(tupleDef.sub) ? tupleDef.sub : [];
      if (subTypes.length < hashersCount) {
        dom.queryKeys.innerHTML = '<div class="text-muted text-sm">Unsupported storage key layout</div>';
        updateQueryButton();
        return;
      }
      for (let i = 0; i < hashersCount; i++) {
        const sub = subTypes[i];
        const syntheticArg = { name: `key${i}`, typeName: sub.type, type: sub.lookupIndex ?? mapType.key };

        const div = document.createElement('div');
        div.className = 'arg-field';
        const label = document.createElement('label');
        label.innerHTML = `key${i} <span class="arg-type">${escapeHtml(sub.type)}</span>`;
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
    const json = JSON.stringify(result.toHuman(), null, 2);
    dom.queryResult.innerHTML = highlightJson(json);
    log(`Query ${pallet}.${item} OK`);
    addPinButton(dom.queryResultWrap, `Query: ${pallet}.${item}`, json);
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

/** Programmatic selection for command palette. */
export function selectQuery(pallet, item) {
  if (!state.api?.query[pallet]?.[item]) return;
  state.qPalletSelectValue = pallet;
  onQueryPalletChanged(pallet);
  state.qStorageSelectValue = item;
  onStorageItemChanged(item);
  dom.qPalletSelectTrigger.querySelector('.custom-select-label').textContent = pallet;
  dom.qStorageSelectTrigger.querySelector('.custom-select-label').textContent = item;
  dom.qPalletSelectDropdown.querySelectorAll('.custom-select-option').forEach(o => {
    o.classList.toggle('selected', o.dataset.value === pallet);
  });
  dom.qStorageSelectDropdown.querySelectorAll('.custom-select-option').forEach(o => {
    o.classList.toggle('selected', o.dataset.value === item);
  });
}

function addPinButton(container, title, detail) {
  const existing = container.querySelector('.btn-pin-timeline');
  if (existing) existing.remove();
  const btn = document.createElement('button');
  btn.className = 'btn-secondary btn-sm btn-pin-timeline mt-8';
  btn.textContent = '📌 Pin to Timeline';
  btn.addEventListener('click', () => {
    pushTimelineEvent('pin', title, detail);
    renderTimeline();
    btn.textContent = '✓ Pinned';
    btn.disabled = true;
  });
  container.appendChild(btn);
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

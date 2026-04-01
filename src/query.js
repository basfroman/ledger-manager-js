import { createArgInput, collectInputValues } from './arg-input.js';
import { escapeHtml, formatDocs, highlightJson } from './chain-utils.js';
import { MAX_WATCHES } from './constants.js';
import { state } from './state.js';
import { dom, setupCustomDropdown, populateCustomDropdown, log, renderTimeline, addResultAction } from './ui.js';
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
    const atBlock = dom.queryAtBlock?.value?.trim();
    const compare = dom.queryCompare?.checked && atBlock;

    let result;
    if (atBlock) {
      let blockHash;
      if (atBlock.startsWith('0x')) {
        blockHash = atBlock;
      } else {
        blockHash = await state.api.rpc.chain.getBlockHash(Number(atBlock));
        blockHash = blockHash.toHex();
      }
      result = await state.api.query[pallet][item].at(blockHash, ...keys);
    } else {
      result = await state.api.query[pallet][item](...keys);
    }

    const json = JSON.stringify(result.toHuman(), null, 2);

    if (compare) {
      const current = await state.api.query[pallet][item](...keys);
      const currentJson = JSON.stringify(current.toHuman(), null, 2);
      dom.queryResult.innerHTML = '';
      dom.queryResult.className = 'query-compare-result';

      const histBlock = document.createElement('div');
      histBlock.innerHTML = `<label>At block ${escapeHtml(atBlock)}</label><pre class="result-block query-result-block">${highlightJson(json)}</pre>`;
      const curBlock = document.createElement('div');
      curBlock.innerHTML = `<label>Current</label><pre class="result-block query-result-block">${highlightJson(currentJson)}</pre>`;
      dom.queryResult.append(histBlock, curBlock);
      dom.queryResultWrap.classList.remove('hidden');
    } else {
      dom.queryResult.innerHTML = highlightJson(json);
    }

    log(`Query ${pallet}.${item} OK${atBlock ? ` @${atBlock}` : ''}`);
    addWatchButton(dom.queryResultWrap, pallet, item, keys);
    addMapBrowseButton(pallet, item);
  } catch (err) {
    dom.queryResult.textContent = `Error: ${err.message}`;
    dom.queryResult.classList.add('status-err');
    log(`Query ${pallet}.${item} FAILED: ${err.message}`);
  } finally {
    dom.queryExecuteBtn.disabled = false;
  }
}

function addWatchButton(container, pallet, item, keys) {
  const existing = container.querySelector('.btn-watch');
  if (existing) existing.remove();

  if (state.watches.length >= MAX_WATCHES) return;
  if (state.watches.some(w => w.pallet === pallet && w.item === item)) return;

  addResultAction(container, '👁 Watch', 'btn-watch', () => {
    startWatch(pallet, item, keys);
  });
}

let nextWatchId = 1;

export function startWatch(pallet, item, keys) {
  if (!state.api || state.watches.length >= MAX_WATCHES) return;
  if (state.watches.some(w => w.pallet === pallet && w.item === item)) return;

  const id = nextWatchId++;
  const watchEntry = { id, pallet, item, keys, unsub: null, lastValue: null, el: null };

  state.api.query[pallet][item](...keys, (newValue) => {
    const json = JSON.stringify(newValue.toHuman(), null, 2);
    const changed = watchEntry.lastValue !== null && watchEntry.lastValue !== json;
    watchEntry.lastValue = json;

    if (watchEntry.el) {
      const valueEl = watchEntry.el.querySelector('.watch-card-value');
      if (valueEl) {
        valueEl.textContent = json;
        if (changed) {
          valueEl.classList.remove('watch-flash-green', 'watch-flash-red');
          void valueEl.offsetWidth;
          valueEl.classList.add('watch-flash-green');
        }
      }
    }

    if (changed) {
      pushTimelineEvent('info', `Watch: ${pallet}.${item} updated`);
      renderTimeline();
    }
  }).then(unsub => {
    watchEntry.unsub = unsub;
  }).catch(err => {
    log(`Watch error: ${err.message}`);
  });

  state.watches.push(watchEntry);
  renderWatchPanel();
}

export function stopWatch(id) {
  const idx = state.watches.findIndex(w => w.id === id);
  if (idx !== -1) {
    const w = state.watches[idx];
    if (w.unsub) w.unsub();
    state.watches.splice(idx, 1);
    renderWatchPanel();
  }
}

export function stopAllWatches() {
  for (const w of state.watches) {
    if (w.unsub) w.unsub();
  }
  state.watches = [];
  renderWatchPanel();
}

function renderWatchPanel() {
  if (!dom.watchPanel) return;
  dom.watchPanel.innerHTML = '';

  for (const w of state.watches) {
    const card = document.createElement('div');
    card.className = 'watch-card';
    w.el = card;

    const header = document.createElement('div');
    header.className = 'watch-card-header';
    const title = document.createElement('span');
    title.className = 'watch-card-title';
    title.textContent = `${w.pallet}.${w.item}`;
    const stopBtn = document.createElement('button');
    stopBtn.className = 'btn-danger btn-sm';
    stopBtn.textContent = '✕';
    stopBtn.addEventListener('click', () => stopWatch(w.id));
    header.append(title, stopBtn);

    const value = document.createElement('div');
    value.className = 'watch-card-value';
    value.textContent = w.lastValue ?? 'Waiting...';

    card.append(header, value);
    dom.watchPanel.appendChild(card);
  }
}

function addMapBrowseButton(pallet, item) {
  if (!dom.mapBrowserWrap) return;
  dom.mapBrowserWrap.innerHTML = '';
  dom.mapBrowserWrap.classList.add('hidden');

  if (!state.api?.query[pallet]?.[item]) return;
  const meta = state.api.query[pallet][item].meta;
  if (!meta.type.isMap) return;

  dom.mapBrowserWrap.classList.remove('hidden');
  const browseBtn = document.createElement('button');
  browseBtn.className = 'btn-secondary btn-sm mt-8';
  browseBtn.textContent = '📋 Browse All Keys';
  browseBtn.addEventListener('click', () => browseStorageMap(pallet, item));
  dom.mapBrowserWrap.appendChild(browseBtn);
}

async function browseStorageMap(pallet, item, startKey = null) {
  if (!state.api) return;
  dom.mapBrowserWrap.innerHTML = '<div class="text-muted">Loading keys...</div>';

  try {
    const prefix = state.api.query[pallet][item].keyPrefix();
    const pageSize = 100;
    const keys = await state.api.rpc.state.getKeysPaged(prefix, pageSize, startKey || prefix);

    if (keys.length === 0) {
      dom.mapBrowserWrap.innerHTML = '<div class="text-muted text-sm">No keys found</div>';
      return;
    }

    const values = await state.api.rpc.state.queryStorageAt(keys);

    dom.mapBrowserWrap.innerHTML = '';
    const table = document.createElement('table');
    table.className = 'map-browser-table';
    table.innerHTML = '<thead><tr><th>#</th><th>Key (truncated)</th><th>Value</th></tr></thead>';
    const tbody = document.createElement('tbody');

    const changes = values[0]?.changes ?? [];
    for (let i = 0; i < changes.length; i++) {
      const [k, v] = changes[i];
      const tr = document.createElement('tr');
      const keyStr = k.toHex();
      let valStr = '(null)';
      if (v && v.isSome !== undefined) {
        valStr = v.isSome ? v.unwrap().toHuman?.() ?? v.unwrap().toString() : '(none)';
      } else if (v) {
        valStr = v.toHuman?.() ?? v.toString();
      }
      if (typeof valStr === 'object') valStr = JSON.stringify(valStr);
      tr.innerHTML = `<td>${i + 1}</td><td title="${escapeHtml(keyStr)}">${keyStr.slice(0, 24)}…</td><td>${escapeHtml(String(valStr).slice(0, 60))}</td>`;
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    dom.mapBrowserWrap.appendChild(table);

    if (keys.length === pageSize) {
      const nav = document.createElement('div');
      nav.className = 'map-browser-nav';
      const nextBtn = document.createElement('button');
      nextBtn.className = 'btn-secondary btn-sm';
      nextBtn.textContent = 'Next Page →';
      nextBtn.addEventListener('click', () => browseStorageMap(pallet, item, keys[keys.length - 1].toHex()));
      nav.appendChild(nextBtn);
      dom.mapBrowserWrap.appendChild(nav);
    }

    log(`Map browser: ${pallet}.${item} — ${changes.length} entries`);
  } catch (err) {
    dom.mapBrowserWrap.innerHTML = `<div class="status-box status-err">${escapeHtml(err.message)}</div>`;
    log(`Map browser error: ${err.message}`);
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

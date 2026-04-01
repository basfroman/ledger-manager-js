import { state } from './state.js';
import { dom } from './ui.js';
import { escapeHtml } from './chain-utils.js';
import { parseFilterTerms } from './block-explorer.js';

const ICON_CHEVRON = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';

const valueCache = new Map();

export function buildMetadataTree(api) {
  if (!api) return [];
  const pallets = api.runtimeMetadata.asLatest.pallets;
  const registry = api.registry;

  return pallets.map(pallet => {
    const name = pallet.name.toString();
    const entry = { name, storage: [], calls: [], events: [], constants: [], errors: [] };

    try {
      if (pallet.storage.isSome) {
        const items = pallet.storage.unwrap().items;
        entry.storage = items.map(i => ({
          name: i.name.toString(),
          docs: i.docs.map(d => d.toString()),
          modifier: i.modifier.toString(),
          isPlain: i.type.isPlain,
        }));
      }
    } catch {}

    try {
      if (pallet.calls.isSome) {
        const callTypeId = pallet.calls.unwrap().type;
        const typeDef = registry.lookup.getTypeDef(callTypeId);
        if (typeDef.sub && Array.isArray(typeDef.sub)) {
          entry.calls = typeDef.sub.map(v => ({
            name: v.name,
            docs: [],
          }));
        }
      }
    } catch {}

    try {
      if (pallet.events.isSome) {
        const eventTypeId = pallet.events.unwrap().type;
        const typeDef = registry.lookup.getTypeDef(eventTypeId);
        if (typeDef.sub && Array.isArray(typeDef.sub)) {
          entry.events = typeDef.sub.map(v => ({
            name: v.name,
            docs: [],
          }));
        }
      }
    } catch {}

    try {
      entry.constants = pallet.constants.map(c => ({
        name: c.name.toString(),
        docs: c.docs.map(d => d.toString()),
        type: (() => { try { return registry.lookup.getTypeDef(c.type).type; } catch { return '?'; } })(),
      }));
    } catch {}

    try {
      if (pallet.errors.isSome) {
        const errTypeId = pallet.errors.unwrap().type;
        const typeDef = registry.lookup.getTypeDef(errTypeId);
        if (typeDef.sub && Array.isArray(typeDef.sub)) {
          entry.errors = typeDef.sub.map(v => ({
            name: v.name,
            docs: [],
          }));
        }
      }
    } catch {}

    return entry;
  }).filter(p => p.storage.length || p.calls.length || p.events.length || p.constants.length || p.errors.length);
}

function formatValue(val) {
  if (val === undefined || val === null) return 'null';
  try {
    if (typeof val.toHuman === 'function') return JSON.stringify(val.toHuman(), null, 2);
    if (typeof val.toString === 'function' && val.constructor !== Object) return val.toString();
    return JSON.stringify(val, null, 2);
  } catch { return String(val); }
}

async function fetchInlineValue(palletName, category, item, itemDiv) {
  const cacheKey = `${palletName}.${category}.${item.name}`;
  let existing = itemDiv.querySelector('.metadata-value');

  if (existing) {
    existing.classList.toggle('hidden');
    return;
  }

  if (category === 'Calls' || category === 'Events' || category === 'Errors') return;

  const valEl = document.createElement('pre');
  valEl.className = 'metadata-value';

  if (category === 'Storage') {
    if (!item.isPlain) {
      valEl.textContent = 'Requires key input';
      valEl.classList.add('text-muted');
      itemDiv.appendChild(valEl);
      return;
    }

    if (valueCache.has(cacheKey)) {
      valEl.textContent = valueCache.get(cacheKey);
      itemDiv.appendChild(valEl);
      return;
    }

    valEl.textContent = 'Loading...';
    valEl.classList.add('text-muted');
    itemDiv.appendChild(valEl);

    try {
      const camelPallet = palletName.charAt(0).toLowerCase() + palletName.slice(1);
      const camelItem = item.name.charAt(0).toLowerCase() + item.name.slice(1);
      const result = await state.api.query[camelPallet]?.[camelItem]();
      const text = formatValue(result);
      valueCache.set(cacheKey, text);
      valEl.textContent = text;
      valEl.classList.remove('text-muted');
    } catch (err) {
      valEl.textContent = `Error: ${err.message}`;
      valEl.classList.remove('text-muted');
    }
  } else if (category === 'Constants') {
    if (valueCache.has(cacheKey)) {
      valEl.textContent = valueCache.get(cacheKey);
      itemDiv.appendChild(valEl);
      return;
    }
    try {
      const camelPallet = palletName.charAt(0).toLowerCase() + palletName.slice(1);
      const camelItem = item.name.charAt(0).toLowerCase() + item.name.slice(1);
      const result = state.api.consts[camelPallet]?.[camelItem];
      const text = formatValue(result);
      valueCache.set(cacheKey, text);
      valEl.textContent = text;
    } catch (err) {
      valEl.textContent = `Error: ${err.message}`;
    }
    itemDiv.appendChild(valEl);
  }
}

function filterMetadataTree(terms, root) {
  for (const palletDiv of root.querySelectorAll('.metadata-pallet')) {
    const palletName = palletDiv.querySelector('.metadata-pallet-header span:last-child')?.textContent || '';
    let palletHasMatch = false;

    for (const catDiv of palletDiv.querySelectorAll('.metadata-category')) {
      const catBody = catDiv.querySelector('.metadata-category-header + div');
      if (!catBody) continue;
      let catHasMatch = false;

      for (const itemDiv of catBody.querySelectorAll('.metadata-item')) {
        const itemName = itemDiv.dataset.itemName || '';
        const searchText = `${palletName} ${itemName}`;
        const match = terms.length === 0 || terms.some(re => re.test(searchText));
        itemDiv.classList.toggle('hidden', !match);
        if (match) catHasMatch = true;
      }

      catDiv.classList.toggle('hidden', !catHasMatch);
      if (catHasMatch && terms.length > 0) {
        const catBody2 = catDiv.querySelector('.metadata-category-header + div');
        if (catBody2) catBody2.style.display = '';
        const chevron = catDiv.querySelector('.metadata-category-header svg');
        if (chevron) chevron.style.transform = 'rotate(90deg)';
      }
      if (catHasMatch) palletHasMatch = true;
    }

    palletDiv.classList.toggle('hidden', !palletHasMatch);
    if (palletHasMatch && terms.length > 0) {
      const body = palletDiv.querySelector('.metadata-pallet-header + div');
      if (body) body.style.display = '';
      const chevron = palletDiv.querySelector('.metadata-pallet-header svg');
      if (chevron) chevron.style.transform = 'rotate(90deg)';
    }
  }
}

export function renderMetadataTree(tree, container) {
  container.innerHTML = '';
  if (!tree.length) {
    container.innerHTML = '<div class="text-muted text-sm">Connect to view metadata</div>';
    return;
  }

  const filterInput = document.createElement('input');
  filterInput.type = 'text';
  filterInput.className = 'explorer-search-input metadata-filter';
  filterInput.placeholder = 'Search pallets, storage, calls... (comma, * wildcards)';
  container.appendChild(filterInput);

  const root = document.createElement('div');
  root.className = 'metadata-tree';

  for (const pallet of tree) {
    const palletDiv = document.createElement('div');
    palletDiv.className = 'metadata-pallet';

    const palletHeader = document.createElement('div');
    palletHeader.className = 'metadata-pallet-header';
    const chevron = document.createElement('span');
    chevron.innerHTML = ICON_CHEVRON;
    chevron.style.transition = 'transform 0.15s';
    const palletName = document.createElement('span');
    palletName.textContent = pallet.name;
    palletHeader.append(chevron, palletName);

    const body = document.createElement('div');
    body.style.display = 'none';

    const categories = [
      { label: 'Storage', items: pallet.storage },
      { label: 'Calls', items: pallet.calls },
      { label: 'Events', items: pallet.events },
      { label: 'Constants', items: pallet.constants },
      { label: 'Errors', items: pallet.errors },
    ];

    for (const cat of categories) {
      if (!cat.items.length) continue;
      const catDiv = document.createElement('div');
      catDiv.className = 'metadata-category';
      const catHeader = document.createElement('div');
      catHeader.className = 'metadata-category-header';
      const catChevron = document.createElement('span');
      catChevron.innerHTML = ICON_CHEVRON;
      catChevron.style.transition = 'transform 0.15s';
      const catLabel = document.createElement('span');
      catLabel.textContent = `${cat.label} (${cat.items.length})`;
      catHeader.append(catChevron, catLabel);

      const catBody = document.createElement('div');
      catBody.style.display = 'none';

      for (const item of cat.items) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'metadata-item';
        itemDiv.dataset.itemName = item.name;
        itemDiv.textContent = item.name;
        itemDiv.addEventListener('click', () => {
          showMetadataInsight(pallet.name, cat.label, item);
          fetchInlineValue(pallet.name, cat.label, item, itemDiv);
        });
        catBody.appendChild(itemDiv);
      }

      catHeader.addEventListener('click', () => {
        const closed = catBody.style.display === 'none';
        catBody.style.display = closed ? '' : 'none';
        catChevron.querySelector('svg').style.transform = closed ? 'rotate(90deg)' : '';
      });

      catDiv.append(catHeader, catBody);
      body.appendChild(catDiv);
    }

    palletHeader.addEventListener('click', () => {
      const closed = body.style.display === 'none';
      body.style.display = closed ? '' : 'none';
      chevron.querySelector('svg').style.transform = closed ? 'rotate(90deg)' : '';
    });

    palletDiv.append(palletHeader, body);
    root.appendChild(palletDiv);
  }

  container.appendChild(root);

  let filterTimer;
  filterInput.addEventListener('input', () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(() => {
      const terms = parseFilterTerms(filterInput.value);
      filterMetadataTree(terms, root);
    }, 200);
  });
}

function showMetadataInsight(palletName, category, item) {
  if (!dom.metadataDocs) return;
  let html = `<div class="doc-summary">${escapeHtml(palletName)} › ${escapeHtml(category)} › ${escapeHtml(item.name)}</div>`;

  if (item.docs?.length) {
    html += `<p class="doc-para">${item.docs.map(d => escapeHtml(d)).join(' ')}</p>`;
  }

  if (item.type) {
    html += `<div class="doc-section"><div class="doc-section-title">Type</div>`;
    html += `<p class="doc-para"><code>${escapeHtml(item.type)}</code></p></div>`;
  }

  if (item.modifier) {
    html += `<p class="doc-para">Modifier: <code>${escapeHtml(item.modifier)}</code></p>`;
  }

  dom.metadataDocs.innerHTML = html;
  dom.metadataDocs.classList.remove('hidden');
}

export function initMetadataBrowser() {
  // populated on connect via populateMetadata()
}

export function populateMetadata(api) {
  if (!api) {
    dom.metadataPane.innerHTML = '<div class="text-muted text-sm">Connect to view metadata</div>';
    return;
  }
  valueCache.clear();
  const tree = buildMetadataTree(api);
  renderMetadataTree(tree, dom.metadataPane);
}

export function resetMetadataBrowser() {
  dom.metadataPane.innerHTML = '';
  valueCache.clear();
  if (dom.metadataDocs) {
    dom.metadataDocs.innerHTML = '';
    dom.metadataDocs.classList.add('hidden');
  }
}

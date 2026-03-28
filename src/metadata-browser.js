import { state } from './state.js';
import { dom } from './ui.js';
import { escapeHtml } from './chain-utils.js';

const ICON_CHEVRON = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';

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

export function renderMetadataTree(tree, container) {
  container.innerHTML = '';
  if (!tree.length) {
    container.innerHTML = '<div class="text-muted text-sm">Connect to view metadata</div>';
    return;
  }

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
        itemDiv.textContent = item.name;
        itemDiv.addEventListener('click', () => {
          showMetadataInsight(pallet.name, cat.label, item);
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
  const tree = buildMetadataTree(api);
  renderMetadataTree(tree, dom.metadataPane);
}

export function resetMetadataBrowser() {
  dom.metadataPane.innerHTML = '';
  if (dom.metadataDocs) {
    dom.metadataDocs.innerHTML = '';
    dom.metadataDocs.classList.add('hidden');
  }
}

import { selectConstant } from './constants-viewer.js';
import { selectQuery } from './query.js';
import { ROUTES } from './constants.js';
import { state } from './state.js';
import { dom, setActiveRoute, setDataHubTab } from './ui.js';
import { selectExtrinsic } from './tx.js';

let paletteIndex = [];
let activeResultIndex = -1;

const STATIC_ROUTE_ENTRIES = [
  { type: 'route', kind: 'nav', label: 'Explorer', route: ROUTES.EXPLORER },
  { type: 'route', kind: 'nav', label: 'Compose', route: ROUTES.COMPOSE },
  { type: 'route', kind: 'nav', label: 'Data Hub', route: ROUTES.DATA_HUB },
  { type: 'route', kind: 'nav', label: 'Accounts', route: ROUTES.ACCOUNTS },
  { type: 'route', kind: 'nav', label: 'Diagnostics', route: ROUTES.DIAGNOSTICS },
  { type: 'route', kind: 'nav', label: 'Settings', route: ROUTES.SETTINGS },
];

export function buildPaletteIndex(api) {
  if (!api) {
    paletteIndex = [];
    return;
  }
  const items = [];
  for (const p of Object.keys(api.tx).sort()) {
    for (const m of Object.keys(api.tx[p])) {
      const fn = api.tx[p][m];
      if (typeof fn === 'function' && fn.meta) {
        items.push({ type: 'tx', kind: 'tx', pallet: p, item: m, label: `${p}.${m}` });
      }
    }
  }
  for (const p of Object.keys(api.query).sort()) {
    for (const k of Object.keys(api.query[p])) {
      const q = api.query[p][k];
      if (typeof q === 'function' && q.meta) {
        items.push({ type: 'query', kind: 'qry', pallet: p, item: k, label: `${p}.${k}` });
      }
    }
  }
  for (const p of Object.keys(api.consts).sort()) {
    for (const c of Object.keys(api.consts[p])) {
      const co = api.consts[p][c];
      if (co?.meta) {
        items.push({ type: 'const', kind: 'cst', pallet: p, item: c, label: `${p}.${c}` });
      }
    }
  }
  paletteIndex = items;
}

const GROUP_ORDER = ['route', 'tx', 'query', 'const'];
const GROUP_LABELS = { route: 'Routes', tx: 'Extrinsics', query: 'Queries', const: 'Constants' };

function filterPalette(query) {
  const q = query.trim().toLowerCase();
  const allEntries = [...STATIC_ROUTE_ENTRIES, ...paletteIndex];
  if (!q) {
    return groupResults(allEntries.slice(0, 80));
  }
  const out = [];
  for (const entry of allEntries) {
    const label = entry.label.toLowerCase();
    const idx = label.indexOf(q);
    if (idx === -1) continue;
    out.push({ entry, score: idx === 0 ? idx : 100 + idx });
  }
  out.sort((a, b) => a.score - b.score || a.entry.label.localeCompare(b.entry.label));
  return groupResults(out.slice(0, 80).map(x => x.entry));
}

function groupResults(entries) {
  const groups = {};
  const flat = [];
  for (const entry of entries) {
    if (!groups[entry.type]) groups[entry.type] = { type: entry.type, label: GROUP_LABELS[entry.type] || entry.type, entries: [] };
    groups[entry.type].entries.push(entry);
    flat.push(entry);
  }
  const ordered = GROUP_ORDER.filter(t => groups[t]).map(t => groups[t]);
  return { groups: ordered, flat };
}

function dispatchPaletteEntry(entry) {
  if (!entry) return;
  if (entry.type === 'tx') {
    setActiveRoute(ROUTES.COMPOSE);
    selectExtrinsic(entry.pallet, entry.item);
  } else if (entry.type === 'query') {
    setActiveRoute(ROUTES.DATA_HUB);
    setDataHubTab('queryPane');
    selectQuery(entry.pallet, entry.item);
  } else if (entry.type === 'const') {
    setActiveRoute(ROUTES.DATA_HUB);
    setDataHubTab('constantsPane');
    selectConstant(entry.pallet, entry.item);
  } else if (entry.type === 'route') {
    setActiveRoute(entry.route);
    if (entry.subTab) setDataHubTab(entry.subTab);
  }
}

function renderPaletteResults(query) {
  const { groups, flat } = filterPalette(query);
  dom.paletteResults.innerHTML = '';
  activeResultIndex = -1;

  for (const group of groups) {
    const header = document.createElement('li');
    header.className = 'palette-group-header';
    header.textContent = group.label;
    dom.paletteResults.appendChild(header);

    for (const entry of group.entries) {
      const li = document.createElement('li');
      li.className = 'palette-result';
      li.dataset.flatIndex = String(flat.indexOf(entry));
      const kind = document.createElement('span');
      kind.className = 'palette-kind';
      kind.textContent = `[${entry.kind}]`;
      const lab = document.createElement('span');
      lab.className = 'palette-label';
      lab.textContent = entry.label;
      li.append(kind, document.createTextNode(' '), lab);
      li.addEventListener('click', () => {
        dispatchPaletteEntry(entry);
        hidePalette();
      });
      dom.paletteResults.appendChild(li);
    }
  }

  return flat;
}

function updateActiveHighlight() {
  const items = dom.paletteResults.querySelectorAll('.palette-result');
  for (const li of items) {
    li.classList.toggle('palette-active', parseInt(li.dataset.flatIndex, 10) === activeResultIndex);
  }
  const active = dom.paletteResults.querySelector('.palette-active');
  if (active) active.scrollIntoView({ block: 'nearest' });
}

function hidePalette() {
  dom.commandPalette.classList.add('hidden');
  dom.commandPalette.setAttribute('aria-hidden', 'true');
  activeResultIndex = -1;
}

function showPalette() {
  dom.commandPalette.classList.remove('hidden');
  dom.commandPalette.setAttribute('aria-hidden', 'false');
  dom.paletteSearch.value = '';
  renderPaletteResults('');
  dom.paletteSearch.focus();
}

export function initPalette() {
  let currentFlat = [];

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (dom.commandPalette.classList.contains('hidden')) {
        showPalette();
      } else {
        hidePalette();
      }
    }
    if (e.key === 'Escape' && !dom.commandPalette.classList.contains('hidden')) {
      e.preventDefault();
      hidePalette();
    }
  });

  dom.commandPalette.addEventListener('click', (e) => {
    if (e.target === dom.commandPalette) hidePalette();
  });

  dom.paletteSearch.addEventListener('input', () => {
    currentFlat = renderPaletteResults(dom.paletteSearch.value);
  });

  dom.paletteSearch.addEventListener('keydown', (e) => {
    if (!currentFlat.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeResultIndex = (activeResultIndex + 1) % currentFlat.length;
      updateActiveHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeResultIndex = activeResultIndex <= 0 ? currentFlat.length - 1 : activeResultIndex - 1;
      updateActiveHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeResultIndex >= 0 && activeResultIndex < currentFlat.length) {
        dispatchPaletteEntry(currentFlat[activeResultIndex]);
        hidePalette();
      }
    }
  });
}

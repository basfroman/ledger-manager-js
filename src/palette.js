import { selectConstant } from './constants-viewer.js';
import { selectQuery } from './query.js';
import { state } from './state.js';
import { dom } from './ui.js';
import { selectExtrinsic } from './tx.js';

let paletteIndex = [];

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

function filterPalette(query) {
  const q = query.trim().toLowerCase();
  if (!q) return paletteIndex.slice(0, 80);
  const out = [];
  for (const entry of paletteIndex) {
    const label = entry.label.toLowerCase();
    const idx = label.indexOf(q);
    if (idx === -1) continue;
    out.push({ entry, score: idx === 0 ? idx : 100 + idx });
  }
  out.sort((a, b) => a.score - b.score || a.entry.label.localeCompare(b.entry.label));
  return out.slice(0, 80).map(x => x.entry);
}

function activateRightTab(pane, title) {
  dom.rightPanelTitle.textContent = title;
  for (const b of dom.rightPanelToggle.querySelectorAll('button')) {
    b.classList.toggle('active', b.dataset.pane === pane);
  }
  dom.builderPane.classList.toggle('hidden', pane !== 'builderPane');
  dom.queryPane.classList.toggle('hidden', pane !== 'queryPane');
  dom.constantsPane.classList.toggle('hidden', pane !== 'constantsPane');
}

function dispatchPaletteEntry(entry) {
  if (!entry) return;
  if (entry.type === 'tx') {
    activateRightTab('builderPane', 'Extrinsic Builder');
    selectExtrinsic(entry.pallet, entry.item);
  } else if (entry.type === 'query') {
    activateRightTab('queryPane', 'Queries');
    selectQuery(entry.pallet, entry.item);
  } else if (entry.type === 'const') {
    activateRightTab('constantsPane', 'Constants');
    selectConstant(entry.pallet, entry.item);
  }
}

function renderPaletteResults(query) {
  const list = filterPalette(query);
  dom.paletteResults.innerHTML = '';
  for (const entry of list) {
    const li = document.createElement('li');
    li.className = 'palette-result';
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

function hidePalette() {
  dom.commandPalette.classList.add('hidden');
  dom.commandPalette.setAttribute('aria-hidden', 'true');
}

function showPalette() {
  if (!state.api) return;
  dom.commandPalette.classList.remove('hidden');
  dom.commandPalette.setAttribute('aria-hidden', 'false');
  dom.paletteSearch.value = '';
  renderPaletteResults('');
  dom.paletteSearch.focus();
}

export function initPalette() {
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
    renderPaletteResults(dom.paletteSearch.value);
  });

  dom.footerCollapseBtn.addEventListener('click', () => {
    dom.bottomRow.classList.toggle('collapsed');
    dom.footerCollapseBtn.textContent = dom.bottomRow.classList.contains('collapsed') ? 'Expand' : 'Collapse';
  });
}

import { ACCOUNT_SOURCE, COPY_FEEDBACK_MS, ICON_COPY, ICON_CHECK, LS_ACTIVE_ROUTE, LS_INSIGHT_WIDTH, LS_TIMELINE_HEIGHT, ROUTES, ROUTE_TO_DOM_ID } from './constants.js';
import { copyToClipboard, truncAddr } from './chain-utils.js';
import { pushTimelineEvent } from './timeline.js';
import { state } from './state.js';

const $ = (id) => document.getElementById(id);

/** Populated by initDomRefs() (called from initUI); allows tests to mount HTML before binding. */
export const dom = {};

export function initDomRefs() {
  Object.assign(dom, {
    topBar: $('topBar'),
    navRail: $('navRail'),
    mainCanvas: $('mainCanvas'),
    insightRail: $('insightRail'),
    insightContent: $('insightContent'),
    timelineDock: $('timelineDock'),
    timelineList: $('timelineList'),
    routeCompose: $('routeCompose'),
    routeDataHub: $('routeDataHub'),
    routeAccounts: $('routeAccounts'),
    routeExplorer: $('routeExplorer'),
    routeDiagnostics: $('routeDiagnostics'),
    explorerBlockList: $('explorerBlockList'),
    explorerDetailPane: $('explorerDetailPane'),
    explorerSearchInput: $('explorerSearchInput'),
    explorerSearchBtn: $('explorerSearchBtn'),
    explorerLiveBtn: $('explorerLiveBtn'),
    explorerDocs: $('explorerDocs'),
    preflightChecklist: $('preflightChecklist'),
    diagnosticsCard: $('diagnosticsCard'),
    networkPresetTrigger: $('networkPresetTrigger'),
    networkPresetDropdown: $('networkPresetDropdown'),
    customUrlWrap: $('customUrlWrap'),
    customUrl: $('customUrl'),
    connectBtn: $('connectBtn'),
    disconnectBtn: $('disconnectBtn'),
    networkStatus: $('networkStatus'),
    accountSourceToggle: $('accountSourceToggle'),
    ledgerOnlyWrap: $('ledgerOnlyWrap'),
    walletOnlyWrap: $('walletOnlyWrap'),
    walletExtensionWrap: $('walletExtensionWrap'),
    walletExtensionTrigger: $('walletExtensionTrigger'),
    walletExtensionDropdown: $('walletExtensionDropdown'),
    refreshExtensionsBtn: $('refreshExtensionsBtn'),
    walletExtensionHint: $('walletExtensionHint'),
    loadExtensionAccountsBtn: $('loadExtensionAccountsBtn'),
    addDeviceBtn: $('addDeviceBtn'),
    loadAccountsBtn: $('loadAccountsBtn'),
    singleAccountIndex: $('singleAccountIndex'),
    loadSingleAccountBtn: $('loadSingleAccountBtn'),
    ledgerStatusEl: $('ledgerStatus'),
    deviceListBody: $('deviceListBody'),
    accountsBody: $('accountsBody'),
    accountsTitle: $('accountsTitle'),
    refreshBalancesBtn: $('refreshBalancesBtn'),
    txStatusEl: $('txStatus'),
    txResultWrap: $('txResultWrap'),
    txResult: $('txResult'),
    logPanel: $('logPanel'),
    palletSelectTrigger: $('palletSelectTrigger'),
    palletSelectDropdown: $('palletSelectDropdown'),
    methodSelectTrigger: $('methodSelectTrigger'),
    methodSelectDropdown: $('methodSelectDropdown'),
    extrinsicDocs: $('extrinsicDocs'),
    extrinsicArgs: $('extrinsicArgs'),
    extrinsicSendBtn: $('extrinsicSendBtn'),
    feeEstimateBtn: $('feeEstimateBtn'),
    feeEstimate: $('feeEstimate'),
    signingAccountBar: $('signingAccountBar'),
    signingAddr: $('signingAddr'),
    builderPane: $('builderPane'),
    queryPane: $('queryPane'),
    rightPanelToggle: $('rightPanelToggle'),
    rightPanelTitle: $('rightPanelTitle'),
    qPalletSelectTrigger: $('qPalletSelectTrigger'),
    qPalletSelectDropdown: $('qPalletSelectDropdown'),
    qStorageSelectTrigger: $('qStorageSelectTrigger'),
    qStorageSelectDropdown: $('qStorageSelectDropdown'),
    queryKeys: $('queryKeys'),
    queryExecuteBtn: $('queryExecuteBtn'),
    queryDocs: $('queryDocs'),
    queryResult: $('queryResult'),
    queryResultWrap: $('queryResultWrap'),
    queryResultCopyBtn: $('queryResultCopyBtn'),
    constantsPane: $('constantsPane'),
    cPalletSelectTrigger: $('cPalletSelectTrigger'),
    cPalletSelectDropdown: $('cPalletSelectDropdown'),
    cConstantSelectTrigger: $('cConstantSelectTrigger'),
    cConstantSelectDropdown: $('cConstantSelectDropdown'),
    constantDocs: $('constantDocs'),
    constantResult: $('constantResult'),
    constantResultWrap: $('constantResultWrap'),
    constantResultCopyBtn: $('constantResultCopyBtn'),
    metadataPane: $('metadataPane'),
    metadataDocs: $('metadataDocs'),
    dryRunBtn: $('dryRunBtn'),
    addToBatchBtn: $('addToBatchBtn'),

    batchList: $('batchList'),
    watchPanel: $('watchPanel'),
    mapBrowserWrap: $('mapBrowserWrap'),
    queryAtBlock: $('queryAtBlock'),
    queryCompare: $('queryCompare'),
    explorerViewToggle: $('explorerViewToggle'),
    eventStreamPane: $('eventStreamPane'),
    eventStreamFilter: $('eventStreamFilter'),
    eventStreamList: $('eventStreamList'),
    accountXRay: $('accountXRay'),
    proxyManager: $('proxyManager'),
    addressBookSection: $('addressBookSection'),
    addressBookContent: $('addressBookContent'),
    nonceInfo: $('nonceInfo'),
    chainHealth: $('chainHealth'),
    decodeInput: $('decodeInput'),
    decodeTypeHintTrigger: $('decodeTypeHintTrigger'),
    decodeTypeHintDropdown: $('decodeTypeHintDropdown'),
    decodeBtn: $('decodeBtn'),
    decodeResult: $('decodeResult'),
    logCopyBtn: $('logCopyBtn'),
    resultCopyBtn: $('resultCopyBtn'),
    explorerLink: $('explorerLink'),
    explorerLinkLabel: $('explorerLinkLabel'),
    sourceSection: $('sourceSection'),
    accountsSection: $('accountsSection'),
    chainInfoBar: $('chainInfoBar'),
    footerCollapseBtn: $('footerCollapseBtn'),
    commandPalette: $('commandPalette'),
    paletteSearch: $('paletteSearch'),
    paletteResults: $('paletteResults'),
    verifyAddress: $('verifyAddress'),
    verifyMessage: $('verifyMessage'),
    verifySignature: $('verifySignature'),
    verifyBtn: $('verifyBtn'),
    verifyResult: $('verifyResult'),
    signMessageSection: $('signMessageSection'),
    signMessageInput: $('signMessageInput'),
    signMessageBtn: $('signMessageBtn'),
    signMessageResult: $('signMessageResult'),
    explorerChainInfo: $('explorerChainInfo'),
    bittensorTabBtn: $('bittensorTabBtn'),
    bittensorPane: $('bittensorPane'),
    bittensorSubnets: $('bittensorSubnets'),
    neuronNetuid: $('neuronNetuid'),
    neuronUid: $('neuronUid'),
    neuronFetchBtn: $('neuronFetchBtn'),
    neuronResult: $('neuronResult'),
    regNetuid: $('regNetuid'),
    regFetchBtn: $('regFetchBtn'),
    regResult: $('regResult'),
    bittensorDocs: $('bittensorDocs'),
  });
}

/**
 * Source + Accounts: locked until RPC connected.
 * Extrinsic Builder: locked until at least one account is loaded from the active source.
 * DataHub: locked until connected.
 */
export function syncPanelAvailability() {
  const connected = Boolean(state.api);
  const accountsReady = connected && state.lastLoadedAccounts.length > 0;

  dom.accountsSection.classList.toggle('panel-locked', !connected);
  dom.builderPane.classList.toggle('panel-locked', !accountsReady);
  dom.routeDataHub.classList.toggle('panel-locked', !connected);

  dom.accountsSection.setAttribute('aria-disabled', String(!connected));
}

/**
 * Switches the active route displayed in mainCanvas.
 * Updates navRail active state, route panel visibility, and insightRail docs.
 */
export function setActiveRoute(route) {
  state.activeRoute = route;
  try { localStorage.setItem(LS_ACTIVE_ROUTE, route); } catch {}
  const activeDomId = ROUTE_TO_DOM_ID[route];
  for (const [, domId] of Object.entries(ROUTE_TO_DOM_ID)) {
    const el = dom[domId];
    if (el) el.classList.toggle('hidden', domId !== activeDomId);
  }
  for (const btn of dom.navRail.querySelectorAll('[data-route]')) {
    const isActive = btn.dataset.route === route;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  }
  for (const el of dom.insightRail.querySelectorAll('[data-insight-route]')) {
    el.style.display = el.dataset.insightRoute === route ? '' : 'none';
  }
}

const DATA_HUB_PANES = [
  { pane: 'queryPane', docs: 'queryDocs' },
  { pane: 'constantsPane', docs: 'constantDocs' },
  { pane: 'metadataPane', docs: 'metadataDocs' },
  { pane: 'bittensorPane', docs: 'bittensorDocs' },
];

/**
 * Switches the active sub-tab within DataHub.
 * Data-driven: iterates DATA_HUB_PANES for pane/docs visibility.
 */
export function setDataHubTab(pane) {
  for (const entry of DATA_HUB_PANES) {
    const paneEl = dom[entry.pane];
    const docsEl = dom[entry.docs];
    if (paneEl) paneEl.classList.toggle('hidden', entry.pane !== pane);
    if (docsEl) {
      const show = entry.pane === pane && docsEl.innerHTML.trim();
      docsEl.classList.toggle('hidden', !show);
    }
  }
  const activeBtn = dom.rightPanelToggle.querySelector(`[data-pane="${pane}"]`);
  dom.rightPanelTitle.textContent = activeBtn?.dataset.title ?? '';
  for (const b of dom.rightPanelToggle.querySelectorAll('button')) {
    b.classList.toggle('active', b.dataset.pane === pane);
  }
}

/**
 * Updates the topBar account indicator. Sole owner of signingAccountBar display.
 */
export function updateTopBar() {
  if (state.selectedAccount) {
    dom.signingAddr.textContent = `Account: ${truncAddr(state.selectedAccount.address)}`;
    dom.signingAccountBar.classList.remove('hidden');
  } else {
    dom.signingAccountBar.classList.add('hidden');
  }
}

/**
 * Updates the block number in chainInfoBar. Sole owner of .block-num updates.
 */
export function updateChainBlock(num) {
  const el = dom.chainInfoBar.querySelector('.block-num');
  if (!el) return;
  el.textContent = `#${num.toLocaleString()}`;
  el.classList.remove('ticked');
  void el.offsetWidth;
  el.classList.add('ticked');
}

export function setLedgerStatus(text, tone) {
  dom.ledgerStatusEl.textContent = text;
  dom.ledgerStatusEl.className = `status-box mt-12 status-${tone}`;
}

export function setStatus(el, text, tone = 'neutral') {
  el.textContent = text;
  el.className = `status-box mt-12 status-${tone}`;
}

export function setTxStatus(text, tone) {
  dom.txStatusEl.textContent = text;
  dom.txStatusEl.className = `status-box status-${tone}`;
}

export function log(msg) {
  const ts = new Date().toISOString().slice(11, 23);
  dom.logPanel.textContent += `[${ts}] ${msg}\n`;
  dom.logPanel.scrollTop = dom.logPanel.scrollHeight;
}

export function clearLog() {
  dom.logPanel.textContent = '';
}

export function positionDropdown(trigger, dropdown) {
  const rect = trigger.getBoundingClientRect();
  dropdown.style.top = `${rect.bottom + 4}px`;
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.width = `${rect.width}px`;
  dropdown.style.maxHeight = 'none';
  const available = window.innerHeight - rect.bottom - 16;
  const natural = dropdown.scrollHeight;
  if (natural > available && available > 80) {
    dropdown.style.maxHeight = `${available}px`;
  }
}

export function setupCustomDropdown(trigger, dropdown, wrapId, onChange) {
  trigger.addEventListener('click', () => {
    if (trigger.disabled) return;
    const wasHidden = dropdown.classList.contains('hidden');
    dropdown.classList.toggle('hidden');
    if (wasHidden) {
      positionDropdown(trigger, dropdown);
      const si = dropdown.querySelector('.dd-search');
      if (si) {
        si.value = '';
        si.dispatchEvent(new Event('input'));
        si.focus();
      }
    }
    const isOpen = !dropdown.classList.contains('hidden');
    if (trigger.hasAttribute('aria-expanded')) {
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
  });
  dropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('.custom-select-option');
    if (!opt) return;
    dropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    trigger.querySelector('.custom-select-label').textContent = opt.querySelector('.custom-select-label').textContent;
    dropdown.classList.add('hidden');
    if (trigger.hasAttribute('aria-expanded')) trigger.setAttribute('aria-expanded', 'false');
    onChange(opt.dataset.value);
  });
  dropdown.addEventListener('input', (e) => {
    if (!e.target.classList.contains('dd-search')) return;
    const q = e.target.value.toLowerCase();
    dropdown.querySelectorAll('.custom-select-option').forEach(opt => {
      opt.style.display = opt.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
}

export function populateCustomDropdown(trigger, dropdown, items, placeholder) {
  dropdown.innerHTML = '';
  if (items.length > 10) {
    const search = document.createElement('input');
    search.className = 'dd-search';
    search.type = 'text';
    search.placeholder = 'Type to filter...';
    search.autocomplete = 'off';
    dropdown.appendChild(search);
  }
  for (const item of items) {
    const div = document.createElement('div');
    div.className = 'custom-select-option';
    div.dataset.value = item;
    const label = document.createElement('span');
    label.className = 'custom-select-label';
    label.textContent = item;
    div.appendChild(label);
    dropdown.appendChild(div);
  }
  trigger.querySelector('.custom-select-label').textContent = placeholder;
  trigger.disabled = items.length === 0;
}

/**
 * Parses `--accent-rgb` from CSS (comma-separated "R, G, B").
 * @param {string} cssValue
 * @returns {{ r: number, g: number, b: number }}
 */
export function parseAccentRgbTuple(cssValue) {
  const parts = String(cssValue)
    .split(',')
    .map(s => parseInt(s.trim(), 10));
  if (parts.length === 3 && parts.every(n => !Number.isNaN(n) && n >= 0 && n <= 255)) {
    return { r: parts[0], g: parts[1], b: parts[2] };
  }
  return { r: 198, g: 120, b: 221 };
}

export function matrixRain() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none;opacity:1;transition:opacity 0.8s';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.scale(dpr, dpr);

  const W = window.innerWidth;
  const H = window.innerHeight;
  const chars = 'τΤɃ₿ΞΣ01αβγδ0123456789ABCDEF⟨⟩{}[]≡≈∞∫Δ';
  const size = 14;
  const cols = Math.ceil(W / size);
  const drops = Array.from({ length: cols }, () => Math.random() * -40 | 0);
  const speeds = Array.from({ length: cols }, () => 0.3 + Math.random() * 0.7);

  const accent = parseAccentRgbTuple(
    getComputedStyle(document.body).getPropertyValue('--accent-rgb').trim(),
  );

  const DURATION = 2800;
  const FADE_AT = 1800;
  const start = performance.now();

  function draw(now) {
    const elapsed = now - start;
    if (elapsed > DURATION) {
      canvas.style.opacity = '0';
      setTimeout(() => canvas.remove(), 800);
      return;
    }

    if (elapsed > FADE_AT) {
      canvas.style.opacity = String(1 - (elapsed - FADE_AT) / (DURATION - FADE_AT));
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.fillRect(0, 0, W, H);

    for (let i = 0; i < cols; i++) {
      const ch = chars[(Math.random() * chars.length) | 0];
      const y = drops[i] * size;

      const bright = Math.random();
      if (bright > 0.92) {
        ctx.fillStyle = '#fff';
        ctx.shadowColor = `rgb(${accent.r},${accent.g},${accent.b})`;
        ctx.shadowBlur = 12;
      } else {
        const g = 100 + (Math.random() * 155) | 0;
        const jr = 30 + (Math.random() * 40) | 0;
        const jb = 40 + (Math.random() * 30) | 0;
        const r = Math.round(jr * 0.35 + accent.r * 0.65);
        const g2 = Math.round(g * 0.4 + accent.g * 0.6);
        const b = Math.round(jb * 0.35 + accent.b * 0.65);
        ctx.fillStyle = `rgba(${r}, ${g2}, ${b}, ${0.6 + Math.random() * 0.4})`;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      ctx.font = `${size}px JetBrains Mono, monospace`;
      ctx.fillText(ch, i * size, y);
      ctx.shadowBlur = 0;

      drops[i] += speeds[i];
      if (y > H && Math.random() > 0.98) {
        drops[i] = Math.random() * -20 | 0;
      }
    }

    requestAnimationFrame(draw);
  }

  requestAnimationFrame(draw);
}

/**
 * Renders timeline events from state into the timelineList element.
 */
export function renderTimeline() {
  dom.timelineList.innerHTML = '';
  for (const evt of state.timelineEvents) {
    const d = new Date(evt.ts);
    const ts = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;

    const row = document.createElement('div');
    row.className = `timeline-event timeline-${evt.type}`;

    const tsSpan = document.createElement('span');
    tsSpan.className = 'timeline-ts';
    tsSpan.textContent = ts;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'timeline-title';
    titleSpan.textContent = evt.title;

    row.append(tsSpan, titleSpan);

    if (evt.link) {
      const a = document.createElement('a');
      a.href = evt.link.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'timeline-link';
      a.textContent = evt.link.label;
      row.appendChild(a);
    }

    if (evt.detail) {
      row.style.cursor = 'pointer';
      const detailDiv = document.createElement('div');
      detailDiv.className = 'timeline-detail';
      detailDiv.textContent = typeof evt.detail === 'string' ? evt.detail : JSON.stringify(evt.detail);
      row.addEventListener('click', () => row.classList.toggle('expanded'));
      dom.timelineList.append(row, detailDiv);
    } else {
      dom.timelineList.appendChild(row);
    }
  }
  dom.timelineList.scrollTop = dom.timelineList.scrollHeight;
}

export function initCopyButton(btn, sourceEl) {
  btn.innerHTML = ICON_COPY;
  btn.addEventListener('click', async () => {
    const ok = await copyToClipboard(sourceEl.textContent);
    if (ok) {
      btn.innerHTML = ICON_CHECK;
      setTimeout(() => { btn.innerHTML = ICON_COPY; }, COPY_FEEDBACK_MS);
    }
  });
}

/** @param {(mode: string) => void} onSelectMode `data-mode` value: ACCOUNT_SOURCE.LEDGER | ACCOUNT_SOURCE.WALLET */
export function initAccountSourceToggle(onSelectMode) {
  dom.accountSourceToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    const mode = btn.dataset.mode;
    if (mode !== ACCOUNT_SOURCE.LEDGER && mode !== ACCOUNT_SOURCE.WALLET) return;
    for (const b of dom.accountSourceToggle.querySelectorAll('button')) {
      b.classList.toggle('active', b === btn);
    }
    onSelectMode(mode);
  });
}

export function addResultAction(container, label, className, onClick) {
  const btn = document.createElement('button');
  btn.className = `btn-secondary btn-sm mt-8 ${className}`;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  container.appendChild(btn);
  return btn;
}

export function addPinButton(container, title, detail) {
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

export function initUI() {
  initDomRefs();
  initCopyButton(dom.logCopyBtn, dom.logPanel);
  initCopyButton(dom.resultCopyBtn, dom.txResult);
  initCopyButton(dom.queryResultCopyBtn, dom.queryResult);
  initCopyButton(dom.constantResultCopyBtn, dom.constantResult);

  dom.rightPanelToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pane]');
    if (!btn) return;
    setDataHubTab(btn.dataset.pane);
  });

  dom.footerCollapseBtn.addEventListener('click', () => {
    dom.timelineDock.classList.toggle('collapsed');
    dom.footerCollapseBtn.textContent = dom.timelineDock.classList.contains('collapsed') ? 'Expand' : 'Collapse';
  });

  dom.navRail.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-route]');
    if (!btn) return;
    setActiveRoute(btn.dataset.route);
  });

  document.addEventListener('click', (e) => {
    for (const dd of document.querySelectorAll('.custom-select-dropdown:not(.hidden)')) {
      const wrap = dd.closest('.custom-select');
      if (wrap && !wrap.contains(e.target)) {
        dd.classList.add('hidden');
        const trigger = wrap.querySelector('.custom-select-trigger');
        if (trigger?.hasAttribute('aria-expanded')) trigger.setAttribute('aria-expanded', 'false');
      }
    }
  });

  initInsightResize();
  initTimelineResize();

  syncPanelAvailability();
  setActiveRoute(state.activeRoute);
}

const TIMELINE_HEIGHT_KEY = LS_TIMELINE_HEIGHT;
const INSIGHT_WIDTH_KEY = LS_INSIGHT_WIDTH;

function initInsightResize() {
  const saved = localStorage.getItem(INSIGHT_WIDTH_KEY);
  if (saved) {
    const px = parseInt(saved, 10);
    const maxW = Math.floor(window.innerWidth * 0.25);
    if (px >= 200 && px <= maxW) {
      document.querySelector('.app-body').style.setProperty('--insight-width', px + 'px');
    }
  }

  const handle = document.getElementById('insightResizeHandle');
  if (!handle) return;

  let dragging = false;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragging = true;
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const appBody = document.querySelector('.app-body');
    const rect = appBody.getBoundingClientRect();
    let width = rect.right - e.clientX;
    const maxW = Math.floor(window.innerWidth * 0.25);
    width = Math.max(200, Math.min(maxW, width));
    appBody.style.setProperty('--insight-width', width + 'px');
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    const appBody = document.querySelector('.app-body');
    const current = getComputedStyle(appBody).getPropertyValue('--insight-width').trim();
    try { localStorage.setItem(INSIGHT_WIDTH_KEY, current); } catch {}
  });
}

function initTimelineResize() {
  const saved = localStorage.getItem(TIMELINE_HEIGHT_KEY);
  if (saved) {
    const px = parseInt(saved, 10);
    const maxH = Math.floor(window.innerHeight * 0.33);
    if (px >= 80 && px <= maxH) {
      dom.timelineDock.style.setProperty('--timeline-height', px + 'px');
    }
  }

  const handle = document.getElementById('timelineResizeHandle');
  if (!handle) return;

  let dragging = false;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragging = true;
    handle.classList.add('dragging');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    let height = window.innerHeight - e.clientY;
    const maxH = Math.floor(window.innerHeight * 0.33);
    height = Math.max(80, Math.min(maxH, height));
    dom.timelineDock.style.setProperty('--timeline-height', height + 'px');
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    const current = getComputedStyle(dom.timelineDock).getPropertyValue('--timeline-height').trim();
    try { localStorage.setItem(TIMELINE_HEIGHT_KEY, current); } catch {}
  });
}

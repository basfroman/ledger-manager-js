import { ROUTES, MAX_EXPLORER_BLOCKS, ICON_COPY, ICON_CHECK, COPY_FEEDBACK_MS } from './constants.js';
import { getChainDecimals, getChainToken, truncAddr, copyToClipboard, escapeHtml } from './chain-utils.js';
import { state } from './state.js';
import { dom } from './ui.js';

const ICON_HEADER = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>';
const ICON_EXTRINSICS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
const ICON_DIGEST = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
const ICON_EVENTS = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
const ICON_CHEVRON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

let ageInterval = null;
let fetchGeneration = 0;

export function formatBalance(rawValue, api) {
  if (!api || rawValue == null) return String(rawValue ?? '');
  try {
    const decimals = getChainDecimals(api);
    const token = getChainToken(api);
    const raw = BigInt(String(rawValue));
    const divisor = 10n ** BigInt(decimals);
    const whole = raw / divisor;
    const frac = raw % divisor;
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
    return fracStr ? `${whole}.${fracStr} ${token}` : `${whole} ${token}`;
  } catch {
    return String(rawValue);
  }
}

function formatAge(tsMs) {
  const sec = Math.floor((Date.now() - tsMs) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

function makeHashEl(hash, full) {
  const span = document.createElement('span');
  span.className = 'explorer-hash';
  const text = document.createElement('code');
  text.textContent = full ? hash : truncAddr(hash);
  text.title = hash;
  span.appendChild(text);
  const btn = document.createElement('button');
  btn.className = 'explorer-copy-btn';
  btn.innerHTML = ICON_COPY;
  btn.title = 'Copy';
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const ok = await copyToClipboard(hash);
    if (ok) {
      btn.innerHTML = ICON_CHECK;
      setTimeout(() => { btn.innerHTML = ICON_COPY; }, COPY_FEEDBACK_MS);
    }
  });
  span.appendChild(btn);
  return span;
}

function collapsibleSection(iconHtml, title, { collapsed = false } = {}) {
  const section = document.createElement('div');
  section.className = 'explorer-section';
  if (collapsed) section.classList.add('section-collapsed');

  const header = document.createElement('div');
  header.className = 'explorer-section-header explorer-section-toggle';

  const chevron = document.createElement('span');
  chevron.className = 'section-chevron';
  chevron.innerHTML = ICON_CHEVRON;
  if (!collapsed) chevron.style.transform = 'rotate(90deg)';

  const iconSpan = document.createElement('span');
  iconSpan.innerHTML = iconHtml;
  const h3 = document.createElement('h3');
  h3.textContent = title;
  header.append(chevron, iconSpan, h3);

  const body = document.createElement('div');
  body.className = 'explorer-section-body';
  if (collapsed) body.style.display = 'none';

  header.addEventListener('click', () => {
    const isCollapsed = section.classList.toggle('section-collapsed');
    body.style.display = isCollapsed ? 'none' : '';
    chevron.style.transform = isCollapsed ? '' : 'rotate(90deg)';
  });

  section.append(header, body);
  return { section, body };
}

function sectionHeader(iconHtml, title) {
  const div = document.createElement('div');
  div.className = 'explorer-section-header';
  const iconSpan = document.createElement('span');
  iconSpan.innerHTML = iconHtml;
  div.appendChild(iconSpan);
  const h3 = document.createElement('h3');
  h3.textContent = title;
  div.appendChild(h3);
  return div;
}

function createBlockRow(block) {
  const row = document.createElement('div');
  row.className = 'explorer-block-row';
  if (block.hash === state.explorerSelectedHash) row.classList.add('selected');
  row.dataset.hash = block.hash;

  const num = document.createElement('span');
  num.className = 'explorer-block-num';
  num.textContent = `#${block.number.toLocaleString()}`;

  const ext = document.createElement('span');
  ext.className = 'explorer-block-ext';
  ext.textContent = `${block.extrinsicsCount} ext`;

  const age = document.createElement('span');
  age.className = 'explorer-block-age';
  age.textContent = formatAge(block.receivedAt);

  row.append(num, ext, age);
  return row;
}

export function renderBlockList() {
  dom.explorerBlockList.innerHTML = '';
  if (state.explorerBlocks.length === 0) {
    dom.explorerBlockList.innerHTML = '<div class="explorer-placeholder">Waiting for blocks...</div>';
    return;
  }
  for (const block of state.explorerBlocks) {
    dom.explorerBlockList.appendChild(createBlockRow(block));
  }
}

function prependBlockRow(blockInfo) {
  const placeholder = dom.explorerBlockList.querySelector('.explorer-placeholder');
  if (placeholder) placeholder.remove();

  const row = createBlockRow(blockInfo);
  row.classList.add('block-row-entering');
  dom.explorerBlockList.prepend(row);

  requestAnimationFrame(() => row.classList.remove('block-row-entering'));

  const rows = dom.explorerBlockList.querySelectorAll('.explorer-block-row');
  if (rows.length > MAX_EXPLORER_BLOCKS) {
    rows[rows.length - 1].remove();
  }
}

function updateAges() {
  const rows = dom.explorerBlockList.querySelectorAll('.explorer-block-row');
  rows.forEach((row) => {
    const hash = row.dataset.hash;
    const block = state.explorerBlocks.find(b => b.hash === hash);
    if (block) {
      const ageEl = row.querySelector('.explorer-block-age');
      if (ageEl) ageEl.textContent = formatAge(block.receivedAt);
    }
  });
}

function startAgeTimer() {
  stopAgeTimer();
  ageInterval = setInterval(updateAges, 1000);
}

function stopAgeTimer() {
  if (ageInterval) { clearInterval(ageInterval); ageInterval = null; }
}

function onNewHead(header) {
  const blockInfo = {
    number: header.number.toNumber(),
    hash: header.hash.toHex(),
    parentHash: header.parentHash.toHex(),
    stateRoot: header.stateRoot.toHex(),
    extrinsicsRoot: header.extrinsicsRoot.toHex(),
    extrinsicsCount: 0,
    receivedAt: Date.now(),
  };

  state.explorerBlocks.unshift(blockInfo);
  if (state.explorerBlocks.length > MAX_EXPLORER_BLOCKS) {
    state.explorerBlocks.pop();
  }

  prependBlockRow(blockInfo);

  if (state.explorerLive) {
    const smooth = state.explorerSelectedHash !== null;
    fetchAndShowBlock(blockInfo.hash, { smooth });
  }
}

export async function activateExplorer() {
  if (state.explorerUnsub) return;
  if (!state.api) return;

  dom.explorerSearchBtn.disabled = false;
  dom.explorerLiveBtn.disabled = false;
  if (state.explorerLive) dom.explorerLiveBtn.classList.add('btn-live-active');

  try {
    state.explorerUnsub = await state.api.rpc.chain.subscribeNewHeads(onNewHead);
    startAgeTimer();
  } catch (err) {
    dom.explorerBlockList.innerHTML = `<div class="explorer-placeholder">Subscription error: ${escapeHtml(err.message)}</div>`;
  }
}

export function deactivateExplorer() {
  if (state.explorerUnsub) {
    state.explorerUnsub();
    state.explorerUnsub = null;
  }
  stopAgeTimer();
  state.explorerBlocks = [];
  state.explorerSelectedHash = null;
  fetchGeneration++;
  dom.explorerSearchBtn.disabled = true;
  dom.explorerLiveBtn.disabled = true;
  dom.explorerLiveBtn.classList.remove('btn-live-active');
  dom.explorerBlockList.innerHTML = '<div class="explorer-placeholder">Connect to a node to explore blocks</div>';
  dom.explorerDetailPane.innerHTML = '<div class="explorer-placeholder">Select a block from the list</div>';
}

export function startLive() {
  state.explorerLive = true;
  dom.explorerLiveBtn.classList.add('btn-live-active');
  dom.explorerLiveBtn.textContent = 'Live';
  if (state.explorerBlocks.length > 0) {
    const smooth = state.explorerSelectedHash !== null;
    fetchAndShowBlock(state.explorerBlocks[0].hash, { smooth });
  }
}

export function stopLive() {
  state.explorerLive = false;
  dom.explorerLiveBtn.classList.remove('btn-live-active');
  dom.explorerLiveBtn.textContent = 'Live';
}

export async function fetchAndShowBlock(hashOrNumber, { smooth = false } = {}) {
  if (!state.api) return;

  const gen = ++fetchGeneration;

  if (!smooth) {
    dom.explorerDetailPane.innerHTML = '<div class="explorer-placeholder">Loading block...</div>';
  }

  try {
    let blockHash;
    if (typeof hashOrNumber === 'string' && hashOrNumber.startsWith('0x')) {
      blockHash = hashOrNumber;
    } else {
      blockHash = await state.api.rpc.chain.getBlockHash(Number(hashOrNumber));
      blockHash = blockHash.toHex();
    }

    const [signedBlock, eventsRaw, timestampRaw] = await Promise.all([
      state.api.rpc.chain.getBlock(blockHash),
      state.api.query.system.events.at(blockHash),
      state.api.query.timestamp.now.at(blockHash),
    ]);

    if (gen !== fetchGeneration) return;

    state.explorerSelectedHash = blockHash;
    highlightSelectedRow();

    if (smooth) {
      const scrollTop = dom.explorerDetailPane.scrollTop;
      dom.explorerDetailPane.classList.remove('detail-refreshing');
      renderBlockDetail(signedBlock, eventsRaw, timestampRaw, blockHash);
      dom.explorerDetailPane.scrollTop = Math.min(scrollTop, dom.explorerDetailPane.scrollHeight);
      void dom.explorerDetailPane.offsetWidth;
      dom.explorerDetailPane.classList.add('detail-refreshing');
    } else {
      renderBlockDetail(signedBlock, eventsRaw, timestampRaw, blockHash);
    }
  } catch (err) {
    if (gen !== fetchGeneration) return;
    dom.explorerDetailPane.innerHTML = `<div class="explorer-placeholder">Error: ${escapeHtml(err.message)}</div>`;
  }
}

function highlightSelectedRow() {
  dom.explorerBlockList.querySelectorAll('.explorer-block-row').forEach(row => {
    row.classList.toggle('selected', row.dataset.hash === state.explorerSelectedHash);
  });
}

function renderBlockDetail(signedBlock, events, timestamp, blockHash) {
  const block = signedBlock.block;
  const header = block.header;
  const blockNum = header.number.toNumber();

  const container = document.createElement('div');

  const title = document.createElement('div');
  title.className = 'explorer-block-title';
  title.textContent = `Block #${blockNum.toLocaleString()}`;
  container.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'explorer-block-meta';
  const tsDate = new Date(timestamp.toNumber());
  meta.innerHTML = `<span>${tsDate.toLocaleString()}</span><span>${block.extrinsics.length} extrinsics</span><span>${events.length} events</span><span>${header.digest.logs.length} digest logs</span>`;
  container.appendChild(meta);

  container.appendChild(renderHeaderSection(header, blockHash));
  container.appendChild(renderExtrinsicsSection(block.extrinsics, events));
  const sysEvents = renderSystemEventsSection(events);
  if (sysEvents) container.appendChild(sysEvents);
  container.appendChild(renderDigestSection(header.digest.logs));
  container.appendChild(renderNavBar(blockNum));

  dom.explorerDetailPane.innerHTML = '';
  dom.explorerDetailPane.appendChild(container);
}

function renderHeaderSection(header, blockHash) {
  const section = document.createElement('div');
  section.className = 'explorer-section';
  section.appendChild(sectionHeader(ICON_HEADER, 'Header'));

  const hashFields = [
    ['Block Hash', blockHash],
    ['Parent Hash', header.parentHash.toHex()],
    ['State Root', header.stateRoot.toHex()],
    ['Extrinsics Root', header.extrinsicsRoot.toHex()],
  ];

  for (const [label, value] of hashFields) {
    addKvRow(section, label, makeHashEl(value, false));
  }

  try {
    addKvText(section, 'Spec Version', state.api.runtimeVersion.specVersion.toString());
  } catch {}
  try {
    addKvText(section, 'Digest Logs', `${header.digest.logs.length}`);
  } catch {}

  return section;
}

function renderExtrinsicsSection(extrinsics, allEvents) {
  const { section, body } = collapsibleSection(ICON_EXTRINSICS, `Extrinsics (${extrinsics.length})`, { collapsed: false });

  extrinsics.forEach((ext, i) => {
    const card = renderExtrinsicCard(ext, i, allEvents);
    body.appendChild(card);
  });

  return section;
}

function renderExtrinsicCard(ext, index, allEvents) {
  const card = document.createElement('div');
  card.className = 'extrinsic-card';

  const isSigned = ext.isSigned;
  const method = ext.method;
  const palletName = method.section || '?';
  const methodName = method.method || '?';

  const headerEl = document.createElement('div');
  headerEl.className = 'extrinsic-card-header';

  const chevron = document.createElement('span');
  chevron.innerHTML = ICON_CHEVRON;
  chevron.style.transition = 'transform 0.15s';

  const indexEl = document.createElement('span');
  indexEl.className = 'extrinsic-index';
  indexEl.textContent = `${index}`;

  const methodEl = document.createElement('span');
  methodEl.className = 'extrinsic-method';
  methodEl.textContent = `${palletName}.${methodName}`;

  const badge = document.createElement('span');
  badge.className = isSigned ? 'extrinsic-badge extrinsic-badge-signed' : 'extrinsic-badge extrinsic-badge-inherent';
  badge.textContent = isSigned ? 'signed' : 'inherent';

  headerEl.append(chevron, indexEl, methodEl, badge);

  headerEl.addEventListener('click', () => {
    card.classList.toggle('expanded');
    chevron.style.transform = card.classList.contains('expanded') ? 'rotate(90deg)' : '';
  });

  const body = document.createElement('div');
  body.className = 'extrinsic-card-body';

  try {
    const hashHex = ext.hash.toHex();
    addKvRow(body, 'Hash', makeHashEl(hashHex, false));
  } catch { /* unsigned inherents may not have hash */ }

  try {
    addKvText(body, 'Length', `${ext.encodedLength} bytes`);
  } catch {}

  if (isSigned) {
    const signer = document.createElement('div');
    signer.className = 'extrinsic-signer';
    const signerLabel = document.createElement('span');
    signerLabel.className = 'extrinsic-signer-label';
    signerLabel.textContent = 'Signer: ';
    signer.appendChild(signerLabel);
    signer.appendChild(makeHashEl(ext.signer.toString(), false));
    body.appendChild(signer);

    try { addKvText(body, 'Nonce', ext.nonce.toString()); } catch {}
    try {
      const tipRaw = ext.tip.toString();
      const tipFormatted = formatBalance(tipRaw, state.api);
      addKvText(body, 'Tip', tipFormatted);
    } catch {}
    try {
      const era = ext.era;
      addKvText(body, 'Era', era.isMortalEra ? `Mortal (period: ${era.asMortalEra.period.toString()}, phase: ${era.asMortalEra.phase.toString()})` : 'Immortal');
    } catch {}
  }

  try {
    const args = method.toHuman();
    if (args && typeof args === 'object' && Object.keys(args).length > 0) {
      const argsEl = document.createElement('div');
      argsEl.className = 'extrinsic-args';
      argsEl.textContent = formatArgs(args);
      body.appendChild(argsEl);
    }
  } catch { /* toHuman can fail on exotic types */ }

  const extEvents = allEvents.filter(e => {
    const phase = e.phase;
    return phase.isApplyExtrinsic && phase.asApplyExtrinsic.toNumber() === index;
  });

  if (extEvents.length > 0) {
    const evLabel = document.createElement('div');
    evLabel.className = 'explorer-kv-label';
    evLabel.style.marginTop = '6px';
    evLabel.textContent = `Events (${extEvents.length})`;
    body.appendChild(evLabel);

    for (const ev of extEvents) {
      body.appendChild(renderEventCard(ev));
    }
  }

  card.append(headerEl, body);
  return card;
}

function addKvRow(parent, label, valueEl) {
  const kv = document.createElement('div');
  kv.className = 'explorer-kv';
  const lbl = document.createElement('span');
  lbl.className = 'explorer-kv-label';
  lbl.textContent = label;
  const val = document.createElement('span');
  val.className = 'explorer-kv-value';
  val.appendChild(valueEl);
  kv.append(lbl, val);
  parent.appendChild(kv);
}

function addKvText(parent, label, text) {
  const kv = document.createElement('div');
  kv.className = 'explorer-kv';
  const lbl = document.createElement('span');
  lbl.className = 'explorer-kv-label';
  lbl.textContent = label;
  const val = document.createElement('span');
  val.className = 'explorer-kv-value';
  val.textContent = text;
  kv.append(lbl, val);
  parent.appendChild(kv);
}

function formatArgs(obj, indent = 0) {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return String(obj);
  const pad = '  '.repeat(indent);
  const padInner = '  '.repeat(indent + 1);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    const items = obj.map(v => `${padInner}${formatArgs(v, indent + 1)}`);
    return `[\n${items.join(',\n')}\n${pad}]`;
  }
  const entries = Object.entries(obj);
  if (entries.length === 0) return '{}';
  const lines = entries.map(([k, v]) => `${padInner}${k}: ${formatArgs(v, indent + 1)}`);
  return `{\n${lines.join(',\n')}\n${pad}}`;
}

function renderEventCard(ev) {
  const card = document.createElement('div');
  card.className = 'extrinsic-card';

  const headerEl = document.createElement('div');
  headerEl.className = 'extrinsic-card-header';

  const isFail = ev.event.section === 'system' && ev.event.method === 'ExtrinsicFailed';
  const dot = document.createElement('span');
  dot.className = `event-dot ${isFail ? 'event-dot-fail' : 'event-dot-ok'}`;

  const name = document.createElement('span');
  name.className = 'extrinsic-method';
  name.textContent = `${ev.event.section}.${ev.event.method}`;

  const phase = document.createElement('span');
  phase.className = 'event-phase-badge';
  if (ev.phase.isApplyExtrinsic) {
    phase.textContent = `ext #${ev.phase.asApplyExtrinsic.toNumber()}`;
  } else if (ev.phase.isFinalization) {
    phase.textContent = 'finalization';
  } else if (ev.phase.isInitialization) {
    phase.textContent = 'initialization';
  }

  const chevron = document.createElement('span');
  chevron.innerHTML = ICON_CHEVRON;
  chevron.style.transition = 'transform 0.15s';

  headerEl.append(chevron, dot, name, phase);

  const cardBody = document.createElement('div');
  cardBody.className = 'extrinsic-card-body';

  try {
    const data = ev.event.data.toHuman();
    if (data && ((Array.isArray(data) && data.length > 0) || (typeof data === 'object' && Object.keys(data).length > 0))) {
      const argsEl = document.createElement('div');
      argsEl.className = 'extrinsic-args';
      argsEl.textContent = formatArgs(data);
      cardBody.appendChild(argsEl);
    }
  } catch {}

  try {
    const topics = ev.topics;
    if (topics && topics.length > 0) {
      addKvText(cardBody, 'Topics', topics.map(t => t.toHex()).join(', '));
    }
  } catch {}

  headerEl.addEventListener('click', () => {
    card.classList.toggle('expanded');
    chevron.style.transform = card.classList.contains('expanded') ? 'rotate(90deg)' : '';
  });

  card.append(headerEl, cardBody);
  return card;
}

function renderSystemEventsSection(events) {
  const systemEvents = events.filter(e => !e.phase.isApplyExtrinsic);
  if (systemEvents.length === 0) return null;

  const { section, body } = collapsibleSection(ICON_EVENTS, `System Events (${systemEvents.length})`, { collapsed: true });

  for (const ev of systemEvents) {
    body.appendChild(renderEventCard(ev));
  }

  return section;
}

function renderDigestSection(logs) {
  const { section, body } = collapsibleSection(ICON_DIGEST, `Digest Logs (${logs.length})`, { collapsed: true });

  for (const log of logs) {
    const card = document.createElement('div');
    card.className = 'extrinsic-card';

    const human = log.toHuman();
    let digestType = 'Unknown';
    let digestData = '';

    if (typeof human === 'object' && human !== null) {
      const key = Object.keys(human)[0];
      digestType = key || 'Unknown';
      const val = human[key];
      digestData = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val ?? '');
    } else {
      digestData = String(human);
    }

    const headerEl = document.createElement('div');
    headerEl.className = 'extrinsic-card-header';

    const chevron = document.createElement('span');
    chevron.innerHTML = ICON_CHEVRON;
    chevron.style.transition = 'transform 0.15s';

    const typeEl = document.createElement('span');
    typeEl.className = 'extrinsic-method';
    typeEl.textContent = digestType;

    const preview = document.createElement('span');
    preview.className = 'event-phase-badge';
    preview.textContent = digestData.length > 40 ? digestData.slice(0, 40) + '…' : digestData;

    headerEl.append(chevron, typeEl, preview);

    const cardBody = document.createElement('div');
    cardBody.className = 'extrinsic-card-body';

    const fullData = document.createElement('div');
    fullData.className = 'extrinsic-args';
    fullData.textContent = digestData;
    cardBody.appendChild(fullData);

    try {
      const raw = log.toHex();
      if (raw) addKvRow(cardBody, 'Raw', makeHashEl(raw, false));
    } catch {}

    headerEl.addEventListener('click', () => {
      card.classList.toggle('expanded');
      chevron.style.transform = card.classList.contains('expanded') ? 'rotate(90deg)' : '';
    });

    card.append(headerEl, cardBody);
    body.appendChild(card);
  }

  return section;
}

function renderNavBar(blockNum) {
  const nav = document.createElement('div');
  nav.className = 'explorer-nav-bar';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn-secondary btn-sm';
  prevBtn.textContent = '← Prev';
  prevBtn.addEventListener('click', () => navigateBlock(blockNum - 1));

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn-secondary btn-sm';
  nextBtn.textContent = 'Next →';
  nextBtn.addEventListener('click', () => navigateBlock(blockNum + 1));

  nav.append(prevBtn, nextBtn);
  return nav;
}

function navigateBlock(blockNum) {
  if (blockNum < 0) return;
  stopLive();
  fetchAndShowBlock(blockNum);
}

function handleSearch() {
  const raw = dom.explorerSearchInput.value.trim();
  if (!raw) return;
  stopLive();
  fetchAndShowBlock(raw.startsWith('0x') ? raw : Number(raw));
}

export function initBlockExplorer() {
  dom.explorerSearchBtn.addEventListener('click', handleSearch);
  dom.explorerSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch();
  });

  dom.explorerLiveBtn.addEventListener('click', () => {
    if (state.explorerLive) { stopLive(); } else { startLive(); }
  });

  dom.explorerBlockList.addEventListener('click', (e) => {
    const row = e.target.closest('.explorer-block-row');
    if (!row) return;
    stopLive();
    fetchAndShowBlock(row.dataset.hash);
  });

  document.addEventListener('keydown', (e) => {
    if (state.activeRoute !== ROUTES.EXPLORER) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const idx = state.explorerBlocks.findIndex(b => b.hash === state.explorerSelectedHash);
    if (idx === -1) return;

    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx < state.explorerBlocks.length - 1) {
        stopLive();
        fetchAndShowBlock(state.explorerBlocks[idx + 1].hash);
      }
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (idx > 0) {
        stopLive();
        fetchAndShowBlock(state.explorerBlocks[idx - 1].hash);
      }
    }
  });
}

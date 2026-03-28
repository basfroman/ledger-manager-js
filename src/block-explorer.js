import { ROUTES, MAX_EXPLORER_BLOCKS, ICON_COPY, ICON_CHECK, COPY_FEEDBACK_MS } from './constants.js';
import { buildCallDocHtml, formatDocs, getChainDecimals, getChainToken, truncAddr, copyToClipboard, escapeHtml } from './chain-utils.js';
import { state } from './state.js';
import { dom, setActiveRoute } from './ui.js';
import { selectExtrinsic } from './tx.js';
import { getContactName } from './address-book.js';

const ICON_FILTER = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';

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

  try {
    state.finalizedUnsub = await state.api.rpc.chain.subscribeFinalizedHeads((header) => {
      state.finalizedHead = header.number.toNumber();
      updateFinalityBadges();
    });
  } catch { /* finality subscription optional */ }
}

export function deactivateExplorer() {
  if (state.explorerUnsub) {
    state.explorerUnsub();
    state.explorerUnsub = null;
  }
  if (state.finalizedUnsub) {
    state.finalizedUnsub();
    state.finalizedUnsub = null;
  }
  state.finalizedHead = null;
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
      const prevFilter = dom.explorerDetailPane.querySelector('.explorer-filter-input');
      const savedFilter = prevFilter ? prevFilter.value : '';
      dom.explorerDetailPane.classList.remove('detail-refreshing');
      renderBlockDetail(signedBlock, eventsRaw, timestampRaw, blockHash);
      if (savedFilter) {
        const newFilter = dom.explorerDetailPane.querySelector('.explorer-filter-input');
        if (newFilter) {
          newFilter.value = savedFilter;
          newFilter.dispatchEvent(new Event('input'));
        }
      }
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

  const stickyHeader = document.createElement('div');
  stickyHeader.className = 'explorer-detail-header';

  const topRow = document.createElement('div');
  topRow.className = 'explorer-detail-toprow';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'btn-secondary btn-sm';
  prevBtn.textContent = '←';
  prevBtn.title = 'Previous block';
  prevBtn.addEventListener('click', () => { stopLive(); fetchAndShowBlock(blockNum - 1); });

  const titleEl = document.createElement('span');
  titleEl.className = 'explorer-block-title';
  titleEl.textContent = `Block #${blockNum.toLocaleString()}`;

  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn-secondary btn-sm';
  nextBtn.textContent = '→';
  nextBtn.title = 'Next block';
  nextBtn.addEventListener('click', () => { stopLive(); fetchAndShowBlock(blockNum + 1); });

  const tsDate = new Date(timestamp.toNumber());
  const metaEl = document.createElement('span');
  metaEl.className = 'explorer-block-meta-inline';
  metaEl.textContent = `${tsDate.toLocaleString()} · ${block.extrinsics.length} ext · ${events.length} events`;

  const finalityBadge = document.createElement('span');
  if (state.finalizedHead != null) {
    const isFinalized = blockNum <= state.finalizedHead;
    finalityBadge.className = `finality-badge ${isFinalized ? 'finality-badge-finalized' : 'finality-badge-pending'}`;
    finalityBadge.textContent = isFinalized ? 'Finalized' : 'Pending';
  }

  topRow.append(prevBtn, titleEl, nextBtn, finalityBadge, metaEl);

  const filterRow = document.createElement('div');
  filterRow.className = 'explorer-filter-row';
  const filterIcon = document.createElement('span');
  filterIcon.className = 'explorer-filter-icon';
  filterIcon.innerHTML = ICON_FILTER;
  const filterInput = document.createElement('input');
  filterInput.className = 'explorer-filter-input';
  filterInput.placeholder = 'Filter: transfer, Balances*, sudo...';
  const filterCount = document.createElement('span');
  filterCount.className = 'explorer-filter-count';
  filterRow.append(filterIcon, filterInput, filterCount);

  stickyHeader.append(topRow, filterRow);

  const container = document.createElement('div');

  container.appendChild(renderHeaderSection(header, blockHash));
  container.appendChild(renderExtrinsicsSection(block.extrinsics, events));
  const sysEvents = renderSystemEventsSection(events);
  if (sysEvents) container.appendChild(sysEvents);
  container.appendChild(renderDigestSection(header.digest.logs));

  dom.explorerDetailPane.innerHTML = '';
  dom.explorerDetailPane.appendChild(stickyHeader);
  dom.explorerDetailPane.appendChild(container);

  updateExplorerInsight({ type: 'block', blockNum, timestamp: tsDate, extrinsicCount: block.extrinsics.length, eventCount: events.length, digestCount: header.digest.logs.length, blockHash });

  filterInput.addEventListener('input', () => {
    applyDetailFilter(filterInput.value, container, filterCount);
  });
}

function renderHeaderSection(header, blockHash) {
  const { section, body } = collapsibleSection(ICON_HEADER, 'Header', { collapsed: false });

  const grid = document.createElement('div');
  grid.className = 'explorer-header-grid';

  const hashFields = [
    ['Block Hash', blockHash],
    ['Parent Hash', header.parentHash.toHex()],
    ['State Root', header.stateRoot.toHex()],
    ['Extrinsics Root', header.extrinsicsRoot.toHex()],
  ];

  for (const [label, value] of hashFields) {
    addKvRow(grid, label, makeHashEl(value, false));
  }

  try {
    addKvText(grid, 'Spec Version', state.api.runtimeVersion.specVersion.toString());
  } catch {}
  try {
    addKvText(grid, 'Digest Logs', `${header.digest.logs.length}`);
  } catch {}

  body.appendChild(grid);
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

  const cloneBtn = document.createElement('button');
  cloneBtn.className = 'btn-secondary btn-sm extrinsic-clone-btn';
  cloneBtn.textContent = '⎘ Clone';
  cloneBtn.title = 'Clone to Exec';
  cloneBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    cloneExtrinsicToExec(palletName, methodName, method);
  });

  headerEl.append(chevron, indexEl, methodEl, badge, cloneBtn);

  headerEl.addEventListener('click', () => {
    card.classList.toggle('expanded');
    chevron.style.transform = card.classList.contains('expanded') ? 'rotate(90deg)' : '';
    if (card.classList.contains('expanded') && state.api) {
      let docsHtml = '';
      try {
        const fn = state.api.tx[palletName]?.[methodName];
        if (fn?.meta) docsHtml = buildCallDocHtml(fn.meta, state.api.registry);
      } catch {}
      updateExplorerInsight({ type: 'extrinsic', pallet: palletName, method: methodName, signed: isSigned, docsHtml });
    }
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
    const signerAddr = ext.signer.toString();
    const signer = document.createElement('div');
    signer.className = 'extrinsic-signer';
    const signerLabel = document.createElement('span');
    signerLabel.className = 'extrinsic-signer-label';
    signerLabel.textContent = 'Signer: ';
    signer.appendChild(signerLabel);
    signer.appendChild(makeHashEl(signerAddr, false));
    const contactName = getContactName(signerAddr);
    if (contactName) {
      const tag = document.createElement('span');
      tag.className = 'address-tag';
      tag.textContent = contactName;
      signer.appendChild(tag);
    }
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
    if (card.classList.contains('expanded') && state.api) {
      let docsHtml = '';
      try {
        const evMeta = state.api.events[ev.event.section]?.[ev.event.method]?.meta;
        if (evMeta) {
          const rawDocs = evMeta.docs?.map(d => d.toString()) || [];
          docsHtml = formatDocs(rawDocs);
        }
      } catch {}
      updateExplorerInsight({ type: 'event', section: ev.event.section, method: ev.event.method, docsHtml });
    }
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

export function parseFilterTerms(query) {
  if (!query || !query.trim()) return [];
  return query.split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => {
      const pattern = t.replace(/[.*+?^${}()|[\]\\]/g, (m) => m === '*' ? '.*' : `\\${m}`);
      try { return new RegExp(pattern, 'i'); } catch { return null; }
    })
    .filter(Boolean);
}

export function applyDetailFilter(query, container, countEl) {
  const terms = parseFilterTerms(query);
  const sections = container.querySelectorAll('.explorer-section');
  let total = 0;
  let visible = 0;

  for (const section of sections) {
    const cards = section.querySelectorAll('.extrinsic-card');
    if (cards.length === 0) {
      section.style.display = '';
      continue;
    }

    let sectionVisible = 0;
    for (const card of cards) {
      total++;
      if (terms.length === 0) {
        card.style.display = '';
        sectionVisible++;
        visible++;
        continue;
      }
      const text = card.textContent;
      const match = terms.some(re => re.test(text));
      card.style.display = match ? '' : 'none';
      if (match) { sectionVisible++; visible++; }
    }

    const toggle = section.querySelector('.explorer-section-toggle');
    if (terms.length > 0 && sectionVisible === 0) {
      section.style.display = 'none';
    } else {
      section.style.display = '';
      if (sectionVisible > 0 && section.classList.contains('section-collapsed') && toggle) {
        toggle.click();
      }
    }
  }

  if (terms.length === 0) {
    countEl.textContent = '';
  } else {
    countEl.textContent = `${visible}/${total}`;
  }
}

export function updateExplorerInsight(info) {
  if (!dom.explorerDocs) return;
  let html = '';

  if (info.type === 'block') {
    html += '<div class="doc-summary">Block Summary</div>';
    html += '<div class="doc-section"><div class="doc-section-title">Details</div>';
    html += '<ul class="doc-list">';
    html += `<li><span class="doc-arg-name">Number</span> <span class="doc-arg-type">#${info.blockNum.toLocaleString()}</span></li>`;
    html += `<li><span class="doc-arg-name">Timestamp</span> <span class="doc-arg-type">${info.timestamp.toLocaleString()}</span></li>`;
    html += `<li><span class="doc-arg-name">Extrinsics</span> <span class="doc-arg-type">${info.extrinsicCount}</span></li>`;
    html += `<li><span class="doc-arg-name">Events</span> <span class="doc-arg-type">${info.eventCount}</span></li>`;
    html += `<li><span class="doc-arg-name">Digest Logs</span> <span class="doc-arg-type">${info.digestCount}</span></li>`;
    html += '</ul></div>';
  } else if (info.type === 'extrinsic') {
    html += `<div class="doc-summary">${escapeHtml(info.pallet)}.${escapeHtml(info.method)}</div>`;
    if (info.signed) {
      html += `<p class="doc-para">Signed extrinsic</p>`;
    } else {
      html += `<p class="doc-para">Inherent (unsigned)</p>`;
    }
    if (info.docsHtml) html += info.docsHtml;
  } else if (info.type === 'event') {
    html += `<div class="doc-summary">${escapeHtml(info.section)}.${escapeHtml(info.method)}</div>`;
    if (info.docsHtml) html += info.docsHtml;
  }

  if (html) {
    dom.explorerDocs.innerHTML = html;
    dom.explorerDocs.classList.remove('hidden');
  } else {
    dom.explorerDocs.textContent = '';
    dom.explorerDocs.classList.add('hidden');
  }
}

export function updateFinalityBadges() {
  if (state.finalizedHead == null) return;
  dom.explorerBlockList.querySelectorAll('.explorer-block-row').forEach(row => {
    const hash = row.dataset.hash;
    const block = state.explorerBlocks.find(b => b.hash === hash);
    if (block) {
      row.classList.toggle('finalized', block.number <= state.finalizedHead);
    }
  });
}

export function cloneExtrinsicToExec(pallet, method, callData) {
  setActiveRoute(ROUTES.COMPOSE);
  selectExtrinsic(pallet, method);
  try {
    const args = callData.toHuman();
    if (args && typeof args === 'object') {
      const inputs = dom.extrinsicArgs?.querySelectorAll('[data-arg-name]') ?? [];
      for (const input of inputs) {
        const name = input.dataset.argName;
        if (args[name] === undefined) continue;
        const val = args[name];
        if (typeof val === 'boolean') {
          const hidden = input.closest('.arg-bool-field')?.querySelector('input[type="hidden"]');
          if (hidden) {
            hidden.value = String(val);
            hidden.dispatchEvent(new Event('input'));
          }
        } else {
          input.value = typeof val === 'object' ? JSON.stringify(val) : String(val);
          input.dispatchEvent(new Event('input'));
        }
      }
    }
  } catch { /* toHuman can fail on exotic types */ }
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

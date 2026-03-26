import { COPY_FEEDBACK_MS, ICON_COPY, ICON_CHECK } from './constants.js';
import { copyToClipboard } from './chain-utils.js';

const $ = (id) => document.getElementById(id);

/** Populated by initDomRefs() (called from initUI); allows tests to mount HTML before binding. */
export const dom = {};

export function initDomRefs() {
  Object.assign(dom, {
    topRow: $('topRow'),
    networkPresetTrigger: $('networkPresetTrigger'),
    networkPresetDropdown: $('networkPresetDropdown'),
    customUrlWrap: $('customUrlWrap'),
    customUrl: $('customUrl'),
    connectBtn: $('connectBtn'),
    disconnectBtn: $('disconnectBtn'),
    networkStatus: $('networkStatus'),
    addDeviceBtn: $('addDeviceBtn'),
    loadAccountsBtn: $('loadAccountsBtn'),
    singleAccountIndex: $('singleAccountIndex'),
    loadSingleAccountBtn: $('loadSingleAccountBtn'),
    ledgerStatusEl: $('ledgerStatus'),
    deviceListBody: $('deviceListBody'),
    accountsBody: $('accountsBody'),
    accountsTitle: $('accountsTitle'),
    refreshBalancesBtn: $('refreshBalancesBtn'),
    fromAddress: $('fromAddress'),
    toAddress: $('toAddress'),
    amountInput: $('amount'),
    sendBtn: $('sendBtn'),
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
    transferPane: $('transferPane'),
    builderPane: $('builderPane'),
    txModeToggle: $('txModeToggle'),
    logCopyBtn: $('logCopyBtn'),
    resultCopyBtn: $('resultCopyBtn'),
    explorerLink: $('explorerLink'),
    explorerLinkLabel: $('explorerLinkLabel'),
  });
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
    if (wasHidden) positionDropdown(trigger, dropdown);
  });
  dropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('.custom-select-option');
    if (!opt) return;
    dropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    trigger.querySelector('.custom-select-label').textContent = opt.querySelector('.custom-select-label').textContent;
    dropdown.classList.add('hidden');
    onChange(opt.dataset.value);
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest(`#${wrapId}`)) dropdown.classList.add('hidden');
  });
}

export function populateCustomDropdown(trigger, dropdown, items, placeholder) {
  dropdown.innerHTML = '';
  for (const item of items) {
    const div = document.createElement('div');
    div.className = 'custom-select-option';
    div.dataset.value = item;
    div.innerHTML = `<span class="custom-select-label">${item}</span>`;
    dropdown.appendChild(div);
  }
  trigger.querySelector('.custom-select-label').textContent = placeholder;
  trigger.disabled = items.length === 0;
}

export function swapTopSections(swap) {
  const slideClass = swap ? 'swap-slide-out' : 'swap-slide-back';
  dom.topRow.classList.add(slideClass);
  setTimeout(() => {
    dom.topRow.querySelectorAll('section').forEach(s => { s.style.transition = 'none'; });
    dom.topRow.classList.remove(slideClass);
    dom.topRow.classList.toggle('swapped', swap);
    void dom.topRow.offsetHeight;
    dom.topRow.querySelectorAll('section').forEach(s => { s.style.transition = ''; });
  }, 420);
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
        ctx.shadowColor = '#6ec85c';
        ctx.shadowBlur = 12;
      } else {
        const g = 100 + (Math.random() * 155) | 0;
        ctx.fillStyle = `rgba(${30 + (Math.random() * 40) | 0}, ${g}, ${40 + (Math.random() * 30) | 0}, ${0.6 + Math.random() * 0.4})`;
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

export function initUI() {
  initDomRefs();
  dom.logCopyBtn.innerHTML = ICON_COPY;
  dom.resultCopyBtn.innerHTML = ICON_COPY;

  dom.txModeToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    for (const b of dom.txModeToggle.querySelectorAll('button')) {
      b.classList.toggle('active', b === btn);
    }
    dom.transferPane.classList.toggle('hidden', btn.dataset.mode !== 'transfer');
    dom.builderPane.classList.toggle('hidden', btn.dataset.mode !== 'builder');
  });

  dom.logCopyBtn.addEventListener('click', async () => {
    const ok = await copyToClipboard(dom.logPanel.textContent);
    if (ok) {
      dom.logCopyBtn.innerHTML = ICON_CHECK;
      setTimeout(() => { dom.logCopyBtn.innerHTML = ICON_COPY; }, COPY_FEEDBACK_MS);
    }
  });

  dom.resultCopyBtn.addEventListener('click', async () => {
    const ok = await copyToClipboard(dom.txResult.textContent);
    if (ok) {
      dom.resultCopyBtn.innerHTML = ICON_CHECK;
      setTimeout(() => { dom.resultCopyBtn.innerHTML = ICON_COPY; }, COPY_FEEDBACK_MS);
    }
  });
}

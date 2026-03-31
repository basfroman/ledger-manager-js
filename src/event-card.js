import { copyToClipboard } from './chain-utils.js';

const ICON_CHEVRON = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>';

export function renderEventCard(ev, { onExpand } = {}) {
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
      argsEl.textContent = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
      cardBody.appendChild(argsEl);
    }
  } catch {}

  headerEl.addEventListener('click', () => {
    card.classList.toggle('expanded');
    chevron.style.transform = card.classList.contains('expanded') ? 'rotate(90deg)' : '';
    if (card.classList.contains('expanded') && onExpand) {
      onExpand(ev);
    }
  });

  card.append(headerEl, cardBody);
  return card;
}

export function appendKvRow(parent, label, value) {
  const row = document.createElement('div');
  row.className = 'diagnostics-row';
  const k = document.createElement('span');
  k.className = 'diagnostics-key';
  k.textContent = label;
  const v = document.createElement('span');
  v.className = 'diagnostics-val copiable';
  v.textContent = String(value);
  v.addEventListener('click', async () => {
    const ok = await copyToClipboard(String(value));
    if (ok) {
      v.classList.add('copied');
      setTimeout(() => v.classList.remove('copied'), 600);
    }
  });
  row.append(k, v);
  parent.appendChild(row);
}

import { state } from './state.js';
import { dom, log, setupCustomDropdown } from './ui.js';
import { escapeHtml } from './chain-utils.js';
import { appendKvRow } from './event-card.js';

let decodeTypeHintValue = 'auto';

export function decodeHex(hex, typeHint) {
  if (!state.api || !hex) return null;
  const registry = state.api.registry;

  if (typeHint === 'extrinsic' || typeHint === 'auto') {
    try {
      const ext = registry.createType('Extrinsic', hex);
      return {
        kind: 'extrinsic',
        section: ext.method.section,
        method: ext.method.method,
        args: ext.method.toHuman(),
        isSigned: ext.isSigned,
        signer: ext.isSigned ? ext.signer.toString() : null,
        nonce: ext.isSigned ? ext.nonce.toString() : null,
        tip: ext.isSigned ? ext.tip.toString() : null,
      };
    } catch (e) {
      if (typeHint === 'extrinsic') throw e;
    }
  }

  if (typeHint === 'call' || typeHint === 'auto') {
    try {
      const call = registry.createType('Call', hex);
      const result = {
        kind: 'call',
        section: call.section,
        method: call.method,
        args: call.toHuman(),
      };
      if (call.section === 'utility' && (call.method === 'batch' || call.method === 'batchAll' || call.method === 'forceBatch')) {
        try {
          const calls = call.args[0];
          result.nestedCalls = calls.map(c => ({
            section: c.section,
            method: c.method,
            args: c.toHuman(),
          }));
        } catch {}
      }
      return result;
    } catch (e) {
      if (typeHint === 'call') throw e;
    }
  }

  throw new Error('Could not decode hex data');
}

export function renderDecodedResult(decoded, container) {
  container.innerHTML = '';
  if (!decoded) return;

  const card = document.createElement('div');
  card.className = 'diagnostics-card';

  const title = document.createElement('h3');
  title.className = 'decode-result-title';
  title.textContent = `${decoded.section}.${decoded.method}`;
  card.appendChild(title);

  const badge = document.createElement('span');
  badge.className = decoded.kind === 'extrinsic'
    ? 'extrinsic-badge extrinsic-badge-signed'
    : 'extrinsic-badge extrinsic-badge-inherent';
  badge.textContent = decoded.kind;
  card.appendChild(badge);

  if (decoded.isSigned && decoded.signer) {
    appendKvRow(card, 'Signer', decoded.signer);
    if (decoded.nonce) appendKvRow(card, 'Nonce', decoded.nonce);
    if (decoded.tip) appendKvRow(card, 'Tip', decoded.tip);
  }

  if (decoded.args && Object.keys(decoded.args).length > 0) {
    const argsEl = document.createElement('pre');
    argsEl.className = 'extrinsic-args mt-8';
    argsEl.textContent = JSON.stringify(decoded.args, null, 2);
    card.appendChild(argsEl);
  }

  if (decoded.nestedCalls?.length) {
    const label = document.createElement('div');
    label.className = 'xray-section-title';
    label.textContent = `Nested Calls (${decoded.nestedCalls.length})`;
    card.appendChild(label);
    for (const c of decoded.nestedCalls) {
      const row = document.createElement('div');
      row.className = 'diagnostics-row';
      row.textContent = `${c.section}.${c.method}`;
      card.appendChild(row);
    }
  }

  container.appendChild(card);
}

export function initHexDecoder() {
  setupCustomDropdown(
    dom.decodeTypeHintTrigger,
    dom.decodeTypeHintDropdown,
    'decodeTypeHintWrap',
    (value) => { decodeTypeHintValue = value; },
  );

  dom.decodeBtn.addEventListener('click', () => {
    const hex = dom.decodeInput.value.trim();
    if (!hex) return;
    try {
      const decoded = decodeHex(hex, decodeTypeHintValue);
      renderDecodedResult(decoded, dom.decodeResult);
      log(`Decoded: ${decoded.section}.${decoded.method} (${decoded.kind})`);
    } catch (err) {
      dom.decodeResult.innerHTML = `<div class="status-box status-err">${escapeHtml(err.message)}</div>`;
      log(`Decode error: ${err.message}`);
    }
  });

  dom.decodeInput.addEventListener('input', () => {
    dom.decodeBtn.disabled = !dom.decodeInput.value.trim() || !state.api;
  });
}

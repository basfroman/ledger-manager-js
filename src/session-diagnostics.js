import { copyToClipboard } from './chain-utils.js';

/**
 * Pure function — collects diagnostic info from state, no DOM access.
 * @param {object} st - application state
 * @returns {object} diagnostic data
 */
export function collectDiagnostics(st) {
  const data = {
    rpc: st.networkPresetValue || '—',
    accountSource: st.accountSource || '—',
    selectedAccount: st.selectedAccount?.address || '—',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '—',
  };
  if (st.api) {
    try {
      data.specVersion = st.api.runtimeVersion?.specVersion?.toNumber?.() ?? '—';
      data.genesisHash = st.api.genesisHash?.toHex?.() ?? '—';
      data.signedExtensions = JSON.stringify(st.api.registry?.signedExtensions ?? []);
    } catch {
      data.specVersion = '—';
      data.genesisHash = '—';
      data.signedExtensions = '—';
    }
  }
  return data;
}

/**
 * Renders key-value diagnostic card into a container.
 * @param {object} data - output of collectDiagnostics
 * @param {HTMLElement} container
 */
export function renderDiagnosticsDOM(data, container) {
  container.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'diagnostics-card';

  const title = document.createElement('h2');
  title.textContent = 'Session Info';
  card.appendChild(title);

  for (const [key, val] of Object.entries(data)) {
    const row = document.createElement('div');
    row.className = 'diagnostics-row';
    const k = document.createElement('span');
    k.className = 'diagnostics-key';
    k.textContent = key;
    const v = document.createElement('span');
    v.className = 'diagnostics-val';
    v.textContent = String(val);
    row.append(k, v);
    card.appendChild(row);
  }

  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-secondary btn-sm mt-8';
  copyBtn.textContent = 'Copy Snapshot';
  copyBtn.addEventListener('click', () => copyDiagnosticsSnapshot(data));
  card.appendChild(copyBtn);

  container.appendChild(card);
}

async function copyDiagnosticsSnapshot(data) {
  await copyToClipboard(JSON.stringify(data, null, 2));
}

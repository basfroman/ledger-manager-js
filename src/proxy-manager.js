import { state } from './state.js';
import { dom, log } from './ui.js';
import { truncAddr, escapeHtml } from './chain-utils.js';

export async function fetchProxies(address) {
  if (!state.api?.query?.proxy?.proxies) return [];
  try {
    const [proxies] = await state.api.query.proxy.proxies(address);
    return proxies.map(p => ({
      delegate: p.delegate.toString(),
      proxyType: p.proxyType.toString(),
      delay: p.delay.toNumber(),
    }));
  } catch {
    return [];
  }
}

export function renderProxyList(proxies, container) {
  container.innerHTML = '';
  if (!proxies.length) {
    container.innerHTML = '<div class="text-muted text-sm">No proxies found</div>';
    return;
  }
  container.classList.remove('hidden');

  const card = document.createElement('div');
  card.className = 'xray-card';

  const title = document.createElement('h3');
  title.className = 'xray-section-title';
  title.textContent = `Proxies (${proxies.length})`;
  card.appendChild(title);

  const table = document.createElement('table');
  table.innerHTML = '<thead><tr><th>Delegate</th><th>Type</th><th>Delay</th></tr></thead>';
  const tbody = document.createElement('tbody');

  for (const p of proxies) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td title="${escapeHtml(p.delegate)}">${truncAddr(p.delegate)}</td>
      <td>${escapeHtml(p.proxyType)}</td>
      <td>${p.delay}</td>
    `;
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  card.appendChild(table);
  container.appendChild(card);
}

export function initProxyManager() {
  dom.proxyExecCheck?.addEventListener('change', () => {
    const checked = dom.proxyExecCheck.checked;
    dom.proxyExecReal.disabled = !checked;
    if (!checked) dom.proxyExecReal.value = '';
  });
}

export async function showProxiesForAccount(address) {
  if (!address || !state.api) {
    dom.proxyManager.classList.add('hidden');
    return;
  }
  const proxies = await fetchProxies(address);
  renderProxyList(proxies, dom.proxyManager);
}

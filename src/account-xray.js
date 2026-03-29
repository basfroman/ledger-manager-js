import { state } from './state.js';
import { log } from './ui.js';
import { truncAddr } from './chain-utils.js';
import { RAO_PER_TAO } from './constants.js';
import { appendKvRow } from './event-card.js';

export async function fetchAccountProfile(address) {
  if (!state.api) return null;

  const profile = { address, balances: null, proxies: null, nonce: null };

  try {
    const account = await state.api.query.system.account(address);
    const d = account.data;
    profile.nonce = account.nonce.toNumber();
    profile.balances = {
      free: Number(d.free.toBigInt()) / Number(RAO_PER_TAO),
      reserved: Number(d.reserved.toBigInt()) / Number(RAO_PER_TAO),
      frozen: d.frozen ? Number(d.frozen.toBigInt()) / Number(RAO_PER_TAO) : 0,
    };
  } catch (err) {
    log(`X-Ray balance error: ${err.message}`);
  }

  try {
    if (state.api.query.proxy?.proxies) {
      const [proxies] = await state.api.query.proxy.proxies(address);
      profile.proxies = proxies.map(p => ({
        delegate: p.delegate.toString(),
        proxyType: p.proxyType.toString(),
        delay: p.delay.toNumber(),
      }));
    }
  } catch {}

  return profile;
}

export function renderAccountXRay(profile, container) {
  container.innerHTML = '';
  if (!profile) return;
  container.classList.remove('hidden');

  const card = document.createElement('div');
  card.className = 'xray-card';

  const title = document.createElement('h3');
  title.className = 'xray-section-title';
  title.textContent = 'Account X-Ray';
  card.appendChild(title);

  const addrRow = document.createElement('div');
  addrRow.className = 'diagnostics-row';
  addrRow.innerHTML = `<span class="diagnostics-key">Address</span><span class="diagnostics-val">${truncAddr(profile.address)}</span>`;
  card.appendChild(addrRow);

  if (profile.nonce != null) {
    appendKvRow(card, 'Nonce', String(profile.nonce));
  }

  if (profile.balances) {
    const b = profile.balances;
    appendKvRow(card, 'Free', `${b.free.toFixed(4)} TAO`);
    appendKvRow(card, 'Reserved', `${b.reserved.toFixed(4)} TAO`);
    appendKvRow(card, 'Frozen', `${b.frozen.toFixed(4)} TAO`);
  }

  if (profile.proxies?.length) {
    const proxTitle = document.createElement('div');
    proxTitle.className = 'xray-section-title';
    proxTitle.textContent = `Proxies (${profile.proxies.length})`;
    card.appendChild(proxTitle);

    for (const p of profile.proxies) {
      appendKvRow(card, truncAddr(p.delegate), `${p.proxyType} (delay: ${p.delay})`);
    }
  }

  container.appendChild(card);
}

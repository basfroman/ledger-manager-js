import { copyToClipboard, truncAddr } from './chain-utils.js';
import { HEALTH_POLL_MS } from './constants.js';

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

export async function fetchNonceInfo(api, address) {
  if (!api || !address) return null;
  try {
    const [nextIndex, account, pending] = await Promise.all([
      api.rpc.system.accountNextIndex(address),
      api.query.system.account(address),
      api.rpc.author.pendingExtrinsics(),
    ]);

    const myPending = pending.filter(tx => {
      try { return tx.signer.toString() === address; } catch { return false; }
    });

    return {
      onChainNonce: account.nonce.toNumber(),
      expectedNext: nextIndex.toNumber(),
      pendingCount: myPending.length,
      pendingTxs: myPending.map(tx => ({
        hash: tx.hash.toHex(),
        method: `${tx.method.section}.${tx.method.method}`,
      })),
    };
  } catch {
    return null;
  }
}

export function renderNonceInfo(info, container) {
  container.innerHTML = '';
  if (!info) return;

  const card = document.createElement('div');
  card.className = 'nonce-card';
  const title = document.createElement('h3');
  title.textContent = 'Nonce Info';
  card.appendChild(title);

  addDiagRow(card, 'On-chain nonce', String(info.onChainNonce));
  addDiagRow(card, 'Expected next', String(info.expectedNext));
  addDiagRow(card, 'Pending TXs', String(info.pendingCount));

  if (info.pendingTxs.length > 0) {
    for (const tx of info.pendingTxs) {
      addDiagRow(card, tx.method, tx.hash.slice(0, 18) + '…');
    }
  }

  container.appendChild(card);
}

let healthInterval = null;

export async function fetchChainHealth(api) {
  if (!api) return null;
  try {
    const [health, version, chain, props] = await Promise.all([
      api.rpc.system.health(),
      api.rpc.system.version(),
      api.rpc.system.chain(),
      api.rpc.system.properties(),
    ]);

    return {
      peers: health.peers.toNumber(),
      isSyncing: health.isSyncing.isTrue,
      version: version.toString(),
      chain: chain.toString(),
      ss58: props.ss58Format.isSome ? props.ss58Format.unwrap().toNumber() : null,
      decimals: props.tokenDecimals.isSome ? props.tokenDecimals.unwrap().map(d => d.toNumber()) : [],
      tokens: props.tokenSymbol.isSome ? props.tokenSymbol.unwrap().map(s => s.toString()) : [],
    };
  } catch {
    return null;
  }
}

export function renderChainHealth(health, container) {
  container.innerHTML = '';
  if (!health) return;

  const card = document.createElement('div');
  card.className = 'health-card';
  const title = document.createElement('h3');
  title.textContent = 'Chain Health';
  card.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'health-grid';

  const peerIndicator = health.peers > 0 ? 'health-ok' : 'health-err';
  addHealthRow(grid, 'Peers', `<span class="health-indicator ${peerIndicator}"></span>${health.peers}`);
  addHealthRow(grid, 'Syncing', health.isSyncing ? '<span class="health-indicator health-warn"></span>Yes' : '<span class="health-indicator health-ok"></span>No');
  addHealthRow(grid, 'Node', health.version);
  addHealthRow(grid, 'Chain', health.chain);
  if (health.ss58 != null) addHealthRow(grid, 'SS58', String(health.ss58));
  if (health.tokens.length) addHealthRow(grid, 'Token', health.tokens.join(', '));

  card.appendChild(grid);
  container.appendChild(card);
}

function addHealthRow(parent, label, value) {
  const row = document.createElement('div');
  row.className = 'diagnostics-row';
  const k = document.createElement('span');
  k.className = 'diagnostics-key';
  k.textContent = label;
  const v = document.createElement('span');
  v.className = 'diagnostics-val';
  v.innerHTML = value;
  row.append(k, v);
  parent.appendChild(row);
}

function addDiagRow(parent, label, value) {
  const row = document.createElement('div');
  row.className = 'diagnostics-row';
  const k = document.createElement('span');
  k.className = 'diagnostics-key';
  k.textContent = label;
  const v = document.createElement('span');
  v.className = 'diagnostics-val';
  v.textContent = value;
  row.append(k, v);
  parent.appendChild(row);
}

export function startHealthPolling(api, container) {
  stopHealthPolling();
  const poll = async () => {
    const health = await fetchChainHealth(api);
    renderChainHealth(health, container);
  };
  poll();
  healthInterval = setInterval(poll, HEALTH_POLL_MS);
}

export function stopHealthPolling() {
  if (healthInterval) {
    clearInterval(healthInterval);
    healthInterval = null;
  }
}

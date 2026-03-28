import { web3Accounts, web3Enable } from '@polkadot/extension-dapp';
import { copyToClipboard, truncAddr } from './chain-utils.js';
import { pushTimelineEvent } from './timeline.js';
import {
  LedgerManager,
  LEDGER_STATUS,
  classifyLedgerError,
  ledgerErrorMessage,
} from './ledger-manager.js';
import {
  ACCOUNT_SOURCE,
  CHAIN,
  COPY_FEEDBACK_MS,
  EXTENSION_DAPP_ORIGIN,
  EXTENSION_DISPLAY_LABELS,
  ICON_COPY,
  ICON_CHECK,
  LS_ACCOUNT_SOURCE,
  RAO_PER_TAO,
  ROUTES,
  SLIP44,
  SS58_PREFIX,
} from './constants.js';
import { LedgerGeneric, u8aToHex } from './deps.js';
import { state } from './state.js';
import { dom, initAccountSourceToggle, setActiveRoute, setLedgerStatus, setupCustomDropdown } from './ui.js';

/** Keys present in `window.injectedWeb3` (extensions that injected into the page). */
export function listInjectedExtensionKeys(win = typeof window !== 'undefined' ? window : globalThis) {
  return Object.keys(win.injectedWeb3 || {});
}

/**
 * Match user-picked injected key to an enabled extension `name` from `web3Enable` result.
 * @param {Array<{ name: string }>} enabled
 * @param {string} selectedKey
 */
export function resolveEnabledExtensionName(enabled, selectedKey) {
  if (!selectedKey || !Array.isArray(enabled) || enabled.length === 0) return null;
  const exact = enabled.find(e => e.name === selectedKey);
  if (exact) return exact.name;
  const lower = selectedKey.toLowerCase();
  const flex = enabled.find(e => e.name && (
    e.name.toLowerCase() === lower
    || selectedKey.includes(e.name)
    || e.name.includes(selectedKey)
  ));
  return flex?.name ?? null;
}

/** Pure merge + sort by accountIndex (testable). */
export function mergeAccountsData(existing, newAccounts) {
  const out = [...existing];
  for (const acct of newAccounts) {
    const idx = out.findIndex(a => a.accountIndex === acct.accountIndex);
    if (idx >= 0) out[idx] = acct;
    else out.push(acct);
  }
  out.sort((a, b) => a.accountIndex - b.accountIndex);
  return out;
}

/**
 * Maps extension-dapp accounts into the table row shape (testable).
 * @param {import('@polkadot/extension-inject/types').InjectedAccountWithMeta} account
 */
export function normalizeExtensionAccount(account, rowIndex) {
  const meta = account.meta || {};
  const label = meta.name || 'Account';
  const src = meta.source || 'extension';
  return {
    address: account.address,
    accountIndex: rowIndex,
    addressOffset: 0,
    derivationPath: `${src} · ${label}`,
    accountSource: ACCOUNT_SOURCE.WALLET,
  };
}

export function normalizeExtensionAccounts(injectedAccounts) {
  return injectedAccounts.map((a, i) => normalizeExtensionAccount(a, i));
}

export let monitor = null;

let onAccountsChanged = () => {};

export function initMonitor() {
  monitor = new LedgerManager({
    LedgerGeneric,
    chain: CHAIN,
    slip44: SLIP44,
    ss58Prefix: SS58_PREFIX,
    debug: true,
    onStatusChange(status, detail) {
      switch (status) {
        case LEDGER_STATUS.IDLE:
          setLedgerStatus('No device selected', 'neutral');
          syncLedgerLoadButtonsFromMonitor();
          break;
        case LEDGER_STATUS.NO_DEVICE:
          setLedgerStatus('Ledger is not connected. Plug in your device via USB.', 'warn');
          onDeviceBecameNotReady();
          break;
        case LEDGER_STATUS.LOCKED:
          setLedgerStatus('Ledger is locked. Enter your PIN to unlock the device.', 'warn');
          onDeviceBecameNotReady();
          break;
        case LEDGER_STATUS.APP_NOT_OPEN:
          setLedgerStatus('Polkadot app is not running on Ledger. Please open it.', 'warn');
          onDeviceBecameNotReady();
          break;
        case LEDGER_STATUS.READY: {
          const ver = detail.appVersion || '?';
          const firstReady = detail.previousStatus !== LEDGER_STATUS.READY;
          syncLedgerLoadButtonsFromMonitor();
          const suffix = state.accountsLoaded ? ` | ${state.lastLoadedAccounts.length} accounts loaded` : '';
          setLedgerStatus(`Device ready — Polkadot app v${ver}${suffix}`, 'ok');
          if (
            state.accountSource === ACCOUNT_SOURCE.LEDGER
            && firstReady
            && !state.accountsLoaded
          ) {
            dom.loadAccountsBtn.click();
          }
          break;
        }
      }
    },
    onDevicesChange(devices) {
      renderDeviceList(devices);
    },
  });
  monitor.start();
}

function syncLedgerLoadButtonsFromMonitor() {
  if (state.accountSource !== ACCOUNT_SOURCE.LEDGER || !monitor) {
    dom.loadAccountsBtn.disabled = true;
    dom.loadSingleAccountBtn.disabled = true;
    return;
  }
  const ready = monitor.status === LEDGER_STATUS.READY;
  dom.loadAccountsBtn.disabled = !ready;
  dom.loadSingleAccountBtn.disabled = !ready;
}

function onDeviceBecameNotReady() {
  if (state.accountSource !== ACCOUNT_SOURCE.LEDGER) {
    syncLedgerLoadButtonsFromMonitor();
    return;
  }
  state.accountsLoaded = false;
  syncLedgerLoadButtonsFromMonitor();
  clearAccountsTable();
}

const WALLET_EXT_PLACEHOLDER_CHOOSE = '— Choose extension —';
const WALLET_EXT_PLACEHOLDER_EMPTY = '— No extensions detected —';

function populateWalletExtensionDropdown() {
  const keys = listInjectedExtensionKeys();
  dom.walletExtensionDropdown.innerHTML = '';
  for (const key of [...keys].sort()) {
    const row = document.createElement('div');
    row.className = 'custom-select-option';
    row.dataset.value = key;
    row.setAttribute('role', 'option');
    const labelSpan = document.createElement('span');
    labelSpan.className = 'custom-select-label';
    labelSpan.textContent = EXTENSION_DISPLAY_LABELS[key] || key;
    const keySpan = document.createElement('span');
    keySpan.className = 'custom-select-url';
    keySpan.textContent = key;
    row.append(labelSpan, keySpan);
    dom.walletExtensionDropdown.appendChild(row);
  }
  const ph = keys.length ? WALLET_EXT_PLACEHOLDER_CHOOSE : WALLET_EXT_PLACEHOLDER_EMPTY;
  dom.walletExtensionTrigger.querySelector('.custom-select-label').textContent = ph;
  dom.walletExtensionTrigger.disabled = keys.length === 0;
  state.walletExtensionKey = null;
  dom.walletExtensionHint.textContent = keys.length
    ? `${keys.length} wallet extension(s) detected on this page. Pick one, then authorize.`
    : 'No Polkadot-compatible extension found. Install a wallet (e.g. Polkadot.js, SubWallet), refresh this page, and click Refresh list.';
  updateWalletLoadButtonState();
}

function updateWalletLoadButtonState() {
  if (!dom.loadExtensionAccountsBtn) return;
  const hasPick = Boolean(state.walletExtensionKey);
  dom.loadExtensionAccountsBtn.disabled = state.accountSource !== ACCOUNT_SOURCE.WALLET || !hasPick;
}

/** Sets `body[data-account-source]` for CSS theme (Ledger vs Wallet accent). */
export function syncAccountSourceThemeToBody() {
  document.body.dataset.accountSource = state.accountSource;
}

/** Show Ledger USB UI vs extension-only UI; sync button disabled state. */
export function applyAccountSourceUI() {
  const ledger = state.accountSource === ACCOUNT_SOURCE.LEDGER;
  dom.ledgerOnlyWrap.classList.toggle('hidden', !ledger);
  dom.walletOnlyWrap.classList.toggle('hidden', ledger);
  if (ledger) {
    syncLedgerLoadButtonsFromMonitor();
    if (!state.accountsLoaded) setLedgerStatus('No device selected', 'neutral');
  } else {
    dom.loadAccountsBtn.disabled = true;
    dom.loadSingleAccountBtn.disabled = true;
    populateWalletExtensionDropdown();
    if (!state.accountsLoaded) setLedgerStatus('Click Refresh to detect browser extensions', 'neutral');
  }
  const pathHeader = document.getElementById('pathColHeader');
  if (pathHeader) {
    pathHeader.textContent = ledger ? 'Derivation Path' : 'Wallet / Key name';
  }
  syncAccountSourceThemeToBody();
}

export function renderDeviceList(devices) {
  dom.deviceListBody.innerHTML = '';

  if (devices.length === 0) {
    dom.deviceListBody.innerHTML = '<tr><td colspan="2" class="text-muted">No authorized devices. Click "+ Add Device" to pair.</td></tr>';
    return;
  }

  for (const dev of devices) {
    const isSelected = dev.key === monitor.selectedDeviceKey;
    const tr = document.createElement('tr');
    tr.setAttribute('data-selectable', '');
    if (isSelected) tr.classList.add('selected');

    const nameTd = document.createElement('td');
    nameTd.textContent = dev.label;

    const actionTd = document.createElement('td');
    actionTd.classList.add('text-right');
    const forgetBtn = document.createElement('button');
    forgetBtn.className = 'btn-danger btn-sm';
    forgetBtn.textContent = 'Forget';
    forgetBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await monitor.forgetDevice(dev.key);
      } catch (err) {
        setLedgerStatus(`Failed to forget device: ${err.message}`, 'err');
      }
    });
    actionTd.appendChild(forgetBtn);

    tr.append(nameTd, actionTd);

    tr.addEventListener('click', () => {
      if (isSelected) {
        monitor.deselectDevice();
      } else {
        monitor.selectDevice(dev.key);
      }
    });

    dom.deviceListBody.appendChild(tr);
  }
}

export function clearAccountsTable() {
  dom.accountsTitle.textContent = 'Accounts';
  dom.accountsBody.innerHTML = '<tr><td colspan="5" class="text-muted">No accounts loaded</td></tr>';
  state.lastLoadedAccounts = [];
  state.selectedAccount = null;
  state.walletExtensionKey = null;
  state.accountsLoaded = false;
  dom.refreshBalancesBtn.disabled = true;
  dom.loadAccountsBtn.textContent = 'Load 5 Accounts';
  if (state.accountSource === ACCOUNT_SOURCE.WALLET && dom.walletExtensionTrigger) {
    populateWalletExtensionDropdown();
  } else {
    updateWalletLoadButtonState();
  }
  updateAccountsToolbar();
  onAccountsChanged();
}

export function mergeAccounts(newAccounts) {
  state.lastLoadedAccounts = mergeAccountsData(state.lastLoadedAccounts, newAccounts);
  renderAccounts(state.lastLoadedAccounts, true);
}

export function renderAccounts(accounts, animate = false) {
  dom.accountsTitle.textContent = accounts.length > 0 ? `Accounts (${accounts.length})` : 'Accounts';
  dom.accountsBody.innerHTML = '';
  for (let i = 0; i < accounts.length; i++) {
    const acct = accounts[i];
    const tr = document.createElement('tr');
    tr.setAttribute('data-selectable', '');
    if (animate) {
      tr.classList.add('fade-in');
      tr.style.animationDelay = `${i * 40}ms`;
    }
    if (state.selectedAccount?.address === acct.address) tr.classList.add('selected');
    const balStr = acct.balance != null ? acct.balance.toFixed(4) : '...';
    const pathCol = acct.accountSource === ACCOUNT_SOURCE.WALLET
      ? (acct.derivationPath || '—')
      : (acct.derivationPath || `m/44'/${SLIP44}'/${acct.accountIndex}'/0'/0'`);
    tr.innerHTML = `
      <td>${acct.accountIndex}</td>
      <td title="${acct.address}">${truncAddr(acct.address)}</td>
      <td>${pathCol}</td>
      <td>${balStr}</td>
      <td class="text-right">
        <button class="copy-btn" title="Copy address" data-copy="${acct.address}">${ICON_COPY}</button>
      </td>
    `;
    tr.addEventListener('click', () => {
      state.selectedAccount = acct;
      renderAccounts(state.lastLoadedAccounts);
      updateAccountsToolbar();
      onAccountsChanged();
    });
    const copyBtn = tr.querySelector('.copy-btn');
    copyBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = await copyToClipboard(copyBtn.dataset.copy);
      if (ok) {
        copyBtn.innerHTML = ICON_CHECK;
        setTimeout(() => { copyBtn.innerHTML = ICON_COPY; }, COPY_FEEDBACK_MS);
      }
    });
    dom.accountsBody.appendChild(tr);
  }
}

export async function fetchBalances(accounts) {
  if (!state.api || !accounts.length) return;
  dom.refreshBalancesBtn.disabled = true;
  dom.refreshBalancesBtn.textContent = 'Loading...';
  try {
    const addresses = accounts.map(a => a.address);
    const results = await state.api.query.system.account.multi(addresses);
    for (let i = 0; i < accounts.length; i++) {
      try {
        accounts[i].balance = Number(results[i].data.free.toBigInt()) / Number(RAO_PER_TAO);
      } catch {
        accounts[i].balance = null;
      }
    }
  } catch {
    for (const acct of accounts) acct.balance = null;
  }
  renderAccounts(state.lastLoadedAccounts);
  dom.refreshBalancesBtn.textContent = 'Refresh Balances';
  dom.refreshBalancesBtn.disabled = false;
}

export function updateAccountsToolbar() {
  dom.refreshBalancesBtn.disabled = !(state.api && state.lastLoadedAccounts.length);
}

async function handleLoadExtensionAccounts() {
  if (state.accountSource !== ACCOUNT_SOURCE.WALLET) return;
  const selectedKey = state.walletExtensionKey;
  if (!selectedKey) {
    setLedgerStatus('Choose a browser extension first.', 'err');
    return;
  }
  dom.loadExtensionAccountsBtn.disabled = true;
  setLedgerStatus('Requesting extension access...', 'busy');
  try {
    const enabled = await web3Enable(EXTENSION_DAPP_ORIGIN);
    const sourceName = resolveEnabledExtensionName(enabled, selectedKey);
    if (!sourceName) {
      setLedgerStatus(
        `Could not connect "${selectedKey}". Enabled: ${enabled.map(e => e.name).join(', ') || 'none'}.`,
        'err',
      );
      return;
    }
    state.walletExtensionKey = selectedKey;
    const all = await web3Accounts({ extensions: [sourceName] });
    let filtered = all;
    if (state.api) {
      const gh = state.api.genesisHash.toHex().replace(/^0x/i, '');
      filtered = all.filter((a) => {
        const g = a.meta?.genesisHash;
        if (g == null || g === '') return true;
        const aHex = typeof g === 'string'
          ? g.replace(/^0x/i, '')
          : (g.toHex?.() ?? u8aToHex(g)).replace(/^0x/i, '');
        return aHex === gh;
      });
    }
    const normalized = normalizeExtensionAccounts(filtered);
    state.lastLoadedAccounts = normalized;
    state.accountsLoaded = normalized.length > 0;
    renderAccounts(normalized, true);
    updateAccountsToolbar();
    if (normalized.length > 0) pushTimelineEvent('info', `${normalized.length} extension account(s) loaded`);
    if (normalized.length === 0) {
      setLedgerStatus(
        state.api
          ? 'No extension accounts for this network genesis (or none authorized).'
          : 'No accounts from extensions. Connect to a network first to filter by chain, or authorize accounts.',
        'warn',
      );
    } else {
      setLedgerStatus(`${normalized.length} extension account(s) loaded`, 'ok');
      if (state.api) {
        setLedgerStatus('Fetching balances...', 'busy');
        await fetchBalances(state.lastLoadedAccounts);
        setLedgerStatus(`${normalized.length} extension account(s) loaded`, 'ok');
      }
    }
    onAccountsChanged();
  } catch (err) {
    setLedgerStatus(err.message || String(err), 'err');
  } finally {
    updateWalletLoadButtonState();
  }
}

async function handleLoadLedgerBatch() {
  if (state.accountSource !== ACCOUNT_SOURCE.LEDGER) return;
  if (monitor.status !== LEDGER_STATUS.READY) {
    setLedgerStatus('Device is not ready.', 'err');
    return;
  }

  dom.loadAccountsBtn.disabled = true;
  dom.loadSingleAccountBtn.disabled = true;
  setLedgerStatus('Loading accounts from Ledger...', 'busy');

  try {
    const startIndex = state.lastLoadedAccounts.length > 0
      ? state.lastLoadedAccounts[state.lastLoadedAccounts.length - 1].accountIndex + 1
      : 0;
    const newAccounts = await monitor.getAccounts(5, {
      startIndex,
      onProgress({ current, total }) {
        setLedgerStatus(`Fetching account ${current}/${total} from Ledger...`, 'busy');
      },
    });

    mergeAccounts(newAccounts);
    state.accountsLoaded = true;
    dom.loadAccountsBtn.textContent = 'Load 5 More';
    setLedgerStatus(`Device ready | ${state.lastLoadedAccounts.length} accounts loaded`, 'ok');
    pushTimelineEvent('info', `${newAccounts.length} Ledger account(s) loaded`);
    updateAccountsToolbar();

    if (state.api) {
      setLedgerStatus('Fetching balances...', 'busy');
      await fetchBalances(state.lastLoadedAccounts);
      setLedgerStatus(`Device ready | ${state.lastLoadedAccounts.length} accounts loaded`, 'ok');
    }
  } catch (err) {
    const code = classifyLedgerError(err);
    setLedgerStatus(ledgerErrorMessage(code, err), 'err');
  } finally {
    dom.loadAccountsBtn.disabled = false;
    dom.loadSingleAccountBtn.disabled = false;
  }
}

async function handleLoadSingleLedgerAccount() {
  if (state.accountSource !== ACCOUNT_SOURCE.LEDGER) return;
  if (monitor.status !== LEDGER_STATUS.READY) {
    setLedgerStatus('Device is not ready.', 'err');
    return;
  }

  const idx = parseInt(dom.singleAccountIndex.value, 10);
  if (isNaN(idx) || idx < 0) {
    setLedgerStatus('Enter a valid account index (0 or higher).', 'err');
    return;
  }

  dom.loadAccountsBtn.disabled = true;
  dom.loadSingleAccountBtn.disabled = true;
  setLedgerStatus(`Fetching account #${idx} from Ledger...`, 'busy');

  try {
    const account = await monitor.getAccount(idx);

    mergeAccounts([account]);
    state.accountsLoaded = true;
    setLedgerStatus(`Device ready | ${state.lastLoadedAccounts.length} accounts loaded`, 'ok');
    pushTimelineEvent('info', `Ledger account #${idx} loaded`);
    updateAccountsToolbar();

    if (state.api) {
      setLedgerStatus(`Fetching balance for account #${idx}...`, 'busy');
      await fetchBalances([account]);
      setLedgerStatus(`Device ready | ${state.lastLoadedAccounts.length} accounts loaded`, 'ok');
    }
  } catch (err) {
    const code = classifyLedgerError(err);
    setLedgerStatus(ledgerErrorMessage(code, err), 'err');
  } finally {
    dom.loadAccountsBtn.disabled = false;
    dom.loadSingleAccountBtn.disabled = false;
  }
}

export function initAccounts({ onAccountsChanged: cb }) {
  onAccountsChanged = cb;

  initAccountSourceToggle((mode) => {
    const next = mode === ACCOUNT_SOURCE.WALLET ? ACCOUNT_SOURCE.WALLET : ACCOUNT_SOURCE.LEDGER;
    if (next === state.accountSource) return;

    const hadAccount = Boolean(state.selectedAccount);
    state.accountSource = next;
    try { localStorage.setItem(LS_ACCOUNT_SOURCE, next); } catch {}
    applyAccountSourceUI();

    if (!hadAccount) {
      clearAccountsTable();
      setActiveRoute(ROUTES.ACCOUNTS);
    }

    onAccountsChanged();
  });
  for (const b of dom.accountSourceToggle.querySelectorAll('button')) {
    b.classList.toggle('active', b.dataset.mode === state.accountSource);
  }
  applyAccountSourceUI();

  setupCustomDropdown(
    dom.walletExtensionTrigger,
    dom.walletExtensionDropdown,
    'walletExtensionWrap',
    (value) => {
      state.walletExtensionKey = value || null;
      updateWalletLoadButtonState();
    },
  );

  dom.addDeviceBtn.addEventListener('click', async () => {
    dom.addDeviceBtn.disabled = true;
    try {
      await monitor.requestDevice();
    } catch (err) {
      if (!err.message?.includes('cancelled') && !err.message?.includes('No device selected')) {
        setLedgerStatus(`Failed to add device: ${err.message}`, 'err');
      }
    } finally {
      dom.addDeviceBtn.disabled = false;
    }
  });

  dom.refreshExtensionsBtn.addEventListener('click', () => {
    if (state.accountSource !== ACCOUNT_SOURCE.WALLET) return;
    populateWalletExtensionDropdown();
  });

  dom.loadExtensionAccountsBtn.addEventListener('click', handleLoadExtensionAccounts);
  dom.loadAccountsBtn.addEventListener('click', handleLoadLedgerBatch);
  dom.loadSingleAccountBtn.addEventListener('click', handleLoadSingleLedgerAccount);

  dom.refreshBalancesBtn.addEventListener('click', () => {
    if (state.lastLoadedAccounts.length) fetchBalances(state.lastLoadedAccounts);
  });
}

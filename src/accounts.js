import { copyToClipboard, truncAddr } from './chain-utils.js';
import {
  LedgerManager,
  LEDGER_STATUS,
  classifyLedgerError,
  ledgerErrorMessage,
} from './ledger-manager.js';
import { CHAIN, COPY_FEEDBACK_MS, ICON_COPY, ICON_CHECK, RAO_PER_TAO, SLIP44, SS58_PREFIX } from './constants.js';
import { LedgerGeneric } from './deps.js';
import { state } from './state.js';
import { dom, setLedgerStatus } from './ui.js';

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
          dom.loadAccountsBtn.disabled = true;
          dom.loadSingleAccountBtn.disabled = true;
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
          dom.loadAccountsBtn.disabled = false;
          dom.loadSingleAccountBtn.disabled = false;
          const suffix = state.accountsLoaded ? ` | ${state.lastLoadedAccounts.length} accounts loaded` : '';
          setLedgerStatus(`Device ready — Polkadot app v${ver}${suffix}`, 'ok');
          if (firstReady && !state.accountsLoaded) dom.loadAccountsBtn.click();
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

function onDeviceBecameNotReady() {
  state.accountsLoaded = false;
  dom.loadAccountsBtn.disabled = true;
  dom.loadSingleAccountBtn.disabled = true;
  clearAccountsTable();
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
  dom.refreshBalancesBtn.disabled = true;
  dom.fromAddress.value = '';
  dom.loadAccountsBtn.textContent = 'Load 5 Accounts';
  updateSendButton();
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
    tr.innerHTML = `
      <td>${acct.accountIndex}</td>
      <td title="${acct.address}">${truncAddr(acct.address)}</td>
      <td>${acct.derivationPath || `m/44'/${SLIP44}'/${acct.accountIndex}'/0'/0'`}</td>
      <td>${balStr}</td>
      <td class="text-right">
        <button class="copy-btn" title="Copy address" data-copy="${acct.address}">${ICON_COPY}</button>
      </td>
    `;
    tr.addEventListener('click', () => {
      state.selectedAccount = acct;
      dom.fromAddress.value = acct.address;
      renderAccounts(state.lastLoadedAccounts);
      updateSendButton();
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
  for (const acct of accounts) {
    try {
      const { data } = await state.api.query.system.account(acct.address);
      acct.balance = Number(data.free.toBigInt()) / Number(RAO_PER_TAO);
    } catch {
      acct.balance = null;
    }
  }
  renderAccounts(state.lastLoadedAccounts);
  dom.refreshBalancesBtn.textContent = 'Refresh Balances';
  dom.refreshBalancesBtn.disabled = false;
}

export function updateSendButton() {
  dom.sendBtn.disabled = !(state.api && state.selectedAccount && dom.toAddress.value.trim() && dom.amountInput.value);
  dom.refreshBalancesBtn.disabled = !(state.api && state.lastLoadedAccounts.length);
}

export function initAccounts({ onAccountsChanged: cb }) {
  onAccountsChanged = cb;

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

  dom.loadAccountsBtn.addEventListener('click', async () => {
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
      updateSendButton();

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
  });

  dom.loadSingleAccountBtn.addEventListener('click', async () => {
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
      updateSendButton();

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
  });

  dom.refreshBalancesBtn.addEventListener('click', () => {
    if (state.lastLoadedAccounts.length) fetchBalances(state.lastLoadedAccounts);
  });

  dom.toAddress.addEventListener('input', updateSendButton);
  dom.amountInput.addEventListener('input', updateSendButton);
}

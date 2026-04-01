import { ACCOUNT_SOURCE } from './constants.js';
import {
  isApiConnected,
  hasSelectedAccount,
  hasPalletSelected,
  hasMethodSelected,
  hasPalletAndMethod,
} from './readiness.js';

/**
 * Pure data module — computes preflight checks from state, no DOM access.
 * @param {object} st - application state
 * @param {object|null} monitor - ledger monitor (has `device` property when device is connected)
 * @returns {Array<{id: string, label: string, status: 'pass'|'warn'|'fail', detail: string}>}
 */
export function computePreflight(st, monitor = null) {
  const checks = [];

  checks.push({
    id: 'apiConnected',
    label: 'API connected',
    status: isApiConnected(st) ? 'pass' : 'fail',
    detail: isApiConnected(st) ? 'Connected to RPC node' : 'Not connected',
  });

  checks.push({
    id: 'accountSelected',
    label: 'Account selected',
    status: hasSelectedAccount(st) ? 'pass' : 'fail',
    detail: st.selectedAccount ? st.selectedAccount.address : 'No account selected',
  });

  checks.push({
    id: 'palletSelected',
    label: 'Pallet selected',
    status: hasPalletSelected(st) ? 'pass' : 'fail',
    detail: st.palletSelectValue || 'No pallet selected',
  });

  checks.push({
    id: 'methodSelected',
    label: 'Method selected',
    status: hasMethodSelected(st) ? 'pass' : 'fail',
    detail: st.methodSelectValue || 'No method selected',
  });

  if (hasPalletAndMethod(st) && st.api?.tx?.[st.palletSelectValue]?.[st.methodSelectValue]) {
    const fn = st.api.tx[st.palletSelectValue][st.methodSelectValue];
    const argCount = fn.meta?.args?.length ?? 0;
    checks.push({
      id: 'argsValid',
      label: argCount > 0 ? `${argCount} argument(s) required` : 'No arguments required',
      status: 'pass',
      detail: argCount > 0 ? 'Fill in the argument fields' : 'Ready',
    });
  }

  if (st.accountSource === ACCOUNT_SOURCE.LEDGER && isApiConnected(st)) {
    const hasMetaHash = st.api.registry?.signedExtensions?.includes?.('CheckMetadataHash') ?? false;
    checks.push({
      id: 'ledgerMetadataSupport',
      label: 'Ledger metadata support',
      status: hasMetaHash ? 'pass' : 'fail',
      detail: hasMetaHash ? 'CheckMetadataHash supported' : 'Chain does not support CheckMetadataHash — Ledger signing impossible',
    });
  }

  return checks;
}

const STATUS_ICONS = { pass: '✓', warn: '⚠', fail: '✗' };

/**
 * Renders preflight check items into a container element.
 * @param {Array} checks - output of computePreflight
 * @param {HTMLElement} container - DOM element to render into
 */
export function renderPreflightDOM(checks, container) {
  container.innerHTML = '';
  if (checks.length === 0) return;
  for (const check of checks) {
    const div = document.createElement('div');
    div.className = 'preflight-check';
    const icon = document.createElement('span');
    icon.className = `preflight-icon state-${check.status}`;
    icon.textContent = STATUS_ICONS[check.status] || '?';
    const label = document.createElement('span');
    label.className = 'preflight-label';
    label.textContent = check.label;
    const detail = document.createElement('span');
    detail.className = 'preflight-detail';
    detail.textContent = check.detail;
    div.append(icon, label, detail);
    container.appendChild(div);
  }
}

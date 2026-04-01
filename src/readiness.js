/**
 * Pure readiness selectors — single source of truth for enable/disable and
 * preflight logic.  Every module that needs to know "is X ready?" should
 * import from here instead of re-deriving the condition locally.
 */

export function isApiConnected(st) {
  return Boolean(st.api);
}

export function hasLoadedAccounts(st) {
  return st.lastLoadedAccounts.length > 0;
}

export function isAccountsReady(st) {
  return isApiConnected(st) && hasLoadedAccounts(st);
}

export function hasSelectedAccount(st) {
  return Boolean(st.selectedAccount);
}

export function hasPalletSelected(st) {
  return Boolean(st.palletSelectValue);
}

export function hasMethodSelected(st) {
  return Boolean(st.methodSelectValue);
}

export function hasPalletAndMethod(st) {
  return hasPalletSelected(st) && hasMethodSelected(st);
}

export function isExtrinsicReady(st) {
  return isApiConnected(st) && hasSelectedAccount(st) && hasPalletAndMethod(st);
}

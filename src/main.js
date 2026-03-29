import './deps.js';

import { ACCOUNT_SOURCE, LS_ACCOUNT_SOURCE, LS_ACTIVE_ROUTE, ROUTES } from './constants.js';
import { state } from './state.js';
import { dom, initUI, syncPanelAvailability, setActiveRoute, updateTopBar, renderTimeline } from './ui.js';
import { initNetwork } from './network.js';
import { initMonitor, initAccounts, updateAccountsToolbar } from './accounts.js';
import { initTx, populatePallets, resetExtrinsicBuilder, updateExtrinsicSendButton } from './tx.js';
import { initQuery, populateQueryPallets, resetQueryBuilder, stopAllWatches } from './query.js';
import { initConstants, populateConstantPallets, resetConstantsViewer } from './constants-viewer.js';
import { buildPaletteIndex, initPalette } from './palette.js';
import { collectDiagnostics, renderDiagnosticsDOM, startHealthPolling, stopHealthPolling, fetchNonceInfo, renderNonceInfo } from './session-diagnostics.js';
import { initDrafts } from './drafts.js';
import { initBlockExplorer, activateExplorer, deactivateExplorer } from './block-explorer.js';
import { initBatch } from './batch.js';
import { initHexDecoder } from './hex-decoder.js';
import { initEventStream, stopEventStream } from './event-stream.js';
import { initAddressBook } from './address-book.js';
import { initMetadataBrowser, populateMetadata, resetMetadataBrowser } from './metadata-browser.js';
import { initProxyManager, showProxiesForAccount } from './proxy-manager.js';
import { fetchAccountProfile, renderAccountXRay } from './account-xray.js';

const savedRoute = localStorage.getItem(LS_ACTIVE_ROUTE);
if (savedRoute && Object.values(ROUTES).includes(savedRoute)) {
  state.activeRoute = savedRoute;
}
const savedSource = localStorage.getItem(LS_ACCOUNT_SOURCE);
if (savedSource === ACCOUNT_SOURCE.WALLET || savedSource === ACCOUNT_SOURCE.LEDGER) {
  state.accountSource = savedSource;
}

initUI();
initPalette();
initMonitor();
initDrafts();
initBlockExplorer();
initBatch();
initHexDecoder();
initEventStream();
initAddressBook();
initMetadataBrowser();
initProxyManager();

initAccounts({
  onAccountsChanged() {
    updateAccountsToolbar();
    updateExtrinsicSendButton();
    updateTopBar();
    syncPanelAvailability();
    renderTimeline();

    if (state.selectedAccount && state.api) {
      fetchAccountProfile(state.selectedAccount.address)
        .then(profile => renderAccountXRay(profile, dom.accountXRay))
        .catch(() => { dom.accountXRay.classList.add('hidden'); });
      fetchNonceInfo(state.api, state.selectedAccount.address)
        .then(info => renderNonceInfo(info, dom.nonceInfo))
        .catch(() => { dom.nonceInfo.innerHTML = ''; });
      showProxiesForAccount(state.selectedAccount.address)
        .catch(() => {});
    } else {
      dom.accountXRay.innerHTML = '';
      dom.accountXRay.classList.add('hidden');
      dom.proxyManager.innerHTML = '';
      dom.proxyManager.classList.add('hidden');
    }
  },
});

initNetwork({
  onConnected() {
    updateAccountsToolbar();
    updateTopBar();
    populatePallets(state.api);
    populateQueryPallets(state.api);
    populateConstantPallets(state.api);
    populateMetadata(state.api);
    buildPaletteIndex(state.api);
    syncPanelAvailability();
    renderTimeline();
    renderDiagnosticsDOM(collectDiagnostics(state), dom.diagnosticsCard);
    activateExplorer();
    startHealthPolling(state.api, dom.chainHealth);
    if (!state.accountsLoaded && state.activeRoute === ROUTES.COMPOSE) {
      setActiveRoute(ROUTES.ACCOUNTS);
    }
  },
  onDisconnected() {
    updateAccountsToolbar();
    updateTopBar();
    resetExtrinsicBuilder();
    resetQueryBuilder();
    resetConstantsViewer();
    resetMetadataBrowser();
    buildPaletteIndex(null);
    syncPanelAvailability();
    renderTimeline();
    dom.diagnosticsCard.innerHTML = '';
    deactivateExplorer();
    stopEventStream();
    stopAllWatches();
    stopHealthPolling();
    dom.chainHealth.innerHTML = '';
    dom.nonceInfo.innerHTML = '';
    dom.accountXRay.classList.add('hidden');
  },
});

initTx();
initQuery();
initConstants();

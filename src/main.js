import './deps.js';

import { ROUTES } from './constants.js';
import { state } from './state.js';
import { dom, initUI, syncPanelAvailability, setActiveRoute, updateTopBar, renderTimeline } from './ui.js';
import { initNetwork } from './network.js';
import { initMonitor, initAccounts, updateAccountsToolbar } from './accounts.js';
import { initTx, populatePallets, resetExtrinsicBuilder, updateExtrinsicSendButton } from './tx.js';
import { initQuery, populateQueryPallets, resetQueryBuilder } from './query.js';
import { initConstants, populateConstantPallets, resetConstantsViewer } from './constants-viewer.js';
import { buildPaletteIndex, initPalette } from './palette.js';
import { collectDiagnostics, renderDiagnosticsDOM } from './session-diagnostics.js';
import { initDrafts } from './drafts.js';
import { initBlockExplorer, activateExplorer, deactivateExplorer } from './block-explorer.js';

initUI();
initPalette();
initMonitor();
initDrafts();
initBlockExplorer();

initAccounts({
  onAccountsChanged() {
    updateAccountsToolbar();
    updateExtrinsicSendButton();
    updateTopBar();
    syncPanelAvailability();
    renderTimeline();
  },
});

initNetwork({
  onConnected() {
    updateAccountsToolbar();
    updateTopBar();
    populatePallets(state.api);
    populateQueryPallets(state.api);
    populateConstantPallets(state.api);
    buildPaletteIndex(state.api);
    syncPanelAvailability();
    renderTimeline();
    renderDiagnosticsDOM(collectDiagnostics(state), dom.diagnosticsCard);
    activateExplorer();
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
    buildPaletteIndex(null);
    syncPanelAvailability();
    renderTimeline();
    dom.diagnosticsCard.innerHTML = '';
    deactivateExplorer();
    setActiveRoute(ROUTES.COMPOSE);
  },
});

initTx();
initQuery();
initConstants();

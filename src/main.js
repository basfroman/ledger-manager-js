// Tao Forge — Bittensor chain interaction tool (extrinsics, queries, constants).
// Ledger: mode=1 (CheckMetadataHash) + merkle metadata proof (see Talisman #2180 / #2183).
// Wallet: browser extension via @polkadot/extension-dapp (standard signAsync, no merkle path here).

import './deps.js';

import { state } from './state.js';
import { initUI, syncPanelAvailability } from './ui.js';
import { initNetwork } from './network.js';
import { initMonitor, initAccounts, updateAccountsToolbar } from './accounts.js';
import { initTx, populatePallets, resetExtrinsicBuilder, updateExtrinsicSendButton } from './tx.js';
import { initQuery, populateQueryPallets, resetQueryBuilder } from './query.js';
import { initConstants, populateConstantPallets, resetConstantsViewer } from './constants-viewer.js';
import { buildPaletteIndex, initPalette } from './palette.js';

initUI();
initPalette();
initMonitor();

initAccounts({
  onAccountsChanged() {
    updateAccountsToolbar();
    updateExtrinsicSendButton();
    syncPanelAvailability();
  },
});

initNetwork({
  onConnected() {
    updateAccountsToolbar();
    populatePallets(state.api);
    populateQueryPallets(state.api);
    populateConstantPallets(state.api);
    buildPaletteIndex(state.api);
    syncPanelAvailability();
  },
  onDisconnected() {
    updateAccountsToolbar();
    resetExtrinsicBuilder();
    resetQueryBuilder();
    resetConstantsViewer();
    buildPaletteIndex(null);
    syncPanelAvailability();
  },
});

initTx();
initQuery();
initConstants();

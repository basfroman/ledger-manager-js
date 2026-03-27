// Ledger + Bittensor signing page.
// Ledger: mode=1 (CheckMetadataHash) + merkle metadata proof (see Talisman #2180 / #2183).
// Wallet: browser extension via @polkadot/extension-dapp (standard signAsync, no merkle path here).

import './deps.js';

import { state } from './state.js';
import { initUI, syncPanelAvailability } from './ui.js';
import { initNetwork } from './network.js';
import { initMonitor, initAccounts, updateAccountsToolbar } from './accounts.js';
import { initTx, populatePallets, resetExtrinsicBuilder, updateExtrinsicSendButton } from './tx.js';

initUI();
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
    syncPanelAvailability();
  },
  onDisconnected() {
    updateAccountsToolbar();
    resetExtrinsicBuilder();
    syncPanelAvailability();
  },
});

initTx();

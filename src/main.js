// Ledger + Bittensor signing page.
// Ledger: mode=1 (CheckMetadataHash) + merkle metadata proof (see Talisman #2180 / #2183).
// Wallet: browser extension via @polkadot/extension-dapp (standard signAsync, no merkle path here).

import './deps.js';

import { state } from './state.js';
import { initUI } from './ui.js';
import { initNetwork } from './network.js';
import { initMonitor, initAccounts, updateSendButton } from './accounts.js';
import { initTx, populatePallets, resetExtrinsicBuilder, updateExtrinsicSendButton } from './tx.js';

initUI();
initMonitor();

initAccounts({
  onAccountsChanged() {
    updateSendButton();
    updateExtrinsicSendButton();
  },
});

initNetwork({
  onConnected() {
    updateSendButton();
    populatePallets(state.api);
  },
  onDisconnected() {
    updateSendButton();
    resetExtrinsicBuilder();
  },
});

initTx();

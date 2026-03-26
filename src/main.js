// Ledger + Bittensor signing page.
// mode=1 (CheckMetadataHash) is ALWAYS ON when signing with Ledger.
// Metadata is capped at V15 — see Talisman issues #2180 / #2183.

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

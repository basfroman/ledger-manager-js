import { ACCOUNT_SOURCE, NETWORK_PRESETS } from './constants.js';

export const state = {
  api: null,
  selectedAccount: null,
  accountsLoaded: false,
  lastLoadedAccounts: [],
  accountSource: ACCOUNT_SOURCE.LEDGER,
  /** Selected `window.injectedWeb3` key before loading accounts (Wallet mode). */
  walletExtensionKey: null,
  networkPresetValue: NETWORK_PRESETS[0].url,
  palletSelectValue: '',
  methodSelectValue: '',
  qPalletSelectValue: '',
  qStorageSelectValue: '',
};

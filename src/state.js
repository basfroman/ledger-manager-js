import { NETWORK_PRESETS } from './constants.js';

export const state = {
  api: null,
  selectedAccount: null,
  accountsLoaded: false,
  lastLoadedAccounts: [],
  networkPresetValue: NETWORK_PRESETS[0].url,
  palletSelectValue: '',
  methodSelectValue: '',
};

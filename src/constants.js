/** Where accounts are loaded from and how transactions are signed. */
export const ACCOUNT_SOURCE = Object.freeze({
  LEDGER: 'ledger',
  WALLET: 'wallet',
});

/** Passed to `web3Enable` — appears in extension authorization UI. */
export const EXTENSION_DAPP_ORIGIN = 'tao-forge';

/** Friendly labels for `window.injectedWeb3` keys (fallback: raw key). */
export const EXTENSION_DISPLAY_LABELS = Object.freeze({
  'polkadot-js': 'Polkadot.js',
  'subwallet-js': 'SubWallet',
  'talisman': 'Talisman',
  'enkrypt': 'Enkrypt',
});

export const MSG_LEDGER_NO_METADATA_HASH =
  'This network does not support CheckMetadataHash. Ledger signing is impossible.';

export const SS58_PREFIX = 42;
export const SLIP44 = 0x00000162;
export const CHAIN = 'bittensor';
export const RAO_PER_TAO = 1_000_000_000n;

// build.rs hardcodes enable_metadata_hash("TAO", 9). Merkle params must match WASM, not chain properties.
export const MERKLE_DECIMALS = 9;
export const MERKLE_TOKEN = 'TAO';

export const ICON_COPY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
export const ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
export const COPY_FEEDBACK_MS = 1500;

/** Single source of truth for RPC presets (label + url; url === 'custom' for custom input). */
export const NETWORK_PRESETS = [
  { label: 'Latent', url: 'wss://lite.sub.latent.to:443' },
  { label: 'Latent (Archive)', url: 'wss://archive.sub.latent.to' },
  { label: 'Finney', url: 'wss://entrypoint-finney.opentensor.ai:443' },
  { label: 'Archive (Legacy)', url: 'wss://archive.chain.opentensor.ai:443' },
  { label: 'Testnet', url: 'wss://test.finney.opentensor.ai:443' },
  { label: 'Custom URL', url: 'custom' },
];

export const ROUTES = Object.freeze({
  COMPOSE: 'compose',
  DATA_HUB: 'dataHub',
  ACCOUNTS: 'accounts',
  DIAGNOSTICS: 'diagnostics',
});

export const ROUTE_TO_DOM_ID = Object.freeze({
  [ROUTES.COMPOSE]: 'routeCompose',
  [ROUTES.DATA_HUB]: 'routeDataHub',
  [ROUTES.ACCOUNTS]: 'routeAccounts',
  [ROUTES.DIAGNOSTICS]: 'routeDiagnostics',
});

export const MAX_TIMELINE_EVENTS = 500;
export const MAX_DRAFTS = 50;

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
export const ICON_REMOVE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
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
  EXPLORER: 'explorer',
  DIAGNOSTICS: 'diagnostics',
  SETTINGS: 'settings',
});

export const ROUTE_TO_DOM_ID = Object.freeze({
  [ROUTES.COMPOSE]: 'routeCompose',
  [ROUTES.DATA_HUB]: 'routeDataHub',
  [ROUTES.ACCOUNTS]: 'routeAccounts',
  [ROUTES.EXPLORER]: 'routeExplorer',
  [ROUTES.DIAGNOSTICS]: 'routeDiagnostics',
  [ROUTES.SETTINGS]: 'routeSettings',
});

export const MAX_TIMELINE_EVENTS = 500;
export const MAX_DRAFTS = 50;
export const MAX_EXPLORER_BLOCKS = 200;
export const MORTAL_ERA_PERIOD = 64;
export const MAX_WATCHES = 10;
export const MAX_BATCH_CALLS = 20;
export const MAX_ADDRESS_BOOK = 100;
export const HEALTH_POLL_MS = 10_000;
export const LS_LAST_ENDPOINT = 'tao-forge-last-endpoint';
export const LS_ACCOUNT_SOURCE = 'tao-forge-account-source';
export const LS_ACTIVE_ROUTE = 'tao-forge-active-route';
export const LS_ADDRESS_BOOK = 'tao-forge-address-book';
export const LS_ADDRESS_BOOK_VERSION = 1;
export const LS_DRAFTS = 'tao-forge-drafts';
export const LS_SELECTED_ACCOUNT = 'tao-forge-selected-account';
export const LS_INSIGHT_WIDTH = 'tao-forge-insight-width';
export const LS_TIMELINE_HEIGHT = 'tao-forge-timeline-height';
export const LS_ACCENT_THEME = 'tao-forge-accent-theme';

export const SIGNING_MODE_METADATA_HASH = 1;

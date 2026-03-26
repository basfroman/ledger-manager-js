# Ledger Manager — Bittensor

Standalone browser page for testing Ledger hardware wallet signing with Bittensor (Substrate) nodes.

## What it does

- Connects to any Bittensor node (mainnet, testnet, local) via WebSocket
- Pairs with Ledger devices over WebHID
- Loads accounts (derivation path `m/44'/354'/index'/0'/0'`)
- Builds `balances.transferKeepAlive` transactions, signs them on the Ledger, and submits to the connected node
- Detailed step-by-step logging of the full signing flow

## Setup

```bash
yarn install
yarn dev
```

Opens at `http://localhost:5173`. Chrome/Edge required (WebHID support).

## Project structure

| Path | Purpose |
|---|---|
| `index.html` | UI shell (Vite entry) |
| `src/main.js` | App bootstrap and module wiring |
| `src/styles.css` | Styles |
| `src/*.js` | Feature modules (`network`, `accounts`, `tx`, `ui`, `chain-utils`, `deps`, …) |
| `src/ledger-manager.js` | Reusable Ledger device manager (no DOM) |
| `tests/` | Vitest suites (`*.test.js`) and `tests/helpers/` for DOM fixtures |
| `vite.config.js` | Vite + Vitest config |

## `LedgerManager`

Framework-agnostic module with zero DOM dependencies. Handles:

- WebHID device discovery and authorization
- Periodic status polling (locked / app not open / ready)
- Race condition protection via generation counters
- HID handle cleanup after every operation
- Account derivation (`getAccount`, `getAccounts`)
- Signing (`signWithMetadata`)
- Device verification (`verifyDevice`)

Constructor takes `LedgerGeneric` class via dependency injection — no direct import of `@polkadot/hw-ledger` inside the module.

### Key methods

**`getAccount(index, options?)`** — derives a single account from the Ledger at the given index. Returns `{ address, publicKey, accountIndex, addressOffset, derivationPath }`.

**`getAccounts(count, options?)`** — derives multiple accounts. Accepts `onProgress({ current, total, accountIndex })` callback.

**`signWithMetadata(payloadBytes, metadataProof, accountIndex, addressOffset?)`** — signs an extrinsic payload with metadata proof (RFC-78). Returns the raw signature.

**`verifyDevice(accountIndex, expectedPublicKey, options?)`** — confirms the connected Ledger holds the expected key.

**`normalizeLedgerSignature(signature)`** — standalone export (not a class method). Converts a raw 64-byte ed25519 signature to Substrate's MultiSignature format by prepending the `0x00` Ed25519 type prefix.

**`withExclusiveAccess(fn)`** — non-re-entrant mutex. Pauses status polling, creates a `LedgerGeneric` instance, passes it to `fn`, closes the HID handle and resumes polling when done. Use for composing multiple operations in a single device session. Do not call `getAccount`/`signWithMetadata`/etc. inside the callback — they acquire their own session and will throw.

### Error codes (`LEDGER_ERROR`)

| Code | Meaning |
|---|---|
| `LEDGER_APP_NOT_OPEN` | Polkadot app not running |
| `LEDGER_LOCKED` | Device locked (PIN required) |
| `LEDGER_USER_REJECTED` | User rejected on device |
| `LEDGER_NO_DEVICE` | Device not connected |
| `LEDGER_DEVICE_BUSY` | Transport busy |
| `LEDGER_DEVICE_ALREADY_OPEN` | Another session holds the transport |
| `LEDGER_METADATA_MISMATCH` | Metadata digest rejected by firmware |
| `LEDGER_UNKNOWN` | Unclassified error |

## Important notes

**`metadata-hash` is required.** The Polkadot Generic Ledger app uses RFC-78 merkleized metadata for clear signing. The node must be compiled with `--features metadata-hash` so the runtime embeds the metadata hash for on-chain verification. Mainnet and testnet already have this. Local/custom nodes without it will reject transactions with `UnknownTransaction::CannotLookup`.

**Token symbol is hardcoded to `TAO`.** Subtensor's `build.rs` uses `enable_metadata_hash("TAO", 9)` regardless of the network. Some networks (e.g. testnet) report `testTAO` in chain properties, but the WASM hash is always computed with `TAO`. The tool matches this to avoid signature mismatches.

<img width="871" height="1177" alt="image" src="https://github.com/user-attachments/assets/84573cee-bcb0-40d2-9b61-79efe31f0d3f" />

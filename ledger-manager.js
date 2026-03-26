// Reusable Ledger device manager for Substrate/Polkadot chains.
// Zero DOM dependencies. Framework-agnostic.
//
// LedgerGeneric class is injected via constructor (dependency injection).
// Runtime requirement: browser with WebHID (navigator.hid).
// For signWithMetadata: globalThis.Buffer polyfill may be needed depending on
// @polkadot/hw-ledger internals (the method attempts Buffer.from() first,
// falls back to passing the Uint8Array directly).

const DEFAULT_VENDOR_ID = 0x2c97;
const DEFAULT_POLL_MS = 3000;
const DEFAULT_SS58_PREFIX = 42;
const DEFAULT_PROBE_WAIT_TIMEOUT_MS = 15000;

export const LEDGER_STATUS = Object.freeze({
  IDLE: 'idle',
  NO_DEVICE: 'no_device',
  LOCKED: 'locked',
  APP_NOT_OPEN: 'app_not_open',
  READY: 'ready',
});

export const LEDGER_ERROR = Object.freeze({
  APP_NOT_OPEN: 'LEDGER_APP_NOT_OPEN',
  USER_REJECTED: 'LEDGER_USER_REJECTED',
  LOCKED: 'LEDGER_LOCKED',
  DEVICE_BUSY: 'LEDGER_DEVICE_BUSY',
  DEVICE_ALREADY_OPEN: 'LEDGER_DEVICE_ALREADY_OPEN',
  NO_DEVICE: 'LEDGER_NO_DEVICE',
  METADATA_MISMATCH: 'LEDGER_METADATA_MISMATCH',
  UNKNOWN: 'LEDGER_UNKNOWN',
});

// Status codes (0x6xxx) are firmware-level and checked first.
// Text matching is the fallback for wrapper/transport errors.
export function classifyLedgerError(err) {
  const msg = String(err?.message ?? err ?? '').toLowerCase();
  const statusCode = err?.statusCode ?? err?.returnCode ?? null;

  if (statusCode !== null && statusCode >= 0x6d00 && statusCode <= 0x6e01) return LEDGER_ERROR.APP_NOT_OPEN;
  if (statusCode === 0x6985) return LEDGER_ERROR.USER_REJECTED;
  if (statusCode === 0x6982) return LEDGER_ERROR.LOCKED;
  if (statusCode === 0x6984) return LEDGER_ERROR.METADATA_MISMATCH;

  if (msg.includes('device is already open')) return LEDGER_ERROR.DEVICE_ALREADY_OPEN;
  if (msg.includes('is locked') || msg.includes('device locked') || msg === 'locked') return LEDGER_ERROR.LOCKED;
  if (msg.includes('wrong metadata digest') || msg.includes('metadata digest')) return LEDGER_ERROR.METADATA_MISMATCH;
  if (msg.includes('no device') || msg.includes('not found') || msg.includes('no authorized') || msg.includes('unable to claim')) return LEDGER_ERROR.NO_DEVICE;
  if (msg.includes('app') && (msg.includes('not open') || msg.includes('wrong') || msg.includes('does not seem'))) return LEDGER_ERROR.APP_NOT_OPEN;
  if (msg.includes('reject') || msg.includes('cancelled')) return LEDGER_ERROR.USER_REJECTED;
  if (msg.includes('busy') || msg.includes('transport status error') || msg.includes('failed to open')) return LEDGER_ERROR.DEVICE_BUSY;

  return LEDGER_ERROR.UNKNOWN;
}

// Returns a user-facing message for a LEDGER_ERROR code.
export function ledgerErrorMessage(code, raw) {
  switch (code) {
    case LEDGER_ERROR.APP_NOT_OPEN: return 'Polkadot app is not running on Ledger. Please open it.';
    case LEDGER_ERROR.USER_REJECTED: return 'Transaction rejected on Ledger device.';
    case LEDGER_ERROR.LOCKED: return 'Ledger is locked. Enter your PIN to unlock the device.';
    case LEDGER_ERROR.DEVICE_BUSY: return 'Ledger transport is busy. Wait a moment and retry.';
    case LEDGER_ERROR.DEVICE_ALREADY_OPEN: return 'Ledger transport is already open. Close other sessions and retry.';
    case LEDGER_ERROR.NO_DEVICE: return 'Ledger is not connected. Plug in your device via USB.';
    case LEDGER_ERROR.METADATA_MISMATCH: return 'Ledger rejected the metadata digest. The node may need to be rebuilt with metadata-hash.';
    default: return `Ledger error: ${raw?.message ?? raw}`;
  }
}

// Ledger returns a raw 64-byte ed25519 signature (128 hex chars).
// Substrate's MultiSignature expects a 0x00 prefix byte for Ed25519.
export function normalizeLedgerSignature(signature) {
  const sig = String(signature ?? '').trim().toLowerCase();
  if (/^0x[0-9a-f]{128}$/.test(sig)) return `0x00${sig.slice(2)}`;
  return sig;
}

// Unique per HIDDevice object instance via WeakMap.
// Two physically identical devices get different keys.
let _deviceSeq = 0;
const _deviceIdMap = new WeakMap();

function makeDeviceKey(transport, raw) {
  if (!_deviceIdMap.has(raw)) {
    _deviceIdMap.set(raw, _deviceSeq++);
  }
  return `${transport}:${raw.vendorId}:${raw.productId}:${_deviceIdMap.get(raw)}`;
}

function formatVersion(version) {
  return [version?.major, version?.minor, version?.patch]
    .filter(v => v != null).join('.');
}

function toDerivationPath(slip44, accountIndex, addressOffset) {
  return `m/44'/${slip44}'/${accountIndex}'/0'/${addressOffset}'`;
}

export function raceWithAbort(promise, signal) {
  if (!signal) return promise;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      if (signal.aborted) {
        reject(new DOMException('Operation was aborted', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', () => {
        reject(new DOMException('Operation was aborted', 'AbortError'));
      }, { once: true });
    }),
  ]);
}

// options:
//   LedgerGeneric        — (required) class from @polkadot/hw-ledger, injected to avoid hard dependency
//   chain                — (required) chain name registered in ledgerApps, e.g. 'bittensor'
//   slip44               — (required) SLIP-44 coin type, e.g. 0x162 (354) for Bittensor
//   ss58Prefix           — address encoding prefix, default 42 (generic Substrate)
//   vendorId             — USB vendor ID for device filtering, default 0x2c97 (Ledger)
//   pollIntervalMs       — how often to poll device status in ms, default 3000
//   exclusiveTimeoutMs   — default AbortSignal.timeout() for withExclusiveAccess, null = no timeout
//   debug                — enable console logging, default false
//   onStatusChange(status, detail) — called when device status changes (IDLE/LOCKED/READY/etc.)
//   onDevicesChange(devices)       — called when the list of authorized HID devices changes
export class LedgerManager {
  constructor(options) {
    if (!options?.LedgerGeneric) throw new Error('LedgerManager: LedgerGeneric class is required');
    if (!options.chain) throw new Error('LedgerManager: chain is required');
    if (options.slip44 == null) throw new Error('LedgerManager: slip44 is required');

    this._LedgerGeneric = options.LedgerGeneric;
    this._chain = options.chain;
    this._slip44 = options.slip44;
    this._ss58Prefix = options.ss58Prefix ?? DEFAULT_SS58_PREFIX;
    this._vendorId = options.vendorId ?? DEFAULT_VENDOR_ID;
    this._pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_MS;
    this._exclusiveTimeoutMs = options.exclusiveTimeoutMs ?? null;
    this._onStatusChange = options.onStatusChange ?? (() => {});
    this._onDevicesChange = options.onDevicesChange ?? (() => {});

    this._status = LEDGER_STATUS.IDLE;
    this._lastEmittedSnapshot = null;
    this._appVersion = null;
    this._devices = [];
    this._selectedDeviceKey = null;
    this._pollTimer = null;
    this._probing = false;
    this._paused = false;
    this._destroyed = false;
    this._exclusive = false;
    this._probeGen = 0;
    this._hidConnectHandler = () => this.refreshDevices();
    this._hidDisconnectHandler = () => this.refreshDevices();

    this._debug = Boolean(options.debug);
  }

  get status() { return this._status; }
  get devices() { return [...this._devices]; }
  get selectedDeviceKey() { return this._selectedDeviceKey; }
  get appVersion() { return this._appVersion; }
  get debug() { return this._debug; }
  set debug(v) { this._debug = Boolean(v); }

  // ── Lifecycle ──

  // Subscribes to WebHID connect/disconnect events and runs initial device scan.
  start() {
    if (this._destroyed) return;
    this.refreshDevices();
    navigator.hid?.addEventListener('connect', this._hidConnectHandler);
    navigator.hid?.addEventListener('disconnect', this._hidDisconnectHandler);
  }

  // Unsubscribes from WebHID events and stops polling.
  // Does not reset state — use destroy() for full cleanup.
  stop() {
    this._stopPolling();
    navigator.hid?.removeEventListener('connect', this._hidConnectHandler);
    navigator.hid?.removeEventListener('disconnect', this._hidDisconnectHandler);
  }

  // Full teardown. Stops polling, clears device list, invalidates
  // in-flight probes. Instance is unusable after this.
  destroy() {
    this.stop();
    this._destroyed = true;
    this._exclusive = false;
    this._paused = false;
    this._probing = false;
    this._devices = [];
    this._selectedDeviceKey = null;
    this._lastEmittedSnapshot = null;
    this._probeGen++;
    this._setStatus(LEDGER_STATUS.IDLE, {});
  }

  // Suspends status polling. Used internally by withExclusiveAccess.
  pause() {
    this._paused = true;
    this._log('polling paused');
  }

  // Resumes status polling. Restarts poll timer if it was killed.
  resume() {
    this._paused = false;
    this._log('polling resumed');
    if (this._selectedDeviceKey && !this._pollTimer) {
      this._startPolling();
    }
  }

  // ── Exclusive device access ──

  // Non-re-entrant mutex. Pauses polling, waits for any in-flight probe
  // to finish (they share the same HIDDevice — concurrent access corrupts
  // the transport), creates a LedgerGeneric instance and passes it to fn.
  // Closes HID handle and resumes polling in finally.
  //
  // The callback receives the LedgerGeneric instance directly.
  // For composition (multiple operations in one session), use this
  // method and call ledger.getAddress / ledger.signWithMetadata etc.
  // on the provided instance.
  //
  // Do NOT call getAccount/signWithMetadata/etc. inside the callback —
  // those methods acquire their own exclusive session and will throw.
  //
  // options.signal — AbortSignal for cancellation / timeout.
  //   AbortSignal.timeout(60000) for a 60s deadline,
  //   or new AbortController() for manual cancel (e.g. UI button).
  //   Falls back to constructor's exclusiveTimeoutMs if no signal given.
  //   On abort, the HID handle is closed (forcing the in-flight
  //   operation to fail) and polling resumes.
  async withExclusiveAccess(fn, { signal } = {}) {
    if (this._exclusive) {
      throw new Error(
        'LedgerManager: exclusive access is not re-entrant. ' +
        'Use the LedgerGeneric instance passed to the callback for multiple operations in one session.'
      );
    }
    const dev = this._findSelectedDevice();
    if (!dev) throw new Error('No device selected.');

    const effectiveSignal = signal
      ?? (this._exclusiveTimeoutMs ? AbortSignal.timeout(this._exclusiveTimeoutMs) : null);

    if (effectiveSignal?.aborted) {
      throw new DOMException('Operation was aborted', 'AbortError');
    }

    this._exclusive = true;
    this.pause();

    // _probe() and withExclusiveAccess both create LedgerGeneric instances
    // that open the same underlying HIDDevice. If a probe is in flight,
    // we must wait for it to close the device before opening a new session.
    let fnPromise;
    try {
      await raceWithAbort(this._waitForProbe(), effectiveSignal);

      const ledger = new this._LedgerGeneric(dev.transport, this._chain, this._slip44);
      fnPromise = fn(ledger);

      return await raceWithAbort(fnPromise, effectiveSignal);
    } catch (err) {
      fnPromise?.catch(() => {});
      throw err;
    } finally {
      this._exclusive = false;
      await this._closeDevice(dev);
      this.resume();
    }
  }

  // ── Device management ──

  // Opens the browser's HID device picker filtered to Ledger vendor.
  // Refreshes device list after pairing.
  async requestDevice() {
    if (!navigator.hid?.requestDevice) {
      throw new Error('WebHID is not available in this browser.');
    }
    const devices = await navigator.hid.requestDevice({
      filters: [{ vendorId: this._vendorId }],
    });
    if (!devices?.length) throw new Error('No device selected.');
    await this.refreshDevices();
  }

  // Rescans navigator.hid.getDevices().
  // Auto-deselects if the current device is no longer present.
  async refreshDevices() {
    if (this._destroyed) return;
    const devices = [];
    try {
      if (navigator.hid?.getDevices) {
        for (const d of await navigator.hid.getDevices()) {
          if (d.vendorId === this._vendorId) {
            const name = d.productName || 'Ledger';
            const pid = `0x${d.productId.toString(16).padStart(4, '0')}`;
            devices.push({
              raw: d,
              transport: 'hid',
              label: `${name} [${pid}]`,
              key: makeDeviceKey('hid', d),
            });
          }
        }
      }
    } catch (err) {
      this._log('refreshDevices error', { message: err.message });
    }

    this._devices = devices;
    this._log(`devices refreshed: ${devices.length} found`);

    if (this._selectedDeviceKey && !devices.find(d => d.key === this._selectedDeviceKey)) {
      this._log('selected device disappeared');
      this.deselectDevice();
    }

    this._onDevicesChange(this.devices);
  }

  // Revokes browser HID permission for a device. Deselects it if active.
  async forgetDevice(key) {
    const dev = this._devices.find(d => d.key === key);
    if (!dev) return;

    if (typeof dev.raw.forget !== 'function') {
      throw new Error('Browser does not support forget(). Remove permissions in browser settings.');
    }
    await dev.raw.forget();
    this._log(`device forgotten: ${key}`);

    if (key === this._selectedDeviceKey) {
      this.deselectDevice();
    }
    await this.refreshDevices();
  }

  // Activates a device for status polling.
  // Triggers immediate probe and starts poll timer.
  selectDevice(key) {
    if (key === this._selectedDeviceKey) return;
    const dev = this._devices.find(d => d.key === key);
    if (!dev) return;

    this._stopPolling();
    this._probeGen++;
    this._selectedDeviceKey = key;
    this._appVersion = null;
    this._lastEmittedSnapshot = null;
    this._log(`device selected: ${dev.label}`);
    this._setStatus(LEDGER_STATUS.IDLE, {});
    this._probe();
    this._startPolling();
  }

  // Stops polling and clears selection.
  // Resets _paused to prevent stuck state after abort mid-exclusive.
  deselectDevice() {
    this._stopPolling();
    this._probeGen++;
    this._selectedDeviceKey = null;
    this._appVersion = null;
    this._lastEmittedSnapshot = null;
    this._paused = false;
    this._log('device deselected');
    this._setStatus(LEDGER_STATUS.IDLE, {});
  }

  // Manual one-shot status check outside the regular poll cycle.
  async probeNow() {
    await this._probe();
  }

  // ── Account operations ──

  // Derives a single account from Ledger at the given BIP-44 index.
  async getAccount(accountIndex, { addressOffset = 0, ss58Prefix, confirm = false, signal } = {}) {
    const prefix = ss58Prefix ?? this._ss58Prefix;
    return this.withExclusiveAccess(async (ledger) => {
      const result = await ledger.getAddress(prefix, confirm, accountIndex, addressOffset);
      return this._makeAccountResult(result, accountIndex, addressOffset);
    }, { signal });
  }

  // Derives multiple sequential accounts. onProgress fires before each derivation.
  async getAccounts(count, { startIndex = 0, addressOffset = 0, ss58Prefix, onProgress, signal } = {}) {
    const prefix = ss58Prefix ?? this._ss58Prefix;
    return this.withExclusiveAccess(async (ledger) => {
      const accounts = [];
      for (let i = 0; i < count; i++) {
        const idx = startIndex + i;
        onProgress?.({ current: i + 1, total: count, accountIndex: idx });
        const result = await ledger.getAddress(prefix, false, idx, addressOffset);
        accounts.push(this._makeAccountResult(result, idx, addressOffset));
      }
      return accounts;
    }, { signal });
  }

  // Confirms the connected device holds the expected key
  // by deriving and comparing public keys.
  async verifyDevice(accountIndex, expectedPublicKey, { addressOffset = 0, ss58Prefix, confirm = false, signal } = {}) {
    const prefix = ss58Prefix ?? this._ss58Prefix;
    return this.withExclusiveAccess(async (ledger) => {
      const result = await ledger.getAddress(prefix, confirm, accountIndex, addressOffset);
      const account = this._makeAccountResult(result, accountIndex, addressOffset);
      const normalize = (pk) => String(pk ?? '').toLowerCase().replace(/^0x/, '');
      if (normalize(account.publicKey) !== normalize(expectedPublicKey)) {
        throw new Error('Wrong Ledger device: public key does not match expected key.');
      }
      return account;
    }, { signal });
  }

  // ── Signing ──

  // Signs a Substrate extrinsic payload with RFC-78 metadata proof.
  // Returns raw signature string (use normalizeLedgerSignature to add
  // the Ed25519 MultiSignature prefix before submitting).
  async signWithMetadata(payloadBytes, metadataProof, accountIndex, { addressOffset = 0, signal } = {}) {
    return this.withExclusiveAccess(async (ledger) => {
      const proofBuffer = (typeof Buffer !== 'undefined' && typeof Buffer.from === 'function')
        ? Buffer.from(metadataProof)
        : metadataProof;
      const result = await ledger.signWithMetadata(payloadBytes, accountIndex, addressOffset, {
        metadata: proofBuffer,
      });
      return result.signature;
    }, { signal });
  }

  // ── Internals ──

  // Normalizes LedgerGeneric.getAddress() response into a stable object.
  _makeAccountResult(ledgerResult, accountIndex, addressOffset) {
    return {
      address: ledgerResult.address,
      publicKey: ledgerResult.publicKey,
      accountIndex,
      addressOffset,
      derivationPath: toDerivationPath(this._slip44, accountIndex, addressOffset),
    };
  }

  _startPolling() {
    this._stopPolling();
    this._pollTimer = setInterval(() => this._probe(), this._pollIntervalMs);
  }

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  // Waits for an in-flight probe to release the HID device.
  // Rejects after DEFAULT_PROBE_WAIT_TIMEOUT_MS to prevent
  // indefinite hangs if the transport becomes unresponsive.
  async _waitForProbe() {
    if (!this._probing) return;
    this._log('waiting for in-flight probe to finish');
    return new Promise((resolve, reject) => {
      const start = Date.now();
      const interval = setInterval(() => {
        if (!this._probing) {
          clearInterval(interval);
          resolve();
        } else if (Date.now() - start > DEFAULT_PROBE_WAIT_TIMEOUT_MS) {
          clearInterval(interval);
          this._probing = false;
          this._log('_waitForProbe timed out, forcing reset');
          reject(new Error('Timed out waiting for device probe to complete. Please retry.'));
        }
      }, 10);
    });
  }

  // Single status check cycle. Creates a fresh LedgerGeneric, calls
  // getVersion, classifies the result into a LEDGER_STATUS.
  // Uses _probeGen to discard stale results after device change.
  async _probe() {
    if (this._destroyed || this._paused || this._probing) return;
    const dev = this._findSelectedDevice();
    if (!dev) return;

    const gen = this._probeGen;
    this._probing = true;
    try {
      const probe = new this._LedgerGeneric(dev.transport, this._chain, this._slip44);
      const version = await probe.getVersion();

      if (gen !== this._probeGen) return;

      if (version.isLocked) {
        this._appVersion = null;
        this._setStatus(LEDGER_STATUS.LOCKED, {});
        return;
      }

      const ver = formatVersion(version.version);
      this._appVersion = ver || null;
      this._setStatus(LEDGER_STATUS.READY, { appVersion: this._appVersion });
    } catch (err) {
      if (gen !== this._probeGen) return;

      const code = classifyLedgerError(err);
      this._log(`probe error: ${code}`, { message: err.message });

      switch (code) {
        case LEDGER_ERROR.APP_NOT_OPEN:
          this._appVersion = null;
          this._setStatus(LEDGER_STATUS.APP_NOT_OPEN, { error: err, errorCode: code });
          break;
        case LEDGER_ERROR.LOCKED:
          this._appVersion = null;
          this._setStatus(LEDGER_STATUS.LOCKED, { error: err, errorCode: code });
          break;
        case LEDGER_ERROR.NO_DEVICE:
          this._appVersion = null;
          this._setStatus(LEDGER_STATUS.NO_DEVICE, { error: err, errorCode: code });
          break;
        case LEDGER_ERROR.DEVICE_BUSY:
        case LEDGER_ERROR.DEVICE_ALREADY_OPEN:
          break;
        default:
          this._setStatus(this._status, { error: err, errorCode: code });
          break;
      }
    } finally {
      await this._closeDevice(dev);
      this._probing = false;
    }
  }

  // Closes the raw HID handle. Must be called after every LedgerGeneric
  // operation — leaving it open causes transport deadlocks on the next call.
  async _closeDevice(dev) {
    if (dev?.raw) {
      try { await dev.raw.close(); } catch {}
    }
  }

  _findSelectedDevice() {
    return this._devices.find(d => d.key === this._selectedDeviceKey) ?? null;
  }

  // Updates status and fires onStatusChange callback.
  // Snapshot-based dedup: same status + appVersion + errorCode
  // combination is only emitted once until something changes.
  // Blocked after destroy() (except final IDLE).
  _setStatus(newStatus, extra) {
    if (this._destroyed && newStatus !== LEDGER_STATUS.IDLE) return;

    const prev = this._status;
    this._status = newStatus;

    const snapshotKey = `${newStatus}|${this._appVersion ?? ''}|${extra.errorCode ?? ''}`;
    if (snapshotKey === this._lastEmittedSnapshot) return;
    this._lastEmittedSnapshot = snapshotKey;

    this._log(`status: ${prev} → ${newStatus}`);
    this._onStatusChange(newStatus, {
      previousStatus: prev,
      appVersion: this._appVersion,
      error: extra.error ?? null,
      errorCode: extra.errorCode ?? null,
    });
  }

  _log(msg, data) {
    if (!this._debug) return;
    const ts = new Date().toISOString().slice(11, 23);
    if (data !== undefined) {
      console.log(`[${ts}] [ledger-manager] ${msg}`, data);
    } else {
      console.log(`[${ts}] [ledger-manager] ${msg}`);
    }
  }
}

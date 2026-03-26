import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  LedgerManager,
  raceWithAbort,
  classifyLedgerError,
  LEDGER_ERROR,
} from '../src/ledger-manager.js';

function createHidDevice(overrides = {}) {
  return {
    vendorId: 0x2c97,
    productId: 0x4015,
    productName: 'Ledger Test',
    close: vi.fn().mockResolvedValue(undefined),
    forget: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/** @param {number} getVersionDelayMs */
function createLedgerClass(getVersionDelayMs = 0) {
  return class MockLedgerGeneric {
    constructor(_transport, _chain, _slip44) {
      this._transport = _transport;
    }

    async getVersion() {
      if (getVersionDelayMs > 0) {
        await new Promise((r) => setTimeout(r, getVersionDelayMs));
      }
      return { isLocked: false, version: { major: 1, minor: 0, patch: 0 } };
    }

    async getAddress() {
      return {
        address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        publicKey: '0x00',
      };
    }

    async signWithMetadata() {
      return { signature: '0x' + '00'.repeat(64) };
    }
  };
}

describe('raceWithAbort', () => {
  it('returns the same promise when signal is null', async () => {
    const p = Promise.resolve(42);
    const r = raceWithAbort(p, null);
    expect(r).toBe(p);
    expect(await r).toBe(42);
  });

  it('rejects immediately when signal is already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(raceWithAbort(new Promise(() => {}), ac.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('resolves with the operation result when operation finishes first', async () => {
    const ac = new AbortController();
    const r = raceWithAbort(Promise.resolve('ok'), ac.signal);
    expect(await r).toBe('ok');
  });

  it('rejects with AbortError when abort fires before operation', async () => {
    const ac = new AbortController();
    const slow = new Promise(() => {});
    const p = raceWithAbort(slow, ac.signal);
    ac.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('classifyLedgerError', () => {
  it('maps status 0x6984 to METADATA_MISMATCH', () => {
    expect(classifyLedgerError({ statusCode: 0x6984 })).toBe(LEDGER_ERROR.METADATA_MISMATCH);
  });
});

describe('LedgerManager', () => {
  beforeEach(() => {
    const d0 = createHidDevice({ productId: 0x1111 });
    const d1 = createHidDevice({ productId: 0x2222 });
    vi.stubGlobal('navigator', {
      hid: {
        getDevices: vi.fn().mockResolvedValue([d0, d1]),
        requestDevice: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('probing-reset: _probing clears after switching device during slow probe', async () => {
    const MockLedger = createLedgerClass(80);
    const manager = new LedgerManager({
      LedgerGeneric: MockLedger,
      chain: 'bittensor',
      slip44: 0x162,
      debug: false,
    });
    await manager.refreshDevices();
    const [k0, k1] = [manager.devices[0].key, manager.devices[1].key];
    manager.selectDevice(k0);
    await new Promise((r) => setTimeout(r, 10));
    expect(manager._probing).toBe(true);
    manager.selectDevice(k1);
    await new Promise((r) => setTimeout(r, 200));
    expect(manager._probing).toBe(false);
  });

  it('waitForProbe times out, rejects, and forces _probing false', async () => {
    vi.useFakeTimers();
    const manager = new LedgerManager({
      LedgerGeneric: createLedgerClass(0),
      chain: 'bittensor',
      slip44: 0x162,
      debug: false,
    });
    manager._probing = true;
    const p = manager._waitForProbe();
    await Promise.all([
      expect(p).rejects.toThrow('Timed out waiting for device probe to complete'),
      vi.advanceTimersByTimeAsync(20000),
    ]);
    expect(manager._probing).toBe(false);
  });

  it('destroy resets _probing, _exclusive, and _paused', () => {
    const manager = new LedgerManager({
      LedgerGeneric: createLedgerClass(0),
      chain: 'bittensor',
      slip44: 0x162,
    });
    manager._probing = true;
    manager._exclusive = true;
    manager._paused = true;
    manager.destroy();
    expect(manager._probing).toBe(false);
    expect(manager._exclusive).toBe(false);
    expect(manager._paused).toBe(false);
  });

  it('withExclusiveAccess returns callback result and clears _exclusive', async () => {
    const manager = new LedgerManager({
      LedgerGeneric: createLedgerClass(0),
      chain: 'bittensor',
      slip44: 0x162,
      debug: false,
    });
    await manager.refreshDevices();
    manager.selectDevice(manager.devices[0].key);
    await new Promise((r) => setTimeout(r, 150));
    expect(manager._probing).toBe(false);

    const result = await manager.withExclusiveAccess(async () => 42);
    expect(result).toBe(42);
    expect(manager._exclusive).toBe(false);
  });

  it('withExclusiveAccess aborts while waiting on _waitForProbe', async () => {
    const manager = new LedgerManager({
      LedgerGeneric: createLedgerClass(0),
      chain: 'bittensor',
      slip44: 0x162,
      debug: false,
    });
    await manager.refreshDevices();
    manager.selectDevice(manager.devices[0].key);
    manager._probing = true;

    const ac = new AbortController();
    const p = manager.withExclusiveAccess(async () => 1, { signal: ac.signal });
    queueMicrotask(() => ac.abort());

    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(manager._exclusive).toBe(false);
  });
});

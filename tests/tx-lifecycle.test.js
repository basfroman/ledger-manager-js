// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountAppShell } from './helpers/test-dom-shell.js';
import { initDomRefs } from '../src/ui.js';
import * as uiModule from '../src/ui.js';
import { broadcastSignedTx } from '../src/tx.js';
import { state } from '../src/state.js';

vi.spyOn(uiModule, 'matrixRain').mockImplementation(() => {});

beforeEach(() => {
  mountAppShell();
  initDomRefs();
  state.api = {
    events: { system: { ExtrinsicFailed: { is: () => false } } },
    rpc: { chain: { getHeader: vi.fn().mockResolvedValue({ number: { toNumber: () => 100 } }) } },
    genesisHash: { toHex: () => '0x0000' },
  };
});

function makeFakeSignedTx(sendCallback) {
  return {
    hash: { toHex: () => '0xabc123' },
    toHex: () => '0x1234',
    isSigned: true,
    signer: { toString: () => '5xxx' },
    version: 4,
    send: sendCallback,
  };
}

describe('broadcastSignedTx subscription cleanup', () => {
  it('calls unsub when InBlock resolves', async () => {
    const unsub = vi.fn();
    let capturedCb;

    const signedTx = makeFakeSignedTx((cb) => {
      capturedCb = cb;
      return Promise.resolve(unsub);
    });

    const resultPromise = broadcastSignedTx(signedTx);

    await vi.waitFor(() => expect(capturedCb).toBeDefined());

    capturedCb({
      status: { type: 'InBlock', isInBlock: true, asInBlock: { toHex: () => '0xblock' }, isReady: false, isBroadcast: false, isFinalized: false, isDropped: false, isInvalid: false, isUsurped: false, isRetracted: false, isFinalityTimeout: false },
      events: [],
      dispatchError: undefined,
    });

    const result = await resultPromise;
    expect(result.txHash).toBe('0xabc123');
    expect(unsub).toHaveBeenCalled();
  });

  it('calls unsub on dispatchError', async () => {
    const unsub = vi.fn();
    let capturedCb;

    const signedTx = makeFakeSignedTx((cb) => {
      capturedCb = cb;
      return Promise.resolve(unsub);
    });

    const resultPromise = broadcastSignedTx(signedTx);
    await vi.waitFor(() => expect(capturedCb).toBeDefined());

    capturedCb({
      status: { type: 'InBlock', isInBlock: true, asInBlock: { toHex: () => '0xb' }, isReady: false, isBroadcast: false, isFinalized: false, isDropped: false, isInvalid: false, isUsurped: false, isRetracted: false, isFinalityTimeout: false },
      dispatchError: { isModule: false, toString: () => 'BadOrigin' },
    });

    await expect(resultPromise).rejects.toThrow('On-chain error');
    expect(unsub).toHaveBeenCalled();
  });

  it('calls unsub on dropped status', async () => {
    const unsub = vi.fn();
    let capturedCb;

    const signedTx = makeFakeSignedTx((cb) => {
      capturedCb = cb;
      return Promise.resolve(unsub);
    });

    const resultPromise = broadcastSignedTx(signedTx);
    await vi.waitFor(() => expect(capturedCb).toBeDefined());

    capturedCb({
      status: { type: 'Dropped', isInBlock: false, isReady: false, isBroadcast: false, isFinalized: false, isDropped: true, isInvalid: false, isUsurped: false, isRetracted: false, isFinalityTimeout: false },
      dispatchError: undefined,
    });

    await expect(resultPromise).rejects.toThrow('dropped');
    expect(unsub).toHaveBeenCalled();
  });

  it('calls unsub on send() error', async () => {
    const unsub = vi.fn();

    const signedTx = makeFakeSignedTx(() => {
      return Promise.reject(new Error('WebSocket closed'));
    });

    await expect(broadcastSignedTx(signedTx)).rejects.toThrow('WebSocket closed');
  });
});

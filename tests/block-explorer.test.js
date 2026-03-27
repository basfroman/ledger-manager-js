// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountAppShell } from './helpers/test-dom-shell.js';
import { initDomRefs, dom } from '../src/ui.js';
import { state } from '../src/state.js';
import { ROUTES, MAX_EXPLORER_BLOCKS } from '../src/constants.js';
import {
  formatBalance,
  renderBlockList,
  activateExplorer,
  deactivateExplorer,
  startLive,
  stopLive,
  initBlockExplorer,
} from '../src/block-explorer.js';

beforeEach(() => {
  mountAppShell();
  initDomRefs();
  state.explorerBlocks = [];
  state.explorerSelectedHash = null;
  state.explorerLive = true;
  state.explorerUnsub = null;
  state.api = null;
  state.activeRoute = ROUTES.EXPLORER;
});

describe('formatBalance', () => {
  const mockApi = {
    registry: {
      chainDecimals: [9],
      chainTokens: ['TAO'],
    },
  };

  it('formats RAO to TAO with fractional part', () => {
    expect(formatBalance('1500000000', mockApi)).toBe('1.5 TAO');
  });

  it('formats whole TAO (no fraction)', () => {
    expect(formatBalance('1000000000', mockApi)).toBe('1 TAO');
  });

  it('formats zero', () => {
    expect(formatBalance('0', mockApi)).toBe('0 TAO');
  });

  it('formats small values', () => {
    expect(formatBalance('1', mockApi)).toBe('0.000000001 TAO');
  });

  it('returns raw string when api is null', () => {
    expect(formatBalance('12345', null)).toBe('12345');
  });

  it('handles null value', () => {
    expect(formatBalance(null, mockApi)).toBe('');
  });
});

describe('renderBlockList', () => {
  it('shows placeholder when no blocks', () => {
    state.explorerBlocks = [];
    renderBlockList();
    expect(dom.explorerBlockList.innerHTML).toContain('Waiting for blocks');
  });

  it('renders block rows from state', () => {
    state.explorerBlocks = [
      { number: 100, hash: '0xabc', extrinsicsCount: 3, receivedAt: Date.now() },
      { number: 99, hash: '0xdef', extrinsicsCount: 1, receivedAt: Date.now() - 5000 },
    ];
    renderBlockList();
    const rows = dom.explorerBlockList.querySelectorAll('.explorer-block-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('.explorer-block-num').textContent).toBe('#100');
    expect(rows[0].querySelector('.explorer-block-ext').textContent).toBe('3 ext');
    expect(rows[1].querySelector('.explorer-block-num').textContent).toBe('#99');
  });

  it('marks selected block row', () => {
    state.explorerBlocks = [
      { number: 100, hash: '0xabc', extrinsicsCount: 3, receivedAt: Date.now() },
      { number: 99, hash: '0xdef', extrinsicsCount: 1, receivedAt: Date.now() },
    ];
    state.explorerSelectedHash = '0xdef';
    renderBlockList();
    const rows = dom.explorerBlockList.querySelectorAll('.explorer-block-row');
    expect(rows[0].classList.contains('selected')).toBe(false);
    expect(rows[1].classList.contains('selected')).toBe(true);
  });
});

describe('activateExplorer / deactivateExplorer', () => {
  it('does nothing when api is null', async () => {
    state.api = null;
    await activateExplorer();
    expect(state.explorerUnsub).toBeNull();
  });

  it('subscribes when api exists', async () => {
    const unsubFn = vi.fn();
    state.api = {
      rpc: {
        chain: {
          subscribeNewHeads: vi.fn().mockResolvedValue(unsubFn),
        },
      },
    };
    await activateExplorer();
    expect(state.explorerUnsub).toBe(unsubFn);
    expect(state.api.rpc.chain.subscribeNewHeads).toHaveBeenCalledOnce();
  });

  it('deactivateExplorer clears state and calls unsub', () => {
    const unsub = vi.fn();
    state.explorerUnsub = unsub;
    state.explorerBlocks = [{ number: 1, hash: '0x1' }];
    state.explorerSelectedHash = '0x1';

    deactivateExplorer();

    expect(unsub).toHaveBeenCalledOnce();
    expect(state.explorerUnsub).toBeNull();
    expect(state.explorerBlocks).toHaveLength(0);
    expect(state.explorerSelectedHash).toBeNull();
    expect(dom.explorerBlockList.innerHTML).toContain('Connect to a node');
  });

  it('deactivateExplorer is safe when unsub is null', () => {
    state.explorerUnsub = null;
    expect(() => deactivateExplorer()).not.toThrow();
  });
});

describe('startLive / stopLive', () => {
  it('startLive sets state and updates button', () => {
    state.explorerLive = false;
    startLive();
    expect(state.explorerLive).toBe(true);
    expect(dom.explorerLiveBtn.classList.contains('btn-live-active')).toBe(true);
  });

  it('stopLive clears state and updates button', () => {
    state.explorerLive = true;
    dom.explorerLiveBtn.classList.add('btn-live-active');
    stopLive();
    expect(state.explorerLive).toBe(false);
    expect(dom.explorerLiveBtn.classList.contains('btn-live-active')).toBe(false);
  });
});

describe('initBlockExplorer', () => {
  it('binds search button click', () => {
    initBlockExplorer();
    expect(dom.explorerSearchBtn).toBeTruthy();
  });

  it('binds block list click delegation', () => {
    initBlockExplorer();
    state.explorerBlocks = [
      { number: 100, hash: '0xabc', extrinsicsCount: 3, receivedAt: Date.now() },
    ];
    renderBlockList();
    const row = dom.explorerBlockList.querySelector('.explorer-block-row');
    expect(row).toBeTruthy();
    expect(row.dataset.hash).toBe('0xabc');
  });
});

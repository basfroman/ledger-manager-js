// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountAppShell } from './helpers/test-dom-shell.js';
import { initDomRefs, dom } from '../src/ui.js';
import { state } from '../src/state.js';
import { ROUTES, MAX_EXPLORER_BLOCKS } from '../src/constants.js';
import {
  formatBalance,
  parseFilterTerms,
  applyDetailFilter,
  updateExplorerInsight,
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

describe('parseFilterTerms', () => {
  it('returns empty for blank input', () => {
    expect(parseFilterTerms('')).toEqual([]);
    expect(parseFilterTerms('  ')).toEqual([]);
    expect(parseFilterTerms(null)).toEqual([]);
  });

  it('splits by comma and creates case-insensitive regex', () => {
    const terms = parseFilterTerms('transfer, Balances');
    expect(terms).toHaveLength(2);
    expect(terms[0].test('Transfer')).toBe(true);
    expect(terms[1].test('balances')).toBe(true);
  });

  it('converts * to .* wildcard', () => {
    const terms = parseFilterTerms('System*');
    expect(terms).toHaveLength(1);
    expect(terms[0].test('System.ExtrinsicSuccess')).toBe(true);
    expect(terms[0].test('Balances.Transfer')).toBe(false);
  });

  it('handles mixed patterns', () => {
    const terms = parseFilterTerms('sudo, Balance*, timestamp');
    expect(terms).toHaveLength(3);
    expect(terms[1].test('Balances')).toBe(true);
    expect(terms[1].test('BalanceSet')).toBe(true);
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

describe('applyDetailFilter', () => {
  function buildContainer(cardTexts) {
    const container = document.createElement('div');
    const section = document.createElement('div');
    section.className = 'explorer-section';
    const toggle = document.createElement('div');
    toggle.className = 'explorer-section-toggle';
    section.appendChild(toggle);
    for (const text of cardTexts) {
      const card = document.createElement('div');
      card.className = 'extrinsic-card';
      card.textContent = text;
      section.appendChild(card);
    }
    container.appendChild(section);
    return container;
  }

  it('shows all cards when filter is empty', () => {
    const container = buildContainer(['Balances.Transfer', 'System.Remark', 'Sudo.sudo']);
    const count = document.createElement('span');
    applyDetailFilter('', container, count);
    const cards = container.querySelectorAll('.extrinsic-card');
    for (const c of cards) expect(c.style.display).toBe('');
    expect(count.textContent).toBe('');
  });

  it('hides non-matching cards and shows count', () => {
    const container = buildContainer(['Balances.Transfer', 'System.Remark', 'Sudo.sudo']);
    const count = document.createElement('span');
    applyDetailFilter('sudo', container, count);
    const cards = container.querySelectorAll('.extrinsic-card');
    expect(cards[0].style.display).toBe('none');
    expect(cards[1].style.display).toBe('none');
    expect(cards[2].style.display).toBe('');
    expect(count.textContent).toBe('1/3');
  });

  it('supports comma-separated patterns', () => {
    const container = buildContainer(['Balances.Transfer', 'System.Remark', 'Sudo.sudo']);
    const count = document.createElement('span');
    applyDetailFilter('Transfer, sudo', container, count);
    const cards = container.querySelectorAll('.extrinsic-card');
    expect(cards[0].style.display).toBe('');
    expect(cards[1].style.display).toBe('none');
    expect(cards[2].style.display).toBe('');
    expect(count.textContent).toBe('2/3');
  });

  it('hides entire section when no cards match', () => {
    const container = buildContainer(['Balances.Transfer', 'System.Remark']);
    const count = document.createElement('span');
    applyDetailFilter('nonexistent', container, count);
    const section = container.querySelector('.explorer-section');
    expect(section.style.display).toBe('none');
    expect(count.textContent).toBe('0/2');
  });
});

describe('updateExplorerInsight', () => {
  it('renders block summary into explorerDocs', () => {
    updateExplorerInsight({
      type: 'block',
      blockNum: 12345,
      timestamp: new Date('2025-01-01T00:00:00Z'),
      extrinsicCount: 10,
      eventCount: 20,
      digestCount: 3,
      blockHash: '0xabc',
    });
    expect(dom.explorerDocs.classList.contains('hidden')).toBe(false);
    expect(dom.explorerDocs.innerHTML).toContain('Block Summary');
    expect(dom.explorerDocs.innerHTML).toContain('12,345');
    expect(dom.explorerDocs.innerHTML).toContain('10');
    expect(dom.explorerDocs.innerHTML).toContain('20');
  });

  it('renders extrinsic info', () => {
    updateExplorerInsight({
      type: 'extrinsic',
      pallet: 'Balances',
      method: 'transferKeepAlive',
      signed: true,
      docsHtml: '<p>Transfer docs</p>',
    });
    expect(dom.explorerDocs.innerHTML).toContain('Balances.transferKeepAlive');
    expect(dom.explorerDocs.innerHTML).toContain('Signed extrinsic');
    expect(dom.explorerDocs.innerHTML).toContain('Transfer docs');
  });

  it('renders event info', () => {
    updateExplorerInsight({
      type: 'event',
      section: 'system',
      method: 'ExtrinsicSuccess',
      docsHtml: '<p>Success docs</p>',
    });
    expect(dom.explorerDocs.innerHTML).toContain('system.ExtrinsicSuccess');
    expect(dom.explorerDocs.innerHTML).toContain('Success docs');
  });

  it('hides panel when info is empty object', () => {
    updateExplorerInsight({});
    expect(dom.explorerDocs.classList.contains('hidden')).toBe(true);
  });
});

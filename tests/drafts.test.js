// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { state } from '../src/state.js';
import { MAX_DRAFTS } from '../src/constants.js';

vi.mock('../src/ui.js', () => ({
  dom: {},
  setActiveRoute: vi.fn(),
  setDataHubTab: vi.fn(),
}));
vi.mock('../src/tx.js', () => ({
  selectExtrinsic: vi.fn(),
}));
vi.mock('../src/query.js', () => ({
  selectQuery: vi.fn(),
}));
vi.mock('../src/constants-viewer.js', () => ({
  selectConstant: vi.fn(),
}));

const { saveDraft, loadDrafts, restoreDraft, deleteDraft, initDrafts } = await import('../src/drafts.js');
const { setActiveRoute, setDataHubTab } = await import('../src/ui.js');
const { selectExtrinsic } = await import('../src/tx.js');
const { selectQuery } = await import('../src/query.js');
const { selectConstant } = await import('../src/constants-viewer.js');

const STORAGE_KEY = 'tao-forge-drafts';

beforeEach(() => {
  state.drafts = [];
  localStorage.clear();
});

describe('saveDraft', () => {
  it('adds a draft with id, ts, and kind', () => {
    const draft = saveDraft('extrinsic', { pallet: 'Balances', method: 'transferKeepAlive' });
    expect(draft.id).toBeTruthy();
    expect(draft.ts).toBeGreaterThan(0);
    expect(draft.kind).toBe('extrinsic');
    expect(draft.pallet).toBe('Balances');
    expect(draft.method).toBe('transferKeepAlive');
    expect(state.drafts).toHaveLength(1);
  });

  it('persists to localStorage', () => {
    saveDraft('query', { pallet: 'System', item: 'account' });
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(raw.v).toBe(1);
    expect(raw.items).toHaveLength(1);
    expect(raw.items[0].pallet).toBe('System');
  });

  it('enforces MAX_DRAFTS cap with FIFO eviction', () => {
    for (let i = 0; i < MAX_DRAFTS + 5; i++) {
      saveDraft('extrinsic', { pallet: `P${i}`, method: 'x' });
    }
    expect(state.drafts).toHaveLength(MAX_DRAFTS);
    expect(state.drafts[0].pallet).toBe('P5');
  });
});

describe('loadDrafts', () => {
  it('returns empty array when nothing stored', () => {
    expect(loadDrafts()).toEqual([]);
  });

  it('loads valid versioned data', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      items: [{ id: 'x1', kind: 'extrinsic', pallet: 'Balances', method: 'transfer', ts: 123 }],
    }));
    const drafts = loadDrafts();
    expect(drafts).toHaveLength(1);
    expect(drafts[0].pallet).toBe('Balances');
  });

  it('clears and returns empty on version mismatch', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 999, items: [] }));
    expect(loadDrafts()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('clears and returns empty on corrupted JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{broken');
    expect(loadDrafts()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('clears and returns empty when items is not an array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, items: 'not-array' }));
    expect(loadDrafts()).toEqual([]);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});

describe('restoreDraft', () => {
  it('restores an extrinsic draft', () => {
    restoreDraft({ kind: 'extrinsic', pallet: 'Balances', method: 'transfer' });
    expect(setActiveRoute).toHaveBeenCalledWith('compose');
    expect(selectExtrinsic).toHaveBeenCalledWith('Balances', 'transfer');
  });

  it('restores a query draft', () => {
    restoreDraft({ kind: 'query', pallet: 'System', item: 'account' });
    expect(setActiveRoute).toHaveBeenCalledWith('dataHub');
    expect(setDataHubTab).toHaveBeenCalledWith('queryPane');
    expect(selectQuery).toHaveBeenCalledWith('System', 'account');
  });

  it('restores a constant draft', () => {
    restoreDraft({ kind: 'constant', pallet: 'Balances', item: 'existentialDeposit' });
    expect(setActiveRoute).toHaveBeenCalledWith('dataHub');
    expect(setDataHubTab).toHaveBeenCalledWith('constantsPane');
    expect(selectConstant).toHaveBeenCalledWith('Balances', 'existentialDeposit');
  });
});

describe('deleteDraft', () => {
  it('removes a draft by id and persists', () => {
    const d1 = saveDraft('extrinsic', { pallet: 'A', method: 'x' });
    const d2 = saveDraft('query', { pallet: 'B', item: 'y' });
    deleteDraft(d1.id);
    expect(state.drafts).toHaveLength(1);
    expect(state.drafts[0].id).toBe(d2.id);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(stored.items).toHaveLength(1);
  });

  it('does nothing for nonexistent id', () => {
    saveDraft('extrinsic', { pallet: 'X', method: 'x' });
    deleteDraft('nonexistent');
    expect(state.drafts).toHaveLength(1);
  });
});

describe('initDrafts', () => {
  it('loads drafts from localStorage into state', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      v: 1,
      items: [{ id: 'z1', kind: 'constant', pallet: 'C', item: 'c', ts: 1 }],
    }));
    initDrafts();
    expect(state.drafts).toHaveLength(1);
    expect(state.drafts[0].id).toBe('z1');
  });
});

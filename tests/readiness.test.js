// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import {
  isApiConnected,
  hasLoadedAccounts,
  isAccountsReady,
  hasSelectedAccount,
  hasPalletSelected,
  hasMethodSelected,
  hasPalletAndMethod,
  isExtrinsicReady,
} from '../src/readiness.js';

function makeState(overrides = {}) {
  return {
    api: null,
    lastLoadedAccounts: [],
    selectedAccount: null,
    palletSelectValue: '',
    methodSelectValue: '',
    ...overrides,
  };
}

describe('readiness selectors', () => {
  it('isApiConnected returns false when api is null', () => {
    expect(isApiConnected(makeState())).toBe(false);
  });

  it('isApiConnected returns true when api exists', () => {
    expect(isApiConnected(makeState({ api: {} }))).toBe(true);
  });

  it('hasLoadedAccounts returns false when empty', () => {
    expect(hasLoadedAccounts(makeState())).toBe(false);
  });

  it('hasLoadedAccounts returns true when accounts present', () => {
    expect(hasLoadedAccounts(makeState({ lastLoadedAccounts: [{ address: '5x' }] }))).toBe(true);
  });

  it('isAccountsReady requires both api and accounts', () => {
    expect(isAccountsReady(makeState())).toBe(false);
    expect(isAccountsReady(makeState({ api: {} }))).toBe(false);
    expect(isAccountsReady(makeState({ lastLoadedAccounts: [{ address: '5x' }] }))).toBe(false);
    expect(isAccountsReady(makeState({ api: {}, lastLoadedAccounts: [{ address: '5x' }] }))).toBe(true);
  });

  it('hasSelectedAccount checks for truthiness', () => {
    expect(hasSelectedAccount(makeState())).toBe(false);
    expect(hasSelectedAccount(makeState({ selectedAccount: { address: '5x' } }))).toBe(true);
  });

  it('hasPalletAndMethod requires both', () => {
    expect(hasPalletAndMethod(makeState())).toBe(false);
    expect(hasPalletAndMethod(makeState({ palletSelectValue: 'balances' }))).toBe(false);
    expect(hasPalletAndMethod(makeState({ methodSelectValue: 'transfer' }))).toBe(false);
    expect(hasPalletAndMethod(makeState({ palletSelectValue: 'balances', methodSelectValue: 'transfer' }))).toBe(true);
  });

  it('isExtrinsicReady is the AND of all prerequisites', () => {
    expect(isExtrinsicReady(makeState())).toBe(false);
    expect(isExtrinsicReady(makeState({
      api: {},
      selectedAccount: { address: '5x' },
      palletSelectValue: 'balances',
      methodSelectValue: 'transfer',
    }))).toBe(true);
  });

  it('isExtrinsicReady fails without selectedAccount', () => {
    expect(isExtrinsicReady(makeState({
      api: {},
      palletSelectValue: 'balances',
      methodSelectValue: 'transfer',
    }))).toBe(false);
  });
});

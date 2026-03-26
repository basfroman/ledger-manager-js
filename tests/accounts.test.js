// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from 'vitest';
import { mergeAccountsData, updateSendButton } from '../src/accounts.js';
import { mountAppShell } from './helpers/test-dom-shell.js';
import { initDomRefs, dom } from '../src/ui.js';
import { state } from '../src/state.js';

describe('mergeAccountsData', () => {
  it('merges new accounts and sorts by index', () => {
    const a = { accountIndex: 2, address: 'addr2' };
    const b = { accountIndex: 0, address: 'addr0' };
    expect(mergeAccountsData([], [a, b])).toEqual([b, a]);
  });

  it('replaces same accountIndex', () => {
    const existing = [{ accountIndex: 1, address: 'old' }];
    const updated = [{ accountIndex: 1, address: 'new' }];
    expect(mergeAccountsData(existing, updated)).toEqual([{ accountIndex: 1, address: 'new' }]);
  });
});

describe('updateSendButton', () => {
  beforeEach(() => {
    mountAppShell();
    initDomRefs();
    state.api = { rpc: {} };
    state.selectedAccount = { address: '5xxx' };
    state.lastLoadedAccounts = [{ accountIndex: 0 }];
    dom.toAddress.value = '5yyy';
    dom.amountInput.value = '1';
  });

  it('enables send when api, account, to, amount', () => {
    updateSendButton();
    expect(dom.sendBtn.disabled).toBe(false);
    expect(dom.refreshBalancesBtn.disabled).toBe(false);
  });

  it('disables send when missing amount', () => {
    dom.amountInput.value = '';
    updateSendButton();
    expect(dom.sendBtn.disabled).toBe(true);
  });
});

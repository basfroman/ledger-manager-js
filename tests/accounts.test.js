// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from 'vitest';
import {
  listInjectedExtensionKeys,
  mergeAccountsData,
  normalizeExtensionAccount,
  resolveEnabledExtensionName,
  updateSendButton,
} from '../src/accounts.js';
import { ACCOUNT_SOURCE } from '../src/constants.js';
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

describe('listInjectedExtensionKeys', () => {
  it('reads window.injectedWeb3 keys', () => {
    const win = { injectedWeb3: { 'polkadot-js': {}, 'subwallet-js': {} } };
    expect(listInjectedExtensionKeys(win).sort()).toEqual(['polkadot-js', 'subwallet-js']);
  });

  it('returns empty when missing', () => {
    expect(listInjectedExtensionKeys({})).toEqual([]);
  });
});

describe('resolveEnabledExtensionName', () => {
  it('matches exact name', () => {
    expect(resolveEnabledExtensionName([{ name: 'polkadot-js' }], 'polkadot-js')).toBe('polkadot-js');
  });

  it('returns null when no match', () => {
    expect(resolveEnabledExtensionName([{ name: 'a' }], 'unknown')).toBe(null);
  });

  it('flex-matches partial', () => {
    expect(resolveEnabledExtensionName([{ name: 'polkadot-js' }], 'polkadot-js-extra')).toBe('polkadot-js');
  });
});

describe('normalizeExtensionAccount', () => {
  it('maps meta to row shape', () => {
    const row = normalizeExtensionAccount({
      address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      meta: { name: 'Alice', source: 'polkadot-js' },
    }, 2);
    expect(row.address).toMatch(/^5/);
    expect(row.accountIndex).toBe(2);
    expect(row.addressOffset).toBe(0);
    expect(row.accountSource).toBe(ACCOUNT_SOURCE.WALLET);
    expect(row.derivationPath).toContain('polkadot-js');
    expect(row.derivationPath).toContain('Alice');
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

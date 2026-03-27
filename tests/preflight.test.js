// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from 'vitest';
import { computePreflight, renderPreflightDOM } from '../src/preflight.js';

function makeState(overrides = {}) {
  return {
    api: null,
    selectedAccount: null,
    palletSelectValue: '',
    methodSelectValue: '',
    accountSource: 'ledger',
    ...overrides,
  };
}

describe('computePreflight', () => {
  it('returns fail checks when disconnected', () => {
    const checks = computePreflight(makeState());
    expect(checks.find(c => c.id === 'apiConnected').status).toBe('fail');
    expect(checks.find(c => c.id === 'accountSelected').status).toBe('fail');
    expect(checks.find(c => c.id === 'palletSelected').status).toBe('fail');
    expect(checks.find(c => c.id === 'methodSelected').status).toBe('fail');
  });

  it('returns pass when all conditions met', () => {
    const mockApi = {
      tx: { balances: { transfer: { meta: { args: [] } } } },
      registry: { signedExtensions: ['CheckMetadataHash'] },
    };
    const st = makeState({
      api: mockApi,
      selectedAccount: { address: '5xxx' },
      palletSelectValue: 'balances',
      methodSelectValue: 'transfer',
    });
    const checks = computePreflight(st);
    expect(checks.find(c => c.id === 'apiConnected').status).toBe('pass');
    expect(checks.find(c => c.id === 'accountSelected').status).toBe('pass');
    expect(checks.find(c => c.id === 'palletSelected').status).toBe('pass');
    expect(checks.find(c => c.id === 'methodSelected').status).toBe('pass');
    expect(checks.find(c => c.id === 'argsValid').status).toBe('pass');
    expect(checks.find(c => c.id === 'ledgerMetadataSupport').status).toBe('pass');
  });

  it('flags ledger metadata unsupported', () => {
    const mockApi = {
      tx: {},
      registry: { signedExtensions: [] },
    };
    const st = makeState({ api: mockApi, accountSource: 'ledger' });
    const checks = computePreflight(st);
    const ledgerCheck = checks.find(c => c.id === 'ledgerMetadataSupport');
    expect(ledgerCheck).toBeDefined();
    expect(ledgerCheck.status).toBe('fail');
  });

  it('skips ledger check for wallet mode', () => {
    const mockApi = {
      tx: {},
      registry: { signedExtensions: [] },
    };
    const st = makeState({ api: mockApi, accountSource: 'wallet' });
    const checks = computePreflight(st);
    expect(checks.find(c => c.id === 'ledgerMetadataSupport')).toBeUndefined();
  });

  it('includes argsValid when method has arguments', () => {
    const mockApi = {
      tx: { balances: { transfer: { meta: { args: [{ name: 'dest' }, { name: 'value' }] } } } },
      registry: {},
    };
    const st = makeState({
      api: mockApi,
      selectedAccount: { address: '5xxx' },
      palletSelectValue: 'balances',
      methodSelectValue: 'transfer',
      accountSource: 'wallet',
    });
    const checks = computePreflight(st);
    const argsCheck = checks.find(c => c.id === 'argsValid');
    expect(argsCheck).toBeDefined();
    expect(argsCheck.label).toContain('2');
  });
});

describe('renderPreflightDOM', () => {
  it('renders checks into container', () => {
    const container = document.createElement('div');
    const checks = [
      { id: 'a', label: 'Check A', status: 'pass', detail: 'ok' },
      { id: 'b', label: 'Check B', status: 'fail', detail: 'bad' },
    ];
    renderPreflightDOM(checks, container);
    const items = container.querySelectorAll('.preflight-check');
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('.state-pass')).not.toBeNull();
    expect(items[1].querySelector('.state-fail')).not.toBeNull();
  });

  it('clears container when no checks', () => {
    const container = document.createElement('div');
    container.innerHTML = '<p>old</p>';
    renderPreflightDOM([], container);
    expect(container.innerHTML).toBe('');
  });
});

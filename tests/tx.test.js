// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from 'vitest';
import { createArgInput, updateExtrinsicSendButton } from '../src/tx.js';
import { mountAppShell } from './helpers/test-dom-shell.js';
import { initDomRefs, dom } from '../src/ui.js';
import { state } from '../src/state.js';

function mockRegistry() {
  return {
    lookup: {
      getTypeDef: () => ({ type: 'u32' }),
    },
  };
}

beforeEach(() => {
  mountAppShell();
  initDomRefs();
  state.api = { registry: mockRegistry() };
  state.selectedAccount = { address: '5xxx' };
  state.palletSelectValue = 'balances';
  state.methodSelectValue = 'transfer';
  dom.extrinsicArgs.innerHTML = '';
});

describe('createArgInput', () => {
  it('returns custom select for bool', () => {
    const el = createArgInput({ typeName: 'bool', name: 'f', type: 0 });
    expect(el.querySelector('.custom-select')).toBeTruthy();
    expect(el.querySelector('input[type="hidden"]')?.value).toBe('false');
    expect(el.querySelector('input[type="hidden"]')?.dataset.argName).toBe('f');
  });

  it('returns textarea for bytes', () => {
    const el = createArgInput({ typeName: 'Vec<u8>', name: 'b', type: 0 });
    expect(el.tagName).toBe('TEXTAREA');
  });

  it('returns input with numeric placeholder for u32', () => {
    const el = createArgInput({ typeName: 'u32', name: 'n', type: 0 });
    expect(el.tagName).toBe('INPUT');
    expect(el.placeholder).toBe('0');
  });
});

describe('updateExtrinsicSendButton', () => {
  it('disables when pallet missing', () => {
    state.palletSelectValue = '';
    updateExtrinsicSendButton();
    expect(dom.extrinsicSendBtn.disabled).toBe(true);
  });

  it('enables when no arg fields and pallet+method set', () => {
    state.palletSelectValue = 'balances';
    state.methodSelectValue = 'transfer_keep_alive';
    dom.extrinsicArgs.innerHTML = '';
    updateExtrinsicSendButton();
    expect(dom.extrinsicSendBtn.disabled).toBe(false);
  });
});

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from 'vitest';
import { updateExtrinsicSendButton } from '../src/tx.js';
import { mountAppShell } from './helpers/test-dom-shell.js';
import { initDomRefs, dom } from '../src/ui.js';
import { state } from '../src/state.js';

beforeEach(() => {
  mountAppShell();
  initDomRefs();
  state.api = { registry: { lookup: { getTypeDef: () => ({ type: 'u32' }) } } };
  state.selectedAccount = { address: '5xxx' };
  state.palletSelectValue = 'balances';
  state.methodSelectValue = 'transfer';
  dom.extrinsicArgs.innerHTML = '';
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

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from 'vitest';
import { initConstants, populateConstantPallets, resetConstantsViewer } from '../src/constants-viewer.js';
import { mountAppShell } from './helpers/test-dom-shell.js';
import { initDomRefs, dom } from '../src/ui.js';
import { state } from '../src/state.js';

function mockApi() {
  return {
    consts: {
      balances: {
        existentialDeposit: { meta: { docs: [] }, toHuman: () => '500000000' },
      },
      system: {
        blockHashCount: { meta: { docs: [] }, toHuman: () => 256 },
      },
    },
  };
}

beforeEach(() => {
  mountAppShell();
  initDomRefs();
  state.api = null;
  state.cPalletSelectValue = '';
  state.cConstantSelectValue = '';
});

describe('populateConstantPallets', () => {
  it('populates pallet dropdown with sorted keys', () => {
    const api = mockApi();
    populateConstantPallets(api);
    const options = dom.cPalletSelectDropdown.querySelectorAll('.custom-select-option');
    expect(options.length).toBe(2);
    expect(options[0].dataset.value).toBe('balances');
    expect(options[1].dataset.value).toBe('system');
    expect(dom.cPalletSelectTrigger.disabled).toBe(false);
  });
});

describe('resetConstantsViewer', () => {
  it('clears state, disables dropdowns, clears UI', () => {
    state.cPalletSelectValue = 'balances';
    state.cConstantSelectValue = 'existentialDeposit';
    dom.constantDocs.innerHTML = '<div>x</div>';

    resetConstantsViewer();

    expect(state.cPalletSelectValue).toBe('');
    expect(state.cConstantSelectValue).toBe('');
    expect(dom.cPalletSelectTrigger.disabled).toBe(true);
    expect(dom.cConstantSelectTrigger.disabled).toBe(true);
    expect(dom.constantDocs.textContent).toBe('');
    expect(dom.constantResultWrap.classList.contains('hidden')).toBe(true);
  });
});

describe('initConstants', () => {
  it('registers without throwing', () => {
    initConstants();
    expect(true).toBe(true);
  });
});

// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from 'vitest';
import { initQuery, populateQueryPallets, resetQueryBuilder } from '../src/query.js';
import { mountAppShell } from './helpers/test-dom-shell.js';
import { initDomRefs, dom } from '../src/ui.js';
import { state } from '../src/state.js';

function mockApi() {
  return {
    query: {
      system: Object.assign(
        { account: Object.assign(() => {}, { meta: { docs: [], type: { isPlain: false, isMap: true, asMap: { hashers: [{}], key: 0 } } } }) },
        { events: Object.assign(() => {}, { meta: { docs: [], type: { isPlain: true, isMap: false } } }) },
      ),
      balances: {
        totalIssuance: Object.assign(() => {}, { meta: { docs: [], type: { isPlain: true, isMap: false } } }),
      },
    },
    registry: {
      lookup: {
        getTypeDef: () => ({ type: 'AccountId32' }),
      },
    },
  };
}

beforeEach(() => {
  mountAppShell();
  initDomRefs();
  state.api = null;
  state.qPalletSelectValue = '';
  state.qStorageSelectValue = '';
});

describe('populateQueryPallets', () => {
  it('populates pallet dropdown with sorted keys', () => {
    const api = mockApi();
    populateQueryPallets(api);
    const options = dom.qPalletSelectDropdown.querySelectorAll('.custom-select-option');
    expect(options.length).toBe(2);
    expect(options[0].dataset.value).toBe('balances');
    expect(options[1].dataset.value).toBe('system');
    expect(dom.qPalletSelectTrigger.disabled).toBe(false);
  });
});

describe('resetQueryBuilder', () => {
  it('clears state, disables dropdowns, clears UI', () => {
    state.qPalletSelectValue = 'system';
    state.qStorageSelectValue = 'account';
    dom.queryKeys.innerHTML = '<div>test</div>';
    dom.queryResult.textContent = 'some result';

    resetQueryBuilder();

    expect(state.qPalletSelectValue).toBe('');
    expect(state.qStorageSelectValue).toBe('');
    expect(dom.qPalletSelectTrigger.disabled).toBe(true);
    expect(dom.qStorageSelectTrigger.disabled).toBe(true);
    expect(dom.queryKeys.innerHTML).toBe('');
    expect(dom.queryResult.textContent).toBe('');
    expect(dom.queryExecuteBtn.disabled).toBe(true);
  });
});

// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { createArgInput, collectInputValues } from '../src/arg-input.js';

function mockRegistry() {
  return {
    lookup: {
      getTypeDef: () => ({ type: 'u32' }),
    },
  };
}

describe('createArgInput', () => {
  it('returns custom select for bool', () => {
    const el = createArgInput({ typeName: 'bool', name: 'f', type: 0 }, mockRegistry());
    expect(el.querySelector('.custom-select')).toBeTruthy();
    expect(el.querySelector('input[type="hidden"]')?.value).toBe('false');
    expect(el.querySelector('input[type="hidden"]')?.dataset.argName).toBe('f');
  });

  it('returns textarea for bytes', () => {
    const el = createArgInput({ typeName: 'Vec<u8>', name: 'b', type: 0 }, mockRegistry());
    expect(el.tagName).toBe('TEXTAREA');
  });

  it('returns input with numeric placeholder for u32', () => {
    const el = createArgInput({ typeName: 'u32', name: 'n', type: 0 }, mockRegistry());
    expect(el.tagName).toBe('INPUT');
    expect(el.placeholder).toBe('0');
  });

  it('returns wrapper with input for AccountId', () => {
    const el = createArgInput({ typeName: 'AccountId', name: 'dest', type: 0 }, mockRegistry());
    expect(el.tagName).toBe('DIV');
    expect(el.classList.contains('address-autocomplete-wrap')).toBe(true);
    const input = el.querySelector('input');
    expect(input).toBeTruthy();
    expect(input.placeholder).toBe('5...');
    expect(input.dataset.argName).toBe('dest');
    const pickBtn = el.querySelector('.address-pick-btn');
    expect(pickBtn).toBeTruthy();
  });

  it('returns input with hash placeholder for H256', () => {
    const el = createArgInput({ typeName: 'H256', name: 'h', type: 0 }, mockRegistry());
    expect(el.tagName).toBe('INPUT');
    expect(el.placeholder).toBe('0x...');
  });

  it('uses default onChange without error', () => {
    const el = createArgInput({ typeName: 'u32', name: 'n', type: 0 }, mockRegistry());
    expect(el.tagName).toBe('INPUT');
  });
});

describe('collectInputValues', () => {
  it('collects values from input elements with data-arg-name', () => {
    const container = document.createElement('div');

    const input1 = document.createElement('input');
    input1.dataset.argName = 'amount';
    input1.dataset.argType = 'u64';
    input1.value = '12345';
    container.appendChild(input1);

    const input2 = document.createElement('input');
    input2.dataset.argName = 'flag';
    input2.dataset.argType = 'bool';
    input2.value = 'true';
    container.appendChild(input2);

    const result = collectInputValues(container);
    expect(result).toEqual(['12345', true]);
  });

  it('returns empty array for empty container', () => {
    const container = document.createElement('div');
    expect(collectInputValues(container)).toEqual([]);
  });
});

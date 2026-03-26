// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountAppShell } from './helpers/test-dom-shell.js';
import {
  initDomRefs,
  log,
  clearLog,
  setTxStatus,
  setLedgerStatus,
  setStatus,
  populateCustomDropdown,
  positionDropdown,
  swapTopSections,
  dom,
} from '../src/ui.js';

beforeEach(() => {
  mountAppShell();
  initDomRefs();
});

describe('ui log', () => {
  it('log appends timestamped line', () => {
    log('hello');
    expect(dom.logPanel.textContent).toMatch(/\[\d{2}:\d{2}:\d{2}\.\d{3}\] hello\n$/);
  });

  it('clearLog empties log panel', () => {
    log('a');
    clearLog();
    expect(dom.logPanel.textContent).toBe('');
  });
});

describe('ui status', () => {
  it('setTxStatus sets text and status class', () => {
    setTxStatus('Idle', 'neutral');
    expect(dom.txStatusEl.textContent).toBe('Idle');
    expect(dom.txStatusEl.className).toBe('status-box status-neutral');
  });

  it('setLedgerStatus uses mt-12', () => {
    setLedgerStatus('ok', 'ok');
    expect(dom.ledgerStatusEl.className).toBe('status-box mt-12 status-ok');
  });

  it('setStatus sets arbitrary element', () => {
    setStatus(dom.networkStatus, 'x', 'err');
    expect(dom.networkStatus.textContent).toBe('x');
    expect(dom.networkStatus.className).toBe('status-box mt-12 status-err');
  });
});

describe('populateCustomDropdown', () => {
  it('creates options and sets placeholder', () => {
    populateCustomDropdown(dom.palletSelectTrigger, dom.palletSelectDropdown, ['a', 'b'], '-- pick --');
    expect(dom.palletSelectDropdown.querySelectorAll('.custom-select-option')).toHaveLength(2);
    expect(dom.palletSelectTrigger.querySelector('.custom-select-label').textContent).toBe('-- pick --');
    expect(dom.palletSelectTrigger.disabled).toBe(false);
  });

  it('disables trigger when no items', () => {
    populateCustomDropdown(dom.palletSelectTrigger, dom.palletSelectDropdown, [], 'empty');
    expect(dom.palletSelectTrigger.disabled).toBe(true);
  });
});

describe('positionDropdown', () => {
  it('sets fixed position styles from trigger rect', () => {
    Object.defineProperty(dom.networkPresetTrigger, 'getBoundingClientRect', {
      value: () => ({ bottom: 100, left: 10, width: 200 }),
    });
    Object.defineProperty(dom.networkPresetDropdown, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });

    positionDropdown(dom.networkPresetTrigger, dom.networkPresetDropdown);
    expect(dom.networkPresetDropdown.style.top).toBe('104px');
    expect(dom.networkPresetDropdown.style.left).toBe('10px');
    expect(dom.networkPresetDropdown.style.width).toBe('200px');
  });
});

describe('swapTopSections', () => {
  it('adds swap-slide-out then toggles swapped after timeout', async () => {
    vi.useFakeTimers();
    swapTopSections(true);
    expect(dom.topRow.classList.contains('swap-slide-out')).toBe(true);
    vi.advanceTimersByTime(420);
    await Promise.resolve();
    expect(dom.topRow.classList.contains('swapped')).toBe(true);
    expect(dom.topRow.classList.contains('swap-slide-out')).toBe(false);
    vi.useRealTimers();
  });
});

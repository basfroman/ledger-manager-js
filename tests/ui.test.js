// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from 'vitest';
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
  syncPanelAvailability,
  parseAccentRgbTuple,
  initCopyButton,
  updateChainBlock,
  dom,
} from '../src/ui.js';
import { state } from '../src/state.js';

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

  it('adds search input when more than 10 items', () => {
    const items = Array.from({ length: 11 }, (_, i) => `item${i}`);
    populateCustomDropdown(dom.palletSelectTrigger, dom.palletSelectDropdown, items, '-- pick --');
    expect(dom.palletSelectDropdown.querySelector('.dd-search')).not.toBeNull();
  });

  it('does not add search input when 10 or fewer items', () => {
    const items = Array.from({ length: 10 }, (_, i) => `item${i}`);
    populateCustomDropdown(dom.palletSelectTrigger, dom.palletSelectDropdown, items, '-- pick --');
    expect(dom.palletSelectDropdown.querySelector('.dd-search')).toBeNull();
  });
});

describe('initCopyButton', () => {
  it('copies source text on click', async () => {
    const btn = document.createElement('button');
    const pre = document.createElement('pre');
    pre.textContent = 'hello-copy';
    document.body.append(btn, pre);
    initCopyButton(btn, pre);
    btn.click();
    expect(await navigator.clipboard.readText()).toBe('hello-copy');
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

describe('parseAccentRgbTuple', () => {
  it('parses comma-separated RGB', () => {
    expect(parseAccentRgbTuple('232, 148, 60')).toEqual({ r: 232, g: 148, b: 60 });
  });

  it('returns ledger fallback on invalid input', () => {
    expect(parseAccentRgbTuple('')).toEqual({ r: 198, g: 120, b: 221 });
    expect(parseAccentRgbTuple('not-a-color')).toEqual({ r: 198, g: 120, b: 221 });
  });
});

describe('syncPanelAvailability', () => {
  it('disconnected: locks accounts, dataHub, builderPane; sourceSection always unlocked', () => {
    state.api = null;
    state.lastLoadedAccounts = [];
    syncPanelAvailability();
    expect(dom.sourceSection.classList.contains('panel-locked')).toBe(false);
    expect(dom.accountsSection.classList.contains('panel-locked')).toBe(true);
    expect(dom.routeDataHub.classList.contains('panel-locked')).toBe(true);
    expect(dom.builderPane.classList.contains('panel-locked')).toBe(true);
  });

  it('connected, no accounts: unlocks dataHub; locks builderPane', () => {
    state.api = { rpc: {} };
    state.lastLoadedAccounts = [];
    syncPanelAvailability();
    expect(dom.sourceSection.classList.contains('panel-locked')).toBe(false);
    expect(dom.accountsSection.classList.contains('panel-locked')).toBe(false);
    expect(dom.routeDataHub.classList.contains('panel-locked')).toBe(false);
    expect(dom.builderPane.classList.contains('panel-locked')).toBe(true);
  });

  it('connected + accounts: everything unlocked', () => {
    state.api = { rpc: {} };
    state.lastLoadedAccounts = [{ accountIndex: 0, address: '5x' }];
    syncPanelAvailability();
    expect(dom.routeDataHub.classList.contains('panel-locked')).toBe(false);
    expect(dom.builderPane.classList.contains('panel-locked')).toBe(false);
  });
});

describe('updateChainBlock', () => {
  it('updates .block-num text and adds ticked class', () => {
    dom.chainInfoBar.innerHTML = 'spec | Block <span class="block-num">#1</span> | TAO';
    updateChainBlock(7_836_142);
    const el = dom.chainInfoBar.querySelector('.block-num');
    expect(el.textContent).toBe('#7,836,142');
    expect(el.classList.contains('ticked')).toBe(true);
  });

  it('is a no-op when .block-num is absent', () => {
    dom.chainInfoBar.textContent = 'no span here';
    expect(() => updateChainBlock(123)).not.toThrow();
    expect(dom.chainInfoBar.textContent).toBe('no span here');
  });
});

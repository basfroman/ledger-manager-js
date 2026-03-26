// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from 'vitest';
import { NETWORK_PRESETS } from '../src/constants.js';
import { mountAppShell } from './helpers/test-dom-shell.js';
import { initDomRefs, dom } from '../src/ui.js';
import { state } from '../src/state.js';
import { getRpcUrl, renderNetworkPresetOptions } from '../src/network.js';

beforeEach(() => {
  mountAppShell();
  initDomRefs();
  state.networkPresetValue = NETWORK_PRESETS[0].url;
});

describe('getRpcUrl', () => {
  it('returns preset url when not custom', () => {
    state.networkPresetValue = 'wss://test.finney.opentensor.ai:443';
    expect(getRpcUrl()).toBe('wss://test.finney.opentensor.ai:443');
  });

  it('returns trimmed custom url when custom', () => {
    state.networkPresetValue = 'custom';
    dom.customUrl.value = '  ws://127.0.0.1:9944  ';
    expect(getRpcUrl()).toBe('ws://127.0.0.1:9944');
  });
});

describe('renderNetworkPresetOptions', () => {
  it('renders one option per preset and syncs trigger', () => {
    renderNetworkPresetOptions();
    expect(dom.networkPresetDropdown.querySelectorAll('.custom-select-option')).toHaveLength(NETWORK_PRESETS.length);
    expect(dom.networkPresetTrigger.querySelector('.custom-select-label').textContent).toBe(NETWORK_PRESETS[0].label);
    expect(state.networkPresetValue).toBe(NETWORK_PRESETS[0].url);
  });
});

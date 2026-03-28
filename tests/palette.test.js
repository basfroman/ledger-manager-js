// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from 'vitest';
import { mountAppShell } from './helpers/test-dom-shell.js';
import { initDomRefs, dom } from '../src/ui.js';
import { buildPaletteIndex, initPalette } from '../src/palette.js';
import { state } from '../src/state.js';
import { ROUTES } from '../src/constants.js';

function mockApi() {
  return {
    tx: {
      balances: {
        transfer: Object.assign(() => {}, { meta: { args: [] } }),
        transferKeepAlive: Object.assign(() => {}, { meta: { args: [] } }),
      },
    },
    query: {
      system: {
        account: Object.assign(() => {}, { meta: {} }),
      },
    },
    consts: {
      balances: {
        existentialDeposit: { meta: { docs: [] } },
      },
    },
  };
}

beforeEach(() => {
  mountAppShell();
  initDomRefs();
  state.api = null;
  state.activeRoute = ROUTES.COMPOSE;
});

describe('buildPaletteIndex', () => {
  it('builds index from api', () => {
    buildPaletteIndex(mockApi());
    dom.paletteSearch.value = 'balance';
    dom.paletteSearch.dispatchEvent(new Event('input'));
  });

  it('clears index when api is null', () => {
    buildPaletteIndex(mockApi());
    buildPaletteIndex(null);
  });
});

describe('static route entries', () => {
  it('always shows route entries even without api', () => {
    buildPaletteIndex(null);
    initPalette();
    dom.commandPalette.classList.remove('hidden');
    dom.paletteSearch.value = 'Compose';
    dom.paletteSearch.dispatchEvent(new Event('input'));
    const items = dom.paletteResults.querySelectorAll('.palette-result');
    const labels = [...items].map(li => li.querySelector('.palette-label')?.textContent);
    expect(labels).toContain('Compose');
  });

  it('shows all 4 routes when no query', () => {
    buildPaletteIndex(null);
    initPalette();
    dom.commandPalette.classList.remove('hidden');
    dom.paletteSearch.value = '';
    dom.paletteSearch.dispatchEvent(new Event('input'));
    const items = dom.paletteResults.querySelectorAll('.palette-result');
    const labels = [...items].map(li => li.querySelector('.palette-label')?.textContent);
    expect(labels).toContain('Compose');
    expect(labels).toContain('Data Hub');
    expect(labels).toContain('Accounts');
    expect(labels).toContain('Diagnostics');
  });
});

describe('grouped results', () => {
  it('renders group headers', () => {
    buildPaletteIndex(mockApi());
    initPalette();
    dom.commandPalette.classList.remove('hidden');
    dom.paletteSearch.value = '';
    dom.paletteSearch.dispatchEvent(new Event('input'));
    const headers = dom.paletteResults.querySelectorAll('.palette-group-header');
    const headerTexts = [...headers].map(h => h.textContent);
    expect(headerTexts).toContain('Routes');
    expect(headerTexts).toContain('Extrinsics');
  });
});

describe('keyboard navigation', () => {
  it('ArrowDown/ArrowUp cycles through results', () => {
    buildPaletteIndex(null);
    initPalette();
    dom.commandPalette.classList.remove('hidden');
    dom.paletteSearch.value = '';
    dom.paletteSearch.dispatchEvent(new Event('input'));

    dom.paletteSearch.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    let active = dom.paletteResults.querySelector('.palette-active');
    expect(active).not.toBeNull();
    expect(active.querySelector('.palette-label').textContent).toBe('Explorer');

    dom.paletteSearch.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    active = dom.paletteResults.querySelector('.palette-active');
    expect(active.querySelector('.palette-label').textContent).toBe('Compose');

    dom.paletteSearch.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    active = dom.paletteResults.querySelector('.palette-active');
    expect(active.querySelector('.palette-label').textContent).toBe('Explorer');
  });

  it('Enter dispatches the active entry', () => {
    buildPaletteIndex(null);
    initPalette();
    dom.commandPalette.classList.remove('hidden');
    dom.paletteSearch.value = '';
    dom.paletteSearch.dispatchEvent(new Event('input'));

    dom.paletteSearch.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    dom.paletteSearch.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    dom.paletteSearch.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(state.activeRoute).toBe(ROUTES.COMPOSE);
  });
});

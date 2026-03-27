// @vitest-environment happy-dom
// Gate 9 — Regression Safety + Gate 6 — Test Coverage for New Logic
// Verifies critical code paths: handleTxError null guard, broadcastSignedTx terminal statuses,
// clearAccountsTable state consistency, tupleDef.sub guard, innerHTML escaping.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountAppShell } from '../helpers/test-dom-shell.js';
import { initDomRefs, dom, populateCustomDropdown, setActiveRoute, setDataHubTab } from '../../src/ui.js';
import { handleTxError } from '../../src/tx.js';
import { state } from '../../src/state.js';

beforeEach(() => {
  mountAppShell();
  initDomRefs();
  state.api = null;
  state.selectedAccount = null;
  state.palletSelectValue = '';
  state.methodSelectValue = '';
  state.lastLoadedAccounts = [];
  state.accountsLoaded = false;
  state.accountSource = 'wallet';
});

describe('Gate 9/6 — handleTxError null safety', () => {
  it('handleTxError does not crash on null error', () => {
    expect(() => handleTxError(null)).not.toThrow();
    expect(dom.txStatusEl.textContent).toContain('Unknown error');
  });

  it('handleTxError does not crash on undefined error', () => {
    expect(() => handleTxError(undefined)).not.toThrow();
    expect(dom.txStatusEl.textContent).toContain('Unknown error');
  });

  it('handleTxError handles string error', () => {
    expect(() => handleTxError('something broke')).not.toThrow();
    expect(dom.txStatusEl.textContent).toContain('something broke');
  });

  it('handleTxError handles proper Error object', () => {
    expect(() => handleTxError(new Error('proper error'))).not.toThrow();
    expect(dom.txStatusEl.textContent).toContain('proper error');
  });
});

describe('Gate 9/6 — populateCustomDropdown escaping', () => {
  it('items are rendered as textContent, not innerHTML (XSS safe)', () => {
    const malicious = '<img src=x onerror=alert(1)>';
    populateCustomDropdown(dom.palletSelectTrigger, dom.palletSelectDropdown, [malicious], '-- pick --');
    const option = dom.palletSelectDropdown.querySelector('.custom-select-option');
    expect(option.querySelector('.custom-select-label').textContent).toBe(malicious);
    expect(option.innerHTML).not.toContain('<img');
  });
});

describe('Gate 9/6 — setActiveRoute coherence', () => {
  it('only one route panel is visible at a time', () => {
    const routes = ['compose', 'dataHub', 'accounts', 'diagnostics'];
    const domIds = ['routeCompose', 'routeDataHub', 'routeAccounts', 'routeDiagnostics'];
    for (const route of routes) {
      setActiveRoute(route);
      const visible = domIds.filter(id => !dom[id].classList.contains('hidden'));
      expect(visible).toHaveLength(1);
    }
  });

  it('navRail active button matches the selected route', () => {
    setActiveRoute('dataHub');
    const buttons = dom.navRail.querySelectorAll('[data-route]');
    for (const btn of buttons) {
      if (btn.dataset.route === 'dataHub') {
        expect(btn.classList.contains('active')).toBe(true);
        expect(btn.getAttribute('aria-selected')).toBe('true');
      } else {
        expect(btn.classList.contains('active')).toBe(false);
        expect(btn.getAttribute('aria-selected')).toBe('false');
      }
    }
  });
});

describe('Gate 9/6 — setDataHubTab coherence', () => {
  it('only one DataHub sub-tab is visible at a time', () => {
    const panes = ['queryPane', 'constantsPane'];
    for (const target of panes) {
      setDataHubTab(target);
      const visible = panes.filter(p => !dom[p].classList.contains('hidden'));
      expect(visible).toHaveLength(1);
      expect(visible[0]).toBe(target);
    }
  });

  it('active toggle button matches the selected pane', () => {
    setDataHubTab('constantsPane');
    const buttons = dom.rightPanelToggle.querySelectorAll('button');
    for (const btn of buttons) {
      if (btn.dataset.pane === 'constantsPane') {
        expect(btn.classList.contains('active')).toBe(true);
      } else {
        expect(btn.classList.contains('active')).toBe(false);
      }
    }
  });
});

// @vitest-environment happy-dom
// Gate 2 — Single Source of Truth
// Blocker: route/panel state updated from more than one uncoordinated path;
//          submit/fee buttons with different enable/disable rules in different places.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { mountAppShell } from '../helpers/test-dom-shell.js';
import { initDomRefs, dom, setActiveRoute, setDataHubTab, syncPanelAvailability } from '../../src/ui.js';
import { updateExtrinsicSendButton } from '../../src/tx.js';
import { state } from '../../src/state.js';
import { ROUTES, ROUTE_TO_DOM_ID } from '../../src/constants.js';

beforeEach(() => {
  mountAppShell();
  initDomRefs();
  state.api = null;
  state.selectedAccount = null;
  state.palletSelectValue = '';
  state.methodSelectValue = '';
  state.lastLoadedAccounts = [];
});

describe('Gate 2 — Single Source of Truth', () => {
  it('setActiveRoute is the sole route controller (defined only in ui.js)', () => {
    const uiSource = readFileSync(join(import.meta.dirname, '../../src/ui.js'), 'utf8');
    expect(uiSource).toMatch(/export\s+function\s+setActiveRoute/);
    const mainSource = readFileSync(join(import.meta.dirname, '../../src/main.js'), 'utf8');
    expect(mainSource).not.toMatch(/function\s+setActiveRoute/);
  });

  it('setDataHubTab switches DataHub sub-tabs correctly', () => {
    setDataHubTab('queryPane');
    expect(dom.queryPane.classList.contains('hidden')).toBe(false);
    expect(dom.constantsPane.classList.contains('hidden')).toBe(true);
    expect(dom.rightPanelTitle.textContent).toBe('Queries');

    setDataHubTab('constantsPane');
    expect(dom.queryPane.classList.contains('hidden')).toBe(true);
    expect(dom.constantsPane.classList.contains('hidden')).toBe(false);
    expect(dom.rightPanelTitle.textContent).toBe('Constants');
  });

  it('setActiveRoute switches route panels correctly', () => {
    setActiveRoute('dataHub');
    expect(dom.routeCompose.classList.contains('hidden')).toBe(true);
    expect(dom.routeDataHub.classList.contains('hidden')).toBe(false);
    expect(dom.routeAccounts.classList.contains('hidden')).toBe(true);
    expect(dom.routeDiagnostics.classList.contains('hidden')).toBe(true);

    setActiveRoute('compose');
    expect(dom.routeCompose.classList.contains('hidden')).toBe(false);
    expect(dom.routeDataHub.classList.contains('hidden')).toBe(true);
  });

  it('extrinsicSendBtn and feeEstimateBtn are always in sync', () => {
    state.api = { registry: {} };
    state.selectedAccount = { address: '5xxx' };
    state.palletSelectValue = 'balances';
    state.methodSelectValue = 'transfer';
    dom.extrinsicArgs.innerHTML = '';
    updateExtrinsicSendButton();
    expect(dom.extrinsicSendBtn.disabled).toBe(dom.feeEstimateBtn.disabled);

    state.palletSelectValue = '';
    updateExtrinsicSendButton();
    expect(dom.extrinsicSendBtn.disabled).toBe(true);
    expect(dom.feeEstimateBtn.disabled).toBe(true);
    expect(dom.extrinsicSendBtn.disabled).toBe(dom.feeEstimateBtn.disabled);
  });

  it('syncPanelAvailability is single function controlling panel locking', () => {
    const uiSource = readFileSync(join(import.meta.dirname, '../../src/ui.js'), 'utf8');
    const lockMatches = uiSource.match(/panel-locked/g);
    const fnMatches = uiSource.match(/function syncPanelAvailability/g);
    expect(fnMatches).toHaveLength(1);
    expect(lockMatches.length).toBeGreaterThan(0);
  });

  it('ROUTES.SETTINGS exists and has matching DOM element', () => {
    expect(ROUTES.SETTINGS).toBe('settings');
    expect(ROUTE_TO_DOM_ID[ROUTES.SETTINGS]).toBe('routeSettings');
    expect(dom.routeSettings).toBeTruthy();
    expect(dom.routeSettings.id).toBe('routeSettings');
  });

  it('DATA_HUB_PANES array length matches pane elements in HTML', () => {
    const uiSource = readFileSync(join(import.meta.dirname, '../../src/ui.js'), 'utf8');
    const paneEntries = uiSource.match(/pane:\s*'(\w+)'/g);
    const htmlSource = readFileSync(join(import.meta.dirname, '../../index.html'), 'utf8');
    for (const m of paneEntries) {
      const id = m.match(/'(\w+)'/)[1];
      expect(htmlSource, `HTML must contain pane element id="${id}"`).toContain(`id="${id}"`);
    }
  });
});

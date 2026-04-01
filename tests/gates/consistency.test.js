// @vitest-environment happy-dom
// Gate 3 — Consistency
// Blocker: same UX pattern works differently across sections without justification.

import { describe, it, expect, beforeEach } from 'vitest';
import { mountAppShell } from '../helpers/test-dom-shell.js';
import { initDomRefs, dom, populateCustomDropdown } from '../../src/ui.js';

beforeEach(() => {
  mountAppShell();
  initDomRefs();
});

describe('Gate 3 — Consistency', () => {
  it('all dropdowns use the same populateCustomDropdown contract', () => {
    const triggers = [
      [dom.palletSelectTrigger, dom.palletSelectDropdown],
      [dom.methodSelectTrigger, dom.methodSelectDropdown],
      [dom.qPalletSelectTrigger, dom.qPalletSelectDropdown],
      [dom.qStorageSelectTrigger, dom.qStorageSelectDropdown],
      [dom.cPalletSelectTrigger, dom.cPalletSelectDropdown],
      [dom.cConstantSelectTrigger, dom.cConstantSelectDropdown],
    ];
    for (const [trigger, dropdown] of triggers) {
      populateCustomDropdown(trigger, dropdown, ['alpha', 'beta'], '-- pick --');
      const options = dropdown.querySelectorAll('.custom-select-option');
      expect(options).toHaveLength(2);
      expect(options[0].querySelector('.custom-select-label').textContent).toBe('alpha');
      expect(options[1].querySelector('.custom-select-label').textContent).toBe('beta');
      expect(trigger.querySelector('.custom-select-label').textContent).toBe('-- pick --');
    }
  });

  it('empty dropdown disables trigger consistently', () => {
    const triggers = [
      [dom.palletSelectTrigger, dom.palletSelectDropdown],
      [dom.qPalletSelectTrigger, dom.qPalletSelectDropdown],
      [dom.cPalletSelectTrigger, dom.cPalletSelectDropdown],
    ];
    for (const [trigger, dropdown] of triggers) {
      populateCustomDropdown(trigger, dropdown, [], 'none');
      expect(trigger.disabled).toBe(true);
    }
  });

  it('right panel toggle buttons all have data-pane and data-title', () => {
    const buttons = dom.rightPanelToggle.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    for (const btn of buttons) {
      expect(btn.dataset.pane).toBeTruthy();
      expect(btn.dataset.title).toBeTruthy();
    }
  });

  it('navRail buttons all have data-route and role="tab"', () => {
    const buttons = dom.navRail.querySelectorAll('[data-route]');
    expect(buttons.length).toBe(6);
    for (const btn of buttons) {
      expect(btn.dataset.route).toBeTruthy();
      expect(btn.getAttribute('role')).toBe('tab');
    }
  });

  it('no native <select> or <datalist> elements exist in the app shell', () => {
    const selects = document.querySelectorAll('select');
    const datalists = document.querySelectorAll('datalist');
    expect(selects.length, 'Native <select> elements are forbidden — use custom-select').toBe(0);
    expect(datalists.length, 'Native <datalist> elements are forbidden — use custom-select').toBe(0);
  });

  it('every data-insight-route value maps to a valid ROUTES entry', () => {
    const { ROUTES } = require('../../src/constants.js');
    const validRoutes = Object.values(ROUTES);
    const els = document.querySelectorAll('[data-insight-route]');
    expect(els.length).toBeGreaterThan(0);
    for (const el of els) {
      expect(validRoutes, `Invalid insight route: ${el.dataset.insightRoute}`).toContain(el.dataset.insightRoute);
    }
  });
});

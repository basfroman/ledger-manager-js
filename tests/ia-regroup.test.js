// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from 'vitest';
import { mountAppShell } from './helpers/test-dom-shell.js';
import { initDomRefs, setActiveRoute, dom } from '../src/ui.js';

beforeEach(() => {
  mountAppShell();
  initDomRefs();
});

describe('IA regrouping — tools under compose route', () => {
  it('signMessageSection has data-insight-route="compose"', () => {
    expect(dom.signMessageSection.dataset.insightRoute).toBe('compose');
  });

  it('Verify Signature has data-insight-route="compose"', () => {
    const el = dom.insightRail.querySelector('#verifyBtn')?.closest('[data-insight-route]');
    expect(el).not.toBeNull();
    expect(el.dataset.insightRoute).toBe('compose');
  });

  it('Hex Decoder has data-insight-route="compose"', () => {
    const el = dom.insightRail.querySelector('#decodeBtn')?.closest('[data-insight-route]');
    expect(el).not.toBeNull();
    expect(el.dataset.insightRoute).toBe('compose');
  });

  it('compose route shows tools in insight rail', () => {
    setActiveRoute('compose');
    const composeEls = [...dom.insightRail.querySelectorAll('[data-insight-route="compose"]')];
    for (const el of composeEls) {
      expect(el.style.display).not.toBe('none');
    }
  });

  it('accounts route hides compose tools', () => {
    setActiveRoute('accounts');
    const composeEls = [...dom.insightRail.querySelectorAll('[data-insight-route="compose"]')];
    for (const el of composeEls) {
      expect(el.style.display).toBe('none');
    }
  });

  it('diagnostics route hides compose tools', () => {
    setActiveRoute('diagnostics');
    const composeEls = [...dom.insightRail.querySelectorAll('[data-insight-route="compose"]')];
    for (const el of composeEls) {
      expect(el.style.display).toBe('none');
    }
  });

  it('no tools remain under diagnostics route', () => {
    const diagEls = [...dom.insightRail.querySelectorAll('[data-insight-route="diagnostics"]')];
    expect(diagEls).toHaveLength(0);
  });
});

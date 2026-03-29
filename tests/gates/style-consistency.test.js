// @vitest-environment node
// Gate 7 — UI Style Consistency
// Blocker: Ledger/Wallet accent identity violated; new screens don't match theme tokens.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const STYLES_PATH = join(import.meta.dirname, '../../src/styles.css');
const INDEX_PATH = join(import.meta.dirname, '../../index.html');

function readFile(path) {
  return readFileSync(path, 'utf8');
}

describe('Gate 7 — UI Style Consistency', () => {
  it(':root defines wallet accent defaults (--accent-rgb)', () => {
    const css = readFile(STYLES_PATH);
    expect(css).toMatch(/:root\s*\{[^}]*--accent-rgb/s);
    expect(css).toMatch(/:root\s*\{[^}]*--accent:/s);
  });

  it('body[data-account-source="ledger"] overrides accent for ledger mode', () => {
    const css = readFile(STYLES_PATH);
    expect(css).toContain('body[data-account-source="ledger"]');
    expect(css).toMatch(/data-account-source="ledger"\]\s*\{[^}]*--accent-rgb/s);
  });

  it('accent CSS variables defined in :root (wallet default) and ledger override', () => {
    const css = readFile(STYLES_PATH);
    const rootHasAccent = /:root\s*\{[^}]*--accent-rgb/.test(css);
    const ledgerBlock = css.includes('data-account-source="ledger"');
    expect(rootHasAccent).toBe(true);
    expect(ledgerBlock).toBe(true);
  });

  it('panel-locked class is defined in CSS', () => {
    const css = readFile(STYLES_PATH);
    expect(css).toContain('.panel-locked');
  });

  it('status classes (status-ok, status-err, status-warn, status-busy) are defined', () => {
    const css = readFile(STYLES_PATH);
    for (const cls of ['status-ok', 'status-err', 'status-warn', 'status-busy']) {
      expect(css, `Missing CSS class: ${cls}`).toContain(`.${cls}`);
    }
  });

  it('all pane IDs referenced in HTML match CSS', () => {
    const html = readFile(INDEX_PATH);
    const css = readFile(STYLES_PATH);
    for (const id of ['builderPane', 'queryPane', 'constantsPane']) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it('surface classes (surface-primary, surface-secondary, surface-tertiary) are defined in CSS', () => {
    const css = readFile(STYLES_PATH);
    for (const cls of ['surface-primary', 'surface-secondary', 'surface-tertiary']) {
      expect(css, `Missing CSS class: ${cls}`).toContain(`.${cls}`);
    }
  });

  it('timeline event styles are defined in CSS', () => {
    const css = readFile(STYLES_PATH);
    expect(css).toContain('.timeline-event');
  });

  it('navRail styles are defined in CSS', () => {
    const css = readFile(STYLES_PATH);
    expect(css).toContain('.nav-rail');
    expect(css).toContain('.nav-rail-btn');
  });

  it('state classes (state-pass, state-warn, state-fail, state-busy) are defined in CSS', () => {
    const css = readFile(STYLES_PATH);
    for (const cls of ['state-pass', 'state-warn', 'state-fail', 'state-busy']) {
      expect(css, `Missing CSS class: ${cls}`).toContain(`.${cls}`);
    }
  });

  it('route panels with ID-based display rules guard with :not(.hidden)', () => {
    const css = readFile(STYLES_PATH);
    const idDisplayRe = /#route\w+\s*\{[^}]*display\s*:/g;
    const matches = css.match(idDisplayRe) || [];
    expect(
      matches,
      'ID-based display rules on route panels override .hidden — use :not(.hidden) instead',
    ).toEqual([]);
  });

  it('batch and decode components use CSS classes not inline styles', () => {
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const SRC = join(import.meta.dirname, '../../src');
    const batchSrc = readFileSync(join(SRC, 'batch.js'), 'utf8');
    const decodeSrc = readFileSync(join(SRC, 'hex-decoder.js'), 'utf8');
    expect(batchSrc, 'batch.js should not use inline style.display').not.toMatch(/\.style\.display\s*=/);
    expect(batchSrc, 'batch.js should not use inline style.gap').not.toMatch(/\.style\.gap\s*=/);
    expect(decodeSrc, 'hex-decoder.js should not use inline style.cssText').not.toMatch(/\.style\.cssText\s*=/);
  });
});

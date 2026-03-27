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
  it(':root defines ledger accent defaults (--accent-rgb)', () => {
    const css = readFile(STYLES_PATH);
    expect(css).toMatch(/:root\s*\{[^}]*--accent-rgb/s);
    expect(css).toMatch(/:root\s*\{[^}]*--accent:/s);
  });

  it('body[data-account-source="wallet"] overrides accent for wallet mode', () => {
    const css = readFile(STYLES_PATH);
    expect(css).toContain('body[data-account-source="wallet"]');
    expect(css).toMatch(/data-account-source="wallet"\]\s*\{[^}]*--accent-rgb/s);
  });

  it('accent CSS variables defined in :root (ledger default) and wallet override', () => {
    const css = readFile(STYLES_PATH);
    const rootHasAccent = /:root\s*\{[^}]*--accent-rgb/.test(css);
    const walletBlock = css.includes('data-account-source="wallet"');
    expect(rootHasAccent).toBe(true);
    expect(walletBlock).toBe(true);
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
});

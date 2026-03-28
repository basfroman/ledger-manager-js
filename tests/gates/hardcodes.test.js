// @vitest-environment node
// Gate 8 — Hardcode Control
// Blocker: new magic values without constants/comments; duplicated literals.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SRC_DIR = join(import.meta.dirname, '../../src');

function getSrcFiles(exclude = []) {
  return readdirSync(SRC_DIR)
    .filter(f => f.endsWith('.js') && !exclude.includes(f))
    .map(f => ({ name: f, content: readFileSync(join(SRC_DIR, f), 'utf8') }));
}

describe('Gate 8 — Hardcode Control', () => {
  it('MERKLE_DECIMALS and MERKLE_TOKEN are only defined in constants.js', () => {
    const files = getSrcFiles(['constants.js']);
    for (const file of files) {
      expect(file.content).not.toMatch(/MERKLE_DECIMALS\s*=\s*\d/);
      expect(file.content).not.toMatch(/MERKLE_TOKEN\s*=\s*['"]/);
    }
  });

  it('SS58_PREFIX is only defined in constants.js (ledger-manager.js has independent default by design)', () => {
    const files = getSrcFiles(['constants.js', 'ledger-manager.js']);
    for (const file of files) {
      expect(file.content, `${file.name} should not redefine SS58_PREFIX`).not.toMatch(/SS58_PREFIX\s*=\s*\d/);
    }
  });

  it('EXTENSION_DAPP_ORIGIN is centralized', () => {
    const files = getSrcFiles(['constants.js']);
    for (const file of files) {
      expect(file.content).not.toMatch(/EXTENSION_DAPP_ORIGIN\s*=\s*['"]/);
    }
  });

  it('COPY_FEEDBACK_MS is used instead of inline timeout values for copy feedback', () => {
    const uiSrc = readFileSync(join(SRC_DIR, 'ui.js'), 'utf8');
    expect(uiSrc).toContain('COPY_FEEDBACK_MS');
    expect(uiSrc).not.toMatch(/setTimeout\([^)]*1500[^)]*\)/);
  });

  it('NETWORK_PRESETS is the sole source of RPC endpoints', () => {
    const files = getSrcFiles(['constants.js', 'deps.js']);
    for (const file of files) {
      expect(file.content).not.toMatch(/wss:\/\/.*finney.*opentensor/);
    }
  });

  it('MAX_TIMELINE_EVENTS, MAX_DRAFTS, and MAX_EXPLORER_BLOCKS are defined only in constants.js', () => {
    const files = getSrcFiles(['constants.js']);
    for (const file of files) {
      expect(file.content, `${file.name} should not redefine MAX_TIMELINE_EVENTS`).not.toMatch(/MAX_TIMELINE_EVENTS\s*=\s*\d/);
      expect(file.content, `${file.name} should not redefine MAX_DRAFTS`).not.toMatch(/MAX_DRAFTS\s*=\s*\d/);
      expect(file.content, `${file.name} should not redefine MAX_EXPLORER_BLOCKS`).not.toMatch(/MAX_EXPLORER_BLOCKS\s*=\s*\d/);
    }
  });

  it('new feature constants are defined only in constants.js', () => {
    const files = getSrcFiles(['constants.js']);
    const names = ['MORTAL_ERA_PERIOD', 'MAX_WATCHES', 'MAX_BATCH_CALLS', 'MAX_ADDRESS_BOOK', 'HEALTH_POLL_MS', 'MAX_EVENT_STREAM'];
    for (const file of files) {
      for (const name of names) {
        expect(file.content, `${file.name} should not redefine ${name}`).not.toMatch(new RegExp(`${name}\\s*=\\s*\\d`));
      }
    }
  });

  it('era value uses MORTAL_ERA_PERIOD constant, not inline number', () => {
    const txSrc = readFileSync(join(SRC_DIR, 'tx.js'), 'utf8');
    expect(txSrc, 'tx.js should use MORTAL_ERA_PERIOD, not era: 64').not.toMatch(/era:\s*\d+/);
  });

  it('ROUTES and ROUTE_TO_DOM_ID are defined only in constants.js', () => {
    const files = getSrcFiles(['constants.js']);
    for (const file of files) {
      expect(file.content, `${file.name} should not redefine ROUTES`).not.toMatch(/\bROUTES\s*=\s*Object\.freeze/);
      expect(file.content, `${file.name} should not redefine ROUTE_TO_DOM_ID`).not.toMatch(/ROUTE_TO_DOM_ID\s*=\s*Object\.freeze/);
    }
  });

  it('localStorage keys are defined only in constants.js', () => {
    const files = getSrcFiles(['constants.js']);
    const lsKeys = ['LS_LAST_ENDPOINT', 'LS_ACCOUNT_SOURCE', 'LS_ACTIVE_ROUTE', 'LS_ADDRESS_BOOK', 'LS_DRAFTS', 'LS_INSIGHT_WIDTH', 'LS_TIMELINE_HEIGHT'];
    for (const file of files) {
      for (const key of lsKeys) {
        expect(file.content, `${file.name} should not redefine ${key}`).not.toMatch(new RegExp(`${key}\\s*=\\s*['"]`));
      }
    }
  });

  it('SIGNING_MODE_METADATA_HASH is used instead of inline mode:1', () => {
    const txSrc = readFileSync(join(SRC_DIR, 'tx.js'), 'utf8');
    expect(txSrc).toContain('SIGNING_MODE_METADATA_HASH');
    expect(txSrc, 'tx.js should not hardcode mode: 1').not.toMatch(/mode:\s+\d+[,\s]/);
  });

  it('no route string literals in feature modules (must import from constants)', () => {
    const featureModules = getSrcFiles(['constants.js', 'main.js', 'ui.js', 'palette.js', 'drafts.js', 'deps.js']);
    for (const file of featureModules) {
      expect(file.content, `${file.name} should not hardcode route "compose"`).not.toMatch(/['"]compose['"]\s*(?:===|!==|==|!=)/);
      expect(file.content, `${file.name} should not hardcode route "dataHub"`).not.toMatch(/['"]dataHub['"]\s*(?:===|!==|==|!=)/);
    }
  });
});

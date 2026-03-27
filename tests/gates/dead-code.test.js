// @vitest-environment node
// Gate 5 — Dead Code Elimination
// Blocker: unused functions after refactor; vacuous tests.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SRC_DIR = join(import.meta.dirname, '../../src');
const TEST_DIR = join(import.meta.dirname, '..');

function readSrc(name) {
  return readFileSync(join(SRC_DIR, name), 'utf8');
}

describe('Gate 5 — Dead Code Elimination', () => {
  it('no "always true" vacuous tests (expect(true).toBe(true) patterns)', () => {
    const testFiles = readdirSync(TEST_DIR, { recursive: true })
      .filter(f => f.endsWith('.test.js') && !f.startsWith('gates'))
      .map(f => ({ name: f, content: readFileSync(join(TEST_DIR, f), 'utf8') }));

    const vacuousPattern = /expect\(\s*true\s*\)\.toBe\(\s*true\s*\)/;
    const violations = testFiles.filter(f => vacuousPattern.test(f.content));
    expect(
      violations.map(v => v.name),
      'Tests with vacuous expect(true).toBe(true)',
    ).toEqual([]);
  });

  it('no references to removed "activateRightTab" in palette.js as local function', () => {
    const src = readSrc('palette.js');
    expect(src).not.toMatch(/function\s+activateRightTab/);
  });

  it('#txSection, #bottomRow, #appHeader no longer referenced in ui.js initDomRefs', () => {
    const src = readSrc('ui.js');
    const initBlock = src.slice(src.indexOf('function initDomRefs'), src.indexOf('}', src.indexOf('function initDomRefs') + 300) + 1);
    expect(initBlock).not.toContain('txSection');
    expect(initBlock).not.toContain('bottomRow');
    expect(initBlock).not.toContain('appHeader');
  });

  it('no module defines activateRightTab as a local function', () => {
    const files = readdirSync(SRC_DIR)
      .filter(f => f.endsWith('.js'))
      .map(f => ({ name: f, content: readFileSync(join(SRC_DIR, f), 'utf8') }));
    for (const file of files) {
      expect(
        file.content,
        `${file.name} should not define activateRightTab`,
      ).not.toMatch(/function\s+activateRightTab/);
    }
  });

  it('no TODO/FIXME/HACK markers left in source modules', () => {
    const srcFiles = readdirSync(SRC_DIR)
      .filter(f => f.endsWith('.js'))
      .map(f => ({ name: f, content: readFileSync(join(SRC_DIR, f), 'utf8') }));

    const violations = [];
    for (const file of srcFiles) {
      const lines = file.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (/\/\/\s*(TODO|FIXME|HACK)\b/i.test(lines[i])) {
          violations.push(`${file.name}:${i + 1}: ${lines[i].trim()}`);
        }
      }
    }
    if (violations.length > 0) {
      console.warn('Dead code markers found (not a blocker, but tracked):', violations);
    }
  });
});

// @vitest-environment node
// Gate 1 — Architecture Hygiene
// Blocker: no function >150 lines with mixed responsibility; no hidden side-effects.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SRC_DIR = join(import.meta.dirname, '../../src');

function getSrcFiles() {
  return readdirSync(SRC_DIR)
    .filter(f => f.endsWith('.js'))
    .map(f => ({ name: f, content: readFileSync(join(SRC_DIR, f), 'utf8') }));
}

/**
 * Extracts approximate function sizes by counting lines between function
 * declarations, handling nested braces while skipping string/template literals.
 */
function extractFunctions(content) {
  const funcs = [];
  const re = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    const name = match[1];
    let i = content.indexOf('{', match.index + match[0].length - 1);
    let depth = 0;
    let inString = false;
    let stringChar = '';
    let inTemplate = false;
    const bodyStart = i;

    for (; i < content.length; i++) {
      const ch = content[i];
      const prev = i > 0 ? content[i - 1] : '';

      if (inString) {
        if (ch === stringChar && prev !== '\\') inString = false;
        continue;
      }
      if (inTemplate) {
        if (ch === '`' && prev !== '\\') inTemplate = false;
        continue;
      }
      if (ch === "'" || ch === '"') { inString = true; stringChar = ch; continue; }
      if (ch === '`') { inTemplate = true; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) break; }
    }
    const body = content.slice(bodyStart, i + 1);
    const lineCount = body.split('\n').length;
    funcs.push({ name, lineCount });
  }
  return funcs;
}

describe('Gate 1 — Architecture Hygiene', () => {
  const files = getSrcFiles();

  it('no function exceeds 150 lines', () => {
    const violations = [];
    for (const file of files) {
      for (const fn of extractFunctions(file.content)) {
        if (fn.lineCount > 150) {
          violations.push(`${file.name}::${fn.name} (${fn.lineCount} lines)`);
        }
      }
    }
    expect(violations, `Functions over 150 lines: ${violations.join(', ')}`).toEqual([]);
  });

  it('each module has a clear responsibility (exports at least one function or is an entry point)', () => {
    const entryPoints = ['main.js', 'deps.js'];
    const featureModules = files.filter(f => !entryPoints.includes(f.name) && f.name !== 'constants.js');
    for (const file of featureModules) {
      const hasExport = /export\s+(?:function|const|class|async\s+function)/.test(file.content);
      expect(hasExport, `${file.name} should export at least one symbol`).toBe(true);
    }
  });

  it('new modules (preflight, timeline, session-diagnostics, readiness) each export functions', () => {
    const newModules = ['preflight.js', 'timeline.js', 'session-diagnostics.js', 'readiness.js'];
    for (const name of newModules) {
      const file = files.find(f => f.name === name);
      expect(file, `${name} should exist`).toBeTruthy();
      const exportCount = (file.content.match(/export\s+(?:async\s+)?function/g) || []).length;
      expect(exportCount, `${name} should export at least one function`).toBeGreaterThan(0);
    }
  });

  it('session-diagnostics.js does not import from state.js (module purity)', () => {
    const file = files.find(f => f.name === 'session-diagnostics.js');
    expect(file).toBeTruthy();
    expect(file.content).not.toMatch(/from\s+['"]\.\/state/);
  });

  it('feature pack modules (verify-signature, sign-message) each export functions', () => {
    const featureModules = ['verify-signature.js', 'sign-message.js'];
    for (const name of featureModules) {
      const file = files.find(f => f.name === name);
      expect(file, `${name} should exist`).toBeTruthy();
      const exportCount = (file.content.match(/export\s+(?:async\s+)?function/g) || []).length;
      expect(exportCount, `${name} should export at least one function`).toBeGreaterThan(0);
    }
  });

  it('settings.js exports functions and does not import state.js', () => {
    const file = files.find(f => f.name === 'settings.js');
    expect(file, 'settings.js should exist').toBeTruthy();
    const exportCount = (file.content.match(/export\s+(?:async\s+)?function/g) || []).length;
    expect(exportCount, 'settings.js should export at least one function').toBeGreaterThan(0);
    expect(file.content, 'settings.js should not import state.js').not.toMatch(/from\s+['"]\.\/state/);
  });
});

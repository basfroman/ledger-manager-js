// @vitest-environment node
// Gate 10 — Architectural Integrity
// Blocker: circular dependencies between UI/state/feature modules;
//          palette manages foreign layout side-effects directly.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SRC_DIR = join(import.meta.dirname, '../../src');

function readSrc(name) {
  return readFileSync(join(SRC_DIR, name), 'utf8');
}

function extractImports(content) {
  const re = /from\s+['"]\.\/(\w[\w-]*\.js)['"]/g;
  const imports = [];
  let match;
  while ((match = re.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function buildDependencyGraph() {
  const graph = {};
  const files = readdirSync(SRC_DIR).filter(f => f.endsWith('.js'));
  for (const file of files) {
    graph[file] = extractImports(readSrc(file));
  }
  return graph;
}

function findCycles(graph) {
  const cycles = [];
  const visited = new Set();
  const stack = new Set();

  function dfs(node, path) {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      cycles.push(path.slice(cycleStart).concat(node));
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);
    for (const dep of (graph[node] || [])) {
      if (graph[dep]) dfs(dep, [...path, node]);
    }
    stack.delete(node);
  }

  for (const node of Object.keys(graph)) {
    dfs(node, []);
  }
  return cycles;
}

describe('Gate 10 — Architectural Integrity', () => {
  it('no circular dependencies between modules', () => {
    const graph = buildDependencyGraph();
    const cycles = findCycles(graph);
    expect(cycles, `Circular dependencies found: ${cycles.map(c => c.join(' → ')).join('; ')}`).toEqual([]);
  });

  it('palette.js does not manipulate pane layout directly (uses activateRightTab from ui.js)', () => {
    const src = readSrc('palette.js');
    expect(src).not.toMatch(/builderPane.*classList/);
    expect(src).not.toMatch(/queryPane.*classList/);
    expect(src).not.toMatch(/constantsPane.*classList/);
    expect(src).not.toMatch(/rightPanelTitle/);
  });

  it('state.js has no imports from feature modules', () => {
    const stateImports = extractImports(readSrc('state.js'));
    const featureModules = ['tx.js', 'query.js', 'accounts.js', 'network.js', 'palette.js', 'ui.js'];
    for (const mod of featureModules) {
      expect(stateImports).not.toContain(mod);
    }
  });

  it('constants.js has no imports from other modules', () => {
    const imports = extractImports(readSrc('constants.js'));
    expect(imports).toEqual([]);
  });

  it('orchestration pattern: main.js imports from feature modules (not vice versa for orchestration)', () => {
    const mainImports = extractImports(readSrc('main.js'));
    expect(mainImports.length).toBeGreaterThan(3);
  });

  it('timeline.js has no imports from ui.js', () => {
    const imports = extractImports(readSrc('timeline.js'));
    expect(imports).not.toContain('ui.js');
  });

  it('preflight.js has no imports from ui.js', () => {
    const imports = extractImports(readSrc('preflight.js'));
    expect(imports).not.toContain('ui.js');
  });

  it('session-diagnostics.js has no imports from ui.js', () => {
    const imports = extractImports(readSrc('session-diagnostics.js'));
    expect(imports).not.toContain('ui.js');
  });
});

// @vitest-environment node
// Gate 4 — DRY
// Blocker: duplicate pane-toggle logic, duplicate event handling.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC_DIR = join(import.meta.dirname, '../../src');

function readSrc(name) {
  return readFileSync(join(SRC_DIR, name), 'utf8');
}

describe('Gate 4 — DRY', () => {
  it('setActiveRoute is defined only in ui.js', () => {
    const uiSrc = readSrc('ui.js');
    const paletteSrc = readSrc('palette.js');
    const mainSrc = readSrc('main.js');

    expect(uiSrc).toMatch(/export\s+function\s+setActiveRoute/);
    expect(paletteSrc).not.toMatch(/function\s+setActiveRoute/);
    expect(mainSrc).not.toMatch(/function\s+setActiveRoute/);
  });

  it('setDataHubTab is defined only in ui.js', () => {
    const uiSrc = readSrc('ui.js');
    const paletteSrc = readSrc('palette.js');
    const mainSrc = readSrc('main.js');

    expect(uiSrc).toMatch(/export\s+function\s+setDataHubTab/);
    expect(paletteSrc).not.toMatch(/function\s+setDataHubTab/);
    expect(mainSrc).not.toMatch(/function\s+setDataHubTab/);
  });

  it('no duplicate pane toggle logic — classList.toggle hidden for builderPane/queryPane/constantsPane appears only in ui.js', () => {
    const files = ['palette.js', 'main.js', 'tx.js', 'query.js', 'constants-viewer.js'];
    for (const file of files) {
      const src = readSrc(file);
      const togglePattern = /builderPane.*classList\.toggle\(['"]hidden['"]/;
      expect(togglePattern.test(src), `${file} should not have inline pane toggle logic`).toBe(false);
    }
  });

  it('footerCollapseBtn handler exists only in ui.js', () => {
    const uiSrc = readSrc('ui.js');
    const paletteSrc = readSrc('palette.js');
    expect(uiSrc).toContain('footerCollapseBtn');
    expect(paletteSrc).not.toContain('footerCollapseBtn');
  });

  it('initCopyButton is the sole copy-button implementation', () => {
    const uiSrc = readSrc('ui.js');
    const copyBtnDefs = uiSrc.match(/export\s+function\s+initCopyButton/g);
    expect(copyBtnDefs).toHaveLength(1);

    const files = ['tx.js', 'query.js', 'constants-viewer.js'];
    for (const file of files) {
      const src = readSrc(file);
      expect(src).not.toMatch(/function\s+initCopyButton/);
    }
  });

  it('pushTimelineEvent is defined only in timeline.js', () => {
    const timelineSrc = readSrc('timeline.js');
    expect(timelineSrc).toMatch(/export\s+function\s+pushTimelineEvent/);

    const consumers = ['tx.js', 'query.js', 'constants-viewer.js', 'network.js', 'accounts.js'];
    for (const file of consumers) {
      const src = readSrc(file);
      expect(src, `${file} should not define pushTimelineEvent`).not.toMatch(/function\s+pushTimelineEvent/);
    }
  });

  it('no inline route switching in feature modules (must use setActiveRoute)', () => {
    const files = ['tx.js', 'query.js', 'constants-viewer.js', 'network.js', 'accounts.js'];
    for (const file of files) {
      const src = readSrc(file);
      expect(src, `${file} should not toggle route visibility directly`).not.toMatch(/routeCompose.*classList\.toggle/);
      expect(src, `${file} should not toggle route visibility directly`).not.toMatch(/routeDataHub.*classList\.toggle/);
    }
  });
});

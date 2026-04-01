// @vitest-environment happy-dom

import { describe, it, expect } from 'vitest';
import { renderChainHealth } from '../src/session-diagnostics.js';

describe('renderChainHealth — safe DOM rendering', () => {
  it('renders health values as textContent, not innerHTML', () => {
    const container = document.createElement('div');
    const health = {
      peers: 5,
      isSyncing: false,
      version: '<img src=x onerror=alert(1)>',
      chain: '<script>alert(2)</script>',
      ss58: 42,
      tokens: ['<b>XSS</b>'],
    };

    renderChainHealth(health, container);

    const vals = container.querySelectorAll('.diagnostics-val');
    for (const v of vals) {
      expect(v.querySelector('script')).toBeNull();
      expect(v.querySelector('img')).toBeNull();
    }

    const nodeRow = [...vals].find(v => v.textContent.includes('<img'));
    expect(nodeRow).toBeTruthy();
    expect(nodeRow.childNodes[0].nodeType).toBe(Node.TEXT_NODE);
  });

  it('includes health-indicator dots via DOM, not innerHTML', () => {
    const container = document.createElement('div');
    renderChainHealth({
      peers: 3,
      isSyncing: false,
      version: '1.0',
      chain: 'test',
      ss58: null,
      tokens: [],
    }, container);

    const dots = container.querySelectorAll('.health-indicator');
    expect(dots.length).toBeGreaterThan(0);
    for (const dot of dots) {
      expect(dot.tagName).toBe('SPAN');
    }
  });
});

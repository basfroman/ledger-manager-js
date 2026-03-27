// @vitest-environment happy-dom

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { collectDiagnostics, renderDiagnosticsDOM } from '../src/session-diagnostics.js';

describe('collectDiagnostics', () => {
  it('returns rpc and account info from state', () => {
    const st = {
      networkPresetValue: 'wss://test.finney.opentensor.ai:443',
      accountSource: 'ledger',
      selectedAccount: { address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' },
    };
    const data = collectDiagnostics(st);
    expect(data.rpc).toBe('wss://test.finney.opentensor.ai:443');
    expect(data.accountSource).toBe('ledger');
    expect(data.selectedAccount).toBe('5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY');
    expect(data.userAgent).toBeTruthy();
  });

  it('shows dashes for missing fields', () => {
    const data = collectDiagnostics({});
    expect(data.rpc).toBe('—');
    expect(data.accountSource).toBe('—');
    expect(data.selectedAccount).toBe('—');
  });

  it('extracts API info when api is present', () => {
    const st = {
      api: {
        runtimeVersion: { specVersion: { toNumber: () => 142 } },
        genesisHash: { toHex: () => '0xabcdef' },
        registry: { signedExtensions: ['CheckNonce'] },
      },
    };
    const data = collectDiagnostics(st);
    expect(data.specVersion).toBe(142);
    expect(data.genesisHash).toBe('0xabcdef');
    expect(data.signedExtensions).toContain('CheckNonce');
  });

  it('handles api without runtimeVersion gracefully', () => {
    const st = { api: {} };
    const data = collectDiagnostics(st);
    expect(data.specVersion).toBe('—');
    expect(data.genesisHash).toBe('—');
  });
});

describe('renderDiagnosticsDOM', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders key-value rows', () => {
    const data = { rpc: 'wss://example.com', accountSource: 'wallet' };
    renderDiagnosticsDOM(data, container);
    const rows = container.querySelectorAll('.diagnostics-row');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('.diagnostics-key').textContent).toBe('rpc');
    expect(rows[0].querySelector('.diagnostics-val').textContent).toBe('wss://example.com');
  });

  it('clears existing content before rendering', () => {
    container.innerHTML = '<p>old stuff</p>';
    renderDiagnosticsDOM({ x: '1' }, container);
    expect(container.querySelector('p')).toBeNull();
    expect(container.querySelector('.diagnostics-card')).toBeTruthy();
  });

  it('includes a copy snapshot button', () => {
    renderDiagnosticsDOM({ a: 'b' }, container);
    const btn = container.querySelector('button');
    expect(btn).toBeTruthy();
    expect(btn.textContent).toBe('Copy Snapshot');
  });
});

import { describe, it, expect } from 'vitest';
import {
  truncAddr,
  chainSupportsMetadataHash,
  getChainDecimals, getChainToken, isDevChain,
  getArgTypeName, parseExtrinsicArgs,
  formatDocs, txExplorerUrl,
  TAO_DECIMALS, TOKEN_SYMBOL, FINNEY_GENESIS_HASH,
} from './chain-utils.js';

function mockApi(overrides = {}) {
  return {
    registry: {
      signedExtensions: ['CheckSpecVersion', 'CheckMetadataHash'],
      chainDecimals: [9],
      chainTokens: ['TAO'],
      lookup: { getTypeDef: () => ({ type: 'u64' }) },
      ...overrides,
    },
  };
}

// ── truncAddr ──

describe('truncAddr', () => {
  it('returns short strings as-is', () => {
    expect(truncAddr('abc')).toBe('abc');
  });

  it('returns null/undefined as-is', () => {
    expect(truncAddr(null)).toBe(null);
    expect(truncAddr(undefined)).toBe(undefined);
  });

  it('truncates long addresses', () => {
    const addr = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
    expect(truncAddr(addr)).toBe('5GrwvaEF...GKutQY');
  });

  it('does not truncate strings shorter than 16 chars', () => {
    const s = '123456789012345';
    expect(truncAddr(s)).toBe(s);
  });

  it('truncates at exactly 16 chars (boundary)', () => {
    const s = '1234567890123456';
    expect(truncAddr(s)).toBe('12345678...123456');
  });
});

// ── chainSupportsMetadataHash ──

describe('chainSupportsMetadataHash', () => {
  it('returns true when CheckMetadataHash is present', () => {
    expect(chainSupportsMetadataHash(mockApi())).toBe(true);
  });

  it('returns false when CheckMetadataHash is missing', () => {
    expect(chainSupportsMetadataHash(mockApi({
      signedExtensions: ['CheckSpecVersion'],
    }))).toBe(false);
  });

  it('returns false when registry throws', () => {
    expect(chainSupportsMetadataHash({
      registry: { get signedExtensions() { throw new Error('boom'); } },
    })).toBe(false);
  });

  it('returns false when signedExtensions is not an array', () => {
    expect(chainSupportsMetadataHash(mockApi({
      signedExtensions: 'CheckMetadataHash',
    }))).toBe(false);
  });
});

// ── getChainDecimals ──

describe('getChainDecimals', () => {
  it('returns chain decimals', () => {
    expect(getChainDecimals(mockApi({ chainDecimals: [12] }))).toBe(12);
  });

  it('falls back to TAO_DECIMALS on empty array', () => {
    expect(getChainDecimals(mockApi({ chainDecimals: [] }))).toBe(TAO_DECIMALS);
  });

  it('falls back to TAO_DECIMALS when not array', () => {
    expect(getChainDecimals(mockApi({ chainDecimals: null }))).toBe(TAO_DECIMALS);
  });

  it('falls back to TAO_DECIMALS on NaN', () => {
    expect(getChainDecimals(mockApi({ chainDecimals: [NaN] }))).toBe(TAO_DECIMALS);
  });
});

// ── getChainToken ──

describe('getChainToken', () => {
  it('returns chain token', () => {
    expect(getChainToken(mockApi({ chainTokens: ['DOT'] }))).toBe('DOT');
  });

  it('falls back to TOKEN_SYMBOL on empty array', () => {
    expect(getChainToken(mockApi({ chainTokens: [] }))).toBe(TOKEN_SYMBOL);
  });

  it('falls back to TOKEN_SYMBOL on empty string', () => {
    expect(getChainToken(mockApi({ chainTokens: [''] }))).toBe(TOKEN_SYMBOL);
  });
});

// ── isDevChain ──

describe('isDevChain', () => {
  it('returns true for Unit/0', () => {
    expect(isDevChain(mockApi({ chainTokens: ['Unit'], chainDecimals: [0] }))).toBe(true);
  });

  it('returns false for TAO/9', () => {
    expect(isDevChain(mockApi())).toBe(false);
  });

  it('returns false for Unit/9 (partial match)', () => {
    expect(isDevChain(mockApi({ chainTokens: ['Unit'], chainDecimals: [9] }))).toBe(false);
  });
});

// ── getArgTypeName ──

describe('getArgTypeName', () => {
  it('returns typeName when present', () => {
    const arg = { typeName: { toString: () => 'Balance' }, type: 42 };
    const registry = { lookup: { getTypeDef: () => ({ type: 'u128' }) } };
    expect(getArgTypeName(arg, registry)).toBe('Balance');
  });

  it('uses registry lookup when typeName is absent', () => {
    const arg = { typeName: null, type: 7 };
    const registry = { lookup: { getTypeDef: () => ({ type: 'AccountId32' }) } };
    expect(getArgTypeName(arg, registry)).toBe('AccountId32');
  });

  it('returns type#N as last resort', () => {
    const arg = { typeName: null, type: { toString: () => '99' } };
    const registry = { lookup: { getTypeDef: () => { throw new Error('nope'); } } };
    expect(getArgTypeName(arg, registry)).toBe('type#99');
  });
});

// ── parseExtrinsicArgs ──

describe('parseExtrinsicArgs', () => {
  it('parses bool true and false', () => {
    const defs = [{ typeName: 'bool', name: 'flag' }];
    expect(parseExtrinsicArgs(defs, ['true'])).toEqual([true]);
    expect(parseExtrinsicArgs(defs, ['false'])).toEqual([false]);
  });

  it('keeps u128 as string for BigInt safety', () => {
    const defs = [{ typeName: 'u128', name: 'amount' }];
    expect(parseExtrinsicArgs(defs, ['123456789012345'])).toEqual(['123456789012345']);
  });

  it('parses valid JSON object', () => {
    const defs = [{ typeName: 'SomeStruct', name: 'data' }];
    expect(parseExtrinsicArgs(defs, ['{"a":1}'])).toEqual([{ a: 1 }]);
  });

  it('parses valid JSON array', () => {
    const defs = [{ typeName: 'Vec<u8>', name: 'ids' }];
    expect(parseExtrinsicArgs(defs, ['[1,2,3]'])).toEqual([[1, 2, 3]]);
  });

  it('throws on invalid JSON', () => {
    const defs = [{ typeName: 'SomeStruct', name: 'data' }];
    expect(() => parseExtrinsicArgs(defs, ['{bad'])).toThrow('Invalid JSON for argument "data"');
  });

  it('passes plain strings through', () => {
    const defs = [{ typeName: 'AccountId', name: 'dest' }];
    expect(parseExtrinsicArgs(defs, ['5Grw...'])).toEqual(['5Grw...']);
  });

  it('handles empty array', () => {
    expect(parseExtrinsicArgs([], [])).toEqual([]);
  });

  it('passes non-numeric u64 as string (polkadot.js handles encoding error)', () => {
    const defs = [{ typeName: 'u64', name: 'x' }];
    expect(parseExtrinsicArgs(defs, ['abc'])).toEqual(['abc']);
  });
});

// ── formatDocs ──

describe('formatDocs', () => {
  it('returns empty string for empty input', () => {
    expect(formatDocs([])).toBe('');
    expect(formatDocs(null)).toBe('');
  });

  it('renders summary from first non-empty line', () => {
    const html = formatDocs(['Transfer some balance to another account.']);
    expect(html).toContain('<div class="doc-summary">');
    expect(html).toContain('Transfer some balance');
  });

  it('converts backtick code to <code> tags', () => {
    const html = formatDocs(['Sets the `FreeBalance` of the sender.']);
    expect(html).toContain('<code>FreeBalance</code>');
  });

  it('escapes HTML in docs', () => {
    const html = formatDocs(['Use <script> tag']);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('renders description paragraphs', () => {
    const html = formatDocs(['Summary line.', 'Detail line one.', '', 'Second paragraph.']);
    expect(html).toContain('<div class="doc-summary">Summary line. Detail line one.</div>');
    expect(html).toContain('<p class="doc-para">Second paragraph.</p>');
  });

  it('skips leading empty strings', () => {
    const html = formatDocs(['', '', 'Real summary.']);
    expect(html).toContain('<div class="doc-summary">Real summary.</div>');
  });

  it('parses # Args section with name(type): description', () => {
    const html = formatDocs([
      'Summary.',
      '# Args: * netuid (u16): - The network uid.',
      '* dests (Vec<u16>): - The endpoints.',
    ]);
    expect(html).toContain('doc-section-title');
    expect(html).toContain('Args');
    expect(html).toContain('<span class="doc-arg-name">netuid</span>');
    expect(html).toContain('<span class="doc-arg-type">u16</span>');
    expect(html).toContain('The network uid.');
    expect(html).toContain('<span class="doc-arg-name">dests</span>');
  });

  it('parses # Raises section with quoted error names', () => {
    const html = formatDocs([
      'Summary.',
      "# Raises: * 'NotRegistered': - Not registered.",
      "* 'DuplicateUids': - Duplicate uid entries.",
    ]);
    expect(html).toContain('Raises');
    expect(html).toContain('<span class="doc-arg-name">NotRegistered</span>');
    expect(html).toContain('Not registered.');
    expect(html).toContain('<span class="doc-arg-name">DuplicateUids</span>');
  });

  it('parses # Event section', () => {
    const html = formatDocs([
      'Summary.',
      '# Event: * WeightsSet; - Weights set on chain.',
    ]);
    expect(html).toContain('Event');
    expect(html).toContain('<span class="doc-arg-name">WeightsSet</span>');
  });

  it('converts single-quoted PascalCase names to code tags', () => {
    const html = formatDocs(["Check 'SomeError' condition."]);
    expect(html).toContain('<code>SomeError</code>');
  });

  it('handles full substrate doc with all sections', () => {
    const html = formatDocs([
      'Sets the caller weights.',
      '',
      'Note: Weights should represent 1.0 as max u16.',
      '# Args: * origin (<T as frame_system::Config>Origin): - The caller.',
      '* netuid (u16): - The network uid.',
      '# Event: * WeightsSet; - On success.',
      "# Raises: * 'NotRegistered': - Not registered.",
    ]);
    expect(html).toContain('<div class="doc-summary">');
    expect(html).toContain('doc-section');
    expect(html).toContain('Args');
    expect(html).toContain('Event');
    expect(html).toContain('Raises');
    expect(html).toContain('doc-list');
  });
});

describe('txExplorerUrl', () => {
  const txHash = '0xabc123';
  const blockHash = '0xdef456';

  it('returns tao.app link for Finney genesis', () => {
    const result = txExplorerUrl(txHash, FINNEY_GENESIS_HASH, 'wss://finney.opentensor.ai:443', blockHash);
    expect(result).toEqual({
      url: `https://www.tao.app/tx/${txHash}`,
      label: 'View on tao.app',
    });
  });

  it('returns polkadot.js link for non-Finney chain with blockHash', () => {
    const rpc = 'wss://test.finney.opentensor.ai:443';
    const result = txExplorerUrl(txHash, '0x000000', rpc, blockHash);
    expect(result).toEqual({
      url: `https://polkadot.js.org/apps/?rpc=${encodeURIComponent(rpc)}#/explorer/query/${blockHash}`,
      label: 'View on Polkadot.js',
    });
  });

  it('returns null for non-Finney chain without blockHash', () => {
    expect(txExplorerUrl(txHash, '0x000000', 'ws://127.0.0.1:9944')).toBeNull();
    expect(txExplorerUrl(txHash, '0x000000', 'ws://127.0.0.1:9944', undefined)).toBeNull();
  });

  it('Finney link ignores blockHash entirely', () => {
    const result = txExplorerUrl(txHash, FINNEY_GENESIS_HASH, 'wss://finney.opentensor.ai:443');
    expect(result.url).toBe(`https://www.tao.app/tx/${txHash}`);
  });
});

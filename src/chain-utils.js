export const TAO_DECIMALS = 9;
export const TOKEN_SYMBOL = 'TAO';
export const FINNEY_GENESIS_HASH = '0x2f0555cc76fc2840a25a6ea3b9637146806f1f44b090c175ffde2a7e5ab36c03';

export function txExplorerUrl(txHash, genesisHash, rpcEndpoint, blockHash) {
  if (genesisHash === FINNEY_GENESIS_HASH) {
    return { url: `https://www.tao.app/tx/${txHash}`, label: 'View on tao.app' };
  }
  if (blockHash) {
    return { url: `https://polkadot.js.org/apps/?rpc=${encodeURIComponent(rpcEndpoint)}#/explorer/query/${blockHash}`, label: 'View on Polkadot.js' };
  }
  return null;
}

// Re-export merkle params (single source of truth in constants.js).
export { MERKLE_DECIMALS, MERKLE_TOKEN } from './constants.js';

export function truncAddr(addr) {
  if (!addr || addr.length < 16) return addr;
  return addr.slice(0, 8) + '...' + addr.slice(-6);
}

export function chainSupportsMetadataHash(apiInst) {
  try {
    const exts = apiInst.registry.signedExtensions;
    return Array.isArray(exts) && exts.includes('CheckMetadataHash');
  } catch {
    return false;
  }
}

export function getChainDecimals(apiInst) {
  const raw = Array.isArray(apiInst.registry.chainDecimals)
    ? Number(apiInst.registry.chainDecimals[0] ?? TAO_DECIMALS)
    : TAO_DECIMALS;
  return Number.isFinite(raw) ? raw : TAO_DECIMALS;
}

export function getChainToken(apiInst) {
  const token = Array.isArray(apiInst.registry.chainTokens)
    ? String(apiInst.registry.chainTokens[0] ?? TOKEN_SYMBOL)
    : TOKEN_SYMBOL;
  return token || TOKEN_SYMBOL;
}

export function isDevChain(apiInst) {
  return getChainToken(apiInst) === 'Unit' && getChainDecimals(apiInst) === 0;
}

export function getArgTypeName(arg, registry) {
  try {
    const tn = arg.typeName?.toString();
    if (tn) return tn;
  } catch {}
  try {
    return registry.lookup.getTypeDef(arg.type).type;
  } catch {}
  return `type#${arg.type.toString()}`;
}

export function parseTypedArgs(argDefs, values) {
  return values.map((val, i) => {
    const typeName = (argDefs[i]?.typeName ?? '').toLowerCase();
    const argName = argDefs[i]?.name ?? `arg${i}`;

    if (typeName === 'bool') return val === 'true' || val === true;
    if (/^(u64|u128|compact)/i.test(typeName) && /^\d+$/.test(String(val))) return String(val);

    const s = String(val).trim();
    if (s.startsWith('{') || s.startsWith('[')) {
      try { return JSON.parse(s); } catch {
        throw new Error(`Invalid JSON for argument "${argName}": ${s.slice(0, 80)}`);
      }
    }
    return s;
  });
}

export function escapeHtml(s) {
  const str = String(s ?? '');
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function highlightJson(json) {
  return json.replace(
    /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(true|false|null)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, key, str, lit, num) => {
      if (key) return `<span class="json-key">${escapeHtml(key)}</span>:`;
      if (str) return `<span class="json-str">${escapeHtml(str)}</span>`;
      if (lit) return `<span class="json-lit">${escapeHtml(lit)}</span>`;
      if (num) return `<span class="json-num">${escapeHtml(num)}</span>`;
      return match;
    },
  );
}

function cleanDashes(s) {
  return s
    .replace(/\s*[—–\-]\s*[—–\-]\s*/g, ' — ')
    .replace(/\s*:\s*[—–\-]\s*/g, ' — ')
    .replace(/^\s*[—–\-]\s+/, '');
}

const BACKTICK_CODE_RE = new RegExp('`([^`]+)`', 'g');

function inlineDocs(s) {
  return escapeHtml(cleanDashes(s))
    .replace(BACKTICK_CODE_RE, '<code>$1</code>')
    .replace(/'([A-Z]\w+)'/g, '<code>$1</code>');
}

export function formatDocs(docStrings) {
  if (!docStrings?.length) return '';
  const text = docStrings.map(d => String(d)).join('\n');
  const trimmed = text.trim();
  if (!trimmed) return '';

  const sectionRe = /^#\s+(.+?):\s*/;

  const sections = [];
  let currentSection = { title: null, lines: [] };
  sections.push(currentSection);

  for (const raw of trimmed.split('\n')) {
    const line = raw.trim();
    const secMatch = line.match(sectionRe);
    if (secMatch) {
      currentSection = { title: secMatch[1], lines: [] };
      sections.push(currentSection);
      const after = line.slice(secMatch[0].length).trim();
      if (after) currentSection.lines.push(after);
      continue;
    }
    currentSection.lines.push(line);
  }

  let html = '';

  for (const sec of sections) {
    if (!sec.title && sec.lines.length === 0) continue;

    if (!sec.title) {
      const paras = joinParagraphs(sec.lines);
      if (paras[0]) html += '<div class="doc-summary">' + inlineDocs(paras[0]) + '</div>';
      for (let i = 1; i < paras.length; i++) {
        html += '<p class="doc-para">' + inlineDocs(paras[i]) + '</p>';
      }
      continue;
    }

    html += '<div class="doc-section">';
    html += '<div class="doc-section-title">' + escapeHtml(sec.title) + '</div>';

    const items = parseItems(sec.lines);
    if (items.length) {
      html += '<ul class="doc-list">';
      for (const item of items) {
        html += '<li>' + formatItem(item, inlineDocs) + '</li>';
      }
      html += '</ul>';
    }
    html += '</div>';
  }

  return html;
}

function joinParagraphs(lines) {
  const paras = [];
  let buf = '';
  for (const l of lines) {
    if (l === '') {
      if (buf) { paras.push(buf); buf = ''; }
    } else {
      buf += (buf ? ' ' : '') + l;
    }
  }
  if (buf) paras.push(buf);
  return paras;
}

function parseItems(lines) {
  const items = [];
  let current = null;
  for (const l of lines) {
    const m = l.match(/^[-*]\s+(.*)/);
    if (m) {
      if (current) items.push(current);
      current = m[1];
    } else if (current && l) {
      current += ' ' + l;
    }
  }
  if (current) items.push(current);
  return items;
}

function formatItem(raw, inlineFn) {
  const btNameType = raw.match(/^`(\w+)`\s*\(([^)]+)\)\s*[:\-–—]\s*(.*)/);
  if (btNameType) {
    return `<span class="doc-arg-name">${inlineFn(btNameType[1])}</span>`
      + ` <span class="doc-arg-type">${inlineFn(btNameType[2])}</span>`
      + (btNameType[3] ? ` <span class="doc-arg-desc">— ${inlineFn(btNameType[3])}</span>` : '');
  }
  const btName = raw.match(/^`(\w+)`\s*[:\-–—]\s*(.*)/);
  if (btName) {
    return `<span class="doc-arg-name">${inlineFn(btName[1])}</span>`
      + (btName[2] ? ` <span class="doc-arg-desc">— ${inlineFn(btName[2])}</span>` : '');
  }
  const nameType = raw.match(/^(\w+)\s*\(([^)]+)\)\s*[:\-–—]\s*(.*)/);
  if (nameType) {
    return `<span class="doc-arg-name">${inlineFn(nameType[1])}</span>`
      + ` <span class="doc-arg-type">${inlineFn(nameType[2])}</span>`
      + (nameType[3] ? ` <span class="doc-arg-desc">— ${inlineFn(nameType[3])}</span>` : '');
  }
  const quoted = raw.match(/^'([^']+)'\s*\(([^)]+)\)\s*[:\-–—]\s*(.*)/);
  if (quoted) {
    return `<span class="doc-arg-name">${inlineFn(quoted[1])}</span>`
      + ` <span class="doc-arg-type">${inlineFn(quoted[2])}</span>`
      + (quoted[3] ? ` <span class="doc-arg-desc">— ${inlineFn(quoted[3])}</span>` : '');
  }
  const nameOnly = raw.match(/^'?([A-Za-z]\w*)'?\s*[;:\-–—]\s*(.*)/);
  if (nameOnly) {
    return `<span class="doc-arg-name">${inlineFn(nameOnly[1])}</span>`
      + (nameOnly[2] ? ` <span class="doc-arg-desc">— ${inlineFn(nameOnly[2])}</span>` : '');
  }
  return inlineFn(raw);
}

export function buildCallDocHtml(meta, registry) {
  const rawDocs = meta.docs?.map(d => d.toString()) || [];
  const args = [...(meta.args || [])];

  const descLines = [];
  const paramDescs = {};
  let hitParams = false;
  let currentParam = null;

  for (const raw of rawDocs) {
    const line = raw.trim();

    if (!hitParams) {
      if (/^(#\s+)?(Parameters|Args|Arguments)\s*:/i.test(line)) {
        hitParams = true;
        continue;
      }
      if (/^[-*]\s*`\w+`\s*[:\-–—]/.test(line)) {
        hitParams = true;
      }
    }

    if (hitParams) {
      if (/^#\s+/.test(line)) { currentParam = null; continue; }
      const m = line.match(/^[-*]\s*`?(\w+)`?\s*[:\-–—]\s*(.*)/);
      if (m) {
        currentParam = m[1];
        paramDescs[currentParam] = m[2].trim();
      } else if (currentParam && line) {
        paramDescs[currentParam] += ' ' + line;
      } else {
        currentParam = null;
      }
    } else {
      descLines.push(raw);
    }
  }

  let html = formatDocs(descLines);

  if (args.length > 0) {
    html += '<div class="doc-section">';
    html += '<div class="doc-section-title">Parameters</div>';
    html += '<ul class="doc-list">';
    for (const arg of args) {
      const name = arg.name.toString();
      const type = getArgTypeName(arg, registry);
      const desc = paramDescs[name] || '';
      html += '<li>';
      html += `<span class="doc-arg-name">${escapeHtml(name)}</span>`;
      html += ` <span class="doc-arg-type">${escapeHtml(type)}</span>`;
      if (desc) {
        const cleanDesc = escapeHtml(desc)
          .replace(/`([^`]+)`/g, '<code>$1</code>');
        html += ` <span class="doc-arg-desc">— ${cleanDesc}</span>`;
      }
      html += '</li>';
    }
    html += '</ul>';
    html += '</div>';
  }

  return html;
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

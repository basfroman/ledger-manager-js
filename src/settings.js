import { LS_ACCENT_THEME } from './constants.js';

export const ACCENT_PRESETS = Object.freeze([
  { name: 'Orange',  accent: '#e8943c' },
  { name: 'Purple',  accent: '#c678dd' },
  { name: 'Blue',    accent: '#61afef' },
  { name: 'Green',   accent: '#98c379' },
  { name: 'Rose',    accent: '#e06c75' },
  { name: 'Cyan',    accent: '#56b6c2' },
  { name: 'Gold',    accent: '#e5c07b' },
]);

const DEFAULT_ACCENT = '#e8943c';

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

function lighten(hex, amount = 0.15) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + Math.round(255 * amount));
  const g = Math.min(255, ((n >> 8) & 255) + Math.round(255 * amount));
  const b = Math.min(255, (n & 255) + Math.round(255 * amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function applyAccentColor(hex) {
  const s = document.documentElement.style;
  s.setProperty('--accent', hex);
  s.setProperty('--accent-hover', lighten(hex));
  s.setProperty('--accent-rgb', hexToRgb(hex));
  try { localStorage.setItem(LS_ACCENT_THEME, hex); } catch {}
}

export function initSettings() {
  const picker = document.getElementById('accentColorInput');
  const label = document.getElementById('accentHexLabel');
  const presets = document.getElementById('accentPresets');
  const resetBtn = document.getElementById('accentResetBtn');
  if (!picker) return;

  for (const btn of presets.querySelectorAll('.accent-dot')) {
    const p = ACCENT_PRESETS.find(pr => pr.name === btn.dataset.preset);
    if (p) btn.style.backgroundColor = p.accent;
  }

  function syncUI(hex) {
    picker.value = hex;
    label.textContent = hex;
    for (const btn of presets.querySelectorAll('.accent-dot')) {
      const p = ACCENT_PRESETS.find(pr => pr.name === btn.dataset.preset);
      btn.classList.toggle('active', p && p.accent.toLowerCase() === hex.toLowerCase());
    }
  }

  picker.addEventListener('input', (e) => {
    const hex = e.target.value;
    applyAccentColor(hex);
    syncUI(hex);
  });

  presets.addEventListener('click', (e) => {
    const btn = e.target.closest('.accent-dot');
    if (!btn) return;
    const p = ACCENT_PRESETS.find(pr => pr.name === btn.dataset.preset);
    if (!p) return;
    applyAccentColor(p.accent);
    syncUI(p.accent);
  });

  resetBtn.addEventListener('click', () => {
    applyAccentColor(DEFAULT_ACCENT);
    syncUI(DEFAULT_ACCENT);
  });

  let saved;
  try { saved = localStorage.getItem(LS_ACCENT_THEME); } catch {}
  if (saved && /^#[0-9a-f]{6}$/i.test(saved)) {
    applyAccentColor(saved);
    syncUI(saved);
  }
}

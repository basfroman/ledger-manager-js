import { MAX_DRAFTS, ROUTES, LS_DRAFTS } from './constants.js';
import { state } from './state.js';
import { setActiveRoute, setDataHubTab } from './ui.js';
import { selectExtrinsic } from './tx.js';
import { selectQuery } from './query.js';
import { selectConstant } from './constants-viewer.js';

const STORAGE_KEY = LS_DRAFTS;
const STORAGE_VERSION = 1;

/**
 * Save a draft to localStorage.
 * @param {'extrinsic'|'query'|'constant'} kind
 * @param {object} payload - { pallet, method/item, args }
 */
export function saveDraft(kind, payload) {
  const draft = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    ...payload,
    ts: Date.now(),
  };
  state.drafts.push(draft);
  if (state.drafts.length > MAX_DRAFTS) {
    state.drafts.shift();
  }
  persistDrafts();
  return draft;
}

/**
 * Load drafts from localStorage, with version check.
 * @returns {Array}
 */
export function loadDrafts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== STORAGE_VERSION || !Array.isArray(parsed.items)) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return parsed.items;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

/**
 * Navigate to the draft's route and restore its selection.
 * @param {object} draft
 */
export function restoreDraft(draft) {
  if (draft.kind === 'extrinsic') {
    setActiveRoute(ROUTES.COMPOSE);
    selectExtrinsic(draft.pallet, draft.method);
  } else if (draft.kind === 'query') {
    setActiveRoute(ROUTES.DATA_HUB);
    setDataHubTab('queryPane');
    selectQuery(draft.pallet, draft.item);
  } else if (draft.kind === 'constant') {
    setActiveRoute(ROUTES.DATA_HUB);
    setDataHubTab('constantsPane');
    selectConstant(draft.pallet, draft.item);
  }
}

/**
 * Delete a draft by id.
 * @param {string} id
 */
export function deleteDraft(id) {
  const idx = state.drafts.findIndex(d => d.id === id);
  if (idx !== -1) {
    state.drafts.splice(idx, 1);
    persistDrafts();
  }
}

function persistDrafts() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_VERSION, items: state.drafts }));
  } catch {
    // quota exceeded — silently fail
  }
}

/**
 * Initialize drafts from localStorage into state.
 */
export function initDrafts() {
  state.drafts = loadDrafts();
}

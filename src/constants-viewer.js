import { formatDocs, highlightJson } from './chain-utils.js';
import { state } from './state.js';
import { dom, setupCustomDropdown, populateCustomDropdown, log } from './ui.js';

function onConstantPalletChanged(pallet) {
  state.cConstantSelectValue = '';
  dom.constantDocs.textContent = '';
  dom.constantDocs.classList.add('hidden');
  dom.constantResultWrap.classList.add('hidden');
  dom.constantResult.textContent = '';

  if (!pallet || !state.api?.consts[pallet]) {
    populateCustomDropdown(dom.cConstantSelectTrigger, dom.cConstantSelectDropdown, [], '-- select constant --');
    dom.cConstantSelectTrigger.disabled = true;
    return;
  }

  const items = Object.keys(state.api.consts[pallet]).sort().filter(
    k => state.api.consts[pallet][k]?.meta,
  );
  populateCustomDropdown(dom.cConstantSelectTrigger, dom.cConstantSelectDropdown, items, '-- select constant --');
  dom.cConstantSelectTrigger.disabled = false;
}

function onConstantItemChanged(item) {
  const pallet = state.cPalletSelectValue;
  dom.constantDocs.textContent = '';
  dom.constantDocs.classList.add('hidden');
  dom.constantResultWrap.classList.add('hidden');
  dom.constantResult.textContent = '';

  if (!pallet || !item || !state.api?.consts[pallet]?.[item]) return;

  const constant = state.api.consts[pallet][item];
  const meta = constant.meta;

  const docsHtml = formatDocs(meta.docs.map(d => d.toString()));
  if (docsHtml) {
    dom.constantDocs.innerHTML = docsHtml;
    dom.constantDocs.classList.remove('hidden');
  }

  const value = constant.toHuman();
  const json = JSON.stringify(value, null, 2);
  dom.constantResult.innerHTML = highlightJson(json);
  dom.constantResultWrap.classList.remove('hidden');
  log(`Constant ${pallet}.${item} = ${JSON.stringify(value)}`);
}

export function populateConstantPallets(api) {
  const pallets = Object.keys(api.consts).sort();
  populateCustomDropdown(dom.cPalletSelectTrigger, dom.cPalletSelectDropdown, pallets, '-- select pallet --');
  dom.cPalletSelectTrigger.disabled = false;
}

export function resetConstantsViewer() {
  state.cPalletSelectValue = '';
  state.cConstantSelectValue = '';
  populateCustomDropdown(dom.cPalletSelectTrigger, dom.cPalletSelectDropdown, [], 'Connect to load pallets...');
  dom.cPalletSelectTrigger.disabled = true;
  populateCustomDropdown(dom.cConstantSelectTrigger, dom.cConstantSelectDropdown, [], 'Select a pallet first');
  dom.cConstantSelectTrigger.disabled = true;
  dom.constantDocs.textContent = '';
  dom.constantDocs.classList.add('hidden');
  dom.constantResultWrap.classList.add('hidden');
  dom.constantResult.textContent = '';
}

/** Programmatic selection for command palette. */
export function selectConstant(pallet, name) {
  if (!state.api?.consts[pallet]?.[name]) return;
  state.cPalletSelectValue = pallet;
  onConstantPalletChanged(pallet);
  state.cConstantSelectValue = name;
  onConstantItemChanged(name);
  dom.cPalletSelectTrigger.querySelector('.custom-select-label').textContent = pallet;
  dom.cConstantSelectTrigger.querySelector('.custom-select-label').textContent = name;
  dom.cPalletSelectDropdown.querySelectorAll('.custom-select-option').forEach(o => {
    o.classList.toggle('selected', o.dataset.value === pallet);
  });
  dom.cConstantSelectDropdown.querySelectorAll('.custom-select-option').forEach(o => {
    o.classList.toggle('selected', o.dataset.value === name);
  });
}

export function initConstants() {
  setupCustomDropdown(dom.cPalletSelectTrigger, dom.cPalletSelectDropdown, 'cPalletSelectWrap', (value) => {
    state.cPalletSelectValue = value;
    onConstantPalletChanged(value);
  });

  setupCustomDropdown(dom.cConstantSelectTrigger, dom.cConstantSelectDropdown, 'cConstantSelectWrap', (value) => {
    state.cConstantSelectValue = value;
    onConstantItemChanged(value);
  });
}

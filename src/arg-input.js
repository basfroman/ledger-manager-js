import { getArgTypeName, parseTypedArgs, truncAddr } from './chain-utils.js';
import { setupCustomDropdown } from './ui.js';
import { getContactName } from './address-book.js';
import { state } from './state.js';

let argBoolSeq = 0;

function createBoolArgCustomSelect(arg, tn, onChange) {
  const wrapId = `argBool${argBoolSeq++}`;
  const root = document.createElement('div');
  root.className = 'arg-bool-field';

  const wrap = document.createElement('div');
  wrap.className = 'custom-select';
  wrap.id = wrapId;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'custom-select-trigger';
  trigger.innerHTML = '<span class="custom-select-label">false</span>';

  const dropdown = document.createElement('div');
  dropdown.className = 'custom-select-dropdown hidden';
  for (const val of ['false', 'true']) {
    const opt = document.createElement('div');
    opt.className = 'custom-select-option';
    if (val === 'false') opt.classList.add('selected');
    opt.dataset.value = val;
    opt.innerHTML = `<span class="custom-select-label">${val}</span>`;
    dropdown.appendChild(opt);
  }

  const hidden = document.createElement('input');
  hidden.type = 'hidden';
  hidden.value = 'false';
  hidden.dataset.argName = arg.name.toString();
  hidden.dataset.argType = tn;

  wrap.append(trigger, dropdown);
  root.append(wrap, hidden);

  setupCustomDropdown(trigger, dropdown, wrapId, (value) => {
    hidden.value = value;
    onChange();
  });

  return root;
}

export function createArgInput(arg, registry, onChange = () => {}) {
  const tn = getArgTypeName(arg, registry);
  const typeName = tn.toLowerCase();

  if (typeName === 'bool') {
    return createBoolArgCustomSelect(arg, tn, onChange);
  }

  if (/bytes|vec<u8>/.test(typeName)) {
    const ta = document.createElement('textarea');
    ta.className = 'arg-textarea';
    ta.rows = 2;
    ta.placeholder = '0x... (hex) or raw text';
    ta.addEventListener('input', onChange);
    ta.dataset.argName = arg.name.toString();
    ta.dataset.argType = tn;
    return ta;
  }

  const input = document.createElement('input');
  input.addEventListener('input', onChange);
  input.dataset.argName = arg.name.toString();
  input.dataset.argType = tn;

  if (/^(u8|u16|u32|u64|u128|compact)/i.test(typeName)) {
    input.type = 'text';
    input.placeholder = '0';
    input.inputMode = 'numeric';
  } else if (/accountid|multiaddress|address/i.test(typeName)) {
    input.placeholder = '5...';
    return attachAddressAutocomplete(input);
  } else if (/h256|hash/i.test(typeName)) {
    input.placeholder = '0x...';
  } else {
    input.placeholder = `${tn} (string or JSON)`;
  }

  return input;
}

function getAddressSuggestions() {
  const items = [];
  const seen = new Set();
  for (const c of state.addressBook || []) {
    if (seen.has(c.address)) continue;
    seen.add(c.address);
    items.push({ address: c.address, label: c.name });
  }
  for (const acct of state.lastLoadedAccounts || []) {
    if (seen.has(acct.address)) continue;
    seen.add(acct.address);
    items.push({ address: acct.address, label: acct.derivationPath || `Account #${acct.accountIndex}` });
  }
  return items;
}

function attachAddressAutocomplete(input) {
  const wrap = document.createElement('div');
  wrap.className = 'address-autocomplete-wrap';
  const dd = document.createElement('div');
  dd.className = 'custom-select-dropdown address-autocomplete-dropdown hidden';

  function rebuild(filter) {
    dd.innerHTML = '';
    const suggestions = getAddressSuggestions();
    const q = (filter || '').toLowerCase();
    let count = 0;
    for (const s of suggestions) {
      if (q && !s.address.toLowerCase().includes(q) && !s.label.toLowerCase().includes(q)) continue;
      const opt = document.createElement('div');
      opt.className = 'custom-select-option';
      opt.dataset.value = s.address;
      opt.innerHTML = `<span class="custom-select-label">${s.label}</span><span class="custom-select-url">${truncAddr(s.address)}</span>`;
      dd.appendChild(opt);
      if (++count >= 8) break;
    }
    dd.classList.toggle('hidden', count === 0);
  }

  const pickBtn = document.createElement('button');
  pickBtn.type = 'button';
  pickBtn.className = 'address-pick-btn';
  pickBtn.title = 'Choose from address book';
  pickBtn.innerHTML = '+';
  pickBtn.addEventListener('click', () => {
    rebuild('');
    dd.classList.toggle('hidden');
  });

  input.addEventListener('focus', () => rebuild(input.value));
  input.addEventListener('input', () => rebuild(input.value));
  input.addEventListener('blur', () => { setTimeout(() => dd.classList.add('hidden'), 150); });
  dd.addEventListener('mousedown', (e) => {
    const opt = e.target.closest('.custom-select-option');
    if (!opt) return;
    e.preventDefault();
    input.value = opt.dataset.value;
    input.dispatchEvent(new Event('input'));
    dd.classList.add('hidden');
  });

  wrap.append(input, pickBtn, dd);
  return wrap;
}

export function collectInputValues(container) {
  const inputs = container.querySelectorAll('[data-arg-name]');
  const argDefs = [];
  const values = [];
  for (const input of inputs) {
    argDefs.push({ typeName: input.dataset.argType ?? '', name: input.dataset.argName });
    values.push(input.value?.trim() ?? '');
  }
  return parseTypedArgs(argDefs, values);
}

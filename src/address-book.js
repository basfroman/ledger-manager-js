import { LS_ADDRESS_BOOK, LS_ADDRESS_BOOK_VERSION, MAX_ADDRESS_BOOK } from './constants.js';
import { state } from './state.js';
import { dom } from './ui.js';
import { escapeHtml, truncAddr } from './chain-utils.js';

export function loadAddressBook() {
  try {
    const raw = localStorage.getItem(LS_ADDRESS_BOOK);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.v !== LS_ADDRESS_BOOK_VERSION || !Array.isArray(parsed.items)) {
      localStorage.removeItem(LS_ADDRESS_BOOK);
      return [];
    }
    return parsed.items;
  } catch {
    localStorage.removeItem(LS_ADDRESS_BOOK);
    return [];
  }
}

export function saveAddressBook() {
  try {
    localStorage.setItem(LS_ADDRESS_BOOK, JSON.stringify({ v: LS_ADDRESS_BOOK_VERSION, items: state.addressBook }));
  } catch {}
}

export function addContact(name, address, notes = '') {
  if (state.addressBook.length >= MAX_ADDRESS_BOOK) return false;
  if (state.addressBook.some(c => c.address === address)) return false;
  state.addressBook.push({ name, address, notes, ts: Date.now() });
  saveAddressBook();
  return true;
}

export function removeContact(address) {
  const idx = state.addressBook.findIndex(c => c.address === address);
  if (idx !== -1) {
    state.addressBook.splice(idx, 1);
    saveAddressBook();
  }
}

export function getContactName(address) {
  const contact = state.addressBook.find(c => c.address === address);
  return contact?.name ?? null;
}


export function renderAddressBook(container) {
  container.innerHTML = '';

  const addRow = document.createElement('div');
  addRow.className = 'address-book-add-row';
  const nameInput = document.createElement('input');
  nameInput.placeholder = 'Name';
  const addrInput = document.createElement('input');
  addrInput.placeholder = 'ss58 address';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn-primary btn-sm';
  addBtn.textContent = '+ Add';
  addBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const addr = addrInput.value.trim();
    if (!name || !addr) return;
    if (addContact(name, addr)) {
      nameInput.value = '';
      addrInput.value = '';
      renderAddressBook(container);
    }
  });
  addRow.append(nameInput, addrInput, addBtn);
  container.appendChild(addRow);

  if (state.addressBook.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'text-muted text-sm mt-8';
    empty.textContent = 'No contacts saved';
    container.appendChild(empty);
    return;
  }

  const table = document.createElement('table');
  table.className = 'mt-8';
  table.innerHTML = '<thead><tr><th>Name</th><th>Address</th><th></th></tr></thead>';
  const tbody = document.createElement('tbody');
  for (const contact of state.addressBook) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(contact.name)}</td>
      <td title="${escapeHtml(contact.address)}">${truncAddr(contact.address)}</td>
      <td class="text-right"></td>
    `;
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn-danger btn-sm';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => {
      removeContact(contact.address);
      renderAddressBook(container);
    });
    tr.lastElementChild.appendChild(removeBtn);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

export function initAddressBook() {
  state.addressBook = loadAddressBook();
  renderAddressBook(dom.addressBookContent);
}

// Category combobox. A native datalist filters its suggestions by the field's current text, so once a
// category was chosen the list offered only that one until the field was cleared. Here a click or
// ArrowDown always opens the full list (the current choice highlighted), and only typing filters it.
// The options still come from #categoryList, which app.js keeps up to date.
(function () {
  'use strict';
  const SELECTOR = 'input[list="categoryList"], input[data-category-picker]';
  let serial = 0;
  let current = null; // { input, list, items, index }

  const options = () => [...document.querySelectorAll('#categoryList option')].map((option) => option.value).filter(Boolean);
  const fold = (value) => value.toLocaleLowerCase('id-ID').normalize('NFKD').replace(/[̀-ͯ]/g, '').trim();

  function enhance(input) {
    if (input.dataset.categoryPicker === 'ready') return input;
    input.removeAttribute('list');
    input.dataset.categoryPicker = 'ready';
    const list = document.createElement('ul');
    list.className = 'category-picker-list';
    list.id = `categoryPickerList${++serial}`;
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', 'Pilihan kategori');
    list.hidden = true;
    // The list goes right after the input and is placed against its parent. The input itself is
    // never moved: moving a node mid-click drops its focus and the browser cancels the click.
    input.parentElement.classList.add('category-picker');
    input.after(list);
    Object.assign(input, { autocomplete: 'off' });
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', list.id);
    list.addEventListener('mousedown', (event) => event.preventDefault());
    list.addEventListener('click', (event) => {
      // The list sits inside the field's <label>; without this the label forwards the click to
      // the input, which would reopen the list right after a choice.
      event.preventDefault();
      const item = event.target.closest('[role="option"]');
      if (item) choose(item.dataset.value);
    });
    return input;
  }

  function matches(query) {
    const all = options();
    const needle = fold(query);
    if (!needle) return all;
    const hits = all.filter((value) => fold(value).includes(needle));
    return hits.sort((a, b) => Number(!fold(a).startsWith(needle)) - Number(!fold(b).startsWith(needle)));
  }

  function open(input, { filter = false } = {}) {
    enhance(input);
    if (current && current.input !== input) close();
    const list = document.getElementById(input.getAttribute('aria-controls'));
    const items = filter ? matches(input.value) : options();
    if (!items.length) { close(); return; }
    const selected = items.findIndex((value) => fold(value) === fold(input.value));
    current = { input, list, items, index: selected };
    list.innerHTML = items.map((value, index) => `<li role="option" id="${list.id}-${index}" data-value="${escapeHtml(value)}" aria-selected="${index === selected}">${escapeHtml(value)}</li>`).join('');
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    highlight(selected);
  }

  function highlight(index) {
    if (!current) return;
    current.index = index;
    current.list.querySelectorAll('[role="option"]').forEach((item, position) => item.classList.toggle('is-active', position === index));
    const item = current.list.children[index];
    if (item) {
      current.input.setAttribute('aria-activedescendant', item.id);
      item.scrollIntoView?.({ block: 'nearest' });
    } else current.input.removeAttribute('aria-activedescendant');
  }

  function close() {
    if (!current) return;
    current.list.hidden = true;
    current.list.innerHTML = '';
    current.input.setAttribute('aria-expanded', 'false');
    current.input.removeAttribute('aria-activedescendant');
    current = null;
  }

  function choose(value) {
    if (!current || value === undefined) return;
    const { input } = current;
    close();
    input.value = value;
    input.dataset.choosing = 'true';
    try {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } finally { delete input.dataset.choosing; }
    input.focus();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  document.addEventListener('focusin', (event) => {
    if (event.target.matches?.(SELECTOR)) enhance(event.target);
  });
  document.addEventListener('click', (event) => {
    const input = event.target.closest?.(SELECTOR);
    if (!input) return;
    if (current?.input === input) close();
    else open(input);
  });
  document.addEventListener('input', (event) => {
    // choose() fires its own input event after closing; only typing reopens the list.
    if (event.target.matches?.(SELECTOR) && !event.target.dataset.choosing) open(event.target, { filter: true });
  }, true);
  document.addEventListener('keydown', (event) => {
    const input = event.target.closest?.(SELECTOR);
    if (!input) return;
    const isOpen = current?.input === input;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) { open(input); return; }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const last = current.items.length - 1;
      highlight(current.index < 0 ? (step > 0 ? 0 : last) : Math.min(last, Math.max(0, current.index + step)));
    } else if (event.key === 'Enter' && isOpen && current.index >= 0) {
      event.preventDefault();
      choose(current.items[current.index]);
    } else if (event.key === 'Escape' && isOpen) {
      // Close the list only; the dialog around it stays open.
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab' && isOpen) close();
  }, true);
  document.addEventListener('focusout', (event) => {
    if (current?.input === event.target) close();
  });

  window.CategoryPicker = { enhance, open, close };
}());

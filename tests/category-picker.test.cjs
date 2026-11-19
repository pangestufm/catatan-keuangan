const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./helpers/app-harness.cjs');

function key(app, input, name) {
  input.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
}

test('kategori yang sudah terpilih tetap bisa dibuka untuk melihat semua pilihan', t => {
  const app = createApp(); t.after(app.close);
  const input = app.get('categoryInput');
  const total = app.window.document.querySelectorAll('#categoryList option').length;
  input.focus();
  input.value = 'Transport';
  input.click();
  const list = app.window.document.getElementById(input.getAttribute('aria-controls'));
  assert.equal(input.getAttribute('aria-expanded'), 'true');
  assert.equal(list.querySelectorAll('[role="option"]').length, total, 'semua kategori tampil, tidak tersaring isi field');
  assert.equal(list.querySelector('[aria-selected="true"]').textContent, 'Transport');
  list.querySelectorAll('[role="option"]')[0].click();
  assert.notEqual(input.value, 'Transport');
  assert.equal(input.getAttribute('aria-expanded'), 'false');
});

test('field kategori tidak dipindah saat disiapkan, supaya fokus dan klik pertama tidak hilang', t => {
  const app = createApp(); t.after(app.close);
  const input = app.get('categoryInput');
  const parent = input.parentElement;
  const next = input.nextSibling;
  input.focus();
  assert.equal(input.parentElement, parent);
  assert.equal(app.window.document.activeElement, input);
  assert.equal(input.nextElementSibling.getAttribute('role'), 'listbox');
  assert.notEqual(next, null);
});

test('mengetik menyaring pilihan, panah dan Enter memilih, Escape hanya menutup daftar', t => {
  const app = createApp(); t.after(app.close);
  const input = app.get('draftCategoryInput');
  let changed = 0;
  input.addEventListener('change', () => { changed++; });
  input.focus();
  input.value = 'kese';
  input.dispatchEvent(new app.window.Event('input', { bubbles: true }));
  const list = app.window.document.getElementById(input.getAttribute('aria-controls'));
  assert.deepEqual([...list.querySelectorAll('[role="option"]')].map((item) => item.textContent), ['Kesehatan']);
  key(app, input, 'ArrowDown');
  key(app, input, 'Enter');
  assert.equal(input.value, 'Kesehatan');
  assert.equal(changed, 1);
  assert.equal(input.getAttribute('aria-expanded'), 'false', 'event input dari pilihan tidak membuka ulang daftar');
  key(app, input, 'ArrowDown');
  assert.equal(input.getAttribute('aria-expanded'), 'true');
  const escape = new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  input.dispatchEvent(escape);
  assert.equal(escape.defaultPrevented, true, 'dialog di sekitarnya tidak ikut tertutup');
  assert.equal(input.getAttribute('aria-expanded'), 'false');
});

test('kategori baru yang diketik tetap boleh disimpan apa adanya', t => {
  const app = createApp(); t.after(app.close);
  app.setValue('dateInput', '2026-11-19');
  app.setValue('typeInput', 'expense');
  app.setValue('categoryInput', 'Kebutuhan Anak', 'input');
  app.setValue('amountInput', '25000', 'input');
  app.setValue('descriptionInput', 'Susu');
  app.get('transactionForm').requestSubmit();
  assert.equal(app.stored()[0].category, 'Kebutuhan Anak');
});

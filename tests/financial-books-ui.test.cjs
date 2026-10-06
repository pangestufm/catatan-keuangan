const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, transaction } = require('./helpers/app-harness.cjs');

function account(app, prefix, overrides = {}) {
  app.get(`${prefix}AddAccount`).click();
  app.setValue(`${prefix}AccountName`, overrides.name || 'Contoh pribadi');
  app.setValue(`${prefix}AccountDate`, '2026-10-01');
  app.setValue(`${prefix}AccountAmount`, overrides.amount || '1000000', 'input');
  if (overrides.kind) app.setValue(`${prefix}AccountKind`, overrides.kind);
  app.get(`${prefix}AccountForm`).requestSubmit();
}
function entry(app, prefix, { amount = '100000', kind = 'payment', date = '2026-10-06' } = {}) {
  app.get(`${prefix}AddEntry`).click();
  app.setValue(`${prefix}EntryDate`, date);
  app.setValue(`${prefix}EntryAmount`, amount, 'input');
  if (prefix === 'savings') app.setValue(`${prefix}EntryKind`, kind);
  app.setValue(`${prefix}EntryDescription`, 'Catatan contoh');
  app.get(`${prefix}EntryForm`).requestSubmit();
}

test('menu khusus membuka halaman terpisah dan menyembunyikan catat dashboard', t => {
  const app = createApp(); t.after(app.close);
  assert.ok(app.window.FinancialBooks, 'controller halaman khusus tersedia');
  assert.equal(app.get('installmentsPage').hidden, true);
  app.window.FinancialBooks.navigate('installments');
  assert.equal(app.get('dashboardPage').hidden, true);
  assert.equal(app.get('installmentsPage').hidden, false);
  assert.equal(app.get('savingsPage').hidden, true);
  assert.equal(app.get('quickEntryButton').classList.contains('hidden'), true);
  app.get('navQuickEntryButton').click();
  assert.equal(app.get('dashboardPage').hidden, false);
  assert.equal(app.get('installmentsPage').hidden, true);
  assert.equal(app.get('quickEntryModal').open, true);
});

test('pembayaran cicilan dan simpanan tidak mengubah transaksi atau summary utama', t => {
  const app = createApp([transaction({ date: '2026-10-01' })]); t.after(app.close);
  const initial = app.stored();
  const total = app.get('expenseTotal').textContent;
  app.window.FinancialBooks.navigate('installments');
  account(app, 'installment');
  assert.equal(app.get('installmentAccountAmount').value, '1.000.000');
  entry(app, 'installment', { amount: '501227' });
  assert.match(app.get('installmentDetail').textContent, /498\.773/);
  app.window.FinancialBooks.navigate('savings');
  account(app, 'savings', { kind: 'investment', amount: '2000000' });
  entry(app, 'savings', { kind: 'deposit', amount: '300000' });
  entry(app, 'savings', { kind: 'withdrawal', amount: '100000' });
  assert.match(app.get('savingsDetail').textContent, /2\.200\.000/);
  assert.deepEqual(app.stored(), initial);
  assert.equal(app.get('expenseTotal').textContent, total);
});

test('saldo lifetime tetap utuh ketika detail difilter bulan kosong', t => {
  const app = createApp(); t.after(app.close);
  app.window.FinancialBooks.navigate('installments'); account(app, 'installment'); entry(app, 'installment');
  app.setValue('installmentHistoryMonth', '2026-11');
  assert.equal(app.get('installmentHistory').querySelectorAll('[data-entry-id]').length, 0);
  assert.match(app.get('installmentDetail').textContent, /900\.000/);
  app.get('installmentAllMonths').click();
  assert.equal(app.get('installmentHistory').querySelectorAll('[data-entry-id]').length, 1);
});

test('pembayaran berlebih dan penarikan sebelum saldo tersedia tidak disimpan', t => {
  const app = createApp(); t.after(app.close);
  app.window.FinancialBooks.navigate('installments'); account(app, 'installment');
  entry(app, 'installment', { amount: '1000001' });
  assert.equal(app.window.FinancialBooks.getBooks().entries.length, 0);
  assert.equal(app.get('installmentEntryStatus').dataset.type, 'error');
  app.window.FinancialBooks.navigate('savings'); account(app, 'savings', { amount: '0' });
  entry(app, 'savings', { amount: '100000', kind: 'deposit', date: '2026-10-10' });
  entry(app, 'savings', { amount: '100000', kind: 'withdrawal', date: '2026-10-02' });
  assert.equal(app.window.FinancialBooks.getBooks().entries.length, 1);
  assert.equal(app.get('savingsEntryStatus').dataset.type, 'error');
});

test('hapus rekening meminta konfirmasi dan pembatalan mempertahankan history', async t => {
  const app = createApp(); t.after(app.close);
  app.window.FinancialBooks.navigate('savings'); account(app, 'savings');
  entry(app, 'savings', { kind: 'deposit' });
  app.get('savingsDeleteAccount').click();
  assert.equal(app.get('confirmDialog').open, true);
  assert.match(app.get('confirmMessage').textContent, /1/);
  app.get('confirmDialog').close('cancel');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.window.FinancialBooks.getBooks().accounts.length, 1);
  app.get('savingsDeleteAccount').click(); app.get('confirmDialog').close('accept');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.window.FinancialBooks.getBooks().accounts.length, 0);
  assert.equal(app.window.FinancialBooks.getBooks().entries.length, 0);
});

test('reload mengembalikan buku lokal; logout dan workspace lain tidak membocorkan data', t => {
  const app = createApp(); t.after(app.close);
  const books = app.window.FinancialBooks;
  books.navigate('installments'); account(app, 'installment');
  books.endSession();
  books.startSession({ workspaceId: 'workspace-lain', isLocalOnly: true });
  assert.equal(books.getBooks().accounts.length, 0);
  books.startSession({ workspaceId: 'regression-fixture', isLocalOnly: true });
  assert.equal(books.getBooks().accounts.length, 1);
  app.call('logout');
  assert.equal(books.getBooks().accounts.length, 0);
  assert.equal(app.get('bookAccountDialog')?.open || false, false);
});

module.exports = { account, entry };

test('summary pembukuan memakai komponen card master tanpa membungkus detail dalam card', t => {
  const app = createApp(); t.after(app.close);
  for (const [page, prefix] of [['installments', 'installment'], ['savings', 'savings']]) {
    app.window.FinancialBooks.navigate(page);
    account(app, prefix);
    const cards = app.get(`${prefix}Summary`).querySelectorAll('.metric-card');
    assert.equal(cards.length, 3);
    for (const card of cards) {
      assert.ok(card.querySelector('.metric-card-top > span'));
      assert.ok(card.querySelector('.metric-card-top svg, .metric-card-top i'));
      assert.ok(card.querySelector(':scope > strong'));
      assert.ok(card.querySelector(':scope > small'));
    }
    assert.equal(app.get(`${prefix}Detail`).querySelectorAll('.metric-card').length, 0);
  }
});

test('riwayat memakai bingkai tabel master dan perubahan halaman mengembalikan tema dashboard', t => {
  const app = createApp(); t.after(app.close);
  app.window.FinancialBooks.navigate('installments'); account(app, 'installment'); entry(app, 'installment');
  assert.equal(app.window.document.body.dataset.bookPage, 'installments');
  assert.ok(app.get('installmentHistory').classList.contains('table-wrap'));
  assert.ok(app.get('installmentHistory').querySelector('.ledger-table.books-history-table'));
  app.window.FinancialBooks.navigate('savings');
  assert.equal(app.window.document.body.dataset.bookPage, 'savings');
  app.window.FinancialBooks.showDashboard();
  assert.equal(app.window.document.body.dataset.bookPage, 'dashboard');
  assert.equal(app.get('dashboardPage').hidden, false);
});

test('tautan lewati navigasi tetap memfokuskan halaman buku yang aktif', t => {
  const app = createApp(); t.after(app.close);
  app.window.FinancialBooks.navigate('savings');
  app.get('skipContentLink').click();
  assert.equal(app.get('savingsPage').hidden, false);
  assert.equal(app.window.document.activeElement.id, 'savingsPageTitle');
  assert.equal(app.window.location.hash, '#simpanan');
});

test('hapus transaksi harian mempertahankan Cicilan dan Simpanan', async t => {
  const app = createApp([transaction()]); t.after(app.close);
  app.window.FinancialBooks.navigate('installments'); account(app, 'installment'); entry(app, 'installment');
  const books = JSON.stringify(app.window.FinancialBooks.getBooks());
  const deleting = app.call('clearAllData');
  assert.match(app.get('confirmMessage').textContent, /Cicilan dan Simpanan tetap utuh/);
  app.get('confirmDialog').close('accept'); await deleting;
  assert.equal(app.stored().length, 0);
  assert.equal(JSON.stringify(app.window.FinancialBooks.getBooks()), books);
});

test('konfirmasi hapus harian tidak melintasi logout ke sesi baru', async t => {
  const app = createApp([transaction()]); t.after(app.close);
  const deleting = app.call('clearAllData');
  app.call('logout');
  app.setValue('workspaceInput', 'regression-fixture'); app.call('enterLocalMode');
  app.get('confirmDialog').close('accept'); await deleting;
  assert.equal(app.stored().length, 1);
});

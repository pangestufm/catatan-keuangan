const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, transaction } = require('./helpers/app-harness.cjs');

const rows = [
  transaction({ id: 'g', date: '2026-11-01', type: 'income', category: 'Gaji', description: 'Gaji', amount: 10000000 }),
  transaction({ id: 'm', date: '2026-11-02', type: 'expense', category: '<img src=x onerror=alert(1)>', description: 'Makan', amount: 2000000 }),
  transaction({ id: 't', date: '2026-11-03', type: 'expense', category: 'Tabungan & Investasi', description: 'Setor', amount: 2500000 }),
  transaction({ id: 'c', date: '2026-11-04', type: 'expense', category: 'Kewajiban & Cicilan', description: 'Cicilan', amount: 1000000 }),
];

test('tab Laporan membuka halaman sendiri dengan scorecard, laporan, dan neraca', t => {
  const app = createApp(rows); t.after(app.close);
  app.window.FinancialBooks.navigate('reports');
  assert.equal(app.window.location.hash, '#laporan');
  assert.equal(app.get('reportsPage').hidden, false);
  assert.equal(app.get('dashboardPage').hidden, true);
  assert.equal(app.get('installmentsPage').hidden, true);
  assert.equal(app.window.document.querySelector('.main-nav a[data-book-route="reports"]').getAttribute('aria-current'), 'page');
  app.setValue('reportMonthInput', '2026-11');
  const cards = app.window.document.querySelectorAll('#scoreGrid .score-card');
  assert.equal(cards.length, 4);
  assert.match(cards[0].textContent, /25,0%/);
  assert.match(cards[1].textContent, /10,0%/);
  assert.match(app.get('statementBody').textContent, /Sisa kas periode/);
  assert.match(app.get('balanceBody').textContent, /Kekayaan bersih/);
  assert.equal(app.window.document.querySelector('#reportsPage img'), null, 'nama kategori tidak dirender sebagai HTML');
  assert.match(app.get('statementBody').textContent, /<img src=x/);
});

test('sisa kas laporan bulanan sama dengan saldo bersih ringkasan dan tidak mengubah data', t => {
  const app = createApp(rows); t.after(app.close);
  const before = JSON.stringify(app.stored());
  app.get('monthFilterInput').value = '2026-11';
  app.get('monthFilterInput').dispatchEvent(new app.window.Event('change', { bubbles: true }));
  const dashboard = app.get('balanceTotal').textContent.replace(/\s/g, '');
  app.window.FinancialBooks.navigate('reports');
  app.setValue('reportMonthInput', '2026-11');
  const total = app.window.document.querySelector('.statement-total .statement-current .amount').textContent.replace(/\s/g, '');
  assert.equal(total, dashboard);
  app.window.document.querySelector('[data-report-mode="year"]').click();
  assert.equal(app.get('reportYearField').hidden, false);
  assert.match(app.get('yearBreakdown').textContent, /Total 2026/);
  assert.equal(JSON.stringify(app.stored()), before);
});

test('pilihan susunan keluarga mengubah target dana darurat dan disimpan sebagai preferensi', t => {
  const app = createApp(rows); t.after(app.close);
  app.window.FinancialBooks.navigate('reports');
  app.setValue('reportHouseholdInput', 'child2');
  assert.match(app.window.document.querySelectorAll('#scoreGrid .score-card')[2].textContent, /12 bulan/);
  assert.equal(app.window.localStorage.getItem('catatan-keuangan-report-household'), 'child2');
});

test('membuka Laporan hanya membaca: penyimpanan transaksi dan pembukuan tidak berubah sama sekali', t => {
  const app = createApp(rows); t.after(app.close);
  const books = { books: { accounts: [{ id: 'lama', kind: 'savings', name: 'Tabungan lama', startDate: '2026-01-01', totalAmount: 0, openingBalance: 5000000, notes: '' }], entries: [] }, baseBooks: { accounts: [], entries: [] }, pending: [], revision: 3 };
  app.window.localStorage.setItem('catatan-keuangan-books-v1-regression-fixture', JSON.stringify(books));
  app.window.FinancialBooks.startSession({ workspaceId: 'regression-fixture', accessToken: '', isLocalOnly: true });
  const snapshot = () => Object.fromEntries(Object.keys(app.window.localStorage).sort().map((key) => [key, app.window.localStorage.getItem(key)]));
  const before = snapshot();
  app.window.FinancialBooks.navigate('reports');
  app.setValue('reportMonthInput', '2026-11');
  app.window.document.querySelector('[data-report-mode="year"]').click();
  app.window.FinancialBooks.navigate('dashboard');
  assert.deepEqual(snapshot(), before);
});

test('neraca hanya dari transaksi harian: buku Simpanan/Cicilan diabaikan, setoran tabungan dan cicilan dari transaksi', t => {
  const app = createApp(rows); t.after(app.close);
  const books = { books: { accounts: [{ id: 'lama', kind: 'savings', name: 'Tabungan lama', startDate: '2026-01-01', totalAmount: 0, openingBalance: 5000000, notes: '' }], entries: [] }, baseBooks: { accounts: [], entries: [] }, pending: [], revision: 3 };
  app.window.localStorage.setItem('catatan-keuangan-books-v1-regression-fixture', JSON.stringify(books));
  app.window.FinancialBooks.startSession({ workspaceId: 'regression-fixture', accessToken: '', isLocalOnly: true });
  app.window.FinancialBooks.navigate('reports');
  app.setValue('reportMonthInput', '2026-11');
  const balance = app.get('balanceBody').textContent;
  assert.doesNotMatch(balance, /Tabungan lama/, 'buku Simpanan tidak dipakai');
  assert.match(balance, /Setoran bersih/);
  assert.match(balance, /Rp\s2\.500\.000/, 'setoran Tabungan & Investasi dari transaksi');
  assert.match(balance, /Cicilan/);
  assert.match(balance, /Belum bisa dihitung/, 'sisa pokok cicilan tidak ada di transaksi');
  assert.match(app.window.document.querySelectorAll('#scoreGrid .score-card')[3].textContent, /Data belum lengkap/);
});

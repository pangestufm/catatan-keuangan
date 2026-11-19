const test = require('node:test');
const assert = require('node:assert/strict');
const Report = require('../finance-report-model.js');
const Books = require('../financial-books-model.js');

const tx = (date, type, category, amount) => ({ date, type, category, amount, description: 'contoh' });
const month = (key) => ({ mode: 'month', key });

test('laporan memisahkan setoran tabungan dan cicilan dari belanja, sisa kas sama dengan saldo harian', () => {
  const rows = [
    tx('2026-11-01', 'income', 'Gaji', 10000000),
    tx('2026-11-02', 'expense', 'Konsumsi Harian (Makan & Minum)', 3000000),
    tx('2026-11-03', 'expense', 'Kewajiban & Cicilan', 2000000),
    tx('2026-11-04', 'expense', 'Tabungan & Investasi', 1500000),
    tx('2026-11-05', 'income', 'Tabungan & Investasi', 500000),
    tx('2026-10-30', 'income', 'Gaji', 999),
  ];
  const result = Report.statement(rows, month('2026-11'));
  assert.equal(result.revenue, 10000000, 'pencairan tabungan bukan pendapatan');
  assert.equal(result.living, 3000000);
  assert.equal(result.debtPayments, 2000000);
  assert.equal(result.deposits, 1500000);
  assert.equal(result.withdrawals, 500000);
  assert.equal(result.operatingSurplus, 5000000);
  const income = rows.filter((r) => r.date.startsWith('2026-11') && r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const expense = rows.filter((r) => r.date.startsWith('2026-11') && r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  assert.equal(result.cashChange, income - expense);
  assert.equal(result.count, 5);
});

test('rasio tabungan, DSR dan statusnya mengikuti standar 10/20% dan 30/35%', () => {
  const rows = [
    tx('2026-11-01', 'income', 'Gaji', 10000000),
    tx('2026-11-03', 'expense', 'Kewajiban & Cicilan', 3200000),
    tx('2026-11-04', 'expense', 'Tabungan & Investasi', 1500000),
  ];
  const result = Report.ratios(rows, Books.emptyState(), month('2026-11'), 'child1');
  assert.equal(result.savings.value, 0.15);
  assert.equal(result.savings.status, 'fair');
  assert.equal(result.debt.value, 0.32);
  assert.equal(result.debt.status, 'fair');
  assert.equal(result.debt.excess, 200000);
  assert.equal(Report.grade('savings', 0.2), 'good');
  assert.equal(Report.grade('savings', 0.099), 'poor');
  assert.equal(Report.grade('debt', 0.3), 'good');
  assert.equal(Report.grade('debt', 0.36), 'poor');
  assert.equal(Report.grade('solvency', -0.1), 'poor');
  assert.equal(Report.grade('liquidity', 9, 'child1'), 'good');
  assert.equal(Report.grade('liquidity', 6, 'child1'), 'fair');
  assert.equal(Report.grade('liquidity', 3, 'single'), 'good');
});

test('setoran atau cicilan yang tercatat di harian dan di buku tidak dihitung dua kali', () => {
  const books = Books.validateState({
    accounts: [
      { id: 'tab', kind: 'savings', name: 'Tabungan', startDate: '2026-01-01', totalAmount: 0, openingBalance: 0, notes: '' },
      { id: 'kpr', kind: 'installment', name: 'KPR', startDate: '2026-01-01', totalAmount: 100000000, openingBalance: 0, notes: '' },
    ],
    entries: [
      { id: 'd1', accountId: 'tab', kind: 'deposit', date: '2026-11-04', amount: 1500000, description: '' },
      { id: 'p1', accountId: 'kpr', kind: 'payment', date: '2026-11-05', amount: 2500000, description: '' },
    ],
  });
  const rows = [
    tx('2026-11-01', 'income', 'Gaji', 10000000),
    tx('2026-11-04', 'expense', 'Tabungan & Investasi', 1500000),
    tx('2026-11-05', 'expense', 'Kewajiban & Cicilan', 2000000),
  ];
  const result = Report.ratios(rows, books, month('2026-11'));
  assert.equal(result.savings.numerator, 1500000, 'setoran sama di dua tempat dihitung sekali');
  assert.equal(result.debt.numerator, 2500000, 'buku cicilan lebih lengkap dipakai');
  assert.equal(result.debt.fromBooks, true);
});

test('neraca memakai saldo per akhir periode: entri sesudahnya dan rekening yang belum mulai tidak ikut', () => {
  const books = Books.validateState({
    accounts: [
      { id: 'tab', kind: 'savings', name: 'Tabungan', startDate: '2026-01-01', totalAmount: 0, openingBalance: 5000000, notes: '' },
      { id: 'rumah', kind: 'asset', name: 'Rumah', startDate: '2026-01-01', totalAmount: 0, openingBalance: 300000000, notes: '' },
      { id: 'emas', kind: 'investment', name: 'Emas', startDate: '2026-12-01', totalAmount: 0, openingBalance: 9000000, notes: '' },
      { id: 'kpr', kind: 'installment', name: 'KPR', startDate: '2026-01-01', totalAmount: 200000000, openingBalance: 0, notes: '' },
    ],
    entries: [
      { id: 'w1', accountId: 'tab', kind: 'withdrawal', date: '2026-11-10', amount: 1000000, description: '' },
      { id: 'd2', accountId: 'tab', kind: 'deposit', date: '2026-12-02', amount: 7000000, description: '' },
      { id: 'p1', accountId: 'kpr', kind: 'payment', date: '2026-11-05', amount: 2000000, description: '' },
    ],
  });
  const rows = [tx('2026-11-01', 'income', 'Gaji', 1000000), tx('2026-11-02', 'expense', 'Belanja', 3000000)];
  const sheet = Report.balanceSheet(rows, books, '2026-11-30');
  assert.equal(sheet.cash, -2000000);
  assert.equal(sheet.groups.savings[0].amount, 4000000);
  assert.equal(sheet.groups.investment.length, 0);
  assert.equal(sheet.otherAssets, 300000000);
  assert.equal(sheet.liabilities, 198000000);
  assert.equal(sheet.totalAssets, -2000000 + 4000000 + 300000000);
  assert.equal(sheet.netWorth, sheet.totalAssets - sheet.liabilities);
  assert.equal(sheet.liquidForRatio, 4000000, 'kas negatif tidak mengurangi dana darurat');
});

test('dana darurat dibagi rata-rata pengeluaran 3 bulan terakhir yang ada pengeluarannya, tanpa setoran tabungan', () => {
  const books = Books.validateState({ accounts: [{ id: 'tab', kind: 'savings', name: 'Tabungan', startDate: '2026-01-01', totalAmount: 0, openingBalance: 30000000, notes: '' }], entries: [] });
  const rows = [
    tx('2026-06-10', 'expense', 'Belanja', 99000000),
    tx('2026-07-10', 'expense', 'Belanja', 4000000),
    tx('2026-09-10', 'expense', 'Belanja', 5000000),
    tx('2026-09-11', 'expense', 'Tabungan & Investasi', 50000000),
    tx('2026-10-10', 'expense', 'Kewajiban & Cicilan', 6000000),
    tx('2026-10-01', 'income', 'Gaji', 60000000),
  ];
  const result = Report.ratios(rows, books, month('2026-10'), 'child1');
  assert.deepEqual(result.spending.months, ['2026-07', '2026-09', '2026-10']);
  assert.equal(result.spending.average, 5000000);
  assert.equal(result.liquidity.denominator, 5000000);
  assert.equal(result.liquidity.status, 'fair');
  assert.equal(result.target, 9);
});

test('tanpa rekening di buku, likuiditas dan solvabilitas ditandai belum lengkap, bukan sehat palsu', () => {
  const rows = [tx('2026-11-01', 'income', 'Gaji', 10000000), tx('2026-11-02', 'expense', 'Belanja', 1000000)];
  const result = Report.ratios(rows, Books.emptyState(), month('2026-11'));
  assert.equal(result.solvency.value, 1);
  assert.equal(result.solvency.status, 'incomplete');
  assert.equal(result.liquidity.status, 'incomplete');
});

test('periode bulanan dan tahunan: batas tanggal, periode sebelumnya, kabisat', () => {
  assert.deepEqual(Report.range(month('2028-02')), { start: '2028-02-01', end: '2028-02-29' });
  assert.deepEqual(Report.previous(month('2026-01')), month('2025-12'));
  assert.deepEqual(Report.previous({ mode: 'year', key: '2026' }), { mode: 'year', key: '2025' });
  assert.equal(Report.yearBreakdown([tx('2026-03-01', 'income', 'Gaji', 5)], 2026)[2].revenue, 5);
});

test('buku pembukuan menerima jenis aset lain tanpa mengubah aturan jenis lama', () => {
  const books = Books.applyOperation(Books.emptyState(), { id: 'op-1', type: 'upsertAccount', record: { id: 'motor', kind: 'asset', name: 'Motor', startDate: '2026-11-01', totalAmount: 0, openingBalance: 15000000, notes: '' } });
  assert.equal(books.accounts[0].kind, 'asset');
  assert.throws(() => Books.validateState({ accounts: [{ id: 'x', kind: 'rumah', name: 'X', startDate: '2026-11-01', totalAmount: 0, openingBalance: 0, notes: '' }], entries: [] }));
});

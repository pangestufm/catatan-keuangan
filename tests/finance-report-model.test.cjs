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
  const result = Report.ratios(rows, month('2026-11'), 'child1');
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

const named = (date, type, category, amount, description) => ({ date, type, category, amount, description });

test('neraca hanya dari transaksi: kas, setoran bersih tabungan per akhir periode, transaksi sesudahnya tidak ikut', () => {
  const rows = [
    tx('2026-06-01', 'income', 'Gaji', 20000000),
    tx('2026-06-02', 'expense', 'Belanja', 3000000),
    tx('2026-06-03', 'expense', 'Tabungan & Investasi', 6000000),
    tx('2026-07-11', 'income', 'Tabungan & Investasi', 1000000),
    tx('2026-12-02', 'expense', 'Tabungan & Investasi', 7000000),
  ];
  const sheet = Report.balanceSheet(rows, '2026-11-30');
  assert.equal(sheet.cash, 20000000 - 3000000 - 6000000 + 1000000);
  assert.deepEqual(sheet.savings, { deposited: 6000000, withdrawn: 1000000, amount: 5000000 });
  assert.equal(sheet.totalAssets, sheet.cash + 5000000);
  assert.equal(sheet.firstDate, '2026-06-01');
  assert.equal(sheet.debtsKnown, true);
  assert.equal(sheet.netWorth, sheet.totalAssets);
  assert.equal(sheet.liquidForRatio, sheet.cash + 5000000);
});

test('pencairan simpanan lama yang lebih besar dari setoran ditulis nol, bukan aset negatif', () => {
  const rows = [
    tx('2026-07-01', 'expense', 'Tabungan & Investasi', 2000000),
    tx('2026-07-11', 'income', 'Tabungan & Investasi', 33000000),
    tx('2026-07-12', 'expense', 'Belanja', 40000000),
  ];
  const sheet = Report.balanceSheet(rows, '2026-07-31');
  assert.equal(sheet.savings.amount, 0);
  assert.equal(sheet.cash, -9000000);
  assert.equal(sheet.liquidForRatio, 0, 'kas negatif tidak mengurangi dana darurat');
});

test('cicilan berjalan dikelompokkan dari keterangan transaksi; ada cicilan berarti sisa utang dan solvabilitas belum diketahui', () => {
  assert.equal(Report.installmentKey('Cicilan CC'), 'cc');
  assert.equal(Report.installmentKey('Bayar Cc'), 'cc');
  assert.equal(Report.installmentKey('CC Bulan Juni'), 'cc');
  assert.equal(Report.installmentKey('Cicilan Rumah'), 'rumah');
  const rows = [
    named('2026-06-01', 'income', 'Gaji', 30000000, 'Gaji'),
    named('2026-06-01', 'expense', 'Kewajiban & Cicilan', 5012278, 'Cicilan Rumah'),
    named('2026-07-01', 'expense', 'Kewajiban & Cicilan', 7800000, 'CC Bulan Juni'),
    named('2026-11-01', 'expense', 'Kewajiban & Cicilan', 10500000, 'Cicilan Cc'),
    named('2026-11-01', 'expense', 'Kewajiban & Cicilan', 5012278, 'Cicilan Rumah'),
    named('2026-03-01', 'expense', 'Kewajiban & Cicilan', 900000, 'Cicilan Motor'),
  ];
  const list = Report.activeInstallments(rows, '2026-11-30');
  assert.deepEqual(list.map((item) => [item.name, item.monthly, item.lastDate]), [['Cicilan Cc', 10500000, '2026-11-01'], ['Cicilan Rumah', 5012278, '2026-11-01']], 'motor lunas Maret tidak berjalan lagi');
  const result = Report.ratios(rows, month('2026-11'));
  assert.equal(result.sheet.debtsKnown, false);
  assert.equal(result.sheet.netWorth, null);
  assert.equal(result.solvency.value, null);
  assert.equal(result.solvency.status, 'incomplete');
  assert.equal(result.debt.numerator, 15512278, 'DSR dari transaksi cicilan periode itu');
});

test('tanpa cicilan berjalan, solvabilitas dihitung dari transaksi (tidak ada utang tercatat)', () => {
  const rows = [tx('2026-11-01', 'income', 'Gaji', 10000000), tx('2026-11-02', 'expense', 'Belanja', 1000000)];
  const result = Report.ratios(rows, month('2026-11'));
  assert.equal(result.solvency.value, 1);
  assert.equal(result.solvency.status, 'good');
  assert.equal(result.liquidity.status, 'good');
});

test('dana darurat dibagi rata-rata pengeluaran 3 bulan terakhir yang ada pengeluarannya, tanpa setoran tabungan', () => {
  const rows = [
    tx('2026-06-10', 'expense', 'Belanja', 99000000),
    tx('2026-07-10', 'expense', 'Belanja', 4000000),
    tx('2026-09-10', 'expense', 'Belanja', 5000000),
    tx('2026-09-11', 'expense', 'Tabungan & Investasi', 50000000),
    tx('2026-10-10', 'expense', 'Kewajiban & Cicilan', 6000000),
    tx('2026-10-01', 'income', 'Gaji', 60000000),
  ];
  const result = Report.ratios(rows, month('2026-10'), 'child1');
  assert.deepEqual(result.spending.months, ['2026-07', '2026-09', '2026-10']);
  assert.equal(result.spending.average, 5000000);
  assert.equal(result.liquidity.denominator, 5000000);
  // Kas 60 jt − 99 − 4 − 5 − 50 − 6 = −104 jt (dianggap 0) + setoran tabungan 50 jt = 10 bulan.
  assert.equal(result.liquidity.numerator, 50000000);
  assert.equal(result.liquidity.status, 'good');
  assert.equal(result.target, 9);
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

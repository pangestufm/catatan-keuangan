const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, XLSX } = require('./helpers/app-harness.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));

function deferred() {
  let resolve, reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

const dailyRows = [
  ['ID', 'Tanggal', 'Jenis', 'Kategori', 'Deskripsi', 'Nominal'],
  ['new-daily', '2026-10-03', 'Pengeluaran', 'Transport', 'Perjalanan contoh', 45000],
];
const specialRows = (marker = 'Pembukuan khusus v1') => [
  [marker, 'ID', 'Rekening ID', 'Jenis', 'Nama', 'Tanggal', 'Total Kewajiban', 'Saldo Awal', 'Nominal', 'Keterangan'],
  ...Array.from({ length: 7 }, (_, index) => ['account', `a-${index}`, '', 'savings', `Dana ${index}`, '2026-10-01', 0, 1000000, '', '']),
];

function importEvent(app, rows, format = 'xlsx', read) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Backup');
  const bytes = format === 'csv'
    ? Buffer.from(XLSX.utils.sheet_to_csv(workbook.Sheets.Backup))
    : new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }));
  const buffer = app.window.Uint8Array.from(bytes).buffer;
  const event = { target: { files: [{ name: `backup.${format}`, arrayBuffer: read || (async () => buffer) }], value: 'old-file' } };
  return { event, buffer };
}

function reopenSameWorkspace(app) {
  app.call('logout');
  app.setValue('workspaceInput', 'regression-fixture');
  app.call('enterLocalMode');
}

function seed(app) {
  const books = { accounts: [
    { id: '000123', kind: 'installment', name: 'Rumah contoh', startDate: '2026-10-01', totalAmount: 5012278, openingBalance: 0, notes: 'Kontrak, contoh' },
    { id: 'investment-1', kind: 'investment', name: 'Investasi contoh', startDate: '2026-09-01', totalAmount: 0, openingBalance: 2500000, notes: '' },
  ], entries: [{ id: 'entry-0001', accountId: '000123', kind: 'payment', date: '2026-10-05', amount: 1234567, description: 'Pembayaran "contoh"' }] };
  const initial = app.window.FinancialBooks.reviewImport(books);
  app.get('confirmDialog').close('accept');
  return initial;
}

for (const format of ['csv', 'xls']) {
  test(`backup global ${format} menyertakan buku khusus dan tidak dibaca sebagai transaksi harian`, async t => {
    const app = createApp(); t.after(app.close);
    assert.ok(app.window.FinancialBooks, 'controller backup khusus tersedia');
    await seed(app);
    app.call(format === 'csv' ? 'exportCsv' : 'exportExcel');
    assert.equal(app.downloads.length, 1);
    const buffer = app.window.Uint8Array.from(new Uint8Array(await app.downloads[0].arrayBuffer())).buffer;
    const workbook = app.call('readImportWorkbook', buffer, `backup.${format}`);
    const restored = app.window.FinancialBooks.parseBackup(workbook);
    assert.equal(JSON.stringify(restored), JSON.stringify(app.window.FinancialBooks.getBooks()));
    assert.equal(app.call('parseWorkbookTransactions', workbook).length, 0);
    assert.equal(restored.accounts[0].id, '000123');
    assert.equal(restored.entries[0].amount, 1234567);
  });
}

test('restore khusus menunggu konfirmasi, additive dan tidak menggandakan impor ulang', async t => {
  const app = createApp(); t.after(app.close);
  assert.ok(app.window.FinancialBooks);
  const pending = seed(app);
  await pending;
  const books = app.window.FinancialBooks.getBooks();
  const source = createApp(); t.after(source.close);
  const review = source.window.FinancialBooks.reviewImport(books);
  assert.equal(source.window.FinancialBooks.getBooks().accounts.length, 0);
  source.get('confirmDialog').close('cancel'); await review;
  assert.equal(source.window.FinancialBooks.getBooks().accounts.length, 0);
  const accepted = source.window.FinancialBooks.reviewImport(books);
  source.get('confirmDialog').close('accept'); await accepted;
  await source.window.FinancialBooks.reviewImport(books);
  assert.equal(source.window.FinancialBooks.getBooks().entries.length, 1);
  assert.equal(source.stored().length, 0);
});

test('backup dengan tanggal atau referensi rekening rusak ditolak seluruhnya', async t => {
  const app = createApp(); t.after(app.close);
  assert.ok(app.window.FinancialBooks); await seed(app);
  const rows = app.window.FinancialBooks.exportRows();
  rows[3][2] = 'rekening-tidak-ada';
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Pembukuan Khusus');
  assert.throws(() => app.window.FinancialBooks.parseBackup(wb));
  assert.equal(app.window.FinancialBooks.getBooks().entries.length, 1);
});

for (const format of ['csv', 'xlsx']) {
  test(`marker khusus v2 ${format} tidak pernah menjadi transaksi harian`, t => {
    const app = createApp(); t.after(app.close);
    const { buffer } = importEvent(app, specialRows('Pembukuan khusus v2'), format);
    const workbook = app.call('readImportWorkbook', buffer, `backup.${format}`);
    assert.equal(app.call('parseWorkbookTransactions', workbook).length, 0);
  });

  test(`impor global ${format} menolak versi khusus yang tidak didukung tanpa konfirmasi harian`, async t => {
    const app = createApp(); t.after(app.close);
    app.window.console.error = () => {};
    const { event } = importEvent(app, specialRows('PEMBUKUAN KHUSUS v2'), format);
    const importing = app.call('importExcelFile', event);
    await tick();
    const opened = app.get('confirmDialog').open;
    if (opened) app.get('confirmDialog').close('accept');
    await importing;
    assert.equal(opened, false, 'unsupported special books must not reach daily confirmation');
    assert.equal(app.stored().length, 0);
    assert.equal(app.window.FinancialBooks.getBooks().accounts.length, 0);
    assert.equal(app.get('importStatus').dataset.type, 'error');
  });
}

test('marker versi khusus membatasi bagian transaksi harian dalam backup gabungan', t => {
  const app = createApp(); t.after(app.close);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ...dailyRows, [], specialRows('Pembukuan khusus v2')[0],
    ['special-looking-row', '2026-10-04', 'Pengeluaran', 'Tabungan', 'Bukan transaksi harian', 1000000],
  ]), 'Backup');
  const parsed = app.call('parseWorkbookTransactions', wb);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, 'new-daily');
});

test('marker khusus tetap ditolak bila controller pembukuan tidak tersedia', async t => {
  const app = createApp(); t.after(app.close);
  app.window.FinancialBooks = undefined;
  app.window.console.error = () => {};
  const { event, buffer } = importEvent(app, specialRows('Pembukuan khusus v2'));
  const workbook = app.call('readImportWorkbook', buffer, 'backup.xlsx');
  const parsed = app.call('parseWorkbookTransactions', workbook);
  const importing = app.call('importExcelFile', event);
  await tick();
  const opened = app.get('confirmDialog').open;
  if (opened) app.get('confirmDialog').close('accept');
  await importing;
  assert.equal(parsed.length, 0, 'missing controller must not enable daily parser fallback');
  assert.equal(opened, false);
  assert.equal(app.stored().length, 0);
  assert.equal(app.get('importStatus').dataset.type, 'error');
});

for (const [name, rows] of [['harian', dailyRows], ['khusus', specialRows()]]) {
  test(`baca file ${name} sesi lama berhenti setelah logout dan login workspace sama`, async t => {
    const app = createApp(); t.after(app.close);
    const read = deferred();
    const { event, buffer } = importEvent(app, rows, 'xlsx', () => read.promise);
    const importing = app.call('importExcelFile', event);
    reopenSameWorkspace(app);
    read.resolve(buffer);
    await tick();
    const opened = app.get('confirmDialog').open;
    if (opened) app.get('confirmDialog').close('accept');
    await importing;
    assert.equal(opened, false, 'an old read must not open a dialog in the new session');
    assert.equal(app.stored().length, 0);
    assert.equal(app.window.FinancialBooks.getBooks().accounts.length, 0);
  });
}

test('inisialisasi ulang sesi workspace sama membatalkan pembacaan file lama', async t => {
  const app = createApp(); t.after(app.close);
  const read = deferred();
  const { event, buffer } = importEvent(app, dailyRows, 'xlsx', () => read.promise);
  const importing = app.call('importExcelFile', event);
  app.call('initializeSession');
  read.resolve(buffer);
  await tick();
  const opened = app.get('confirmDialog').open;
  if (opened) app.get('confirmDialog').close('accept');
  await importing;
  assert.equal(opened, false);
  assert.equal(app.stored().length, 0);
});

test('konfirmasi transaksi harian sesi lama tidak boleh menyimpan setelah login ulang', async t => {
  const app = createApp(); t.after(app.close);
  const { event } = importEvent(app, dailyRows);
  const importing = app.call('importExcelFile', event);
  await tick();
  assert.equal(app.get('confirmDialog').open, true);
  reopenSameWorkspace(app);
  app.get('confirmDialog').close('accept');
  await importing;
  assert.equal(app.stored().length, 0);
});

test('sesi lama tidak melanjutkan impor harian setelah tinjauan buku khusus selesai', async t => {
  const app = createApp(); t.after(app.close);
  const { event } = importEvent(app, [...dailyRows, [], ...specialRows()]);
  const importing = app.call('importExcelFile', event);
  await tick();
  assert.match(app.get('confirmTitle').textContent, /pembukuan khusus/i);
  reopenSameWorkspace(app);
  app.get('confirmDialog').close('accept');
  await tick();
  const opened = app.get('confirmDialog').open;
  if (opened) app.get('confirmDialog').close('accept');
  await importing;
  assert.equal(opened, false, 'old special-book review must not advance to daily import');
  assert.equal(app.stored().length, 0);
  assert.equal(app.window.FinancialBooks.getBooks().accounts.length, 0);
});

test('kegagalan baca sesi lama tidak mengubah status atau input impor sesi baru', async t => {
  const app = createApp(); t.after(app.close);
  app.window.console.error = () => {};
  const read = deferred();
  const { event } = importEvent(app, dailyRows, 'xlsx', () => read.promise);
  const importing = app.call('importExcelFile', event);
  reopenSameWorkspace(app);
  app.get('importStatus').textContent = 'Impor sesi baru sedang dibaca';
  app.get('importStatus').dataset.type = 'info';
  event.target.value = 'new-file';
  read.reject(new Error('Old read failed'));
  await importing;
  assert.equal(app.get('importStatus').textContent, 'Impor sesi baru sedang dibaca');
  assert.equal(app.get('importStatus').dataset.type, 'info');
  assert.equal(event.target.value, 'new-file');
});

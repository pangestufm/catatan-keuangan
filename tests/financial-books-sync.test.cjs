const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./helpers/app-harness.cjs');
const Model = require('../financial-books-model.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const response = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data });
const config = { workspaceId: 'regression-fixture', accessToken: 'test-only', isLocalOnly: false };
const debt = { id: 'a-1', kind: 'installment', name: 'Rumah contoh', startDate: '2026-10-01', totalAmount: 1000000, openingBalance: 0, notes: '' };
function putAccount(app) {
  app.get('installmentAddAccount').click();
  app.setValue('installmentAccountName', debt.name);
  app.setValue('installmentAccountDate', debt.startDate);
  app.setValue('installmentAccountAmount', '1000000', 'input');
  app.get('installmentAccountForm').requestSubmit();
}

test('cache yang diubah tab lain tidak ditimpa oleh tab lama', t => {
  const app = createApp(); t.after(app.close);
  const books = app.window.FinancialBooks;
  books.navigate('installments');
  const key = 'catatan-keuangan-books-v1-regression-fixture';
  const external = JSON.stringify({ books: { accounts: [debt], entries: [] }, baseBooks: Model.emptyState(), pending: [], revision: 0 });
  app.window.localStorage.setItem(key, external);
  putAccount(app);
  assert.equal(app.window.localStorage.getItem(key), external);
  assert.match(app.get('installmentAccountStatus').textContent, /tab lain/i);
});

test('hanya satu tab memegang hak tulis dan logout melepaskan lock workspace', async t => {
  let held = false;
  const locks = { request: async (_name, _options, callback) => {
    if (held) return callback(null);
    held = true;
    try { return await callback({ name: 'fixture-lock' }); }
    finally { held = false; }
  } };
  const first = createApp(), second = createApp(); t.after(first.close); t.after(second.close);
  for (const app of [first, second]) {
    Object.defineProperty(app.window.navigator, 'locks', { value: locks });
    app.window.FinancialBooks.startSession({ ...config, isLocalOnly: true });
    app.window.FinancialBooks.navigate('installments');
  }
  putAccount(first); putAccount(second);
  assert.equal(first.window.FinancialBooks.getBooks().accounts.length, 1);
  assert.equal(second.window.FinancialBooks.getBooks().accounts.length, 0);
  assert.match(second.get('installmentAccountStatus').textContent, /tab lain/i);
  first.window.FinancialBooks.endSession(); await tick();
  second.window.FinancialBooks.startSession({ ...config, isLocalOnly: true });
  putAccount(second);
  assert.equal(second.window.FinancialBooks.getBooks().accounts.length, 1);
  second.window.FinancialBooks.endSession();
});

test('discard tidak menerima perubahan baru selama snapshot pengganti masih dimuat', async t => {
  let release; let deferred = false;
  const app = createApp([], { fetch: async () => {
    if (deferred) return new Promise(resolve => { release = resolve; });
    throw new Error('Offline simulasi');
  } }); t.after(app.close);
  app.window.FinancialBooks.startSession(config); await tick();
  app.window.FinancialBooks.navigate('installments'); putAccount(app); await tick();
  deferred = true;
  app.get('installmentsPage').querySelector('[data-book-action="discard"]').click();
  app.get('confirmDialog').close('accept'); await tick();
  putAccount(app);
  assert.match(app.get('installmentAccountStatus').textContent, /pembatalan/i);
  release(response(200, { books: Model.emptyState(), revision: 0 })); await tick();
  assert.equal(app.window.FinancialBooks.getBooks().accounts.length, 0);
});

test('form lama tidak menimpa perubahan rekening yang baru dimuat dari server', async t => {
  let data = { books: { accounts: [debt], entries: [] }, revision: 1 };
  const app = createApp([], { fetch: async () => response(200, data) }); t.after(app.close);
  app.window.FinancialBooks.startSession(config); await tick();
  app.window.FinancialBooks.navigate('installments');
  app.get('installmentEditAccount').click();
  data = { books: { accounts: [{ ...debt, name: 'Nama baru dari perangkat lain' }], entries: [] }, revision: 2 };
  app.get('installmentsPage').querySelector('[data-book-action="retry"]').click(); await tick();
  app.setValue('installmentAccountNotes', 'Catatan dari form lama');
  app.get('installmentAccountForm').requestSubmit(); await tick();
  assert.equal(app.window.FinancialBooks.getBooks().accounts[0].name, data.books.accounts[0].name);
  assert.match(app.get('installmentAccountStatus').textContent, /berubah/i);
  assert.equal(app.requests.filter(req => req.method === 'POST').length, 0);
});

for (const target of ['account', 'entry']) {
  test(`konfirmasi hapus ${target} dibatalkan jika catatan berubah sebelum persetujuan`, async t => {
    const payment = { id: 'payment-1', accountId: debt.id, kind: 'payment', date: '2026-10-02', amount: 100000, description: '' };
    let data = { books: { accounts: [debt], entries: [payment] }, revision: 1 };
    const app = createApp([], { fetch: async (_url, req) => {
      if (req.method === 'POST') throw new Error('Stale delete must not be sent');
      return response(200, data);
    } }); t.after(app.close);
    app.window.FinancialBooks.startSession(config); await tick();
    app.window.FinancialBooks.navigate('installments');
    if (target === 'account') app.get('installmentDeleteAccount').click();
    else app.get('installmentHistory').querySelector('[data-book-action="delete-entry"]').click();
    data = { books: { accounts: [debt], entries: target === 'account'
      ? [payment, { ...payment, id: 'payment-2', date: '2026-10-03' }]
      : [{ ...payment, amount: 200000 }] }, revision: 2 };
    app.get('installmentsPage').querySelector('[data-book-action="retry"]').click(); await tick();
    app.get('confirmDialog').close('accept'); await tick();
    assert.equal(JSON.stringify(app.window.FinancialBooks.getBooks()), JSON.stringify(Model.validateState(data.books)));
    assert.equal(app.requests.filter(req => req.method === 'POST').length, 0);
  });
}

test('perubahan offline dipertahankan dan retry mengirim hanya ke endpoint buku khusus', async t => {
  let online = false; let data = { books: Model.emptyState(), revision: 0, appliedOperationIds: [] };
  const app = createApp([], { fetch: async (_url, req) => {
    if (!online) throw new Error('Offline simulasi');
    if (req.method === 'POST') {
      const payload = JSON.parse(req.body);
      data = { books: Model.applyOperation(data.books, payload.operation), revision: data.revision + 1, appliedOperationIds: [...data.appliedOperationIds, payload.operation.id] };
    }
    return response(200, data);
  } }); t.after(app.close);
  assert.ok(app.window.FinancialBooks);
  app.window.FinancialBooks.startSession(config); await tick();
  app.window.FinancialBooks.navigate('installments'); putAccount(app); await tick();
  assert.equal(app.window.FinancialBooks.getBooks().accounts.length, 1);
  assert.match(app.get('installmentSyncStatus').textContent, /lokal/);
  online = true;
  app.get('installmentsPage').querySelector('[data-book-action="retry"]').click(); await tick(); await tick();
  assert.equal(data.books.accounts.length, 1);
  assert.match(app.get('installmentSyncStatus').textContent, /tersimpan online/);
  assert.equal(app.requests.filter(r => r.method === 'POST').length, 1);
  assert.ok(app.requests.every(r => r.url.includes('financial-books')));
});

test('respons GET lama tidak boleh masuk ke workspace baru setelah berganti sesi', async t => {
  let finish;
  const app = createApp([], { fetch: () => new Promise(resolve => { finish = resolve; }) }); t.after(app.close);
  assert.ok(app.window.FinancialBooks);
  app.window.FinancialBooks.startSession(config);
  app.window.FinancialBooks.startSession({ workspaceId: 'lain', isLocalOnly: true });
  finish(response(200, { books: { accounts: [debt], entries: [] }, revision: 1 })); await tick();
  assert.equal(app.window.FinancialBooks.getBooks().accounts.length, 0);
  assert.equal(app.window.localStorage.getItem('catatan-keuangan-books-v1-lain'), null);
});

test('respons POST hilang sesudah delete berhasil tidak membuat queue macet atau data muncul lagi', async t => {
  let data = { books: { accounts: [debt], entries: [] }, revision: 1, appliedOperationIds: [] };
  let dropped = false;
  const app = createApp([], { fetch: async (_url, req) => {
    if (req.method === 'POST') {
      const payload = JSON.parse(req.body);
      data = { books: Model.applyOperation(data.books, payload.operation), revision: data.revision + 1, appliedOperationIds: [...data.appliedOperationIds, payload.operation.id] };
      if (!dropped) { dropped = true; throw new Error('Respons hilang simulasi'); }
    }
    return response(200, data);
  } }); t.after(app.close);
  assert.ok(app.window.FinancialBooks);
  app.window.FinancialBooks.startSession(config); await tick();
  app.window.FinancialBooks.navigate('installments');
  app.get('installmentDeleteAccount').click(); app.get('confirmDialog').close('accept'); await tick(); await tick();
  assert.equal(data.books.accounts.length, 0);
  app.get('installmentsPage').querySelector('[data-book-action="retry"]').click(); await tick(); await tick();
  assert.equal(app.window.FinancialBooks.getBooks().accounts.length, 0);
  assert.match(app.get('installmentSyncStatus').textContent, /tersimpan online/);
  assert.equal(app.requests.filter(r => r.method === 'POST').length, 1);
});

test('retry mencari acknowledgement lama secara eksplisit setelah ID keluar dari daftar terbaru', async t => {
  let data = { books: { accounts: [debt], entries: [] }, revision: 1, appliedOperationIds: [] };
  let committedId = '';
  const app = createApp([], { fetch: async (url, req) => {
    if (req.method === 'POST') {
      const payload = JSON.parse(req.body);
      committedId = payload.operation.id;
      data = { books: Model.emptyState(), revision: 400, appliedOperationIds: [] };
      throw new Error('Respons delete hilang; perangkat lain telah membuat banyak perubahan');
    }
    const lookup = new URL(url, 'http://localhost').searchParams.get('operationIds')?.split(',') || [];
    return response(200, { ...data, appliedOperationIds: lookup.includes(committedId) ? [committedId] : [] });
  } }); t.after(app.close);
  app.window.FinancialBooks.startSession(config); await tick();
  app.window.FinancialBooks.navigate('installments');
  app.get('installmentDeleteAccount').click(); app.get('confirmDialog').close('accept'); await tick(); await tick();
  app.get('installmentsPage').querySelector('[data-book-action="retry"]').click(); await tick(); await tick();
  assert.match(app.get('installmentSyncStatus').textContent, /tersimpan online/);
  assert.equal(app.requests.filter(r => r.method === 'POST').length, 1);
  assert.ok(app.requests.some(r => r.url.includes('operationIds=')));
});

test('edit offline yang berkonflik tidak menimpa edit online pada rekening sama', async t => {
  let data = { books: { accounts: [debt], entries: [] }, revision: 1, appliedOperationIds: [] };
  let online = true;
  const app = createApp([], { fetch: async (_url, req) => {
    if (!online) throw new Error('Offline simulasi');
    if (req.method === 'POST') {
      const payload = JSON.parse(req.body);
      data = { books: Model.applyOperation(data.books, payload.operation), revision: data.revision + 1, appliedOperationIds: [] };
    }
    return response(200, data);
  } }); t.after(app.close);
  assert.ok(app.window.FinancialBooks);
  app.window.FinancialBooks.startSession(config); await tick();
  app.window.FinancialBooks.navigate('installments'); online = false;
  app.get('installmentEditAccount').click(); app.setValue('installmentAccountName', 'Edit lokal');
  app.get('installmentAccountForm').requestSubmit(); await tick();
  data.books.accounts[0].name = 'Edit perangkat lain'; data.revision++;
  online = true;
  app.get('installmentsPage').querySelector('[data-book-action="retry"]').click(); await tick();
  assert.equal(data.books.accounts[0].name, 'Edit perangkat lain');
  assert.equal(app.requests.filter(r => r.method === 'POST').length, 0);
  assert.match(app.get('installmentSyncStatus').textContent, /konflik/i);
});

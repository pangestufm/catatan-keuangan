const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('./helpers/app-harness.cjs');

// The AI endpoint is unavailable here, so every part goes through the local parser.
const offline = { fetch: async () => ({ ok: false, status: 503, json: async () => ({}), clone() { return this; }, text: async () => '' }) };
const pad = (value) => String(value).padStart(2, '0');
const isoDate = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

async function send(app, text) {
  app.get('chatInput').value = text;
  await app.call('handleChatSubmit', { preventDefault() {} });
}
const drafts = (app) => [...app.get('draftListRows').querySelectorAll('[data-draft-index]')].map((row) => ({
  date: row.querySelector('[data-draft-field="date"]').value,
  amount: row.querySelector('[data-draft-field="amount"]').value,
  description: row.querySelector('[data-draft-field="description"]').value,
}));

test('dua baris chat menjadi dua draft yang disimpan sekaligus', async t => {
  const app = createApp([], offline); t.after(app.close);
  await send(app, 'Warung makan nara 45k 18nov\ntahu balikan 15k 18nov');
  assert.equal(app.get('draftListCard').classList.contains('hidden'), false);
  assert.equal(app.get('draftCard').classList.contains('hidden'), true);
  const list = drafts(app);
  assert.deepEqual(list.map((item) => item.amount), ['45.000', '15.000']);
  assert.deepEqual(list.map((item) => item.date), [`${new Date().getFullYear()}-11-18`, `${new Date().getFullYear()}-11-18`], '"18nov" dibaca sebagai tanggal');
  assert.match(app.get('draftListTotal').textContent, /60\.000/);
  assert.equal(app.stored().length, 0, 'belum tersimpan sebelum dikonfirmasi');
  app.get('draftListCard').requestSubmit();
  assert.equal(app.stored().length, 2);
  assert.deepEqual(app.stored().map((item) => item.amount).sort((a, b) => a - b), [15000, 45000]);
  assert.equal(app.get('draftListCard').classList.contains('hidden'), true);
});

test('koma memisahkan transaksi, tapi koma desimal dan keterangan tanpa nominal tidak', async t => {
  const app = createApp([], offline); t.after(app.close);
  await send(app, 'transfer ibu 1,5jt, bensin 30rb; parkir 5rb');
  assert.deepEqual(drafts(app).map((item) => item.amount), ['1.500.000', '30.000', '5.000']);
  await send(app, 'gaji tambahan 2.5jt\njajan 7,5rb');
  assert.deepEqual(drafts(app).map((item) => item.amount), ['2.500.000', '7.500'], 'desimal satuan tidak dibulatkan dulu');
  await send(app, 'makan siang, nasi padang 25rb');
  assert.equal(app.get('draftListCard').classList.contains('hidden'), true, 'satu transaksi tetap memakai draft tunggal');
  assert.equal(app.get('draftCard').classList.contains('hidden'), false);
  assert.equal(app.get('draftAmountInput').value, '25.000');
});

test('tanggal yang disebut sekali berlaku untuk bagian berikutnya tanpa tanggal', async t => {
  const app = createApp([], offline); t.after(app.close);
  await send(app, 'kemarin bakso 20rb, es teh 5rb');
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  assert.deepEqual(drafts(app).map((item) => item.date), [isoDate(yesterday), isoDate(yesterday)]);
});

test('draft bisa dibuang satu per satu dan bagian tanpa nominal dikembalikan ke kolom chat', async t => {
  const app = createApp([], offline); t.after(app.close);
  await send(app, 'bensin 30rb\nparkir 5rb\nbayar sesuatu');
  assert.equal(drafts(app).length, 2, 'baris tanpa nominal digabung ke transaksi sebelumnya');
  app.get('draftListRows').querySelector('[data-draft-remove="0"]').click();
  assert.deepEqual(drafts(app).map((item) => item.amount), ['5.000']);
  app.get('draftListRows').querySelector('[data-draft-remove="0"]').click();
  assert.equal(app.get('draftListCard').classList.contains('hidden'), true);
  assert.equal(app.stored().length, 0);
});

test('keluar dari workspace membuang draft dan teks chat yang belum disimpan', async t => {
  const app = createApp([], offline); t.after(app.close);
  await send(app, 'bensin 30rb, parkir 5rb');
  app.get('chatInput').value = 'catatan belum dikirim';
  app.call('logout');
  assert.equal(app.get('draftListCard').classList.contains('hidden'), true);
  assert.equal(app.get('draftListRows').innerHTML, '');
  assert.equal(app.get('chatInput').value, '');
});

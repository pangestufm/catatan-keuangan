const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, transaction } = require('./helpers/app-harness.cjs');

function fixture(t, options) {
  const app = createApp([transaction({ amount: 5012278 })], options);
  t.after(app.close);
  app.setValue('monthFilterInput', '2026-09');
  return app;
}

test('hover titik grafik menampilkan nominal lengkap tanpa klik atau perubahan data', t => {
  const app = fixture(t);
  const point = app.get('dailyExpenseChart').querySelector('.trend-point');
  point.dispatchEvent(new app.window.MouseEvent('mouseover', { bubbles: true }));
  const tooltip = app.get('hoverTooltip');
  assert.ok(tooltip);
  assert.equal(tooltip.hidden, false);
  assert.match(tooltip.textContent, /5\.012\.278/);
  assert.equal(point.getAttribute('aria-describedby'), tooltip.id);
  assert.equal(app.stored().length, 1);
  assert.equal(app.get('dailyExpenseChart').querySelector('.chart-tooltip'), null);
});

test('informasi kartu tersedia pada fokus keyboard dan Escape menutup tooltip', t => {
  const app = fixture(t);
  const card = app.get('categoryExpense').closest('.interactive-card');
  assert.equal(card.tabIndex, 0);
  card.focus();
  const tooltip = app.get('hoverTooltip');
  assert.equal(tooltip.hidden, false);
  assert.match(tooltip.textContent, /5\.012\.278/);
  card.dispatchEvent(new app.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(tooltip.hidden, true);
  assert.equal(card.hasAttribute('aria-describedby'), false);
});

test('tooltip bertahan saat pointer menuju informasinya dan ditutup saat keluar', async t => {
  const app = fixture(t);
  const point = app.get('dailyExpenseChart').querySelector('.trend-point');
  point.dispatchEvent(new app.window.MouseEvent('mouseover', { bubbles: true }));
  const tooltip = app.get('hoverTooltip');
  assert.ok(tooltip);
  point.dispatchEvent(new app.window.MouseEvent('mouseout', { bubbles: true, relatedTarget: tooltip }));
  tooltip.dispatchEvent(new app.window.MouseEvent('mouseenter'));
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.equal(tooltip.hidden, false);
  tooltip.dispatchEvent(new app.window.MouseEvent('mouseleave'));
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.equal(tooltip.hidden, true);
});

test('tooltip lama dibersihkan ketika filter merender ulang grafik', async t => {
  const app = fixture(t);
  const point = app.get('dailyExpenseChart').querySelector('.trend-point');
  point.focus();
  assert.equal(app.get('hoverTooltip').hidden, false);
  app.setValue('monthFilterInput', '2026-10');
  await Promise.resolve();
  assert.equal(app.get('hoverTooltip').hidden, true);
  assert.equal(point.hasAttribute('aria-describedby'), false);
});

test('grafik mobile memakai koordinat kompak, target sentuh dan tetap tanpa area isi', t => {
  const app = fixture(t, { mobile: true });
  const chart = app.get('dailyExpenseChart').querySelector('svg');
  assert.equal(chart.getAttribute('viewBox'), '0 0 360 240');
  assert.ok(chart.querySelector('.chart-hit-target'));
  assert.ok(chart.querySelector('.chart-hit-target').getAttribute('r') >= 28);
  assert.equal(chart.querySelectorAll('path:not(.trend-line)').length, 0);
  assert.equal(chart.querySelector('path').getAttribute('d').includes('Z'), false);
});

test('tooltip memakai teks aman dan membuka modal menutup tooltip di belakangnya', t => {
  const app = fixture(t);
  const card = app.get('categoryExpense').closest('.interactive-card');
  card.dataset.tooltip = '<img src=x onerror=alert(1)>';
  card.focus();
  assert.equal(app.get('hoverTooltip').querySelector('img'), null);
  assert.match(app.get('hoverTooltip').textContent, /<img/);
  app.window.DashboardUI.openEntry();
  assert.equal(app.get('hoverTooltip').hidden, true);
});

test('tap kartu ringkasan menampilkan informasi tanpa mengubah filter atau transaksi', t => {
  const app = fixture(t, { mobile: true });
  const card = app.get('categoryExpense').closest('.interactive-card');
  card.click();
  assert.equal(app.get('hoverTooltip').hidden, false);
  assert.match(app.get('hoverTooltip').textContent, /5\.012\.278/);
  app.get('hoverTooltip').click();
  assert.equal(app.get('hoverTooltip').hidden, false);
  assert.equal(app.get('categorySummarySelect').value, 'all');
  assert.equal(app.stored().length, 1);
});

test('scroll akibat fokus keyboard tidak menghilangkan informasi titik grafik', t => {
  const app = fixture(t);
  const point = app.get('dailyExpenseChart').querySelector('.trend-point');
  point.focus();
  app.window.document.dispatchEvent(new app.window.Event('scroll'));
  assert.equal(app.get('hoverTooltip').hidden, false);
  point.blur();
  app.window.document.dispatchEvent(new app.window.Event('scroll'));
  assert.equal(app.get('hoverTooltip').hidden, true);
});

test('tooltip di tepi layar dijepit ke viewport, bukan keluar di kanan atau bawah', t => {
  const app = fixture(t);
  const point = app.get('dailyExpenseChart').querySelector('.trend-point');
  Object.defineProperty(app.window.document.documentElement, 'clientWidth', { value: 320 });
  Object.defineProperty(app.window, 'innerHeight', { value: 844 });
  point.getBoundingClientRect = () => ({ left: 310, top: 2000, bottom: 2020, width: 20, height: 20 });
  app.get('hoverTooltip').getBoundingClientRect = () => ({ width: 180, height: 80 });
  point.dispatchEvent(new app.window.MouseEvent('mouseover', { bubbles: true }));
  assert.equal(app.get('hoverTooltip').style.left, '128px');
  assert.equal(app.get('hoverTooltip').style.top, '752px');
});

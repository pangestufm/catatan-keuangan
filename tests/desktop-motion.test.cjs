const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, transaction } = require('./helpers/app-harness.cjs');

function fixture(t, options = {}) {
  const animations = [];
  const app = createApp([transaction({ amount: 5012278 })], {
    ...options,
    animate(keyframes, timing) {
      const record = { element: this, keyframes, timing, cancelled: false,
        cancel() { this.cancelled = true; this.oncancel?.(); } };
      animations.push(record);
      return record;
    },
  });
  t.after(app.close);
  animations.length = 0;
  return { ...app, animations };
}

test('desktop menganimasikan perubahan kartu dan grafik tanpa mengubah nominal', t => {
  const app = fixture(t);
  app.setValue('monthFilterInput', '2026-09');
  assert.ok(app.animations.some(a => a.element.id === 'expenseTotal'));
  assert.ok(app.animations.some(a => a.element.matches('.trend-line') && a.keyframes[0].clipPath));
  assert.equal(app.get('expenseTotal').textContent.replace(/\s/g, ''), 'Rp5.012.278');
  assert.equal(app.stored()[0].amount, 5012278);
  assert.ok(app.animations.every(a => a.timing.duration <= 320 && !a.timing.iterations));
});

for (const [name, options] of [['mobile', { mobile: true }], ['reduced motion', { reducedMotion: true }]]) {
  test(`${name} tidak menjalankan animasi desktop`, t => {
    const app = fixture(t, options);
    app.setValue('monthFilterInput', '2026-09');
    app.window.DashboardUI.openEntry();
    assert.equal(app.animations.length, 0);
    assert.equal(app.stored()[0].amount, 5012278);
  });
}

test('render data yang sama tidak mengulang animasi', t => {
  const app = fixture(t);
  app.setValue('monthFilterInput', '2026-09');
  app.animations.length = 0;
  app.call('render');
  assert.equal(app.animations.length, 0);
});

test('panel tetap langsung interaktif dan animasinya dibatalkan saat ditutup', t => {
  const app = fixture(t);
  const dialog = app.get('quickEntryModal');
  app.window.DashboardUI.openEntry();
  assert.equal(dialog.open, true);
  assert.equal(app.window.document.activeElement.id, 'chatInput');
  const animation = app.animations.find(a => a.element === dialog);
  assert.ok(animation);
  app.window.DashboardUI.close(dialog);
  assert.equal(dialog.open, false);
  assert.equal(animation.cancelled, true);
});

test('pergantian tab memakai transisi tetapi mengklik tab aktif tidak mengulangnya', t => {
  const app = fixture(t);
  app.window.DashboardUI.setEntryMode('manual');
  assert.ok(app.animations.some(a => a.element.id === 'entryManualView'));
  assert.equal(app.get('entryManualView').hidden, false);
  app.animations.length = 0;
  app.window.DashboardUI.setEntryMode('manual');
  assert.equal(app.animations.length, 0);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');

function loadMotion() {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  const observers = [];
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.IntersectionObserver = class {
    constructor(callback, options) { this.callback = callback; this.options = options; this.targets = []; observers.push(this); }
    observe(target) { this.targets.push(target); }
    unobserve() {}
  };
  window.eval(fs.readFileSync(path.join(root, 'motion.js'), 'utf8'));
  return { window, observers };
}

test('section lebih tinggi dari layar tetap muncul begitu sebagian kecilnya terlihat', (t) => {
  const { window, observers } = loadMotion();
  t.after(() => window.close());
  const reveal = observers.find((o) => o.targets.some((el) => el.id === 'transactionsSection'));
  assert.ok(reveal, 'ledger diamati oleh observer reveal');
  const thresholds = [].concat(reveal.options.threshold ?? 0);
  assert.equal(Math.min(...thresholds), 0, 'threshold berbasis rasio tidak pernah tercapai untuk section setinggi 11.000px');
  const ledger = window.document.getElementById('transactionsSection');
  reveal.callback([{ target: ledger, isIntersecting: true, intersectionRatio: 0.02 }]);
  assert.ok(ledger.classList.contains('in'));
});

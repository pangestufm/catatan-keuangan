const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const XLSX = require('../../vendor/xlsx.full.min.js');
const root = path.resolve(__dirname, '../..');

function transaction(overrides = {}) {
  return { id: 'fixture-1', date: '2026-09-16', type: 'expense', category: 'Transport',
    description: 'Kereta contoh', amount: 45000, source: 'Manual', bankReference: '',
    createdAt: '2026-09-16T08:00:00.000Z', updatedAt: '', ...overrides };
}

function createApp(rows = [], options = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: 'http://localhost/', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const { window } = dom;
  const requests = [];
  const downloads = [];
  window.matchMedia = (query) => ({ matches: query.includes('prefers-reduced-motion') ? Boolean(options.reducedMotion) : query.includes('max-width') && Boolean(options.mobile),
    media: query, addEventListener() {}, removeEventListener() {} });
  if (options.animate) {
    window.HTMLElement.prototype.animate = options.animate;
    window.SVGElement.prototype.animate = options.animate;
  }
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function (value) {
    if (value !== undefined) this.returnValue = value;
    this.removeAttribute('open'); this.dispatchEvent(new window.Event('close'));
  };
  window.alert = () => {};
  window.confirm = () => true;
  window.eval(fs.readFileSync(path.join(root, 'vendor/xlsx.full.min.js'), 'utf8'));
  window.Blob = Blob;
  window.URL.createObjectURL = (blob) => { downloads.push(blob); return 'blob:fixture'; };
  window.URL.revokeObjectURL = () => {};
  const clickAnchor = window.HTMLAnchorElement.prototype.click;
  window.HTMLAnchorElement.prototype.click = function () { if (!this.download) clickAnchor.call(this); };
  window.fetch = async (url, request = {}) => {
    requests.push({ url, ...request });
    if (options.fetch) return options.fetch(url, request);
    const body = options.response || { transaction: transaction({
      description: 'Makan siang contoh', amount: 45000, category: 'Konsumsi Harian (Makan & Minum)', source: 'nexos',
    }) };
    return { ok: true, status: 200, json: async () => body, clone() { return this; }, text: async () => JSON.stringify(body) };
  };
  window.localStorage.setItem('catatan-keuangan-auth', JSON.stringify({
    workspaceId: 'regression-fixture', accessToken: '', isLocalOnly: true,
  }));
  const storageKey = 'catatan-keuangan-transactions-regression-fixture';
  window.localStorage.setItem(storageKey, JSON.stringify(rows));
  for (const file of ['currency-input.js', 'bank-reconciliation.js', 'dashboard-ui.js', 'financial-books-model.js', 'financial-books.js', 'app.js']) {
    if (fs.existsSync(path.join(root, file))) window.eval(fs.readFileSync(path.join(root, file), 'utf8'));
  }
  const setValue = (id, value, event = 'change') => {
    const element = window.document.getElementById(id); element.value = value;
    element.dispatchEvent(new window.Event(event, { bubbles: true }));
  };
  return { window, dom, requests, downloads, setValue, get: id => window.document.getElementById(id),
    stored: () => JSON.parse(window.localStorage.getItem(storageKey)),
    call: (name, ...args) => window.eval(name)(...args), close: () => window.close() };
}
module.exports = { createApp, transaction, XLSX };

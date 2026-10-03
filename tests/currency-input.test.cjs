const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  formatRupiahInput,
  parseRupiahInput,
  formatElement,
} = require("../currency-input.js");

test("memformat nominal dengan pemisah ribuan titik", () => {
  assert.equal(formatRupiahInput("5012278"), "5.012.278");
  assert.equal(formatRupiahInput(5012278), "5.012.278");
  assert.equal(formatRupiahInput("1000"), "1.000");
  assert.equal(formatRupiahInput("999"), "999");
});

test("membersihkan teks Rupiah yang ditempel ke input", () => {
  assert.equal(formatRupiahInput("Rp 5.012.278"), "5.012.278");
  assert.equal(formatRupiahInput("Rp5 012 278"), "5.012.278");
  assert.equal(formatRupiahInput(""), "");
});

test("mengubah nominal berformat kembali menjadi integer", () => {
  assert.equal(parseRupiahInput("5.012.278"), 5012278);
  assert.equal(parseRupiahInput("Rp 5.012.278"), 5012278);
  assert.equal(parseRupiahInput(""), 0);
});

test("memformat elemen input tanpa mengubah nilai numeriknya", () => {
  const input = {
    value: "5012278",
    selectionStart: 7,
    setSelectionRange(start, end) {
      this.selectionStart = start;
      this.selectionEnd = end;
    },
  };

  formatElement(input);

  assert.equal(input.value, "5.012.278");
  assert.equal(input.selectionStart, 9);
  assert.equal(parseRupiahInput(input.value), 5012278);
});

test("memakai input Rupiah pada form manual dan draft agent", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

  assert.match(html, /id="amountInput"[^>]*type="text"[^>]*inputmode="numeric"/);
  assert.match(html, /id="draftAmountInput"[^>]*type="text"[^>]*inputmode="numeric"/);
  assert.doesNotMatch(html, /(?:amountInput|draftAmountInput)[^>]*step="100"/);

  const helperPosition = html.indexOf('src="currency-input.js');
  const appPosition = html.indexOf('src="app.js');
  assert.ok(helperPosition >= 0, "currency-input.js belum dimuat");
  assert.ok(helperPosition < appPosition, "currency-input.js harus dimuat sebelum app.js");
});

test("memakai input Rupiah pada review mutasi bank", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

  assert.match(appSource, /bank-amount-input" type="text" inputmode="numeric"/);
  assert.doesNotMatch(appSource, /bank-amount-input[^>]*step="100"/);
  assert.match(appSource, /formatRupiahInput\(draft\.amount\)/);
});

test("memformat tampilan tetapi menyimpan nominal sebagai integer", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

  assert.match(appSource, /parseRupiahInput\(elements\.amountInput\.value\)/);
  assert.match(appSource, /parseRupiahInput\(elements\.draftAmountInput\.value\)/);
  assert.match(appSource, /formatRupiahInput\(parsed\.amount\)/);
  assert.match(appSource, /formatRupiahInput\(transaction\.amount\)/);
  assert.match(appSource, /formatElement\(event\.target\)/);
});

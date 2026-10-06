const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const modulePath = path.join(__dirname, "..", "financial-books-model.js");
function model() {
  assert.ok(fs.existsSync(modulePath), "financial-books-model.js must exist");
  return require(modulePath);
}
const account = (overrides = {}) => ({
  id: "a1", kind: "savings", name: "Dana", startDate: "2026-01-01",
  totalAmount: 0, openingBalance: 100, notes: "", ...overrides,
});
const installment = (overrides = {}) => ({
  id: "i1", kind: "installment", name: "Laptop", startDate: "2026-01-01",
  totalAmount: 1000, openingBalance: 0, notes: "", ...overrides,
});
const entry = (overrides = {}) => ({
  id: "e1", accountId: "a1", kind: "deposit", date: "2026-01-02",
  amount: 50, description: "", ...overrides,
});
const state = (a = account(), entries = []) => ({ accounts: [a], entries });
const op = (type, fields = {}) => ({ id: "op1", type, ...fields });

test("CommonJS contract and fresh empty states", () => {
  const m = model();
  for (const key of ["emptyState", "validateState", "applyOperation", "summarizeAccount", "mergeBackup"]) {
    assert.equal(typeof m[key], "function", key);
  }
  const one = m.emptyState();
  assert.deepEqual(one, { accounts: [], entries: [] });
  one.accounts.push(account());
  assert.deepEqual(m.emptyState(), { accounts: [], entries: [] });
});

test("browser UMD exposes window.FinancialBooksModel without CommonJS", () => {
  model();
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(modulePath, "utf8"), context);
  assert.equal(typeof context.window.FinancialBooksModel.applyOperation, "function");
});

test("installment obligation is not a payment and remaining uses lifetime payments", () => {
  const m = model();
  assert.deepEqual(m.summarizeAccount(installment(), []), {
    paid: 0, remaining: 1000, balance: 0, deposits: 0, withdrawals: 0,
  });
  assert.deepEqual(m.summarizeAccount(installment(), [entry({ accountId: "i1", kind: "payment", amount: 300 }), entry({ id: "other" })]), {
    paid: 300, remaining: 700, balance: 0, deposits: 0, withdrawals: 0,
  });
});

test("savings, investment and deposit summaries use opening balance and lifetime flows", () => {
  const entries = [entry(), entry({ id: "e2", kind: "withdrawal", amount: 80 })];
  for (const kind of ["savings", "investment", "deposit"]) {
    assert.deepEqual(model().summarizeAccount(account({ kind }), entries), {
      paid: 0, remaining: 0, balance: 70, deposits: 50, withdrawals: 80,
    });
  }
});

test("validation copies state and does not mutate input", () => {
  const original = state(account(), [entry()]);
  const copy = model().validateState(original);
  assert.deepEqual(copy, original);
  copy.accounts[0].name = "Changed";
  copy.entries[0].amount = 1;
  assert.equal(original.accounts[0].name, "Dana");
  assert.equal(original.entries[0].amount, 50);
});

test("invalid state shapes and unknown fields reject rather than sanitize", () => {
  for (const books of [null, [], {}, { accounts: [], entries: null }, { accounts: [], entries: [], transactions: [] },
    state({ ...account(), extra: true }), state(account(), [{ ...entry(), extra: true }]), state(null)]) {
    assert.throws(() => model().validateState(books));
  }
});

test("strict kinds, strings and account-specific monetary fields", () => {
  for (const a of [account({ kind: "cash" }), account({ name: " " }), account({ name: 3 }),
    account({ name: "x".repeat(121) }), account({ notes: null }), account({ notes: "x".repeat(1001) }),
    account({ id: "" }), account({ id: "x".repeat(129) }), account({ totalAmount: 100 }),
    installment({ openingBalance: 100 })]) {
    assert.throws(() => model().validateState(state(a)));
  }
  const missing = account();
  delete missing.openingBalance;
  assert.throws(() => model().validateState(state(missing)));
  assert.throws(() => model().validateState(state(account(), [entry({ description: "x".repeat(1001) })])));
});

test("whole nonnegative Rupiah and positive entries must be safe numbers", () => {
  for (const value of [-1, 0.5, "100", NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, null, true]) {
    assert.throws(() => model().validateState(state(account({ openingBalance: value }))));
    assert.throws(() => model().validateState(state(installment({ totalAmount: value }))));
    assert.throws(() => model().validateState(state(account(), [entry({ amount: value })])));
  }
  assert.throws(() => model().validateState(state(account(), [entry({ amount: 0 })])));
  assert.deepEqual(model().validateState(state(account({ openingBalance: 0 }))), state(account({ openingBalance: 0 })));
  assert.throws(() => model().summarizeAccount(installment({ totalAmount: 0 }), []));
});

test("real ISO calendar dates including leap years only", () => {
  for (const date of ["2026-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-01-00", "0000-01-01", "2026-1-01", "2026-01-01T00:00:00Z", 20260101]) {
    assert.throws(() => model().validateState(state(account({ startDate: date }))));
    assert.throws(() => model().validateState(state(account(), [entry({ date })])));
  }
  assert.doesNotThrow(() => model().validateState(state(account({ startDate: "2024-02-29" }))));
});

test("unique IDs, existing parents, kind compatibility and entry start dates", () => {
  for (const books of [
    { accounts: [account(), account()], entries: [] },
    state(account(), [entry(), entry()]),
    state(account(), [entry({ accountId: "missing" })]),
    state(account(), [entry({ kind: "payment" })]),
    state(installment(), [entry({ accountId: "i1" })]),
    state(account(), [entry({ date: "2025-12-31" })]),
    state(account(), [entry({ kind: "expense" })]),
  ]) assert.throws(() => model().validateState(books));
  assert.doesNotThrow(() => model().validateState(state(account(), [entry({ date: "2026-01-01" })])));
});

test("overpayment and chronological overdraw reject even with positive final balance", () => {
  assert.throws(() => model().validateState(state(installment(), [entry({ accountId: "i1", kind: "payment", amount: 1001 })])));
  const entries = [entry({ amount: 200, date: "2026-01-04" }), entry({ id: "e2", kind: "withdrawal", amount: 101, date: "2026-01-02" })];
  assert.throws(() => model().validateState(state(account(), entries)));
  assert.throws(() => model().summarizeAccount(account(), entries));
  assert.throws(() => model().summarizeAccount(installment(), [entry({ accountId: "i1", kind: "payment", amount: 1001 })]));
});

test("date-only accounting applies same-day deposits before withdrawals deterministically", () => {
  const entries = [entry({ id: "a", kind: "withdrawal", amount: 150 }), entry({ id: "z", amount: 50 })];
  assert.deepEqual(model().summarizeAccount(account(), entries), model().summarizeAccount(account(), [...entries].reverse()));
  assert.equal(model().summarizeAccount(account(), entries).balance, 0);
});

test("arithmetic overflow and excessive collection sizes reject", () => {
  assert.throws(() => model().validateState(state(account({ openingBalance: Number.MAX_SAFE_INTEGER }), [entry({ amount: 1 })])));
  assert.throws(() => model().validateState(state(account({ openingBalance: 0 }), [entry({ amount: Number.MAX_SAFE_INTEGER }), entry({ id: "e2", amount: 1 })])));
  assert.throws(() => model().validateState({ accounts: Array.from({ length: 1001 }, (_, i) => account({ id: `a${i}` })), entries: [] }));
  assert.throws(() => model().validateState(state(account(), Array.from({ length: 10001 }, (_, i) => entry({ id: `e${i}` })))));
});

test("CRUD is immutable, entry updates replace by ID, and deleting history revalidates", () => {
  const m = model();
  const empty = m.emptyState();
  const created = m.applyOperation(empty, op("upsertAccount", { record: account() }));
  const withEntry = m.applyOperation(created, op("upsertEntry", { record: entry() }));
  const changed = m.applyOperation(withEntry, op("upsertEntry", { record: entry({ amount: 70 }) }));
  assert.equal(changed.entries.length, 1);
  assert.equal(changed.entries[0].amount, 70);
  assert.deepEqual(empty, m.emptyState());
  assert.deepEqual(created.entries, []);
  assert.equal(withEntry.entries[0].amount, 50);
  const renamed = m.applyOperation(changed, op("upsertAccount", { record: account({ name: "New" }) }));
  assert.equal(renamed.accounts[0].name, "New");
  assert.deepEqual(m.applyOperation(renamed, op("deleteEntry", { recordId: "e1" })).entries, []);
  assert.throws(() => m.applyOperation(renamed, op("upsertAccount", { record: account({ startDate: "2026-01-03" }) })));
  const history = state(account({ openingBalance: 0 }), [entry({ amount: 100 }), entry({ id: "w", kind: "withdrawal", amount: 50, date: "2026-01-03" })]);
  assert.throws(() => m.applyOperation(history, op("deleteEntry", { recordId: "e1" })));
  assert.throws(() => m.applyOperation(history, op("upsertEntry", { record: entry({ amount: 10 }) })));
});

test("account deletion requires explicit cascade for history and preserves other accounts", () => {
  const m = model();
  const books = { accounts: [account(), installment()], entries: [entry()] };
  assert.throws(() => m.applyOperation(books, op("deleteAccount", { recordId: "a1" })));
  assert.throws(() => m.applyOperation(books, op("deleteAccount", { recordId: "a1", cascade: "true" })));
  assert.deepEqual(m.applyOperation(books, op("deleteAccount", { recordId: "a1", cascade: true })), state(installment()));
  assert.deepEqual(m.applyOperation(state(), op("deleteAccount", { recordId: "a1" })), m.emptyState());
  assert.throws(() => m.applyOperation(books, op("deleteEntry", { recordId: "missing" })));
});

test("malformed operations reject and never change books", () => {
  const books = state();
  const before = JSON.stringify(books);
  for (const operation of [null, [], {}, op("unknown"), { type: "upsertAccount", record: account() },
    op("upsertAccount"), op("upsertEntry", { record: account() }), op("deleteEntry"),
    op("deleteAccount", { recordId: "a1", books: { accounts: [], entries: [] } }),
    op("restore"), op("restore", { books: { accounts: [], entries: [] }, recordId: "a1" })]) {
    assert.throws(() => model().applyOperation(books, operation));
  }
  assert.equal(JSON.stringify(books), before);
});

test("additive restore preserves existing IDs and reports duplicate counts and changed IDs", () => {
  const m = model();
  const existing = state(account(), [entry()]);
  const incoming = { accounts: [account({ name: "Different" }), installment()], entries: [entry(), entry({ id: "new", accountId: "i1", kind: "payment", amount: 200 })] };
  const result = m.mergeBackup(existing, incoming);
  assert.deepEqual(result, {
    books: { accounts: [account(), installment()], entries: [entry(), incoming.entries[1]] },
    addedAccounts: 1, addedEntries: 1, duplicates: 2, changed: ["a1"],
  });
  assert.deepEqual(m.applyOperation(existing, op("restore", { books: incoming })), result.books);
  assert.equal(existing.accounts[0].name, "Dana");
  assert.equal(incoming.accounts[0].name, "Different");
  const repeat = m.mergeBackup(result.books, incoming);
  assert.equal(repeat.addedAccounts, 0);
  assert.equal(repeat.addedEntries, 0);
  assert.equal(repeat.duplicates, 4);
  assert.deepEqual(repeat.changed, ["a1"]);
});

test("record property order does not count as changed; changed entries never overwrite", () => {
  const reversed = Object.fromEntries(Object.entries(account()).reverse());
  assert.deepEqual(model().mergeBackup(state(), state(reversed)).changed, []);
  const result = model().mergeBackup(state(account(), [entry()]), state(account(), [entry({ amount: 70 })]));
  assert.deepEqual(result.changed, ["e1"]);
  assert.equal(result.books.entries[0].amount, 50);
});

test("restore rejects invalid incoming data and conflicts caused by existing-wins combination", () => {
  assert.throws(() => model().mergeBackup(state(), state(account(), [entry({ amount: -1 })])));
  const existing = state(installment(), [entry({ id: "old", accountId: "i1", kind: "payment", amount: 900 })]);
  const incoming = state(installment(), [entry({ accountId: "i1", kind: "payment", amount: 200 })]);
  assert.throws(() => model().mergeBackup(existing, incoming));
});

test("summaries reject malformed entries even when they do not match the selected account", () => {
  const m = model();
  for (const entries of [[null], [entry({ accountId: "other", amount: -1 })], [entry({ accountId: "other", date: "2026-02-30" })]]) {
    assert.throws(() => m.summarizeAccount(account(), entries));
  }
});

test("all accounts retain both monetary fields, with an unused zero and positive installment total", () => {
  const m = model();
  for (const a of [account(), installment(), account({ kind: "investment" }), account({ kind: "deposit" })]) {
    assert.deepEqual(m.validateState(state(a)).accounts[0], a);
  }
  for (const key of ["openingBalance", "totalAmount"]) {
    const a = account();
    delete a[key];
    assert.throws(() => m.validateState(state(a)));
  }
  assert.throws(() => m.validateState(state(installment({ totalAmount: 0 }))));
  assert.throws(() => m.validateState(state(account({ totalAmount: 1 }))));
  assert.throws(() => m.validateState(state(installment({ openingBalance: 1 }))));
});

test("cross-account monetary aggregates never exceed safe integer range", () => {
  const m = model();
  const max = Number.MAX_SAFE_INTEGER;
  assert.throws(() => m.validateState({ accounts: [account({ openingBalance: max }), account({ id: "a2", openingBalance: 1 })], entries: [] }));
  assert.throws(() => m.validateState({ accounts: [installment({ totalAmount: max }), installment({ id: "i2", totalAmount: 1 })], entries: [] }));
  const accounts = [account({ openingBalance: 0 }), account({ id: "a2", openingBalance: 0 })];
  const entries = accounts.flatMap(a => [
    entry({ id: `d-${a.id}`, accountId: a.id, amount: max }),
    entry({ id: `w-${a.id}`, accountId: a.id, kind: "withdrawal", amount: max }),
  ]);
  assert.throws(() => m.validateState({ accounts, entries }));
  assert.doesNotThrow(() => m.validateState({ accounts: [account({ openingBalance: max - 1 }), account({ id: "a2", openingBalance: 1 })], entries: [] }));
});

test("validation errors are meaningful Indonesian messages", () => {
  const m = model();
  assert.throws(() => m.validateState(state(account({ name: "x".repeat(121) }))), /nama.*120/i);
  assert.throws(() => m.validateState(state(account({ notes: "x".repeat(1001) }))), /catatan.*1000/i);
  assert.throws(() => m.validateState(state(installment({ totalAmount: 0 }))), /cicilan.*positif/i);
  assert.throws(() => m.validateState(state(account(), [entry({ date: "2026-02-30" })])), /tanggal/i);
  assert.throws(() => m.validateState(state(account(), [entry({ accountId: "missing" })])), /rekening.*ditemukan/i);
  assert.throws(() => m.validateState(state(account(), [entry({ kind: "withdrawal", amount: 101 })])), /penarikan.*saldo/i);
  assert.throws(() => m.validateState(state(installment(), [entry({ accountId: "i1", kind: "payment", amount: 1001 })])), /pembayaran.*cicilan/i);
});

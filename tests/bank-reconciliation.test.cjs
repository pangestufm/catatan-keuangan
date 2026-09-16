const test = require("node:test");
const assert = require("node:assert/strict");

const { reconcileBankTransactions } = require("../bank-reconciliation.js");

const existingTransactions = [
  {
    id: "trx-1",
    date: "2026-09-01",
    type: "expense",
    category: "Konsumsi Harian",
    description: "Kopi Pagi",
    amount: 25000,
    bankReference: "REF-001",
  },
  {
    id: "trx-2",
    date: "2026-09-02",
    type: "income",
    category: "Gaji",
    description: "Transfer Gaji",
    amount: 5000000,
    bankReference: "REF-002",
  },
];

test("transaksi yang sama tetap terlihat tetapi tidak dipilih lagi", () => {
  const drafts = reconcileBankTransactions([
    {
      date: "2026-09-01",
      type: "expense",
      category: "Konsumsi Harian",
      description: "Kopi Pagi",
      amount: 25000,
      reference: "REF-001",
    },
    {
      date: "2026-09-17",
      type: "expense",
      category: "Transportasi",
      description: "Taksi",
      amount: 85000,
      reference: "REF-017",
    },
  ], existingTransactions);

  assert.equal(drafts[0].reconciliationStatus, "duplicate");
  assert.equal(drafts[0].selected, false);
  assert.equal(drafts[0].existingTransactionId, "trx-1");
  assert.equal(drafts[1].reconciliationStatus, "new");
  assert.equal(drafts[1].selected, true);
});

test("referensi yang sama dengan nominal berbeda ditandai sebagai perubahan", () => {
  const [draft] = reconcileBankTransactions([
    {
      date: "2026-09-01",
      type: "expense",
      category: "Konsumsi Harian",
      description: "Kopi Pagi",
      amount: 30000,
      reference: "REF-001",
    },
  ], existingTransactions);

  assert.equal(draft.reconciliationStatus, "changed");
  assert.equal(draft.selected, false);
  assert.equal(draft.existingTransactionId, "trx-1");
  assert.match(draft.reconciliationNote, /nominal/i);
});

test("tanpa referensi, tanggal jenis nominal dan deskripsi tetap mencegah duplikat", () => {
  const [draft] = reconcileBankTransactions([
    {
      date: "2026-09-02",
      type: "income",
      category: "Pendapatan",
      description: "  TRANSFER   GAJI ",
      amount: 5000000,
      reference: "",
    },
  ], existingTransactions);

  assert.equal(draft.reconciliationStatus, "duplicate");
  assert.equal(draft.existingTransactionId, "trx-2");
});

test("perubahan tanpa referensi dikenali jika pasangan tanggal jenis dan deskripsi unik", () => {
  const [draft] = reconcileBankTransactions([
    {
      date: "2026-09-02",
      type: "income",
      category: "Gaji",
      description: "Transfer Gaji",
      amount: 5100000,
      reference: "",
    },
  ], existingTransactions);

  assert.equal(draft.reconciliationStatus, "changed");
  assert.equal(draft.existingTransactionId, "trx-2");
});

test("referensi yang sama di dalam dokumen hanya memilih kemunculan pertama", () => {
  const drafts = reconcileBankTransactions([
    {
      date: "2026-09-17",
      type: "expense",
      category: "Transportasi",
      description: "Taksi",
      amount: 85000,
      reference: "REF-017",
    },
    {
      date: "2026-09-17",
      type: "expense",
      category: "Transportasi",
      description: "Taksi",
      amount: 85000,
      reference: "REF-017",
    },
  ], existingTransactions);

  assert.equal(drafts[0].reconciliationStatus, "new");
  assert.equal(drafts[1].reconciliationStatus, "duplicate");
  assert.equal(drafts[1].selected, false);
  assert.equal(drafts[1].duplicateWithinDocument, true);
});

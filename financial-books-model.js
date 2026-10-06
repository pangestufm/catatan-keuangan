(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FinancialBooksModel = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const MAX_ACCOUNTS = 1000;
  const MAX_ENTRIES = 10000;
  const accountKinds = new Set(["installment", "savings", "investment", "deposit"]);
  const entryKinds = new Set(["payment", "deposit", "withdrawal"]);

  function fail(message) {
    throw new Error(message);
  }

  function object(value, fields, required = fields) {
    if (!value || Object.prototype.toString.call(value) !== "[object Object]") fail("Data harus berupa objek.");
    if (Object.keys(value).some((key) => !fields.includes(key))) fail("Data memiliki field yang tidak dikenal.");
    if (required.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) fail("Field wajib belum lengkap.");
  }

  function text(value, max, required = false, label = "Teks") {
    if (typeof value !== "string" || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) fail(`${label} harus berupa teks yang valid, maksimal ${max} karakter.`);
    if (required && !value.trim()) fail(`${label} wajib diisi.`);
    return value;
  }

  function identifier(value) {
    if (typeof value !== "string" || !/^[A-Za-z0-9_-][A-Za-z0-9_.:-]{0,127}$/.test(value)) fail("ID harus berupa teks valid maksimal 128 karakter, tanpa spasi.");
    return value;
  }

  function money(value, positive = false, label = "Nominal") {
    if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) fail(`${label} harus berupa Rupiah bulat ${positive ? "positif" : "nonnegatif"} dalam batas angka aman.`);
    return value;
  }

  function add(left, right) {
    const result = left + right;
    if (!Number.isSafeInteger(result)) fail("Total nominal melampaui batas angka aman.");
    return result;
  }

  function date(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail("Tanggal harus berformat YYYY-MM-DD.");
    const [year, month, day] = value.split("-").map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) fail("Tanggal tidak valid dalam kalender.");
    return value;
  }

  function validateAccount(record) {
    if (!record || !accountKinds.has(record.kind)) fail("Jenis rekening atau cicilan tidak valid.");
    object(record, ["id", "kind", "name", "startDate", "totalAmount", "openingBalance", "notes"]);
    const totalAmount = money(record.totalAmount, record.kind === "installment", "Total cicilan");
    const openingBalance = money(record.openingBalance, false, "Saldo awal");
    if (record.kind === "installment" && openingBalance !== 0) fail("Saldo awal cicilan wajib 0.");
    if (record.kind !== "installment" && totalAmount !== 0) fail("Total cicilan untuk rekening simpanan wajib 0.");
    return {
      id: identifier(record.id), kind: record.kind, name: text(record.name, 120, true, "Nama"),
      startDate: date(record.startDate), totalAmount, openingBalance,
      notes: text(record.notes, 1000, false, "Catatan"),
    };
  }

  function validateEntry(record) {
    object(record, ["id", "accountId", "kind", "date", "amount", "description"]);
    if (!entryKinds.has(record.kind)) fail("Jenis transaksi pembukuan tidak valid.");
    return {
      id: identifier(record.id), accountId: identifier(record.accountId), kind: record.kind,
      date: date(record.date), amount: money(record.amount, true), description: text(record.description, 1000, false, "Deskripsi"),
    };
  }

  function list(value, max) {
    if (!Array.isArray(value) || value.length > max) fail(`Daftar data harus berupa array dengan maksimal ${max} record.`);
    for (let i = 0; i < value.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(value, i)) fail("Daftar data memiliki record kosong.");
    }
  }

  function unique(records) {
    const ids = new Set();
    for (const record of records) {
      if (ids.has(record.id)) fail("ID record duplikat dalam daftar data.");
      ids.add(record.id);
    }
  }

  function summarizeValidated(account, entries) {
    const summary = { paid: 0, remaining: 0, balance: 0, deposits: 0, withdrawals: 0 };
    summary.remaining = account.kind === "installment" ? account.totalAmount : 0;
    summary.balance = account.kind === "installment" ? 0 : account.openingBalance;
    // Date-only records cannot establish intraday order; settle deposits before withdrawals.
    const chronological = entries.slice().sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.kind === "withdrawal" ? 1 : 0) - (b.kind === "withdrawal" ? 1 : 0);
    });
    for (const entry of chronological) {
      if (entry.date < account.startDate) fail("Tanggal transaksi tidak boleh sebelum tanggal mulai rekening atau cicilan.");
      if (account.kind === "installment") {
        if (entry.kind !== "payment") fail("Transaksi cicilan harus berupa pembayaran.");
        summary.paid = add(summary.paid, entry.amount);
        summary.remaining = account.totalAmount - summary.paid;
        if (summary.remaining < 0) fail("Pembayaran melebihi total kewajiban cicilan.");
      } else {
        if (entry.kind === "payment") fail("Transaksi simpanan harus berupa setoran atau penarikan.");
        if (entry.kind === "deposit") {
          summary.deposits = add(summary.deposits, entry.amount);
          summary.balance = add(summary.balance, entry.amount);
        } else {
          summary.withdrawals = add(summary.withdrawals, entry.amount);
          summary.balance = add(summary.balance, -entry.amount);
          if (summary.balance < 0) fail("Penarikan melebihi saldo pada tanggal transaksi.");
        }
      }
    }
    return summary;
  }

  function emptyState() {
    return { accounts: [], entries: [] };
  }

  function validateState(books) {
    object(books, ["accounts", "entries"]);
    list(books.accounts, MAX_ACCOUNTS);
    list(books.entries, MAX_ENTRIES);
    const accounts = books.accounts.map(validateAccount);
    const entries = books.entries.map(validateEntry);
    unique(accounts);
    unique(entries);
    const grouped = new Map(accounts.map((account) => [account.id, []]));
    for (const entry of entries) {
      if (!grouped.has(entry.accountId)) fail("Rekening atau cicilan untuk transaksi tidak ditemukan.");
      grouped.get(entry.accountId).push(entry);
    }
    const totals = { paid: 0, remaining: 0, balance: 0, deposits: 0, withdrawals: 0, totalAmount: 0, openingBalance: 0 };
    for (const account of accounts) {
      const summary = summarizeValidated(account, grouped.get(account.id));
      for (const key of Object.keys(summary)) totals[key] = add(totals[key], summary[key]);
      totals.totalAmount = add(totals.totalAmount, account.totalAmount);
      totals.openingBalance = add(totals.openingBalance, account.openingBalance);
    }
    return { accounts, entries };
  }

  function summarizeAccount(account, entries) {
    const validated = validateAccount(account);
    list(entries, MAX_ENTRIES);
    const selected = entries.map(validateEntry).filter((entry) => entry.accountId === validated.id);
    unique(selected);
    return summarizeValidated(validated, selected);
  }

  function mergeBackup(existing, incoming) {
    const books = validateState(existing);
    const backup = validateState(incoming);
    const result = { books, addedAccounts: 0, addedEntries: 0, duplicates: 0, changed: [] };
    for (const [collection, counter] of [["accounts", "addedAccounts"], ["entries", "addedEntries"]]) {
      const byId = new Map(books[collection].map((record) => [record.id, record]));
      for (const record of backup[collection]) {
        if (byId.has(record.id)) {
          result.duplicates++;
          if (JSON.stringify(byId.get(record.id)) !== JSON.stringify(record)) result.changed.push(record.id);
        } else {
          books[collection].push(record);
          result[counter]++;
        }
      }
    }
    result.changed = [...new Set(result.changed)].sort();
    result.books = validateState(books);
    return result;
  }

  function applyOperation(books, operation) {
    const next = validateState(books);
    object(operation, ["id", "type", "record", "recordId", "cascade", "books"], ["id", "type"]);
    identifier(operation.id);
    let allowed;
    if (operation.type === "upsertAccount" || operation.type === "upsertEntry") {
      allowed = ["id", "type", "record"];
      object(operation, allowed);
      const isAccount = operation.type === "upsertAccount";
      const record = isAccount ? validateAccount(operation.record) : validateEntry(operation.record);
      const collection = isAccount ? next.accounts : next.entries;
      const index = collection.findIndex((existing) => existing.id === record.id);
      if (index < 0) collection.push(record);
      else collection[index] = record;
    } else if (operation.type === "deleteAccount" || operation.type === "deleteEntry") {
      const isAccount = operation.type === "deleteAccount";
      allowed = isAccount ? ["id", "type", "recordId", "cascade"] : ["id", "type", "recordId"];
      object(operation, allowed, ["id", "type", "recordId"]);
      identifier(operation.recordId);
      if (Object.prototype.hasOwnProperty.call(operation, "cascade") && typeof operation.cascade !== "boolean") fail("Konfirmasi hapus riwayat harus berupa boolean.");
      const collection = isAccount ? next.accounts : next.entries;
      const index = collection.findIndex((record) => record.id === operation.recordId);
      if (index < 0) fail("Record yang akan dihapus tidak ditemukan.");
      if (isAccount) {
        if (next.entries.some((entry) => entry.accountId === operation.recordId) && operation.cascade !== true) fail("Hapus rekening beserta riwayat memerlukan konfirmasi.");
        next.entries = next.entries.filter((entry) => entry.accountId !== operation.recordId);
      }
      collection.splice(index, 1);
    } else if (operation.type === "restore") {
      object(operation, ["id", "type", "books"]);
      return mergeBackup(next, operation.books).books;
    } else fail("Jenis operasi pembukuan tidak didukung.");
    return validateState(next);
  }

  return { emptyState, validateState, applyOperation, summarizeAccount, mergeBackup };
});

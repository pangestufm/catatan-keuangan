const test = require("node:test");
const assert = require("node:assert/strict");
const { createApp, transaction } = require("./helpers/app-harness.cjs");

// finance_workspace_state as a key/value table, enough for the transactions function.
class StateTable {
  constructor() { this.rows = new Map(); }
  async query(sql, params = []) {
    const normalized = sql.trim().replace(/\s+/g, " ").toLowerCase();
    if (normalized.startsWith("create")) return { rows: [] };
    if (normalized.startsWith("select state_value")) {
      const row = this.rows.get(params[0]);
      return { rows: row ? [{ state_value: JSON.parse(JSON.stringify(row)), updated_at: new Date().toISOString() }] : [] };
    }
    if (normalized.startsWith("insert into finance_workspace_state")) {
      this.rows.set(params[0], JSON.parse(params[1]));
      return { rows: [] };
    }
    throw new Error(`unexpected query: ${normalized.slice(0, 60)}`);
  }
}

function useServer(t) {
  const table = new StateTable();
  const previousPool = globalThis.__catatanKeuanganDatabasePool;
  const previousToken = process.env.APP_ACCESS_TOKEN;
  globalThis.__catatanKeuanganDatabasePool = table;
  process.env.APP_ACCESS_TOKEN = "test-token";
  t.after(() => {
    globalThis.__catatanKeuanganDatabasePool = previousPool;
    if (previousToken === undefined) delete process.env.APP_ACCESS_TOKEN;
    else process.env.APP_ACCESS_TOKEN = previousToken;
  });
  const { handler } = require("../netlify/functions/transactions.js");
  const call = async (method, body) => {
    const response = await handler({ httpMethod: method, headers: { "x-app-token": "test-token", "x-app-workspace": "ando" }, body: body ? JSON.stringify(body) : undefined });
    return { status: response.statusCode, body: JSON.parse(response.body) };
  };
  return { table, call };
}

const row = (id, amount = 10000) => transaction({ id, amount, description: `Catatan ${id}`, date: "2026-11-08" });

test("transaksi yang dihapus di satu perangkat tidak bisa dihidupkan lagi oleh salinan lama perangkat lain", async (t) => {
  const { table, call } = useServer(t);
  await call("PUT", { transactions: [row("a"), row("keep", 3000000), row("b")] });
  const deleted = await call("PUT", { transactions: [row("a"), row("b")], deletedIds: ["keep"] });
  assert.deepEqual(deleted.body.transactions.map((item) => item.id), ["a", "b"]);
  assert.deepEqual(deleted.body.deletedIds, ["keep"]);
  // A phone with yesterday's copy (and the app version without deletedIds) saves everything it has.
  const stale = await call("PUT", { transactions: [row("a"), row("keep", 3000000), row("b"), row("c")] });
  assert.deepEqual(stale.body.transactions.map((item) => item.id).sort(), ["a", "b", "c"], "yang baru tetap masuk, yang dihapus tidak kembali");
  const read = await call("GET");
  assert.deepEqual(read.body.transactions.map((item) => item.id).sort(), ["a", "b", "c"]);
  assert.deepEqual(read.body.deletedIds, ["keep"]);
  assert.ok(table.rows.has("transactions:ando"), "data transaksi tetap di kunci lama");
  assert.ok(table.rows.has("deleted:ando"), "catatan hapus di baris terpisah");
});

test("pulihkan dari backup dengan restoredIds tetap bisa mengembalikan transaksi yang pernah dihapus", async (t) => {
  const { call } = useServer(t);
  await call("PUT", { transactions: [row("a")], deletedIds: ["keep"] });
  const restored = await call("PUT", { transactions: [row("a"), row("keep", 3000000)], restoredIds: ["keep"] });
  assert.deepEqual(restored.body.transactions.map((item) => item.id).sort(), ["a", "keep"]);
  assert.deepEqual(restored.body.deletedIds, []);
});

test("hapus semua transaksi harian mencatat semua id supaya tidak kembali dari perangkat lain", async (t) => {
  const { call } = useServer(t);
  await call("PUT", { transactions: [row("a"), row("b")] });
  const cleared = await call("DELETE");
  assert.deepEqual(cleared.body.transactions, []);
  assert.deepEqual(cleared.body.deletedIds.sort(), ["a", "b"]);
  const stale = await call("PUT", { transactions: [row("a"), row("b")] });
  assert.deepEqual(stale.body.transactions, []);
});

function onlineApp(remote, t) {
  const puts = [];
  const app = createApp(remote.local || [], {
    fetch: async (url, request = {}) => {
      if (!String(url).includes("transactions")) return { ok: false, status: 503, json: async () => ({}), clone() { return this; }, text: async () => "" };
      const body = request.body ? JSON.parse(request.body) : null;
      if (request.method === "PUT") {
        puts.push(body);
        const removed = new Set([...(remote.deletedIds || []), ...(body.deletedIds || [])]);
        remote.transactions = body.transactions.filter((item) => !removed.has(item.id));
        remote.deletedIds = [...removed];
      }
      const payload = { transactions: remote.transactions, deletedIds: remote.deletedIds || [] };
      return { ok: true, status: 200, json: async () => payload, clone() { return this; }, text: async () => JSON.stringify(payload) };
    },
  });
  t.after(app.close);
  return { app, puts };
}

async function goOnline(app) {
  app.window.localStorage.setItem("catatan-keuangan-auth", JSON.stringify({ workspaceId: "regression-fixture", accessToken: "test-token", isLocalOnly: false }));
  app.call("initializeSession");
  await app.call("initializeOnlineStorage");
}

test("saat dibuka, salinan lokal tidak menghidupkan lagi transaksi yang sudah dihapus di server", async (t) => {
  const remote = { transactions: [row("a")], deletedIds: ["keep"], local: [row("a"), row("keep", 3000000)] };
  const { app } = onlineApp(remote, t);
  await goOnline(app);
  assert.deepEqual(Array.from(app.call("FinanceData.transactions"), (item) => item.id), ["a"]);
  assert.deepEqual(remote.transactions.map((item) => item.id), ["a"]);
});

test("menghapus transaksi mengirim id-nya ke server lalu membersihkan antrean setelah diterima", async (t) => {
  const remote = { transactions: [row("a"), row("b")], deletedIds: [] };
  const { app, puts } = onlineApp(remote, t);
  await goOnline(app);
  app.call("markDeleted", ["b"]);
  await app.call("persistRemoteTransactions");
  assert.deepEqual(puts.at(-1).deletedIds, ["b"]);
  assert.deepEqual(remote.deletedIds, ["b"]);
  assert.deepEqual(Array.from(app.call("FinanceData.transactions"), (item) => item.id), ["a"], "daftar lokal mengikuti hasil server");
  assert.equal(app.window.localStorage.getItem("catatan-keuangan-sync-regression-fixture"), null, "antrean kosong setelah server menerima");
});

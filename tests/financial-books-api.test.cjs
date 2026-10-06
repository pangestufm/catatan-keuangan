const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Model = require("../financial-books-model.js");

const endpoint = path.join(__dirname, "..", "netlify", "functions", "financial-books.js");
const clone = (value) => JSON.parse(JSON.stringify(value));
const account = (overrides = {}) => ({
  id: "a1", kind: "savings", name: "Dana", startDate: "2026-01-01",
  totalAmount: 0, openingBalance: 100, notes: "", ...overrides,
});
const operation = (id = "op1", record = account()) => ({ id, type: "upsertAccount", record });

class FakePool {
  constructor() {
    this.rows = new Map();
    this.operations = new Map();
    this.calls = [];
    this.fail = false;
    this.beforeUpdate = null;
  }

  async query(sql, params = []) {
    this.calls.push({ sql, params });
    assert.doesNotMatch(sql, /finance_workspace_state|supabase|transactions:/i, "must never access main-book storage");
    if (this.fail) throw new Error("database password=private-secret host=production-db");
    const normalized = sql.trim().replace(/\s+/g, " ").toLowerCase();
    if (normalized.startsWith("create table")) {
      if (normalized.includes('finance_special_book_operations')) {
        assert.match(normalized, /primary key \(workspace_id, operation_id\)/);
      } else {
        assert.match(normalized, /finance_special_books/);
        assert.match(normalized, /revision integer/);
      }
      return { rows: [] };
    }
    assert.match(sql, /finance_special_books/);
    assert.match(sql, /\$1/);
    const key = params[0];
    assert.equal(typeof key, "string");
    if (normalized.startsWith("select")) {
      if (!this.rows.has(key)) return { rows: [] };
      const requested = JSON.parse(params[1] || '[]');
      const acknowledged_opids = requested.filter(id => this.operations.get(key)?.has(id));
      return { rows: [{ ...clone(this.rows.get(key)), acknowledged_opids }] };
    }
    if (normalized.startsWith("insert")) {
      assert.match(normalized, /on conflict.*do nothing/);
      if (!this.rows.has(key)) this.rows.set(key, { data: JSON.parse(params[1]), revision: 0, recent_opids: [] });
      return { rows: [] };
    }
    if (normalized.startsWith("with updated as")) {
      assert.match(normalized, /where workspace_id = \$1 and revision = \$3/);
      assert.match(normalized, /returning/);
      assert.match(normalized, /insert into finance_special_book_operations/);
      if (this.beforeUpdate) {
        const callback = this.beforeUpdate;
        this.beforeUpdate = null;
        callback(this, key);
      }
      const row = this.rows.get(key);
      if (!row || row.revision !== params[2] || row.recent_opids.includes(params[4]) || this.operations.get(key)?.has(params[4])) return { rows: [] };
      row.data = JSON.parse(params[1]);
      row.recent_opids = JSON.parse(params[3]);
      row.revision++;
      const recorded = this.operations.get(key) || new Set();
      for (const id of [...JSON.parse(params[5]), params[4]]) recorded.add(id);
      this.operations.set(key, recorded);
      return { rows: [clone(row)] };
    }
    assert.fail(`Unexpected SQL: ${sql}`);
  }
}

function setup(t) {
  assert.ok(fs.existsSync(endpoint), "financial-books endpoint must exist");
  const previousToken = process.env.APP_ACCESS_TOKEN;
  const previousPool = globalThis.__catatanKeuanganDatabasePool;
  const pool = new FakePool();
  process.env.APP_ACCESS_TOKEN = "test-token";
  globalThis.__catatanKeuanganDatabasePool = pool;
  t.after(() => {
    if (previousToken === undefined) delete process.env.APP_ACCESS_TOKEN;
    else process.env.APP_ACCESS_TOKEN = previousToken;
    if (previousPool === undefined) delete globalThis.__catatanKeuanganDatabasePool;
    else globalThis.__catatanKeuanganDatabasePool = previousPool;
  });
  return { pool, handler: require(endpoint).handler };
}

function event(method = "GET", payload, workspace = "alpha") {
  return {
    httpMethod: method,
    headers: { "x-app-token": "test-token", "x-app-workspace": workspace },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  };
}
const body = (response) => JSON.parse(response.body);
const post = (op = operation(), baseRevision = 0, workspace = "alpha") => event("POST", { baseRevision, operation: op }, workspace);

async function evictDeletedCreation(handler) {
  const creation = operation("lost-creation");
  assert.equal((await handler(post(creation))).statusCode, 200);
  assert.equal((await handler(post({ id: "lost-delete", type: "deleteAccount", recordId: "a1" }, 1))).statusCode, 200);
  for (let i = 0; i < 260; i++) {
    const response = await handler(post(operation(`later-${i}`, account({ id: "a2", name: `Later ${i}` })), i + 2));
    assert.equal(response.statusCode, 200);
  }
  const current = body(await handler(event()));
  assert.equal(current.revision, 262);
  assert.equal(current.appliedOperationIds.length, 256);
  assert.ok(!current.appliedOperationIds.includes(creation.id));
  assert.ok(!current.appliedOperationIds.includes("lost-delete"));
  return { creation, current };
}

test("existing database factory is exported and reused", async (t) => {
  const { pool } = setup(t);
  const { getDatabasePool } = require("../netlify/functions/transactions.js");
  assert.equal(typeof getDatabasePool, "function");
  assert.equal(await getDatabasePool(), pool);
});

test("OPTIONS is allowed without auth; other methods are 405 with no database access", async (t) => {
  const { pool, handler } = setup(t);
  delete process.env.APP_ACCESS_TOKEN;
  const preflight = await handler({ httpMethod: "OPTIONS", headers: {} });
  assert.equal(preflight.statusCode, 204);
  assert.equal(preflight.body, "");
  assert.equal(preflight.headers["Access-Control-Allow-Methods"], "GET, POST, OPTIONS");
  for (const method of ["PUT", "PATCH", "DELETE", "HEAD"]) {
    assert.equal((await handler({ httpMethod: method, headers: {} })).statusCode, 405);
  }
  assert.equal(pool.calls.length, 0);
});

test("unconfigured APP_ACCESS_TOKEN fails closed with 503", async (t) => {
  const { pool, handler } = setup(t);
  for (const token of [undefined, "", "   "]) {
    if (token === undefined) delete process.env.APP_ACCESS_TOKEN;
    else process.env.APP_ACCESS_TOKEN = token;
    for (const request of [event(), post()]) assert.equal((await handler(request)).statusCode, 503);
  }
  assert.equal(pool.calls.length, 0);
});

test("valid token and strict workspace are required, case-insensitive header names work", async (t) => {
  const { pool, handler } = setup(t);
  for (const token of [undefined, "wrong", "test-token "]) {
    const request = event();
    request.headers["x-app-token"] = token;
    assert.equal((await handler(request)).statusCode, 401);
  }
  assert.equal((await handler({ httpMethod: "GET" })).statusCode, 401);
  for (const workspace of ["", "Alpha", " alpha ", "a/b", "x".repeat(49), "a' OR 1=1 --", null]) {
    assert.equal((await handler(event("GET", undefined, workspace))).statusCode, 422);
  }
  assert.equal(pool.calls.length, 0);
  const request = event();
  request.headers = { "X-App-Token": "test-token", "X-App-Workspace": "alpha" };
  assert.equal((await handler(request)).statusCode, 200);
});

test("empty GET returns books/revision only and never initializes a workspace row", async (t) => {
  const { pool, handler } = setup(t);
  const response = await handler(event());
  assert.equal(response.statusCode, 200);
  assert.deepEqual(body(response), { books: Model.emptyState(), revision: 0, appliedOperationIds: [] });
  assert.equal(pool.rows.size, 0);
  assert.ok(pool.calls.every(({ sql }) => !/^\s*(insert|update|delete)/i.test(sql)));
  assert.equal(response.headers["Cache-Control"], "no-store");
});

test("POST persists a parametrized dedicated state with integer revisions and workspace isolation", async (t) => {
  const { pool, handler } = setup(t);
  const record = account({ name: "Robert'); drop table finance_special_books;--" });
  const first = await handler(post(operation("op1", record)));
  assert.equal(first.statusCode, 200);
  assert.deepEqual(body(first), { books: { accounts: [record], entries: [] }, revision: 1, appliedOperationIds: ["op1"] });
  assert.deepEqual(body(await handler(event())), body(first));
  assert.deepEqual(body(await handler(event("GET", undefined, "beta"))), { books: Model.emptyState(), revision: 0, appliedOperationIds: [] });
  assert.equal(pool.rows.size, 1);
  assert.ok(pool.calls.every(({ sql }) => !sql.includes(record.name) && !sql.includes("test-token")));
  assert.deepEqual(pool.rows.get("alpha").recent_opids, ["op1"]);
});

test("stale revisions return 409 and never acknowledge or persist the losing operation", async (t) => {
  const { pool, handler } = setup(t);
  await handler(post());
  const response = await handler(post(operation("op2", account({ name: "Overwrite" })), 0));
  assert.equal(response.statusCode, 409);
  assert.equal(body(response).revision, 1);
  assert.deepEqual(body(response).books, { accounts: [account()], entries: [] });
  assert.equal(pool.rows.get("alpha").revision, 1);
  assert.deepEqual(pool.rows.get("alpha").recent_opids, ["op1"]);
  assert.equal(body(response).operationId, undefined);
});

test("idempotent duplicate retry succeeds at current revision without a second mutation", async (t) => {
  const { pool, handler } = setup(t);
  await handler(post());
  const e = { id: "e1", accountId: "a1", kind: "deposit", date: "2026-01-02", amount: 50, description: "" };
  await handler(post({ id: "op2", type: "upsertEntry", record: e }, 1));
  const current = body(await handler(event()));
  const response = await handler(post(operation(), 0));
  assert.equal(response.statusCode, 200);
  assert.deepEqual(body(response), current);
  assert.equal(pool.rows.get("alpha").revision, 2);
  assert.equal(pool.calls.filter(({ sql }) => /^\s*with updated as/i.test(sql)).length, 2);
  // A repeated delete must not be revalidated against the now-missing record.
  const deletion = { id: "op3", type: "deleteEntry", recordId: "e1" };
  await handler(post(deletion, 2));
  assert.equal((await handler(post(deletion, 2))).statusCode, 200);
  assert.equal(pool.rows.get("alpha").revision, 3);
});

test("malformed JSON, payloads, operations and unsafe revisions reject without mutations", async (t) => {
  const { pool, handler } = setup(t);
  const badJson = event("POST");
  badJson.body = "{";
  assert.equal((await handler(badJson)).statusCode, 400);
  for (const payload of [null, [], {}, { baseRevision: 0 }, { baseRevision: 0, operation: null },
    { baseRevision: 0, operation: operation(), transactions: [] }]) {
    assert.equal((await handler(event("POST", payload))).statusCode, 422);
  }
  for (const revision of [-1, 0.1, "0", null, 2147483648]) {
    assert.equal((await handler(post(operation(), revision))).statusCode, 422);
  }
  for (const invalid of [operation(""), { id: "o1", type: "unknown" },
    operation("o1", account({ openingBalance: -1 })), operation("o1", account({ startDate: "2026-02-30" })),
    { id: "o1", type: "upsertEntry", record: { id: "e1", accountId: "missing", kind: "deposit", date: "2026-01-01", amount: 10, description: "" } },
    { id: "o1", type: "restore", books: { accounts: [], entries: [null] } }]) {
    assert.equal((await handler(post(invalid))).statusCode, 422);
  }
  assert.equal(pool.rows.size, 0);
  assert.ok(pool.calls.every(({ sql }) => !/^\s*(insert|update|delete)/i.test(sql)));
});

test("oversized payloads reject before querying the database", async (t) => {
  const { pool, handler } = setup(t);
  const request = post();
  request.body = " ".repeat(5 * 1024 * 1024 + 1);
  assert.equal((await handler(request)).statusCode, 413);
  assert.equal(pool.calls.length, 0);
});

test("account/entry history and additive restore validate on the server", async (t) => {
  const { pool, handler } = setup(t);
  await handler(post());
  const e = { id: "e1", accountId: "a1", kind: "withdrawal", date: "2026-01-02", amount: 50, description: "" };
  await handler(post({ id: "op2", type: "upsertEntry", record: e }, 1));
  assert.equal((await handler(post({ id: "bad", type: "upsertEntry", record: { ...e, amount: 101 } }, 2))).statusCode, 422);
  assert.equal((await handler(post({ id: "bad2", type: "deleteAccount", recordId: "a1" }, 2))).statusCode, 422);
  const backup = { accounts: [account({ name: "Changed" }), account({ id: "a2" })], entries: [] };
  const restored = await handler(post({ id: "op3", type: "restore", books: backup }, 2));
  assert.equal(restored.statusCode, 200);
  assert.equal(body(restored).books.accounts[0].name, "Dana");
  assert.equal(body(restored).books.accounts.length, 2);
  assert.equal(body(restored).books.entries.length, 1);
  const deleted = await handler(post({ id: "op4", type: "deleteAccount", recordId: "a1", cascade: true }, 3));
  assert.equal(deleted.statusCode, 200);
  assert.deepEqual(body(deleted).books, { accounts: [account({ id: "a2" })], entries: [] });
  assert.equal(pool.rows.get("alpha").revision, 4);
});

test("concurrent requests cannot overwrite each other at the same base revision", async (t) => {
  const { pool, handler } = setup(t);
  const results = await Promise.all([handler(post(operation("one", account({ id: "a1" })))), handler(post(operation("two", account({ id: "a2" }))))]);
  assert.deepEqual(results.map((result) => result.statusCode).sort(), [200, 409]);
  assert.equal(pool.rows.get("alpha").revision, 1);
  assert.equal(pool.rows.get("alpha").data.accounts.length, 1);
  assert.equal(pool.rows.get("alpha").recent_opids.length, 1);
});

test("concurrent retries with the same operation ID are acknowledged once", async (t) => {
  const { pool, handler } = setup(t);
  const results = await Promise.all([handler(post()), handler(post())]);
  assert.deepEqual(results.map((result) => result.statusCode), [200, 200]);
  assert.equal(pool.rows.get("alpha").revision, 1);
  assert.deepEqual(pool.rows.get("alpha").recent_opids, ["op1"]);
});

test("a compare-and-swap race returns fresh state instead of an unconditional retry", async (t) => {
  const { pool, handler } = setup(t);
  await handler(post());
  pool.beforeUpdate = (db, key) => {
    db.rows.get(key).data.accounts[0].name = "Concurrent writer";
    db.rows.get(key).revision = 2;
    db.rows.get(key).recent_opids.push("external");
  };
  const response = await handler(post(operation("op2", account({ name: "Losing writer" })), 1));
  assert.equal(response.statusCode, 409);
  assert.equal(body(response).books.accounts[0].name, "Concurrent writer");
  assert.equal(body(response).revision, 2);
  assert.ok(!pool.rows.get("alpha").recent_opids.includes("op2"));
});

test("recent operation IDs are bounded and workspace scoped", async (t) => {
  const { pool, handler } = setup(t);
  pool.rows.set("alpha", { data: Model.emptyState(), revision: 256, recent_opids: Array.from({ length: 256 }, (_, i) => `o${i}`) });
  assert.equal((await handler(post(operation("new"), 256))).statusCode, 200);
  const recent = pool.rows.get("alpha").recent_opids;
  assert.equal(recent.length, 256);
  assert.equal(recent[0], "o1");
  assert.equal(recent[255], "new");
  assert.equal((await handler(post(operation("new"), 0, "beta"))).statusCode, 200);
  assert.equal(pool.rows.get("beta").revision, 1);
});

test("database failures and corrupt stored state produce safe 500 errors without acknowledgements", async (t) => {
  const { pool, handler } = setup(t);
  pool.fail = true;
  for (const request of [event(), post()]) {
    const response = await handler(request);
    assert.equal(response.statusCode, 500);
    assert.doesNotMatch(response.body, /private-secret|production-db|password|stack|operationId/);
    assert.equal(body(response).books, undefined);
    assert.equal(body(response).revision, undefined);
  }
  pool.fail = false;
  for (const row of [
    { data: { accounts: [], entries: [null] }, revision: 1, recent_opids: [] },
    { data: Model.emptyState(), revision: -1, recent_opids: [] },
    { data: Model.emptyState(), revision: 1, recent_opids: "bad" },
  ]) {
    pool.rows.set("alpha", row);
    assert.equal((await handler(event())).statusCode, 500);
    assert.equal((await handler(post())).statusCode, 500);
  }
});

test("failed persistence does not record an operation ID or report success", async (t) => {
  const { pool, handler } = setup(t);
  await handler(post());
  pool.beforeUpdate = () => { throw new Error("commit failed private-secret"); };
  const response = await handler(post(operation("unsaved", account({ name: "Unsaved" })), 1));
  assert.equal(response.statusCode, 500);
  assert.doesNotMatch(response.body, /private-secret|unsaved/i);
  assert.equal(pool.rows.get("alpha").revision, 1);
  assert.deepEqual(pool.rows.get("alpha").recent_opids, ["op1"]);
  assert.equal(pool.rows.get("alpha").data.accounts[0].name, "Dana");
});

test("malformed duplicate or stale records reject before ID/revision acknowledgement", async (t) => {
  const { pool, handler } = setup(t);
  await handler(post());
  for (const id of ["op1", "new"]) {
    const response = await handler(post(operation(id, account({ openingBalance: -1 })), 0));
    assert.equal(response.statusCode, 422);
  }
  const malformedRestore = { id: "op1", type: "restore", books: { accounts: [], entries: [null] } };
  assert.equal((await handler(post(malformedRestore, 0))).statusCode, 422);
  assert.equal(pool.rows.get("alpha").revision, 1);
});

test("valid entry retries survive subsequent parent deletion but malformed retries reject", async (t) => {
  const { pool, handler } = setup(t);
  await handler(post());
  const original = { id: "op2", type: "upsertEntry", record: { id: "e1", accountId: "a1", kind: "deposit", date: "2026-01-02", amount: 50, description: "" } };
  await handler(post(original, 1));
  await handler(post({ id: "op3", type: "deleteAccount", recordId: "a1", cascade: true }, 2));
  assert.equal((await handler(post(original, 1))).statusCode, 200);
  assert.equal((await handler(post({ ...original, record: { ...original.record, amount: 0.5 } }, 1))).statusCode, 422);
  assert.equal(pool.rows.get("alpha").revision, 3);
});

test("maximum Postgres revision fails safely without wrapping or acknowledging the operation", async (t) => {
  const { pool, handler } = setup(t);
  pool.rows.set("alpha", { data: Model.emptyState(), revision: 2147483647, recent_opids: [] });
  assert.equal((await handler(post(operation(), 2147483647))).statusCode, 503);
  assert.deepEqual(pool.rows.get("alpha").recent_opids, []);
  assert.equal(pool.rows.get("alpha").revision, 2147483647);
});

test("GET exposes applied IDs for lost-response deletes before client replay validation", async (t) => {
  const { handler } = setup(t);
  await handler(post());
  await handler(post({ id: "deleted", type: "deleteAccount", recordId: "a1" }, 1));
  const remote = body(await handler(event()));
  assert.deepEqual(remote.books, Model.emptyState());
  assert.deepEqual(remote.appliedOperationIds, ["op1", "deleted"]);
  assert.equal(remote.revision, 2);
  const conflict = body(await handler(post(operation("not-saved"), 0)));
  assert.deepEqual(conflict.appliedOperationIds, ["op1", "deleted"]);
  assert.ok(!conflict.appliedOperationIds.includes("not-saved"));
});

for (const rebased of [false, true]) {
  test(`an evicted lost creation is acknowledged without resurrecting a deleted record (${rebased ? "rebased" : "stale"} retry)`, async (t) => {
    const { pool, handler } = setup(t);
    const { creation, current } = await evictDeletedCreation(handler);
    const response = await handler(post(creation, rebased ? current.revision : 0));
    assert.equal(response.statusCode, 200);
    assert.equal(body(response).revision, current.revision);
    assert.deepEqual(body(response).books, current.books);
    assert.ok(body(response).appliedOperationIds.includes(creation.id));
    assert.equal(pool.rows.get("alpha").revision, current.revision);
    assert.deepEqual(body(await handler(event())), current);
  });
}

test("GET operationIds reconciles evicted creation/delete acknowledgements without exposing all history", async (t) => {
  const { handler } = setup(t);
  const { current } = await evictDeletedCreation(handler);
  const request = event();
  request.queryStringParameters = { operationIds: "lost-creation,lost-delete,unknown,lost-creation" };
  const response = await handler(request);
  assert.equal(response.statusCode, 200);
  assert.equal(body(response).revision, current.revision);
  assert.deepEqual(body(response).books, current.books);
  assert.deepEqual(body(response).appliedOperationIds, [...current.appliedOperationIds, "lost-creation", "lost-delete"]);
  request.headers["x-app-workspace"] = "beta";
  assert.deepEqual(body(await handler(request)).appliedOperationIds, []);
});

test("GET operationIds rejects malformed/unbounded lookups before database access", async (t) => {
  const { pool, handler } = setup(t);
  for (const ids of ["", null, ["op1"], "op1,", "bad/id", "o".repeat(129), Array.from({ length: 257 }, (_, i) => `o${i}`).join(",")]) {
    const request = event();
    request.queryStringParameters = { operationIds: ids };
    assert.equal((await handler(request)).statusCode, 422);
  }
  const repeated = event();
  repeated.queryStringParameters = { operationIds: "op1" };
  repeated.multiValueQueryStringParameters = { operationIds: ["op1", "op2"] };
  assert.equal((await handler(repeated)).statusCode, 422);
  assert.equal(pool.calls.length, 0);
});

test("racing an evicted same-ID retry with a new writer never reapplies the deleted creation", async (t) => {
  const { pool, handler } = setup(t);
  const { creation, current } = await evictDeletedCreation(handler);
  const responses = await Promise.all([
    handler(post(creation, current.revision)),
    handler(post(operation("new-writer", account({ id: "a2", name: "Winner" })), current.revision)),
  ]);
  assert.deepEqual(responses.map((response) => response.statusCode), [200, 200]);
  assert.equal(pool.rows.get("alpha").revision, current.revision + 1);
  assert.deepEqual(pool.rows.get("alpha").data.accounts, [account({ id: "a2", name: "Winner" })]);
});

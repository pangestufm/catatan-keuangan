const { timingSafeEqual } = require("node:crypto");
const Model = require("../../financial-books-model.js");
const { getDatabasePool } = require("./transactions.js");

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const MAX_REVISION = 2147483647;
const MAX_RECENT_OPIDS = 256;
const MAX_LOOKUP_OPIDS = 256;
const ID_PATTERN = /^[A-Za-z0-9_-][A-Za-z0-9_.:-]{0,127}$/;
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-App-Token, X-App-Workspace",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

exports.handler = async (event) => {
  const method = event?.httpMethod;
  if (method === "OPTIONS") return respond(204);
  if (method !== "GET" && method !== "POST") return respond(405, { error: "Method not allowed" });

  const requiredToken = process.env.APP_ACCESS_TOKEN;
  if (!requiredToken || !requiredToken.trim()) return respond(503, { error: "Token akses aplikasi belum dikonfigurasi." });
  const providedToken = header(event, "x-app-token");
  if (!matchesToken(providedToken, requiredToken)) return respond(401, { error: "Token akses tidak valid." });
  const workspaceId = header(event, "x-app-workspace");
  if (typeof workspaceId !== "string" || !/^[a-z0-9][a-z0-9_-]{0,47}$/.test(workspaceId)) {
    return respond(422, { error: "Workspace harus berupa 1-48 karakter huruf kecil, angka, tanda hubung atau garis bawah, diawali huruf atau angka." });
  }

  let payload;
  let operationIds = [];
  if (method === "GET") {
    try {
      operationIds = lookupOperationIds(event);
    } catch {
      return respond(422, { error: "operationIds harus berisi 1-256 ID operasi valid, dipisahkan koma." });
    }
  }
  if (method === "POST") {
    if (typeof event.body !== "string") return respond(400, { error: "Payload JSON tidak valid." });
    if (Buffer.byteLength(event.body, "utf8") > MAX_BODY_BYTES) return respond(413, { error: "Payload melebihi batas 5 MiB." });
    try {
      payload = JSON.parse(event.body);
    } catch {
      return respond(400, { error: "Payload JSON tidak valid." });
    }
    if (!validPayload(payload)) return respond(422, { error: "Payload operasi atau revisi tidak valid." });
    try {
      validateRecords(payload.operation);
    } catch (error) {
      return respond(422, { error: error.message });
    }
    operationIds = [payload.operation.id];
  }

  try {
    const pool = await getDatabasePool();
    await ensureTable(pool);
    const current = await readState(pool, workspaceId, operationIds);
    if (method === "GET") return respond(200, publicState(current));

    // Check duplicate IDs before revision: the first acknowledgement may have been lost.
    if (hasApplied(current, payload.operation.id)) return respond(200, publicState(current));
    if (payload.baseRevision !== current.revision) return conflict(current);
    if (current.revision === MAX_REVISION) return respond(503, { error: "Batas revisi penyimpanan telah tercapai." });

    let books;
    try {
      books = Model.applyOperation(current.books, payload.operation);
    } catch (error) {
      return respond(422, { error: error.message });
    }

    await pool.query(
      `insert into finance_special_books (workspace_id, data, revision, recent_opids)
       values ($1, $2::jsonb, 0, '[]'::jsonb)
       on conflict (workspace_id) do nothing`,
      [workspaceId, JSON.stringify(Model.emptyState())],
    );
    const recentOpids = [...current.recentOpids, payload.operation.id].slice(-MAX_RECENT_OPIDS);
    // Ledger insertion and CAS must commit together; a unique-ID collision rolls both back.
    let result;
    try {
      result = await pool.query(
        `with updated as (
           update finance_special_books
           set data = $2::jsonb, revision = revision + 1, recent_opids = $4::jsonb
           where workspace_id = $1 and revision = $3
             and not (recent_opids ? $5)
             and not exists (
               select 1 from finance_special_book_operations
               where workspace_id = $1 and operation_id = $5
             )
           returning data, revision, recent_opids
         ), recorded as (
           insert into finance_special_book_operations (workspace_id, operation_id)
           select $1, $5 from updated
           returning operation_id
         ), backfilled as (
           insert into finance_special_book_operations (workspace_id, operation_id)
           select $1, legacy.operation_id
           from updated cross join jsonb_array_elements_text($6::jsonb) as legacy(operation_id)
           on conflict (workspace_id, operation_id) do nothing
         )
         select updated.data, updated.revision, updated.recent_opids
         from updated cross join recorded`,
        [workspaceId, JSON.stringify(books), current.revision, JSON.stringify(recentOpids),
          payload.operation.id, JSON.stringify(current.recentOpids)],
      );
    } catch (error) {
      if (error.code !== "23505") throw error;
      const latest = await readState(pool, workspaceId, operationIds);
      if (hasApplied(latest, payload.operation.id)) return respond(200, publicState(latest));
      throw error;
    }
    if (result.rows.length) return respond(200, publicState(decodeRow(result.rows[0])));

    // A racing writer won the CAS. Only the same already-persisted ID is a success.
    const latest = await readState(pool, workspaceId, operationIds);
    if (hasApplied(latest, payload.operation.id)) return respond(200, publicState(latest));
    return conflict(latest);
  } catch {
    return respond(500, { error: "Penyimpanan pembukuan khusus tidak tersedia. Silakan coba lagi." });
  }
};

function header(event, name) {
  const values = Object.entries(event.headers || {}).filter(([key]) => key.toLowerCase() === name);
  return values.length === 1 ? values[0][1] : undefined;
}

function lookupOperationIds(event) {
  const multiple = event.multiValueQueryStringParameters?.operationIds;
  if (multiple !== undefined && (!Array.isArray(multiple) || multiple.length !== 1)) throw new Error("Invalid lookup.");
  const query = event.queryStringParameters || {};
  if (!Object.prototype.hasOwnProperty.call(query, "operationIds") && multiple === undefined) return [];
  const value = multiple === undefined ? query.operationIds : multiple[0];
  if (typeof value !== "string" || value.length > MAX_LOOKUP_OPIDS * 129) throw new Error("Invalid lookup.");
  const ids = value.split(",");
  if (ids.length > MAX_LOOKUP_OPIDS || ids.some((id) => !ID_PATTERN.test(id))) throw new Error("Invalid lookup.");
  return [...new Set(ids)];
}

function matchesToken(provided, required) {
  if (typeof provided !== "string") return false;
  const left = Buffer.from(provided, "utf8");
  const right = Buffer.from(required, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function hasFields(value, fields, required = fields) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).every((key) => fields.includes(key))
    && required.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function validPayload(payload) {
  if (!hasFields(payload, ["baseRevision", "operation"]) || !Number.isInteger(payload.baseRevision)
    || payload.baseRevision < 0 || payload.baseRevision > MAX_REVISION) return false;
  const operation = payload.operation;
  if (!operation || typeof operation.id !== "string" || !ID_PATTERN.test(operation.id)) return false;
  if (operation.type === "upsertAccount" || operation.type === "upsertEntry") {
    return hasFields(operation, ["id", "type", "record"]) && operation.record
      && typeof operation.record === "object" && !Array.isArray(operation.record);
  }
  if (operation.type === "deleteAccount" || operation.type === "deleteEntry") {
    const fields = operation.type === "deleteAccount" ? ["id", "type", "recordId", "cascade"] : ["id", "type", "recordId"];
    return hasFields(operation, fields, ["id", "type", "recordId"])
      && typeof operation.recordId === "string" && ID_PATTERN.test(operation.recordId)
      && (!Object.prototype.hasOwnProperty.call(operation, "cascade") || typeof operation.cascade === "boolean");
  }
  if (operation.type === "restore") {
    return hasFields(operation, ["id", "type", "books"]) && hasFields(operation.books, ["accounts", "entries"]);
  }
  return false;
}

function validateRecords(operation) {
  if (operation.type === "upsertAccount") {
    Model.validateState({ accounts: [operation.record], entries: [] });
  } else if (operation.type === "upsertEntry") {
    const entry = operation.record;
    // Validate record syntax independently: the real parent may be gone on a valid retry.
    const installment = entry.kind === "payment";
    const parent = {
      id: entry.accountId, kind: installment ? "installment" : "savings",
      name: "Validasi", startDate: entry.date, notes: "",
      totalAmount: installment ? entry.amount : 0,
      openingBalance: installment ? 0 : entry.amount,
    };
    Model.validateState({ accounts: [parent], entries: [entry] });
  } else if (operation.type === "restore") {
    Model.validateState(operation.books);
  }
}

async function ensureTable(pool) {
  await pool.query(`
    create table if not exists finance_special_books (
      workspace_id text primary key,
      data jsonb not null default '{"accounts":[],"entries":[]}'::jsonb,
      revision integer not null default 0 check (revision >= 0),
      recent_opids jsonb not null default '[]'::jsonb
    )
  `);
  await pool.query(`
    create table if not exists finance_special_book_operations (
      workspace_id text not null,
      operation_id text not null,
      primary key (workspace_id, operation_id)
    )
  `);
}

async function readState(pool, workspaceId, operationIds) {
  const result = await pool.query(
    `select data, revision, recent_opids,
       (select coalesce(jsonb_agg(requested.operation_id order by requested.position), '[]'::jsonb)
        from jsonb_array_elements_text($2::jsonb) with ordinality as requested(operation_id, position)
        where exists (
          select 1 from finance_special_book_operations
          where workspace_id = $1 and operation_id = requested.operation_id
        )) as acknowledged_opids
     from finance_special_books where workspace_id = $1 limit 1`,
    [workspaceId, JSON.stringify(operationIds)],
  );
  if (!result.rows.length) return { books: Model.emptyState(), revision: 0, recentOpids: [], acknowledgedOpids: [] };
  return decodeRow(result.rows[0]);
}

function decodeRow(row) {
  const acknowledgedOpids = row.acknowledged_opids || [];
  if (!Number.isInteger(row.revision) || row.revision < 0 || row.revision > MAX_REVISION
    || !Array.isArray(row.recent_opids) || row.recent_opids.length > MAX_RECENT_OPIDS
    || row.recent_opids.some((id) => typeof id !== "string" || !ID_PATTERN.test(id))
    || new Set(row.recent_opids).size !== row.recent_opids.length
    || !Array.isArray(acknowledgedOpids) || acknowledgedOpids.length > MAX_LOOKUP_OPIDS
    || acknowledgedOpids.some((id) => typeof id !== "string" || !ID_PATTERN.test(id))
    || new Set(acknowledgedOpids).size !== acknowledgedOpids.length) throw new Error("Invalid stored revision metadata.");
  return { books: Model.validateState(row.data), revision: row.revision, recentOpids: row.recent_opids, acknowledgedOpids };
}

function hasApplied(state, operationId) {
  return state.acknowledgedOpids.includes(operationId) || state.recentOpids.includes(operationId);
}

function publicState(state) {
  return { books: state.books, revision: state.revision,
    appliedOperationIds: [...new Set([...state.recentOpids, ...state.acknowledgedOpids])] };
}

function conflict(state) {
  return respond(409, { error: "Revisi pembukuan berubah. Muat ulang data sebelum mengirim ulang operasi.", ...publicState(state) });
}

function respond(statusCode, payload = {}) {
  return { statusCode, headers, body: statusCode === 204 ? "" : JSON.stringify(payload) };
}

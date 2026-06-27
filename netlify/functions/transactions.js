const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-App-Token, X-App-Workspace",
  "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const LEGACY_BLOB_STORE_NAME = "catatan-keuangan";
const STORAGE_NAME = "netlify-database";

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return respond(204, {});
  }

  const requiredToken = process.env.APP_ACCESS_TOKEN || "";
  if (requiredToken) {
    const providedToken = event.headers["x-app-token"] || event.headers["X-App-Token"] || "";
    if (providedToken !== requiredToken) {
      return respond(401, { error: "Unauthorized" });
    }
  }

  try {
    const method = event.httpMethod;
    const query = event.queryStringParameters || {};
    const workspaceId = sanitizeWorkspace(event.headers["x-app-workspace"] || event.headers["X-App-Workspace"] || "");

    if (method === "GET" && query.health === "1") {
      return respond(200, await checkHealth(workspaceId));
    }

    if (!workspaceId) {
      return respond(422, { error: "Workspace wajib diisi." });
    }

    if (method === "GET") {
      return respond(200, await readState(workspaceId));
    }

    if (method === "DELETE") {
      await writeState(workspaceId, []);
      return respond(200, { transactions: [], updatedAt: new Date().toISOString(), storage: STORAGE_NAME });
    }

    if (method === "PUT" || method === "POST") {
      const payload = JSON.parse(event.body || "{}");
      if (payload?.action === "migrate-all") {
        return respond(200, await migrateAllLegacySupabaseData());
      }

      if (!payload || !Array.isArray(payload.transactions)) {
        return respond(422, { error: "Payload harus berisi transactions array." });
      }

      const transactions = sanitizeTransactions(payload.transactions);
      await writeState(workspaceId, transactions);
      return respond(200, { transactions, updatedAt: new Date().toISOString(), storage: "netlify-database" });
    }

    return respond(405, { error: "Method not allowed" });
  } catch (error) {
    return respond(500, { error: "Server error", message: error.message });
  }
};

async function readState(workspaceId) {
  const stateKey = createStateKey(workspaceId);
  const databaseState = await readDatabaseState(stateKey);
  if (databaseState) {
    return databaseState;
  }

  const legacyState = await readLegacyBlobState(stateKey) || await readLegacySupabaseState(stateKey);
  if (legacyState) {
    await writeDatabaseState(stateKey, legacyState.transactions, legacyState.storage || "legacy");
    return {
      transactions: legacyState.transactions,
      updatedAt: legacyState.updatedAt || new Date().toISOString(),
      storage: STORAGE_NAME,
      migratedFrom: legacyState.storage || "legacy",
    };
  }

  return {
    transactions: [],
    updatedAt: null,
    storage: STORAGE_NAME,
  };
}

async function writeState(workspaceId, transactions) {
  await writeDatabaseState(createStateKey(workspaceId), transactions);
}

async function getDatabasePool() {
  if (globalThis.__catatanKeuanganDatabasePool) {
    return globalThis.__catatanKeuanganDatabasePool;
  }

  const pgModule = await import("pg");
  const Pool = pgModule.Pool || pgModule.default?.Pool;
  const connectionString = await getDatabaseConnectionString();

  if (!connectionString) {
    throw new Error("Netlify Database belum terhubung ke deploy ini. Pastikan database sudah dibuat, NETLIFY_DB_URL tersedia di deploy, lalu redeploy production.");
  }

  globalThis.__catatanKeuanganDatabasePool = new Pool({
    connectionString,
    max: 1,
  });
  return globalThis.__catatanKeuanganDatabasePool;
}

async function getDatabaseConnectionString() {
  if (process.env.NETLIFY_DB_URL) return process.env.NETLIFY_DB_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.NETLIFY_DATABASE_URL) return process.env.NETLIFY_DATABASE_URL;

  try {
    const databaseModule = await import("@netlify/database");
    const getConnectionString = databaseModule.getConnectionString || databaseModule.default?.getConnectionString;
    if (typeof getConnectionString === "function") {
      return getConnectionString() || "";
    }
  } catch {
    return "";
  }

  return "";
}

async function checkHealth(workspaceId) {
  const health = {
    ok: false,
    storage: STORAGE_NAME,
    workspace: workspaceId || null,
    hasNetlifyDbUrl: Boolean(process.env.NETLIFY_DB_URL),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL),
    hasSupabaseBackup: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    tableReady: false,
    workspaceCount: 0,
    message: "",
  };

  try {
    const connectionString = await getDatabaseConnectionString();
    health.hasConnectionString = Boolean(connectionString);
    const pool = await getDatabasePool();
    await ensureDatabaseTable(pool);
    const countResult = await pool.query("select count(*)::int as count from finance_workspace_state");
    health.tableReady = true;
    health.workspaceCount = Number(countResult.rows[0]?.count || 0);
    health.ok = true;
    health.message = "Netlify Database aktif dan tabel aplikasi siap.";
    return health;
  } catch (error) {
    health.message = error.message;
    return health;
  }
}

async function readDatabaseState(stateKey) {
  const pool = await getDatabasePool();
  await ensureDatabaseTable(pool);
  const result = await pool.query(
    "select state_value, updated_at from finance_workspace_state where state_key = $1 limit 1",
    [stateKey],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    transactions: sanitizeTransactions(row.state_value || []),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    storage: STORAGE_NAME,
  };
}

async function writeDatabaseState(stateKey, transactions, migratedFrom = "") {
  const pool = await getDatabasePool();
  await ensureDatabaseTable(pool);
  const updatedAt = new Date().toISOString();
  await pool.query(
    `
      insert into finance_workspace_state (state_key, state_value, updated_at, migrated_from)
      values ($1, $2::jsonb, $3::timestamptz, nullif($4, ''))
      on conflict (state_key)
      do update set
        state_value = excluded.state_value,
        updated_at = excluded.updated_at,
        migrated_from = coalesce(finance_workspace_state.migrated_from, excluded.migrated_from)
    `,
    [stateKey, JSON.stringify(sanitizeTransactions(transactions)), updatedAt, migratedFrom],
  );
}

async function ensureDatabaseTable(pool) {
  await pool.query(`
    create table if not exists finance_workspace_state (
      state_key text primary key,
      state_value jsonb not null default '[]'::jsonb,
      updated_at timestamptz not null default now(),
      migrated_from text
    )
  `);

  await pool.query(`
    create index if not exists finance_workspace_state_updated_at_idx
      on finance_workspace_state (updated_at desc)
  `);
}

async function readLegacyBlobState(stateKey) {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore({ name: LEGACY_BLOB_STORE_NAME, consistency: "strong" });
    const entry = await store.get(stateKey, { type: "json", consistency: "strong" });
    if (!entry || !Array.isArray(entry.transactions)) return null;

    return {
      transactions: sanitizeTransactions(entry.transactions),
      updatedAt: entry.updatedAt || null,
      storage: "netlify-blobs",
    };
  } catch {
    return null;
  }
}

async function readLegacySupabaseState(stateKey) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const response = await supabaseFetch(`/rest/v1/app_state?state_key=eq.${encodeURIComponent(stateKey)}&select=state_value,updated_at`);
  if (!response.ok) {
    throw new Error(`Supabase migration read failed: ${response.status}`);
  }

  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!Array.isArray(row?.state_value)) return null;

  return {
    transactions: sanitizeTransactions(row.state_value),
    updatedAt: row?.updated_at || null,
    storage: "supabase",
  };
}

async function migrateAllLegacySupabaseData() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      migrated: 0,
      storage: STORAGE_NAME,
      message: "Supabase env tidak tersedia, tidak ada backup Supabase yang bisa dimigrasikan otomatis.",
    };
  }

  const response = await supabaseFetch("/rest/v1/app_state?select=state_key,state_value,updated_at");
  if (!response.ok) {
    throw new Error(`Supabase migration read failed: ${response.status}`);
  }

  const rows = await response.json();
  const migratedWorkspaces = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row?.state_key || !Array.isArray(row.state_value)) continue;
    await writeDatabaseState(row.state_key, row.state_value, "supabase");
    migratedWorkspaces.push(row.state_key);
  }

  return {
    migrated: migratedWorkspaces.length,
    workspaces: migratedWorkspaces,
    storage: STORAGE_NAME,
    message: `${migratedWorkspaces.length} workspace berhasil dimigrasikan ke Netlify Database.`,
  };
}

async function supabaseFetch(path, options = {}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
}

function sanitizeTransactions(transactions) {
  return transactions
    .filter((transaction) => transaction && (transaction.type === "income" || transaction.type === "expense") && Number(transaction.amount) > 0)
    .map((transaction) => ({
      id: cleanString(transaction.id || cryptoRandomId()),
      date: cleanString(transaction.date || new Date().toISOString().slice(0, 10)),
      type: transaction.type,
      category: cleanString(transaction.category || "Lainnya"),
      description: cleanString(transaction.description || "-"),
      amount: Math.round(Number(transaction.amount)),
      source: cleanString(transaction.source || "Online"),
      createdAt: cleanString(transaction.createdAt || new Date().toISOString()),
    }));
}

function cryptoRandomId() {
  return `trx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanString(value) {
  return String(value ?? "").trim();
}

function sanitizeWorkspace(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function createStateKey(workspaceId) {
  return `transactions:${workspaceId}`;
}

function respond(statusCode, payload) {
  return {
    statusCode,
    headers: corsHeaders,
    body: statusCode === 204 ? "" : JSON.stringify(payload),
  };
}

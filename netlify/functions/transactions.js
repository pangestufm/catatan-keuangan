const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-App-Token, X-App-Workspace",
  "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

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
    const workspaceId = sanitizeWorkspace(event.headers["x-app-workspace"] || event.headers["X-App-Workspace"] || "");

    if (!workspaceId) {
      return respond(422, { error: "Workspace wajib diisi." });
    }

    if (method === "GET") {
      return respond(200, await readState(workspaceId));
    }

    if (method === "DELETE") {
      await writeState(workspaceId, []);
      return respond(200, { transactions: [], updatedAt: new Date().toISOString() });
    }

    if (method === "PUT" || method === "POST") {
      const payload = JSON.parse(event.body || "{}");
      if (!payload || !Array.isArray(payload.transactions)) {
        return respond(422, { error: "Payload harus berisi transactions array." });
      }

      const transactions = sanitizeTransactions(payload.transactions);
      await writeState(workspaceId, transactions);
      return respond(200, { transactions, updatedAt: new Date().toISOString() });
    }

    return respond(405, { error: "Method not allowed" });
  } catch (error) {
    return respond(500, { error: "Server error", message: error.message });
  }
};

async function readState(workspaceId) {
  const stateKey = createStateKey(workspaceId);
  const response = await supabaseFetch(`/rest/v1/app_state?state_key=eq.${encodeURIComponent(stateKey)}&select=state_value,updated_at`);
  if (!response.ok) {
    throw new Error(`Supabase read failed: ${response.status}`);
  }

  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  return {
    transactions: Array.isArray(row?.state_value) ? sanitizeTransactions(row.state_value) : [],
    updatedAt: row?.updated_at || null,
  };
}

async function writeState(workspaceId, transactions) {
  const stateKey = createStateKey(workspaceId);
  const response = await supabaseFetch("/rest/v1/app_state?on_conflict=state_key", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      state_key: stateKey,
      state_value: transactions,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase write failed: ${response.status}`);
  }
}

async function supabaseFetch(path, options = {}) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diisi di Netlify environment variables.");
  }

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

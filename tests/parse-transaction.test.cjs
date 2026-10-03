const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { handler } = require("../netlify/functions/parse-transaction.js");

function useNexosEnvironment(t, model) {
  const names = [
    "NEXOS_API_KEY",
    "NEXOS_MODEL",
    "AI_PROVIDER",
    "GEMINI_API_KEY",
    "OPENAI_API_KEY",
    "APP_ACCESS_TOKEN",
  ];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));

  process.env.NEXOS_API_KEY = "test-nexos-key";
  if (model) process.env.NEXOS_MODEL = model;
  else delete process.env.NEXOS_MODEL;
  delete process.env.AI_PROVIDER;
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.APP_ACCESS_TOKEN;

  t.after(() => {
    names.forEach((name) => {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    });
  });
}

function createEvent(overrides = {}) {
  return {
    httpMethod: "POST",
    headers: {},
    body: JSON.stringify({
      text: "bayar makan siang 75000",
      today: "2026-10-03",
      timezone: "Asia/Jakarta",
      categories: ["Konsumsi Harian (Makan & Minum)", "Transportasi"],
      categoryMemory: [{ keyword: "makan", category: "Konsumsi Harian (Makan & Minum)", count: 4 }],
      recentTransactions: [{
        date: "2026-10-02",
        type: "expense",
        category: "Konsumsi Harian (Makan & Minum)",
        description: "Makan malam",
        amount: 90000,
      }],
      ...overrides,
    }),
  };
}

function createSuccessResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
            type: "expense",
            date: "2026-10-03",
            category: "Konsumsi Harian (Makan & Minum)",
            description: "Makan siang",
            amount: 75000,
            confidence: 0.97,
            reason: "Pembayaran makanan adalah pengeluaran konsumsi.",
          }),
        },
      }],
    }),
  };
}

test("memakai Nexos DeepSeek V4.1 Flash untuk parsing chat dan voice", async (t) => {
  useNexosEnvironment(t);
  const originalFetch = global.fetch;

  global.fetch = async (url, options) => {
    assert.equal(url, "https://api.nexos.ai/v1/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer test-nexos-key");

    const request = JSON.parse(options.body);
    assert.equal(request.model, "DeepSeek V4.1 Flash");
    assert.deepEqual(request.response_format, { type: "json_object" });
    assert.equal(request.temperature, 0.1);
    assert.match(request.messages[0].content, /agent pencatat transaksi keuangan pribadi/i);
    assert.match(request.messages[1].content, /bayar makan siang 75000/);
    assert.match(request.messages[1].content, /recent_transactions/);
    return createSuccessResponse();
  };

  t.after(() => {
    global.fetch = originalFetch;
  });

  const response = await handler(createEvent());
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.provider, "nexos");
  assert.equal(body.model, "DeepSeek V4.1 Flash");
  assert.equal(body.transaction.type, "expense");
  assert.equal(body.transaction.category, "Konsumsi Harian (Makan & Minum)");
  assert.equal(body.transaction.amount, 75000);
});

test("menghormati model Nexos yang dikonfigurasi", async (t) => {
  useNexosEnvironment(t, "Nexos Model Khusus");
  const originalFetch = global.fetch;

  global.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    assert.equal(request.model, "Nexos Model Khusus");
    return createSuccessResponse();
  };

  t.after(() => {
    global.fetch = originalFetch;
  });

  const response = await handler(createEvent());
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.provider, "nexos");
  assert.equal(body.model, "Nexos Model Khusus");
});

test("menolak parsing agent ketika NEXOS_API_KEY belum tersedia", async (t) => {
  useNexosEnvironment(t);
  delete process.env.NEXOS_API_KEY;
  const originalFetch = global.fetch;
  let fetchCalled = false;

  global.fetch = async () => {
    fetchCalled = true;
    return createSuccessResponse();
  };

  t.after(() => {
    global.fetch = originalFetch;
  });

  const response = await handler(createEvent());
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 503);
  assert.equal(body.error, "NEXOS_API_KEY belum diisi di Netlify environment variables.");
  assert.equal(fetchCalled, false);
});

test("menampilkan Nexos sebagai sumber draft agent di aplikasi", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

  assert.match(appSource, /source:\s*"Nexos Agent"/);
  assert.match(appSource, /source === "Nexos Agent"\) return "agent Nexos"/);
  assert.doesNotMatch(appSource, /Gemini Agent|ChatGPT Agent/);
});

test("memberi agent Nexos waktu memproses sebelum memakai fallback lokal", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

  assert.match(appSource, /setTimeout\(\(\) => controller\.abort\(\), 30000\)/);
});

test("mendokumentasikan satu konfigurasi Nexos untuk seluruh fitur AI", () => {
  const readme = fs.readFileSync(path.join(__dirname, "..", "README.md"), "utf8");

  assert.match(readme, /chat, voice, dan impor mutasi bank memakai Nexos/i);
  assert.match(readme, /NEXOS_API_KEY/);
  assert.match(readme, /NEXOS_MODEL=DeepSeek V4\.1 Flash/);
  assert.doesNotMatch(readme, /AI_PROVIDER|GEMINI_API_KEY|OPENAI_API_KEY/);
});

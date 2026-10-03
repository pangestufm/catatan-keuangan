const test = require("node:test");
const assert = require("node:assert/strict");

const { handler } = require("../netlify/functions/parse-bank-statement.js");

function useNexosEnvironment(t) {
  const originalKey = process.env.NEXOS_API_KEY;
  const originalModel = process.env.NEXOS_MODEL;
  process.env.NEXOS_API_KEY = "test-nexos-key";
  delete process.env.NEXOS_MODEL;

  t.after(() => {
    if (originalKey === undefined) delete process.env.NEXOS_API_KEY;
    else process.env.NEXOS_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.NEXOS_MODEL;
    else process.env.NEXOS_MODEL = originalModel;
  });
}

function createSuccessResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{
        message: {
          content: JSON.stringify({
            statement: {
              institution: "Bank Contoh",
              accountName: "Ando",
              period: "1-17 September 2026",
            },
            transactions: [{
              date: "2026-09-17",
              type: "expense",
              category: "Transport",
              description: "Taksi",
              amount: 85000,
              reference: "REF-017",
              confidence: 0.98,
              reason: "Nominal berada di kolom debit.",
            }],
          }),
        },
      }],
    }),
  };
}

test("mengirim dokumen teks ke Nexos DeepSeek V4.1 Flash", async (t) => {
  useNexosEnvironment(t);
  const originalFetch = global.fetch;

  global.fetch = async (url, options) => {
    assert.equal(url, "https://api.nexos.ai/v1/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer test-nexos-key");

    const request = JSON.parse(options.body);
    assert.equal(request.model, "DeepSeek V4.1 Flash");
    assert.deepEqual(request.response_format, { type: "json_object" });
    assert.match(request.messages[0].content[0].text, /Tanggal,Keterangan,Debit,Referensi/);
    assert.equal(request.messages[0].content.length, 1);
    return createSuccessResponse();
  };

  t.after(() => {
    global.fetch = originalFetch;
  });

  const response = await handler({
    httpMethod: "POST",
    headers: {},
    body: JSON.stringify({
      fileName: "mutasi.csv",
      mimeType: "text/csv",
      documentText: "Tanggal,Keterangan,Debit,Referensi\n2026-09-17,Taksi,85000,REF-017",
      today: "2026-09-17",
    }),
  });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.provider, "nexos");
  assert.equal(body.model, "DeepSeek V4.1 Flash");
  assert.equal(body.transactions.length, 1);
  assert.equal(body.transactions[0].reference, "REF-017");
  assert.equal(body.transactions[0].type, "expense");
});

test("mengirim setiap halaman gambar sebagai multimodal image_url", async (t) => {
  useNexosEnvironment(t);
  const originalFetch = global.fetch;

  global.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    const content = request.messages[0].content;
    assert.equal(content.length, 3);
    assert.equal(content[1].type, "image_url");
    assert.equal(content[1].image_url.url, "data:image/jpeg;base64,page-one");
    assert.equal(content[2].image_url.url, "data:image/png;base64,page-two");
    return createSuccessResponse();
  };

  t.after(() => {
    global.fetch = originalFetch;
  });

  const response = await handler({
    httpMethod: "POST",
    headers: {},
    body: JSON.stringify({
      fileName: "mutasi.pdf",
      documentImages: [
        { mimeType: "image/jpeg", data: "page-one" },
        { mimeType: "image/png", data: "page-two" },
      ],
      today: "2026-09-17",
    }),
  });

  assert.equal(response.statusCode, 200);
});

test("menyembunyikan HTML upstream pada error Nexos", async (t) => {
  useNexosEnvironment(t);
  const originalFetch = global.fetch;

  global.fetch = async () => ({
    ok: false,
    status: 504,
    headers: { get: () => "text/html" },
    text: async () => "<HTML><HEAD><TITLE>Inactivity Timeout</TITLE></HEAD></HTML>",
  });

  t.after(() => {
    global.fetch = originalFetch;
  });

  const response = await handler({
    httpMethod: "POST",
    headers: {},
    body: JSON.stringify({
      fileName: "mutasi.csv",
      documentText: "Tanggal,Keterangan,Debit\n2026-09-17,Taksi,85000",
      today: "2026-09-17",
    }),
  });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 504);
  assert.equal(body.error, "Nexos terlalu lama memproses dokumen. Coba kurangi jumlah halaman lalu ulangi.");
  assert.doesNotMatch(response.body, /<HTML>/i);
});

test("membagi PDF teks panjang menjadi beberapa request lalu menggabungkan hasilnya", async (t) => {
  useNexosEnvironment(t);
  const originalFetch = global.fetch;
  let requestCount = 0;

  global.fetch = async (_url, options) => {
    requestCount += 1;
    const request = JSON.parse(options.body);
    assert.match(request.messages[0].content[0].text, /Bagian \d+ dari \d+/);

    const response = createSuccessResponse();
    const body = await response.json();
    const parsed = JSON.parse(body.choices[0].message.content);
    parsed.transactions[0].reference = `CHUNK-${requestCount}`;
    parsed.transactions[0].description = `Transaksi bagian ${requestCount}`;
    body.choices[0].message.content = JSON.stringify(parsed);
    return { ...response, json: async () => body };
  };

  t.after(() => {
    global.fetch = originalFetch;
  });

  const documentText = Array.from({ length: 10 }, (_, index) => (
    `=== Halaman ${index + 1} ===\n${`Baris transaksi ${index + 1} `.repeat(100)}`
  )).join("\n\n");

  const response = await handler({
    httpMethod: "POST",
    headers: {},
    body: JSON.stringify({
      fileName: "mutasi-10-halaman.pdf",
      documentText,
      today: "2026-09-17",
    }),
  });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.ok(requestCount > 1);
  assert.equal(body.transactions.length, requestCount);
});

test("memberi Nexos waktu proses hingga mendekati batas function Netlify", async (t) => {
  useNexosEnvironment(t);
  const originalFetch = global.fetch;
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  let timeoutDelay = 0;

  global.setTimeout = (_callback, delay) => {
    timeoutDelay = delay;
    return 1;
  };
  global.clearTimeout = () => {};
  global.fetch = async () => createSuccessResponse();

  t.after(() => {
    global.fetch = originalFetch;
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
  });

  const response = await handler({
    httpMethod: "POST",
    headers: {},
    body: JSON.stringify({
      fileName: "mutasi.csv",
      documentText: "Tanggal,Keterangan,Debit\n2026-09-17,Taksi,85000",
      today: "2026-09-17",
    }),
  });

  assert.equal(response.statusCode, 200);
  assert.ok(timeoutDelay >= 50000, `timeout masih terlalu pendek: ${timeoutDelay}ms`);
  assert.ok(timeoutDelay < 60000, `timeout harus di bawah batas Netlify: ${timeoutDelay}ms`);
});

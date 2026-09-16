const test = require("node:test");
const assert = require("node:assert/strict");

const { handler } = require("../netlify/functions/parse-bank-statement.js");

test("function mengembalikan transaksi terstruktur beserta referensi bank", async (t) => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";

  global.fetch = async (_url, options) => {
    const request = JSON.parse(options.body);
    const transactionSchema = request.generationConfig.responseSchema
      .properties.transactions.items;
    assert.ok(transactionSchema.required.includes("reference"));

    return {
      ok: true,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
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
            }],
          },
        }],
      }),
    };
  };

  t.after(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
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
  assert.equal(body.transactions.length, 1);
  assert.equal(body.transactions[0].reference, "REF-017");
  assert.equal(body.transactions[0].type, "expense");
});

const test = require("node:test");
const assert = require("node:assert/strict");

const endpoints = {
  transactions: require("../netlify/functions/transactions.js").handler,
  "parse-transaction": require("../netlify/functions/parse-transaction.js").handler,
  "parse-bank-statement": require("../netlify/functions/parse-bank-statement.js").handler,
};

function withToken(t, value) {
  const original = process.env.APP_ACCESS_TOKEN;
  if (value === undefined) delete process.env.APP_ACCESS_TOKEN;
  else process.env.APP_ACCESS_TOKEN = value;
  t.after(() => {
    if (original === undefined) delete process.env.APP_ACCESS_TOKEN;
    else process.env.APP_ACCESS_TOKEN = original;
  });
}

const request = (headers = {}) => ({ httpMethod: "POST", headers: { "x-app-workspace": "audit", ...headers }, body: "{}" });

test("tanpa APP_ACCESS_TOKEN di server, semua function menolak, bukan terbuka", async (t) => {
  withToken(t, undefined);
  for (const [name, handler] of Object.entries(endpoints)) {
    const response = await handler(request());
    assert.equal(response.statusCode, 503, name);
  }
});

test("token salah atau kosong ditolak 401, termasuk header dengan huruf besar", async (t) => {
  withToken(t, "rahasia-benar");
  for (const [name, handler] of Object.entries(endpoints)) {
    assert.equal((await handler(request())).statusCode, 401, `${name} tanpa token`);
    assert.equal((await handler(request({ "X-App-Token": "rahasia-salah" }))).statusCode, 401, `${name} token salah`);
    assert.equal((await handler(request({ "x-app-token": "rahasia-benar-tapi-lebih-panjang" }))).statusCode, 401, `${name} token beda panjang`);
  }
});

test("error server tidak membocorkan pesan internal ke browser", async (t) => {
  withToken(t, "rahasia-benar");
  const original = console.error;
  const originalKey = process.env.NEXOS_API_KEY;
  console.error = () => {};
  process.env.NEXOS_API_KEY = "test-nexos-key";
  t.after(() => {
    console.error = original;
    if (originalKey === undefined) delete process.env.NEXOS_API_KEY;
    else process.env.NEXOS_API_KEY = originalKey;
  });
  const response = await endpoints["parse-transaction"]({ httpMethod: "POST", headers: { "x-app-token": "rahasia-benar" }, body: "{bukan json" });
  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 500);
  assert.equal(body.message, undefined);
  assert.doesNotMatch(response.body, /JSON|position|token/i);
});

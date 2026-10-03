const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-App-Token, X-App-Workspace",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const NEXOS_API_URL = "https://api.nexos.ai/v1/chat/completions";
const DEFAULT_NEXOS_MODEL = "DeepSeek V4.1 Flash";

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return respond(204, {});
  }

  if (event.httpMethod !== "POST") {
    return respond(405, { error: "Method not allowed" });
  }

  const requiredToken = process.env.APP_ACCESS_TOKEN || "";
  if (requiredToken) {
    const providedToken = event.headers["x-app-token"] || event.headers["X-App-Token"] || "";
    if (providedToken !== requiredToken) {
      return respond(401, { error: "Unauthorized" });
    }
  }

  try {
    if (!process.env.NEXOS_API_KEY) {
      return respond(503, { error: "NEXOS_API_KEY belum diisi di Netlify environment variables." });
    }

    const payload = JSON.parse(event.body || "{}");
    const text = cleanString(payload.text);
    if (!text) {
      return respond(422, { error: "Teks transaksi wajib diisi." });
    }

    const context = {
      text,
      today: cleanString(payload.today) || new Date().toISOString().slice(0, 10),
      timezone: cleanString(payload.timezone) || "Asia/Jakarta",
      categories: sanitizeList(payload.categories).slice(0, 80),
      categoryMemory: sanitizeCategoryMemory(payload.categoryMemory).slice(0, 40),
      recentTransactions: sanitizeRecentTransactions(payload.recentTransactions).slice(0, 35),
    };

    const { result, model } = await callNexos(context);

    return respond(200, {
      provider: "nexos",
      model,
      transaction: sanitizeParsedTransaction(result),
    });
  } catch (error) {
    return respond(500, { error: "Parser agent gagal.", message: error.message });
  }
};

async function callNexos(context) {
  const model = cleanString(process.env.NEXOS_MODEL) || DEFAULT_NEXOS_MODEL;
  const response = await fetch(NEXOS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.NEXOS_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: buildInstructions(context) },
        { role: "user", content: JSON.stringify(buildAgentInput(context)) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1200,
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || `Nexos API gagal (status ${response.status}).`);
  }

  const outputText = extractNexosText(body);
  if (!outputText) {
    throw new Error("Respons Nexos tidak berisi hasil transaksi.");
  }

  return { model, result: parseJsonOutput(outputText) };
}

function buildAgentInput(context) {
  return {
    text: context.text,
    today: context.today,
    timezone: context.timezone,
    available_categories: context.categories,
    learned_category_memory: context.categoryMemory,
    recent_transactions: context.recentTransactions,
  };
}

function buildInstructions(context) {
  const categoryList = context.categories.length ? context.categories.join(", ") : "Lainnya";
  return [
    "Kamu adalah agent pencatat transaksi keuangan pribadi berbahasa Indonesia.",
    "Tugasmu hanya mengubah satu kalimat chat atau hasil voice menjadi satu draft transaksi.",
    `Hari ini adalah ${context.today} dengan timezone ${context.timezone}.`,
    `Kategori yang tersedia: ${categoryList}.`,
    "Aturan parsing:",
    "- Jika ada trigger 'kategori', kata/frasa setelahnya adalah kategori yang diminta. Pilih kategori tersedia yang paling dekat, atau gunakan frasa itu jika tidak ada yang cocok.",
    "- Jika user menyebut 'tanggal 4', artikan sebagai tanggal 4 pada bulan dan tahun dari tanggal hari ini, kecuali user menyebut bulan/tahun lain.",
    "- Angka setelah kata tanggal/tgl adalah tanggal, bukan nominal. Nominal biasanya angka terbesar/terakhir, atau angka dengan Rp/ribu/rb/k/juta/jt.",
    "- Contoh: 'belanja pizza tanggal 4 200000' => date tanggal 4 bulan berjalan, amount 200000, category Konsumsi Harian (Makan & Minum), description Pizza, type expense.",
    "- Default type adalah expense. Gunakan income hanya untuk gaji, bonus, pemasukan, refund, cashback, terima uang, atau konteks uang masuk.",
    "- Description harus singkat dan bersih: hapus kata catat, aku, saya, belanja, beli, bayar, tanggal, kategori, nominal, dan filler lain. Sisakan objek transaksi seperti Pizza, Gaji, Bensin.",
    "- Pakai learned_category_memory dan recent_transactions untuk mengikuti kebiasaan kategori user.",
    "- confidence 0 sampai 1. reason singkat dalam bahasa Indonesia.",
    "Balas hanya JSON object dengan field type, date, category, description, amount, confidence, dan reason.",
  ].join("\n");
}

function extractNexosText(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content.map((part) => cleanString(part?.text)).filter(Boolean).join("\n");
}

function parseJsonOutput(value) {
  const normalized = cleanString(value)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(normalized);
}

function sanitizeParsedTransaction(value) {
  return {
    type: value?.type === "income" ? "income" : "expense",
    date: /^\d{4}-\d{2}-\d{2}$/.test(cleanString(value?.date)) ? cleanString(value.date) : new Date().toISOString().slice(0, 10),
    category: cleanString(value?.category) || "Lainnya",
    description: cleanString(value?.description) || "-",
    amount: Math.round(Number(value?.amount) || 0),
    confidence: Number(value?.confidence) || 0,
    reason: cleanString(value?.reason),
  };
}

function sanitizeRecentTransactions(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    date: cleanString(item?.date),
    type: item?.type === "income" ? "income" : "expense",
    category: cleanString(item?.category),
    description: cleanString(item?.description),
    amount: Math.round(Number(item?.amount) || 0),
  })).filter((item) => item.description || item.category);
}

function sanitizeCategoryMemory(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    keyword: cleanString(item?.keyword),
    category: cleanString(item?.category),
    count: Math.round(Number(item?.count) || 0),
  })).filter((item) => item.keyword && item.category);
}

function sanitizeList(value) {
  if (!Array.isArray(value)) return [];
  return value.map(cleanString).filter(Boolean);
}

function cleanString(value) {
  return String(value ?? "").trim();
}

function respond(statusCode, payload) {
  return {
    statusCode,
    headers: corsHeaders,
    body: statusCode === 204 ? "" : JSON.stringify(payload),
  };
}

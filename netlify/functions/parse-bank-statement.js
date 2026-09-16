const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-App-Token, X-App-Workspace",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const MAX_BASE64_LENGTH = 5 * 1024 * 1024;
const MAX_TEXT_LENGTH = 250000;

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return respond(204, {});
  if (event.httpMethod !== "POST") return respond(405, { error: "Method not allowed" });

  const requiredToken = process.env.APP_ACCESS_TOKEN || "";
  if (requiredToken) {
    const providedToken = event.headers["x-app-token"] || event.headers["X-App-Token"] || "";
    if (providedToken !== requiredToken) return respond(401, { error: "Unauthorized" });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return respond(503, { error: "GEMINI_API_KEY belum diisi di Netlify environment variables." });
    }

    const payload = JSON.parse(event.body || "{}");
    const context = sanitizeContext(payload);
    if (!context.documentBase64 && !context.documentText) {
      return respond(422, { error: "Dokumen mutasi bank wajib disertakan." });
    }

    const result = await callGemini(context);
    const transactions = sanitizeTransactions(result?.transactions, context.today);
    return respond(200, {
      provider: "gemini",
      statement: {
        institution: cleanString(result?.statement?.institution),
        accountName: cleanString(result?.statement?.accountName),
        period: cleanString(result?.statement?.period),
      },
      transactions,
    });
  } catch (error) {
    return respond(500, { error: "Agent gagal membaca mutasi bank.", message: error.message });
  }
};

function sanitizeContext(payload) {
  const documentBase64 = cleanString(payload.documentBase64);
  if (documentBase64.length > MAX_BASE64_LENGTH) {
    throw new Error("Ukuran dokumen melebihi batas pemrosesan.");
  }

  return {
    fileName: cleanString(payload.fileName).slice(0, 180),
    mimeType: normalizeMimeType(payload.mimeType),
    documentBase64,
    documentText: cleanString(payload.documentText).slice(0, MAX_TEXT_LENGTH),
    today: /^\d{4}-\d{2}-\d{2}$/.test(cleanString(payload.today))
      ? cleanString(payload.today)
      : new Date().toISOString().slice(0, 10),
    timezone: cleanString(payload.timezone) || "Asia/Jakarta",
    categories: sanitizeList(payload.categories).slice(0, 80),
    categoryMemory: sanitizeCategoryMemory(payload.categoryMemory).slice(0, 40),
    recentTransactions: sanitizeRecentTransactions(payload.recentTransactions).slice(0, 50),
  };
}

async function callGemini(context) {
  const model = normalizeGeminiModelName(process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL);
  const parts = [{ text: buildPrompt(context) }];

  if (context.documentText) {
    parts.push({ text: `\nIsi dokumen dalam format teks/CSV:\n${context.documentText}` });
  } else {
    parts.push({
      inline_data: {
        mime_type: context.mimeType,
        data: context.documentBase64,
      },
    });
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: getResponseSchema(),
        temperature: 0.1,
        maxOutputTokens: 32768,
      },
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.error?.message || `Gemini API error ${response.status}`);
  }

  const outputText = extractGeminiText(body);
  if (!outputText) throw new Error("Respons Gemini tidak berisi hasil JSON.");
  return JSON.parse(outputText);
}

function buildPrompt(context) {
  const categories = context.categories.length ? context.categories.join(", ") : "Lainnya";
  return [
    "Kamu adalah agent rekonsiliasi mutasi rekening bank berbahasa Indonesia.",
    `Baca dokumen ${context.fileName || "mutasi bank"} dan ekstrak setiap transaksi menjadi JSON.`,
    `Hari ini ${context.today}, timezone ${context.timezone}.`,
    `Kategori aplikasi yang tersedia: ${categories}.`,
    "",
    "Aturan klasifikasi:",
    "- Tentukan jenis dari sudut pandang pemilik rekening: dana masuk/kredit/CR adalah income; dana keluar/debit/DB adalah expense.",
    "- Jangan tertukar karena istilah debit dan kredit pada beberapa layout berada di kolom terpisah. Cocokkan nominal dengan judul kolomnya.",
    "- Transfer masuk, gaji, bunga, cashback, dan refund yang benar-benar menambah saldo adalah income.",
    "- Transfer keluar, pembayaran, tarik tunai, biaya admin, pajak, dan pembelian adalah expense.",
    "- Jangan buat transaksi dari saldo awal, saldo akhir, saldo berjalan, total debit/kredit, nomor rekening, atau baris ringkasan.",
    "- Jika ada reversal/pembatalan yang muncul sebagai dana kembali, catat sebagai income dan jelaskan singkat.",
    "- Gunakan tanggal transaksi, bukan tanggal cetak dokumen. Format tanggal YYYY-MM-DD.",
    "- Nominal selalu positif; arah uang ditentukan oleh field type.",
    "- Description harus ringkas tetapi tetap mempertahankan merchant/penerima/pengirim penting.",
    "- reference berisi nomor referensi/ID transaksi dari dokumen jika terlihat. Jangan mengarang; gunakan string kosong jika tidak ada.",
    "- Pilih kategori tersedia yang paling dekat. Gunakan Lainnya hanya jika konteks benar-benar tidak cukup.",
    "- confidence bernilai 0 sampai 1. Turunkan confidence jika arah transaksi, tanggal, atau keterangannya ambigu.",
    "- reason menjelaskan singkat petunjuk debit/kredit dan alasan kategori.",
    "- Pertahankan urutan transaksi seperti pada dokumen dan jangan mengarang transaksi yang tidak terlihat.",
    "",
    `Kebiasaan kategori user: ${JSON.stringify(context.categoryMemory)}`,
    `Contoh transaksi terbaru user: ${JSON.stringify(context.recentTransactions)}`,
    "Balas hanya JSON sesuai schema.",
  ].join("\n");
}

function getResponseSchema() {
  return {
    type: "object",
    required: ["statement", "transactions"],
    properties: {
      statement: {
        type: "object",
        required: ["institution", "accountName", "period"],
        properties: {
          institution: { type: "string" },
          accountName: { type: "string" },
          period: { type: "string" },
        },
      },
      transactions: {
        type: "array",
        items: {
          type: "object",
          required: ["date", "type", "category", "description", "amount", "reference", "confidence", "reason"],
          properties: {
            date: { type: "string", description: "Tanggal YYYY-MM-DD" },
            type: { type: "string", enum: ["income", "expense"] },
            category: { type: "string" },
            description: { type: "string" },
            amount: { type: "number" },
            reference: { type: "string" },
            confidence: { type: "number" },
            reason: { type: "string" },
          },
        },
      },
    },
  };
}

function sanitizeTransactions(value, fallbackDate) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 300).map((item) => ({
    date: /^\d{4}-\d{2}-\d{2}$/.test(cleanString(item?.date)) ? cleanString(item.date) : fallbackDate,
    type: item?.type === "income" ? "income" : "expense",
    category: cleanString(item?.category) || "Lainnya",
    description: cleanString(item?.description) || "Transaksi bank",
    amount: Math.abs(Math.round(Number(item?.amount) || 0)),
    reference: cleanString(item?.reference).slice(0, 120),
    confidence: Math.max(0, Math.min(1, Number(item?.confidence) || 0)),
    reason: cleanString(item?.reason),
  })).filter((item) => item.amount > 0);
}

function sanitizeRecentTransactions(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    date: cleanString(item?.date),
    type: item?.type === "income" ? "income" : "expense",
    category: cleanString(item?.category),
    description: cleanString(item?.description),
    amount: Math.abs(Math.round(Number(item?.amount) || 0)),
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

function normalizeMimeType(value) {
  const mimeType = cleanString(value).toLowerCase();
  const supported = ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/csv"];
  return supported.includes(mimeType) ? mimeType : "application/pdf";
}

function normalizeGeminiModelName(value) {
  const model = cleanString(value) || DEFAULT_GEMINI_MODEL;
  return model.startsWith("models/") ? model : `models/${model}`;
}

function extractGeminiText(body) {
  return (body.candidates || []).flatMap((candidate) => (
    candidate.content?.parts || []
  )).map((part) => (
    typeof part.text === "string" ? part.text : ""
  )).join("\n").trim();
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

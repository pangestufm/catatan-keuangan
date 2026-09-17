const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-App-Token, X-App-Workspace",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const NEXOS_API_URL = "https://api.nexos.ai/v1/chat/completions";
const DEFAULT_NEXOS_MODEL = "DeepSeek V4.1 Flash";
const MAX_IMAGE_COUNT = 6;
const MAX_TOTAL_BASE64_LENGTH = 6 * 1024 * 1024;
const MAX_TEXT_LENGTH = 250000;
const NEXOS_TIMEOUT_MS = 25000;

class AgentError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = "AgentError";
    this.statusCode = statusCode;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return respond(204, {});
  if (event.httpMethod !== "POST") return respond(405, { error: "Method not allowed" });

  const requiredToken = process.env.APP_ACCESS_TOKEN || "";
  if (requiredToken) {
    const providedToken = event.headers["x-app-token"] || event.headers["X-App-Token"] || "";
    if (providedToken !== requiredToken) return respond(401, { error: "Unauthorized" });
  }

  try {
    if (!process.env.NEXOS_API_KEY) {
      return respond(503, { error: "NEXOS_API_KEY belum diisi di Netlify environment variables." });
    }

    const payload = JSON.parse(event.body || "{}");
    const context = sanitizeContext(payload);
    if (!context.documentImages.length && !context.documentText) {
      return respond(422, { error: "Dokumen mutasi bank wajib disertakan." });
    }

    const { result, model } = await callNexos(context);
    const transactions = sanitizeTransactions(result?.transactions, context.today);
    return respond(200, {
      provider: "nexos",
      model,
      statement: {
        institution: cleanString(result?.statement?.institution),
        accountName: cleanString(result?.statement?.accountName),
        period: cleanString(result?.statement?.period),
      },
      transactions,
    });
  } catch (error) {
    const statusCode = error instanceof AgentError ? error.statusCode : 500;
    const message = error instanceof AgentError
      ? error.message
      : "Agent gagal membaca mutasi bank.";
    return respond(statusCode, { error: message });
  }
};

function sanitizeContext(payload) {
  const documentImages = sanitizeDocumentImages(payload.documentImages);
  const legacyBase64 = cleanString(payload.documentBase64);
  const legacyMimeType = normalizeImageMimeType(payload.mimeType);

  if (!documentImages.length && legacyBase64 && legacyMimeType) {
    documentImages.push({ mimeType: legacyMimeType, data: legacyBase64 });
  }

  const totalBase64Length = documentImages.reduce((total, image) => total + image.data.length, 0);
  if (totalBase64Length > MAX_TOTAL_BASE64_LENGTH) {
    throw new AgentError(413, "Dokumen terlalu besar untuk diproses. Kurangi jumlah halaman lalu ulangi.");
  }

  return {
    fileName: cleanString(payload.fileName).slice(0, 180),
    documentImages,
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

function sanitizeDocumentImages(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_IMAGE_COUNT).map((image) => ({
    mimeType: normalizeImageMimeType(image?.mimeType),
    data: cleanString(image?.data),
  })).filter((image) => image.mimeType && image.data);
}

async function callNexos(context) {
  const model = cleanString(process.env.NEXOS_MODEL) || DEFAULT_NEXOS_MODEL;
  const content = [{ type: "text", text: buildPromptWithDocument(context) }];

  context.documentImages.forEach((image) => {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${image.mimeType};base64,${image.data}`,
      },
    });
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NEXOS_TIMEOUT_MS);

  try {
    const response = await fetch(NEXOS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.NEXOS_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 16000,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const rawBody = await response.text().catch(() => "");
      if (response.status === 504) {
        throw new AgentError(504, "Nexos terlalu lama memproses dokumen. Coba kurangi jumlah halaman lalu ulangi.");
      }
      const providerMessage = extractProviderError(rawBody);
      throw new AgentError(502, providerMessage || `Nexos API gagal (status ${response.status}).`);
    }

    const body = await response.json().catch(() => {
      throw new AgentError(502, "Respons Nexos bukan JSON yang valid.");
    });
    const outputText = extractNexosText(body);
    if (!outputText) throw new AgentError(502, "Respons Nexos tidak berisi hasil transaksi.");

    return { result: parseJsonOutput(outputText), model };
  } catch (error) {
    if (error instanceof AgentError) throw error;
    if (error?.name === "AbortError") {
      throw new AgentError(504, "Nexos terlalu lama memproses dokumen. Coba kurangi jumlah halaman lalu ulangi.");
    }
    throw new AgentError(502, "Nexos tidak dapat dihubungi. Coba beberapa saat lagi.");
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildPromptWithDocument(context) {
  const prompt = buildPrompt(context);
  if (!context.documentText) return prompt;
  return `${prompt}\n\nIsi dokumen dalam format teks/CSV:\n${context.documentText}`;
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
    `Balas hanya JSON dengan bentuk: ${JSON.stringify(getResponseShape())}`,
  ].join("\n");
}

function getResponseShape() {
  return {
    statement: {
      institution: "string",
      accountName: "string",
      period: "string",
    },
    transactions: [{
      date: "YYYY-MM-DD",
      type: "income atau expense",
      category: "string",
      description: "string",
      amount: "number positif",
      reference: "string",
      confidence: "number 0 sampai 1",
      reason: "string",
    }],
  };
}

function extractNexosText(body) {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content.map((part) => (
    typeof part === "string" ? part : cleanString(part?.text)
  )).filter(Boolean).join("\n").trim();
}

function parseJsonOutput(value) {
  const cleaned = cleanString(value)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new AgentError(502, "Respons Nexos tidak memiliki struktur transaksi yang valid.");
  }

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new AgentError(502, "Respons Nexos tidak memiliki struktur transaksi yang valid.");
  }
}

function extractProviderError(rawBody) {
  const value = cleanString(rawBody);
  if (!value || /<html[\s>]/i.test(value)) return "";
  try {
    const payload = JSON.parse(value);
    return cleanString(payload?.error?.message || payload?.message).slice(0, 240);
  } catch {
    return value.slice(0, 240);
  }
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

function normalizeImageMimeType(value) {
  const mimeType = cleanString(value).toLowerCase();
  const supported = ["image/png", "image/jpeg", "image/webp"];
  return supported.includes(mimeType) ? mimeType : "";
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

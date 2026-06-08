const LEGACY_STORAGE_KEY = "catatan-keuangan-offline-v1";
const STORAGE_PREFIX = "catatan-keuangan-transactions";
const THEME_KEY = "catatan-keuangan-theme";
const API_TOKEN_KEY = "catatan-keuangan-api-token";
const AUTH_KEY = "catatan-keuangan-auth";
const API_URLS = ["/.netlify/functions/transactions", "api/transactions.php"];
const DEFAULT_CATEGORIES = [
  "Gaji",
  "Bonus",
  "Konsumsi Harian (Makan & Minum)",
  "Transport",
  "Belanja",
  "Kewajiban & Cicilan",
  "Tabungan & Investasi",
  "Utilitas & Langganan",
  "Kesehatan",
  "Pendidikan",
  "Hiburan",
  "Sosial, Donasi & Hadiah",
  "Administrasi & Layanan",
  "Lainnya",
];

const MONTH_NAMES = {
  januari: 0,
  jan: 0,
  februari: 1,
  feb: 1,
  maret: 2,
  mar: 2,
  april: 3,
  apr: 3,
  mei: 4,
  juni: 5,
  jun: 5,
  juli: 6,
  jul: 6,
  agustus: 7,
  agu: 7,
  september: 8,
  sep: 8,
  oktober: 9,
  okt: 9,
  november: 10,
  nov: 10,
  desember: 11,
  des: 11,
};

const CATEGORY_RULES = [
  { category: "Konsumsi Harian (Makan & Minum)", words: ["makan", "makanan", "minum", "kopi", "sarapan", "siang", "malam", "jajan", "pentol", "corndog", "warung", "angkringan", "resto", "restaurant", "pizza", "burger", "ayam", "nasi", "mie", "bakso", "sate", "snack", "roti", "kue"] },
  { category: "Transport", words: ["bensin", "transport", "parkir", "tol", "grab", "gojek", "ojek", "taksi", "bus", "kereta"] },
  { category: "Kewajiban & Cicilan", words: ["cicilan", "angsuran", "kredit", "cc", "rumah", "utang", "hutang"] },
  { category: "Tabungan & Investasi", words: ["tabungan", "saham", "investasi", "deposito", "reksa", "crypto"] },
  { category: "Utilitas & Langganan", words: ["listrik", "air", "wifi", "internet", "pulsa", "paket data", "langganan", "netflix", "spotify", "token"] },
  { category: "Kesehatan", words: ["obat", "dokter", "klinik", "rs", "rumah sakit", "vitamin", "kesehatan"] },
  { category: "Pendidikan", words: ["sekolah", "kuliah", "buku", "kursus", "pendidikan", "spp"] },
  { category: "Sosial, Donasi & Hadiah", words: ["donasi", "hadiah", "kado", "sedekah", "sosial", "dasos"] },
  { category: "Administrasi & Layanan", words: ["admin", "administrasi", "meterai", "biaya tf", "transfer", "layanan"] },
  { category: "Hiburan", words: ["film", "bioskop", "game", "liburan", "hiburan", "tiket"] },
  { category: "Gaji", words: ["gaji", "salary", "upah", "tunjangan", "thr", "g13"] },
  { category: "Bonus", words: ["bonus", "komisi", "insentif"] },
];

const state = {
  transactions: [],
  storageMode: "local",
  activeApiUrl: "",
  workspaceId: "",
  accessToken: "",
  isLocalOnly: false,
  isSyncing: false,
  syncTimer: null,
  filters: {
    search: "",
    type: "all",
    month: "",
  },
};

const elements = {
  form: document.querySelector("#transactionForm"),
  formTitle: document.querySelector("#formTitle"),
  transactionId: document.querySelector("#transactionId"),
  dateInput: document.querySelector("#dateInput"),
  typeInput: document.querySelector("#typeInput"),
  categoryInput: document.querySelector("#categoryInput"),
  descriptionInput: document.querySelector("#descriptionInput"),
  amountInput: document.querySelector("#amountInput"),
  saveButton: document.querySelector("#saveButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  incomeTotal: document.querySelector("#incomeTotal"),
  expenseTotal: document.querySelector("#expenseTotal"),
  balanceTotal: document.querySelector("#balanceTotal"),
  categoryList: document.querySelector("#categoryList"),
  categorySummarySelect: document.querySelector("#categorySummarySelect"),
  categoryIncome: document.querySelector("#categoryIncome"),
  categoryExpense: document.querySelector("#categoryExpense"),
  categoryBalance: document.querySelector("#categoryBalance"),
  categoryCount: document.querySelector("#categoryCount"),
  categoryBars: document.querySelector("#categoryBars"),
  searchInput: document.querySelector("#searchInput"),
  filterType: document.querySelector("#filterType"),
  filterMonth: document.querySelector("#filterMonth"),
  transactionRows: document.querySelector("#transactionRows"),
  emptyState: document.querySelector("#emptyState"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  exportExcelButton: document.querySelector("#exportExcelButton"),
  clearButton: document.querySelector("#clearButton"),
  importExcelInput: document.querySelector("#importExcelInput"),
  importStatus: document.querySelector("#importStatus"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
  chatStatus: document.querySelector("#chatStatus"),
  voiceButton: document.querySelector("#voiceButton"),
  themeToggle: document.querySelector("#themeToggle"),
  storageStatus: document.querySelector("#storageStatus"),
  appShell: document.querySelector("#appShell"),
  loginScreen: document.querySelector("#loginScreen"),
  loginForm: document.querySelector("#loginForm"),
  workspaceInput: document.querySelector("#workspaceInput"),
  accessTokenInput: document.querySelector("#accessTokenInput"),
  loginStatus: document.querySelector("#loginStatus"),
  localModeButton: document.querySelector("#localModeButton"),
  logoutButton: document.querySelector("#logoutButton"),
};

const currencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

initialize();

function initialize() {
  applySavedTheme();
  elements.dateInput.value = getTodayInputValue();
  bindEvents();
  initializeSession();
}

function bindEvents() {
  elements.form.addEventListener("submit", handleSubmit);
  elements.cancelEditButton.addEventListener("click", resetForm);
  elements.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    renderTable();
  });
  elements.filterType.addEventListener("change", (event) => {
    state.filters.type = event.target.value;
    renderTable();
  });
  elements.filterMonth.addEventListener("change", (event) => {
    state.filters.month = event.target.value;
    renderTable();
  });
  elements.categorySummarySelect.addEventListener("change", renderCategorySummary);
  elements.exportCsvButton.addEventListener("click", exportCsv);
  elements.exportExcelButton.addEventListener("click", exportExcel);
  elements.clearButton.addEventListener("click", clearAllData);
  elements.importExcelInput.addEventListener("change", importExcelFile);
  elements.chatForm.addEventListener("submit", handleChatSubmit);
  elements.voiceButton.addEventListener("click", startVoiceInput);
  elements.themeToggle.addEventListener("click", toggleTheme);
  elements.loginForm.addEventListener("submit", handleLoginSubmit);
  elements.localModeButton.addEventListener("click", enterLocalMode);
  elements.logoutButton.addEventListener("click", logout);
  elements.transactionRows.addEventListener("click", handleTableAction);
}

function initializeSession() {
  const savedSession = loadSession();
  if (!savedSession) {
    showLogin();
    return;
  }

  state.workspaceId = savedSession.workspaceId;
  state.accessToken = savedSession.accessToken;
  state.isLocalOnly = savedSession.isLocalOnly;
  startAppSession();
}

function handleLoginSubmit(event) {
  event.preventDefault();
  const workspaceId = sanitizeWorkspaceId(elements.workspaceInput.value);
  const accessToken = elements.accessTokenInput.value.trim();

  if (!workspaceId || !accessToken) {
    setLoginStatus("Isi workspace dan access token dulu.", "error");
    return;
  }

  state.workspaceId = workspaceId;
  state.accessToken = accessToken;
  state.isLocalOnly = false;
  saveSession();
  startAppSession();
}

function enterLocalMode() {
  const workspaceId = sanitizeWorkspaceId(elements.workspaceInput.value) || "lokal";
  state.workspaceId = workspaceId;
  state.accessToken = "";
  state.isLocalOnly = true;
  saveSession();
  startAppSession();
}

function startAppSession() {
  elements.loginScreen.classList.add("hidden");
  elements.appShell.classList.remove("hidden");
  state.transactions = loadTransactions();
  saveLocalTransactions();
  resetForm();
  render();

  if (state.isLocalOnly) {
    state.storageMode = "local";
    updateStorageStatus(`Mode Lokal · ${state.workspaceId}`, "Data tersimpan di browser perangkat ini.");
    return;
  }

  initializeOnlineStorage();
}

function showLogin() {
  elements.appShell.classList.add("hidden");
  elements.loginScreen.classList.remove("hidden");
  elements.workspaceInput.focus();
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  state.workspaceId = "";
  state.accessToken = "";
  state.isLocalOnly = false;
  state.activeApiUrl = "";
  state.transactions = [];
  elements.accessTokenInput.value = "";
  render();
  showLogin();
}

function saveSession() {
  localStorage.setItem(AUTH_KEY, JSON.stringify({
    workspaceId: state.workspaceId,
    accessToken: state.accessToken,
    isLocalOnly: state.isLocalOnly,
  }));
}

function loadSession() {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
    if (!session || !session.workspaceId) return null;
    return {
      workspaceId: sanitizeWorkspaceId(session.workspaceId),
      accessToken: String(session.accessToken || ""),
      isLocalOnly: Boolean(session.isLocalOnly),
    };
  } catch {
    return null;
  }
}

async function initializeOnlineStorage() {
  if (window.location.protocol === "file:") {
    updateStorageStatus(`Mode Lokal · ${state.workspaceId}`, "Data tersimpan di browser komputer ini.");
    return;
  }

  updateStorageStatus("Mengecek Online", `Mencari API penyimpanan online untuk workspace ${state.workspaceId}...`);

  try {
    const remoteState = await fetchRemoteTransactions();
    state.storageMode = "online";

    const mergedTransactions = mergeTransactions(remoteState.transactions, state.transactions);
    const shouldPushMergedData = mergedTransactions.length !== remoteState.transactions.length;
    state.transactions = mergedTransactions;
    saveLocalTransactions();
    render();

    updateStorageStatus(`Mode Online · ${state.workspaceId}`, "Data tersimpan di server dan tetap dicadangkan lokal.");
    if (shouldPushMergedData) {
      await persistRemoteTransactions();
    }
  } catch (error) {
    state.storageMode = "local";
    updateStorageStatus(`Mode Lokal · ${state.workspaceId}`, "API online belum aktif, data disimpan di browser ini.");
    console.info("Online storage tidak aktif:", error);
  }
}

async function fetchRemoteTransactions() {
  return apiRequest("GET");
}

async function persistRemoteTransactions() {
  if (state.storageMode !== "online") return;

  state.isSyncing = true;
  updateStorageStatus("Sinkronisasi", `Menyimpan perubahan workspace ${state.workspaceId} ke server...`);

  try {
    const response = await apiRequest("PUT", { transactions: state.transactions });
    state.transactions = mergeTransactions(response.transactions, []);
    saveLocalTransactions();
    render();
    updateStorageStatus(`Mode Online · ${state.workspaceId}`, "Perubahan tersimpan di server.");
  } catch (error) {
    state.storageMode = "local";
    updateStorageStatus(`Mode Lokal · ${state.workspaceId}`, "Gagal sync ke server, perubahan tetap tersimpan lokal.");
    console.error("Sync online gagal:", error);
  } finally {
    state.isSyncing = false;
  }
}

async function apiRequest(method, payload) {
  const urls = state.activeApiUrl ? [state.activeApiUrl] : API_URLS;
  let lastError;

  for (const apiUrl of urls) {
    try {
      const data = await requestApiUrl(apiUrl, method, payload);
      state.activeApiUrl = apiUrl;
      return data;
    } catch (error) {
      lastError = error;
      if (state.activeApiUrl) break;
    }
  }

  throw lastError || new Error("API online tidak tersedia.");
}

async function requestApiUrl(apiUrl, method, payload) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 3500);

  try {
    const response = await fetch(apiUrl, {
      method,
      headers: createApiHeaders(payload),
      body: payload ? JSON.stringify(payload) : undefined,
      signal: controller.signal,
    });

    if (response.status === 401) {
      const token = prompt("API online membutuhkan token. Masukkan access token dari Netlify APP_ACCESS_TOKEN atau api/config.php:");
      if (!token) throw new Error("API token dibatalkan.");
      localStorage.setItem(API_TOKEN_KEY, token.trim());
      return requestApiUrl(apiUrl, method, payload);
    }

    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.transactions)) {
      throw new Error("Respons API tidak valid.");
    }

    return data;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function createApiHeaders(payload) {
  const headers = {};
  const token = state.accessToken || localStorage.getItem(API_TOKEN_KEY);
  if (token) headers["X-App-Token"] = token;
  if (state.workspaceId) headers["X-App-Workspace"] = state.workspaceId;
  if (payload) headers["Content-Type"] = "application/json";
  return headers;
}

function queueRemoteSave() {
  if (state.storageMode !== "online") return;
  window.clearTimeout(state.syncTimer);
  state.syncTimer = window.setTimeout(persistRemoteTransactions, 350);
}

function mergeTransactions(primaryTransactions, secondaryTransactions) {
  const seen = new Set();
  return [...primaryTransactions, ...secondaryTransactions]
    .filter((transaction) => {
      if (!isValidTransaction(transaction)) return false;
      const key = transaction.id || createTransactionKey(transaction);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(normalizeTransaction)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function normalizeTransaction(transaction) {
  return {
    id: transaction.id || createId(),
    date: transaction.date || getTodayInputValue(),
    type: transaction.type,
    category: transaction.category || "Lainnya",
    description: transaction.description || "-",
    amount: Number(transaction.amount),
    source: transaction.source || "Online",
    createdAt: transaction.createdAt || new Date().toISOString(),
  };
}

function isValidTransaction(transaction) {
  return Boolean(
    transaction
    && (transaction.type === "income" || transaction.type === "expense")
    && transaction.description
    && Number(transaction.amount) > 0,
  );
}

function handleSubmit(event) {
  event.preventDefault();

  const amount = Number(elements.amountInput.value);
  const category = elements.categoryInput.value.trim();
  const description = elements.descriptionInput.value.trim();

  if (!category || !description || !Number.isFinite(amount) || amount <= 0) {
    alert("Lengkapi kategori, deskripsi, dan nominal yang valid.");
    return;
  }

  const transaction = {
    id: elements.transactionId.value || createId(),
    date: elements.dateInput.value,
    type: elements.typeInput.value,
    category,
    description,
    amount,
    source: "Manual",
    createdAt: new Date().toISOString(),
  };

  const existingIndex = state.transactions.findIndex((item) => item.id === transaction.id);
  if (existingIndex >= 0) {
    transaction.createdAt = state.transactions[existingIndex].createdAt;
    transaction.source = state.transactions[existingIndex].source || transaction.source;
    state.transactions[existingIndex] = transaction;
  } else {
    state.transactions.unshift(transaction);
  }

  saveTransactions();
  resetForm();
  render();
}

async function importExcelFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!window.XLSX) {
    showImportStatus("Parser Excel belum termuat. Pastikan file vendor/xlsx.full.min.js ada.", "error");
    event.target.value = "";
    return;
  }

  try {
    showImportStatus(`Membaca ${file.name}...`, "info");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const importedTransactions = parseWorkbookTransactions(workbook);

    if (!importedTransactions.length) {
      showImportStatus("Tidak ada transaksi yang ditemukan. Pastikan format kolom sesuai contoh Excel.", "error");
      return;
    }

    const existingKeys = new Set(state.transactions.map(createTransactionKey));
    const newTransactions = importedTransactions.filter((transaction) => {
      const key = createTransactionKey(transaction);
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    });

    if (!newTransactions.length) {
      showImportStatus(`Semua ${importedTransactions.length} transaksi dari Excel sudah ada di aplikasi.`, "info");
      return;
    }

    state.transactions = [...newTransactions, ...state.transactions];
    saveTransactions();
    resetForm();
    render();
    const totals = calculateTotals(newTransactions);
    showImportStatus(
      `Berhasil import ${newTransactions.length} transaksi: ${formatCurrency(totals.income)} pemasukan dan ${formatCurrency(totals.expense)} pengeluaran.`,
      "success",
    );
  } catch (error) {
    console.error(error);
    showImportStatus("Import gagal. File Excel mungkin rusak atau formatnya berbeda jauh dari contoh.", "error");
  } finally {
    event.target.value = "";
  }
}

function parseWorkbookTransactions(workbook) {
  const transactions = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    const firstSheetDate = findFirstDate(rows) || inferDateFromSheetName(sheetName);
    const incomeHeader = findHeaderRow(rows, [0, 1, 2], ["uraian", "tanggal", "nominal"]);
    const expenseHeader = findHeaderRow(rows, [4, 5, 6, 7], ["uraian", "tanggal", "kategori", "nominal"]);
    const startRow = Math.min(
      incomeHeader >= 0 ? incomeHeader + 1 : 5,
      expenseHeader >= 0 ? expenseHeader + 1 : 5,
    );

    rows.slice(startRow).forEach((row, index) => {
      const rowNumber = startRow + index + 1;
      const incomeDescription = cleanText(row[0]);
      const incomeAmount = parseAmount(row[2]);
      if (incomeDescription && incomeAmount > 0) {
        const date = parseExcelDate(row[1]) || firstSheetDate || getTodayInputValue();
        transactions.push(createTransaction({
          type: "income",
          date,
          category: inferCategory(incomeDescription, "income"),
          description: incomeDescription,
          amount: incomeAmount,
          source: `Excel ${sheetName} baris ${rowNumber}`,
        }));
      }

      const expenseDescription = cleanText(row[4]);
      const expenseAmount = parseAmount(row[7]);
      if (expenseDescription && expenseAmount > 0) {
        const date = parseExcelDate(row[5]) || firstSheetDate || getTodayInputValue();
        transactions.push(createTransaction({
          type: "expense",
          date,
          category: cleanText(row[6]) || inferCategory(expenseDescription, "expense"),
          description: expenseDescription,
          amount: expenseAmount,
          source: `Excel ${sheetName} baris ${rowNumber}`,
        }));
      }
    });
  });

  return transactions;
}

function handleChatSubmit(event) {
  event.preventDefault();
  const text = elements.chatInput.value.trim();
  if (!text) {
    setChatStatus("Tulis transaksi dulu, misalnya: aku hari ini belanja makanan 10000.", "error");
    return;
  }

  const parsed = parseChatTransaction(text);
  if (!parsed) {
    setChatStatus("Aku belum bisa menemukan nominalnya. Coba tulis seperti: belanja makanan 10000.", "error");
    return;
  }

  state.transactions.unshift(createTransaction(parsed));
  saveTransactions();
  elements.chatInput.value = "";
  render();
  setChatStatus(
    `Tercatat: ${parsed.type === "income" ? "pemasukan" : "pengeluaran"} ${formatCurrency(parsed.amount)} untuk ${parsed.category} pada ${formatDate(parsed.date)}.`,
    "success",
  );
}

function startVoiceInput() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setChatStatus("Voice input belum didukung browser ini. Coba Chrome atau Edge terbaru.", "error");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "id-ID";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  elements.voiceButton.disabled = true;
  elements.voiceButton.textContent = "Dengar...";
  setChatStatus("Silakan ucapkan transaksi, misalnya: belanja pizza tanggal 4 200000.", "info");

  recognition.addEventListener("result", (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || "";
    elements.chatInput.value = transcript;
    setChatStatus(`Terdengar: "${transcript}". Mencatat transaksi...`, "info");
    elements.chatForm.requestSubmit();
  });

  recognition.addEventListener("error", () => {
    setChatStatus("Voice input gagal membaca suara. Coba ulangi dengan kalimat lebih jelas.", "error");
  });

  recognition.addEventListener("end", () => {
    elements.voiceButton.disabled = false;
    elements.voiceButton.textContent = "Voice";
  });

  recognition.start();
}

function parseChatTransaction(text) {
  const dateCandidate = extractDateCandidate(text);
  const amountCandidate = extractAmountCandidate(text, dateCandidate);
  if (!amountCandidate) return null;

  const type = inferType(text);
  const category = inferCategory(text, type);
  const description = buildChatDescription(text, amountCandidate, dateCandidate, category);

  return {
    type,
    date: dateCandidate.date,
    category,
    description,
    amount: amountCandidate.amount,
    source: "Chat",
  };
}

function extractDateCandidate(text) {
  const lower = text.toLowerCase();
  const today = new Date();

  const relativeRules = [
    { pattern: /\bhari ini\b/i, offset: 0 },
    { pattern: /\bkemarin\b/i, offset: -1 },
    { pattern: /\bbesok\b/i, offset: 1 },
  ];

  for (const rule of relativeRules) {
    const match = text.match(rule.pattern);
    if (match) {
      const date = new Date(today);
      date.setDate(date.getDate() + rule.offset);
      return createDateCandidate(dateToInputValue(date), match.index, match.index + match[0].length, match[0]);
    }
  }

  const isoDate = lower.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (isoDate) {
    return createDateCandidate(
      dateToInputValue(new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]))),
      isoDate.index,
      isoDate.index + isoDate[0].length,
      isoDate[0],
    );
  }

  const numericDate = lower.match(/\b(?:tgl|tanggal)?\s*(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numericDate) {
    const year = numericDate[3] ? normalizeYear(Number(numericDate[3])) : today.getFullYear();
    return createDateCandidate(
      dateToInputValue(new Date(year, Number(numericDate[2]) - 1, Number(numericDate[1]))),
      numericDate.index,
      numericDate.index + numericDate[0].length,
      numericDate[0],
    );
  }

  const monthDate = lower.match(/\b(?:tgl|tanggal)?\s*(\d{1,2})\s+([a-z]+)(?:\s+(20\d{2}))?\b/);
  if (monthDate && MONTH_NAMES[monthDate[2]] !== undefined) {
    const year = monthDate[3] ? Number(monthDate[3]) : today.getFullYear();
    return createDateCandidate(
      dateToInputValue(new Date(year, MONTH_NAMES[monthDate[2]], Number(monthDate[1]))),
      monthDate.index,
      monthDate.index + monthDate[0].length,
      monthDate[0],
    );
  }

  const dayOnlyDate = lower.match(/\b(?:tgl|tanggal)\s*(\d{1,2})\b/);
  if (dayOnlyDate) {
    return createDateCandidate(
      dateToInputValue(new Date(today.getFullYear(), today.getMonth(), Number(dayOnlyDate[1]))),
      dayOnlyDate.index,
      dayOnlyDate.index + dayOnlyDate[0].length,
      dayOnlyDate[0],
    );
  }

  return createDateCandidate(getTodayInputValue(), -1, -1, "");
}

function createDateCandidate(date, start, end, raw) {
  return { date, start, end, raw };
}

function extractAmountCandidate(text, dateCandidate) {
  const candidates = [];
  const amountPattern = /(?:rp\s*)?([0-9][0-9.,]*)\s*(rb|ribu|k|jt|juta)?\b/gi;
  let match;

  while ((match = amountPattern.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (dateCandidate && start >= dateCandidate.start && end <= dateCandidate.end) continue;

    let amount = normalizeAmount(match[1]);
    const suffix = (match[2] || "").toLowerCase();
    if (suffix === "rb" || suffix === "ribu" || suffix === "k") amount *= 1000;
    if (suffix === "jt" || suffix === "juta") amount *= 1000000;
    if (!Number.isFinite(amount) || amount <= 0) continue;

    candidates.push({ amount, start, end, raw: match[0], suffix });
  }

  if (!candidates.length) return null;

  const strongCandidates = candidates.filter((candidate) => (
    candidate.suffix
    || candidate.amount >= 1000
    || candidate.raw.toLowerCase().includes("rp")
  ));

  const preferredCandidates = strongCandidates.length ? strongCandidates : candidates;
  return preferredCandidates[preferredCandidates.length - 1];
}

function buildChatDescription(text, amountCandidate, dateCandidate, category) {
  let cleaned = text;
  cleaned = removeTextRange(cleaned, amountCandidate.start, amountCandidate.end);
  if (dateCandidate.start >= 0) {
    cleaned = removeTextRange(cleaned, dateCandidate.start, dateCandidate.end);
  }

  cleaned = cleaned
    .replace(/\b(aku|saya|hari ini|kemarin|besok|tanggal|tgl|barusan|baru saja|catat|mencatat|transaksi|pengeluaran|pemasukan|belanja|beli|bayar|membeli|mengeluarkan|sebesar|seharga|senilai|untuk|di)\b/gi, " ")
    .replace(/[^\p{L}\p{N}\s&-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned && category === "Konsumsi Harian (Makan & Minum)") {
    cleaned = "Makanan";
  }

  return toTitleCase(cleaned || text);
}

function removeTextRange(text, start, end) {
  if (start < 0 || end <= start) return text;
  return `${text.slice(0, start)} ${text.slice(end)}`;
}

function handleTableAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;

  if (button.dataset.action === "edit") {
    fillForm(transaction);
    return;
  }

  if (button.dataset.action === "delete") {
    const confirmed = confirm(`Hapus transaksi "${transaction.description}"?`);
    if (!confirmed) return;

    state.transactions = state.transactions.filter((item) => item.id !== id);
    saveTransactions();
    render();
  }
}

function fillForm(transaction) {
  elements.transactionId.value = transaction.id;
  elements.dateInput.value = transaction.date;
  elements.typeInput.value = transaction.type;
  elements.categoryInput.value = transaction.category;
  elements.descriptionInput.value = transaction.description;
  elements.amountInput.value = transaction.amount;
  elements.formTitle.textContent = "Edit Transaksi";
  elements.saveButton.textContent = "Simpan Perubahan";
  elements.cancelEditButton.classList.remove("hidden");
  elements.descriptionInput.focus();
}

function resetForm() {
  elements.form.reset();
  elements.transactionId.value = "";
  elements.dateInput.value = getTodayInputValue();
  elements.formTitle.textContent = "Tambah Transaksi";
  elements.saveButton.textContent = "Simpan Transaksi";
  elements.cancelEditButton.classList.add("hidden");
}

function render() {
  renderCategoryOptions();
  renderTotals();
  renderCategorySummary();
  renderTable();
}

function renderTotals() {
  const totals = calculateTotals(state.transactions);
  elements.incomeTotal.textContent = formatCurrency(totals.income);
  elements.expenseTotal.textContent = formatCurrency(totals.expense);
  elements.balanceTotal.textContent = formatCurrency(totals.balance);
}

function renderCategoryOptions() {
  const previousSummary = elements.categorySummarySelect.value || "all";
  const categories = getCategories();

  elements.categoryList.innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}"></option>`).join("");
  elements.categorySummarySelect.innerHTML = [
    `<option value="all">Semua kategori</option>`,
    ...categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`),
  ].join("");

  elements.categorySummarySelect.value = categories.includes(previousSummary) ? previousSummary : "all";
}

function renderCategorySummary() {
  const selectedCategory = elements.categorySummarySelect.value;
  const selectedTransactions = selectedCategory === "all"
    ? state.transactions
    : state.transactions.filter((item) => item.category === selectedCategory);
  const totals = calculateTotals(selectedTransactions);

  elements.categoryIncome.textContent = formatCurrency(totals.income);
  elements.categoryExpense.textContent = formatCurrency(totals.expense);
  elements.categoryBalance.textContent = formatCurrency(totals.balance);
  elements.categoryCount.textContent = selectedTransactions.length.toString();
  renderCategoryBars(selectedCategory);
}

function renderCategoryBars(selectedCategory) {
  const grouped = new Map();
  const source = selectedCategory === "all"
    ? state.transactions
    : state.transactions.filter((item) => item.category === selectedCategory);

  source.forEach((item) => {
    const current = grouped.get(item.category) || { income: 0, expense: 0 };
    current[item.type] += item.amount;
    grouped.set(item.category, current);
  });

  const rows = [...grouped.entries()]
    .map(([category, totals]) => ({
      category,
      ...totals,
      activity: totals.expense || totals.income,
    }))
    .sort((a, b) => b.activity - a.activity);

  if (!rows.length) {
    elements.categoryBars.innerHTML = `<p class="empty-state">Belum ada data kategori.</p>`;
    return;
  }

  const chartRows = rows.slice(0, 7);
  const total = chartRows.reduce((sum, row) => sum + row.activity, 0) || 1;
  const palette = ["#1f6f78", "#177245", "#b7443c", "#2864a6", "#9a6415", "#6f5cc2", "#2e8a99"];
  let cursor = 0;
  const segments = chartRows.map((row, index) => {
    const start = cursor;
    const portion = (row.activity / total) * 100;
    cursor += portion;
    return `${palette[index % palette.length]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
  }).join(", ");

  elements.categoryBars.innerHTML = `
    <div class="category-chart">
      <div class="donut-chart" style="background: conic-gradient(${segments});">
        <div>
          <span>${selectedCategory === "all" ? "Aktivitas" : "Kategori"}</span>
          <strong>${formatCurrency(total)}</strong>
        </div>
      </div>
      <div class="chart-legend">
        ${chartRows.map((row, index) => {
          const percent = Math.round((row.activity / total) * 100);
          return `
            <div class="legend-row">
              <span class="legend-dot" style="background:${palette[index % palette.length]}"></span>
              <span class="legend-name">${escapeHtml(row.category)}</span>
              <strong>${percent}%</strong>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;
}

function renderTable() {
  const rows = getFilteredTransactions();

  elements.emptyState.classList.toggle("hidden", rows.length > 0);
  elements.transactionRows.innerHTML = rows.map((item) => `
    <tr>
      <td>${formatDate(item.date)}</td>
      <td><span class="type-pill ${item.type}">${item.type === "income" ? "Pemasukan" : "Pengeluaran"}</span></td>
      <td>${escapeHtml(item.category)}</td>
      <td>${escapeHtml(item.description)}</td>
      <td class="numeric">${formatCurrency(item.amount)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-button" type="button" title="Edit transaksi" data-action="edit" data-id="${item.id}">Edit</button>
          <button class="icon-button delete" type="button" title="Hapus transaksi" data-action="delete" data-id="${item.id}">Del</button>
        </div>
      </td>
    </tr>
  `).join("");
}

function getFilteredTransactions() {
  return state.transactions
    .filter((item) => {
      const searchable = `${item.category} ${item.description}`.toLowerCase();
      const matchesSearch = !state.filters.search || searchable.includes(state.filters.search);
      const matchesType = state.filters.type === "all" || item.type === state.filters.type;
      const matchesMonth = !state.filters.month || item.date.startsWith(state.filters.month);
      return matchesSearch && matchesType && matchesMonth;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function calculateTotals(transactions) {
  return transactions.reduce((totals, item) => {
    totals[item.type] += item.amount;
    totals.balance = totals.income - totals.expense;
    return totals;
  }, { income: 0, expense: 0, balance: 0 });
}

function createTransaction({ type, date, category, description, amount, source }) {
  return {
    id: createId(),
    date,
    type,
    category,
    description,
    amount,
    source,
    createdAt: new Date().toISOString(),
  };
}

function createTransactionKey(transaction) {
  return [
    transaction.date,
    transaction.type,
    String(transaction.category).trim().toLowerCase(),
    String(transaction.description).trim().toLowerCase(),
    Number(transaction.amount),
  ].join("|");
}

function findHeaderRow(rows, columns, labels) {
  return rows.findIndex((row) => columns.every((column, index) => normalizeText(row[column]) === labels[index]));
}

function findFirstDate(rows) {
  for (const row of rows) {
    const date = parseExcelDate(row[1]) || parseExcelDate(row[5]);
    if (date) return date;
  }

  return "";
}

function parseExcelDate(value) {
  if (!value) return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const normalizedDate = new Date(value);
    if (normalizedDate.getHours() === 23 && normalizedDate.getMinutes() >= 50) {
      normalizedDate.setDate(normalizedDate.getDate() + 1);
      normalizedDate.setHours(0, 0, 0, 0);
    }
    return dateToInputValue(normalizedDate);
  }

  if (typeof value === "number" && window.XLSX?.SSF?.parse_date_code) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return dateToInputValue(new Date(parsed.y, parsed.m - 1, parsed.d));
    }
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    const normalized = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (normalized) {
      const day = Number(normalized[1]);
      const month = Number(normalized[2]) - 1;
      const year = normalizeYear(Number(normalized[3]));
      return dateToInputValue(new Date(year, month, day));
    }
  }

  return "";
}

function inferDateFromSheetName(sheetName) {
  const monthKey = Object.keys(MONTH_NAMES).find((month) => sheetName.toLowerCase().includes(month));
  if (!monthKey) return "";

  const yearMatch = sheetName.match(/20\d{2}/);
  const year = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();
  return dateToInputValue(new Date(year, MONTH_NAMES[monthKey], 1));
}

function inferDateFromText(text) {
  const lower = text.toLowerCase();
  const today = new Date();

  if (lower.includes("kemarin")) {
    const date = new Date(today);
    date.setDate(date.getDate() - 1);
    return dateToInputValue(date);
  }

  if (lower.includes("besok")) {
    const date = new Date(today);
    date.setDate(date.getDate() + 1);
    return dateToInputValue(date);
  }

  const isoDate = lower.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (isoDate) return dateToInputValue(new Date(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3])));

  const numericDate = lower.match(/\b(?:tgl|tanggal)?\s*(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numericDate) {
    const year = numericDate[3] ? normalizeYear(Number(numericDate[3])) : today.getFullYear();
    return dateToInputValue(new Date(year, Number(numericDate[2]) - 1, Number(numericDate[1])));
  }

  const monthDate = lower.match(/\b(?:tgl|tanggal)?\s*(\d{1,2})\s+([a-z]+)(?:\s+(20\d{2}))?\b/);
  if (monthDate && MONTH_NAMES[monthDate[2]] !== undefined) {
    const year = monthDate[3] ? Number(monthDate[3]) : today.getFullYear();
    return dateToInputValue(new Date(year, MONTH_NAMES[monthDate[2]], Number(monthDate[1])));
  }

  return getTodayInputValue();
}

function inferType(text) {
  const lower = text.toLowerCase();
  const incomeWords = ["gaji", "bonus", "pemasukan", "masuk", "terima", "dapat", "dibayar", "tunjangan", "refund", "cashback"];
  return incomeWords.some((word) => lower.includes(word)) ? "income" : "expense";
}

function inferCategory(text, type) {
  const lower = text.toLowerCase();
  const matchedRule = CATEGORY_RULES.find((rule) => rule.words.some((word) => lower.includes(word)));
  if (matchedRule) return matchedRule.category;
  return type === "income" ? "Pemasukan" : "Lainnya";
}

function parseAmount(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : 0;
  return normalizeAmount(String(value));
}

function normalizeAmount(value) {
  const cleaned = String(value).replace(/[^\d.,]/g, "");
  if (!cleaned) return 0;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  if (hasComma && hasDot) {
    return Math.round(Number(cleaned.replaceAll(".", "").replace(",", ".")));
  }

  if (hasComma) {
    const [whole, fraction] = cleaned.split(",");
    if (fraction && fraction.length <= 2) return Math.round(Number(`${whole.replaceAll(".", "")}.${fraction}`));
    return Math.round(Number(cleaned.replaceAll(",", "")));
  }

  if (hasDot) {
    const parts = cleaned.split(".");
    const last = parts[parts.length - 1];
    if (last.length === 3) return Math.round(Number(parts.join("")));
  }

  return Math.round(Number(cleaned.replaceAll(".", "")));
}

function getCategories() {
  const savedCategories = state.transactions.map((item) => item.category);
  return [...new Set([...DEFAULT_CATEGORIES, ...savedCategories])]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "id-ID"));
}

function exportCsv() {
  if (!state.transactions.length) {
    alert("Belum ada data untuk diexport.");
    return;
  }

  const rows = buildExportRows();
  const csv = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");
  downloadFile(`catatan-keuangan-${getTodayInputValue()}.csv`, `\ufeff${csv}`, "text/csv;charset=utf-8");
}

function exportExcel() {
  if (!state.transactions.length) {
    alert("Belum ada data untuk diexport.");
    return;
  }

  const rows = buildExportRows();
  const xmlRows = rows.map((row) => `
    <Row>${row.map((cell) => `<Cell><Data ss:Type="${typeof cell === "number" ? "Number" : "String"}">${escapeXml(String(cell))}</Data></Cell>`).join("")}</Row>
  `).join("");

  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Transaksi">
    <Table>${xmlRows}</Table>
  </Worksheet>
</Workbook>`;

  downloadFile(`catatan-keuangan-${getTodayInputValue()}.xls`, workbook, "application/vnd.ms-excel");
}

function buildExportRows() {
  const transactionRows = state.transactions
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((item) => [
      item.date,
      item.type === "income" ? "Pemasukan" : "Pengeluaran",
      item.category,
      item.description,
      item.amount,
      item.source || "Manual",
    ]);

  const totals = calculateTotals(state.transactions);
  return [
    ["Tanggal", "Jenis", "Kategori", "Deskripsi", "Nominal", "Sumber"],
    ...transactionRows,
    [],
    ["Summary", "Pemasukan", "Pengeluaran", "Saldo Bersih"],
    ["Total", totals.income, totals.expense, totals.balance],
  ];
}

function clearAllData() {
  if (!state.transactions.length) return;

  const confirmed = confirm("Hapus semua transaksi yang tersimpan di perangkat ini?");
  if (!confirmed) return;

  state.transactions = [];
  saveTransactions();
  resetForm();
  render();
}

function loadTransactions() {
  try {
    const workspaceData = JSON.parse(localStorage.getItem(getWorkspaceStorageKey()) || "[]");
    const legacyData = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "[]");
    const transactions = Array.isArray(workspaceData) ? workspaceData : [];
    if (!transactions.length && Array.isArray(legacyData) && legacyData.length) {
      return mergeTransactions(legacyData, []);
    }
    return transactions;
  } catch {
    return [];
  }
}

function saveTransactions() {
  saveLocalTransactions();
  queueRemoteSave();
}

function saveLocalTransactions() {
  localStorage.setItem(getWorkspaceStorageKey(), JSON.stringify(state.transactions));
}

function getWorkspaceStorageKey() {
  return `${STORAGE_PREFIX}-${state.workspaceId || "lokal"}`;
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatCurrency(value) {
  return currencyFormatter.format(value);
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function getTodayInputValue() {
  return dateToInputValue(new Date());
}

function dateToInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeYear(year) {
  return year < 100 ? 2000 + year : year;
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `trx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeText(value) {
  return cleanText(value).toLowerCase();
}

function toTitleCase(value) {
  return cleanText(value).replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function showImportStatus(message, type = "info") {
  elements.importStatus.textContent = message;
  elements.importStatus.dataset.type = type;
  elements.importStatus.classList.remove("hidden");
}

function setChatStatus(message, type = "info") {
  elements.chatStatus.textContent = message;
  elements.chatStatus.dataset.type = type;
}

function setLoginStatus(message, type = "info") {
  elements.loginStatus.textContent = message;
  elements.loginStatus.dataset.type = type;
}

function updateStorageStatus(label, title) {
  elements.storageStatus.textContent = label;
  elements.storageStatus.title = title || label;
  elements.storageStatus.dataset.mode = state.storageMode;
}

function sanitizeWorkspaceId(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function applySavedTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme = savedTheme || (prefersDark ? "dark" : "light");
  document.documentElement.dataset.theme = theme;
  updateThemeButton(theme);
}

function toggleTheme() {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(THEME_KEY, nextTheme);
  updateThemeButton(nextTheme);
}

function updateThemeButton(theme) {
  elements.themeToggle.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");
  return /[",\n\r]/.test(stringValue) ? `"${stringValue.replaceAll('"', '""')}"` : stringValue;
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

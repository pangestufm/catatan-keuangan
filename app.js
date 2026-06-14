const LEGACY_STORAGE_KEY = "catatan-keuangan-offline-v1";
const STORAGE_PREFIX = "catatan-keuangan-transactions";
const THEME_KEY = "catatan-keuangan-theme";
const API_TOKEN_KEY = "catatan-keuangan-api-token";
const AUTH_KEY = "catatan-keuangan-auth";
const LEARNING_PREFIX = "catatan-keuangan-learning";
const API_URLS = ["/.netlify/functions/transactions", "api/transactions.php"];
const PARSE_API_URLS = ["/.netlify/functions/parse-transaction"];
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
  pendingDraft: null,
  isSyncing: false,
  syncTimer: null,
  trendMode: "monthly",
  filters: {
    month: "",
    date: "",
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
  trendModeButtons: document.querySelector("#trendModeButtons"),
  trendChart: document.querySelector("#trendChart"),
  dailyExpenseChart: document.querySelector("#dailyExpenseChart"),
  dailyExpenseMonthLabel: document.querySelector("#dailyExpenseMonthLabel"),
  monthFilterInput: document.querySelector("#monthFilterInput"),
  showAllMonthsButton: document.querySelector("#showAllMonthsButton"),
  filterDate: document.querySelector("#filterDate"),
  clearDateFilterButton: document.querySelector("#clearDateFilterButton"),
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
  draftCard: document.querySelector("#draftCard"),
  draftDateInput: document.querySelector("#draftDateInput"),
  draftTypeInput: document.querySelector("#draftTypeInput"),
  draftCategoryInput: document.querySelector("#draftCategoryInput"),
  draftAmountInput: document.querySelector("#draftAmountInput"),
  draftDescriptionInput: document.querySelector("#draftDescriptionInput"),
  confirmDraftButton: document.querySelector("#confirmDraftButton"),
  editDraftButton: document.querySelector("#editDraftButton"),
  cancelDraftButton: document.querySelector("#cancelDraftButton"),
  quickEntryButton: document.querySelector("#quickEntryButton"),
  detailToggleButton: document.querySelector("#detailToggleButton"),
  quickEntryModal: document.querySelector("#quickEntryModal"),
  closeQuickEntryButton: document.querySelector("#closeQuickEntryButton"),
  closeDetailButton: document.querySelector("#closeDetailButton"),
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

const compactCurrencyFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  notation: "compact",
  maximumFractionDigits: 1,
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
  state.filters.month = getCurrentMonthInputValue();
  elements.monthFilterInput.value = state.filters.month;
  bindEvents();
  initializeSession();
}

function bindEvents() {
  elements.form.addEventListener("submit", handleSubmit);
  elements.cancelEditButton.addEventListener("click", resetForm);
  elements.monthFilterInput.addEventListener("change", handleMonthFilterChange);
  elements.showAllMonthsButton.addEventListener("click", showAllMonths);
  elements.filterDate.addEventListener("change", (event) => {
    state.filters.date = event.target.value;
    if (state.filters.date) {
      state.filters.month = state.filters.date.slice(0, 7);
      elements.monthFilterInput.value = state.filters.month;
    }
    render();
  });
  elements.clearDateFilterButton.addEventListener("click", clearDateFilter);
  elements.categorySummarySelect.addEventListener("change", renderCategorySummary);
  elements.categoryBars.addEventListener("click", handleCategoryChartClick);
  elements.trendModeButtons.addEventListener("click", handleTrendModeChange);
  elements.exportCsvButton.addEventListener("click", exportCsv);
  elements.exportExcelButton.addEventListener("click", exportExcel);
  elements.clearButton.addEventListener("click", clearAllData);
  elements.importExcelInput.addEventListener("change", importExcelFile);
  elements.chatForm.addEventListener("submit", handleChatSubmit);
  elements.voiceButton.addEventListener("click", startVoiceInput);
  elements.confirmDraftButton.addEventListener("click", confirmDraftTransaction);
  elements.editDraftButton.addEventListener("click", editDraftManually);
  elements.cancelDraftButton.addEventListener("click", clearDraft);
  elements.quickEntryButton.addEventListener("click", openQuickEntryModal);
  elements.detailToggleButton.addEventListener("click", openDetailTransactions);
  elements.closeQuickEntryButton.addEventListener("click", closeQuickEntryModal);
  elements.closeDetailButton.addEventListener("click", closeDetailTransactions);
  elements.quickEntryModal.addEventListener("click", closeQuickEntryFromBackdrop);
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
  document.body.dataset.session = "app";
  elements.loginScreen.classList.add("hidden");
  elements.appShell.classList.remove("hidden");
  elements.quickEntryButton.classList.remove("hidden");
  elements.detailToggleButton.classList.remove("hidden");
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
  document.body.dataset.session = "login";
  elements.appShell.classList.add("hidden");
  elements.quickEntryButton.classList.add("hidden");
  elements.detailToggleButton.classList.add("hidden");
  closeDetailTransactions();
  closeQuickEntryModal();
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

function openQuickEntryModal() {
  elements.quickEntryModal.classList.remove("hidden");
  elements.chatInput.focus();
}

function closeQuickEntryModal() {
  elements.quickEntryModal.classList.add("hidden");
}

function closeQuickEntryFromBackdrop(event) {
  if (event.target === elements.quickEntryModal) {
    closeQuickEntryModal();
  }
}

function openDetailTransactions() {
  document.body.classList.add("detail-open");
}

function closeDetailTransactions() {
  document.body.classList.remove("detail-open");
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

  rememberCategory(transaction.description, transaction.category);
  saveTransactions();
  resetForm();
  render();
  closeQuickEntryModal();
}

async function importExcelFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!window.XLSX) {
    showImportStatus("Parser Excel/CSV belum termuat. Pastikan file vendor/xlsx.full.min.js ada.", "error");
    event.target.value = "";
    return;
  }

  try {
    showImportStatus(`Membaca ${file.name}...`, "info");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const importedTransactions = parseWorkbookTransactions(workbook);

    if (!importedTransactions.length) {
      showImportStatus("Tidak ada transaksi yang ditemukan. Pastikan format kolom sesuai contoh Excel atau file backup aplikasi.", "error");
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
      showImportStatus(`Semua ${importedTransactions.length} transaksi dari file sudah ada di aplikasi.`, "info");
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
    showImportStatus("Import gagal. File Excel/CSV mungkin rusak atau formatnya berbeda jauh dari contoh.", "error");
  } finally {
    event.target.value = "";
  }
}

function parseWorkbookTransactions(workbook) {
  const transactions = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
    const backupTransactions = parseBackupTransactionRows(rows, sheetName);
    if (backupTransactions.length) {
      transactions.push(...backupTransactions);
      return;
    }

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

function parseBackupTransactionRows(rows, sheetName) {
  const headerRowIndex = rows.findIndex((row) => {
    const normalized = row.map(normalizeText);
    return normalized.includes("tanggal")
      && normalized.includes("jenis")
      && normalized.includes("kategori")
      && normalized.includes("deskripsi")
      && normalized.includes("nominal");
  });

  if (headerRowIndex < 0) return [];

  const header = rows[headerRowIndex].map(normalizeText);
  const indexes = {
    id: header.indexOf("id"),
    date: header.indexOf("tanggal"),
    type: header.indexOf("jenis"),
    category: header.indexOf("kategori"),
    description: header.indexOf("deskripsi"),
    amount: header.indexOf("nominal"),
    source: header.indexOf("sumber"),
    createdAt: header.indexOf("dibuat pada"),
  };

  return rows.slice(headerRowIndex + 1).reduce((transactions, row, index) => {
    const rowNumber = headerRowIndex + index + 2;
    const description = cleanText(row[indexes.description]);
    const amount = parseAmount(row[indexes.amount]);
    const date = parseExcelDate(row[indexes.date]);
    const type = parseTransactionType(row[indexes.type]);

    if (!date || !description || !amount || !type) return transactions;

    const transaction = createTransaction({
      type,
      date,
      category: cleanText(row[indexes.category]) || inferCategory(description, type),
      description,
      amount,
      source: cleanText(row[indexes.source]) || `Backup ${sheetName} baris ${rowNumber}`,
    });

    const id = indexes.id >= 0 ? cleanText(row[indexes.id]) : "";
    const createdAt = indexes.createdAt >= 0 ? cleanText(row[indexes.createdAt]) : "";
    if (id) transaction.id = id;
    if (createdAt) transaction.createdAt = createdAt;

    transactions.push(transaction);
    return transactions;
  }, []);
}

function parseTransactionType(value) {
  const normalized = normalizeText(value);
  if (["income", "pemasukan", "masuk"].includes(normalized)) return "income";
  if (["expense", "pengeluaran", "keluar"].includes(normalized)) return "expense";
  return "";
}

async function handleChatSubmit(event) {
  event.preventDefault();
  const text = elements.chatInput.value.trim();
  if (!text) {
    setChatStatus("Tulis transaksi dulu, misalnya: aku hari ini belanja makanan 10000.", "error");
    return;
  }

  setChatStatus("Agent sedang membaca konteks transaksi...", "info");

  const parsed = await parseChatTransactionSmart(text);
  if (!parsed) {
    setChatStatus("Aku belum bisa menemukan nominalnya. Coba tulis seperti: belanja makanan 10000.", "error");
    return;
  }

  showDraft(parsed);
  elements.chatInput.value = "";
  setChatStatus(`Draft dibuat dari ${getDraftSourceLabel(parsed.source)}. Cek dulu, lalu simpan atau ubah manual.`, "info");
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
    setChatStatus(`Terdengar: "${transcript}". Aku buat draft dulu untuk dikonfirmasi.`, "info");
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

function showDraft(parsed) {
  state.pendingDraft = parsed;
  elements.draftDateInput.value = parsed.date;
  elements.draftTypeInput.value = parsed.type;
  elements.draftCategoryInput.value = parsed.category;
  elements.draftAmountInput.value = parsed.amount;
  elements.draftDescriptionInput.value = parsed.description;
  elements.draftCard.classList.remove("hidden");
}

function confirmDraftTransaction() {
  if (!state.pendingDraft) return;

  const amount = Number(elements.draftAmountInput.value);
  const draft = {
    ...state.pendingDraft,
    date: elements.draftDateInput.value,
    type: elements.draftTypeInput.value,
    category: elements.draftCategoryInput.value.trim(),
    description: elements.draftDescriptionInput.value.trim(),
    amount,
  };

  if (!draft.date || !draft.category || !draft.description || !Number.isFinite(amount) || amount <= 0) {
    setChatStatus("Lengkapi tanggal, kategori, keterangan, dan nominal yang valid sebelum menyimpan.", "error");
    return;
  }

  const transaction = createTransaction(draft);
  state.transactions.unshift(transaction);
  rememberCategory(transaction.description, transaction.category);
  saveTransactions();
  render();
  setChatStatus(
    `Tersimpan: ${transaction.type === "income" ? "pemasukan" : "pengeluaran"} ${formatCurrency(transaction.amount)} untuk ${transaction.category}.`,
    "success",
  );
  clearDraft(false);
  closeQuickEntryModal();
}

function editDraftManually() {
  if (!state.pendingDraft) return;

  fillForm({
    id: "",
    date: elements.draftDateInput.value,
    type: elements.draftTypeInput.value,
    category: elements.draftCategoryInput.value,
    description: elements.draftDescriptionInput.value,
    amount: elements.draftAmountInput.value,
  });
  elements.formTitle.textContent = "Koreksi Draft";
  elements.saveButton.textContent = "Simpan Koreksi";
  elements.cancelEditButton.classList.remove("hidden");
  setChatStatus("Draft sudah dipindahkan ke form manual. Koreksi bagian yang perlu, lalu simpan.", "info");
  clearDraft(false);
  elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function clearDraft(resetStatus = true) {
  state.pendingDraft = null;
  elements.draftCard.classList.add("hidden");
  if (resetStatus) {
    setChatStatus("Aplikasi akan menebak tanggal, jenis, kategori, deskripsi, dan nominal dari kalimatmu.", "info");
  }
}

async function parseChatTransactionSmart(text) {
  const agentDraft = await requestAgentTransaction(text);
  if (agentDraft) return agentDraft;
  return parseChatTransaction(text);
}

async function requestAgentTransaction(text) {
  if (window.location.protocol === "file:") return null;

  const payload = {
    text,
    today: getTodayInputValue(),
    locale: "id-ID",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta",
    categories: getCategories(),
    categoryMemory: summarizeCategoryMemory(),
    recentTransactions: state.transactions.slice(0, 35).map((item) => ({
      date: item.date,
      type: item.type,
      category: item.category,
      description: item.description,
      amount: item.amount,
    })),
  };

  for (const apiUrl of PARSE_API_URLS) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8500);

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: createApiHeaders(payload),
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) continue;

      const data = await response.json();
      const draft = normalizeAgentDraft(data?.transaction, text, data?.provider);
      if (draft) return draft;
    } catch {
      // Parser lokal tetap dipakai saat function belum tersedia atau request agent gagal.
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  return null;
}

function normalizeAgentDraft(draft, fallbackText, provider = "") {
  if (!draft || typeof draft !== "object") return null;

  const amount = parseAmount(draft.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const type = draft.type === "income" ? "income" : "expense";
  const fallback = parseChatTransaction(fallbackText);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(draft.date || ""))
    ? String(draft.date)
    : (fallback?.date || getTodayInputValue());
  const category = cleanText(draft.category) || fallback?.category || inferCategory(fallbackText, type);
  const description = cleanText(draft.description) || fallback?.description || fallbackText;

  return {
    type,
    date,
    category: findClosestCategory(category),
    description: toTitleCase(description),
    amount,
    source: provider === "gemini" ? "Gemini Agent" : "ChatGPT Agent",
  };
}

function getDraftSourceLabel(source) {
  if (source === "Gemini Agent") return "agent Gemini";
  if (source === "ChatGPT Agent") return "agent ChatGPT";
  return "parser lokal";
}

function summarizeCategoryMemory() {
  const memory = loadCategoryMemory();
  return Object.entries(memory)
    .map(([keyword, scores]) => {
      const bestCategory = Object.entries(scores || {}).sort((a, b) => b[1] - a[1])[0];
      if (!bestCategory) return null;
      return { keyword, category: bestCategory[0], count: bestCategory[1] };
    })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count)
    .slice(0, 40);
}

function parseChatTransaction(text) {
  const dateCandidate = extractDateCandidate(text);
  const amountCandidate = extractAmountCandidate(text, dateCandidate);
  if (!amountCandidate) return null;

  const type = inferType(text);
  const explicitCategory = extractExplicitCategory(text);
  const category = explicitCategory?.category || inferCategory(text, type);
  const description = buildChatDescription(text, amountCandidate, dateCandidate, category, explicitCategory);

  return {
    type,
    date: dateCandidate.date,
    category,
    description,
    amount: amountCandidate.amount,
    source: "Chat",
  };
}

function extractExplicitCategory(text) {
  const match = text.match(/\bkategori\s+([^\d,.;]+)/i);
  if (!match) return null;

  const rawCategory = cleanText(match[1]).replace(/\b(tanggal|tgl|hari ini|kemarin|besok)\b.*$/i, "").trim();
  if (!rawCategory) return null;

  return {
    raw: match[0],
    start: match.index,
    end: match.index + match[0].length,
    category: findClosestCategory(rawCategory),
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

function buildChatDescription(text, amountCandidate, dateCandidate, category, explicitCategory) {
  const ranges = [
    { start: amountCandidate.start, end: amountCandidate.end },
    dateCandidate.start >= 0 ? { start: dateCandidate.start, end: dateCandidate.end } : null,
    explicitCategory?.start >= 0 ? { start: explicitCategory.start, end: explicitCategory.end } : null,
  ].filter(Boolean);
  let cleaned = removeTextRanges(text, ranges);

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

function removeTextRanges(text, ranges) {
  return ranges
    .slice()
    .sort((a, b) => b.start - a.start)
    .reduce((currentText, range) => removeTextRange(currentText, range.start, range.end), text);
}

function handleTableAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = button.dataset.id;
  const transaction = state.transactions.find((item) => item.id === id);
  if (!transaction) return;

  if (button.dataset.action === "edit") {
    openQuickEntryModal();
    fillForm(transaction);
    setChatStatus("Transaksi dibuka di form manual. Koreksi bagian yang perlu, lalu simpan.", "info");
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
  elements.formTitle.textContent = "Tambah Manual";
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
  const transactions = getMonthFilteredTransactions();
  const totals = calculateTotals(transactions);
  elements.incomeTotal.textContent = formatCurrency(totals.income);
  elements.expenseTotal.textContent = formatCurrency(totals.expense);
  elements.balanceTotal.textContent = formatCurrency(totals.balance);
  const periodLabel = getActiveMonthLabel();
  elements.incomeTotal.closest(".metric-card").title = `Total pemasukan ${periodLabel}: ${formatCurrency(totals.income)}`;
  elements.expenseTotal.closest(".metric-card").title = `Total pengeluaran ${periodLabel}: ${formatCurrency(totals.expense)}`;
  elements.balanceTotal.closest(".metric-card").title = `Saldo bersih ${periodLabel}: ${formatCurrency(totals.balance)}`;
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
  const monthTransactions = getMonthFilteredTransactions();
  const selectedTransactions = selectedCategory === "all"
    ? monthTransactions
    : monthTransactions.filter((item) => item.category === selectedCategory);
  const totals = calculateTotals(selectedTransactions);

  elements.categoryIncome.textContent = formatCurrency(totals.income);
  elements.categoryExpense.textContent = formatCurrency(totals.expense);
  elements.categoryBalance.textContent = formatCurrency(totals.balance);
  elements.categoryCount.textContent = selectedTransactions.length.toString();
  elements.categoryIncome.closest(".interactive-card").dataset.tooltip = `Pemasukan kategori: ${formatCurrency(totals.income)}`;
  elements.categoryExpense.closest(".interactive-card").dataset.tooltip = `Pengeluaran kategori: ${formatCurrency(totals.expense)}`;
  elements.categoryBalance.closest(".interactive-card").dataset.tooltip = `Saldo kategori: ${formatCurrency(totals.balance)}`;
  elements.categoryCount.closest(".interactive-card").dataset.tooltip = `${selectedTransactions.length} transaksi pada pilihan ini`;
  renderCategoryBars(selectedCategory);
  renderTrendChart(selectedCategory);
  renderDailyExpenseChart(selectedCategory);
}

function renderCategoryBars(selectedCategory) {
  const grouped = new Map();
  const monthTransactions = getMonthFilteredTransactions();
  const source = selectedCategory === "all"
    ? monthTransactions
    : monthTransactions.filter((item) => item.category === selectedCategory);

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

  const categoryRows = buildCategorySummaryRows(rows);
  const total = categoryRows.reduce((sum, row) => sum + row.activity, 0) || 1;

  elements.categoryBars.innerHTML = `
    <div class="category-number-list">
      ${categoryRows.map((row) => {
        const percent = Math.round((row.activity / total) * 100);
        return `
          <button class="category-number-row interactive-row" type="button" data-category="${escapeHtml(row.category)}" data-tooltip="${escapeHtml(`${row.category}: ${formatCurrency(row.activity)}`)}">
            <span class="category-name">${escapeHtml(row.category)}</span>
            <span class="category-values">
              <strong>${formatCurrency(row.activity)}</strong>
              <small>${percent}% aktivitas</small>
            </span>
            <span class="category-breakdown">
              <span>Masuk ${formatCompactCurrency(row.income)}</span>
              <span>Keluar ${formatCompactCurrency(row.expense)}</span>
            </span>
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function handleCategoryChartClick(event) {
  const target = event.target.closest("[data-category]");
  if (!target) return;

  const category = target.dataset.category;
  if (!category || ![...elements.categorySummarySelect.options].some((option) => option.value === category)) return;

  elements.categorySummarySelect.value = category;
  renderCategorySummary();
}

function buildCategorySummaryRows(rows) {
  if (rows.length <= 7) return rows;

  const visibleRows = rows.slice(0, 6);
  const otherRows = rows.slice(6);
  const otherTotals = otherRows.reduce((totals, row) => {
    totals.income += row.income;
    totals.expense += row.expense;
    totals.activity += row.activity;
    return totals;
  }, { income: 0, expense: 0, activity: 0 });

  return [
    ...visibleRows,
    { category: "Kategori Lainnya", ...otherTotals },
  ];
}

function handleTrendModeChange(event) {
  const button = event.target.closest("button[data-trend-mode]");
  if (!button) return;

  state.trendMode = button.dataset.trendMode;
  [...elements.trendModeButtons.querySelectorAll("button")].forEach((item) => {
    item.classList.toggle("is-active", item === button);
  });
  renderCategorySummary();
}

function renderTrendChart(selectedCategory) {
  const monthTransactions = getMonthFilteredTransactions();
  const source = selectedCategory === "all"
    ? monthTransactions
    : monthTransactions.filter((item) => item.category === selectedCategory);
  const points = buildTrendPoints(source, state.trendMode);

  if (!points.length) {
    elements.trendChart.innerHTML = `<p class="empty-state">Belum ada data tren.</p>`;
    return;
  }

  const width = 640;
  const height = 260;
  const pad = { top: 24, right: 24, bottom: 42, left: 58 };
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const maxValue = Math.max(...points.flatMap((point) => [point.income, point.expense]), 1);
  const xStep = points.length > 1 ? chartWidth / (points.length - 1) : 0;
  const y = (value) => pad.top + chartHeight - (value / maxValue) * chartHeight;
  const x = (index) => pad.left + (points.length === 1 ? chartWidth / 2 : index * xStep);
  const incomePath = points.map((point, index) => `${x(index)},${y(point.income)}`).join(" ");
  const expensePath = points.map((point, index) => `${x(index)},${y(point.expense)}`).join(" ");
  const labelIndexes = getChartLabelIndexes(points.length);
  const latest = points[points.length - 1];

  elements.trendChart.innerHTML = `
    <div class="trend-summary">
      <div class="interactive-card" data-tooltip="Periode terakhir yang tampil di grafik">
        <span>Periode terbaru</span>
        <strong>${escapeHtml(latest.label)}</strong>
      </div>
      <div class="interactive-card" data-tooltip="Pemasukan periode terakhir: ${escapeHtml(formatCurrency(latest.income))}">
        <span>Pemasukan</span>
        <strong>${formatCompactCurrency(latest.income)}</strong>
      </div>
      <div class="interactive-card" data-tooltip="Pengeluaran periode terakhir: ${escapeHtml(formatCurrency(latest.expense))}">
        <span>Pengeluaran</span>
        <strong>${formatCompactCurrency(latest.expense)}</strong>
      </div>
    </div>
    <div class="trend-chart-wrap">
      <svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Grafik tren transaksi">
        <line class="axis-line" x1="${pad.left}" y1="${pad.top + chartHeight}" x2="${width - pad.right}" y2="${pad.top + chartHeight}"></line>
        <line class="axis-line" x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + chartHeight}"></line>
        ${[0.25, 0.5, 0.75, 1].map((ratio) => {
          const gridY = pad.top + chartHeight - ratio * chartHeight;
          return `<line class="grid-line" x1="${pad.left}" y1="${gridY}" x2="${width - pad.right}" y2="${gridY}"></line>`;
        }).join("")}
        <polyline class="trend-line income-line" points="${incomePath}"></polyline>
        <polyline class="trend-line expense-line" points="${expensePath}"></polyline>
        ${points.map((point, index) => `
          <g class="trend-point" data-tooltip="${escapeHtml(`${point.label} | Pemasukan ${formatCurrency(point.income)} | Pengeluaran ${formatCurrency(point.expense)}`)}">
            <title>${escapeHtml(`${point.label} | Pemasukan ${formatCurrency(point.income)} | Pengeluaran ${formatCurrency(point.expense)}`)}</title>
            <circle class="income-dot" cx="${x(index)}" cy="${y(point.income)}" r="5"></circle>
            <circle class="expense-dot" cx="${x(index)}" cy="${y(point.expense)}" r="5"></circle>
          </g>
        `).join("")}
        ${labelIndexes.map((index) => `
          <text class="axis-label" x="${x(index)}" y="${height - 14}" text-anchor="middle">${escapeHtml(points[index].label)}</text>
        `).join("")}
        <text class="axis-label" x="${pad.left}" y="16" text-anchor="start">${escapeHtml(formatCompactCurrency(maxValue))}</text>
      </svg>
    </div>
    <div class="trend-legend">
      <span><i class="legend-dot income-dot"></i>Pemasukan</span>
      <span><i class="legend-dot expense-dot"></i>Pengeluaran</span>
    </div>
  `;
}

function renderDailyExpenseChart(selectedCategory) {
  const activeMonth = state.filters.month || getCurrentMonthInputValue();
  elements.dailyExpenseMonthLabel.textContent = formatMonthLabel(activeMonth);

  const monthTransactions = state.transactions.filter((item) => item.date.startsWith(activeMonth));
  const source = selectedCategory === "all"
    ? monthTransactions
    : monthTransactions.filter((item) => item.category === selectedCategory);
  const points = buildDailyExpensePoints(source, activeMonth);

  if (!points.length) {
    elements.dailyExpenseChart.innerHTML = `<p class="empty-state">Belum ada data pengeluaran untuk bulan ini.</p>`;
    return;
  }

  const width = 640;
  const height = 240;
  const pad = { top: 24, right: 24, bottom: 42, left: 58 };
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const maxValue = Math.max(...points.map((point) => point.expense), 1);
  const xStep = points.length > 1 ? chartWidth / (points.length - 1) : 0;
  const x = (index) => pad.left + (points.length === 1 ? chartWidth / 2 : index * xStep);
  const y = (value) => pad.top + chartHeight - (value / maxValue) * chartHeight;
  const linePath = points.map((point, index) => `${x(index)},${y(point.expense)}`).join(" ");
  const labelIndexes = getChartLabelIndexes(points.length);
  const totalExpense = points.reduce((sum, point) => sum + point.expense, 0);
  const activeDays = points.filter((point) => point.expense > 0).length;
  const peak = points.reduce((highest, point) => point.expense > highest.expense ? point : highest, points[0]);

  elements.dailyExpenseChart.innerHTML = `
    <div class="trend-summary">
      <div class="interactive-card" data-tooltip="Total pengeluaran harian pada ${escapeHtml(formatMonthLabel(activeMonth))}">
        <span>Total Pengeluaran</span>
        <strong>${formatCompactCurrency(totalExpense)}</strong>
      </div>
      <div class="interactive-card" data-tooltip="Jumlah hari yang memiliki transaksi pengeluaran">
        <span>Hari Aktif</span>
        <strong>${activeDays}</strong>
      </div>
      <div class="interactive-card" data-tooltip="Pengeluaran tertinggi: ${escapeHtml(formatCurrency(peak.expense))}">
        <span>Puncak Harian</span>
        <strong>${escapeHtml(peak.label)}</strong>
      </div>
    </div>
    <div class="trend-chart-wrap">
      <svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Grafik pengeluaran harian">
        <line class="axis-line" x1="${pad.left}" y1="${pad.top + chartHeight}" x2="${width - pad.right}" y2="${pad.top + chartHeight}"></line>
        <line class="axis-line" x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${pad.top + chartHeight}"></line>
        ${[0.25, 0.5, 0.75, 1].map((ratio) => {
          const gridY = pad.top + chartHeight - ratio * chartHeight;
          return `<line class="grid-line" x1="${pad.left}" y1="${gridY}" x2="${width - pad.right}" y2="${gridY}"></line>`;
        }).join("")}
        <polyline class="trend-line expense-line" points="${linePath}"></polyline>
        ${points.map((point, index) => point.expense > 0 ? `
          <g class="trend-point" data-tooltip="${escapeHtml(`${point.label} ${formatMonthLabel(activeMonth)} | Pengeluaran ${formatCurrency(point.expense)}`)}">
            <title>${escapeHtml(`${point.label} ${formatMonthLabel(activeMonth)} | Pengeluaran ${formatCurrency(point.expense)}`)}</title>
            <circle class="expense-dot" cx="${x(index)}" cy="${y(point.expense)}" r="4.5"></circle>
          </g>
        ` : "").join("")}
        ${labelIndexes.map((index) => `
          <text class="axis-label" x="${x(index)}" y="${height - 14}" text-anchor="middle">${escapeHtml(points[index].label)}</text>
        `).join("")}
        <text class="axis-label" x="${pad.left}" y="16" text-anchor="start">${escapeHtml(formatCompactCurrency(maxValue))}</text>
      </svg>
    </div>
    <div class="trend-legend">
      <span><i class="legend-dot expense-dot"></i>Pengeluaran harian</span>
    </div>
  `;
}

function buildTrendPoints(transactions, mode) {
  const grouped = new Map();
  transactions.forEach((item) => {
    const key = getTrendKey(item.date, mode);
    if (!key) return;
    const current = grouped.get(key.value) || { label: key.label, sort: key.sort, income: 0, expense: 0 };
    current[item.type] += item.amount;
    grouped.set(key.value, current);
  });

  return [...grouped.values()]
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .slice(-12);
}

function buildDailyExpensePoints(transactions, monthValue) {
  if (!/^\d{4}-\d{2}$/.test(monthValue)) return [];

  const [year, month] = monthValue.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const grouped = new Map();

  transactions.forEach((item) => {
    if (item.type !== "expense" || !item.date.startsWith(monthValue)) return;
    const day = Number(item.date.slice(8, 10));
    grouped.set(day, (grouped.get(day) || 0) + item.amount);
  });

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    return {
      day,
      label: String(day),
      expense: grouped.get(day) || 0,
    };
  });
}

function getTrendKey(value, mode) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = date.getMonth();
  const monthLabel = date.toLocaleDateString("id-ID", { month: "short" });

  if (mode === "yearly") {
    return { value: `${year}`, sort: `${year}`, label: `${year}` };
  }

  if (mode === "quarterly") {
    const quarter = Math.floor(month / 3) + 1;
    return { value: `${year}-Q${quarter}`, sort: `${year}-${quarter}`, label: `Q${quarter} ${year}` };
  }

  const valueKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  return { value: valueKey, sort: valueKey, label: `${monthLabel} ${year}` };
}

function getChartLabelIndexes(length) {
  if (length <= 1) return [0];
  if (length <= 4) return Array.from({ length }, (_, index) => index);
  return [0, Math.floor((length - 1) / 2), length - 1];
}

function renderTable() {
  const rows = getFilteredTransactions();

  elements.emptyState.classList.toggle("hidden", rows.length > 0);
  elements.transactionRows.innerHTML = groupTransactionsByDate(rows).map((group) => `
    <tr class="date-group-row">
      <td colspan="6">
        <div class="date-group-heading">
          <div>
            <span>${formatDate(group.date)}</span>
            <strong>${group.items.length} transaksi</strong>
          </div>
          <div class="date-group-totals">
            <span class="income-total">Masuk ${formatCurrency(group.totals.income)}</span>
            <span class="expense-total">Keluar ${formatCurrency(group.totals.expense)}</span>
          </div>
        </div>
      </td>
    </tr>
    ${group.items.map((item) => `
      <tr class="transaction-row">
        <td></td>
        <td data-label="Jenis"><span class="type-pill ${item.type}">${item.type === "income" ? "Pemasukan" : "Pengeluaran"}</span></td>
        <td data-label="Kategori">${escapeHtml(item.category)}</td>
        <td data-label="Deskripsi">${escapeHtml(item.description)}</td>
        <td class="numeric" data-label="Nominal">${formatCurrency(item.amount)}</td>
        <td data-label="Aksi">
          <div class="row-actions">
            <button class="icon-button" type="button" title="Edit transaksi" data-action="edit" data-id="${item.id}">Edit</button>
            <button class="icon-button delete" type="button" title="Hapus transaksi" data-action="delete" data-id="${item.id}">Del</button>
          </div>
        </td>
      </tr>
    `).join("")}
  `).join("");
}

function getFilteredTransactions() {
  return getMonthFilteredTransactions()
    .filter((item) => {
      return !state.filters.date || item.date === state.filters.date;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

function getMonthFilteredTransactions() {
  if (!state.filters.month) return state.transactions;
  return state.transactions.filter((item) => item.date.startsWith(state.filters.month));
}

function groupTransactionsByDate(transactions) {
  const grouped = new Map();

  transactions.forEach((item) => {
    if (!grouped.has(item.date)) {
      grouped.set(item.date, {
        date: item.date,
        items: [],
        totals: { income: 0, expense: 0 },
      });
    }

    const group = grouped.get(item.date);
    group.items.push(item);
    group.totals[item.type] += item.amount;
  });

  return [...grouped.values()];
}

function clearDateFilter() {
  state.filters.date = "";
  elements.filterDate.value = "";
  renderTable();
}

function handleMonthFilterChange(event) {
  state.filters.month = event.target.value;
  if (state.filters.date && state.filters.month && !state.filters.date.startsWith(state.filters.month)) {
    state.filters.date = "";
    elements.filterDate.value = "";
  }
  render();
}

function showAllMonths() {
  state.filters.month = "";
  state.filters.date = "";
  elements.monthFilterInput.value = "";
  elements.filterDate.value = "";
  render();
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
  const learnedCategory = inferLearnedCategory(text);
  if (learnedCategory) return learnedCategory;

  const matchedRule = CATEGORY_RULES.find((rule) => rule.words.some((word) => lower.includes(word)));
  if (matchedRule) return matchedRule.category;
  return type === "income" ? "Pemasukan" : "Lainnya";
}

function findClosestCategory(input) {
  const normalizedInput = normalizeCategoryAlias(input);
  if (normalizedInput === "makan") return "Konsumsi Harian (Makan & Minum)";

  const categories = getCategories();
  const matchedRule = CATEGORY_RULES.find((rule) => (
    normalizeCategoryAlias(rule.category).includes(normalizedInput)
    || rule.words.some((word) => normalizeCategoryAlias(word).includes(normalizedInput) || normalizedInput.includes(normalizeCategoryAlias(word)))
  ));
  if (matchedRule) return matchedRule.category;

  const exactMatch = categories.find((category) => normalizeCategoryAlias(category) === normalizedInput);
  if (exactMatch) return exactMatch;

  const partialMatch = categories.find((category) => normalizeCategoryAlias(category).includes(normalizedInput));
  return partialMatch || toTitleCase(input);
}

function normalizeCategoryAlias(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/konsumsi harian|makan dan minum|makan & minum|makanan|minuman/g, "makan")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function rememberCategory(description, category) {
  const words = extractLearningWords(description);
  if (!words.length || !category) return;

  const memory = loadCategoryMemory();
  words.forEach((word) => {
    memory[word] = memory[word] || {};
    memory[word][category] = (memory[word][category] || 0) + 1;
  });
  saveCategoryMemory(memory);
}

function inferLearnedCategory(text) {
  const memory = loadCategoryMemory();
  const scores = new Map();
  extractLearningWords(text).forEach((word) => {
    Object.entries(memory[word] || {}).forEach(([category, count]) => {
      scores.set(category, (scores.get(category) || 0) + count);
    });
  });

  return [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function extractLearningWords(value) {
  const ignoredWords = new Set([
    "aku", "saya", "hari", "ini", "kemarin", "besok", "tanggal", "tgl", "catat", "transaksi",
    "belanja", "beli", "bayar", "membeli", "pengeluaran", "pemasukan", "untuk", "kategori",
    "sebesar", "seharga", "senilai", "rp",
  ]);

  return cleanText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !/^\d+$/.test(word) && !ignoredWords.has(word))
    .slice(0, 8);
}

function loadCategoryMemory() {
  try {
    const data = JSON.parse(localStorage.getItem(getLearningStorageKey()) || "{}");
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function saveCategoryMemory(memory) {
  localStorage.setItem(getLearningStorageKey(), JSON.stringify(memory));
}

function getLearningStorageKey() {
  return `${LEARNING_PREFIX}-${state.workspaceId || "lokal"}`;
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
      item.id,
      item.date,
      item.type === "income" ? "Pemasukan" : "Pengeluaran",
      item.category,
      item.description,
      item.amount,
      item.source || "Manual",
      item.createdAt || "",
    ]);

  const totals = calculateTotals(state.transactions);
  return [
    ["ID", "Tanggal", "Jenis", "Kategori", "Deskripsi", "Nominal", "Sumber", "Dibuat Pada"],
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

function formatCompactCurrency(value) {
  return compactCurrencyFormatter.format(value);
}

function formatMonthLabel(value) {
  if (!/^\d{4}-\d{2}$/.test(value || "")) return "Semua bulan";
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : dateFormatter.format(date);
}

function getActiveMonthLabel() {
  return state.filters.month ? formatMonthLabel(state.filters.month) : "semua bulan";
}

function getTodayInputValue() {
  return dateToInputValue(new Date());
}

function getCurrentMonthInputValue() {
  return getTodayInputValue().slice(0, 7);
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

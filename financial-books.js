(function () {
  'use strict';
  const Model = window.FinancialBooksModel;
  const get = id => document.getElementById(id);
  const empty = () => Model.emptyState();
  const clone = value => JSON.parse(JSON.stringify(value));
  const money = value => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  const today = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const dateLabel = value => new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const id = () => window.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const kinds = { installment: 'Cicilan', savings: 'Tabungan', investment: 'Investasi', deposit: 'Simpanan' };
  const entryNames = { payment: 'Pembayaran', deposit: 'Setoran', withdrawal: 'Penarikan' };
  const icons = { installment: 'credit-card', savings: 'piggy-bank', investment: 'chart-no-axes-combined', deposit: 'vault' };
  const views = {
    installments: { prefix: 'installment', host: 'installmentsPage', title: 'Cicilan', item: 'cicilan', selected: '', month: '' },
    savings: { prefix: 'savings', host: 'savingsPage', title: 'Tabungan & simpanan', item: 'rekening', selected: '', month: '' },
  };
  let session = null;
  let route = 'dashboard';
  const backupHeader = ['Pembukuan khusus v1', 'ID', 'Rekening ID', 'Jenis', 'Nama', 'Tanggal', 'Total Kewajiban', 'Saldo Awal', 'Nominal', 'Keterangan'];

  function scaffold(view, page) {
    const p = view.prefix;
    const debt = page === 'installments';
    get(view.host).innerHTML = `
      <div class="section-heading books-page-heading"><div><p class="eyebrow">Pembukuan terpisah</p><h2 id="${p}PageTitle" tabindex="-1">${view.title}</h2></div><button class="button primary" id="${p}AddAccount" type="button"><i data-lucide="plus" aria-hidden="true"></i>Tambah ${view.item}</button></div>
      <div class="books-sync"><p id="${p}SyncStatus" class="status-text" role="status"></p><button class="button secondary" data-book-action="retry" type="button" hidden><i data-lucide="refresh-cw" aria-hidden="true"></i>Coba sinkronkan</button><button class="button ghost danger" data-book-action="discard" type="button" hidden>Batalkan perubahan tertunda</button></div>
      <div class="books-summary" id="${p}Summary"></div>
      <section class="books-form-section" id="${p}AccountFormSection" hidden aria-labelledby="${p}AccountFormTitle">
        <div class="section-heading"><h3 id="${p}AccountFormTitle">Tambah ${view.item}</h3><button class="icon-button" data-book-action="cancel-account" type="button" aria-label="Tutup form ${view.item}" title="Tutup form"><i data-lucide="x" aria-hidden="true"></i></button></div>
        <form id="${p}AccountForm" class="books-form"><input id="${p}AccountId" type="hidden" />
          <label>Nama ${view.item}<input id="${p}AccountName" type="text" maxlength="120" required /></label>
          <label>${debt ? 'Tanggal mulai' : 'Tanggal saldo awal'}<input id="${p}AccountDate" type="date" required /></label>
          ${debt ? '' : `<label>Jenis<select id="${p}AccountKind"><option value="savings">Tabungan</option><option value="investment">Investasi</option><option value="deposit">Simpanan</option></select></label>`}
          <label><span>${debt ? 'Total kewajiban (Rp)' : 'Saldo awal (Rp)'}</span><input id="${p}AccountAmount" type="text" inputmode="numeric" autocomplete="off" placeholder="0" required /></label>
          <label class="books-wide">Catatan <span class="sr-only">opsional</span><input id="${p}AccountNotes" type="text" maxlength="1000" /></label>
          <p class="books-wide status-text" id="${p}AccountStatus" role="alert"></p><div class="books-form-actions books-wide"><button class="button primary" type="submit">Simpan ${view.item}</button><button class="button secondary" data-book-action="cancel-account" type="button">Batal</button></div>
        </form>
      </section>
      <div class="books-layout">
        <section class="books-accounts" aria-labelledby="${p}ListTitle"><div class="section-heading"><h3 id="${p}ListTitle">Daftar ${view.item}</h3><span class="count-label" id="${p}AccountCount">0</span></div><div class="books-account-list" id="${p}AccountList"></div></section>
        <section class="books-detail-section" id="${p}DetailSection" aria-labelledby="${p}DetailTitle" hidden>
          <div class="section-heading books-detail-heading"><div><p class="eyebrow" id="${p}DetailKind"></p><h3 id="${p}DetailTitle" tabindex="-1"></h3></div><div class="books-detail-actions"><button class="icon-button" id="${p}EditAccount" type="button" title="Edit ${view.item}" aria-label="Edit ${view.item}"><i data-lucide="pencil" aria-hidden="true"></i></button><button class="icon-button danger" id="${p}DeleteAccount" type="button" title="Hapus ${view.item}" aria-label="Hapus ${view.item}"><i data-lucide="trash-2" aria-hidden="true"></i></button></div></div>
          <div id="${p}Detail" class="books-detail-metrics"></div><p class="books-notes" id="${p}DetailNotes"></p>
          <div class="section-heading books-history-heading"><h3>Riwayat ${debt ? 'pembayaran' : 'transaksi'}</h3><button class="button primary" id="${p}AddEntry" type="button"><i data-lucide="plus" aria-hidden="true"></i>Catat ${debt ? 'pembayaran' : 'transaksi'}</button></div>
          <section class="books-form-section" id="${p}EntryFormSection" hidden aria-labelledby="${p}EntryFormTitle">
            <div class="section-heading"><h3 id="${p}EntryFormTitle">Catat ${debt ? 'pembayaran' : 'transaksi'}</h3><button class="icon-button" data-book-action="cancel-entry" type="button" title="Tutup form" aria-label="Tutup form transaksi"><i data-lucide="x" aria-hidden="true"></i></button></div>
            <form id="${p}EntryForm" class="books-form"><input id="${p}EntryId" type="hidden" /><input id="${p}EntryAccountId" type="hidden" />
              <label>Tanggal<input id="${p}EntryDate" type="date" required /></label>
              ${debt ? '' : `<label>Transaksi<select id="${p}EntryKind"><option value="deposit">Setoran</option><option value="withdrawal">Penarikan</option></select></label>`}
              <label>Nominal (Rp)<input id="${p}EntryAmount" type="text" inputmode="numeric" autocomplete="off" placeholder="0" required /></label>
              <label class="books-wide">Keterangan <span class="sr-only">opsional</span><input id="${p}EntryDescription" type="text" maxlength="1000" /></label>
              <p class="books-wide status-text" id="${p}EntryStatus" role="alert"></p><div class="books-form-actions books-wide"><button class="button primary" type="submit">Simpan ${debt ? 'pembayaran' : 'transaksi'}</button><button class="button secondary" data-book-action="cancel-entry" type="button">Batal</button></div>
            </form>
          </section>
          <div class="books-history-controls"><label class="compact-filter">Bulan riwayat<input id="${p}HistoryMonth" type="month" /></label><button class="button secondary" id="${p}AllMonths" type="button" aria-pressed="true">Semua bulan</button></div>
          <div id="${p}History" class="books-history table-wrap"></div>
        </section>
      </div>
      <div class="books-backup"><span class="muted">Backup Cicilan &amp; Simpanan</span><div class="books-backup-actions"><button class="button secondary" data-book-action="csv" type="button"><i data-lucide="download" aria-hidden="true"></i>CSV</button><button class="button secondary" data-book-action="excel" type="button"><i data-lucide="file-spreadsheet" aria-hidden="true"></i>Excel</button><button class="button secondary" data-book-action="import" type="button"><i data-lucide="upload" aria-hidden="true"></i>Pulihkan</button><input id="${p}BackupInput" type="file" accept=".csv,.xlsx,.xls" hidden /></div></div>`;
    get(`${p}AddAccount`).addEventListener('click', () => openAccountForm(view));
    get(`${p}EditAccount`).addEventListener('click', () => openAccountForm(view, selectedAccount(view)));
    get(`${p}DeleteAccount`).addEventListener('click', () => deleteAccount(view));
    get(`${p}AddEntry`).addEventListener('click', () => openEntryForm(view));
    get(`${p}AccountForm`).addEventListener('submit', event => saveAccount(event, view));
    get(`${p}EntryForm`).addEventListener('submit', event => saveEntry(event, view));
    for (const suffix of ['AccountAmount', 'EntryAmount']) get(`${p}${suffix}`).addEventListener('input', event => window.CurrencyInput.formatElement(event.target));
    get(`${p}HistoryMonth`).addEventListener('change', event => { view.month = event.target.value; renderHistory(view); });
    get(`${p}AllMonths`).addEventListener('click', () => { view.month = ''; get(`${p}HistoryMonth`).value = ''; renderHistory(view); });
    get(`${p}BackupInput`).addEventListener('change', importFile);
    get(view.host).addEventListener('click', async event => {
      const button = event.target.closest('[data-book-action]');
      if (!button) return;
      const action = button.dataset.bookAction;
      if (action === 'select') {
        view.selected = button.dataset.recordId;
        get(`${p}EntryFormSection`).hidden = true;
        render(); focusSection(`${p}DetailTitle`);
      }
      if (action === 'cancel-account') { get(`${p}AccountFormSection`).hidden = true; get(`${p}AddAccount`).focus(); }
      if (action === 'cancel-entry') { get(`${p}EntryFormSection`).hidden = true; get(`${p}AddEntry`).focus(); }
      if (action === 'edit-entry') openEntryForm(view, session?.books.entries.find(entry => entry.id === button.dataset.recordId));
      if (action === 'delete-entry') await deleteEntry(view, button.dataset.recordId);
      if (action === 'retry') void synchronize(session);
      if (action === 'discard') await discardPending();
      if (action === 'csv' || action === 'excel') exportBackup(action);
      if (action === 'import') get(`${p}BackupInput`).click();
    });
  }

  function focusSection(elementId) {
    const element = get(elementId);
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: element.matches('input, select, textarea') ? 'center' : 'start', behavior: 'instant' });
  }

  function navigate(next, { updateHistory = true, focus = true } = {}) {
    route = views[next] ? next : 'dashboard';
    const hash = route === 'installments' ? '#cicilan' : route === 'savings' ? '#simpanan' : '#overview';
    if (updateHistory && window.location.hash !== hash) window.history.pushState(null, '', hash);
    for (const dialogId of ['toolsPanel', 'quickEntryModal', 'detailDialog']) window.DashboardUI.close(get(dialogId));
    get('dashboardPage').hidden = route !== 'dashboard';
    for (const [page, view] of Object.entries(views)) get(view.host).hidden = page !== route;
    document.body.dataset.bookPage = route;
    get('quickEntryButton').classList.toggle('hidden', route !== 'dashboard' || !session);
    get('detailToggleButton').classList.toggle('hidden', route !== 'dashboard' || !session);
    document.querySelectorAll('[data-book-route]').forEach(link => {
      if (link.dataset.bookRoute === route) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    get('globalSearchInput').placeholder = route === 'dashboard' ? 'Cari transaksi...' : 'Cari transaksi harian...';
    get('skipContentLink')?.setAttribute('href', route === 'dashboard' ? '#overview' : hash);
    render();
    if (focus && route !== 'dashboard') focusSection(`${views[route].prefix}PageTitle`);
  }

  function showDashboard() {
    if (route !== 'dashboard') navigate('dashboard', { focus: false });
  }

  function fromHash() {
    navigate(window.location.hash === '#cicilan' ? 'installments' : window.location.hash === '#simpanan' ? 'savings' : 'dashboard', { updateHistory: false, focus: false });
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-book-route]');
    if (link) { event.preventDefault(); navigate(link.dataset.bookRoute); return; }
    if (event.target.closest('.skip-link') && route !== 'dashboard') {
      event.preventDefault();
      focusSection(`${views[route].prefix}PageTitle`);
      return;
    }
    if (event.target.closest('.main-nav a') && route !== 'dashboard') showDashboard();
  }, true);
  window.addEventListener('popstate', fromHash);
  window.addEventListener('hashchange', fromHash);

  function startSession(config) {
    endSession();
    const current = { ...config, books: empty(), baseBooks: empty(), revision: 0, pending: [], online: false,
      syncing: false, error: '', fatal: false, writerReady: !navigator.locks,
      controller: new AbortController(), key: `catatan-keuangan-books-v1-${config.workspaceId}` };
    session = current;
    try {
      current.cacheSnapshot = localStorage.getItem(current.key);
      const saved = JSON.parse(current.cacheSnapshot || 'null');
      if (saved) {
        current.books = Model.validateState(saved.books);
        current.baseBooks = Model.validateState(saved.baseBooks || saved.books);
        current.pending = Array.isArray(saved.pending) ? saved.pending : [];
        current.revision = Number.isSafeInteger(saved.revision) ? saved.revision : 0;
      }
    } catch {
      current.fatal = true;
      current.error = 'Backup lokal tidak dapat dibaca. Data asli dipertahankan; jangan hapus penyimpanan browser.';
    }
    fromHash();
    if (navigator.locks && !current.fatal) {
      // One tab owns writes for this workspace until logout or tab close.
      void navigator.locks.request(current.key, { ifAvailable: true }, async lock => {
        if (current !== session) return;
        if (!lock) {
          current.fatal = true;
          current.error = 'Pembukuan sedang dibuka di tab lain. Tutup tab tersebut, lalu muat ulang untuk mencatat di sini.';
          renderStatus(); return;
        }
        current.writerReady = true;
        if (!current.isLocalOnly) void synchronize(current);
        renderStatus();
        await new Promise(resolve => current.controller.signal.addEventListener('abort', resolve, { once: true }));
      }).catch(() => {
        if (current !== session) return;
        current.fatal = true; current.error = 'Akses pembukuan tab ini belum tersedia. Muat ulang halaman.';
        renderStatus();
      });
    } else if (!current.isLocalOnly && !current.fatal) void synchronize(current);
  }

  function endSession() {
    session?.controller.abort();
    session = null;
    for (const view of Object.values(views)) {
      view.selected = ''; view.month = '';
      for (const suffix of ['AccountForm', 'EntryForm']) get(`${view.prefix}${suffix}`)?.reset();
      for (const suffix of ['AccountFormSection', 'EntryFormSection']) if (get(`${view.prefix}${suffix}`)) get(`${view.prefix}${suffix}`).hidden = true;
      if (get(`${view.prefix}HistoryMonth`)) get(`${view.prefix}HistoryMonth`).value = '';
    }
    render();
  }

  function cache(current, changes = {}) {
    if (localStorage.getItem(current.key) !== current.cacheSnapshot) {
      current.fatal = true;
      current.error = 'Pembukuan berubah di tab lain. Muat ulang halaman; cadangan tab lain tidak ditimpa.';
      renderStatus(); throw new Error(current.error);
    }
    const saved = JSON.stringify({ books: current.books, baseBooks: current.baseBooks,
      pending: current.pending, revision: current.revision, ...changes });
    localStorage.setItem(current.key, saved);
    current.cacheSnapshot = saved;
  }

  function mutate(operation) {
    if (!session || session.fatal) throw new Error(session?.error || 'Buka workspace terlebih dahulu.');
    if (!session.writerReady) throw new Error('Menyiapkan pembukuan. Coba lagi sebentar.');
    if (session.discarding) throw new Error('Tunggu pembatalan perubahan selesai sebelum mencatat lagi.');
    if (session.conflict) throw new Error('Selesaikan konflik sinkronisasi terlebih dahulu; backup lokal tetap tersedia.');
    const op = { ...operation, id: id() };
    const books = Model.applyOperation(session.books, op);
    const pending = [...session.pending, op];
    cache(session, { books, pending });
    session.books = books; session.pending = pending;
    render();
    if (!session.isLocalOnly) void synchronize(session);
    return books;
  }

  async function request(current, method, payload, operationIds = []) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    current.controller.signal.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 15000);
    try {
      const lookup = method === 'GET' && operationIds.length ? `?operationIds=${encodeURIComponent(operationIds.join(','))}` : '';
      const response = await fetch(`/.netlify/functions/financial-books${lookup}`, {
        method, headers: { 'X-App-Workspace': current.workspaceId, 'X-App-Token': current.accessToken || '', 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined, signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(response.status === 401 ? 'Access token ditolak. Masuk kembali dengan token yang benar.' : data.error || data.message || `Penyimpanan tidak tersedia (${response.status}).`);
        error.status = response.status; throw error;
      }
      if (!data.books || !Number.isSafeInteger(data.revision) || data.revision < 0) throw new Error('Respons penyimpanan pembukuan tidak valid.');
      return { books: Model.validateState(data.books), revision: data.revision,
        appliedOperationIds: Array.isArray(data.appliedOperationIds) ? data.appliedOperationIds : [] };
    } finally {
      clearTimeout(timeout); current.controller.signal.removeEventListener('abort', abort);
    }
  }

  async function fetchRemote(current) {
    const ids = current.pending.map(operation => operation.id);
    const acknowledged = new Set();
    let latest;
    for (let offset = 0; offset < Math.max(ids.length, 1); offset += 256) {
      const remote = await request(current, 'GET', undefined, ids.slice(offset, offset + 256));
      if (!latest || remote.revision >= latest.revision) latest = remote;
      for (const operationId of remote.appliedOperationIds) acknowledged.add(operationId);
      if (current !== session) return remote;
    }
    return { ...latest, appliedOperationIds: [...acknowledged] };
  }

  function rebase(current, remote) {
    const acknowledged = new Set(remote.appliedOperationIds || []);
    const pending = current.pending.filter(operation => !acknowledged.has(operation.id));
    let original = current.baseBooks;
    for (const operation of current.pending.filter(operation => acknowledged.has(operation.id))) {
      try { original = Model.applyOperation(original, operation); } catch { /* The server snapshot already contains the acknowledged change. */ }
    }
    let effective = remote.books;
    const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
    for (const operation of pending) {
      if (operation.type !== 'restore') {
        const collection = operation.type.endsWith('Account') ? 'accounts' : 'entries';
        const recordId = operation.record?.id || operation.recordId;
        const before = original[collection].find(record => record.id === recordId);
        const now = effective[collection].find(record => record.id === recordId);
        if (!same(before, now) && !same(operation.record, now)) throw new Error('Konflik: catatan yang sama diubah pada perangkat lain. Backup lokal sebelum membatalkan perubahan tertunda.');
        if (operation.type === 'deleteAccount') {
          const history = books => books.entries.filter(entry => entry.accountId === recordId).sort((a, b) => a.id.localeCompare(b.id));
          if (!same(history(original), history(effective))) throw new Error('Konflik: riwayat rekening diubah pada perangkat lain. Penghapusan belum dikirim.');
        }
      }
      original = Model.applyOperation(original, operation);
      effective = Model.applyOperation(effective, operation);
    }
    cache(current, { books: effective, baseBooks: remote.books, revision: remote.revision, pending });
    current.books = effective; current.baseBooks = remote.books; current.revision = remote.revision; current.pending = pending;
  }

  async function synchronize(current) {
    if (!current || current !== session || current.isLocalOnly || current.syncing || current.fatal || !current.writerReady) return;
    current.syncing = true; current.error = ''; current.conflict = false; renderStatus();
    try {
      const remote = await fetchRemote(current);
      if (current !== session) return;
      try { rebase(current, remote); } catch (error) { current.conflict = true; throw error; }
      render();
      let conflicts = 0;
      while (current.pending.length && current === session) {
        const operation = current.pending[0];
        try {
          const saved = await request(current, 'POST', { baseRevision: current.revision, operation });
          if (current !== session) return;
          saved.appliedOperationIds = [...saved.appliedOperationIds, operation.id];
          rebase(current, saved); render(); conflicts = 0;
        } catch (error) {
          if (error.status !== 409 || ++conflicts > 3) throw error;
          const latest = await fetchRemote(current);
          if (current !== session) return;
          try { rebase(current, latest); } catch (conflict) { current.conflict = true; throw conflict; }
        }
      }
      current.online = true;
    } catch (error) {
      if (current !== session) return;
      current.online = false;
      current.error = error.name === 'AbortError' ? 'Koneksi melewati batas waktu. Coba sinkronkan kembali.' : error.message;
    } finally {
      if (current === session) { current.syncing = false; renderStatus(); }
    }
  }

  async function discardPending() {
    const current = session;
    if (!current?.pending.length || current.syncing) return;
    const confirmed = await window.DashboardUI.confirm({ title: 'Batalkan perubahan tertunda?',
      message: `${current.pending.length} perubahan lokal yang belum tersinkron akan dibatalkan. Backup CSV/Excel sebelum melanjutkan. Data online tidak dihapus.`, accept: 'Batalkan perubahan', danger: true });
    if (!confirmed || current !== session) return;
    try {
      current.syncing = true; current.discarding = true; renderStatus();
      const remote = await request(current, 'GET');
      if (current !== session) return;
      cache(current, { books: remote.books, baseBooks: remote.books, revision: remote.revision, pending: [] });
      Object.assign(current, { books: remote.books, baseBooks: remote.books, revision: remote.revision, pending: [], error: '', conflict: false, online: true });
      render();
    } catch (error) { if (current === session) current.error = error.message; }
    finally { if (current === session) { current.syncing = false; current.discarding = false; renderStatus(); } }
  }

  function selectedAccount(view) {
    return session?.books.accounts.find(account => account.id === view.selected);
  }
  function metrics(items, { cards = false } = {}) {
    return items.map(([name, value, icon, tone = '', note = '']) => cards
      ? `<article class="metric-card ${tone}"><div class="metric-card-top"><span>${name}</span>${window.DashboardUI.icon(icon)}</div><strong>${esc(value)}</strong><small>${note}</small></article>`
      : `<div class="books-metric"><span>${name}${icon ? window.DashboardUI.icon(icon) : ''}</span><strong>${esc(value)}</strong></div>`).join('');
  }
  function renderStatus() {
    for (const view of Object.values(views)) {
      const element = get(`${view.prefix}SyncStatus`);
      if (!element) continue;
      const pending = session?.pending.length || 0;
      element.textContent = !session ? '' : session.error
        ? `${session.error} ${pending ? `${pending} perubahan masih disimpan lokal.` : 'Cadangan lokal tetap tersedia.'}`
        : !session.writerReady ? 'Menyiapkan pembukuan...'
        : session.syncing ? `Menyinkronkan pembukuan${pending ? ` (${pending} perubahan)` : ''}...`
        : session.isLocalOnly ? `Mode lokal${pending ? ` · ${pending} perubahan belum dikirim online` : ''}` : 'Pembukuan tersimpan online';
      element.dataset.type = session?.error ? 'error' : 'info';
      const host = get(view.host);
      const retry = host.querySelector('[data-book-action="retry"]');
      retry.hidden = !session?.error || session.isLocalOnly || session.fatal;
      retry.disabled = !!session?.syncing;
      const discard = host.querySelector('[data-book-action="discard"]');
      discard.hidden = !session?.error || !pending || session.isLocalOnly || session.fatal;
      discard.disabled = !!session?.syncing;
      const blocked = !session || session.fatal || !session.writerReady || session.discarding || session.conflict;
      host.querySelectorAll('[data-book-action="edit-entry"], [data-book-action="delete-entry"], form button[type="submit"]').forEach(button => { button.disabled = !!blocked; });
      for (const suffix of ['AddAccount', 'EditAccount', 'DeleteAccount']) get(`${view.prefix}${suffix}`).disabled = !!blocked;
      const account = selectedAccount(view);
      get(`${view.prefix}AddEntry`).disabled = !!blocked || !account || (account.kind === 'installment' && Model.summarizeAccount(account, session.books.entries).remaining === 0);
    }
  }
  function render() {
    if (!Model) return;
    const books = session?.books || empty();
    for (const [page, view] of Object.entries(views)) {
      const p = view.prefix;
      if (!get(`${p}Summary`)) continue;
      const debt = page === 'installments';
      const accounts = books.accounts.filter(account => debt ? account.kind === 'installment' : account.kind !== 'installment');
      if (!accounts.some(account => account.id === view.selected)) view.selected = accounts[0]?.id || '';
      const sums = accounts.map(account => Model.summarizeAccount(account, books.entries));
      const sum = key => sums.reduce((total, value) => total + value[key], 0);
      get(`${p}Summary`).innerHTML = metrics(debt ? [
        ['Sisa kewajiban', money(sum('remaining')), 'credit-card', 'balance', 'Seluruh cicilan'],
        ['Sudah dibayar', money(sum('paid')), 'banknote', 'income', 'Total pembayaran'],
        ['Cicilan aktif', String(sums.filter(value => value.remaining > 0).length), 'list', '', 'Belum lunas'],
      ] : [
        ['Saldo tercatat', money(sum('balance')), 'vault', 'balance', 'Saldo awal + mutasi'],
        ['Setoran', money(sum('deposits')), 'arrow-down-left', 'income', 'Total setoran'],
        ['Penarikan', money(sum('withdrawals')), 'arrow-up-right', 'expense', 'Total penarikan'],
      ], { cards: true });
      get(`${p}AccountCount`).textContent = String(accounts.length);
      get(`${p}AccountList`).innerHTML = accounts.length ? accounts.map(account => {
        const total = Model.summarizeAccount(account, books.entries);
        return `<button class="books-account" type="button" data-book-action="select" data-record-id="${esc(account.id)}" aria-pressed="${account.id === view.selected}"><span class="books-account-title">${window.DashboardUI.icon(icons[account.kind])}<span>${esc(account.name)}</span>${window.DashboardUI.icon('chevron-right')}</span><strong>${money(debt ? total.remaining : total.balance)}</strong><small>${debt ? total.remaining === 0 ? 'Lunas' : 'Sisa kewajiban' : kinds[account.kind]}</small></button>`;
      }).join('') : `<div class="empty-state">${window.DashboardUI.icon(debt ? 'credit-card' : 'vault')}<p>Belum ada ${view.item}.</p></div>`;
      const account = selectedAccount(view);
      get(`${p}DetailSection`).hidden = !account;
      if (!account) { get(`${p}Detail`).innerHTML = ''; get(`${p}History`).innerHTML = ''; continue; }
      const total = Model.summarizeAccount(account, books.entries);
      get(`${p}DetailTitle`).textContent = account.name;
      get(`${p}DetailKind`).textContent = `${kinds[account.kind]} · ${dateLabel(account.startDate)}`;
      get(`${p}DetailNotes`).textContent = account.notes;
      get(`${p}DetailNotes`).hidden = !account.notes;
      get(`${p}Detail`).innerHTML = metrics(debt ? [
        ['Total kewajiban', money(account.totalAmount)], ['Sudah dibayar', money(total.paid)], ['Sisa kewajiban', money(total.remaining)],
      ] : [['Saldo awal', money(account.openingBalance)], ['Saldo tercatat', money(total.balance)], ['Transaksi', String(books.entries.filter(entry => entry.accountId === account.id).length)]]);
      if (debt) {
        const progress = Math.min(100, total.paid / account.totalAmount * 100);
        get(`${p}Detail`).insertAdjacentHTML('beforeend', `<div class="books-progress"><span>${total.remaining === 0 ? 'Lunas' : `${Math.round(progress)}% terbayar`}</span><progress max="${account.totalAmount}" value="${total.paid}" aria-label="Kewajiban yang sudah dibayar"></progress></div>`);
      }
      get(`${p}AddEntry`).disabled = session?.fatal || (debt && total.remaining === 0);
      renderHistory(view);
    }
    renderStatus(); window.DashboardUI.refreshIcons();
  }
  function renderHistory(view) {
    const p = view.prefix;
    const entries = (session?.books.entries || []).filter(entry => entry.accountId === view.selected && (!view.month || entry.date.startsWith(view.month)))
      .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
    get(`${p}AllMonths`).setAttribute('aria-pressed', String(!view.month));
    get(`${p}History`).innerHTML = entries.length ? `<table class="ledger-table books-history-table"><thead><tr><th>Tanggal &amp; keterangan</th><th>Transaksi</th><th class="numeric">Nominal</th><th><span class="sr-only">Aksi</span></th></tr></thead><tbody>${entries.map(entry => `<tr data-entry-id="${esc(entry.id)}"><td><span>${dateLabel(entry.date)}</span><small>${esc(entry.description || '-')}</small></td><td>${entryNames[entry.kind]}</td><td class="numeric">${money(entry.amount)}</td><td><div class="row-actions"><button class="icon-button" data-book-action="edit-entry" data-record-id="${esc(entry.id)}" title="Edit transaksi" aria-label="Edit transaksi ${esc(dateLabel(entry.date))}">${window.DashboardUI.icon('pencil')}</button><button class="icon-button danger" data-book-action="delete-entry" data-record-id="${esc(entry.id)}" title="Hapus transaksi" aria-label="Hapus transaksi ${esc(dateLabel(entry.date))}">${window.DashboardUI.icon('trash-2')}</button></div></td></tr>`).join('')}</tbody></table>` : '<p class="empty-state">Belum ada transaksi pada periode ini.</p>';
  }

  function openAccountForm(view, account) {
    view.accountEditing = account ? clone(account) : null;
    const p = view.prefix;
    get(`${p}AccountForm`).reset();
    get(`${p}AccountId`).value = account?.id || '';
    get(`${p}AccountName`).value = account?.name || '';
    get(`${p}AccountDate`).value = account?.startDate || today();
    get(`${p}AccountAmount`).value = window.CurrencyInput.formatRupiahInput(account ? account.kind === 'installment' ? account.totalAmount : account.openingBalance : view === views.installments ? '' : 0);
    get(`${p}AccountNotes`).value = account?.notes || '';
    if (get(`${p}AccountKind`)) get(`${p}AccountKind`).value = account?.kind || 'savings';
    get(`${p}AccountStatus`).textContent = '';
    get(`${p}AccountFormTitle`).textContent = `${account ? 'Edit' : 'Tambah'} ${view.item}`;
    get(`${p}AccountFormSection`).hidden = false; focusSection(`${p}AccountName`);
  }
  function setError(elementId, message) {
    const status = get(elementId); status.textContent = message; status.dataset.type = 'error';
  }
  function saveAccount(event, view) {
    event.preventDefault(); const p = view.prefix;
    try {
      assertUnchanged(view.accountEditing, 'accounts');
      const kind = view === views.installments ? 'installment' : get(`${p}AccountKind`).value;
      const amount = window.CurrencyInput.parseRupiahInput(get(`${p}AccountAmount`).value);
      const record = { id: get(`${p}AccountId`).value || id(), name: get(`${p}AccountName`).value.trim(), kind,
        startDate: get(`${p}AccountDate`).value, totalAmount: kind === 'installment' ? amount : 0,
        openingBalance: kind === 'installment' ? 0 : amount, notes: get(`${p}AccountNotes`).value.trim() };
      mutate({ type: 'upsertAccount', record }); view.selected = record.id;
      get(`${p}AccountFormSection`).hidden = true; render(); focusSection(`${p}DetailTitle`);
      window.DashboardUI.toast(`${kind === 'installment' ? 'Cicilan' : 'Rekening'} dicatat${session.isLocalOnly ? ' lokal' : '; sinkronisasi dijalankan'}.`);
    } catch (error) { setError(`${p}AccountStatus`, error.message); }
  }
  function openEntryForm(view, entry) {
    view.entryEditing = entry ? clone(entry) : null;
    const p = view.prefix; const account = selectedAccount(view);
    if (!account) return;
    get(`${p}EntryForm`).reset();
    get(`${p}EntryId`).value = entry?.id || '';
    get(`${p}EntryAccountId`).value = account.id;
    get(`${p}EntryDate`).value = entry?.date || today();
    get(`${p}EntryDate`).min = account.startDate;
    get(`${p}EntryAmount`).value = window.CurrencyInput.formatRupiahInput(entry?.amount || '');
    get(`${p}EntryDescription`).value = entry?.description || '';
    if (get(`${p}EntryKind`)) get(`${p}EntryKind`).value = entry?.kind || 'deposit';
    get(`${p}EntryStatus`).textContent = '';
    get(`${p}EntryFormTitle`).textContent = `${entry ? 'Edit' : 'Catat'} ${account.kind === 'installment' ? 'pembayaran' : 'transaksi'} · ${account.name}`;
    get(`${p}EntryFormSection`).hidden = false; focusSection(`${p}EntryAmount`);
  }
  function saveEntry(event, view) {
    event.preventDefault(); const p = view.prefix;
    try {
      assertUnchanged(view.entryEditing, 'entries');
      const record = { id: get(`${p}EntryId`).value || id(), accountId: get(`${p}EntryAccountId`).value,
        date: get(`${p}EntryDate`).value, kind: view === views.installments ? 'payment' : get(`${p}EntryKind`).value,
        amount: window.CurrencyInput.parseRupiahInput(get(`${p}EntryAmount`).value), description: get(`${p}EntryDescription`).value.trim() };
      mutate({ type: 'upsertEntry', record });
      get(`${p}EntryFormSection`).hidden = true; view.month = record.date.slice(0, 7);
      get(`${p}HistoryMonth`).value = view.month; renderHistory(view);
      get(`${p}AddEntry`).focus(); window.DashboardUI.toast('Transaksi dicatat pada pembukuan terpisah.');
    } catch (error) { setError(`${p}EntryStatus`, error.message); }
  }
  async function deleteAccount(view) {
    const current = session; const account = selectedAccount(view); if (!account) return;
    const history = books => books.entries.filter(entry => entry.accountId === account.id).sort((a, b) => a.id.localeCompare(b.id));
    const snapshot = JSON.stringify(history(current.books));
    const count = history(current.books).length;
    const confirmed = await window.DashboardUI.confirm({ title: `Hapus ${view.item}?`, message: `${account.name} dan ${count} transaksi terkait akan dihapus dari pembukuan ini. Transaksi harian tetap utuh.`, accept: 'Hapus', danger: true });
    if (!confirmed || current !== session) return;
    try {
      assertUnchanged(account, 'accounts');
      if (snapshot !== JSON.stringify(history(current.books))) throw new Error('Riwayat berubah sejak konfirmasi dibuka. Periksa kembali sebelum menghapus.');
      mutate({ type: 'deleteAccount', recordId: account.id, cascade: true });
      get(`${view.prefix}EntryFormSection`).hidden = true; get(`${view.prefix}AccountFormSection`).hidden = true;
      get(`${view.prefix}AddAccount`).focus();
    } catch (error) { window.DashboardUI.toast(error.message, 'error'); }
  }

  function assertUnchanged(original, collection) {
    if (!original) return;
    const current = session?.books[collection].find(record => record.id === original.id);
    if (JSON.stringify(original) !== JSON.stringify(current)) {
      throw new Error('Catatan ini berubah sejak form dibuka. Tutup form lalu buka kembali sebelum menyimpan.');
    }
  }
  async function deleteEntry(view, recordId) {
    const current = session; const entry = current?.books.entries.find(item => item.id === recordId); if (!entry) return;
    const confirmed = await window.DashboardUI.confirm({ title: 'Hapus transaksi?', message: `${entryNames[entry.kind]} ${money(entry.amount)} pada ${dateLabel(entry.date)} akan dihapus. Saldo pembukuan akan dihitung ulang.`, accept: 'Hapus transaksi', danger: true });
    if (!confirmed || current !== session) return;
    try { assertUnchanged(entry, 'entries'); mutate({ type: 'deleteEntry', recordId }); get(`${view.prefix}EntryFormSection`).hidden = true; get(`${view.prefix}AddEntry`).focus(); }
    catch (error) { window.DashboardUI.toast(error.message, 'error'); }
  }

  function exportRows() {
    const books = session?.books || empty();
    if (!books.accounts.length) return [];
    return [backupHeader, ...books.accounts.map(account => ['account', account.id, '', account.kind, account.name, account.startDate, account.totalAmount, account.openingBalance, '', account.notes]),
      ...books.entries.map(entry => ['entry', entry.id, entry.accountId, entry.kind, '', entry.date, '', '', entry.amount, entry.description])];
  }
  function isBackupHeader(row) { return typeof row?.[0] === 'string' && /^Pembukuan khusus\b/i.test(row[0]); }
  function parseBackup(workbook) {
    const books = empty(); let found = false;
    for (const name of workbook.SheetNames) {
      const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, raw: true, defval: '' });
      const headerIndex = rows.findIndex(isBackupHeader);
      if (headerIndex < 0) continue;
      found = true;
      if (rows[headerIndex][0] !== backupHeader[0]) throw new Error('Versi backup pembukuan khusus belum didukung.');
      if (!backupHeader.every((value, index) => rows[headerIndex][index] === value)) throw new Error('Kolom backup pembukuan tidak lengkap.');
      const date = value => value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
      const amount = value => {
        if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) throw new Error('Nominal backup harus berupa angka Rupiah utuh.');
        return Number(value);
      };
      for (const row of rows.slice(headerIndex + 1)) {
        if (row.every(value => value === '' || value === null)) continue;
        if (row[0] === 'account') books.accounts.push({ id: String(row[1]), kind: row[3], name: String(row[4]), startDate: date(row[5]), totalAmount: amount(row[6]), openingBalance: amount(row[7]), notes: String(row[9]) });
        else if (row[0] === 'entry') books.entries.push({ id: String(row[1]), accountId: String(row[2]), kind: row[3], date: date(row[5]), amount: amount(row[8]), description: String(row[9]) });
        else throw new Error('Jenis baris backup pembukuan tidak dikenali.');
      }
    }
    return found ? Model.validateState(books) : null;
  }
  function preserveCsvSheet(workbook, rawWorkbook) {
    for (const name of workbook.SheetNames) {
      const sheet = rawWorkbook.Sheets[name];
      const rows = window.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
      const start = rows.findIndex(isBackupHeader); if (start < 0) continue;
      for (let r = start; r < rows.length; r++) for (let c = 0; c < backupHeader.length; c++) {
        const address = window.XLSX.utils.encode_cell({ r, c });
        if (sheet[address]) workbook.Sheets[name][address] = { t: 's', v: String(sheet[address].v ?? '') };
      }
    }
  }
  async function reviewImport(incoming) {
    const current = session; if (!current) throw new Error('Buka workspace terlebih dahulu.');
    const preview = Model.mergeBackup(current.books, incoming);
    const message = `${preview.addedAccounts} rekening/cicilan dan ${preview.addedEntries} transaksi baru. ${preview.duplicates} duplikat dilewati. ${preview.changed.length} ID dengan isi berbeda dilewati; catatan yang sudah ada tidak ditimpa.`;
    if (!preview.addedAccounts && !preview.addedEntries) { window.DashboardUI.toast(message, 'info'); return false; }
    const confirmed = await window.DashboardUI.confirm({ title: 'Pulihkan pembukuan khusus?', message, accept: 'Pulihkan catatan' });
    if (!confirmed || current !== session) return false;
    mutate({ type: 'restore', books: incoming });
    window.DashboardUI.toast('Backup pembukuan khusus dipulihkan.'); return true;
  }
  async function importFile(event) {
    const file = event.target.files?.[0]; if (!file) return;
    const current = session;
    try {
      const buffer = await file.arrayBuffer();
      if (current !== session) return;
      const workbook = window.XLSX.read(buffer, { type: 'array', raw: /\.csv$/i.test(file.name), cellDates: true });
      const incoming = parseBackup(workbook);
      if (!incoming) throw new Error('File ini bukan backup Cicilan & Simpanan. Gunakan file ekspor pembukuan khusus.');
      await reviewImport(incoming);
    } catch (error) { if (current === session) window.DashboardUI.toast(error.message, 'error'); }
    finally { event.target.value = ''; }
  }
  function download(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportBackup(format) {
    const rows = exportRows();
    if (!rows.length) { window.DashboardUI.toast('Belum ada pembukuan khusus untuk diekspor.', 'info'); return; }
    const sheet = window.XLSX.utils.aoa_to_sheet(rows);
    if (format === 'csv') download(`cicilan-simpanan-${today()}.csv`, '\ufeff' + window.XLSX.utils.sheet_to_csv(sheet), 'text/csv;charset=utf-8');
    else {
      const wb = window.XLSX.utils.book_new(); window.XLSX.utils.book_append_sheet(wb, sheet, 'Pembukuan Khusus');
      download(`cicilan-simpanan-${today()}.xlsx`, window.XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }
  }

  for (const [page, view] of Object.entries(views)) scaffold(view, page);
  window.FinancialBooks = { startSession, endSession, navigate, showDashboard, getBooks: () => clone(session?.books || empty()),
    exportRows, parseBackup, isBackupHeader, preserveCsvSheet, reviewImport };
  window.DashboardUI.refreshIcons();
}());

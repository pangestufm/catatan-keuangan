// Report page (#laporan): scorecard of four health ratios, cash-flow statement and balance sheet
// for a month or a year. Read-only: every figure comes from the daily ledger (window.FinanceData);
// the Cicilan/Simpanan books are a separate record and are not used. The only thing stored is the
// household choice.
(function () {
  'use strict';
  const Model = window.FinanceReportModel;
  const get = (id) => document.getElementById(id);
  const HOUSEHOLD_KEY = 'catatan-keuangan-report-household';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const rupiah = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });
  const compact = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
  const money = (value) => rupiah.format(Math.round(value)).replace(/ /g, ' ');
  const signed = (value) => (value < 0 ? `−${money(-value)}` : money(value));
  const percent = (value) => `${(value * 100).toLocaleString('id-ID', { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
  const monthsText = (value) => `${value.toLocaleString('id-ID', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} bulan`;
  const icon = (name) => window.DashboardUI?.icon(name) || '';
  const pad = (value) => String(value).padStart(2, '0');
  const today = new Date();
  const view = { mode: 'month', month: `${today.getFullYear()}-${pad(today.getMonth() + 1)}`, year: String(today.getFullYear()), dirty: true };

  function household() {
    try {
      const saved = localStorage.getItem(HOUSEHOLD_KEY);
      if (Model.HOUSEHOLDS[saved]) return saved;
    } catch { /* storage blocked: guess below */ }
    return transactions().some((item) => /\banak\b/i.test(item.category || '')) ? 'child1' : 'single';
  }
  const transactions = () => window.FinanceData?.transactions() || [];
  const period = () => (view.mode === 'year' ? { mode: 'year', key: view.year } : { mode: 'month', key: view.month });

  function periodName(value) {
    if (value.mode === 'year') return `Tahun ${value.key}`;
    const [year, month] = value.key.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  }
  const dateName = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

  function scaffold() {
    const host = get('reportsPage');
    if (!host || host.dataset.ready) return;
    host.dataset.ready = 'true';
    host.innerHTML = `
      <div class="section-heading report-heading">
        <div><p class="eyebrow">laporan keluarga</p><h2 id="reportPageTitle" tabindex="-1">Laporan &amp; neraca</h2><p class="report-period-line" id="reportPeriodLine"></p></div>
        <div class="report-controls">
          <div class="segmented-control" role="group" aria-label="Jenis periode laporan"><button type="button" data-report-mode="month" aria-pressed="true" class="is-active">Bulanan</button><button type="button" data-report-mode="year" aria-pressed="false">Tahunan</button></div>
          <label class="compact-filter" id="reportMonthField">Bulan<input id="reportMonthInput" type="month" /></label>
          <label class="compact-filter" id="reportYearField" hidden>Tahun<select id="reportYearInput"></select></label>
          <button class="button secondary report-print" id="reportPrintButton" type="button"><i data-lucide="printer" aria-hidden="true"></i>Cetak</button>
        </div>
      </div>
      <section class="report-block scorecard" aria-labelledby="scoreTitle" data-reveal>
        <div class="section-heading"><div><p class="eyebrow">cek kesehatan</p><h3 id="scoreTitle">Scorecard 4 rasio</h3></div>
          <label class="household-field">Susunan keluarga<select id="reportHouseholdInput">${Object.entries(Model.HOUSEHOLDS).map(([key, item]) => `<option value="${key}">${esc(item.label)}</option>`).join('')}</select></label></div>
        <div class="score-grid" id="scoreGrid"></div>
      </section>
      <section class="report-block" aria-labelledby="statementTitle" data-reveal>
        <div class="section-heading"><div><p class="eyebrow">arus kas periode</p><h3 id="statementTitle">Laporan keuangan</h3></div><span class="period-chip" id="statementCompare"></span></div>
        <div class="statement-wrap" id="statementBody"></div>
        <div id="yearBreakdown"></div>
      </section>
      <section class="report-block" aria-labelledby="balanceTitle" data-reveal>
        <div class="section-heading"><div><p class="eyebrow">posisi kekayaan</p><h3 id="balanceTitle">Neraca keuangan</h3></div><span class="period-chip" id="balanceDate"></span></div>
        <div id="balanceBody"></div>
      </section>
      <details class="report-method">
        <summary>Cara menghitung &amp; sumber standar</summary>
        <div class="report-method-body">
          <p><strong>Arus kas</strong> diambil dari transaksi harian, jadi sisa kas di laporan sama dengan saldo bersih di Ringkasan. Kategori <em>${esc(Model.SAVINGS_CATEGORY)}</em> dibaca sebagai setoran (pengeluaran) atau pencairan (pemasukan), bukan belanja atau penghasilan. Kategori <em>${esc(Model.DEBT_CATEGORY)}</em> dibaca sebagai cicilan.</p>
          <p><strong>Neraca</strong> juga hanya dari transaksi harian; menu Cicilan dan Simpanan tidak dipakai. Kas adalah akumulasi pemasukan dikurangi pengeluaran sejak catatan pertama. Tabungan &amp; investasi adalah setoran dikurangi pencairan kategori <em>${esc(Model.SAVINGS_CATEGORY)}</em> sejak catatan pertama; simpanan yang sudah ada sebelum mulai mencatat tidak terhitung, jadi bila pencairan lebih besar dari setoran ditulis nol. Transaksi hanya mencatat pembayaran cicilan, bukan sisa pokoknya, jadi selama ada cicilan berjalan (dibayar dalam 3 bulan terakhir) kekayaan bersih dan solvabilitas belum bisa dihitung.</p>
          <ul>
            <li><strong>Rasio tabungan &amp; investasi</strong> = (setoran − pencairan tabungan &amp; investasi) ÷ pendapatan. Ideal 20% ke atas, minimal 10%.</li>
            <li><strong>Rasio cicilan utang (DSR)</strong> = cicilan ÷ pendapatan. Ideal maksimal 30%, batas atas 35%.</li>
            <li><strong>Likuiditas dana darurat</strong> = (kas + tabungan &amp; investasi) ÷ rata-rata pengeluaran bulanan (pengeluaran hidup + cicilan, maksimal 3 bulan terakhir yang ada pengeluarannya). Target: lajang 3-6 bulan, menikah 6 bulan, menikah dengan anak 9-12 bulan.</li>
            <li><strong>Rasio solvabilitas</strong> = kekayaan bersih ÷ total aset. Ideal 50% ke atas; di bawah 0% berarti utang lebih besar dari aset.</li>
          </ul>
          <p class="muted">Standar adalah patokan umum perencana keuangan, bukan aturan resmi: <a href="https://www.ocbc.id/id/article/2023/01/31/cek-kesehatan-keuangan" target="_blank" rel="noopener noreferrer">OCBC</a>, <a href="https://pegadaian.co.id/artikel/keuangan/3-cara-evaluasi-keuangan-untuk-perencanaan-keuangan" target="_blank" rel="noopener noreferrer">Pegadaian</a>, <a href="https://www.idntimes.com/business/finance/ukuran-untuk-mengetahui-keuangan-yang-sehat-00-3m8tp-zd8wnx" target="_blank" rel="noopener noreferrer">IDN Times</a>, <a href="https://pegadaian.co.id/artikel/keuangan/ketahui-berapa-dana-darurat-yang-wajib-kamu-punya" target="_blank" rel="noopener noreferrer">dana darurat menurut status keluarga</a>, dan OJK Sikapi Uangmu (3-6 bulan untuk lajang).</p>
        </div>
      </details>`;
    host.querySelectorAll('[data-report-mode]').forEach((button) => button.addEventListener('click', () => {
      view.mode = button.dataset.reportMode;
      view.chosen = true;
      render();
    }));
    get('reportMonthInput').addEventListener('change', (event) => { if (event.target.value) { view.month = event.target.value; view.year = view.month.slice(0, 4); view.chosen = true; render(); } });
    get('reportYearInput').addEventListener('change', (event) => { view.year = event.target.value; view.chosen = true; render(); });
    get('reportHouseholdInput').addEventListener('change', (event) => {
      try { localStorage.setItem(HOUSEHOLD_KEY, event.target.value); } catch { /* keep for this visit only */ }
      view.household = event.target.value;
      render();
    });
    get('reportPrintButton').addEventListener('click', () => window.print());
  }

  const STATUS = {
    good: 'Sehat', na: 'Belum ada data', incomplete: 'Data belum lengkap',
    fair: { savings: 'Minimal tercapai', debt: 'Di batas atas', liquidity: 'Perlu ditambah', solvency: 'Perlu diperkuat' },
    poor: { savings: 'Di bawah minimal', debt: 'Terlalu berat', liquidity: 'Rawan', solvency: 'Utang > aset' },
  };
  const statusLabel = (key, status) => (typeof STATUS[status] === 'string' ? STATUS[status] : STATUS[status][key]);

  function gauge(value, max, marks, lowerIsBetter = false) {
    const at = (point) => `${Math.max(0, Math.min(100, (point / max) * 100)).toFixed(2)}%`;
    const fill = value === null || !Number.isFinite(value) ? '0%' : at(value);
    return `<div class="gauge${lowerIsBetter ? ' lower-better' : ''}" aria-hidden="true"><span class="gauge-fill" style="--fill:${fill}"></span>${marks.map(([point, label], index) => `<span class="gauge-mark${marks.length === 2 ? (index ? ' align-start' : ' align-end') : ''}" style="--at:${at(point)}"><b>${esc(label)}</b></span>`).join('')}</div>`;
  }

  function scoreCards(result) {
    const { savings, debt, liquidity, solvency, target } = result;
    const savingsNote = savings.status === 'na' ? 'Belum ada pendapatan pada periode ini.'
      : savings.status === 'good' ? 'Di atas ideal. Pertahankan.'
      : savings.status === 'fair' ? `Tambah ${money(Math.ceil(0.2 * savings.denominator - savings.numerator))} lagi untuk ideal 20%.`
      : `Kurang ${money(savings.gap)} untuk minimal 10%.`;
    const debtNote = debt.status === 'na' ? 'Belum ada pendapatan pada periode ini.'
      : debt.numerator === 0 ? 'Tidak ada cicilan tercatat.'
      : debt.status === 'good' ? 'Cicilan masih aman.'
      : debt.status === 'fair' ? `Lewat ideal ${money(debt.excess)}. Tahan cicilan baru.`
      : `Turunkan ${money(Math.ceil(debt.numerator - 0.35 * debt.denominator))} agar di bawah 35%.`;
    const liquidityNote = liquidity.status === 'na' ? 'Belum ada pengeluaran untuk dijadikan patokan.'
      : liquidity.status === 'good' ? `Aman untuk target ${target} bulan.`
      : `Kurang ${money(liquidity.gap)} untuk target ${target} bulan.`;
    const solvencyNote = solvency.status === 'na' ? 'Belum ada aset tercatat.'
      : solvency.status === 'incomplete' ? 'Ada cicilan berjalan, tapi sisa pokoknya tidak ada di transaksi. Kekayaan bersih belum bisa dihitung.'
      : solvency.status === 'good' ? 'Kekayaan bersih lebih dari separuh aset.'
      : solvency.status === 'fair' ? 'Utang masih lebih dari separuh aset.'
      : 'Utang lebih besar dari seluruh aset.';
    const liquidityMax = Math.max(target * 1.5, 12);
    const cards = [
      { key: 'savings', title: 'Rasio tabungan & investasi', icon: 'piggy-bank', data: savings,
        value: savings.value === null ? '–' : percent(savings.value), formula: 'tabungan bersih ÷ pendapatan',
        figures: `${signed(savings.numerator)} ÷ ${money(savings.denominator)}`, ideal: Model.STANDARDS.savings.text,
        gauge: gauge(savings.value, 0.4, [[0.1, '10%'], [0.2, '20%']]), note: savingsNote,
        extra: savings.value !== null && savings.withSurplus !== null && savings.withSurplus > savings.value ? `Termasuk sisa kas: ${percent(savings.withSurplus)}` : '' },
      { key: 'debt', title: 'Rasio cicilan utang (DSR)', icon: 'credit-card', data: debt,
        value: debt.value === null ? '–' : percent(debt.value), formula: 'cicilan ÷ pendapatan',
        figures: `${money(debt.numerator)} ÷ ${money(debt.denominator)}`, ideal: Model.STANDARDS.debt.text,
        gauge: gauge(debt.value, 0.6, [[0.3, '30%'], [0.35, '35%']], true), note: debtNote, extra: '' },
      { key: 'liquidity', title: 'Likuiditas dana darurat', icon: 'life-buoy', data: liquidity,
        value: liquidity.value === null ? '–' : monthsText(liquidity.value), formula: 'aset likuid ÷ pengeluaran bulanan',
        figures: `${money(liquidity.numerator)} ÷ ${money(liquidity.denominator)}`, ideal: `Target ${Model.HOUSEHOLDS[result.household].ideal} (${Model.HOUSEHOLDS[result.household].label.toLowerCase()})`,
        gauge: gauge(liquidity.value, liquidityMax, [[3, '3'], ...(target > 3 ? [[target, String(target)]] : [])]), note: liquidityNote,
        extra: result.spending.months.length ? `Rata-rata ${result.spending.months.length} bulan pengeluaran` : '' },
      { key: 'solvency', title: 'Rasio solvabilitas', icon: 'scale', data: solvency,
        value: solvency.value === null ? '–' : percent(solvency.value), formula: 'kekayaan bersih ÷ total aset',
        figures: solvency.numerator === null ? `? ÷ ${money(solvency.denominator)}` : `${signed(solvency.numerator)} ÷ ${money(solvency.denominator)}`, ideal: Model.STANDARDS.solvency.text,
        gauge: gauge(solvency.value, 1, [[0.5, '50%']]), note: solvencyNote, extra: '' },
    ];
    get('scoreGrid').innerHTML = cards.map((card) => `
      <article class="score-card status-${card.data.status}" aria-labelledby="score-${card.key}">
        <div class="score-top"><h4 id="score-${card.key}">${esc(card.title)}</h4>${icon(card.icon)}</div>
        <div class="score-value"><strong>${esc(card.value)}</strong><span class="score-status">${esc(statusLabel(card.key, card.data.status))}</span></div>
        ${card.gauge}
        <p class="score-figures"><span>${esc(card.formula)}</span><span class="numeric">${esc(card.figures)}</span></p>
        <p class="score-ideal">${esc(card.ideal)}</p>
        ${card.extra ? `<p class="score-extra">${esc(card.extra)}</p>` : ''}
        <p class="score-note">${card.note}</p>
      </article>`).join('');
  }

  // Outflows are written as negatives; a rise in an outflow reads as bad (tomato), a fall as good.
  const amountText = (value, outflow) => (outflow ? (value ? `−${money(value)}` : money(0)) : signed(value));
  function change(current, previousValue, outflow) {
    if (previousValue === null) return { tone: '', text: '–' };
    const difference = current - previousValue;
    return {
      tone: difference === 0 ? '' : (difference > 0) !== outflow ? ' up' : ' down',
      text: difference === 0 ? '0' : `${difference > 0 ? '+' : '−'}${compact.format(Math.abs(difference))}`,
    };
  }

  function statementTable(current, previousStatement) {
    const before = previousStatement && previousStatement.count ? previousStatement : null;
    const lineValue = (lines, category) => before ? (lines.find((line) => line.category === category)?.amount || 0) : null;
    const rows = [];
    const row = (label, value, previousValue, { kind = 'line', outflow = false, note = '' } = {}) => {
      const diff = change(value, previousValue, outflow);
      // On phones the difference column is hidden and the same figure sits under the amount.
      rows.push(`
      <tr class="statement-${kind}"><th scope="row">${esc(label)}${note ? `<small>${esc(note)}</small>` : ''}</th><td class="numeric statement-current"><span class="amount">${amountText(value, outflow)}</span>${previousValue === null ? '' : `<small class="delta-inline${diff.tone}">${esc(diff.text)}</small>`}</td><td class="numeric statement-prev">${previousValue === null ? '–' : amountText(previousValue, outflow)}</td><td class="numeric statement-delta${diff.tone}">${esc(diff.text)}</td></tr>`);
    };
    row('Pendapatan', current.revenue, before?.revenue ?? null, { kind: 'group' });
    current.revenueLines.forEach((line) => row(line.category, line.amount, lineValue(before?.revenueLines || [], line.category), { note: `${line.count} transaksi` }));
    row('Pengeluaran hidup', current.living, before?.living ?? null, { kind: 'group', outflow: true });
    current.livingLines.forEach((line) => row(line.category, line.amount, lineValue(before?.livingLines || [], line.category), { outflow: true, note: `${line.count} transaksi` }));
    row('Cicilan & kewajiban', current.debtPayments, before?.debtPayments ?? null, { kind: 'group', outflow: true });
    row('Sisa sebelum menabung', current.operatingSurplus, before?.operatingSurplus ?? null, { kind: 'subtotal' });
    row('Setoran tabungan & investasi', current.deposits, before?.deposits ?? null, { kind: 'group', outflow: true });
    row('Pencairan tabungan & investasi', current.withdrawals, before?.withdrawals ?? null, { kind: 'group' });
    if (current.loanProceeds || before?.loanProceeds) row('Dana pinjaman masuk', current.loanProceeds, before?.loanProceeds ?? null, { kind: 'group' });
    row('Sisa kas periode', current.cashChange, before?.cashChange ?? null, { kind: 'total', note: 'sama dengan saldo bersih di Ringkasan' });
    return `<table class="statement-table"><thead><tr><th scope="col">Uraian</th><th scope="col" class="numeric">${esc(periodName(current.period))}</th><th scope="col" class="numeric statement-prev">${esc(periodName(previousStatement.period))}</th><th scope="col" class="numeric statement-delta">Selisih</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
  }

  function yearTable(year) {
    const months = Model.yearBreakdown(transactions(), year).filter((item) => item.count);
    if (!months.length) return '';
    const sum = (key) => months.reduce((value, item) => value + item[key], 0);
    const cells = (item, label) => `<th scope="row">${esc(label)}</th><td class="numeric" data-label="Pendapatan">${money(item.revenue)}</td><td class="numeric" data-label="Pengeluaran hidup">${money(item.living)}</td><td class="numeric" data-label="Cicilan">${money(item.debtPayments)}</td><td class="numeric" data-label="Tabungan bersih">${signed(item.netSavings)}</td><td class="numeric ${item.cashChange < 0 ? 'negative' : ''}" data-label="Sisa kas">${signed(item.cashChange)}</td>`;
    const totals = { revenue: sum('revenue'), living: sum('living'), debtPayments: sum('debtPayments'), netSavings: sum('netSavings'), cashChange: sum('cashChange') };
    return `<h4 class="report-subtitle">Rincian per bulan</h4><div class="year-wrap"><table class="year-table"><thead><tr><th scope="col">Bulan</th><th scope="col" class="numeric">Pendapatan</th><th scope="col" class="numeric">Pengeluaran hidup</th><th scope="col" class="numeric">Cicilan</th><th scope="col" class="numeric">Tabungan bersih</th><th scope="col" class="numeric">Sisa kas</th></tr></thead><tbody>
      ${months.map((item) => `<tr>${cells(item, periodName(item.period).replace(` ${year}`, ''))}</tr>`).join('')}
      </tbody><tfoot><tr>${cells(totals, `Total ${year}`)}</tr></tfoot></table></div>`;
  }

  function balanceTable(sheet) {
    const since = sheet.firstDate ? `sejak ${dateName(sheet.firstDate)}` : 'sejak catatan pertama';
    const line = (label, note, amount, className = '') => `<li class="${className}"><span>${esc(label)}${note ? `<small>${esc(note)}</small>` : ''}</span><span class="numeric ${amount < 0 ? 'negative' : ''}">${signed(amount)}</span></li>`;
    const group = (title, items, subtotal) => `<div class="balance-group"><h5>${esc(title)}</h5><ul>${items}</ul><p class="balance-subtotal"><span>Jumlah</span><span class="numeric">${signed(subtotal)}</span></p></div>`;
    const { savings } = sheet;
    const cashRow = line('Kas dari catatan harian', sheet.cash < 0 ? 'Negatif: saldo sebelum mulai mencatat belum masuk' : `Akumulasi pemasukan − pengeluaran ${since}`, sheet.cash);
    const savingsRow = savings.deposited || savings.withdrawn
      ? line('Setoran bersih', `Disetor ${money(savings.deposited)} − dicairkan ${money(savings.withdrawn)}${savings.withdrawn > savings.deposited ? '; pencairan dari simpanan lama ditulis nol' : ''}`, savings.amount)
      : line('Belum ada setoran tabungan & investasi', '', 0, 'balance-empty');
    const debtRows = sheet.installments.length
      ? sheet.installments.map((item) => `<li><span>${esc(item.name)}<small>Dibayar terakhir ${esc(dateName(item.lastDate))} · per bulan</small></span><span class="numeric">${money(item.monthly)}</span></li>`).join('')
      : `<li class="balance-empty"><span>Tidak ada cicilan dibayar 3 bulan terakhir</span><span class="numeric">${money(0)}</span></li>`;
    const known = sheet.debtsKnown;
    const callout = `<p class="balance-callout">${icon('notebook-pen')}<span>Dihitung dari transaksi harian ${esc(since)}. ${known ? 'Tidak ada cicilan berjalan, jadi kekayaan bersih sama dengan total aset.' : 'Transaksi hanya mencatat pembayaran cicilan, bukan sisa pokoknya, jadi kekayaan bersih belum bisa dihitung.'}</span></p>`;
    return `${callout}<div class="balance-sheet">
      <section class="balance-side" aria-label="Aset">
        <h4>Aset</h4>
        ${group('Aset lancar', cashRow, sheet.cash)}
        ${group('Tabungan & investasi', savingsRow, savings.amount)}
        <p class="balance-total"><span>Total aset</span><span class="numeric">${signed(sheet.totalAssets)}</span></p>
      </section>
      <section class="balance-side" aria-label="Kewajiban dan kekayaan bersih">
        <h4>Kewajiban &amp; kekayaan bersih</h4>
        <div class="balance-group"><h5>Cicilan berjalan</h5><ul>${debtRows}</ul><p class="balance-subtotal"><span>Sisa utang</span><span class="numeric">${known ? money(0) : 'Belum tercatat'}</span></p></div>
        <div class="balance-group net-worth"><h5>Kekayaan bersih</h5>${known
          ? `<p class="net-worth-figure"><span class="marked numeric ${sheet.netWorth < 0 ? 'negative' : ''}">${signed(sheet.netWorth)}</span></p><small>Total aset − total kewajiban</small>`
          : `<p class="net-worth-figure net-worth-unknown"><span class="numeric">Belum bisa dihitung</span></p><small>Perlu sisa pokok cicilan. Angka per bulan di atas adalah pembayaran, bukan utang.</small>`}</div>
        ${known ? `<p class="balance-total"><span>Kewajiban + kekayaan bersih</span><span class="numeric">${signed(sheet.liabilities + sheet.netWorth)}</span></p>` : ''}
      </section>
    </div>`;
  }

  function syncControls(periods) {
    document.querySelectorAll('[data-report-mode]').forEach((button) => {
      const active = button.dataset.reportMode === view.mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    get('reportMonthField').hidden = view.mode !== 'month';
    get('reportYearField').hidden = view.mode !== 'year';
    get('reportMonthInput').value = view.month;
    const years = [...new Set([view.year, ...periods.years])].sort().reverse();
    get('reportYearInput').innerHTML = years.map((year) => `<option value="${esc(year)}">${esc(year)}</option>`).join('');
    get('reportYearInput').value = view.year;
    get('reportHouseholdInput').value = view.household;
  }

  function render() {
    if (!Model || !get('reportsPage')) return;
    scaffold();
    const host = get('reportsPage');
    if (host.hidden) { view.dirty = true; return; }
    view.dirty = false;
    view.household = view.household || household();
    const list = transactions();
    const periods = Model.availablePeriods(list);
    if (!view.chosen) {
      // Open on the newest month that has records (not a future-dated one), not an empty month.
      const latest = periods.months.find((key) => key <= view.month);
      if (latest) { view.month = latest; view.year = latest.slice(0, 4); }
    }
    syncControls(periods);
    const current = period();
    const result = Model.ratios(list, current, view.household);
    const before = Model.statement(list, Model.previous(current));
    const bounds = Model.range(current);
    get('reportPeriodLine').textContent = `${periodName(current)} · ${result.statement.count} transaksi harian`;
    scoreCards(result);
    get('statementCompare').textContent = `dibanding ${periodName(before.period)}`;
    get('statementBody').innerHTML = result.statement.count
      ? statementTable(result.statement, before)
      : `<p class="empty-state">Belum ada transaksi harian pada ${esc(periodName(current))}.</p>`;
    get('yearBreakdown').innerHTML = view.mode === 'year' ? yearTable(view.year) : '';
    get('balanceDate').textContent = `per ${dateName(bounds.end)}`;
    get('balanceBody').innerHTML = balanceTable(result.sheet);
    window.DashboardUI?.refreshIcons();
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; render(); });
  }

  window.addEventListener('finance:data', schedule);
  window.addEventListener('finance:route', (event) => { if (event.detail?.route === 'reports') render(); });
  scaffold();
  window.FinanceReport = { render };
}());

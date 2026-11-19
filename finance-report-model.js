// Family financial report: cash-flow statement, balance sheet and four health ratios.
// Pure functions over the daily ledger only; nothing here reads or writes storage. The separate
// Cicilan/Simpanan books are their own record and are deliberately not mixed in.
//
// Flows come from the daily ledger, the same cash book the dashboard totals, so "sisa kas" here
// always equals the dashboard's net balance for the period. Two categories are not spending:
// "Tabungan & Investasi" moves money into savings (expense) or back out (income), and
// "Kewajiban & Cicilan" is debt service. The ledger records flows, not balances: savings held
// before the first record and the remaining principal of a loan are not in it.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FinanceReportModel = factory();
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const SAVINGS_CATEGORY = "Tabungan & Investasi";
  const DEBT_CATEGORY = "Kewajiban & Cicilan";

  // Emergency-fund targets in months of spending, by household (Indonesian planner guidance;
  // OJK Sikapi Uangmu gives 3-6 months for a single earner).
  const HOUSEHOLDS = {
    single: { label: "Lajang", months: 3, ideal: "3-6 bulan" },
    couple: { label: "Menikah, belum punya anak", months: 6, ideal: "6 bulan" },
    child1: { label: "Menikah, 1 anak", months: 9, ideal: "9-12 bulan" },
    child2: { label: "Menikah, 2 anak atau lebih", months: 12, ideal: "12 bulan" },
  };

  const STANDARDS = {
    savings: { good: 0.2, fair: 0.1, text: "Ideal 20% atau lebih, minimal 10% dari pendapatan" },
    debt: { good: 0.3, fair: 0.35, text: "Ideal maksimal 30%, batas atas 35% dari pendapatan" },
    liquidity: { fair: 3, text: "Minimal 3 bulan pengeluaran" },
    solvency: { good: 0.5, fair: 0, text: "Ideal 50% atau lebih dari total aset" },
  };

  const pad = (value) => String(value).padStart(2, "0");
  const amountOf = (item) => {
    const value = Number(item.amount);
    return Number.isFinite(value) ? value : 0;
  };
  const daysIn = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();

  function range(period) {
    if (period.mode === "year") return { start: `${period.key}-01-01`, end: `${period.key}-12-31` };
    const [year, month] = period.key.split("-").map(Number);
    return { start: `${period.key}-01`, end: `${period.key}-${pad(daysIn(year, month))}` };
  }

  function previous(period) {
    if (period.mode === "year") return { mode: "year", key: String(Number(period.key) - 1) };
    const [year, month] = period.key.split("-").map(Number);
    return { mode: "month", key: month === 1 ? `${year - 1}-12` : `${year}-${pad(month - 1)}` };
  }

  function monthsOf(period) {
    if (period.mode === "month") return [period.key];
    return Array.from({ length: 12 }, (_, index) => `${period.key}-${pad(index + 1)}`);
  }

  function within(item, { start, end }) {
    return typeof item.date === "string" && item.date >= start && item.date <= end;
  }

  function addLine(map, category, amount) {
    const line = map.get(category) || { category, amount: 0, count: 0 };
    line.amount += amount;
    line.count += 1;
    map.set(category, line);
  }

  const sorted = (map) => [...map.values()].sort((a, b) => b.amount - a.amount || a.category.localeCompare(b.category, "id-ID"));
  const total = (lines) => lines.reduce((sum, line) => sum + line.amount, 0);

  function statement(transactions, period) {
    const bounds = range(period);
    const revenue = new Map();
    const living = new Map();
    const result = { period, ...bounds, count: 0, debtPayments: 0, deposits: 0, withdrawals: 0, loanProceeds: 0 };
    for (const item of transactions) {
      if (!within(item, bounds)) continue;
      const amount = amountOf(item);
      result.count += 1;
      if (item.type === "income") {
        if (item.category === SAVINGS_CATEGORY) result.withdrawals += amount;
        else if (item.category === DEBT_CATEGORY) result.loanProceeds += amount;
        else addLine(revenue, item.category || "Lainnya", amount);
      } else if (item.type === "expense") {
        if (item.category === SAVINGS_CATEGORY) result.deposits += amount;
        else if (item.category === DEBT_CATEGORY) result.debtPayments += amount;
        else addLine(living, item.category || "Lainnya", amount);
      }
    }
    result.revenueLines = sorted(revenue);
    result.livingLines = sorted(living);
    result.revenue = total(result.revenueLines);
    result.living = total(result.livingLines);
    result.operatingSurplus = result.revenue - result.living - result.debtPayments;
    result.netSavings = result.deposits - result.withdrawals;
    result.cashChange = result.operatingSurplus - result.deposits + result.withdrawals + result.loanProceeds;
    return result;
  }

  // One installment is written many ways ("Cicilan CC", "Bayar Cc", "CC Bulan Juni"), so payments
  // are grouped by what is left of the description after the usual verbs and month names.
  const MONTH_WORDS = "januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|agt|sep|okt|nov|des";
  function installmentKey(description) {
    const key = String(description || "").toLowerCase()
      .replace(/\b(cicilan|angsuran|bayar|pembayaran|pelunasan|tagihan)\b/g, " ")
      .replace(new RegExp(`\\b(bulan|bln)?\\s*(${MONTH_WORDS})\\b`, "g"), " ")
      .replace(/\b\d{2,4}\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    return key || "cicilan";
  }

  // Installments paid in the three months up to asOf. The ledger only holds payments, so this
  // lists what is being paid each month; the remaining principal is not known.
  function activeInstallments(transactions, asOf) {
    const [year, month] = asOf.slice(0, 7).split("-").map(Number);
    const from = month > 2 ? `${year}-${pad(month - 2)}` : `${year - 1}-${pad(month + 10)}`;
    const groups = new Map();
    for (const item of transactions) {
      if (item.type !== "expense" || item.category !== DEBT_CATEGORY || typeof item.date !== "string" || item.date > asOf) continue;
      const key = installmentKey(item.description);
      const group = groups.get(key) || { key, name: "", lastDate: "", months: new Map() };
      const monthKey = item.date.slice(0, 7);
      group.months.set(monthKey, (group.months.get(monthKey) || 0) + amountOf(item));
      if (item.date >= group.lastDate) { group.lastDate = item.date; group.name = String(item.description || "").trim() || "Cicilan"; }
      groups.set(key, group);
    }
    return [...groups.values()]
      .filter((group) => group.lastDate.slice(0, 7) >= from)
      .map((group) => ({ key: group.key, name: group.name, lastDate: group.lastDate, monthly: group.months.get(group.lastDate.slice(0, 7)), paid: [...group.months.values()].reduce((sum, value) => sum + value, 0) }))
      .sort((a, b) => b.monthly - a.monthly || a.name.localeCompare(b.name, "id-ID"));
  }

  // Balance sheet as of a date, from the ledger alone. Cash is every income minus every expense
  // since the first record. Savings are deposits minus withdrawals in "Tabungan & Investasi" since
  // that first record; withdrawing more than was deposited means older savings were cashed, so it
  // is shown as zero rather than negative. Debts are known only when no installment is being paid.
  function balanceSheet(transactions, asOf) {
    let cash = 0;
    let firstDate = "";
    const savings = { deposited: 0, withdrawn: 0, amount: 0 };
    for (const item of transactions) {
      if (typeof item.date !== "string" || item.date > asOf) continue;
      if (!firstDate || item.date < firstDate) firstDate = item.date;
      const amount = amountOf(item);
      if (item.type === "income") cash += amount;
      else if (item.type === "expense") cash -= amount;
      if (item.category !== SAVINGS_CATEGORY) continue;
      if (item.type === "expense") savings.deposited += amount;
      else if (item.type === "income") savings.withdrawn += amount;
    }
    savings.amount = Math.max(0, savings.deposited - savings.withdrawn);
    const installments = activeInstallments(transactions, asOf);
    const debtsKnown = installments.length === 0;
    const totalAssets = cash + savings.amount;
    return {
      asOf, firstDate, cash, savings, installments, debtsKnown, totalAssets,
      liquidForRatio: Math.max(0, cash) + savings.amount,
      liabilities: debtsKnown ? 0 : null,
      netWorth: debtsKnown ? totalAssets : null,
    };
  }

  // Average monthly spending (living costs plus debt service, not savings deposits) over the
  // latest months that have spending: up to three months ending at a month report, or the months
  // of a year report. Months without any recorded spending are skipped, not counted as zero.
  function monthlySpending(transactions, period) {
    const lastMonth = period.mode === "year" ? `${period.key}-12` : period.key;
    const spend = new Map();
    for (const item of transactions) {
      if (item.type !== "expense" || item.category === SAVINGS_CATEGORY || typeof item.date !== "string") continue;
      const month = item.date.slice(0, 7);
      if (month > lastMonth || (period.mode === "year" && !month.startsWith(period.key))) continue;
      spend.set(month, (spend.get(month) || 0) + amountOf(item));
    }
    const months = [...spend.keys()].sort().reverse().slice(0, period.mode === "year" ? 12 : 3).sort();
    const average = months.length ? months.reduce((sum, month) => sum + spend.get(month), 0) / months.length : 0;
    return { months, average };
  }

  function grade(kind, value, household) {
    if (value === null || !Number.isFinite(value)) return "na";
    if (kind === "savings") return value >= STANDARDS.savings.good ? "good" : value >= STANDARDS.savings.fair ? "fair" : "poor";
    if (kind === "debt") return value <= STANDARDS.debt.good ? "good" : value <= STANDARDS.debt.fair ? "fair" : "poor";
    if (kind === "liquidity") return value >= (HOUSEHOLDS[household] || HOUSEHOLDS.child1).months ? "good" : value >= STANDARDS.liquidity.fair ? "fair" : "poor";
    return value >= STANDARDS.solvency.good ? "good" : value >= STANDARDS.solvency.fair ? "fair" : "poor";
  }

  function ratios(transactions, period, household = "child1") {
    const flow = statement(transactions, period);
    const sheet = balanceSheet(transactions, range(period).end);
    const spending = monthlySpending(transactions, period);
    const target = (HOUSEHOLDS[household] || HOUSEHOLDS.child1).months;
    const saved = flow.deposits - flow.withdrawals;
    const perIncome = (value) => (flow.revenue > 0 ? value / flow.revenue : null);
    const savingsRate = perIncome(saved);
    const debtRatio = perIncome(flow.debtPayments);
    const liquidity = spending.average > 0 ? sheet.liquidForRatio / spending.average : null;
    // Without the remaining principal of the installments being paid, net worth is unknown; a
    // ratio computed as if there were no debt would read as falsely healthy.
    const solvency = sheet.debtsKnown && sheet.totalAssets > 0 ? sheet.netWorth / sheet.totalAssets : null;
    return {
      period, statement: flow, sheet, spending, household, target,
      savings: {
        value: savingsRate, status: grade("savings", savingsRate), numerator: saved, denominator: flow.revenue,
        gap: flow.revenue > 0 ? Math.max(0, Math.ceil(STANDARDS.savings.fair * flow.revenue - saved)) : 0,
        withSurplus: perIncome(saved + Math.max(0, flow.cashChange)),
      },
      debt: {
        value: debtRatio, status: grade("debt", debtRatio), numerator: flow.debtPayments, denominator: flow.revenue,
        excess: flow.revenue > 0 ? Math.max(0, Math.ceil(flow.debtPayments - STANDARDS.debt.good * flow.revenue)) : 0,
      },
      liquidity: {
        value: liquidity, status: grade("liquidity", liquidity, household),
        numerator: sheet.liquidForRatio, denominator: spending.average,
        gap: spending.average > 0 ? Math.max(0, Math.ceil(target * spending.average - sheet.liquidForRatio)) : 0,
      },
      solvency: {
        value: solvency, status: sheet.debtsKnown ? grade("solvency", solvency) : "incomplete",
        numerator: sheet.netWorth, denominator: sheet.totalAssets,
      },
    };
  }

  function yearBreakdown(transactions, year) {
    return monthsOf({ mode: "year", key: String(year) }).map((key) => statement(transactions, { mode: "month", key }));
  }

  // Years and months that have any record, newest first, for the period pickers.
  function availablePeriods(transactions) {
    const months = new Set();
    for (const item of transactions) {
      if (typeof item.date === "string" && /^\d{4}-\d{2}/.test(item.date)) months.add(item.date.slice(0, 7));
    }
    const list = [...months].sort().reverse();
    return { months: list, years: [...new Set(list.map((month) => month.slice(0, 4)))] };
  }

  return {
    SAVINGS_CATEGORY, DEBT_CATEGORY, HOUSEHOLDS, STANDARDS,
    range, previous, monthsOf, statement, installmentKey, activeInstallments, balanceSheet, monthlySpending, grade, ratios, yearBreakdown, availablePeriods,
  };
});

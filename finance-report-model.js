// Family financial report: cash-flow statement, balance sheet and four health ratios.
// Pure functions over the daily ledger and the separate books; nothing here reads or writes storage.
//
// Flows come from the daily ledger, the same cash book the dashboard totals, so "sisa kas" here
// always equals the dashboard's net balance for the period. Two categories are not spending:
// "Tabungan & Investasi" moves money into savings (expense) or back out (income), and
// "Kewajiban & Cicilan" is debt service. Balances (assets and debts) come from the books.
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

  // Movements recorded in the separate books during a period. Revaluing an "asset" (house, car,
  // gold) is not saving, so only cash-like accounts count as deposits and withdrawals.
  function bookFlows(books, period) {
    const bounds = range(period);
    const kinds = new Map((books?.accounts || []).map((account) => [account.id, account.kind]));
    const flows = { payments: 0, deposits: 0, withdrawals: 0 };
    for (const entry of books?.entries || []) {
      if (!within(entry, bounds)) continue;
      const kind = kinds.get(entry.accountId);
      if (entry.kind === "payment" && kind === "installment") flows.payments += entry.amount;
      else if (kind && kind !== "installment" && kind !== "asset") {
        if (entry.kind === "deposit") flows.deposits += entry.amount;
        if (entry.kind === "withdrawal") flows.withdrawals += entry.amount;
      }
    }
    return flows;
  }

  function balanceSheet(transactions, books, asOf) {
    let cash = 0;
    for (const item of transactions) {
      if (typeof item.date !== "string" || item.date > asOf) continue;
      if (item.type === "income") cash += amountOf(item);
      else if (item.type === "expense") cash -= amountOf(item);
    }
    const entries = (books?.entries || []).filter((entry) => entry.date <= asOf);
    const groups = { savings: [], deposit: [], investment: [], asset: [], installment: [] };
    for (const account of books?.accounts || []) {
      if (account.startDate > asOf || !groups[account.kind]) continue;
      const own = entries.filter((entry) => entry.accountId === account.id);
      if (account.kind === "installment") {
        const paid = own.reduce((sum, entry) => sum + entry.amount, 0);
        groups.installment.push({ id: account.id, name: account.name, kind: account.kind, amount: Math.max(0, account.totalAmount - paid), total: account.totalAmount, paid });
      } else {
        const amount = own.reduce((sum, entry) => sum + (entry.kind === "withdrawal" ? -entry.amount : entry.amount), account.openingBalance);
        groups[account.kind].push({ id: account.id, name: account.name, kind: account.kind, amount });
      }
    }
    const sum = (rows) => rows.reduce((value, row) => value + row.amount, 0);
    const liquid = cash + sum(groups.savings) + sum(groups.deposit);
    const totalAssets = liquid + sum(groups.investment) + sum(groups.asset);
    const liabilities = sum(groups.installment);
    return {
      asOf, cash, groups, liquid,
      liquidForRatio: Math.max(0, cash) + sum(groups.savings) + sum(groups.deposit),
      investments: sum(groups.investment), otherAssets: sum(groups.asset),
      totalAssets, liabilities, netWorth: totalAssets - liabilities,
      cashAccounts: groups.savings.length + groups.deposit.length,
      accounts: Object.values(groups).reduce((count, rows) => count + rows.length, 0),
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

  function ratios(transactions, books, period, household = "child1") {
    const flow = statement(transactions, period);
    const booked = bookFlows(books, period);
    const sheet = balanceSheet(transactions, books, range(period).end);
    const spending = monthlySpending(transactions, period);
    const target = (HOUSEHOLDS[household] || HOUSEHOLDS.child1).months;
    // A payment or deposit may be recorded in the daily ledger, in a book, or in both. The larger of
    // the two is used so nothing is counted twice and nothing recorded only in a book is missed.
    const debtPaid = Math.max(flow.debtPayments, booked.payments);
    const saved = Math.max(flow.deposits, booked.deposits) - Math.max(flow.withdrawals, booked.withdrawals);
    const perIncome = (value) => (flow.revenue > 0 ? value / flow.revenue : null);
    const savingsRate = perIncome(saved);
    const debtRatio = perIncome(debtPaid);
    const liquidity = spending.average > 0 ? sheet.liquidForRatio / spending.average : null;
    const solvency = sheet.totalAssets > 0 ? sheet.netWorth / sheet.totalAssets : null;
    return {
      period, statement: flow, booked, sheet, spending, household, target,
      savings: {
        value: savingsRate, status: grade("savings", savingsRate), numerator: saved, denominator: flow.revenue,
        gap: flow.revenue > 0 ? Math.max(0, Math.ceil(STANDARDS.savings.fair * flow.revenue - saved)) : 0,
        withSurplus: perIncome(saved + Math.max(0, flow.cashChange)),
        fromBooks: booked.deposits > flow.deposits || booked.withdrawals > flow.withdrawals,
      },
      debt: {
        value: debtRatio, status: grade("debt", debtRatio), numerator: debtPaid, denominator: flow.revenue,
        excess: flow.revenue > 0 ? Math.max(0, Math.ceil(debtPaid - STANDARDS.debt.good * flow.revenue)) : 0,
        fromBooks: booked.payments > flow.debtPayments,
      },
      liquidity: {
        value: liquidity, status: sheet.cashAccounts ? grade("liquidity", liquidity, household) : liquidity === null ? "na" : "incomplete",
        numerator: sheet.liquidForRatio, denominator: spending.average,
        gap: spending.average > 0 ? Math.max(0, Math.ceil(target * spending.average - sheet.liquidForRatio)) : 0,
      },
      solvency: {
        value: solvency, status: sheet.accounts ? grade("solvency", solvency) : solvency === null ? "na" : "incomplete",
        numerator: sheet.netWorth, denominator: sheet.totalAssets,
      },
    };
  }

  function yearBreakdown(transactions, year) {
    return monthsOf({ mode: "year", key: String(year) }).map((key) => statement(transactions, { mode: "month", key }));
  }

  // Years and months that have any record, newest first, for the period pickers.
  function availablePeriods(transactions, books) {
    const months = new Set();
    for (const item of [...transactions, ...(books?.entries || []), ...(books?.accounts || []).map((account) => ({ date: account.startDate }))]) {
      if (typeof item.date === "string" && /^\d{4}-\d{2}/.test(item.date)) months.add(item.date.slice(0, 7));
    }
    const list = [...months].sort().reverse();
    return { months: list, years: [...new Set(list.map((month) => month.slice(0, 4)))] };
  }

  return {
    SAVINGS_CATEGORY, DEBT_CATEGORY, HOUSEHOLDS, STANDARDS,
    range, previous, monthsOf, statement, bookFlows, balanceSheet, monthlySpending, grade, ratios, yearBreakdown, availablePeriods,
  };
});

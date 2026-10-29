import { monthlyTotals } from './depenses.js';

const asFiniteAmount = value => Number.isFinite(Number(value)) ? Number(value) : 0;

export function buildMonthlySeries(transactions = [], selectedMonth, count = 6) {
  const [year, month] = String(selectedMonth || '').split('-').map(Number);
  const safeCount = Math.max(1, Math.floor(Number(count) || 6));
  const months = Array.from({ length: safeCount }, (_, index) => {
    const date = new Date(Date.UTC(year || new Date().getUTCFullYear(), (month || 1) - 1 - (safeCount - 1 - index), 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
  const series = { expenses: [], income: [], months };
  for (const key of months) {
    const totals = monthlyTotals(transactions, key);
    series.expenses.push(Math.max(0, asFiniteAmount(totals.expenses)));
    series.income.push(Math.max(0, asFiniteAmount(totals.income)));
  }
  return { ...series, max: Math.max(1, ...series.expenses, ...series.income) };
}

export function aggregatePieCategories(totals = {}, categories = [], { maxCategories = 5, smallSlicePercent = 5 } = {}) {
  const names = new Map((Array.isArray(categories) ? categories : []).map(category => [category.id, category]));
  const rows = Object.entries(totals || {})
    .map(([id, amount]) => ({ id, name: names.get(id)?.name || id || 'Autre', color: names.get(id)?.color || '#87929a', amount: Math.max(0, asFiniteAmount(amount)) }))
    .filter(row => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  if (!total) return { rows: [], total: 0 };
  const keep = Math.max(1, Math.floor(maxCategories) - 1);
  const explicit = rows.filter((row, index) => index < keep && row.amount / total * 100 >= smallSlicePercent);
  const folded = rows.filter(row => !explicit.includes(row));
  if (folded.length) {
    explicit.push({ id: 'other-group', name: 'Autres', color: '#87929a', amount: folded.reduce((sum, row) => sum + row.amount, 0) });
  }
  return { rows: explicit.map(row => ({ ...row, percent: row.amount / total * 100 })), total };
}

export const DEFAULT_WEEKLY_TARGET = 100;
export const MIN_WEEKLY_TARGET = 1;
export function normalizeWeeklyTarget(value) { const n = Number(value); return Number.isFinite(n) && n >= MIN_WEEKLY_TARGET ? n : DEFAULT_WEEKLY_TARGET; }
export function sumAmounts(rows = [], field = 'amount') { return rows.reduce((sum, row) => { const n = Number(row?.[field]); return sum + (Number.isFinite(n) ? n : 0); }, 0); }
export function sumByCategory(entries = [], category) { return sumAmounts(entries.filter(row => row.category === category)); }
export function totalAllocated(goals = []) { return sumAmounts(goals, 'allocated'); }
export function isWeekValidated(amount, weeklyTarget = DEFAULT_WEEKLY_TARGET) { return Number(amount) >= normalizeWeeklyTarget(weeklyTarget); }
export function isWeekMissed(index, currentWeekIndex, amount, weeklyTarget = DEFAULT_WEEKLY_TARGET) { return index < currentWeekIndex && !isWeekValidated(amount, weeklyTarget); }
export function projectProgress(allocated, target) { const a = Math.max(0, Number(allocated) || 0); const t = Math.max(0, Number(target) || 0); return { percent: t ? Math.min(100, a / t * 100) : 0, remaining: Math.max(0, t - a) }; }
export function forecastTotal(saved, remainingWeeks, weeklyDeposit) { return Number(saved || 0) + Math.max(0, Number(remainingWeeks) || 0) * Math.max(0, Number(weeklyDeposit) || 0); }
export function bankGap(balance, saved) { return Number(balance) - Number(saved); }

export function calculateForecast({ totalSaved = 0, periods = [], target = 100, deposit = 0, currentIndex = 0, frequency = 'weekly' } = {}) {
  const safeSaved = Number.isFinite(Number(totalSaved)) ? Number(totalSaved) : 0;
  const safeDeposit = Math.max(0, Number(deposit) || 0);
  const safeTarget = Math.max(1, Number(target) || 1);
  const safeIndex = Math.max(0, Math.min(periods.length, Number(currentIndex) || 0));
  const remainingSlots = periods.filter(period => Number(period.index) >= safeIndex && !(Number(period.amount) >= safeTarget)).length;
  const pointIndices = frequency === 'monthly' ? [0,3,6,9,12,15,18,21,23] : [0,13,26,39,52,65,78,91,103];
  const points = pointIndices.map(index => ({ index, amount: safeSaved + index * safeDeposit }));
  const projectedTotal = safeSaved + remainingSlots * safeDeposit;
  return { remainingSlots, projectedTotal, points, chartMax: Math.max(projectedTotal, ...points.map(point => point.amount), 1) };
}

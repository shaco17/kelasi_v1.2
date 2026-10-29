export const PERIOD_START = '2026-11-01';
export const MONTHS_TOTAL = 24;
export function normalizeTarget(value, fallback = 100) { const n = Number(value); return Number.isFinite(n) && n >= 1 ? n : fallback; }
export function monthKey(date) { const d = typeof date === 'string' ? date.slice(0,10) : new Date(date).toISOString().slice(0,10); return d.slice(0,7); }
export function computePeriodTotals(entries = [], frequency = 'weekly', count = frequency === 'monthly' ? MONTHS_TOTAL : 104) {
  const totals = Array.from({ length: count }, (_, index) => ({ index, key: frequency === 'monthly' ? monthAt(index) : weekAt(index), amount: 0 }));
  const map = new Map(totals.map(p => [p.key, p]));
  for (const entry of entries) { const raw = entry.date || entry.week_start || entry.created_at; const key = frequency === 'monthly' ? monthKey(raw) : weekKey(raw); const period = frequency === 'monthly' ? map.get(key) : totals.find(p => Number(p.key) === Number(key)); if (period) period.amount += Number(entry.amount) || 0; }
  return totals;
}
export function getCurrentPeriod(frequency = 'weekly', now = new Date()) { const date = now.toISOString().slice(0,10); if (frequency === 'monthly') return monthKey(date); const start = new Date('2026-11-02T00:00:00Z'); const days = Math.floor((Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())-start.getTime())/86400000); return String(Math.floor(days/7)); }
export function weekKey(date) { const d = new Date(`${String(date).slice(0,10)}T12:00:00Z`); const start = new Date('2026-11-02T00:00:00Z'); return String(Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start.getTime()) / 604800000)); }
function monthAt(i) { const d = new Date(Date.UTC(2026, 10 + i, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`; }
function weekAt(i) { return String(i); }
export function isPeriodValidated(amount, target) { return Number(amount) >= normalizeTarget(target); }
export function convertEurToXaf(eur) { return Number(eur || 0) * 655.957; }
export function convertXafToEur(xaf) { return Number(xaf || 0) / 655.957; }
export function addMonths(date, months) { const d = new Date(`${String(date).slice(0,10)}T12:00:00Z`); const day = d.getUTCDate(); const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1)); first.setUTCDate(Math.min(day, new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth()+1, 0)).getUTCDate())); return first.toISOString().slice(0,10); }

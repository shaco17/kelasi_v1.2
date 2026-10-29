import { addMonths } from './periods.js';
export function computeDebtSchedule(debt) {
  const total = Math.max(0, Number(debt?.totalAmount) || 0);
  const paid = Math.min(total, Math.max(0, Number(debt?.alreadyPaid) || 0));
  const payment = Number(debt?.monthlyPayment) || 0;
  const remaining = Math.max(0, total - paid);
  if (!remaining || payment <= 0 || !debt?.firstPaymentDate) return { remaining, months: 0, schedule: [], lastPaymentDate: null };
  const months = Math.ceil(remaining / payment);
  let dueDate = debt.firstPaymentDate;
  let left = remaining;
  const schedule = Array.from({ length: months }, (_, index) => { const amount = Math.min(payment, left); const row = { index: index + 1, dueDate, amount }; left = Math.max(0, left - amount); dueDate = addMonths(debt.firstPaymentDate, index + 1); return row; });
  return { remaining, months, schedule, lastPaymentDate: schedule.at(-1)?.dueDate || null };
}

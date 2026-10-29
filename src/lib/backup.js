import { mergeRows } from './sync.js';
import { mergeExpenseData } from './depenses.js';

// Deliberately merge only known KELASI fields: retired or unknown calculator fields are ignored.
export function mergeBackup(current = {}, backup = {}) {
  const incoming = backup && typeof backup === 'object' ? backup : {};
  const safeEntries = (Array.isArray(incoming.entries) ? incoming.entries : []).filter(entry => entry && typeof entry.id === 'string' && Number(entry.amount) > 0 && ['perso', 'business', 'congo'].includes(entry.category) && /^\d{4}-\d{2}-\d{2}$/.test(entry.week_start));
  const importedExpenses = incoming.depenses || Object.fromEntries(['accounts', 'comptes', 'categories', 'transactions', 'recurrences', 'budgets'].filter(key => Array.isArray(incoming[key])).map(key => [key, incoming[key]]));
  const expenseData = mergeExpenseData(current, importedExpenses);
  return {
    ...current,
    ...expenseData,
    entries: mergeRows(current.entries || [], safeEntries).filter(row => !(current.deletedEntryIds || []).includes(row.id)),
    snapshots: mergeRows(current.snapshots || [], Array.isArray(incoming.snapshots) ? incoming.snapshots : []).filter(row => !(current.deletedSnapshotIds || []).includes(row.id)),
    goals: mergeRows(current.goals || [], Array.isArray(incoming.goals) ? incoming.goals : []).filter(row => !(current.deletedGoalIds || []).includes(row.id)),
    dettes: mergeRows(current.dettes || [], Array.isArray(incoming.dettes) ? incoming.dettes : []).filter(row => !(current.deletedDebtIds || []).includes(row.id))
  };
}

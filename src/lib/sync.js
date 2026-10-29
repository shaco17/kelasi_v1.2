import { migrateData } from './migrate.js';
import { blankDepenses, mergeExpenseData } from './depenses.js';

export function mergeRows(remote = [], local = []) {
  const rows = new Map(remote.map(row => [row.id, row]));
  for (const row of local) {
    const previous = rows.get(row.id);
    const stamp = item => Date.parse(item?.updated_at || item?.created_at || '') || 0;
    if (!previous || stamp(row) >= stamp(previous)) rows.set(row.id, { ...previous, ...row });
  }
  return [...rows.values()];
}

export function mergeData(remote, local, defaults = {}) {
  const base = remote || (local ? {} : defaults);
  const loc = local || {};
  const deletedEntryIds = [...new Set([...(base.deletedEntryIds || []), ...(loc.deletedEntryIds || [])])];
  const deletedSnapshotIds = [...new Set([...(base.deletedSnapshotIds || []), ...(loc.deletedSnapshotIds || [])])];
  const deletedGoalIds = [...new Set([...(base.deletedGoalIds || []), ...(loc.deletedGoalIds || [])])];
  const deletedDebtIds = [...new Set([...(base.deletedDebtIds || []), ...(loc.deletedDebtIds || [])])];
  const expenses = mergeExpenseData({ ...blankDepenses(), ...base }, { ...blankDepenses(), ...loc });
  return {
    ...migrateData({ ...defaults, ...base, ...loc }),
    ...expenses,
    entries: mergeRows(base.entries || [], loc.entries || []).filter(row => !deletedEntryIds.includes(row.id)),
    snapshots: mergeRows(base.snapshots || [], loc.snapshots || []).filter(row => !deletedSnapshotIds.includes(row.id)),
    goals: mergeRows(base.goals || [], loc.goals || []).filter(row => !deletedGoalIds.includes(row.id)),
    dettes: mergeRows(base.dettes || [], loc.dettes || []).filter(row => !deletedDebtIds.includes(row.id)),
    deletedEntryIds, deletedSnapshotIds, deletedGoalIds, deletedDebtIds,
    weeklyTarget: Number(loc.weeklyTarget ?? base.weeklyTarget ?? defaults.weeklyTarget ?? 100),
    monthlyTarget: Number(loc.monthlyTarget ?? base.monthlyTarget ?? defaults.monthlyTarget ?? 400),
    frequency: loc.frequency ?? base.frequency ?? defaults.frequency ?? 'weekly',
    reminderMoment: loc.reminderMoment ?? base.reminderMoment ?? defaults.reminderMoment ?? 'morning',
    showDebtsInBalance: Boolean(loc.showDebtsInBalance ?? base.showDebtsInBalance ?? defaults.showDebtsInBalance ?? false),
    reminderDay: Number(loc.reminderDay ?? base.reminderDay ?? defaults.reminderDay ?? 6)
  };
}

export function migrateData(input = {}) {
  const data = { ...input };
  data.entries = (data.entries || []).map(row => ({ ...row, date: row.date || row.week_start || row.created_at?.slice(0, 10) || '' }));
  data.goals = (data.goals || []).map(goal => ({ ...goal, deadline: goal.deadline || null }));
  data.dettes = Array.isArray(data.dettes) ? data.dettes : [];
  data.deletedDebtIds = Array.isArray(data.deletedDebtIds) ? data.deletedDebtIds : [];
  data.monthlyTarget = Number(data.monthlyTarget) >= 1 ? Number(data.monthlyTarget) : Number(data.weeklyTarget) >= 1 ? Number(data.weeklyTarget) * 4 : 400;
  data.frequency = data.frequency === 'monthly' ? 'monthly' : 'weekly';
  data.reminderMoment = data.reminderMoment === 'afternoon' ? 'afternoon' : 'morning';
  data.showDebtsInBalance = Boolean(data.showDebtsInBalance);
  return data;
}

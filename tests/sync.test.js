import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeData, mergeRows } from '../src/lib/sync.js';

const defaults = { entries: [], snapshots: [], goals: [], dettes: [], deletedEntryIds: [], deletedSnapshotIds: [], deletedGoalIds: [], deletedDebtIds: [], weeklyTarget: 100 };

test('mergeRows chooses the newer version by updated_at', () => {
  const result = mergeRows([{ id: 'a', title: 'old', updated_at: '2026-01-01' }], [{ id: 'a', title: 'new', updated_at: '2026-02-01' }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'new');
});

test('a remote project tombstone removes a stale local row and remains durable', () => {
  const result = mergeData({ ...defaults, goals: [{ id: 'gone', title: 'deleted' }], deletedGoalIds: ['gone'] }, { ...defaults, goals: [{ id: 'gone', title: 'stale' }, { id: 'keep', title: 'kept' }] }, defaults);
  assert.deepEqual(result.goals.map(goal => goal.id), ['keep']);
  assert.deepEqual(result.deletedGoalIds, ['gone']);
});

test('local tombstones suppress remote rows; debt, payment and balance deletions merge too', () => {
  const result = mergeData({ ...defaults, entries: [{ id: 'e' }], snapshots: [{ id: 's' }], goals: [{ id: 'g' }], dettes: [{ id: 'd' }] }, { ...defaults, deletedEntryIds: ['e'], deletedSnapshotIds: ['s'], deletedGoalIds: ['g'], deletedDebtIds: ['d'] }, defaults);
  assert.deepEqual([result.entries, result.snapshots, result.goals, result.dettes], [[], [], [], []]);
  assert.deepEqual(result.deletedDebtIds, ['d']);
});

test('union merging does not re-add an id deleted on either device', () => {
  const result = mergeData({ ...defaults, deletedGoalIds: ['g'] }, { ...defaults, goals: [{ id: 'g', title: 'from backup' }], deletedGoalIds: ['g'] }, defaults);
  assert.equal(result.goals.length, 0);
});

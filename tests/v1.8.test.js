import test from 'node:test';
import assert from 'node:assert/strict';
import { toCloudRow, CLOUD_COLUMNS } from '../src/lib/sync.js';
import { writeLocal } from '../src/lib/storage.js';

const USER = '00000000-0000-4000-8000-000000000001';

test('versements: le champ local date devient week_start et aucun champ inconnu n’est envoyé', () => {
  const row = toCloudRow('versements', { id: 'a', date: '2026-11-05', week_start: '2026-11-02', amount: 42.5, category: 'perso', note: '', extra: 1 }, USER);
  assert.deepEqual(Object.keys(row).sort(), ['amount', 'category', 'id', 'note', 'user_id', 'week_start']);
  assert.equal(row.week_start, '2026-11-05');
  assert.equal(row.user_id, USER);
});

test('versements invalides (montant nul, date absente) ne sont pas envoyés', () => {
  assert.equal(toCloudRow('versements', { id: 'a', amount: 0, week_start: '2026-11-02', category: 'perso' }, USER), null);
  assert.equal(toCloudRow('versements', { id: 'a', amount: 10, category: 'perso' }, USER), null);
});

test('projets: indicativeDate est ignoré, deadline vide devient null', () => {
  const row = toCloudRow('projets', { id: 'p', title: 'Parcelle', target: 9000, allocated: 0, color: 'orange', category: 'Congo', indicativeDate: '2028-02', deadline: '' }, USER);
  assert.equal('indicativeDate' in row, false);
  assert.equal(row.deadline, null);
});

test('soldes: updated_at (absent de la table) n’est pas envoyé', () => {
  const row = toCloudRow('soldes_bancaires', { id: 's', balance: 100, captured_at: '2026-11-01', note: '', updated_at: '2026-11-02T00:00:00Z' }, USER);
  assert.equal('updated_at' in row, false);
  for (const key of Object.keys(row)) assert.ok(key === 'user_id' || CLOUD_COLUMNS.soldes_bancaires.includes(key));
});

test('writeLocal renvoie false au lieu de planter quand le stockage est plein', async () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = { setItem() { throw new Error('QuotaExceededError'); }, getItem() { return null; } };
  const warn = console.warn; console.warn = () => {};
  try { assert.equal(await writeLocal('x', { entries: [] }), false); }
  finally { globalThis.localStorage = previous; console.warn = warn; }
});

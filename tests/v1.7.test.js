import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthlySeries, aggregatePieCategories } from '../src/lib/expense-charts.js';
import { migrateData } from '../src/lib/migrate.js';
import { mergeBackup } from '../src/lib/backup.js';

test('monthly trend retains independent expense and income series on one shared scale', () => {
  const transactions = [
    { type: 'expense', date: '2026-10-02', amount: 20 },
    { type: 'income', date: '2026-10-03', amount: 60 },
    { type: 'expense', date: '2026-09-02', amount: 0 },
    { type: 'income', date: '2026-08-02', amount: null },
  ];
  const series = buildMonthlySeries(transactions, '2026-10', 3);
  assert.deepEqual(series.months, ['2026-08', '2026-09', '2026-10']);
  assert.deepEqual(series.expenses, [0, 0, 20]);
  assert.deepEqual(series.income, [0, 0, 60]);
  assert.equal(series.max, 60);
  assert.equal(buildMonthlySeries([{type:'income',date:'2026-10-01',amount:12}], '2026-10', 1).max, 12);
});

test('pie aggregation folds small and excess categories into Autres with correct amounts and percentages', () => {
  const result = aggregatePieCategories({a:60,b:20,c:10,d:6,e:4}, [
    {id:'a',name:'Loyer',color:'#a00'},{id:'b',name:'Courses',color:'#0a0'},
    {id:'c',name:'Transport',color:'#00a'},{id:'d',name:'Santé',color:'#aa0'},{id:'e',name:'Loisirs',color:'#0aa'}
  ]);
  assert.deepEqual(result.rows.map(x=>x.name), ['Loyer','Courses','Transport','Santé','Autres']);
  assert.deepEqual(result.rows.map(x=>x.amount), [60,20,10,6,4]);
  assert.equal(result.rows.reduce((sum,x)=>sum+x.percent,0),100);
  assert.deepEqual(aggregatePieCategories({}, []).rows, []);
});

test('retired calculator state disappears from navigation/data and legacy JSON import is safe', () => {
  const source = new URL('../src/App.jsx', import.meta.url);
  return import('node:fs/promises').then(async fs => {
    const app = await fs.readFile(source, 'utf8');
    assert.doesNotMatch(app, /id:\s*['"]calculator['"]|page === ['"]calculator['"]|CalculatorPage|onPage\(['"]calculator/);
    const migrated = migrateData({ entries: [], calculator: { history: [1] }, calcGoal: 10, convertValue: '3' });
    assert.equal('calculator' in migrated, false);
    assert.equal('calcGoal' in migrated, false);
    const current = {entries:[],transactions:[],accounts:[],categories:[],recurrences:[],budgets:[],goals:[],snapshots:[],dettes:[]};
    const restored = mergeBackup(current, {entries:[],calculator:{history:['old']},calcGoal:999,convertValue:'old'});
    assert.equal(restored.transactions.length,0);
    assert.equal('calculator' in restored,false);
    assert.equal('calcGoal' in restored,false);
  });
});

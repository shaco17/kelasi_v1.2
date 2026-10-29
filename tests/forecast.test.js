import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateForecast, sumAmounts } from '../src/lib/calc.js';
import { computeDebtSchedule } from '../src/utils/debt.js';
import { computePeriodTotals } from '../src/utils/periods.js';

test('prévision avec données vides reste définie et positive pour l’axe', () => {
  const result = calculateForecast({ totalSaved: 0, periods: [], target: 0, deposit: 100, currentIndex: 0, frequency: 'weekly' });
  assert.equal(result.projectedTotal, 0); assert.equal(result.remainingSlots, 0); assert.equal(result.chartMax, 10300); assert.equal(result.points.length, 9);
});
test('prévision hebdomadaire compte les périodes restantes non validées', () => {
  const periods = [{index:0,amount:100},{index:1,amount:10},{index:2,amount:0}];
  const result = calculateForecast({totalSaved:110,periods,target:100,deposit:25,currentIndex:1});
  assert.equal(result.remainingSlots,2); assert.equal(result.projectedTotal,160); assert.equal(result.points.at(-1).amount, 110+103*25);
});
test('prévision mensuelle utilise 24 mois et points de courbe mensuels', () => {
  const periods = computePeriodTotals([{date:'2026-11-03',amount:400},{date:'2027-01-09',amount:250}], 'monthly', 24);
  const result = calculateForecast({totalSaved:650,periods,target:400,deposit:500,currentIndex:3,frequency:'monthly'});
  assert.equal(periods.length,24); assert.equal(result.remainingSlots,21); assert.equal(result.projectedTotal,11150); assert.deepEqual(result.points.map(p=>p.index),[0,3,6,9,12,15,18,21,23]);
});
test('dettes déclarées restent séparées de l’épargne et calculables sans échéance', () => {
  const debt={label:'Prêt',totalAmount:600,monthlyPayment:100,alreadyPaid:100,firstPaymentDate:null};
  assert.equal(sumAmounts([]),0); assert.equal(computeDebtSchedule(debt).remaining,500); assert.equal(computeDebtSchedule(debt).lastPaymentDate,null);
  const scheduled=computeDebtSchedule({...debt,firstPaymentDate:'2026-11-01'}); assert.equal(scheduled.months,5); assert.equal(scheduled.lastPaymentDate,'2027-03-01');
});
test('cible nulle et objectifs avec ou sans deadline ne provoquent pas de division par zéro', () => {
  assert.equal(calculateForecast({periods:[{index:0,amount:0}],target:0,deposit:0,currentIndex:0}).chartMax,1);
  const projects=[{target:1200,deadline:'2028-12-01'},{target:0,deadline:null}];
  assert.equal(projects.filter(p=>p.deadline).length,1);
  assert.ok(projects.every(p=>Number.isFinite(p.target)));
});

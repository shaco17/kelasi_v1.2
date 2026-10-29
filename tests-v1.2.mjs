import test from 'node:test';
import assert from 'node:assert/strict';
import { computeDebtSchedule } from './src/utils/debt.js';
import { computePeriodTotals, isPeriodValidated, convertEurToXaf, convertXafToEur } from './src/utils/periods.js';
test('échéancier fin de mois et paiement partiel',()=>{const s=computeDebtSchedule({totalAmount:250,alreadyPaid:0,monthlyPayment:100,firstPaymentDate:'2027-01-31'});assert.deepEqual(s.schedule.map(x=>x.dueDate),['2027-01-31','2027-02-28','2027-03-31']);assert.deepEqual(s.schedule.map(x=>x.amount),[100,100,50]);assert.equal(s.lastPaymentDate,'2027-03-31');});
test('40 + 60 valide la période cible 80',()=>{const p=computePeriodTotals([{date:'2027-01-02',amount:40},{date:'2027-01-30',amount:60}],'monthly');const jan=p.find(x=>x.key==='2027-01');assert.equal(jan.amount,100);assert.equal(isPeriodValidated(jan.amount,80),true);});
test('parité XAF',()=>{assert.equal(convertEurToXaf(1),655.957);assert.equal(convertXafToEur(655.957),1);});

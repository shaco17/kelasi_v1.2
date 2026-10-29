import test from 'node:test';
import assert from 'node:assert/strict';
import { bankGap, forecastTotal, isWeekMissed, isWeekValidated, normalizeWeeklyTarget, projectProgress, sumAmounts, totalAllocated } from '../src/lib/calc.js';
test('versements cumulés valident selon le seuil réglé', () => { assert.equal(isWeekValidated(40+60,100), true); assert.equal(isWeekValidated(79,80), false); assert.equal(isWeekValidated(80,80), true); });
test('cibles configurées avec minimum 1 et défaut 100', () => { assert.equal(normalizeWeeklyTarget(80),80); assert.equal(normalizeWeeklyTarget(0),100); });
test('montants décimaux et affectations projets', () => { assert.equal(sumAmounts([{amount:150.5}]),150.5); assert.equal(totalAllocated([{allocated:150.5},{allocated:1}]),151.5); });
test('état manqué et progression capée', () => { assert.equal(isWeekMissed(2,3,79,80),true); assert.deepEqual(projectProgress(150.5,101),{percent:100,remaining:0}); assert.equal(projectProgress(1,1001).remaining,1000); });
test('prévision et écart bancaire signés', () => { assert.equal(forecastTotal(200,3,80),440); assert.equal(bankGap(300,250),50); assert.equal(bankGap(200,250),-50); });

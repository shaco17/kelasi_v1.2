import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePage, selectNavigationItems } from '../src/lib/navigation.js';

test('navigation ignores removed, undefined, and icon-less items', () => {
  const homeIcon = () => null;
  const items = [
    { id: 'home', label: 'Accueil', icon: homeIcon },
    undefined,
    { id: 'calculator', label: 'Calculatrice' },
    { id: 'stale', label: 'Ancien onglet', icon: null },
  ];
  assert.deepEqual(selectNavigationItems(items).map(item => item.id), ['home']);
  assert.deepEqual(selectNavigationItems(items, ['home', 'calculator']).map(item => item.id), ['home']);
});

test('unknown or removed page keys fall back to home', () => {
  const items = [{ id: 'home', icon: () => null }, { id: 'expenses', icon: () => null }];
  assert.equal(resolvePage('expenses', items), 'expenses');
  assert.equal(resolvePage('calculator', items), 'home');
  assert.equal(resolvePage(undefined, items), 'home');
});

test('mobile navigation selection omits out-of-range stale slots and keeps each page once', () => {
  const items = [
    { id: 'home', icon: () => null }, { id: 'entries', icon: () => null },
    { id: 'forecast', icon: () => null }, { id: 'projects', icon: () => null },
    { id: 'debts', icon: () => null }, { id: 'bank', icon: () => null },
    { id: 'expenses', icon: () => null }, { id: 'settings', icon: () => null },
  ];
  assert.deepEqual(
    selectNavigationItems(items, ['home', 'entries', 'expenses', 'projects', 'bank', 'settings']).map(item => item.id),
    ['home', 'entries', 'expenses', 'projects', 'bank', 'settings'],
  );
});

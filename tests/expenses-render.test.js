import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { blankDepenses, normalizeDepenses } from '../src/lib/depenses.js';

test('Dépenses renders default and populated accounts, transactions, budget and recurrence state', async () => {
  const vite = await createServer({
    configFile: false,
    plugins: [react()],
    server: { middlewareMode: true },
    appType: 'custom',
  });
  try {
    const { default: ExpensesPage } = await vite.ssrLoadModule('/src/components/ExpensesPage.jsx');
    const noChange = () => {};
    const emptyMarkup = renderToString(React.createElement(ExpensesPage, { value: normalizeDepenses(blankDepenses()), onChange: noChange }));
    assert.match(emptyMarkup, /Dépenses/);
    const populated = normalizeDepenses({
      accounts: [{ id: 'cash', name: 'Espèces', type: 'cash', initialBalance: 80 }],
      categories: [{ id: 'food', name: 'Courses', color: '#48a88a', icon: '•' }],
      transactions: [{ id: 't1', date: new Date().toISOString().slice(0, 10), amount: 12, type: 'expense', accountId: 'cash', categoryId: 'food', note: 'Marché' }],
      budgets: [{ id: 'b1', categoryId: 'food', limit: 100 }],
      recurrences: [{ id: 'r1', name: 'Loyer', amount: 700, accountId: 'cash', frequency: 'monthly', nextDate: '2099-01-01', active: true }],
    });
    const dataMarkup = renderToString(React.createElement(ExpensesPage, { value: populated, onChange: noChange }));
    assert.match(dataMarkup, /Espèces/);
    const transactionsMarkup = renderToString(React.createElement(ExpensesPage, { value: populated, onChange: noChange, initialTab: 'transactions' }));
    const budgetsMarkup = renderToString(React.createElement(ExpensesPage, { value: populated, onChange: noChange, initialTab: 'budgets' }));
    const recurrencesMarkup = renderToString(React.createElement(ExpensesPage, { value: populated, onChange: noChange, initialTab: 'recurrences' }));
    assert.match(transactionsMarkup, /Marché/);
    assert.match(budgetsMarkup, /Courses/);
    assert.match(recurrencesMarkup, /Loyer/);
  } finally {
    await vite.close();
  }
});

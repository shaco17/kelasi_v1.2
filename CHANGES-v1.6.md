# KELASI v1.6.1 — Correctif Dépenses

## Correctif livré
- Clé canonique unique du modèle Dépenses : `accounts`. Le composant, le modèle normalisé, la persistance locale (`kelasi-depenses-<userId>-accounts`), les fusions, les tombstones et les mappings Supabase utilisent maintenant cette clé. Le nom de table SQL `depenses_comptes` reste intentionnellement inchangé.
- Import rétrocompatible : `comptes` est accepté dans les anciens exports JSON, dans le champ agrégé `depenses`, dans l’ancien stockage local et pour les tombstones historiques; les données relues sont normalisées en `accounts`.
- Harmonisation et contrôle des cinq collections `accounts`, `categories`, `transactions`, `recurrences`, `budgets` dans l’UI, le stockage, l’import/export JSON, la fusion/sync et les cinq tables SQL. Les champs métier employés (`accountId`, `destinationAccountId`, `categoryId`, `limit`, `nextDate`, `updated_at`/`created_at`) sont conservés dans `data` JSONB et partagés entre calculs et UI.
- Ajout d’un test `renderToString` de `ExpensesPage` sur les états par défaut et peuplé, couvrant aussi le rendu des onglets transactions, budgets et récurrences. Ajout d’un test de migration `comptes` vers `accounts` et de conversion de tombstone.

## Vérifications exécutées
- `npm ci` avec npm 10.9.2 installé localement après constat que le lanceur npm global échoue (`Cannot find module '../lib/cli.js'`). Installation terminée; audit npm rapporte 7 vulnérabilités héritées (5 faibles, 1 modérée, 1 élevée).
- `npm test` : 22 tests réussis, 0 échec, y compris l’ensemble des tests antérieurs et le test SSR.
- `npm run build` : réussi avec Vite 5.4.21; avertissement de bundle JS minifié > 500 kB.

## Limites restantes
- Rendu SSR de composants, pas validation visuelle dans un navigateur : apparence, interaction, tailles écran et comportement responsive non vérifiés visuellement.
- Aucun projet/compte Supabase réel n’était disponible : exécution effective de `SUPABASE_DEPENSES_V1.6.sql`, politiques RLS et synchronisation réseau/multi-appareils restent non vérifiées.

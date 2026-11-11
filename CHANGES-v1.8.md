# KELASI v1.8.0 — Vérification et fiabilisation

## Vérifications effectuées
- `npm ci`, `npm test` (33 tests, 0 échec), `node tests-v1.2.mjs`, `npm run build` : OK.
- Test navigateur (Playwright, mobile 390 px, mode local) : navigation dans les 8 pages sans erreur console, ajout d'un versement en mode mensuel.
- Non vérifié : synchronisation réelle avec Supabase (le projet utilisé par l'app n'est pas accessible depuis cette session).

## Corrections
- **Synchronisation cloud bloquée** : `pushCloud` envoyait des champs inexistants dans les tables (`date` dans `versements`, `indicativeDate` dans `projets`, `updated_at` dans `soldes_bancaires`). PostgREST rejetait alors tout l'envoi et la bannière restait « synchronisation en attente ». Seules les vraies colonnes sont maintenant envoyées (`toCloudRow` dans `src/lib/sync.js`), et un échec sur une table n'empêche plus l'envoi des autres.
- **Base Supabase** : `SUPABASE_A_EXECUTER.sql` imposait `amount >= 100` alors que l'app accepte tout montant positif, et `SUPABASE_V1.2.sql` contenait une instruction cassée (`create table` manquant pour `dettes`). Le script `SUPABASE_V1.8_CORRECTIF.sql` règle les deux, ajoute `projets.deadline` et peut être relancé.
- **Mode mensuel** : le bouton « Pointer » et les cases du calendrier passaient le libellé « janvier 2027 » comme date, le mois en cours était calculé avec l'index de la *semaine*, et les cases affichaient « vier 2027 ». Corrigé : vraie date ISO, bon mois courant, numéro du mois dans les cases.
- **Clic sur une case du calendrier** : un versement saisi à une date réelle (pas un lundi) n'était jamais retrouvé. La recherche se fait maintenant par période.
- **Rappels** : en mode hebdomadaire, le message parlait d'« objectif mensuel » et ne se déclenchait qu'une fois par mois. Il est maintenant hebdomadaire (le week-end).
- **Stockage plein** (photos de reçus) : l'écriture locale levait une exception non gérée. Elle renvoie maintenant `false` et l'app affiche un message.
- **Dépenses** : la date par défaut d'une nouvelle transaction restait figée au jour d'ouverture de l'app.

## Nettoyage du dépôt
- Retrait des fichiers de build suivis par Git (`dist/`, `assets/`, `sw.js`, `workbox-*.js` et copies racine des icônes et du manifeste, déjà présentes dans `public/`) et des fichiers `src/*.tmp`.
- Ajout de `.gitignore` (`node_modules`, `dist`, `.env`).

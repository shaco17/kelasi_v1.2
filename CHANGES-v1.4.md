# KELASI v1.4 — synchronisation cohérente entre appareils

## Cause racine (source v1.3)

- `src/App.jsx:36-52` définit 15 projets initiaux ; avant v1.4 les 15 avaient des clés texte stables dans les constantes, mais `blankData()` en `:73` remplaçait leurs IDs par `newId()` (UUID aléatoire). Le seed de première connexion à `:234` créait lui aussi de nouveaux UUID à chaque installation. La migration v1.4 harmonise aussi les anciens IDs locaux/cloud à partir de la signature exacte (nom/cible/catégorie) dans `src/App.jsx:54-64`. Deux appareils ne partageaient donc pas les mêmes identifiants de projets initiaux.
- La fusion v1.3 à `src/App.jsx:83-100` fusionnait les lignes locales et distantes par union (`mergeRows`) ; une ligne absente du cloud n'était pas la preuve d'une suppression. Les `deletedGoalIds` locaux étaient utilisés pour filtrer, mais `pullCloud()` à `:103-115` ne lisait aucune suppression distante.
- `pushCloud()` v1.3 à `src/App.jsx:118-141` envoyait des suppressions SQL physiques pour les IDs présents dans les tableaux `deleted*Ids`, puis les effaçait de `localStorage`. Les lignes supprimées des tableaux Supabase ne pouvaient plus propager la suppression ; un autre appareil gardait sa copie et la fusion par union la réintroduisait. Le même défaut de principe touchait `versements`, `soldes_bancaires`, `projets` et `dettes`.
- Le démarrage chargeait le cloud une fois (`src/App.jsx:217-251`) ; il existait un nouvel essai sur `online` (`:272-282`), mais pas de pull/merge sur focus, `visibilitychange`, intervalle, ou canal realtime.

## Modifications

- `src/lib/sync.js:13-37`: fusion centralisée, union durable des tombstones, filtre des IDs effacés avant retour des lignes.
- `src/App.jsx:36-70, 89-111, 122-171, 226-318`: IDs UUID déterministes pour les 15 projets initiaux, migration douce des anciens projets initiaux par signature (nom/cible/catégorie), écriture distante d'un marqueur de seed une seule fois, chargement des tombstones et rafraîchissement cloud au démarrage, focus, visibilité, reconnexion, toutes les 60 secondes (sans souscription realtime, non activée pour éviter une boucle de changements auto-déclenchés).
- Les suppressions locales restent dans les clés localStorage existantes en attente de reconnexion. À la synchronisation, un tombstone est d'abord enregistré, puis la ligne est effacée de la table de données. Les tombstones ne sont jamais purgés par le client : ils empêchent les anciennes copies de ressusciter les lignes supprimées. Cela s'applique aux versements, soldes, projets et dettes.
- L'import JSON respecte aussi les tombstones connus ; les fonctions existantes, le mode local, les noms de tables et les clés de stockage demeurent compatibles.
- Tests : `tests/sync.test.js` couvre la priorité de version, la fusion, les suppressions multi-tables et la non-résurrection.

## SQL / déploiement

Exécuter **une fois avant la mise en ligne de v1.4** `SUPABASE_SYNC_V1.4.sql` dans l'éditeur SQL Supabase. C'est une migration additive : elle ajoute `sync_tombstones`, sa clé composée, RLS et sa policy utilisateur ; aucune table de données existante n'est modifiée. Le client exige ce registre pour la synchronisation en ligne ; si la table n'existe pas, l'application reste locale/en attente et signale l'échec dans la console.

Les données cloud v1.3 existantes restent intactes. Les noms des projets initiaux sont convertis vers leurs IDs canoniques lors du prochain chargement. Une suppression effectuée **avant** l'installation v1.4 ne peut pas toujours être reconstituée : l'ancienne suppression distante a physiquement effacé l'identifiant et aucun journal partagé n'existait. En cas de copie ancienne encore présente sur un appareil, vérifier les projets après la première migration et supprimer à nouveau tout projet qui ne doit plus être partagé ; sa suppression v1.4 sera alors propagée durablement.

## Tests manuels — deux appareils

1. Appliquer le SQL ci-dessus, déployer la même build v1.4 sur téléphone et second appareil, ouvrir une session avec le même compte Supabase et attendre « ACTIF ».
2. Vérifier que les projets par défaut n'apparaissent qu'une fois sur les deux appareils. Créer un projet personnalisé sur l'appareil A ; après actualisation/focus ou au plus tard 60 secondes, vérifier sa présence sur B.
3. Supprimer un projet par défaut sur A ; vérifier sa disparition de B après realtime/rafraîchissement. Recharger B et vérifier qu'il ne revient pas.
4. Répéter pour un versement, un solde bancaire et une dette.
5. Mettre A hors ligne, supprimer un projet, puis rétablir le réseau. Vérifier le statut en attente puis actif et la disparition sur B. Recharger A et B pour confirmer la persistance.
6. Faire une modification hors ligne concurrente non destructive et vérifier que les autres lignes restent présentes.

## Validation de build

- `npm ci` (client npm CLI 10.9.4 utilisé localement : `/usr/local/bin/npm` fourni par le sandbox est incomplet).
- `npm test`: 9 tests passés.
- `npm run build`: réussi avec Vite 5.4.21, PWA generateSW et 20 entrées précachées.

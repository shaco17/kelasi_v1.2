# KELASI V1.2 — journal des changements

## Fichiers modifiés / ajoutés
- `src/App.jsx` : navigation Dettes, modals et cartes des dettes, échéances projet, dates de versement, convertisseur XAF, réglages de périodicité et rappels, export/import compatible.
- `src/utils/debt.js` : calcul de l’échéancier mensuel et des paiements partiels.
- `src/utils/periods.js` : agrégats et validation des périodes, conversion EUR/XAF, ajout de mois calendaire.
- `src/lib/migrate.js` : migration locale douce et idempotente.
- `src/styles.css` : styles des nouveaux blocs réutilisant les classes KELASI.
- `SUPABASE_V1.2.sql` : deadline nullable et table dettes avec RLS.
- `netlify.toml` : Node 20, build `npm run build`, publication `dist`, redirections et headers service-worker inchangés.
- `tests-v1.2.mjs` : tests unitaires ciblés.

## Diagnostic build
Le lanceur `npm` préinstallé dans le sandbox échouait avant même `npm ci` : `/usr/local/bin/npm` référençait un `../lib/cli.js` absent. Après installation temporaire du CLI npm 10.8.2 pour exécuter les commandes, `npm ci` puis `npm run build` terminent correctement. C’est un défaut de l’environnement de test, et non une cause propre au code source.

## Tests à faire manuellement
1. Démarrer en mode local; créer et modifier des projets avec et sans échéance; trier par échéance et vérifier les filtres.
2. Choisir la fréquence mensuelle; vérifier les 24 périodes novembre 2026–octobre 2028, ajouter deux versements (40 € et 60 €), puis vérifier l’atteinte d’une cible de 80 €.
3. Ajouter une dette de 250 €, mensualité 100 €, premier paiement 31/01/2027; vérifier les dates de février et le dernier paiement partiel.
4. Tester modification/suppression de dette, case payé, JSON export/import ancien et nouveau.
5. Vérifier Supabase avec et sans la table dettes avant/après exécution du SQL.
6. Tester permission de notifications accordée/refusée, rappels lors de l’ouverture, rappels mensuels et dettes proches.
7. Vérifier les conversions EUR→XAF et XAF→EUR, navigation logo et mobile.

## Limites de validation
Aucun navigateur n’a été utilisé pour une inspection visuelle ou un parcours manuel. Le backend Supabase n’a pas été connecté. Les contrôles automatisés sont indiqués par les commandes/test reports de livraison; aucun seuil minimal de 100/101/1001 ne doit être réintroduit.

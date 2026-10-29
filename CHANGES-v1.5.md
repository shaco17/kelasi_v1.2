# KELASI v1.5 — prévisions robustes et budget cible lisible

## Cause racine de l’onglet « Prévisions » vide

La cause directe est une **ReferenceError** dans `ForecastPage` (`src/App.jsx`) : le calcul des périodes restantes appelait `isPeriodValidated(w.amount, activePeriodTarget)`, mais `activePeriodTarget` n’existait que dans `Dashboard` et n’était ni défini localement, ni transmis comme propriété à `ForecastPage`. Dès l’ouverture de Prévisions, le rendu levait donc une exception JS avant l’affichage des graphiques et sections. La page n’avait pas de frontière d’erreur locale pour isoler cette panne.

Le diagnostic exclut les données vides, les projets sans échéance, les dettes et la cible nulle comme déclencheur principal : l’exception se produit à l’évaluation du composant, même avec les jeux de données normaux. Un défaut adjacent de fréquence était également présent : la simulation dans Prévisions restait calculée en semaines alors que l’application permet le suivi mensuel.

## Modifications

- `src/App.jsx` : transmet explicitement le seuil actif, la fréquence et l’index de période à `ForecastPage`; ajoute un `ForecastErrorBoundary` local avec message récupérable; affiche un état vide explicite en l’absence de versements; adapte le simulateur, ses scénarios, son horizon, sa courbe et les jalons à la fréquence hebdomadaire ou mensuelle.
- `src/lib/calc.js` : nouvelle fonction pure `calculateForecast`, avec bornes de sécurité pour période, dépôt, cible et axe du graphique.
- `tests/forecast.test.js` : tests pour données vides, calcul hebdomadaire, calcul mensuel (24 périodes), dettes avec/sans échéance, projets sans échéance et cible à zéro.
- `src/App.jsx`, `src/styles.css` : réécrit le récapitulatif projets en « Budget cible », montant en gras, sous-texte bref; styles responsifs pour tablette/mobile, retour à la ligne des valeurs et placement sous le texte sur écrans étroits.
- `src/styles.css` : styles sobres de l’état vide / erreur, sans modifier la palette ni la typographie générale.
- `package.json` et `package-lock.json` : version du projet portée à 1.5.0.

## Validation

- `npm ci` : réussi avec npm CLI 10.9.4 téléchargé localement, car le lanceur global `/usr/local/bin/npm` est incomplet (`Cannot find module '../lib/cli.js'`).
- `npm test` : 14 tests passés, 0 échec.
- `npm run build` : réussi (Vite 5.4.21, PWA, 20 entrées précachées).
- La mise en page n’a pas été ouverte dans un navigateur ou testée par captures d’écran; les tailles mobiles/tablettes ont été vérifiées par les règles CSS existantes et les nouveaux media queries, pas visuellement.
- `npm ci` signale 7 vulnérabilités dans l’arbre installé (5 low, 1 moderate, 1 high); aucune mise à niveau de dépendances n’a été faite dans cette correction.

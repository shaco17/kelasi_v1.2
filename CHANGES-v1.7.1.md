# KELASI v1.7.1 — Correctif navigation

## Cause trouvée (confirmée par le code)

La cause n’était pas une entrée `Calculatrice` ni une clé d’icône absente dans la table `NAV_ITEMS` : dans `src/App.jsx`, lignes 27–35, les huit entrées de navigation définissent toutes un identifiant et une icône, et aucune entrée calculatrice n’y subsiste.

La faute confirmée était dans la navigation mobile, `src/App.jsx`, ancienne ligne 532 : le tableau `[NAV_ITEMS[0], NAV_ITEMS[1], NAV_ITEMS.find(x=>x.id==='expenses'), NAV_ITEMS[3], NAV_ITEMS[6], NAV_ITEMS[8]]` utilisait des indices après retrait de l’onglet calculatrice. Or la dernière entrée valable est `NAV_ITEMS[7]` (`Réglages`, icône `Settings`), donc `NAV_ITEMS[8]` est `undefined`. Le `map` faisait ensuite `const Icon = item.icon`, d’où l’erreur `Cannot read properties of undefined (reading 'icon')`. La séquence `NAV_ITEMS[3]` et `[6]` entraînait également des onglets incorrects/doublés. Le composant de navigation latérale ne contenait pas l’entrée fautive.

Le défaut a été confirmé par inspection des sources et de cette expression ; il n’a pas été reproduit dans un navigateur.

## Correctif

- Ajout de `src/lib/navigation.js` : sélection défensive des seules entrées valides (identifiant et icône définis) et résolution de tout identifiant de page inconnu vers `home`.
- `src/App.jsx` utilise désormais cette sélection pour les deux navigations. La barre mobile demande explicitement les onglets `home`, `entries`, `expenses`, `projects`, `bank` et `settings`, sans indices fragiles. Les rendus et le libellé de page s’appuient sur la page validée ; un effet remplace aussi l’état d’une page retirée par `home`.
- Version du paquet et de son lockfile portée à `1.7.1`, étiquette de version de l’interface mise à jour.
- Tests de régression ajoutés dans `tests/navigation.test.js` pour les éléments absents/incomplets, les pages inconnues et les onglets mobiles.

Aucune donnée utilisateur, donnée du stockage local ni table Supabase n’a été modifiée par ce correctif.

## Vérifications exécutées

- `npm ci` : réussi (via une copie locale de npm ; le lanceur préinstallé `/usr/local/bin/npm` du sandbox est cassé, son `../lib/cli.js` étant absent). npm a signalé 7 vulnérabilités sur le graphe de dépendances (5 faibles, 1 modérée, 1 élevée) et un script d’installation `esbuild` bloqué.
- `npm test` : réussi, 28 tests, 28 passés, 0 échec.
- `npm run build` : réussi (Vite 5.4.21, génération PWA comprise). Avertissement Vite non bloquant : bundle JS minifié d’environ 510,72 kB, supérieur au seuil de 500 kB.
- Archive ZIP : contrôlée par `unzip -t`, sans erreur.
- Aucun essai visuel navigateur : non effectué (non disponible dans ce workflow).

## Livrable

- `kelasi-v1.7.1-fix.zip` — sources, tests et build de production.
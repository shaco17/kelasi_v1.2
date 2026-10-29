# KELASI 1.7.0 — changements

## Modifications
- Graphique mensuel : séries Dépenses et Revenus générées indépendamment et conservées simultanément, avec échelle Y commune (maximum des deux), valeurs nulles normalisées à zéro, axe minimum 1 et dates UTC. Les six mois suivent le mois sélectionné.
- Tableau de bord Dépenses : remplacement du graphique en barres par un camembert/donut en carte dédiée, légende catégorielle (montant et pourcentage), état vide explicite et regroupement des parts petites ou excédentaires sous « Autres »; disposition mobile adaptative.
- Suppression mobile du seul avatar/bouton « Réglages » de la barre supérieure (`button.top-avatar[title="Réglages"]`), qui était une seconde entrée d’accès aux réglages. La navigation inférieure fixe (`.mobile-bottom-nav`) est préservée avec son entrée Réglages.
- Suppression complète de l’onglet « Calculatrice » et son convertisseur de devises dédié : barre latérale, routage/page, état/hooks, action de tableau de bord, imports, styles et champs d’état legacy lors des migrations. Les données calculatrice des anciennes sauvegardes sont ignorées.
- Version du paquet et du lockfile portée à 1.7.0. Ajout de tests ciblant les deux séries, le camembert, la navigation sans Calculatrice et l’import de sauvegarde ancienne.

## Causes racines établies
- Le tracé de chaque série calculait séparément son propre `top` (`Math.max(1, ...vals)`) à l’intérieur de la boucle `['expenses','income']`. Chaque série était donc normalisée sur son maximum individuel et toutes deux occupaient presque toute la hauteur : leurs trajectoires se superposaient et semblaient qu’une courbe avait disparu. L’ancienne logique ne garantissait pas de domaine Y commun. La correction mesure une seule fois `max` sur les valeurs de dépenses **et** de revenus, puis trace les deux tableaux sans condition de présence de l’autre série.
- L’élément identifié et masqué sur téléphone uniquement est l’avatar `.top-avatar` du header, dont `title="Réglages"` déclenche `setPage('settings')`. Ce n’est pas la bottom-nav. Cette entrée de header est masquée par média-query à ≤720 px; la bottom-nav et son item Réglages ne sont pas modifiés.

## Validation
- `npm ci` (npm 10.9.4 installé localement puisque l’exécutable npm global fourni était cassé) : réussi.
- `npm test` : 25 tests réussis, 0 échec.
- `npm run build` : réussi (Vite 5.4.21, génération PWA incluse).

## Limites connues
- Aucun test visuel dans un navigateur réel ni contrôle manuel sur appareils mobiles n’a été effectué. Le rendu graphique/mobile est couvert par logique de données, rendu serveur existant, CSS et compilation, mais le visuel final n’est pas certifié.
- npm rapporte 7 avis d’audit sur les dépendances existantes; aucune mise à jour forcée des dépendances n’a été faite dans cette livraison. Vite signale également un chunk JS minifié >500 kB.

# Passation du guichet médiathèque

Lire [le cahier des charges](CAHIER-DES-CHARGES.md), [le guide](DEVELOPPEMENT.md) et [la recette](RECETTE-GUICHET.md).

Les règles en vigueur sont celles du 14 novembre 2026 : navigation latérale, une carte par joueur JV ou participant d’animation, quota hebdomadaire JV, salles exclusives, confirmation agent après J+15 et statistiques administratives avec extraction CSV filtrée. Animations propose une inscription rapide chronologique. Les modèles se gèrent dans Administration → Animations, avec un droit distinct délégable depuis Accès des agents ; les séances existantes ne changent pas avec leur modèle.

La version partagée utilise la base distante de développement à Paris. La démonstration autonome compile les mêmes parcours avec un service en mémoire, sans réseau. Les secrets et comptes restent hors Git.

Après modification de `dev/app.js`, `dev/app.css`, `dev/demo.js` ou du gabarit `templates/guichet.html`, exécuter `npm run build`. Les scripts reconstruisent les pages et les empreintes CSP. Le schéma et ses changements figurent dans `supabase/migrations/`.

Les essais utilisent exclusivement des données fictives. La recette sur le matériel et le réseau du service, les validations institutionnelles et les procédures de sauvegarde/restauration restent nécessaires avant usage réel.

Les liens vers GitHub et les documents du projet ont été retirés des pages du guichet. La documentation reste dans le dépôt. Pour un changement limité aux textes, liens ou styles, reconstruire les pages et vérifier le résultat ciblé ; la suite métier complète reste pertinente pour une modification des règles ou des transactions.

# Passation du guichet médiathèque

Lire [le cahier des charges](CAHIER-DES-CHARGES.md), [le guide](DEVELOPPEMENT.md) et [la recette](RECETTE-GUICHET.md).

Les règles en vigueur sont celles du 14 novembre 2026 : navigation latérale, une carte par joueur JV ou participant d’animation, quota hebdomadaire JV, salles exclusives, confirmation agent après J+15 et statistiques administratives.

La version partagée utilise la base distante de développement à Paris. La démonstration autonome compile les mêmes parcours avec un service en mémoire, sans réseau. Les secrets et comptes restent hors Git.

Après modification de `dev/app.js`, `dev/app.css`, `dev/demo.js` ou du gabarit `templates/guichet.html`, exécuter `npm run build`. Les scripts reconstruisent les pages et les empreintes CSP. Le schéma et ses changements figurent dans `supabase/migrations/`.

Les essais utilisent exclusivement des données fictives. La recette sur le matériel et le réseau du service, les validations institutionnelles et les procédures de sauvegarde/restauration restent nécessaires avant usage réel.

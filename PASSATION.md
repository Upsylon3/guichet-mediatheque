# Passation du guichet médiathèque

Lire [le cahier des charges](CAHIER-DES-CHARGES.md), [le guide](DEVELOPPEMENT.md) et [la recette](RECETTE-GUICHET.md).

La refonte du 18 novembre 2026 couvre quatre chantiers. Accès Agent en un clic et Administrateur par mot de passe. Annuaire paginé et recherches par nom, carte ou titre de boîte. Calendrier principal commun aux trois activités. Administration simplifiée et règles d’animation alignées entre la démonstration et Supabase. Animations propose une inscription rapide chronologique. Les modèles se gèrent dans Administration → Animations, avec un droit distinct délégable depuis Accès des agents ; les séances existantes ne changent pas avec leur modèle.

Ludion utilise le projet Supabase à Paris. La démonstration autonome reste disponible pour les essais locaux. Les secrets restent hors Git.

Pour publier la refonte, suivre l’ordre de mise en ligne dans [le guide de développement](DEVELOPPEMENT.md). Le changement de règles serveur et la préparation des deux profils précèdent la recette connectée et la publication des pages.

Après modification de `dev/app.js`, `dev/app.css`, `dev/demo.js` ou du gabarit `templates/guichet.html`, exécuter `npm run build`. Les scripts reconstruisent les pages et les empreintes CSP. Le schéma et ses changements figurent dans `supabase/migrations/`.

Les essais utilisent exclusivement des données fictives. Avant usage réel, faire la recette sur le matériel et le réseau du guichet, tester la restauration et compléter le [dossier d’exploitation](EXPLOITATION.md).

Les liens vers GitHub et les documents du projet ont été retirés des pages du guichet. La documentation reste dans le dépôt. Pour un changement limité aux textes, liens ou styles, reconstruire les pages et vérifier le résultat ciblé ; la suite métier complète reste pertinente pour une modification des règles ou des transactions.

## Publication sur GitHub Pages

- Ludion : https://upsylon3.github.io/guichet-mediatheque/
- Autre adresse du même guichet : https://upsylon3.github.io/guichet-mediatheque/dev/

Après modification des sources, lancer `npm run build`, vérifier le changement puis inclure les pages générées dans le commit. Une fusion dans `main` lance le workflow Vérification et publication du guichet : reconstruction, contrôles de la démonstration, préparation des fichiers publics et déploiement du guichet connecté aux deux adresses. Les liens restent les mêmes après chaque déploiement réussi. Attendre la fin du job publication, puis recharger la page pour utiliser la nouvelle version. Un rechargement déconnecte et peut perdre un brouillon.

`scripts/prepare-pages.py` copie une liste explicite de fichiers dans `_site/`. Ni les documents du projet, ni les comptes de test, ni les fichiers privés ne font partie du site publié. Le dépôt GitHub reste public. Les données du guichet partagé restent dans sa base distante ; la démonstration autonome reste sans connexion applicative. Les anciens liens Githack ne sont plus les adresses de référence.

Les participations sont conservées pendant 30 jours glissants, avec leurs corbeilles et références de reprise. La recherche par carte et les listes permettent de consulter les activités récentes ; le planning JV Aujourd’hui reste limité au jour actuel. Les statistiques anonymes sont actualisées quotidiennement sans doublons et conservées au-delà. Les fiches usagers et réservations futures ne sont pas effacées par cette purge. Les détails déjà supprimés avant ce changement ne peuvent pas être reconstitués.

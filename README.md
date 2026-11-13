# Guichet médiathèque

Une carte commune pour les consultations de jeux de société, les créneaux de jeux vidéo et les inscriptions aux animations.

**[Lire le cahier des charges](CAHIER-DES-CHARGES.md)** · **[Ouvrir la démonstration](https://raw.githack.com/Upsylon3/guichet-mediatheque/main/index.html)**

**[Dossier de revue pour la collectivité](REVUE-COLLECTIVITE.md)** · **[Droits et composants](DROITS.md)**

### Tester seul les trois parcours

1. En **Jeux de société**, enregistrer une consultation en Jeunesse avec la carte fictive `ESSAI-01` sans saisir de nom. Après validation, compléter la carte dans **Fiches à compléter**, ou passer directement à la personne suivante.
2. En **Jeux vidéo**, cliquer sur **Inscrire**, choisir le jeu et ressaisir cette carte. Si la fiche a été complétée, son nom apparaît. Enchaîner avec une deuxième carte sur le même créneau.
3. Choisir le profil de démonstration **Administrateur**. En **Animations**, cliquer sur une date, créer une séance et y inscrire la première carte. Rouvrir la fiche pour modifier la séance ou retirer une inscription.

La démonstration accepte des cartes fictives préfixées par ESSAI-. Les fiches, activités et totaux restent en mémoire et disparaissent au rechargement. Les réglages de démonstration seuls sont enregistrés sur ce navigateur. Les jeux et les horaires proposés servent aux essais. La recherche par carte couvre les trois activités. Le sélecteur de profil sert à comparer les commandes dans une session fictive. Utiliser uniquement des données fictives dans cette page publique.

### Travailler depuis chez soi

Cloner le dépôt et ouvrir `index.html` dans un navigateur récent. Pour servir la page en local, lancer `python -m http.server 8000` dans ce dossier, puis ouvrir `http://localhost:8000`. Aucun composant à installer pour la page elle-même.

Modifier le cahier des charges en Markdown, puis enregistrer les changements dans Git. Conserver les fichiers métier et les exports nominatifs sur l’infrastructure interne.

### Base de développement Supabase

L’[entrée de développement](DEVELOPPEMENT.md) raccorde l’annuaire à une base Supabase distante, sans Docker ni virtualisation. Elle utilise l’interface existante et deux comptes fictifs attribués par le service. La page publique `index.html` reste autonome, sans connexion applicative, avec ses cartes ESSAI.

Après création du fichier local `.env.local.json` décrit dans le guide, lancer `python scripts/serve-dev.py`, puis ouvrir `http://127.0.0.1:8000/dev.html`. L’annuaire se synchronise automatiquement toutes les deux secondes. Les cartes de développement sont des chaînes de sept chiffres, zéros initiaux compris. Agent et Administrateur peuvent créer et compléter une fiche ; seul l’Administrateur peut la supprimer, avec contrôle côté serveur. Les notes ne sont chargées qu’à l’ouverture d’une fiche détaillée.

Les migrations restent compatibles avec Supabase local si Docker est disponible : `supabase start`, puis, uniquement sur une **base locale jetable**, `supabase db reset`. Les activités et les réglages restent propres à la session ou au navigateur ; leur partage, les réservations atomiques et la clôture serveur sont les étapes suivantes. Le serveur interne reste prévu pour l’exploitation. Voir la [recette exécutée](RECETTE-ANNUAIRE.md).

GitHub Pages peut servir les fichiers statiques du dépôt. L’activation se fait dans les paramètres Pages, branche `main`, dossier racine. La prévisualisation en tête de page fonctionne également sans cette activation. [Documentation GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) · [Documentation Supabase locale](https://supabase.com/docs/guides/local-development/cli/getting-started)


### Annuaire et administration

**Usagers** ouvre la recherche par nom ou carte et la création de fiche. Après un passage, **Fiches à compléter** propose le prénom, le nom et la date de naissance. La note se trouve dans la fiche de l’annuaire. Le profil Administrateur dispose également du bouton **Administration** pour configurer les postes, jeux, capacités, horaires, valeurs par défaut des animations et délégation de leur gestion. Les modifications de réglages s’appliquent aux formulaires de ce navigateur. La suppression des usagers est réservée aux administrateurs.

Les totaux du tableau d’administration comptent les personnes déclarées en jeux de société et les places ou personnes inscrites aux autres activités, accompagnateurs compris. Les données de présence effective ne sont pas mesurées. Les réglages partagés entre postes et la clôture serveur des activités seront à raccorder avec les tables métier.

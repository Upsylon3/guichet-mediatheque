# Guichet médiathèque

Une carte commune pour les consultations de jeux de société, les créneaux de jeux vidéo et les inscriptions aux animations.

**[Lire le cahier des charges](CAHIER-DES-CHARGES.md)** · **[Ouvrir la démonstration](https://raw.githack.com/Upsylon3/guichet-mediatheque/main/index.html)**

**[Dossier de revue pour la collectivité](REVUE-COLLECTIVITE.md)** · **[Droits et composants](DROITS.md)**

### Tester seul les trois parcours

1. En **Jeux de société**, enregistrer une consultation en Jeunesse avec la carte fictive `ESSAI-01` sans saisir de nom. Après validation, compléter la carte dans **Fiches à compléter**, ou passer directement à la personne suivante.
2. En **Jeux vidéo**, cliquer sur **Inscrire**, choisir le jeu et ressaisir cette carte. Si la fiche a été complétée, son nom apparaît. Enchaîner avec une deuxième carte sur le même créneau.
3. Choisir le profil de démonstration **Administrateur**. En **Animations**, cliquer sur une date, créer une séance et y inscrire la première carte. Rouvrir la fiche pour modifier la séance ou retirer une inscription.

La démonstration accepte des cartes fictives préfixées par ESSAI-. Les saisies restent en mémoire et disparaissent au rechargement. Les jeux et les horaires proposés servent aux essais. La recherche par carte couvre les trois activités. Le sélecteur de profil sert à comparer les commandes dans une session fictive. Utiliser uniquement des données fictives dans cette page publique.

### Travailler depuis chez soi

Cloner le dépôt et ouvrir `index.html` dans un navigateur récent. Pour servir la page en local, lancer `python -m http.server 8000` dans ce dossier, puis ouvrir `http://localhost:8000`. Aucun composant à installer pour la page elle-même.

Modifier le cahier des charges en Markdown, puis enregistrer les changements dans Git. Conserver les fichiers métier et les exports nominatifs sur l’infrastructure interne.

### Base de développement Supabase

Le dossier `supabase/` prépare un environnement local reproductible. Installer Docker et la CLI Supabase, puis lancer `supabase start` à la racine du dépôt. Sur une **base locale jetable**, `supabase db reset` rejoue les migrations et efface les essais précédents. Créer deux comptes fictifs depuis le module d’authentification de Studio local, puis leur attribuer les profils dans `guichet_prive.habilitations` via l’éditeur SQL, avec l’identifiant du compte créé. L’inscription publique est désactivée. Toute attribution de droits s’effectue côté serveur.

La première migration fournit les cartes, les postes et leurs politiques d’accès. Un compte sans habilitation n’a aucun accès aux données. Un agent peut compléter une fiche et lire les postes. Un administrateur peut aussi gérer les postes et supprimer une fiche. Les tables d’activité, les transactions de réservation et le raccordement de l’interface restent à réaliser. La page publique autonome utilise des données en mémoire. Les essais de base locale emploient exclusivement des identités inventées. Le serveur interne est prévu pour l’exploitation.

GitHub Pages peut servir les fichiers statiques du dépôt. L’activation se fait dans les paramètres Pages, branche `main`, dossier racine. La prévisualisation en tête de page fonctionne également sans cette activation. [Documentation GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages) · [Documentation Supabase locale](https://supabase.com/docs/guides/local-development/cli/getting-started)

# Guide du guichet partagé

## Accès

Ouvrir le guichet partagé publié depuis le README et se connecter avec un compte attribué par le service. Les mots de passe d’exemple figurent uniquement dans le document d’accès privé. L’inscription publique est désactivée. L’hébergeur peut demander de cliquer sur « Open the page ».

Lancement local : `python scripts/serve-dev.py --config dev/config.json`, puis `http://127.0.0.1:8000/dev.html`. Le serveur écoute seulement sur 127.0.0.1 et ne sert aucun fichier privé. Python 3.10+ suffit pour l’interface. Les comptes et réglages de test se trouvent dans `.env.accounts.json` et `.env.local.json`, ignorés par Git. La configuration publiée contient seulement une URL et une clé publique publishable, sans secret d’administration.

## Prise de poste

Vérifier le profil et le message de synchronisation. Le menu latéral ouvre les activités et Usagers. Administration et Statistiques apparaissent uniquement pour les administrateurs. Le bouton Mode sombre mémorise le choix de ce navigateur. Les données confirmées restent dans la base commune, les brouillons restent dans la page. Recharger déconnecte et peut perdre un brouillon.

## Parcours de service

Jeux de société : choisir le secteur, scanner carte et boîte, saisir enfants/adultes et enregistrer. La date du jour est proposée. Le secteur reste mémorisé. Une consultation peut comprendre les personnes avec lesquelles le titulaire partage le jeu.

Jeux vidéo : consulter le planning Aujourd’hui, puis Inscrire. Choisir poste, date, créneau et jeu. Chaque personne dispose de sa carte, sans accompagnateur. Ajouter un joueur pour une autre carte. Une même fiche ne réserve qu’une fois par semaine du lundi au dimanche. Une annulation libère son quota. Un déplacement conserve sa réservation. Le premier inscrit choisit le jeu, les suivants le rejoignent. Le formulaire propose le créneau actuel ou le prochain. Le planning expose jeu, noms/cartes et places par poste et horaire.

Animations : ouvrir une date puis une séance. Pour créer une séance, renseigner titre, salle Créazone ou Salle JV, date et deux horaires. Une salle ne reçoit jamais deux séances simultanées. Chaque participant a sa carte. Pour une séance sans jauge uniquement, renseigner les noms des accompagnateurs sans carte, un par ligne. Les jauges imposent une carte à chaque personne. Au-delà de J+15 inclus, les agents doivent confirmer l’avertissement avant une inscription anticipée. Les jours concernés sont grisés et portent J+15. Aucun champ séparé d’ouverture des inscriptions.

Usagers : rechercher par carte ou nom. Ouvrir la bonne fiche, vérifier l’identité et choisir Changer le numéro de carte en cas de perte. La nouvelle carte conserve la même fiche et toutes ses inscriptions. Un numéro déjà utilisé demande une fusion administrative. Les agents ne suppriment jamais une fiche. Les administrateurs ne peuvent pas supprimer une fiche encore liée aux activités ou à la corbeille.

Ctrl+Z annule la dernière opération prise en charge hors des champs de saisie. Dans un champ, l’annulation de texte du navigateur reste disponible. La corbeille est partagée et ses restaurations revérifient toutes les règles.

## Administration

Les grilles suivent la priorité habituelle, jour de semaine, exception datée. Fermer un poste déjà réservé exige une confirmation avec le nombre de réservations à retirer. L’opération les place dans la corbeille et ferme le poste ensemble. Une restauration attend sa réouverture. Les incompatibilités de capacité ou d’horaires restent bloquantes.

Statistiques : période, regroupement par jour/semaine/mois et filtres d’activité, secteur, poste, jeu, boîte, salle, type et catégorie. L’export des indicateurs est anonyme. Les anciens totaux ont moins de détail. Les effectifs représentent des déclarations ou inscriptions, pas une présence contrôlée.

Imports, exports nominatifs et corrections en lot sont administratifs. Collage tabulé, sans en-tête : société = carte, boîte, enfants, adultes, date, secteur ; JV = carte, date, poste, heure de début, jeu ; participant = carte, âge facultatif, unité ans/mois, catégorie Enfant/Adulte. Vérifier l’aperçu avant la transaction complète. Dans un tableur, importer les cartes comme texte.

Pour créer un compte du personnel, créer d’abord le compte dans Authentication du projet, puis utiliser Administration / Gérer les habilitations. Un compte Auth sans habilitation ne donne aucun accès. Le dernier administrateur est protégé. Les droits ne proviennent jamais d’un sélecteur client ou de métadonnées modifiables par le titulaire.

## Construction et tests

`templates/guichet.html` porte la structure commune. `dev/app.js` et `dev/app.css` portent les parcours. `dev/directory.js` appelle le serveur partagé, `dev/demo.js` fournit les données en mémoire de la démonstration. `npm run build` construit `index.html` et `dev/index.html` et recalcule la CSP autonome. Ne pas modifier directement ces sorties construites.

`npm ci`, `npx playwright install chromium`, puis `npm test`. Les tests démarrent leur serveur sur un port libre. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` choisit un Chromium existant. La CI exécute seulement la recette autonome, sans secrets. Les tests connectés créent et retirent leurs données fictives et consignent les identifiants dans `.env.test-cleanup.json` pour nettoyage privilégié ciblé.

Les migrations sont appliquées dans l’ordre de leurs noms et ne doivent pas être rejouées sur la base déjà configurée. Les tables privées n’ont aucun accès direct côté navigateur. Les façades publiques contrôlent l’identité et les habilitations et appellent les fonctions privées. Les mutations partagent un verrou transactionnel, leurs révisions et des identifiants de tentative contre les doublons.

La clôture Europe/Paris conserve les agrégats anonymes puis purge les anciennes participations. Seul le quota minimal de la semaine JV demeure jusqu’au lundi suivant pour préserver la règle sans garder le jeu ni l’horaire. Il suit l’UUID de fiche, y compris lors d’un changement de carte. `supabase/tests/cloture.sql` vérifie les totaux, la purge, le quota et sa disparition, dans une transaction annulée.

La démonstration autonome ne contacte aucun service et ses données de passage disparaissent au rechargement. Elle ne remplace pas une validation des protections du serveur partagé. Avant exploitation réelle : validation institutionnelle, matériel, douchette, accessibilité complète, sauvegarde et restauration sur l’infrastructure autorisée.


## Administration organisée

Les réglages se répartissent en cinq rubriques : Postes JV, Animations, Jeux de société, Accès des agents et Liens du service. Une seule rubrique apparaît à la fois et son bouton enregistre uniquement ses paramètres. Les exceptions datées et les fermetures restent repliées par défaut. Les brouillons non enregistrés déclenchent un avertissement avant un changement de rubrique ou de poste. Le catalogue de boîtes permet de choisir une boîte existante ou d’en ajouter une.

Pour renommer un poste : Administration / Postes JV, sélectionner le poste, modifier Nom du poste puis enregistrer. Les réglages habituels, variantes hebdomadaires, exceptions et réservations actives ou en corbeille suivent le nouveau nom dans une transaction unique. Un nom déjà utilisé, une révision obsolète ou une modification incompatible est refusé sans renommage partiel. Les statistiques historiques conservent le libellé de leur date.

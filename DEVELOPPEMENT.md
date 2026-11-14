# Guide du guichet partagé

## Accès

Ouvrir le guichet partagé publié depuis le README et se connecter avec un compte attribué par le service. Les mots de passe d’exemple figurent uniquement dans le document d’accès privé. L’inscription publique est désactivée. Les deux versions sont publiées sur GitHub Pages : la démonstration à la racine et le guichet partagé sous `/dev/`.

Lancement local : `python scripts/serve-dev.py --config dev/config.json`, puis `http://127.0.0.1:8000/dev.html`. Le serveur écoute seulement sur 127.0.0.1 et ne sert aucun fichier privé. Python 3.10+ suffit pour l’interface. Les comptes et réglages de test se trouvent dans `.env.accounts.json` et `.env.local.json`, ignorés par Git. La configuration publiée contient seulement une URL et une clé publique publishable, sans secret d’administration.

## Prise de poste

Vérifier le profil et le message de synchronisation. Le menu latéral ouvre les activités et Usagers. Statistiques reste réservée aux administrateurs. Administration présente tous les réglages aux administrateurs ; un agent disposant du droit Gérer les modèles d’animations y accède uniquement à la gestion des modèles. Le bouton Mode sombre mémorise le choix de ce navigateur. Les données confirmées restent dans la base commune, les brouillons restent dans la page. Recharger déconnecte et peut perdre un brouillon.

## Parcours de service

Jeux de société : choisir le secteur, scanner carte et boîte, saisir enfants/adultes et enregistrer. La date du jour est proposée. Le secteur reste mémorisé. Une consultation peut comprendre les personnes avec lesquelles le titulaire partage le jeu.

Jeux vidéo : consulter le planning Aujourd’hui, puis Inscrire. Choisir poste, date, créneau et jeu. Chaque personne dispose de sa carte, sans accompagnateur. Ajouter un joueur pour une autre carte. Une même fiche ne réserve qu’une fois par semaine du lundi au dimanche. Une annulation libère son quota. Un déplacement conserve sa réservation. Le premier inscrit choisit le jeu, les suivants le rejoignent. Le formulaire propose le créneau actuel ou le prochain. Le planning expose jeu, noms/cartes et places par poste et horaire.

Animations : cliquer sur Inscrire pour choisir une séance dans la liste chronologique (date, heure, salle et places disponibles), puis saisir les cartes et informations des participants. Les séances complètes sont grisées. Le calendrier permet aussi d’ouvrir une date puis une séance ; les séances en entrée libre s’y gèrent par comptage. Pour créer une séance, renseigner titre, salle Créazone ou Salle JV, date et deux horaires. Une salle ne reçoit jamais deux séances simultanées. Chaque participant a sa carte. Pour une séance sans jauge uniquement, renseigner les noms des accompagnateurs sans carte, un par ligne. Les jauges imposent une carte à chaque personne. Au-delà des quinze prochains jours (J+15 reste inclus dans le délai normal), les agents doivent confirmer l’avertissement avant une inscription anticipée. Les jours après J+15 sont grisés et annoncent la confirmation nécessaire. Aucun champ séparé d’ouverture des inscriptions.

Usagers : rechercher par carte ou nom. Ouvrir la bonne fiche, vérifier l’identité et choisir Changer le numéro de carte en cas de perte. La nouvelle carte conserve la même fiche et toutes ses inscriptions. Un numéro déjà utilisé demande une fusion administrative. Les agents ne suppriment jamais une fiche. Les administrateurs ne peuvent pas supprimer une fiche encore liée aux activités ou à la corbeille.

Ctrl+Z annule la dernière opération prise en charge hors des champs de saisie. Dans un champ, l’annulation de texte du navigateur reste disponible. La corbeille est partagée et ses restaurations revérifient toutes les règles.


Lorsqu’une inscription JV est refusée à cause de la limite hebdomadaire, le message identifie la carte concernée et rappelle le jour de la semaine, la date, les heures de début et de fin et le poste de sa réservation existante. Il utilise les informations actuelles après un déplacement ou un changement de carte. Pour une inscription passée dont le détail a déjà été purgé à la clôture quotidienne, le refus précise que ce détail n’est plus disponible ; le quota reste appliqué sans conserver davantage d’historique.

## Administration

Les grilles suivent la priorité habituelle, jour de semaine, exception datée. Fermer un poste déjà réservé exige une confirmation avec le nombre de réservations à retirer. L’opération les place dans la corbeille et ferme le poste ensemble. Une restauration attend sa réouverture. Les incompatibilités de capacité ou d’horaires restent bloquantes.

Statistiques : période, regroupement par jour/semaine/mois et filtres d’activité, secteur, poste, jeu, boîte, salle, type et catégorie. Les indicateurs sont anonymes. Les anciens totaux ont moins de détail. Les effectifs représentent des déclarations ou inscriptions, pas une présence contrôlée.


Pour créer un compte du personnel, créer d’abord le compte dans Authentication du projet, puis utiliser Administration → Accès des agents → Gérer les habilitations. Un compte Auth sans habilitation ne donne aucun accès. Le dernier administrateur est protégé. Les droits ne proviennent jamais d’un sélecteur client ou de métadonnées modifiables par le titulaire.

## Construction et tests

`templates/guichet.html` porte la structure commune. `dev/app.js` et `dev/app.css` portent les parcours. `dev/directory.js` appelle le serveur partagé, `dev/demo.js` fournit les données en mémoire de la démonstration. `npm run build` construit `index.html` et `dev/index.html` et recalcule la CSP autonome. Ne pas modifier directement ces sorties construites.

`npm ci`, `npx playwright install chromium`, puis `npm test`. Les tests démarrent leur serveur sur un port libre. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` choisit un Chromium existant. La CI exécute seulement la recette autonome, sans secrets. Les tests connectés créent et retirent leurs données fictives et consignent les identifiants dans `.env.test-cleanup.json` pour nettoyage privilégié ciblé.

Les migrations sont appliquées dans l’ordre de leurs noms et ne doivent pas être rejouées sur la base déjà configurée. Les tables privées n’ont aucun accès direct côté navigateur. Les façades publiques contrôlent l’identité et les habilitations et appellent les fonctions privées. Les mutations partagent un verrou transactionnel, leurs révisions et des identifiants de tentative contre les doublons.

La clôture Europe/Paris conserve les agrégats anonymes puis purge les anciennes participations. Seul le quota minimal de la semaine JV demeure jusqu’au lundi suivant pour préserver la règle sans garder le jeu ni l’horaire. Il suit l’UUID de fiche, y compris lors d’un changement de carte. `supabase/tests/cloture.sql` vérifie les totaux, la purge, le quota et sa disparition, dans une transaction annulée.

La démonstration autonome ne contacte aucun service et ses données de passage disparaissent au rechargement. Elle ne remplace pas une validation des protections du serveur partagé. Avant exploitation réelle : validation institutionnelle, matériel, douchette, accessibilité complète, sauvegarde et restauration sur l’infrastructure autorisée.


## Administration organisée

Les réglages se répartissent en cinq rubriques : Postes JV, Animations, Jeux de société, Accès des agents et Liens du service. Une seule rubrique apparaît à la fois et son bouton enregistre uniquement ses paramètres. Les exceptions datées et les fermetures restent repliées par défaut. Les brouillons non enregistrés déclenchent un avertissement avant un changement de rubrique ou de poste. Le catalogue de boîtes permet de choisir une boîte existante ou d’en ajouter une.

Pour renommer un poste : Administration / Postes JV, sélectionner le poste, modifier Nom du poste puis enregistrer. Les réglages habituels, variantes hebdomadaires, exceptions et réservations actives ou en corbeille suivent le nouveau nom dans une transaction unique. Un nom déjà utilisé, une révision obsolète ou une modification incompatible est refusé sans renommage partiel. Les statistiques historiques conservent le libellé de leur date.


## Essais et modèles

L’interface ne propose ni import par collage ni export nominatif, ni raccourci Sélections du réseau. L’extraction CSV se trouve uniquement dans Statistiques. En JV, le filtre et le déplacement de sélection apparaissent uniquement dans Toutes les réservations. Le planning Aujourd’hui permet de retirer directement une réservation, après confirmation et selon les droits.

Dans une nouvelle animation, Partir d’un modèle remplit les paramètres. La création, la modification, le renommage et la suppression des modèles se trouvent dans Administration → Animations. Ces actions sont administratives par défaut. Dans Accès des agents, le droit Gérer les modèles d’animations peut être délégué aux agents réguliers, indépendamment de la gestion des séances. Cette délégation ouvre uniquement la gestion des modèles, sans les autres paramètres ni les statistiques. Comme les autres délégations actuelles, elle s’applique au groupe des agents. Modifier ou supprimer un modèle ne modifie pas les séances existantes. Date, récurrence et inscrits ne sont pas copiés dans le modèle. Le type est un classement facultatif pour les listes et statistiques.

La démonstration autonome se recharge avec une journée fictive déjà remplie. Ses modifications de passage restent en mémoire. Pour préparer aussi la base partagée, lancer `npm run seed:demo` avec le compte administrateur fictif local configuré. Ce script est limité au projet de développement connu et conserve les données existantes. Il fournit 120 fiches fictives, des consultations, des réservations JV, des animations du jour et à J+7/J+16 ainsi que trois modèles. Une seconde exécution le même jour évite les doublons. En cas de conflit de salle, la séance fictive concernée est ignorée. Les données fictives sont repérables par Démo ou DÉMO.

## Inscription rapide et extraction statistique

Dans Animations, le bouton Inscrire ouvre un formulaire avec une liste de séances sur inscription classées par date et heure. La liste indique titre, salle et places restantes ; les séances complètes sont grisées. Les séances en entrée libre restent accessibles par le calendrier pour leur comptage. La saisie des cartes, catégories et âges, les accompagnateurs nommés sans jauge, la confirmation après J+15, la validation transactionnelle et Ctrl+Z suivent les mêmes règles que l’inscription depuis une séance. Les cartes saisies sont conservées lors d’un changement de séance. Une identité nouvelle se complète après l’inscription.

Dans Statistiques, Extraire les statistiques (CSV) télécharge les agrégats de la période, des filtres et du regroupement choisis. Le fichier est séparé par des points-virgules, encodé en UTF-8 pour les tableurs et ne contient ni carte ni identité. Les agents, même autorisés à gérer les modèles, ne peuvent pas accéder aux statistiques.

## Documentation et liens de l’interface

Le guichet ne comporte aucun lien vers le dépôt GitHub ou la documentation du projet. Consulter les documents depuis le dépôt ou les fichiers remis au service. Les raccourcis métier Catalogue et V-smart se règlent dans Administration → Liens du service.

## Publication sur GitHub Pages

- Démonstration autonome : https://upsylon3.github.io/guichet-mediatheque/
- Guichet partagé avec connexion : https://upsylon3.github.io/guichet-mediatheque/dev/

Après modification des sources, lancer `npm run build`, vérifier le changement puis inclure les pages générées dans le commit. Une fusion dans `main` lance le workflow Vérification et publication du guichet : reconstruction, contrôles de la démonstration, préparation des fichiers publics et déploiement des deux versions ensemble. Les liens restent les mêmes après chaque déploiement réussi. Attendre la fin du job publication, puis recharger la page pour utiliser la nouvelle version. Un rechargement déconnecte et peut perdre un brouillon.

`scripts/prepare-pages.py` copie une liste explicite de fichiers dans `_site/`. Ni les documents du projet, ni les comptes de test, ni les fichiers privés ne font partie du site publié. Le dépôt GitHub reste public. Les données du guichet partagé restent dans sa base distante ; la démonstration autonome reste sans connexion applicative. Les anciens liens Githack ne sont plus les adresses de référence.

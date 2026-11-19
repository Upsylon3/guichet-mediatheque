# Guide du guichet partagé

## Accès

Ludion propose Agent en un clic sur les navigateurs activés et Administrateur par mot de passe. La page d’ouverture et le guichet partagent le réglage de thème, initialisé selon la préférence système.

Lancement local : `python scripts/serve-dev.py --config dev/config.json`, puis `http://127.0.0.1:8000/dev.html`. Le serveur écoute seulement sur 127.0.0.1 et ne sert aucun fichier privé. Python 3.10+ suffit pour l’interface. Le mot de passe administrateur fictif et la configuration de test se trouvent dans `.env.accounts.json` et `.env.local.json`, ignorés par Git. La configuration publiée contient seulement une URL et une clé publique publishable, sans secret d’administration.

### Activer ou révoquer un poste Agent

1. Ouvrir Ludion dans le navigateur habituel du poste et choisir **Accès administrateur**.
2. Dans **Administration** → **Accès des agents** → **Gérer les postes agents**, nommer le poste et choisir **Activer ce navigateur**.
3. Se déconnecter, puis choisir **Entrer en tant qu’agent**. La prochaine connexion Agent se fait en un clic dans ce navigateur. Un autre profil de navigateur ou la suppression de son stockage local requiert une nouvelle activation.
4. Révoquer un poste depuis la même liste si son accès doit prendre fin. Le serveur coupe immédiatement les droits associés à la session. Le guichet ouvert se verrouille au prochain rafraîchissement.

Supabase Auth conserve le hook `guichet_prive.autoriser_session_anonyme`. Le hook refuse les inscriptions permanentes et seules les identités inscrites dans `guichet_prive.postes_agents` obtiennent le rôle Agent. Le mot de passe de l’identité technique administrateur se vérifie dans la fonction Edge existante.

Ludion masque le guichet après 15 minutes d’inactivité, à l’expiration de la session ou si le serveur retire l’accès. Une session Agent peut être rouverte en un clic sur un profil de navigateur activé. Verrouiller Windows en quittant le poste. **Se déconnecter** recharge la page et les brouillons en cours peuvent être perdus.

## Prise de poste

Vérifier le profil et le message de synchronisation. Le menu latéral ouvre les activités et Usagers. Statistiques reste réservée aux administrateurs. Administration présente tous les réglages aux administrateurs ; un agent disposant du droit Gérer les modèles d’animations y accède uniquement à la gestion des modèles. Le bouton Mode sombre mémorise le choix de ce navigateur. Les données confirmées restent dans la base commune, les brouillons restent dans la page. Recharger déconnecte et peut perdre un brouillon.

## Parcours de service

Jeux de société : choisir le secteur, scanner carte et boîte, saisir enfants/adultes et enregistrer. La date du jour est proposée. Le secteur reste mémorisé. Une consultation peut comprendre les personnes avec lesquelles le titulaire partage le jeu.

Le calendrier mensuel est la vue principale de Jeux vidéo, Jeux de société et Animations. Le jour sélectionné est commun aux trois onglets. En Jeux vidéo, sélectionner une date puis Inscrire depuis le planning ou un créneau disponible. Choisir poste, date, créneau et jeu. Chaque personne dispose de sa carte, sans accompagnateur. Ajouter un joueur pour une autre carte. Une même fiche ne réserve qu’une fois par jour. Une annulation libère son quota. Un déplacement conserve sa réservation. Le premier inscrit choisit le jeu, les suivants le rejoignent. Le formulaire propose le créneau actuel ou le prochain. Le planning expose jeu, noms/cartes et places par poste et horaire.

Animations : cliquer sur Inscrire pour choisir une séance dans la liste chronologique (date, heure, salle et places disponibles), puis saisir les cartes et informations des participants. Les séances complètes sont grisées. Le calendrier permet aussi d’ouvrir une date puis une séance ; les séances en entrée libre s’y gèrent par comptage. Pour créer une séance, renseigner titre, date et deux horaires. On peut indiquer Créazone ou Salle JV pour l’annonce. Les créneaux qui se chevauchent sont acceptés. Chaque participant inscrit fournit sa carte et son âge. Seuls les participants munis d’une carte sont enregistrés. Au-delà des quinze prochains jours (J+15 reste inclus dans le délai normal), les agents doivent confirmer l’avertissement avant une inscription anticipée. Les jours après J+15 sont grisés et annoncent la confirmation nécessaire. Aucun champ séparé d’ouverture des inscriptions.

Usagers : rechercher par carte ou nom. Après une saisie avec une fiche incomplète, une fenêtre propose de renseigner le nom, le prénom et la date de naissance. Les trois champs sont requis pour enregistrer la fiche. Plus tard ferme la fenêtre et permet de poursuivre le service. Pour reprendre la saisie, utiliser Fiches à compléter. En cas de perte, choisir Changer le numéro de carte dans la fiche. La nouvelle carte conserve la même fiche et toutes ses inscriptions. Un numéro déjà utilisé demande une fusion administrative. Les agents ne suppriment jamais une fiche. Les administrateurs ne peuvent pas supprimer une fiche encore liée aux activités ou à la corbeille.

Ctrl+Z annule la dernière opération prise en charge hors des champs de saisie. Dans un champ, l’annulation de texte du navigateur reste disponible. La corbeille est partagée et ses restaurations revérifient toutes les règles.


Lorsqu’une inscription JV est refusée à cause de la limite quotidienne, le message identifie la carte concernée et rappelle le jour de la semaine, la date, les heures de début et de fin et le poste de sa réservation existante. Il utilise les informations actuelles après un déplacement ou un changement de carte. Les inscriptions passées restent consultables pendant 30 jours, ce qui permet de rappeler aussi les réservations déjà passées dans la journée. Les données effacées avant l’activation de cette conservation ne sont pas récupérables.

## Administration

Les grilles suivent la priorité habituelle, jour de semaine, exception datée. Fermer un poste déjà réservé exige une confirmation avec le nombre de réservations à retirer. L’opération les place dans la corbeille et ferme le poste ensemble. Une restauration attend sa réouverture. Les incompatibilités de capacité ou d’horaires restent bloquantes.

Statistiques : période, regroupement par jour/semaine/mois et filtres d’activité, secteur, poste, jeu, boîte, salle, type et catégorie. Les indicateurs sont anonymes. Les anciens totaux ont moins de détail. Les effectifs représentent des déclarations ou inscriptions, pas une présence contrôlée.


Administration → Accès des agents règle les actions que toutes les sessions Agent peuvent effectuer. La gestion des modèles reste indépendante de la gestion des séances.

## Construction et tests

`templates/guichet.html` porte la structure commune. `dev/app.js` et `dev/app.css` portent les parcours. `dev/directory.js` appelle le serveur partagé, `dev/demo.js` fournit les données en mémoire de la démonstration. `npm run build` construit `index.html` et `dev/index.html` et recalcule la CSP autonome. Ne pas modifier directement ces sorties construites.

`npm ci`, `npx playwright install chromium`, puis `npm test`. Les tests démarrent leur serveur sur un port libre. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` choisit un Chromium existant. La CI exécute seulement la recette autonome, sans secrets. Les tests connectés créent et retirent leurs données fictives et consignent les identifiants dans `.env.test-cleanup.json` pour nettoyage privilégié ciblé.

Les migrations sont appliquées dans l’ordre de leurs noms et ne doivent pas être rejouées sur la base déjà configurée. Les tables privées n’ont aucun accès direct côté navigateur. Les façades publiques contrôlent l’identité et les habilitations et appellent les fonctions privées. Les mutations partagent un verrou transactionnel, leurs révisions et des identifiants de tentative contre les doublons.

La clôture Europe/Paris calcule les agrégats anonymes des journées terminées et conserve les participations nominatives pendant 30 jours glissants. À la date J, J−30 reste consultable ; seules les dates antérieures sont purgées, avec leurs corbeilles et références de reprise/fusion. Les fiches usagers et les réservations futures sont conservées. Les statistiques des journées modifiées sont remplacées, sans addition répétée, et restent disponibles après la purge. Le quota JV est quotidien et son index minimal expire au changement de jour. Il suit l’UUID de fiche, y compris lors d’un changement de carte. `supabase/tests/cloture.sql` vérifie les totaux, la purge, le quota et sa disparition, dans une transaction annulée.

La démonstration autonome ne contacte aucun service et ses données de passage disparaissent au rechargement. Elle ne remplace pas une validation des protections du serveur partagé. Avant exploitation réelle, vérifier le matériel, la douchette, l’accessibilité et la restauration sur l’infrastructure choisie. Consigner les résultats dans le [dossier d’exploitation](EXPLOITATION.md).


## Administration organisée

Quatre rubriques organisent les réglages : Postes JV, Animations, Jeux de société et Accès des agents. Chaque rubrique s’enregistre séparément. Dans Postes JV, sélectionner une console, puis choisir la grille habituelle, un jour récurrent ou une date dans le calendrier de la console. Les disponibilités et les créneaux se règlent ensemble avec des dates et des heures. Jeux et consigne ont leurs propres sections. L’usage ou nom secondaire s’affiche à côté du nom de la console. Le catalogue des boîtes permet d’ajouter ou de corriger une référence. Un changement de rubrique ou de poste avertit si un brouillon reste ouvert.

Pour renommer un poste : Administration / Postes JV, sélectionner le poste, modifier Nom du poste puis enregistrer. Les réglages habituels, variantes hebdomadaires, exceptions et réservations actives ou en corbeille suivent le nouveau nom dans une transaction unique. Un nom déjà utilisé, une révision obsolète ou une modification incompatible est refusé sans renommage partiel. Les statistiques des journées encore conservées suivent les corrections des lignes ; les archives au-delà de 30 jours restent figées.


## Essais et modèles

L’interface ne propose ni import par collage ni export nominatif, ni raccourci Sélections du réseau. L’extraction CSV se trouve uniquement dans Statistiques. En JV, le filtre et le déplacement de sélection apparaissent uniquement dans Toutes les réservations. Le planning Aujourd’hui permet de retirer directement une réservation, après confirmation et selon les droits.

Dans une nouvelle animation, Partir d’un modèle remplit les paramètres. La création, la modification, le renommage et la suppression des modèles se trouvent dans Administration → Animations. Ces actions sont administratives par défaut. Dans Accès des agents, le droit Gérer les modèles d’animations peut être délégué aux agents réguliers, indépendamment de la gestion des séances. Cette délégation ouvre uniquement la gestion des modèles, sans les autres paramètres ni les statistiques. Comme les autres délégations actuelles, elle s’applique au groupe des agents. Modifier ou supprimer un modèle ne modifie pas les séances existantes. Date, récurrence et inscrits ne sont pas copiés dans le modèle. Le type est un classement facultatif pour les listes et statistiques.

La démonstration autonome sert aux essais locaux et à la CI. `npm run seed:demo` utilise les fichiers privés de recette et exige un projet Supabase distinct du guichet publié.

## Inscription rapide et extraction statistique

Dans Animations, le bouton Inscrire ouvre un formulaire avec une liste de séances sur inscription classées par date et heure. La liste indique titre, salle et places restantes ; les séances complètes sont grisées. Les séances en entrée libre restent accessibles par le calendrier pour leur comptage. La saisie des cartes, catégories et âges, la confirmation après J+15, la validation transactionnelle et Ctrl+Z suivent les mêmes règles que l’inscription depuis une séance. Les cartes saisies sont conservées lors d’un changement de séance. Une identité nouvelle se complète après l’inscription.

Dans Statistiques, Extraire les statistiques (CSV) télécharge les agrégats de la période, des filtres et du regroupement choisis. Le fichier est séparé par des points-virgules, encodé en UTF-8 pour les tableurs et ne contient ni carte ni identité. Les agents, même autorisés à gérer les modèles, ne peuvent pas accéder aux statistiques.

## Documentation et liens de l’interface

Le guichet ne comporte aucun lien vers le dépôt GitHub ou la documentation du projet. Consulter les documents depuis le dépôt ou les fichiers remis au service. Les raccourcis Catalogue du réseau et V-smart pointent vers les adresses institutionnelles dans l’en-tête.

## Publication sur GitHub Pages

- Ludion : https://upsylon3.github.io/guichet-mediatheque/
- Autre adresse du même guichet : https://upsylon3.github.io/guichet-mediatheque/dev/

Après modification des sources, lancer `npm run build`, vérifier le changement puis inclure les pages générées dans le commit. Une fusion dans `main` lance le workflow Vérification et publication du guichet : reconstruction, contrôles de la démonstration, préparation des fichiers publics et déploiement du guichet connecté aux deux adresses. Les liens restent les mêmes après chaque déploiement réussi. Attendre la fin du job publication, puis recharger la page pour utiliser la nouvelle version. Un rechargement déconnecte et peut perdre un brouillon.

`scripts/prepare-pages.py` copie une liste explicite de fichiers dans `_site/`. Ni les documents du projet, ni les comptes de test, ni les fichiers privés ne font partie du site publié. Le dépôt GitHub reste public. Les données du guichet restent dans Supabase. La démonstration autonome sert aux essais locaux. Les anciens liens Githack ne sont plus les adresses de référence.

Les fermetures et changements de capacité des postes contrôlent les réservations du jour et futures, sans annuler les participations déjà passées. La modification des séances à venir d’une série préserve ses anciennes séances conservées dans l’historique.

## Repères pour lire le code

- `templates/guichet.html` : structure HTML et styles de base communs.
- `dev/app.js` : interface, formulaires, synchronisation et vues métier. Les contrôles d’affichage ne remplacent pas les habilitations du serveur.
- `dev/directory.js` : connexion Auth et appels HTTP au service partagé.
- `dev/demo.js` : adaptation en mémoire pour la démonstration autonome.
- `dev/sample-data.js` : préparation des données fictives communes à la démonstration et au script de peuplement.
- `scripts/` : construction, vérification CSP, serveur local et publication.
- `tests/` : recettes autonomes ou connectées, précisées en tête de fichier.
- `supabase/migrations/` : historique SQL ordonné ; les fonctions les plus récentes peuvent remplacer celles des migrations précédentes.

Les commentaires décrivent les intentions et les contraintes métier. Les fichiers `index.html` et `dev/index.html` sont générés : modifier les sources, puis lancer `npm run build`.

L’habilitation administrateur reste liée à l’UUID de l’identité Auth technique. La rotation du mot de passe s’effectue dans Authentication. Le guichet attribue uniquement le profil Agent aux sessions anonymes.

## Vider la corbeille

Dans Corbeille, un administrateur peut choisir Vider la corbeille et confirmer le nombre d’éléments. La suppression est définitive, sans Ctrl+Z ; les participants et comptages rattachés aux animations jetées sont également supprimés. Les fiches usagers et les activités actives sont conservées. Si une autre session modifie la corbeille, actualiser puis confirmer à nouveau.

Déploiement : appliquer la migration `20261114105536_vider_corbeille.sql` dans le projet Supabase avant de publier le bouton avec GitHub Pages. La publication des fichiers statiques n’applique pas les migrations SQL.

## Migration du quota JV quotidien

Appliquer `20261114162554_quota_jv_quotidien.sql` avant de publier les sources correspondantes. La migration reconstruit uniquement l’index privé des quotas depuis les réservations actives, sans supprimer les réservations, les fiches ou l’historique. Le quota est une inscription active par fiche et par date Europe/Paris, tous postes confondus ; annuler libère la date. L’UUID reste la référence après changement de carte ou fusion.

Le bloc SQL est atomique et peut être rejoué : une installation complète est reconnue sans nouvelle modification. Une erreur avant validation annule toutes ses modifications. Revenir ensuite à une limite hebdomadaire exige de vérifier les réservations de plusieurs dates dans une même semaine : ne pas supprimer ces réservations pour forcer un retour arrière.

Vérification : `supabase/tests/quota_jv_quotidien.sql` contrôle les refus du même jour, l’autorisation de deux dates dans une même semaine, les déplacements, annulations/restaurations, changements de carte, fusions et expiration.

## Horaires JV du classeur et vacances scolaires

Voir [HORAIRES-JV.md](HORAIRES-JV.md) pour les horaires exacts, la corrélation avec la Zone C et la procédure d’actualisation. `dev/video-schedule.json` est la source de construction de la démonstration ; la migration des horaires reporte une copie figée dans les réglages partagés. Les refus restent imposés côté serveur, même par appel direct hors interface.

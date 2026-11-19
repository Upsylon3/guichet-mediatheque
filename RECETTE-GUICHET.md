# Recette du guichet médiathèque

Recette du 14 novembre 2026 sur le projet distant fictif, complétée par les vérifications locales de la refonte du 18 novembre.

## Contrôles métier dans la base

`tests/metiers.test.cjs` couvre les habilitations, le quota quotidien JV, les déplacements, l’idempotence et le changement de carte. Les scénarios de la refonte couvrent aussi la salle facultative, les séances simultanées, la carte et l’âge par participant, la dernière place et la confirmation après J+15.

## Deux sessions isolées et interface

`tests/interface.test.cjs` ouvre deux contextes séparés : administrateur sur bureau et agent à 360 px. Une fiche créée par l’agent apparaît dans l’autre session. La recherche par nom la retrouve, l’agent ne peut pas la supprimer et la suppression administrative se propage. Le scénario couvre aussi le planning, Ctrl+Z, le mode sombre, la confirmation après J+15, l’heure de fin obligatoire, le CSV statistique et la fermeture forcée.

## Démonstration locale

`tests/demo.test.cjs` vérifie les trois activités, la fiche facultative, les cartes ESSAI, le profil simulé, la perte des activités après rechargement, l’absence de requête distante, le format à 360 px et la séparation de la connexion partagée. La CI exécute ces tests sans mot de passe.

## Clôture et quota

`supabase/tests/cloture.sql`, exécuté dans une transaction annulée, vérifie la purge des anciens liens et journaux, la conservation des fiches et réservations futures, les totaux exacts, le rejeu sans doublon, l’absence d’identité dans les statistiques, le maintien des détails JV après minuit, les limites J−30/J−31 et l’expiration des anciens quotas quotidiens.

## Limites de la recette

Deux contextes de navigateur ne remplacent pas les deux ordinateurs physiques du guichet. La douchette réelle, la latence représentative, l’accessibilité complète et la restauration d’exploitation restent à vérifier. La base de développement n’accueille aucune donnée réelle.


## Administration organisée et renommage

`tests/administration.test.cjs` couvre les quatre rubriques, les sauvegardes indépendantes, le catalogue de boîtes, l’avertissement de brouillon, le mode sombre à 360 px et le renommage transactionnel. Une seconde session reçoit le nouveau nom. Réservations, corbeille, grilles, exceptions et quota suivent le poste.


## Dernières finitions

`tests/finitions.test.cjs` vérifie la cohérence des cartes et salles du jeu fictif, le retrait direct d’une réservation depuis Aujourd’hui avec refus puis accord, le masquage des outils de sélection dans ce planning et leur activation dans la liste, l’absence d’exports nominatifs et du lien Sélections, l’extraction CSV statistique, et l’enregistrement d’un modèle depuis Administration → Animations sans créer une séance. Le modèle est aussi testé dans l’application partagée depuis une autre session.

`tests/modeles.test.cjs` vérifie le refus serveur par défaut, la délégation et sa révocation depuis Accès des agents, la visibilité limitée à la gestion des modèles dans une seconde session à 360 px, la création, la modification et la suppression propagées, les conflits de révision et les paramètres invalides. Les autres réglages, les séances existantes et le refus de statistiques aux agents sont vérifiés.

`tests/finitions.test.cjs` vérifie aussi l’inscription rapide chronologique, les séances complètes grisées, l’âge obligatoire en l’absence de jauge et le refus puis l’accord explicite après J+15.

Le refus du quota quotidien JV est vérifié dans `tests/metiers.test.cjs` (carte, date, horaire, poste et mise à jour après déplacement et remplacement de carte) et `tests/finitions.test.cjs` (message affiché, brouillon préservé et absence de nouvelle réservation). `supabase/tests/cloture.sql` vérifie que le détail de la réservation reste disponible après minuit pendant sa période de conservation.

La recette SQL contrôle aussi les corrections de dimensions et d’effectifs, l’annulation et la restauration après agrégation, le départ de la dernière ligne d’une journée, les archives antérieures à la migration et le rejeu après suppression physique. Les tests sont entièrement annulés avec ROLLBACK.

## Refonte du 18 novembre 2026

- Construction et CSP vérifiées sous Node 22. Neuf scénarios navigateur et trois tests Python passent. Les scénarios incluent la navigation entre calendriers, la troncature des cartes à sept chiffres, le passage au nom dans une nouvelle fiche et les accès Agent et Administrateur avec des réponses simulées.
- Sur Chromium, un créneau exceptionnel saisi au moyen des champs horaires est apparu dans le calendrier et a été proposé à l’inscription. Contrôle visuel sur bureau et à 360 px.
- Toutes les migrations et les cinq recettes SQL passent dans PostgreSQL embarqué avec Auth et Cron simulés. `supabase/tests/simplification_guichet.sql` vérifie le profil Agent des sessions anonymes, le refus des statistiques, les séances simultanées, le modèle sans salle, l’âge obligatoire et le rejet des accompagnateurs.
- La migration de refonte a été appliquée au projet fictif et `simplification_guichet.sql` y passe dans une transaction annulée. La fonction de connexion administrateur déployée renvoie 401 pour un mot de passe incorrect. La session anonyme reçoit le profil Agent et charge l’état partagé. Les statistiques et la création d’un compte permanent sont refusées avec un statut 403. L’ouverture de session avec le mot de passe privé et la recette à deux sessions restent à confirmer.

## Mise en service de Ludion le 19 novembre 2026

La recette SQL du projet Supabase a vérifié l’activation d’un poste, le refus de la gestion des postes par Agent et le refus de lecture après révocation. Le paquet GitHub Pages contient uniquement le guichet connecté. La recette navigateur couvre le thème sombre de l’entrée, l’activation d’un navigateur et le retour en Agent après rechargement.

Les 120 fiches et les 100 activités d’essai ont été archivées dans `guichet_prive.archive_essais_avant_ludion`. Les consultations, réservations, inscriptions, statistiques et corbeilles repartent vides. Les réglages des postes, les horaires et les boîtes de service sont repris. Les noms de jeux vidéo fournis en exemple ont été retirés. Les essais connectés qui écrivent des données exigent un projet de recette distinct.

## Confidentialité et exploitation

- Neuf scénarios navigateur et trois tests de calendrier passent. La simulation d’une session inactive ou expirée vérifie que l’annuaire et les dialogues personnels disparaissent de l’écran.
- L’audit Supabase confirme la sécurité par ligne sur les tables métier et l’absence de lecture directe par les rôles clients sur le schéma privé. Les avertissements concernant les sessions anonymes couvrent aussi les sessions Agent autorisées, lues après validation du poste.
- Les cinq recettes SQL passent sur PostgreSQL embarqué. Une base fictive a été sauvegardée et restaurée dans une instance isolée, avec vérification d’une fiche et des droits. La restauration sur l’hébergement du service reste à effectuer. La liste de sauvegardes physiques Supabase est vide.
- Les alertes de dépendances et le canal de signalement privé sont activés sur GitHub. `npm audit` signale zéro vulnérabilité au moment du contrôle.

## Sauvegarde des inscriptions et événements

Le 19 novembre 2026, le compte de sauvegarde a créé une copie chiffrée depuis Supabase via TLS vérifié. La base active était vide. La tâche quotidienne du Planificateur Windows a terminé avec le code `0`. Dans PostgreSQL embarqué, le rôle de sauvegarde a reçu un refus de lecture des notes et d’écriture des activités. La copie chiffrée d’un jeu fictif a exclu une séance hors période. Après déchiffrement et restauration sur le schéma migré dans une instance isolée, l’inscription est de nouveau reliée à sa séance et à sa carte. [Procédure de restauration](EXPLOITATION.md#contrôler-et-restaurer-une-sauvegarde)

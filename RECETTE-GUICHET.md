# Recette du guichet médiathèque

Recette du 14 novembre 2026 sur le projet distant fictif, complétée par les vérifications locales de la refonte du 18 novembre.

## Contrôles métier dans la base

`tests/metiers.test.cjs` couvre les habilitations, le quota quotidien JV, les déplacements, l’idempotence et le changement de carte. Les scénarios de la refonte couvrent aussi la salle facultative, les séances simultanées, la carte et l’âge par participant, la dernière place et la confirmation après J+15.

## Deux sessions isolées et interface

`tests/interface.test.cjs` ouvre deux contextes séparés : administrateur sur bureau et agent à 360 px. Une fiche créée par l’agent apparaît dans l’autre session. La recherche par nom la retrouve, l’agent ne peut pas la supprimer et la suppression administrative se propage. Le scénario couvre aussi le planning, Ctrl+Z, le mode sombre, la confirmation après J+15, l’heure de fin obligatoire, le CSV statistique et la fermeture forcée.

## Démonstration publique

`tests/demo.test.cjs` vérifie les trois activités, la fiche facultative, les cartes ESSAI, le profil simulé, la perte des activités après rechargement, l’absence de requête distante, le format à 360 px et la séparation de la connexion partagée. La CI exécute ces tests sans mot de passe.

## Clôture et quota

`supabase/tests/cloture.sql`, exécuté dans une transaction annulée, vérifie la purge des anciens liens et journaux, la conservation des fiches et réservations futures, les totaux exacts, le rejeu sans doublon, l’absence d’identité dans les statistiques, le maintien des détails JV après minuit, les limites J−30/J−31 et l’expiration des anciens quotas quotidiens.

## Limites de la recette

Deux contextes de navigateur ne remplacent pas les deux ordinateurs physiques du guichet. Douchette réelle, audit complet d’accessibilité, latence représentative, sauvegarde et restauration d’exploitation, et validation institutionnelle restent à réaliser sur place. La base de développement n’accueille aucune donnée réelle.


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
- La migration de refonte a été appliquée au projet fictif et `simplification_guichet.sql` y passe dans une transaction annulée. La fonction de connexion administrateur déployée renvoie 401 pour un mot de passe incorrect. L’ouverture de session avec le mot de passe privé et la recette à deux sessions restent à confirmer. Supabase Auth désactive encore les sessions anonymes.

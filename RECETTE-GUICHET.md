# Recette du guichet partagé

Développement et essais du 13 novembre 2026, exclusivement avec des données fictives. La première tranche annuaire a été fusionnée via la PR #1. Cette recette couvre aussi les activités, les réglages, les réservations atomiques et la clôture.

## Essais réellement exécutés

Les migrations ont été appliquées à la véritable base Supabase de développement à Paris. Les tests utilisent ses API Auth et PostgREST, sans simulation de base de données. Deux contextes de navigateur isolés représentent les postes Agent et Administrateur ; des connexions API indépendantes exercent les courses d’écriture.

| Domaine | Résultat vérifié |
|---|---|
| Annuaire | Création et correction partagées, zéro initial, contrôles des sept chiffres, identité facultative après passage, note uniquement dans la fiche détaillée. |
| Droits | Lecture anonyme refusée, inscription publique désactivée, aucune auto-attribution de rôle, dernier administrateur protégé. |
| Suppression | Agent refusé au serveur ; DELETE direct sans effet pour l’agent ; administrateur autorisé sur une fiche sans lien ; activité liée sur un autre poste bloquant la suppression. |
| Consultations | Saisie partagée, enfants/adultes, correction et déplacement de secteur, recherche commune et annulation propagées. |
| Jeux vidéo | Dernière place prise simultanément : une seule confirmation. Aucun usager créé pour le groupe refusé. Groupes de trois atomiques, chevauchements inter-postes refusés, jeu verrouillé puis libéré après la dernière annulation. |
| Déplacements | Déplacement d’un groupe impossible annulé intégralement ; déplacement valide conservant tous ses membres. |
| Réglages | Écriture administrative, révisions, grilles par jour de semaine, exceptions datées, horaire de fin, refus d’une diminution de capacité incompatible avec des réservations existantes. |
| Animations | Plusieurs participants rattachés à une carte, enfants/adultes distincts, âge en ans/mois, jauge concurrente, comptage libre sans carte, déplacement des inscrits avec la séance. |
| Séries et modèles | Exceptions préservées, modification et annulation de série, modèle réutilisable sans copie des participants, récurrence mensuelle de décembre à janvier. |
| Corbeille | Partage et restauration ; restauration refusée si la place a été reprise. |
| Imports et exports | Aperçu, transaction de lot annulée en entier si une ligne est invalide, délégation contrôlée au serveur et sélection exportée sans note interne. |
| Conflits et réseau | Version du serveur fournie lors d’un conflit ; saisie conservée après coupure ; réponse perdue rejouée sans doublon ; reconnexion sans rechargement ni perte du brouillon. |
| Fusion | Transfert manuel des liens, ancienne carte refusée, annulation serveur et bouton d’annulation de l’interface vérifiés. |
| Deux sessions | Modifications visibles sans rechargement dans les trois activités et les réglages. Interface bureau et 360 px, sans erreur JavaScript ni débordement horizontal. |
| Démonstration | Trois parcours ESSAI, aucune connexion distante, effacement au rechargement et CSP vérifiée. |
| Clôture SQL | Totaux exacts, suppression des anciennes participations et références de reprise/fusion, fiches conservées, réservations futures préservées, deuxième exécution sans double comptage. Transaction de recette annulée. |
| Planification | Tâche Cron active ; dernières exécutions observées réussies. Le guichet rattrape aussi une interruption avant lecture/écriture. |
| Sources | Contrôles syntaxiques JavaScript, compilation Python, empreintes CSP et `git diff --check`. |

Les cinq scénarios automatisés sont répartis entre `activites.test.cjs`, `annuaire.test.cjs`, `demo.test.cjs` et `parcours.test.cjs`. La clôture est vérifiée en plus par `supabase/tests/cloture.sql`. Les sorties JSON et les captures constituent les preuves locales. La CI vérifie la démonstration et les sources sans les mots de passe des comptes ; les tests connectés ont été exécutés séparément avec les comptes fictifs privés.

Les scénarios créent et annulent leurs propres données et consignent les identifiants de recette pour un nettoyage privilégié ciblé. Les paramètres initiaux sont restaurés. Les deux comptes fictifs restent disponibles pour la reprise. Aucun export métier réel ni classeur nominatif n’a été importé.

## Essais et décisions restant à réaliser sur place

- Deux ordinateurs physiques représentatifs, douchettes réelles, navigation entièrement au clavier et lecteur d’écran.
- Mesures au 95e centile sur le réseau du guichet : onglets, scan et confirmation ; ces cibles ne sont pas certifiées par un test de développement dans le cloud.
- Hébergement interne autorisé, sauvegarde chiffrée, restauration isolée et vérification de la purge après restauration avec l’exploitation.
- Audit complet d’accessibilité et décisions de la collectivité concernant données réelles, habilitations de service, DPD, archives, mentions et droits de diffusion.

Docker/Supabase local n’a pas été exécuté : la machine conserve Vanguard et ne dispose pas de la virtualisation nécessaire. La recette distante remplace cet environnement pour le développement ; elle ne constitue pas une autorisation d’exploitation de données réelles.

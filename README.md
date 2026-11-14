# Guichet médiathèque

Application d’accueil pour les jeux de société, les jeux vidéo, les animations et un annuaire partagé.

[Guichet partagé de développement](https://upsylon3.github.io/guichet-mediatheque/dev/) · [Démonstration publique autonome](https://upsylon3.github.io/guichet-mediatheque/)

**Données fictives uniquement.** Les comptes sont attribués par le service, sans inscription publique. La base de développement distante se situe à Paris. Aucun besoin de virtualisation.

## Utilisation

Le menu latéral ouvre Jeux vidéo, Jeux de société, Animations et Usagers. Les administrateurs disposent aussi de Statistiques et Administration. Un agent autorisé à gérer les modèles accède uniquement à cette partie de l’administration. Corbeille et annulation sont communes. Le mode clair ou sombre suit le choix de chaque navigateur.

- Jeux vidéo : planning d’aujourd’hui par poste et par horaire, une carte par joueur, une inscription par semaine civile du lundi au dimanche. Aucun accompagnateur sans carte.
- Jeux de société : une carte pour la consultation, avec les effectifs des enfants et des adultes qui partagent la boîte.
- Animations : bouton Inscrire pour choisir rapidement une séance dans une liste chronologique avec salle et places disponibles, ou accès par le calendrier. Une carte par participant. Créazone ou Salle JV et deux horaires obligatoires, sans chevauchement dans une même salle. Accompagnateurs nommés sans carte uniquement pour les animations sans jauge. Au-delà de J+15, les agents confirment un avertissement avant inscription.
- Usagers : recherche par nom ou carte, identité facultative, note détaillée, changement de carte conservant fiche et inscriptions. Suppression et fusion réservées à l’administration.
- Statistiques : filtres de période et de dimensions, regroupement jour/semaine/mois et extraction CSV des indicateurs filtrés, sans carte ni identité, réservées aux administrateurs.

Les données confirmées se synchronisent entre les sessions sans rechargement. Ctrl+Z annule la dernière opération prise en charge, sauf pendant la modification d’un champ où l’annulation de texte reste prioritaire.

## Lancement

Depuis le dépôt : `python scripts/serve-dev.py --config dev/config.json`, puis ouvrir `http://127.0.0.1:8000/dev.html`.

La démonstration `index.html` s’ouvre aussi directement depuis le disque. Elle conserve les données fictives de passage en mémoire et ne contacte aucun service distant. Ses cartes utilisent le format ESSAI-01. Son profil est simulé. Les parcours sont communs à l’application partagée, les protections d’exploitation reposent sur le serveur de cette dernière.

## Documentation

[Guide d’utilisation et de développement](DEVELOPPEMENT.md) · [Cahier des charges](CAHIER-DES-CHARGES.md) · [Recette](RECETTE-GUICHET.md) · [Passation](PASSATION.md) · [Revue institutionnelle](REVUE-COLLECTIVITE.md) · [Droits et composants](DROITS.md)

## Vérification et construction

`npm ci`, `npx playwright install chromium`, `npm run build`, puis `npm test`. Les essais connectés utilisent une configuration et deux comptes fictifs dans des fichiers ignorés par Git. Le workflow public vérifie la démonstration sans secrets. `supabase/tests/cloture.sql` vérifie clôture, statistiques et quota dans une transaction annulée.

Les usages réels, les sauvegardes d’exploitation et la recette sur le matériel de la collectivité restent à valider avant mise en service.


## Essais et modèles

L’interface ne propose ni import par collage ni export nominatif, ni raccourci Sélections du réseau. L’extraction CSV se trouve uniquement dans Statistiques. En JV, le filtre et le déplacement de sélection apparaissent uniquement dans Toutes les réservations. Le planning Aujourd’hui permet de retirer directement une réservation, après confirmation et selon les droits.

Dans une nouvelle animation, Partir d’un modèle remplit les paramètres. Les modèles se créent, se modifient, se renomment et se suppriment dans Administration → Animations, sans créer de séance ni modifier les séances existantes. Ce droit est réservé aux administrateurs par défaut. Administration → Accès des agents permet de déléguer Gérer les modèles d’animations au groupe des agents, indépendamment de la gestion des séances ; seuls les modèles deviennent alors accessibles dans Administration. Date, récurrence et inscrits ne sont pas copiés dans le modèle. Le type est un classement facultatif pour les listes et statistiques.

La démonstration autonome se recharge avec une journée fictive déjà remplie. Ses modifications de passage restent en mémoire. Pour préparer aussi la base partagée, lancer `npm run seed:demo` avec le compte administrateur fictif local configuré. Ce script est limité au projet de développement connu et conserve les données existantes. Il fournit 120 fiches fictives, des consultations, des réservations JV, des animations du jour et à J+7/J+16 ainsi que trois modèles. Une seconde exécution le même jour évite les doublons. En cas de conflit de salle, la séance fictive concernée est ignorée. Les données fictives sont repérables par Démo ou DÉMO.

La documentation reste accessible depuis le dépôt et les documents remis au service. Les pages du guichet n’affichent aucun lien vers le dépôt GitHub ni vers les documents du projet. Les raccourcis métier Catalogue et V-smart restent disponibles.

## Publication sur GitHub Pages

- Démonstration autonome : https://upsylon3.github.io/guichet-mediatheque/
- Guichet partagé avec connexion : https://upsylon3.github.io/guichet-mediatheque/dev/

Après modification des sources, lancer `npm run build`, vérifier le changement puis inclure les pages générées dans le commit. Une fusion dans `main` lance le workflow Vérification et publication du guichet : reconstruction, contrôles de la démonstration, préparation des fichiers publics et déploiement des deux versions ensemble. Les liens restent les mêmes après chaque déploiement réussi. Attendre la fin du job publication, puis recharger la page pour utiliser la nouvelle version. Un rechargement déconnecte et peut perdre un brouillon.

`scripts/prepare-pages.py` copie une liste explicite de fichiers dans `_site/`. Ni les documents du projet, ni les comptes de test, ni les fichiers privés ne font partie du site publié. Le dépôt GitHub reste public. Les données du guichet partagé restent dans sa base distante ; la démonstration autonome reste sans connexion applicative. Les anciens liens Githack ne sont plus les adresses de référence.

Les participations sont conservées pendant 30 jours glissants, avec leurs corbeilles et références de reprise. La recherche par carte et les listes permettent de consulter les activités récentes ; le planning JV Aujourd’hui reste limité au jour actuel. Les statistiques anonymes sont actualisées quotidiennement sans doublons et conservées au-delà. Les fiches usagers et réservations futures ne sont pas effacées par cette purge. Les détails déjà supprimés avant ce changement ne peuvent pas être reconstitués.

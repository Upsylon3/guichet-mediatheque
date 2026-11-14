# Guichet médiathèque

Application d’accueil pour les jeux de société, les jeux vidéo, les animations et un annuaire partagé.

[Guichet partagé de développement](https://raw.githack.com/Upsylon3/guichet-mediatheque/main/dev/index.html) · [Démonstration publique autonome](https://raw.githack.com/Upsylon3/guichet-mediatheque/main/index.html)

**Données fictives uniquement.** Les comptes sont attribués par le service, sans inscription publique. La base de développement distante se situe à Paris. Aucun besoin de virtualisation.

## Utilisation

Le menu latéral ouvre Jeux vidéo, Jeux de société, Animations et Usagers. Les administrateurs disposent aussi de Statistiques et Administration. Corbeille et annulation sont communes. Le mode clair ou sombre suit le choix de chaque navigateur.

- Jeux vidéo : planning d’aujourd’hui par poste et par horaire, une carte par joueur, une inscription par semaine civile du lundi au dimanche. Aucun accompagnateur sans carte.
- Jeux de société : une carte pour la consultation, avec les effectifs des enfants et des adultes qui partagent la boîte.
- Animations : une carte par participant. Créazone ou Salle JV et deux horaires obligatoires, sans chevauchement dans une même salle. Accompagnateurs nommés sans carte uniquement pour les animations sans jauge. Au-delà de J+15, les agents confirment un avertissement avant inscription.
- Usagers : recherche par nom ou carte, identité facultative, note détaillée, changement de carte conservant fiche et inscriptions. Suppression et fusion réservées à l’administration.
- Statistiques : filtres de période et de dimensions, regroupement jour/semaine/mois et export CSV anonyme. Imports et exports de listes réservés à l’administration.

Les données confirmées se synchronisent entre les sessions sans rechargement. Ctrl+Z annule la dernière opération prise en charge, sauf pendant la modification d’un champ où l’annulation de texte reste prioritaire.

## Lancement

Depuis le dépôt : `python scripts/serve-dev.py --config dev/config.json`, puis ouvrir `http://127.0.0.1:8000/dev.html`.

La démonstration `index.html` s’ouvre aussi directement depuis le disque. Elle conserve les données fictives de passage en mémoire et ne contacte aucun service distant. Ses cartes utilisent le format ESSAI-01. Son profil est simulé. Les parcours sont communs à l’application partagée, les protections d’exploitation reposent sur le serveur de cette dernière.

## Documentation

[Guide d’utilisation et de développement](DEVELOPPEMENT.md) · [Cahier des charges](CAHIER-DES-CHARGES.md) · [Recette](RECETTE-GUICHET.md) · [Passation](PASSATION.md) · [Revue institutionnelle](REVUE-COLLECTIVITE.md) · [Droits et composants](DROITS.md)

## Vérification et construction

`npm ci`, `npx playwright install chromium`, `npm run build`, puis `npm test`. Les essais connectés utilisent une configuration et deux comptes fictifs dans des fichiers ignorés par Git. Le workflow public vérifie la démonstration sans secrets. `supabase/tests/cloture.sql` vérifie clôture, statistiques et quota dans une transaction annulée.

Les usages réels, les sauvegardes d’exploitation et la recette sur le matériel de la collectivité restent à valider avant mise en service.

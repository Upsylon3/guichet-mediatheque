# Passation du guichet partagé

## État du développement

Le raccordement initial de l’annuaire a été fusionné dans `main` via la PR #1 (`61ae3e4`). La suite du développement raccorde les trois activités et les réglages à Supabase distant, avec les transactions de réservation, la clôture Europe/Paris et les contrôles de droits. Le choix distant a été demandé pour conserver Vanguard sans virtualisation.

Lire [le guide de lancement](DEVELOPPEMENT.md), [la recette complète](RECETTE-GUICHET.md), [le cahier des charges](CAHIER-DES-CHARGES.md) et [la revue institutionnelle](REVUE-COLLECTIVITE.md).

## Points de fonctionnement

- La démonstration publique `index.html` reste autonome, sans connexion et avec ses cartes ESSAI. L’application partagée est séparée dans `dev/`.
- Aucun mot de passe ni secret serveur dans Git. La configuration de développement publiée contient uniquement une URL et une clé publishable publique. Les comptes sont attribués, sans inscription publique.
- Toutes les validations de groupe, jauges, compatibilités, chevauchements, révisions et permissions sont refaites côté serveur. Les nouvelles fiches d’un passage sont créées dans la même transaction que l’activité acceptée.
- Les séries, exceptions, modèles, imports, exports, habilitations, fusions et annulations disposent de parcours dans l’interface connectée.
- Les anciennes participations, corbeilles et références de reprise sont purgées par la clôture transactionnelle. Les totaux sont agrégés ; les fiches et réservations futures restent indépendantes.
- Les essais emploient exclusivement des identités fictives. Les anciens classeurs et leur historique nominatif restent hors du dépôt.

## Suite de la mise en service

La suite est une recette sur les postes du guichet et une décision d’exploitation : douchettes réelles, clavier/lecteur d’écran, réseau et latence, serveur interne autorisé, sauvegarde chiffrée/restauration et purge après restauration. La collectivité reste responsable de l’autorisation des données réelles, des droits de diffusion et des validations DSI, DPD et archives. Ces actions ne peuvent pas être remplacées par des essais sur la machine de développement.

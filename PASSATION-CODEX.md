# Reprendre le développement du guichet

Point de départ vérifié : version `25c98e3` sur `main`. Pour toute reprise ultérieure, vérifier d’abord les changements depuis cette version.

## Où reprendre

Lire [le cahier des charges](CAHIER-DES-CHARGES.md), [le guide de lancement](README.md), [la revue de la collectivité](REVUE-COLLECTIVITE.md) et [les droits de diffusion](DROITS.md). Inspecter ensuite `index.html` et les migrations sous `supabase/migrations/`. La démonstration est en français et fonctionne sans serveur applicatif. Elle garde les fiches et les activités en mémoire. Les réglages seuls persistent dans le navigateur. Les migrations définissent déjà les cartes, les postes, les habilitations et leurs politiques d’accès.

## Prochaine tâche proposée : un annuaire partagé en développement

**État de la reprise du 13 novembre 2026.** L’annuaire est maintenant raccordé par l’entrée distincte `/dev.html`. À la demande du porteur, la recette utilise Supabase distant à Paris, sans virtualisation ni modification de Vanguard. La page publique garde ses cartes ESSAI et ses données en mémoire. Lire désormais [le guide de développement](DEVELOPPEMENT.md) et [le rapport de recette](RECETTE-ANNUAIRE.md) avant les étapes du pilote ci-dessous. Les consignes numérotées suivantes décrivent la tâche initiale.

1. Conserver la démonstration publique autonome et ses cartes ESSAI. Ajouter un point d’entrée de développement relié à Supabase local, avec deux comptes fictifs fournis par le service et sans inscription publique.
2. Raccorder l’annuaire existant à la base. Une carte y est une chaîne de sept chiffres, zéros initiaux compris. Un agent peut créer et compléter une fiche. Seul un administrateur peut la supprimer. Conserver le prénom, le nom et la naissance facultatifs après validation de l’activité, dans la page. La note reste dans la fiche détaillée.
3. Vérifier dans deux sessions qu’une fiche créée dans la première se retrouve dans la seconde, que deux scans concurrents ne créent qu’une fiche et que le serveur refuse la suppression par un agent. Conserver la saisie en cas d’échec d’écriture. Utiliser exclusivement des données fictives.
4. Livrer une modification testée et une procédure de lancement en français. Signaler séparément les essais réellement exécutés et ceux restant à faire.

## Suite du pilote

Raccorder les trois activités et les réglages partagés, assurer la réservation atomique des places, puis clôturer chaque journée selon Europe/Paris. Après la clôture, garder les totaux par jour et par activité, sans lien nominatif avec les participations passées. Vérifier la recherche par carte, les réservations futures et la reprise après interruption. Le serveur interne est prévu pour l’exploitation. Les anciens classeurs nominatifs restent hors du dépôt et aucune reprise de leur historique n’est prévue.

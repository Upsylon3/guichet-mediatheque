# Recette du guichet médiathèque

Recette du 14 novembre 2026, données fictives et projet distant de développement.

## Contrôles métier dans la base

`tests/metiers.test.cjs` vérifie les refus d’import, export et statistiques aux agents malgré des délégations anciennes ; l’interdiction d’accompagnateur JV ; la place individuelle ; le quota hebdomadaire ; les déplacements, annulations et reprises idempotentes ; le remplacement de carte conservant UUID et quota ; les salles obligatoires, conflits et horaires adjacents ; les cartes uniques par animation ; la concurrence sur la dernière place ; les accompagnateurs nommés uniquement sans jauge ; la confirmation après J+15 en inscription et restauration ; la fermeture forcée et les indicateurs anonymes.

## Deux sessions isolées et interface

`tests/interface.test.cjs` ouvre deux contextes séparés : administrateur sur bureau et agent à 360 px. Une fiche créée par l’agent apparaît dans l’autre session. La recherche par nom la retrouve, l’agent ne peut pas la supprimer et la suppression administrative se propage. Tests du menu, masquage des outils administratifs, planning synchronisé, Ctrl+Z, mode sombre, calendrier grisé et confirmation après J+15, salle et fin obligatoires, CSV statistique et fermeture forcée avec refus puis accord.

## Démonstration publique

`tests/demo.test.cjs` vérifie les trois activités, la fiche facultative, les cartes ESSAI, le profil simulé, la perte des activités après rechargement, l’absence de requête distante, le format à 360 px et la séparation de la connexion partagée. La CI exécute ces tests sans mot de passe.

## Clôture et quota

`supabase/tests/cloture.sql`, exécuté dans une transaction annulée, vérifie la purge des anciens liens et journaux, la conservation des fiches et réservations futures, les totaux exacts, le rejeu sans doublon, l’absence d’identité dans les statistiques, le maintien du quota après purge et sa suppression à la fin de la semaine.

## Limites de la recette

Deux contextes de navigateur ne remplacent pas les deux ordinateurs physiques du guichet. Douchette réelle, audit complet d’accessibilité, latence représentative, sauvegarde et restauration d’exploitation, et validation institutionnelle restent à réaliser sur place. La base de développement n’accueille aucune donnée réelle.

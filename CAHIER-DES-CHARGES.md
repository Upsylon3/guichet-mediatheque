# Cahier des charges du guichet médiathèque

Version du 14 novembre 2026. Les règles suivantes remplacent les hypothèses de la version précédente.

## Navigation et profils

Un menu latéral ouvre Jeux vidéo, Jeux de société, Animations et Usagers. Les administrateurs disposent des onglets Statistiques et Administration. Corbeille et annulation sont accessibles selon les droits. Le mode sombre se mémorise par navigateur. Les interfaces restent utilisables à 360 px et au clavier.

Les comptes du personnel sont attribués, sans inscription publique. Les agents peuvent saisir les activités et compléter les identités. L’administration attribue les délégations de correction, d’annulation et de gestion des séances. Les statistiques, imports et exports sont exclusivement administratifs, sans délégation. La suppression et la fusion de fiches restent administratives.

## Jeux de société

Une consultation comporte une carte de sept chiffres, une boîte, un secteur Jeunesse ou Pop Zone, une date et les effectifs enfants/adultes. Une personne consulte et partage le jeu avec les autres. La carte n’identifie donc pas chaque personne de ce groupe. Une consultation avec deux enfants et un adulte compte une consultation et trois personnes. Aucun mouvement de prêt.

Le secteur reste mémorisé sur le navigateur. Après validation, les champs du passage s’effacent et le curseur revient sur la carte. L’identité facultative se complète après passage. Les corrections autorisées conservent les contrôles de révision.

## Jeux vidéo

Une carte correspond à un joueur et une place. Le formulaire accepte plusieurs joueurs, chacun avec une carte distincte. Il ne propose aucun accompagnateur. Une même fiche ne peut bénéficier que d’une inscription active par semaine civile, du lundi au dimanche, quel que soit le poste. Une annulation libère cette inscription. Un déplacement de sa réservation reste possible. Changer de carte conserve la limite grâce à l’identifiant stable de la fiche.

Le planning Aujourd’hui affiche les postes en colonnes et les créneaux en lignes. Chaque case affiche le jeu, les personnes attendues et les places libres ou la fermeture. La vue Toutes les réservations complète ce planning. Le formulaire propose la date actuelle et le créneau contenant l’heure actuelle, à défaut le prochain créneau ou le dernier de la journée.

Le premier inscrit fixe le jeu, les suivants rejoignent ce même jeu. La dernière annulation libère son choix. Capacités de 1 à 4, jeux compatibles, grilles habituelles, variantes par jour de semaine et exceptions datées. La transaction valide le groupe entier ou refuse tout. Les alternatives restent sur la date choisie.

Une fermeture incompatible avec des réservations nécessite une confirmation explicite indiquant leur nombre. La fermeture et leur retrait vers la corbeille se réalisent ensemble. La restauration sur un poste toujours fermé est refusée. Une réduction de capacité ou un changement d’horaire incompatible ne bénéficie pas de ce forçage.

## Animations

Chaque séance possède titre, date, début et fin obligatoires, et une salle obligatoire parmi Créazone et Salle JV. Deux séances actives ne se chevauchent jamais dans la même salle, y compris lors d’un déplacement, d’une restauration ou de la création d’une série. Des séances adjacentes sont permises. Les inscriptions suivent la séance lors d’un déplacement.

Autres champs : type, référent, public, âges minimum/maximum facultatifs, annonce et visuel facultatif, mode sur inscription ou entrée libre, jauge facultative. L’heure actuelle est proposée. Aucun champ d’ouverture des inscriptions : la règle commune couvre les quinze jours suivants.

Une carte correspond à une personne. Une carte ne se répète ni dans le groupe ni dans les inscrits de la séance. Aucune carte familiale. Les âges peuvent être en ans ou en mois et la catégorie distingue enfant et adulte. Les animations avec jauge exigent une carte par personne. Sans jauge, des accompagnateurs peuvent ne pas avoir de carte, mais chacun doit avoir un nom enregistré. Leur nombre découle de cette liste de noms. L’entrée libre permet aussi un comptage non nominatif.

Pour les agents, les inscriptions jusqu’à J+15 inclus suivent le parcours normal. Au-delà, les dates du calendrier apparaissent grisées avec un libellé J+15. L’inscription exige un avertissement et une confirmation explicite. La même règle protège les déplacements vers une séance lointaine, les restaurations et les comptages. Les administrateurs ne sont pas limités par cet avertissement.

Séries hebdomadaires ou mensuelles, 1 à 52 occurrences et intervalle de 1 à 12 unités. Modification ou suppression d’une séance, de celle-ci et des suivantes, ou de toute la série avec aperçu. Les exceptions personnalisées restent préservées. Les modèles administratifs ne recopient pas les inscrits.

## Annuaire

Sept chiffres conservés en texte, zéros initiaux compris. Recherche par nom ou numéro. Prénom, nom, naissance et note facultatifs. Notes uniquement dans la fiche détaillée, jamais dans les exports d’activités. Deux homonymes restent distincts.

Une activité acceptée crée au besoin la fiche minimale dans la même transaction. Une activité refusée ne crée pas de fiche. Le changement de numéro s’effectue depuis la fiche retrouvée par nom ou carte, avec aperçu d’identité et confirmation. Il conserve UUID, identité, inscriptions et quota. Un numéro déjà attribué est refusé et renvoie vers la fusion administrative. Aucun rapprochement automatique sur le nom.

La suppression administrative est bloquée par les activités et la corbeille liées. La fusion dispose d’un aperçu et d’une annulation du jour lorsque les données n’ont pas changé. Une inscription JV peut bloquer cette annulation afin de préserver le quota.

## Statistiques et confidentialité

L’onglet Statistiques est réservé aux administrateurs, côté interface et serveur. Période, regroupement jour/semaine/mois, filtres activité, secteur, poste, jeu vidéo, boîte, salle, type d’animation et catégorie. Compter saisies, personnes déclarées, enfants/adultes lorsque connus et accompagnateurs des animations sans jauge. L’export des indicateurs ne contient ni nom ni carte. Ces chiffres ne prouvent pas une présence effective. Les anciens totaux sans détail restent identifiés comme tels.

À la clôture Europe/Paris, agréger les activités par dimensions non nominatives, puis purger les anciennes activités, corbeilles et références de reprise/fusion. Une trace privée minimale associant identifiant stable de fiche et semaine reste uniquement jusqu’à la fin de la semaine pour faire respecter le quota JV. Elle ne conserve ni jeu ni horaire et n’est exposée à aucun profil. Les fiches et réservations futures persistent. La clôture reste transactionnelle et rejouable sans doubler les totaux.

## Fiabilité et exploitation

Toutes les règles métier se revérifient dans les transactions du serveur. Une tentative rejouée après perte de réponse ne double pas une saisie. Les conflits conservent le brouillon. Les sessions se synchronisent environ toutes les deux secondes. Ctrl+Z annule une opération prise en charge lorsque le focus ne se trouve pas dans un champ de saisie. Le rechargement déconnecte et peut perdre les brouillons.

La démonstration publique reste autonome et fonctionnelle avec des données fictives. Aucune donnée de service réelle ne doit entrer dans la base de développement. Recette sur deux postes physiques, douchette, accessibilité complète, sauvegarde/restauration et autorisation institutionnelle restent à organiser avant exploitation.


## Administration organisée

Les réglages se répartissent en cinq rubriques : Postes JV, Animations, Jeux de société, Accès des agents et Liens du service. Une seule rubrique apparaît à la fois et son bouton enregistre uniquement ses paramètres. Les exceptions datées et les fermetures restent repliées par défaut. Les brouillons non enregistrés déclenchent un avertissement avant un changement de rubrique ou de poste. Le catalogue de boîtes permet de choisir une boîte existante ou d’en ajouter une.

Pour renommer un poste : Administration / Postes JV, sélectionner le poste, modifier Nom du poste puis enregistrer. Les réglages habituels, variantes hebdomadaires, exceptions et réservations actives ou en corbeille suivent le nouveau nom dans une transaction unique. Un nom déjà utilisé, une révision obsolète ou une modification incompatible est refusé sans renommage partiel. Les statistiques historiques conservent le libellé de leur date.

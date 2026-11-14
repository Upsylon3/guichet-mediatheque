# Cahier des charges du guichet médiathèque

Version du 14 novembre 2026. Les règles suivantes remplacent les hypothèses de la version précédente.

## Navigation et profils

Un menu latéral ouvre Jeux vidéo, Jeux de société, Animations et Usagers. Les administrateurs disposent des onglets Statistiques et Administration. Corbeille et annulation sont accessibles selon les droits. Le mode sombre se mémorise par navigateur. Les interfaces restent utilisables à 360 px et au clavier. La gestion des modèles peut être déléguée aux agents et leur ouvre uniquement cette partie de l’administration. Aucun lien vers le dépôt GitHub ou les documents du projet n’apparaît dans le guichet ; les raccourcis métier restent disponibles.

Les comptes du personnel sont attribués, sans inscription publique. Les agents peuvent saisir les activités et compléter les identités. L’administration attribue les délégations de correction, d’annulation et de gestion des séances. Les statistiques sont exclusivement administratives, sans délégation. Les boutons d’import et d’export nominatif sont retirés de l’interface. Seul Statistiques propose une extraction CSV des agrégats affichés, réservée aux administrateurs. La suppression et la fusion de fiches restent administratives.


Lorsqu’une inscription JV est refusée à cause de la limite hebdomadaire, le message identifie la carte concernée et rappelle le jour de la semaine, la date, les heures de début et de fin et le poste de sa réservation existante. Il utilise les informations actuelles après un déplacement ou un changement de carte. Les inscriptions passées restent consultables pendant 30 jours, ce qui permet de rappeler aussi les réservations déjà passées dans la semaine. Les données effacées avant l’activation de cette conservation ne sont pas récupérables.

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

Sept chiffres conservés en texte, zéros initiaux compris. Recherche par nom ou numéro. Prénom, nom, naissance et note facultatifs. Notes uniquement dans la fiche détaillée. Deux homonymes restent distincts.

Une activité acceptée crée au besoin la fiche minimale dans la même transaction. Une activité refusée ne crée pas de fiche. Le changement de numéro s’effectue depuis la fiche retrouvée par nom ou carte, avec aperçu d’identité et confirmation. Il conserve UUID, identité, inscriptions et quota. Un numéro déjà attribué est refusé et renvoie vers la fusion administrative. Aucun rapprochement automatique sur le nom.

La suppression administrative est bloquée par les activités et la corbeille liées. La fusion dispose d’un aperçu et d’une annulation du jour lorsque les données n’ont pas changé. Une inscription JV peut bloquer cette annulation afin de préserver le quota.

## Statistiques et confidentialité

L’onglet Statistiques est réservé aux administrateurs, côté interface et serveur. Période, regroupement jour/semaine/mois, filtres activité, secteur, poste, jeu vidéo, boîte, salle, type d’animation et catégorie. Compter saisies, personnes déclarées, enfants/adultes lorsque connus et accompagnateurs des animations sans jauge. Les indicateurs ne contiennent ni nom ni carte. Ces chiffres ne prouvent pas une présence effective. Les anciens totaux sans détail restent identifiés comme tels.

Chaque jour en Europe/Paris, agréger les activités par dimensions non nominatives sans effacer les participations récentes. Conserver les activités, corbeilles et références de reprise/fusion pendant 30 jours glissants : à J, conserver J−30 et supprimer seulement les dates antérieures. Les journées modifiées sont recalculées par remplacement, y compris après annulation ou déplacement ; les archives déjà purgées sont conservées sans recalcul. Une trace privée minimale associant identifiant stable de fiche et semaine reste uniquement jusqu’à la fin de la semaine pour faire respecter le quota JV. Elle ne conserve ni jeu ni horaire et n’est exposée à aucun profil. Les fiches et réservations futures persistent. La clôture reste transactionnelle et rejouable sans doubler les totaux.

## Fiabilité et exploitation

Toutes les règles métier se revérifient dans les transactions du serveur. Une tentative rejouée après perte de réponse ne double pas une saisie. Les conflits conservent le brouillon. Les sessions se synchronisent environ toutes les deux secondes. Ctrl+Z annule une opération prise en charge lorsque le focus ne se trouve pas dans un champ de saisie. Le rechargement déconnecte et peut perdre les brouillons.

La démonstration publique reste autonome et fonctionnelle avec des données fictives. Aucune donnée de service réelle ne doit entrer dans la base de développement. Recette sur deux postes physiques, douchette, accessibilité complète, sauvegarde/restauration et autorisation institutionnelle restent à organiser avant exploitation.


## Administration organisée

Les réglages se répartissent en cinq rubriques : Postes JV, Animations, Jeux de société, Accès des agents et Liens du service. Une seule rubrique apparaît à la fois et son bouton enregistre uniquement ses paramètres. Les exceptions datées et les fermetures restent repliées par défaut. Les brouillons non enregistrés déclenchent un avertissement avant un changement de rubrique ou de poste. Le catalogue de boîtes permet de choisir une boîte existante ou d’en ajouter une.

Pour renommer un poste : Administration / Postes JV, sélectionner le poste, modifier Nom du poste puis enregistrer. Les réglages habituels, variantes hebdomadaires, exceptions et réservations actives ou en corbeille suivent le nouveau nom dans une transaction unique. Un nom déjà utilisé, une révision obsolète ou une modification incompatible est refusé sans renommage partiel. Les statistiques des journées encore conservées suivent les corrections des lignes ; les archives au-delà de 30 jours restent figées.


## Essais et modèles

L’interface ne propose ni import par collage ni export nominatif, ni raccourci Sélections du réseau. L’extraction CSV se trouve uniquement dans Statistiques. En JV, le filtre et le déplacement de sélection apparaissent uniquement dans Toutes les réservations. Le planning Aujourd’hui permet de retirer directement une réservation, après confirmation et selon les droits.

Dans une nouvelle animation, Partir d’un modèle remplit les paramètres. La création, la modification, le renommage et la suppression des modèles se trouvent dans Administration → Animations. Ces actions sont administratives par défaut. Dans Accès des agents, le droit Gérer les modèles d’animations peut être délégué aux agents réguliers, indépendamment de la gestion des séances. Cette délégation ouvre uniquement la gestion des modèles, sans les autres paramètres ni les statistiques. Comme les autres délégations actuelles, elle s’applique au groupe des agents. Modifier ou supprimer un modèle ne modifie pas les séances existantes. Date, récurrence et inscrits ne sont pas copiés dans le modèle. Le type est un classement facultatif pour les listes et statistiques.

La démonstration autonome se recharge avec une journée fictive déjà remplie. Ses modifications de passage restent en mémoire. Pour préparer aussi la base partagée, lancer `npm run seed:demo` avec le compte administrateur fictif local configuré. Ce script est limité au projet de développement connu et conserve les données existantes. Il fournit 120 fiches fictives, des consultations, des réservations JV, des animations du jour et à J+7/J+16 ainsi que trois modèles. Une seconde exécution le même jour évite les doublons. En cas de conflit de salle, la séance fictive concernée est ignorée. Les données fictives sont repérables par Démo ou DÉMO.

## Inscription rapide et extraction statistique

Dans Animations, le bouton Inscrire ouvre un formulaire avec une liste de séances sur inscription classées par date et heure. La liste indique titre, salle et places restantes ; les séances complètes sont grisées. Les séances en entrée libre restent accessibles par le calendrier pour leur comptage. La saisie des cartes, catégories et âges, les accompagnateurs nommés sans jauge, la confirmation après J+15, la validation transactionnelle et Ctrl+Z suivent les mêmes règles que l’inscription depuis une séance. Les cartes saisies sont conservées lors d’un changement de séance. Une identité nouvelle se complète après l’inscription.

Dans Statistiques, Extraire les statistiques (CSV) télécharge les agrégats de la période, des filtres et du regroupement choisis. Le fichier est séparé par des points-virgules, encodé en UTF-8 pour les tableurs et ne contient ni carte ni identité. Les agents, même autorisés à gérer les modèles, ne peuvent pas accéder aux statistiques.

Les fermetures et changements de capacité des postes contrôlent les réservations du jour et futures, sans annuler les participations déjà passées. La modification des séances à venir d’une série préserve ses anciennes séances conservées dans l’historique.

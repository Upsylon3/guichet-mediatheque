# Guichet médiathèque
## Cahier des charges fonctionnel · version de travail du 13 novembre 2026

**Objectif.** Depuis n’importe quel poste d’accueil, un agent doit pouvoir scanner une carte, retrouver le même usager dans les trois activités et terminer la saisie pendant que la personne est devant lui. Les agents assurent le service courant. Les administrateurs gardent la maîtrise de tous les réglages. Les comptes sont attribués par le service, sans inscription publique.

### 1. Ce que les classeurs nous apprennent

| Source examinée | Organisation observée | Conséquence pour la reprise |
|---|---|---|
| ENFANTS – JEUX EN CSP, 18 feuilles | Douze mois de 2026, listes usagers et jeux, calendrier et modèles. Les lignes mensuelles associent date, carte, nom recherché, numéro de jeu, titre recherché, enfants et adultes. Le total additionne les deux effectifs. Les listes commencent directement par des données. | Lire les lignes réellement renseignées, même avant la plage parcourue par les anciennes formules. Distinguer une consultation, un usager identifié et plusieurs joueurs. |
| POPZONE – JEUX EN CSP, 18 feuilles | Même circuit, avec janvier 2027 en plus. Les listes ont des en-têtes et une colonne de notes. Les libellés de la liste des jeux et le sens de recherche de la formule mensuelle doivent être rapprochés. | Détecter la carte ou le numéro de boîte sur les valeurs et soumettre un aperçu au secteur. Une position de colonne commune aux deux fichiers ne suffit pas. |
| INSCRIPTION AUX ANIMATIONS 2026, 105 feuilles | Calendrier annuel, feuilles par séance, modèles de semaine, samedi et vacances, fiches d’activités, listes de jeux par poste et feuille DATABASE pour les paramètres. Certains modèles affichent des erreurs de référence. | Reconstituer séances et inscriptions depuis les feuilles datées. Utiliser le calendrier pour contrôler les dates. Les modèles et les catalogues alimentent les réglages, jamais les effectifs. |

Le spectacle distingue les enfants, leur âge et les adultes, avec un exemple de jauge à 50 places. Créazone possède des modèles avec et sans inscription. Des spectacles proposent deux séances le même jour. Le modèle du samedi prévoit des inscriptions individuelles sur certains postes multijoueurs, des consignes historiques d’accompagnement selon l’âge et un repérage visuel des doublons. Ces différences justifient des paramètres par activité, par poste et par séance.

### 2. Les trois écrans du guichet

**Jeux de société.** Choisir Jeunesse ou Pop Zone. Le poste conserve son dernier secteur et l’affiche en permanence. Scanner la carte, puis la boîte, saisir enfants et adultes, valider avec Entrée. La date du jour est proposée et reste corrigeable. Afficher immédiatement le titre et le total. Une valeur inconnue peut rester à compléter. Après validation, effacer carte et boîte, conserver le secteur et replacer le curseur sur la carte. Selon les droits accordés, la liste du jour permet de corriger, déplacer de secteur, supprimer et annuler la dernière opération. Un numéro de carte est indispensable pour valider. Un jeu consulté sur place ne déclenche aucun mouvement de prêt.

**Jeux vidéo.** Ouvrir « Inscrire », choisir le jour, le poste et le créneau. Afficher horaire de fin, places restantes, consigne éventuelle et jeux compatibles. Le premier joueur choisit obligatoirement un jeu. Les places restantes sont ouvertes aux autres usagers qui rejoignent la partie sur ce même jeu. Après annulation de la dernière inscription, le choix du jeu redevient libre. Chaque accompagnateur compte pour une personne dans les jeux, y compris dans les effectifs de consultation sur place. Scanner une carte par joueur ou ajouter plusieurs joueurs dans le même formulaire. Vérifier doublons, chevauchements, capacité et compatibilité avant de confirmer tout le groupe en une opération. Si le groupe dépasse la capacité, proposer le créneau suivant ou une place disponible sur un autre poste compatible. L’équipe peut déplacer une personne ou tout le groupe ou annuler une place. Pour l’inscription suivante, garder jour, heure, poste et jeu, vider les identités.

| Poste du modèle du samedi | Matériel / usage | Places du modèle |
|---|---|---:|
| ZELDA | Switch solo | 1 |
| PEACH | Switch 2 | 2 |
| MARIO | Switch | 4 |
| ELLIE | PS5 action-aventure | 2 |
| SACKBOY | PS5 sport | 2 |
| SPYRO | PS5 solo | 1 |

Les capacités de 1 à 4, y compris 3, doivent être configurables. Une grille de créneaux appartient à un **poste identifié**, avec exceptions par date. Par exemple, le samedi commence à 10 h 15 et reprend à 13 h 45 après la pause. Le modèle jeudi/vendredi présente deux créneaux de 90 minutes à partir de 15 h 15. L’équipe peut désactiver un poste en panne, fermer une journée ou remplacer ponctuellement un jeu.

**Animations.** Ouvrir directement le calendrier mensuel, naviguer au clavier ou par mois et revenir à aujourd’hui. Un clic sur une date crée une animation. Un clic sur son titre ouvre sa fiche et sa liste d’inscrits. Prévoir titre, lieu, dates, horaires, intervenant ou référent, public, conditions d’âge, date d’ouverture des inscriptions, texte d’annonce, visuel facultatif, jauge et mode « entrée libre » ou « sur inscription ». Ajouter, corriger, déplacer, dupliquer ou supprimer une séance depuis sa fiche. Pour une série (Café Repair, par exemple), proposer « cette séance », « celle-ci et les suivantes » ou « toute la série », avec aperçu des inscriptions touchées. Une exception de vacances ne doit pas être écrasée lors d’une régénération.

Sur inscription, scanner la carte et proposer le nom connu. Permettre plusieurs participants rattachés à une carte, avec places adultes/enfants et âge facultatif si l’activité le demande, en mois pour les tout-petits si nécessaire. À la création de chaque animation, préciser si les accompagnateurs comptent dans la jauge et, si nécessaire, fixer un plafond strict. Une inscription de groupe qui dépasserait ce plafond est refusée en entier. L’entrée libre permet un simple comptage. Une séance complète signale les alternatives. La liste d’attente et la feuille de présence imprimable sont des améliorations proposées.

### 3. Une fiche usager commune

La carte porte un code-barres qui encode uniquement le numéro d’usager. Ce même numéro de **sept chiffres** est imprimé sous le code-barres. Le prénom et le nom figurent également sur la carte.

Le scan et la saisie manuelle du numéro imprimé empruntent le même champ dans les trois onglets. Conserver le numéro en texte et valider exactement sept chiffres de 0 à 9, zéros initiaux compris. Supprimer seulement les espaces périphériques et la fin de lecture de la douchette. Pour une carte connue, afficher l’identité disponible en lecture seule. Pour une carte inconnue, l’agent valide la consultation ou l’inscription avec le numéro seul. Après confirmation seulement, la carte apparaît dans « Fiches à compléter », directement dans la page. Le prénom et le nom peuvent être renseignés après le départ de l’usager, si l’agent dispose de l’information. L’agent peut enchaîner les passages, changer d’onglet et reprendre ensuite la fiche de son choix. Aucun déplacement automatique du curseur vers ces champs. Une action annulée ou refusée ne crée aucune fiche en attente. La même carte saisie simultanément à deux postes aboutit à une seule fiche. Une correction du nom est visible dans les trois onglets. Deux personnes homonymes restent distinctes. En cas de remplacement de carte, proposer une fusion manuelle avec aperçu des inscriptions liées, confirmation et possibilité de revenir en arrière. Ne jamais rapprocher automatiquement deux personnes sur leur seul nom.

### 4. Liberté de travail et périmètre

Les trois onglets restent fixes. Un menu commun « Réglages » permet aux administrateurs de gérer jeux, exemplaires, postes, horaires, capacités, types d’animation, modèles récurrents et champs facultatifs. Une vue tableau complète chaque activité pour filtrer, modifier une ligne, coller plusieurs lignes avec aperçu, exporter une sélection et corriger en lot. Prévoir une corbeille et une annulation. Les conflits présentent les deux versions et permettent de reprendre la saisie. L’interface se limite à des libellés courts et à une aide contextuelle au moment où elle est nécessaire.

Un raccourci permanent ouvre le catalogue public du réseau pour chercher un document, sa cote, son site et son état de disponibilité. Un deuxième raccourci configurable sur l’intranet ouvre V-smart pour les prêts, retours, opérations financières et recherches internes. Aucune synchronisation V-smart n’est acquise. Une lecture d’identité ne pourra être étudiée qu’après confirmation d’une interface documentée et de son périmètre par la collectivité. Pour le conseil de lecture, proposer des raccourcis vers les sélections du réseau. Le tri physique reste dans l’organisation actuelle.

### 5. Fonctionnement sur plusieurs postes

Application web interne, une adresse commune sur les postes autorisés de l’équipe. Le navigateur affiche les trois vues dans une même page et conserve les filtres lors des changements d’onglet. Un service central écrit dans une base relationnelle partagée. Les appareils personnels servent au développement avec des données fictives. Les modalités d’accès aux données de service, de sauvegarde, de purge et de restauration sont à déterminer avec la collectivité avant le pilote réel.

| Objet | Relations et règles |
|---|---|
| Usager | Identifiant technique stable, carte unique, nom facultatif. |
| Jeu de société / exemplaire | Le numéro scanné désigne une boîte et son secteur. Une consultation relie boîte, carte, secteur de consultation, date et effectifs. |
| Poste / jeu vidéo | Plusieurs postes de même matériel peuvent avoir des capacités, horaires et jeux différents. Un jeu peut être disponible sur plusieurs postes. |
| Série / séance | Le modèle définit une récurrence et ses paramètres. Chaque occurrence datée peut porter des exceptions. |
| Inscription / participant | Séance ou créneau, carte de rattachement, groupe et nombre de places occupées. Conserver séparément les informations propres à cette participation. |

Prévoir des modules distincts pour les trois métiers et des services communs pour les usagers, les horaires et les imports. Versionner schéma et migrations. Au serveur, vérifier la capacité dans la transaction d’écriture. Une nouvelle tentative après coupure ne doit pas doubler la saisie. Sur déconnexion, conserver la saisie à l’écran et signaler son état jusqu’à confirmation du serveur. Les autres postes reçoivent les modifications sans recharger la page.

**Cibles de recette proposées.** Sur deux postes représentatifs du guichet, viser au 95ᵉ centile un changement d’onglet déjà chargé en moins de 150 ms, un résultat de scan sous 300 ms sur le réseau local et une confirmation d’écriture sous une seconde. Tester à la souris, à la douchette et entièrement au clavier, à 360 px de large et sur écran de bureau. Ne jamais utiliser la couleur comme seul signal de doublon ou d’erreur.

### 6. Reprise et mise en service

Le service démarre avec une base vide. Aucun historique nominatif des trois classeurs à importer. Les horaires, les postes et les jeux utiles au démarrage peuvent être recréés comme paramètres. Le serveur interne est prévu pour la mise en service. La vérification des sauvegardes relève de l’exploitation, par le service informatique ou un membre désigné sur place.

### 7. Scénarios de réception

| Essai au guichet | Résultat attendu |
|---|---|
| Scanner un identifiant de sept chiffres commençant par zéro, puis le retaper dans un autre onglet | Même fiche, zéro initial conservé. Une saisie de six ou huit chiffres ou contenant une lettre affiche « Saisir les 7 chiffres imprimés sous le code-barres ». La règle porte sur les cartes usagers, indépendamment des numéros de boîte. |
| Carte inconnue en Jeunesse, puis même carte en Pop Zone et sur un atelier | Une seule fiche. Le nom peut être ajouté plus tard et se retrouve partout. |
| Une boîte, deux enfants et un adulte | Une consultation et trois participants. Une correction d’effectif recalcule le total. |
| Groupe de trois sur MARIO avec une place déjà prise | Trois places attribuées ensemble. Le prochain formulaire conserve le créneau et le jeu, sans reprendre les cartes. |
| Deux collègues prennent la dernière place simultanément | Une seule inscription confirmée. L’autre agent garde sa saisie et peut changer de créneau. |
| Même PS5, deux postes différents | Le choix d’ELLIE ou de SACKBOY change la liste des jeux disponibles. |
| Décaler une seule séance du Café Repair | Les inscrits suivent la séance, les autres dates demeurent en place. |
| Créer décembre puis janvier et annuler une erreur de saisie | Les dates traversent l’année sans copie de feuille. L’agent retrouve la ligne restaurée. |
| Changer un libellé, une jauge ou un champ facultatif | Un administrateur peut le faire depuis un poste autorisé, sans intervention de développement. |

### 8. Décisions du guichet

- **SPYRO le samedi.** La grille fait foi : 10 h 15–11 h 45, 13 h 45–15 h 15, 15 h 15–16 h 45 et 16 h 45–17 h 45.
- **Recherche par carte.** Un scan ou une saisie depuis n’importe quel onglet indique les consultations du jour avec secteur et boîte, ainsi que les inscriptions du jour et à venir avec activité, poste ou lieu, date, heure et jeu. Les 15 secondes évoquées décrivent le temps de recherche actuel.
- **Droits proposés.** L’agent peut consulter, rechercher, inscrire, désinscrire et compléter une identité après passage. Par défaut, l’administration gère les séances, les paramètres, les habilitations, les exports nominatifs et les opérations en masse. Prévoir une attribution configurable par action. Les contrôles doivent aussi porter sur les requêtes au serveur. Aucun agent ne peut s’attribuer un rôle.
- **Questions encore ouvertes.** Une note libre est-elle utile au guichet ? Donner un exemple inventé et préciser si elle doit rester sur une séance, un secteur ou une fiche. Après une séance terminée, dans quel cas et pendant combien de temps faut-il pouvoir retrouver qui était inscrit ? Examiner séparément les décomptes anonymes de fréquentation.

### 9. Revue avant le pilote

Le [dossier de revue de la collectivité](REVUE-COLLECTIVITE.md) décrit les preuves à réunir pour un usage réel, les responsabilités, les archives, l’accessibilité et les conditions de diffusion. Le développement à domicile et la recette publique utilisent exclusivement des données fictives.

# Revue du projet par la collectivité
**État au 19 novembre 2026 · document préparatoire pour la direction, la DSI, le DPD et les archives.**

### Mise en service avec des données réelles

| Responsable | Décision ou preuve à consigner |
|---|---|
| Direction et juridique | Valider le responsable du traitement et les finalités, autoriser l’hébergement et la diffusion du logiciel, identifier le titulaire des droits. |
| DSI | Choisir un hébergement adapté à la connexion administrateur et valider Supabase, les accès, les sous-traitants et les transferts. GitHub déconseille l’utilisation de Pages pour des opérations sensibles telles que la transmission d’un mot de passe. [Conditions d’usage de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) · [Accord de traitement Supabase](https://supabase.com/legal/customer-resources/data-processing-addendum) |
| DPD et archives | Compléter le registre, arrêter les champs nécessaires, les durées des fiches, des traces et des sauvegardes, les procédures de droits et le besoin d’une AIPD. Valider la notice avant collecte. [Guide CNIL pour les collectivités](https://www.cnil.fr/fr/collectivites-territoriales/les-principes-cles-de-la-protection-des-donnees) |
| DSI et référent accessibilité | Exécuter une restauration sur l’infrastructure autorisée, puis la recette sur deux postes physiques avec douchette, clavier, zoom, lecteur d’écran et thème sombre. Établir la déclaration selon le périmètre applicable et les résultats de l’audit. [Déclaration d’accessibilité RGAA](https://accessibilite.numerique.gouv.fr/obligations/declaration-accessibilite/) |

Le contrôle du 19 novembre a trouvé zéro fiche et zéro activité dans la base active. La liste de sauvegardes physiques du projet était vide et la restauration à un instant donné était désactivée. La restauration réussie avec PostgreSQL embarqué utilise des données fictives. La DSI doit confirmer le stockage chiffré hors projet, la fréquence, la conservation et les objectifs de reprise, puis restaurer une sauvegarde sur une instance isolée et vérifier les droits, les compteurs et les purges. [Sauvegardes Supabase](https://supabase.com/docs/guides/platform/backups)

### Pilotage par une seule personne

Un seul porteur de projet peut développer, documenter, exécuter les essais successivement sur deux postes et consigner les résultats. Les domaines de revue ci-dessous servent de liste de travail. Pour chaque décision institutionnelle, inscrire le contact compétent de la collectivité lorsqu’il est identifié et conserver la décision reçue. Une fonction absente de la médiathèque peut relever d’un service mutualisé. Les agents qui se relaient disposent des commandes du guichet. Les comptes administrateurs gèrent les réglages et les habilitations.

### Ce qui circule aujourd’hui

| Situation | Données et destination |
|---|---|
| Ouverture du guichet | GitHub Pages distribue l’interface et reçoit les métadonnées de chargement. Les appels de connexion et de données vont directement à Supabase. L’essai autonome reste local. |
| Saisie fictive | La page accepte les cartes au format ESSAI- suivi de 1 à 4 chiffres. Les formulaires travaillent en mémoire. Le rechargement efface les données de session. Les paramètres de démonstration seuls sont conservés sur ce navigateur (libellés fictifs uniquement). Les noms et les champs libres restent des zones de saisie manuelle réservées aux exemples inventés. |
| Ressources et navigateur | Le guichet utilise ses scripts et styles locaux et réserve les connexions applicatives à Supabase. Il ne comporte pas de mesure d’audience intégrée. Le navigateur conserve le thème, le secteur et, sur un profil activé, le jeton nécessaire à l’accès Agent. |
| Raccourcis métier | Catalogue et V-smart ouvrent le site choisi par un clic explicite. Aucun lien vers GitHub ou les documents du projet n’est affiché dans le guichet. Les données du formulaire restent dans la page. La politique de référent masque l’adresse d’origine. |
| Dépôt public | Les sources et les documents de conception contiennent les structures utiles à la recette. Les classeurs sources, exports, cartes et coordonnées réels sont exclus de la publication. Les tickets, captures d’écran et journaux de diagnostic doivent suivre la même règle. |

### Fiche de traitement proposée pour le pilote interne

**Ludion.** GitHub Pages distribue l’entrée du guichet. La base Supabase à Paris autorise l’accès Agent pour les seuls navigateurs préalablement activés par un administrateur. L’accès Administrateur est protégé par un mot de passe. Fiches, activités des 30 derniers jours et réservations futures, paramètres et habilitations sont partagés. Les notes restent dans les fiches détaillées. La clôture Europe/Paris actualise les totaux agrégés et ne purge les participations et références de reprise que lorsqu’elles datent de plus de 30 jours. La démonstration autonome sert aux essais locaux. Le client connecté est publié avec une clé publishable publique ; les mots de passe et secrets serveur restent exclus du dépôt. GitHub Pages reçoit les requêtes de ressources ; les données et l’authentification passent directement par Supabase. Ce montage de développement ne valide aucun hébergement de données réelles. Voir [le guide](DEVELOPPEMENT.md) et [la recette complète](RECETTE-GUICHET.md).

| Élément à inscrire au registre | Proposition à instruire |
|---|---|
| Responsable, contacts et périmètre | Identifier la personne morale effectivement responsable (Ville ou Métropole selon l’organisation), le service gestionnaire, le DPD et les éventuels prestataires. |
| Finalités | Gérer les consultations sur place et les places réservées aux activités. Produire des bilans agrégés. Exclure le profilage des lecteurs et les historiques de recommandations individuelles. |
| Fondement | Examiner la mission d’intérêt public pour chaque finalité, avec le texte qui fonde la mission et la nécessité des champs collectés. Documenter la décision au titre des articles 6.1.e et 6.3. |
| Personnes | Usagers, mineurs et accompagnateurs. En JV et en animation sur inscription, chaque participant inscrit dispose de sa carte. L’âge est requis à l’inscription à une animation. |
| Données | Carte et identifiant interne, nom facultatif, séance, secteur, effectifs, âge ponctuel si nécessaire. La fiche propose aussi une date de naissance facultative et une note interne. Documenter le besoin précis de la date complète avant le pilote et encadrer les notes. Conserver les participations nominatives 30 jours glissants et les agrégats anonymes au-delà. Une trace privée minimale UUID/date sert au quota JV jusqu’à la fin de la journée, sans jeu ni horaire. |
| Accès et flux | Accès selon le profil agent ou administrateur. DSI selon ses missions de maintenance. Décrire hébergement, sauvegardes, sous-traitants, éventuels transferts et garanties. Instruire l’article 28 si un prestataire traite ces données pour la collectivité. |
| Risques | Rapprochement de trois activités, visibilité des pratiques de mineurs, exports et écran partagé. Consigner avec le DPD l’examen du risque élevé et réaliser une analyse d’impact avant traitement si les critères de l’article 35 sont remplis. |
| Sort final | Définir séparément les échéances des inscriptions après séance, des consultations nominatives, des fiches inactives, des journaux, fichiers d’import, corbeilles et sauvegardes. Faire valider le tableau de gestion et les modalités d’élimination avec les archives compétentes. |

**Information au guichet.** Avant la première collecte, préparer une notice courte et une version complète accessibles aux familles. Renseigner l’identité et les contacts du responsable et du DPD, les finalités, base légale, destinataires, durées ou critères, champs obligatoires et facultatifs, effets du refus et réclamation auprès de la CNIL. Expliquer simplement les droits applicables et le circuit de demande. Le démarrage se fait sans reprise nominative.

**Projet de notice courte à compléter et à faire valider.**

> [Responsable de traitement] utilise Ludion pour gérer les consultations et les inscriptions aux activités de la médiathèque, et établir des statistiques agrégées. Le personnel habilité accède aux informations utiles à l’accueil. Les participations nominatives sont conservées 30 jours après l’activité. Pour connaître les autres durées, les informations nécessaires à votre activité et les modalités d’exercice de vos droits, consultez [notice complète] ou contactez [contact officiel du DPD].

[Modèles d’information de la CNIL](https://www.cnil.fr/fr/passer-laction/rgpd-exemples-de-mentions-dinformation)

**Exercice des droits.** Prévoir une demande au guichet ou via le canal officiel de la collectivité. Vérifier l’identité de façon proportionnée. Rechercher la carte dans les trois activités, distinguer les participants d’une même famille, corriger les données ou en limiter l’usage, instruire opposition ou effacement selon le fondement applicable. Répondre en principe sous un mois et documenter toute prolongation selon l’article 12. Tester le parcours avec deux cartes fictives homonymes.

### Conditions techniques de la version de service

| Domaine de revue | Décision et preuve attendues |
|---|---|
| Accès au guichet | Accès réservé aux agents habilités via la session professionnelle ou l’authentification unique existante. Aucun nouveau formulaire d’inscription pour les agents. Tester qu’un poste public ou un agent sorti du service perd l’accès, y compris via l’interface de programmation. |
| Exploitation | Hébergement approuvé, chiffrement des échanges, secrets hors du dépôt, validation des entrées côté serveur, contrôle d’accès à chaque opération, protection des sessions, correctifs et suivi des dépendances. Définir les responsabilités d’exploitation. |
| Traçabilité | Tracer les opérations nécessaires, en particulier exports, modifications en masse et accès de maintenance. Réserver l’accès aux traces, éviter noms, numéros de carte et contenus de consultation dans les journaux techniques. Prévoir un canal privé de signalement. |
| Sauvegardes et archives | Tester sauvegarde chiffrée, restauration isolée, purge autorisée et réapplication des suppressions après restauration. Conserver le résultat daté de l’exercice. |
| Gestion des incidents | En cas d’incident, contenir, conserver les éléments nécessaires et consigner la violation. Si elle présente un risque pour les personnes, notifier la CNIL si possible sous 72 h après en avoir pris connaissance. En cas de risque élevé, examiner l’information des personnes dans les conditions de l’article 34. |
| Accessibilité | Déterminer le périmètre RGAA du service interne. Auditer clavier et lecteur d’écran, focus des fenêtres, annonces des erreurs et places, calendrier, contrastes, zoom et petits écrans. Documenter les écarts, le contact accessible, la déclaration applicable et le plan de correction avant diffusion institutionnelle. |
| Droits et publication | Valider le titulaire des droits, le mode de diffusion, les mentions d’éditeur, directeur de publication et hébergeur du futur service selon le support. Vérifier les droits sur les contenus et visuels ajoutés. Voir [Droits et composants](DROITS.md). |

### Incident au guichet

1. Consigner la date, l’heure, le poste et le symptôme. En cas de poste compromis ou perdu, révoquer son accès depuis **Administration → Accès des agents → Gérer les postes agents**.
2. Alerter le responsable de service, la DSI et le DPD via leur canal interne. Conserver les éléments nécessaires dans un espace privé approuvé. Les signalements GitHub sont réservés aux défauts du logiciel et aux exemples fictifs.
3. Laisser le responsable de traitement qualifier le risque et décider des notifications avec le DPD. Pour une violation présentant un risque pour les personnes, le délai de notification à la CNIL est de 72 heures si possible. Vérifier les accès et les fonctions métier avant reprise. [Téléservice de notification CNIL](https://cnil.fr/fr/services-en-ligne/notifier-une-violation-de-donnees-personnelles)

**Décision d’ouverture.** Le responsable de service inscrit la date, le périmètre du pilote, les avis recueillis, les écarts résiduels, leurs responsables et leurs échéances. La recette exige au minimum une vérification des accès sur deux postes, une preuve de restauration, un essai des droits des usagers, une vérification de la purge et une revue d’accessibilité. Les essais de démonstration utilisent des cartes et des noms inventés sur un environnement séparé.

### Références officielles

- [RGPD, notamment articles 5, 6, 12 à 22, 25, 28, 30 et 32 à 35](https://eur-lex.europa.eu/eli/reg/2016/679/oj/fra)
- [CNIL — principes clés pour les collectivités territoriales](https://www.cnil.fr/fr/collectivites-territoriales/les-principes-cles-de-la-protection-des-donnees)
- [Code du patrimoine, livre II consacré aux archives](https://www.legifrance.gouv.fr/codes/id/LEGISCTA000006129161/)
- [Direction interministérielle du numérique — obligations d’accessibilité](https://design.numerique.gouv.fr/accessibilite-numerique/cadre-legal/)

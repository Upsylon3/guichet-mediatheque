# Revue du projet par la collectivité
**État au 13 novembre 2026 · document préparatoire pour la direction, la DSI, le DPD et les archives.**

### Pilotage par une seule personne

Un seul porteur de projet peut développer, documenter, exécuter les essais successivement sur deux postes et consigner les résultats. Les domaines de revue ci-dessous servent de liste de travail. Pour chaque décision institutionnelle, inscrire le contact compétent de la collectivité lorsqu’il est identifié et conserver la décision reçue. Une fonction absente de la médiathèque peut relever d’un service mutualisé. Les agents qui se relaient disposent des commandes du guichet. Les comptes administrateurs gèrent les réglages et les habilitations.

### Ce qui circule aujourd’hui

| Situation | Données et destination |
|---|---|
| Ouverture de la démonstration publique | L’hébergeur de la page reçoit la requête web et ses métadonnées techniques. Le lien de prévisualisation du dépôt passe par un hébergeur tiers. L’ouverture du fichier téléchargé permet un essai local. |
| Saisie fictive | La page accepte les cartes au format ESSAI- suivi de 1 à 4 chiffres. Les formulaires travaillent en mémoire. Le rechargement efface la session. Les noms et les champs libres restent des zones de saisie manuelle réservées aux exemples inventés. |
| Ressources | Une page HTML autonome, polices système, aucun script distant, aucune mesure d’audience intégrée. Une politique de sécurité restreint scripts et styles à leurs empreintes et bloque les connexions applicatives et les envois de formulaires. |
| Catalogue et documentation | Un clic explicite ouvre le site choisi. Les données du formulaire restent dans la page. La politique de référent masque l’adresse d’origine. |
| Dépôt public | Les sources et les documents de conception contiennent les structures utiles à la recette. Les classeurs sources, exports, cartes et coordonnées réels sont exclus de la publication. Les tickets, captures d’écran et journaux de diagnostic doivent suivre la même règle. |

### Fiche de traitement proposée pour le pilote interne

| Élément à inscrire au registre | Proposition à instruire |
|---|---|
| Responsable, contacts et périmètre | Identifier la personne morale effectivement responsable (Ville ou Métropole selon l’organisation), le service gestionnaire, le DPD et les éventuels prestataires. |
| Finalités | Gérer les consultations sur place et les places réservées aux activités. Produire des bilans agrégés. Exclure le profilage des lecteurs et les historiques de recommandations individuelles. |
| Fondement | Examiner la mission d’intérêt public pour chaque finalité, avec le texte qui fonde la mission et la nécessité des champs collectés. Documenter la décision au titre des articles 6.1.e et 6.3. |
| Personnes | Usagers, mineurs et accompagnateurs. Lorsqu’un enfant accompagne un adulte, un décompte suffit si l’organisation de la séance le permet. |
| Données | Carte et identifiant interne, nom facultatif, séance, secteur, effectifs, âge ponctuel si nécessaire. Préférer la tranche d’âge à la date de naissance. Pour les statistiques, examiner le besoin de garder un lien à la carte après la séance. |
| Accès et flux | Accès selon le profil agent ou administrateur. DSI selon ses missions de maintenance. Décrire hébergement, sauvegardes, sous-traitants, éventuels transferts et garanties. Instruire l’article 28 si un prestataire traite ces données pour la collectivité. |
| Risques | Rapprochement de trois activités, visibilité des pratiques de mineurs, exports et écran partagé. Consigner avec le DPD l’examen du risque élevé et réaliser une analyse d’impact avant traitement si les critères de l’article 35 sont remplis. |
| Sort final | Définir séparément les échéances des inscriptions après séance, des consultations nominatives, des fiches inactives, des journaux, fichiers d’import, corbeilles et sauvegardes. Faire valider le tableau de gestion et les modalités d’élimination avec les archives compétentes. |

**Information au guichet.** Avant la première collecte, préparer une notice courte et une version complète accessibles aux familles. Renseigner l’identité et les contacts du responsable et du DPD, les finalités, base légale, destinataires, durées ou critères, champs obligatoires et facultatifs, effets du refus et réclamation auprès de la CNIL. Expliquer simplement les droits applicables et le circuit de demande. Le démarrage se fait sans reprise nominative.

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

**Décision d’ouverture.** Le responsable de service inscrit la date, le périmètre du pilote, les avis recueillis, les écarts résiduels, leurs responsables et leurs échéances. La recette exige au minimum une vérification des accès sur deux postes, une preuve de restauration, un essai des droits des usagers, une vérification de la purge et une revue d’accessibilité. La démonstration publique peut être présentée dès maintenant avec des cartes et des noms inventés.

### Références officielles

- [RGPD, notamment articles 5, 6, 12 à 22, 25, 28, 30 et 32 à 35](https://eur-lex.europa.eu/eli/reg/2016/679/oj/fra)
- [CNIL — principes clés pour les collectivités territoriales](https://www.cnil.fr/fr/collectivites-territoriales/les-principes-cles-de-la-protection-des-donnees)
- [Code du patrimoine, livre II consacré aux archives](https://www.legifrance.gouv.fr/codes/id/LEGISCTA000006129161/)
- [Direction interministérielle du numérique — obligations d’accessibilité](https://design.numerique.gouv.fr/accessibilite-numerique/cadre-legal/)

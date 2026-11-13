# Recette de l’annuaire partagé

Recette du 13 novembre 2026, avec des identités exclusivement fictives. Reprise du dépôt à `77981a8` ; depuis le point de départ `25c98e3` de la passation, seul le document de passation avait été ajouté.

## Environnement et périmètre

Supabase distant, projet de développement **guichet-mediatheque-dev**, organisation **PC Value**, région **Paris**. Docker local n’a pas pu démarrer : WSL indique l’absence de la fonctionnalité Virtual Machine Platform et de la virtualisation. Le choix d’une base distante a été demandé explicitement pour conserver Vanguard. Aucune modification de ces protections n’a été effectuée.

Les trois migrations du dépôt ont été appliquées dans une base neuve. Deux comptes Auth fictifs ont été provisionnés, puis habilités côté serveur. L’interface de développement appelle les véritables API Auth et PostgREST du projet. La synchronisation procède par lecture paginée toutes les deux secondes, sans charger les notes. Les activités restent en mémoire ; elles ne constituent pas encore des écritures partagées.

## Essais réellement exécutés

La suite `npm test` utilise deux contextes Chromium indépendants, Agent et Administrateur, sur le même ordinateur. Elle vérifie les écritures dans la véritable base distante ; aucun faux serveur de base n’est utilisé.

| Vérification | Résultat observé |
|---|---|
| Connexion des deux comptes | Profils distincts lus au serveur. Le rôle du sélecteur de démonstration n’accorde aucun droit. |
| Accès anonyme | Lecture de l’annuaire refusée. |
| Validation des cartes côté serveur | Six ou huit chiffres, lettres, espaces et ESSAI refusés dans la base de développement. Les zéros initiaux sont conservés. |
| Création Agent → seconde session | La fiche apparaît chez l’Administrateur sans rechargement. Prénom, nom et naissance se retrouvent. |
| Complément et note | Les corrections sont partagées. La note se charge uniquement dans la fiche détaillée et reste absente des listes, recherches et formulaires de passage. |
| Trois activités | Le nom connu se retrouve dans les formulaires de jeux de société, de jeux vidéo et d’animation. Une inscription refusée par la jauge ne crée aucune fiche. |
| Deux scans concurrents | Deux validations sur la même nouvelle carte produisent une seule ligne en base. Le prénom, le nom et la naissance peuvent être complétés ensuite dans la page, sans déplacement du focus vers l’identité. |
| Suppression Agent | Appel RPC refusé avec HTTP 403 / SQLSTATE 42501. DELETE direct : aucune ligne supprimée, fiche toujours présente. |
| Suppression Administrateur | Suppression effective en base et disparition dans la session Agent. |
| Coupure réseau avant écriture | Carte, boîte et compléments conservés, erreur annoncée ; aucune fiche en attente avant confirmation. La reprise réussit. |
| Réponse perdue après écriture | La première création a été commise, puis sa réponse interrompue. La nouvelle tentative conserve une seule fiche. |
| Session expirée | Le formulaire de connexion réapparaît ; reconnexion sans recharger la page ni perdre le brouillon. |
| Démonstration publique | Parcours jeux de société, jeux vidéo et animation avec ESSAI-01 ; aucune connexion distante ; largeur 360 px sans débordement horizontal ; rechargement effaçant les données. |
| Vérification SQL sans habilitation | Une fiche fictive insérée dans une transaction reste invisible au rôle authentifié non habilité ; insertion et auto-attribution d’un rôle refusées. Transaction annulée après essai. |
| Contrôles de source | Empreintes CSP vérifiées, scripts Python compilables, `git diff --check` sans erreur. |

Les fiches créées par la suite sont supprimées à la fin par sa session Administrateur. Les comptes fictifs sont conservés pour rejouer la recette. Les mots de passe et la configuration locale restent exclus du dépôt. Les fichiers `test-results/recette.json` et les deux captures de session constituent les preuves locales.

**Contrôle Auth validé :** après enregistrement du réglage dans le tableau de bord, `/auth/v1/settings` renvoie `disable_signup: true`. Le test automatisé « Supabase Auth : inscription publique désactivée » a été rejoué seul et passe, sans échec. Le scénario fonctionnel à deux sessions avait déjà passé sur ce même code. Les deux tests de cette tranche sont donc validés ; le blocage de configuration est levé.

Les conseillers Supabase ne signalent pas de table publique sans RLS. Ils relèvent deux avertissements de configuration distincts de cette tranche : protection contre les mots de passe compromis désactivée sur ce projet d’essai, et politiques SELECT redondantes préexistantes sur `postes`. Aucune dépendance n’est ajoutée à l’application livrée ; Playwright sert uniquement à la recette.

## Essais restant à faire

- Rejouer sur deux ordinateurs physiques du guichet, avec douchette réelle, clavier et réseau représentatifs ; mesurer les cibles de latence proposées au cahier des charges.
- Vérifier sur le Supabase local Docker lorsque cet environnement est disponible ; il n’a pas été exécuté sur ce poste.
- Après raccordement des activités : contraintes globales sur les fiches liées, réservations atomiques, conflits de capacité, réglages partagés, clôture Europe/Paris et reprise après interruption.
- Avant tout pilote réel : accessibilité complète, sauvegarde/restauration, purge et validations institutionnelles du dossier de revue.


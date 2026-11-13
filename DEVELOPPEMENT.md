# Développer et lancer le guichet partagé

## Deux entrées distinctes

`index.html` conserve la démonstration publique autonome : cartes ESSAI, fiches et activités en mémoire, réglages locaux, politique CSP interdisant les connexions applicatives.

`dev/index.html` ouvre le guichet partagé avec authentification. Ses scripts et styles sont dans `dev/`. La configuration `dev/config.json` contient seulement l’URL API et une clé **publishable** publique. La clé n’accorde aucun accès aux tables sans authentification et habilitation. Aucun secret service_role ni mot de passe n’est publié.

Le projet Supabase **guichet-mediatheque-dev**, organisation **PC Value**, région **Paris**, est réservé aux données fictives. L’offre gratuite était annoncée à 0 $/mois lors de la création. Le choix distant évite Docker et toute modification de Vanguard ou de la virtualisation.

## Ouvrir depuis plusieurs postes

Ouvrir [le guichet de développement](https://raw.githack.com/Upsylon3/guichet-mediatheque/main/dev/index.html) dans deux profils de navigateur distincts ou sur deux ordinateurs. Les comptes fictifs Agent et Administrateur sont fournis dans le document d’accès privé. Aucun formulaire d’inscription n’est proposé ; le serveur confirme `disable_signup: true` et l’authentification anonyme est désactivée.

Le navigateur conserve les jetons uniquement en mémoire. Un rechargement déconnecte la session. Après expiration, la connexion réapparaît et permet de se reconnecter sans effacer les champs encore affichés. Les données confirmées sont conservées dans la base partagée.

## Lancer localement

Prérequis d’utilisation : Python 3.10+ et un navigateur récent. Depuis la racine du dépôt :

```text
python scripts/serve-dev.py --config dev/config.json
```

Ouvrir `http://127.0.0.1:8000/dev.html`, ou `/` pour la démonstration autonome. Le serveur écoute exclusivement sur `127.0.0.1` et sert une liste précise de ressources ; il ne sert pas les fichiers privés.

Une configuration locale non versionnée peut remplacer la configuration publique :

```json
{
  "SUPABASE_URL": "https://REFERENCE.supabase.co",
  "ANON_KEY": "sb_publishable_CLE_PUBLIQUE"
}
```

Enregistrer ce contenu dans `.env.local.json`, puis lancer `python scripts/serve-dev.py`. Ne jamais y placer de clé secrète. Pour construire l’entrée statique après modification de son gabarit, exécuter `python scripts/build-dev.py`. Ce script refuse les clés secrètes et service_role. Ne pas utiliser un serveur statique générique sur un dossier contenant des mots de passe.

## Préparer une base neuve

Appliquer tous les fichiers de `supabase/migrations/` dans l’ordre de leur nom, une seule fois. Les migrations du projet de développement ont déjà été appliquées ; ne pas les rejouer sur cette base. Docker/Supabase local reste possible sur une autre machine compatible mais n’est pas nécessaire et n’a pas été utilisé pour cette recette.

Dans Authentication → Sign In / Providers, désactiver **Allow new users to sign up** et enregistrer. Vérifier par `GET /auth/v1/settings`, avec l’en-tête `apikey`, que `disable_signup` vaut `true` et que `external.anonymous_users` vaut `false`.

Créer les comptes via l’administration Auth du service, sans invitation publique, puis attribuer leur rôle dans `guichet_prive.habilitations` depuis l’administration SQL privilégiée. Pour une base d’essai neuve seulement, `python scripts/prepare-dev-accounts.py` prépare deux comptes inventés, des mots de passe aléatoires dans `.env.accounts.json` et un fichier privé `.env.provision.sql`. Appliquer ce dernier une seule fois, puis le supprimer. Cette aide dépend du schéma Auth inspecté pour le développement ; le provisionnement d’exploitation doit passer par l’API d’administration Auth et le circuit de la DSI.

Les administrateurs peuvent ensuite modifier les habilitations des comptes existants dans l’interface. Aucun agent ne peut s’attribuer un rôle. Le dernier administrateur ne peut pas être retiré. Le rôle est relu dans la base et ne dépend pas des métadonnées modifiables d’un utilisateur ni d’un sélecteur client.

## Modèle et transactions

Les fiches ont un identifiant technique UUID stable et une carte unique de sept chiffres conservée en texte. Les notes ne sont chargées qu’à l’ouverture de la fiche détaillée. Les corrections utilisent une révision attendue ; un conflit garde le brouillon et présente la version du serveur. Une fusion exige un aperçu et une confirmation et reste annulable pendant la journée si les fiches et activités transférées n’ont pas changé. Aucun rapprochement par nom n’est automatique.

Les tables d’activités, paramètres, opérations et totaux sont privées. Leurs politiques RLS sont fermées et aucun droit direct n’est attribué au client. Deux façades publiques appellent un service privé qui vérifie l’identité et les droits à chaque opération. Les fonctions privilégiées ont un `search_path` vide et des droits d’exécution explicites.

Le service sérialise les mutations avec un verrou transactionnel commun, adapté au faible volume du guichet. Cela coordonne réservations, chevauchements de cartes, changements de paramètres, restaurations et clôture. Les places d’un groupe sont attribuées toutes ensemble. Une erreur annule également la création des fiches inconnues dans ce groupe. Un identifiant de tentative permet de rejouer une réponse perdue sans doublon. Réutiliser cet identifiant avec une autre saisie est refusé.

Les erreurs de conflit métier utilisent `PT409`, et non `40001`, afin de répondre immédiatement sans déclencher les nouvelles tentatives automatiques de PostgREST. Les fiches, activités et réglages vérifient leurs versions avant correction.

## Activités et réglages

Les consultations proposent carte, boîte, enfants, adultes, date et secteur. Le dernier secteur est mémorisé sur le poste. Les titres inconnus restent à compléter dans les réglages des boîtes.

Les jeux vidéo acceptent plusieurs cartes et accompagnateurs dans une seule validation. Le premier joueur fixe le jeu ; les places libres rejoignent ce jeu. Après la dernière annulation, le choix redevient libre. Les déplacements et restaurations revérifient places, compatibilité et chevauchements. Le formulaire conserve jour, poste, heure et jeu après inscription et vide les identités.

Chaque poste possède sa capacité de 1 à 4 et ses jeux. Une grille par jour de semaine peut remplacer la grille habituelle ; une exception datée est prioritaire. Une journée ou un poste fermé ne peut pas recevoir de nouvelles réservations. Une modification incompatible avec une réservation existante est refusée.

Les animations proposent les métadonnées du cahier des charges, les conditions d’âge, les dates d’ouverture, un lien facultatif vers un visuel, une jauge et le comptage ou l’inscription. Un groupe peut utiliser plusieurs fois la même carte pour des participants distincts, enfants ou adultes, avec âge en ans ou en mois. Les accompagnateurs comptent selon la règle de jauge choisie. Les séries hebdomadaires et mensuelles traversent l’année ; les exceptions personnalisées sont préservées. Modification et suppression proposent une séance, celle-ci et les suivantes ou toute la série avec aperçu. Les modèles réutilisables ne recopient pas les inscrits.

Les vues tableau permettent filtre, sélection, correction, déplacement, export et import selon les droits. Le collage propose un aperçu puis confirme tout le lot dans une transaction. Les exports n’incluent pas les notes ; importer les cartes comme texte dans un tableur pour conserver leurs zéros initiaux. Les réglages et leurs délégations sont partagés. La suppression d’une fiche reste réservée aux administrateurs, sans délégation possible.

## Clôture et confidentialité

Une tâche PostgreSQL Cron active s’exécute chaque minute et calcule la date selon **Europe/Paris**. Les lectures et écritures du guichet rattrapent aussi la clôture avant de répondre. Les réponses excluent les journées passées. La même transaction agrège les totaux, supprime les anciennes activités et leurs liens, puis purge les anciennes références de reprise et de fusion. Rejouer la clôture ne double pas les totaux. Les fiches et réservations futures survivent.

La corbeille concerne le jour courant et les réservations futures. La restauration revérifie la capacité ; elle ne force pas une place déjà prise. La clôture supprime également les anciennes lignes de corbeille. Une fiche encore liée à une activité ou à la corbeille ne peut pas être supprimée, même par une requête DELETE directe depuis un autre poste.

Les totaux comptent les personnes déclarées, accompagnateurs compris ; la jauge d’une animation peut exclure les accompagnateurs selon son réglage. Les totaux ne mesurent pas une présence effective et ne conservent aucun lien nominatif passé.

## Rejouer la recette

Node.js 22+ est requis seulement pour les tests. Préparer `.env.local.json` et `.env.accounts.json` avec les deux comptes fictifs, puis :

```text
npm ci
npx playwright install chromium
npm test
```

Les tests démarrent leurs propres serveurs temporaires et utilisent les vraies API Auth et PostgREST. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permet de réutiliser un Chromium de test existant ; `GUICHET_ORIGIN` permet de choisir un serveur déjà lancé. Résultats et captures fictives sont dans `test-results/`, ignoré par Git.

Les tests créent des données fictives, annulent leurs activités et consignent leurs identifiants dans `.env.test-cleanup.json` pour un nettoyage privilégié ciblé. Ces fichiers ne sont jamais publiés. Ne lancer cette recette que sur une base de développement réservée aux essais.

Le fichier `supabase/tests/cloture.sql` teste la clôture, les totaux, la purge, le replay et les réservations futures dans une transaction privilégiée **annulée par ROLLBACK**. Il a été exécuté sur le projet distant. Le workflow GitHub lance `npm run test:demo` et les contrôles de source, sans secrets ; il ne remplace pas les tests connectés.

Après édition du script ou du style intégré à la démonstration, recalculer sa CSP avec `python scripts/check-csp.py --write`. Les modifications du client connecté n’exigent pas d’affaiblir la politique de la page publique.

La recette sur deux ordinateurs physiques, la douchette, les mesures de latence représentatives, l’audit complet d’accessibilité et la restauration d’exploitation restent à réaliser sur l’infrastructure autorisée de la collectivité. L’URL publique connectée est une entrée de développement fictive ; elle n’autorise aucun usage de données réelles.

# Annuaire partagé en développement

Cette entrée emploie exclusivement des données fictives. Elle peut utiliser Supabase distant sans Docker, WSL ou modification de Vanguard. Le projet de développement est distinct d’un futur serveur de service.

## Lancer l’interface

Prérequis : Python 3.10 ou ultérieur et un navigateur récent. Aucune dépendance JavaScript n’est nécessaire pour utiliser l’application.

1. À la racine du dépôt, créer `.env.local.json` avec l’URL API et la clé **publishable** (ou la clé anon locale) du projet :

   ```json
   {
     "SUPABASE_URL": "https://REFERENCE.supabase.co",
     "ANON_KEY": "sb_publishable_CLE_PUBLIQUE_DU_PROJET"
   }
   ```

2. Lancer `python scripts/serve-dev.py` depuis la racine du dépôt.
3. Ouvrir `http://127.0.0.1:8000/dev.html` et se connecter avec un compte fictif du service. Le dossier local préparé pour cette recette contient déjà la configuration et `.env.accounts.json`, qui conserve les deux identifiants et mots de passe de test.

Le serveur n’écoute que sur `127.0.0.1` et ne sert que les ressources prévues. Les fichiers `.env.*`, dont les mots de passe, ne sont jamais servis ni versionnés. Ne pas placer de clé service_role ou de clé secrète dans la configuration de l’interface. Éviter un serveur statique générique dans un dossier contenant ces fichiers privés.

`http://127.0.0.1:8000/` ouvre la démonstration publique autonome. Le fichier `index.html` peut toujours s’ouvrir directement, sans serveur. Les connexions sont bloquées par sa politique CSP ; seul `/dev.html`, généré à la demande depuis cette même interface, reçoit le client de développement et l’autorisation de contacter l’origine Supabase configurée. Le dépôt public ne contient aucune configuration de connexion active.

## Préparer une base d’essai vide

1. Créer un projet Supabase de développement. Pour la recette du 13 novembre 2026 : organisation **PC Value**, projet **guichet-mediatheque-dev**, région **Paris**, offre gratuite annoncée à 0 $/mois lors de la création. Le projet n’est destiné qu’aux essais fictifs.
2. Appliquer, dans cet ordre, les trois fichiers de `supabase/migrations/` avec la CLI ou le connecteur Supabase. Ne jamais rejouer une migration déjà appliquée ni réinitialiser une base existante pour suivre ce guide.
3. Dans **Authentication → Sign In / Providers**, désactiver **Allow new users to sign up**, puis enregistrer. Vérifier que `GET /auth/v1/settings`, avec la clé publique en en-tête `apikey`, renvoie `disable_signup: true`. Vérifier aussi que l’authentification anonyme est désactivée.
4. Créer les comptes fictifs via l’administration Auth du service, sans envoyer d’invitation, et attribuer leurs profils via l’éditeur SQL privilégié :

   ```sql
   insert into guichet_prive.habilitations(compte,profil)
   values ('UUID_DU_COMPTE_AGENT','agent'),
          ('UUID_DU_COMPTE_ADMINISTRATEUR','administrateur');
   ```

Pour une **base de développement neuve uniquement**, `python scripts/prepare-dev-accounts.py` prépare les deux comptes `agent@guichet.example` et `administrateur@guichet.example`, avec des mots de passe aléatoires dans `.env.accounts.json`. Appliquer le fichier privé `.env.provision.sql` depuis l’éditeur SQL privilégié, une seule fois, puis le supprimer. Cette aide insère les comptes fictifs dans le schéma Auth inspecté pour cette recette ; elle n’est ni une migration ni une procédure de provisionnement pour l’exploitation. Pour celle-ci, utiliser l’API d’administration Auth et le circuit validé par la DSI.

Le rôle est lu depuis `guichet_prive.habilitations` côté serveur. Aucun sélecteur client, attribut utilisateur ou formulaire d’inscription ne permet de le modifier. Un compte Auth sans habilitation ne peut ni lire ni écrire les fiches. La fonction `supprimer_usager` refuse explicitement l’agent avec HTTP 403 ; une requête DELETE directe est aussi filtrée par RLS et ne supprime aucune ligne.

## Essayer depuis deux sessions

Ouvrir l’entrée de développement dans deux profils de navigateur séparés, ou une fenêtre normale et une fenêtre privée. Se connecter comme Agent dans la première et Administrateur dans la seconde.

- Depuis **Usagers**, créer une fiche fictive avec une carte telle que `0000123`, après avoir vérifié son absence. La seconde session doit la voir apparaître sans rechargement, à la prochaine synchronisation.
- Compléter le prénom, le nom et la naissance : chacun reste facultatif. Dans les trois formulaires de passage, le nom connu apparaît en lecture seule. La note reste dans la fiche détaillée.
- Scanner simultanément une nouvelle carte dans les deux formulaires de jeux de société et confirmer les passages. Une seule fiche doit exister en base. Après confirmation, **Fiches à compléter** apparaît dans la page, sans déplacer le curseur vers l’identité.
- L’agent ne voit pas la suppression. Un appel manuel à la fonction de suppression avec sa session doit aussi recevoir HTTP 403. L’administrateur peut supprimer une fiche sans activité liée dans sa session ; l’autre session voit sa disparition.
- Couper l’accès réseau avant une écriture : le formulaire reste rempli et affiche « Écriture non confirmée ». Rétablir la connexion, puis réessayer. Une réponse perdue après création est également rejouable sans doubler la fiche.

L’annuaire est partagé ; les activités sont encore en mémoire. Le blocage de suppression d’une fiche liée ne couvre donc à ce stade que les activités de la session courante. Le contrôle global des liens deviendra possible avec les tables d’activité et leurs contraintes serveur. Les réglages de démonstration restent propres au navigateur. Le rechargement termine la session de connexion ; les jetons ne sont pas stockés. Après expiration d’une session, le formulaire de connexion réapparaît et permet une reconnexion sans effacer la saisie.

## Rejouer les essais automatisés

Avec le serveur de développement lancé et les deux fichiers `.env.local.json` et `.env.accounts.json` présents :

```text
npm ci
npx playwright install chromium
npm test
```

Node.js 22 ou ultérieur est requis uniquement pour ces tests. `GUICHET_ORIGIN` permet de changer l’adresse du serveur de test. `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permet de réutiliser un Chromium de test déjà installé. Les tests utilisent deux contextes de navigateur indépendants et les véritables API Auth/PostgREST du projet configuré. Ils créent des cartes fictives aléatoires, puis suppriment uniquement leurs propres fiches via la session administrateur. À réserver à une base d’essai.

Le résultat et les captures fictives sont écrits dans `test-results/`, ignoré par Git. Les captures ne contiennent ni mot de passe ni jeton. La suite vérifie aussi les trois activités de la page publique à 360 px. Après modification du script ou du style intégré à `index.html`, recalculer ses empreintes avec `python scripts/check-csp.py --write` avant de lancer la recette.

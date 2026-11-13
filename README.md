# Guichet médiathèque

Un annuaire commun et trois activités partagés entre les postes d’accueil.

**[Ouvrir le guichet partagé de développement](https://raw.githack.com/Upsylon3/guichet-mediatheque/main/dev/index.html)** · **[Démonstration publique autonome](https://raw.githack.com/Upsylon3/guichet-mediatheque/main/index.html)**

**Données fictives uniquement.** Le guichet connecté utilise un projet Supabase de développement à Paris. Il ne nécessite ni Docker, ni WSL, ni modification de Vanguard. Les comptes sont attribués par le service et l’inscription publique est désactivée.

## Ce qui est partagé

- Annuaire : cartes de sept chiffres avec zéros initiaux, identité facultative après passage, note dans la fiche détaillée, fusion manuelle réversible. La suppression reste réservée à l’administration et bloquée par les liens actifs ou la corbeille.
- Jeux de société : boîte, titre connu ou à compléter, secteur, date, enfants/adultes, correction, déplacement, sélection et annulation.
- Jeux vidéo : plusieurs joueurs confirmés ensemble, accompagnateurs inclus, contrôle serveur des places, jeux et chevauchements, alternatives, déplacement d’une personne ou d’un groupe.
- Animations : calendrier et tableau, séances, séries hebdomadaires ou mensuelles, exceptions, modèles, enfants/adultes, âge en ans ou mois, inscriptions de groupes et comptage en entrée libre.
- Administration : postes, jeux, capacités de 1 à 4, grilles par jour de semaine, exceptions datées, fermetures, boîtes, types et modèles d’animation, raccourcis et habilitations.
- Tables filtrables, imports avec aperçu puis transaction complète, exports des lignes sélectionnées selon les droits, corbeille et annulation.

Les autres sessions reçoivent les modifications sans rechargement. Les conflits et échecs réseau conservent la saisie. Au changement de date selon Europe/Paris, le serveur garde les totaux par jour et activité et supprime les anciennes participations nominatives, y compris les références de reprise et d’annulation. Les réservations futures et les fiches restent conservées.

## Utiliser ou développer

Le lien du guichet connecté peut s’ouvrir dans deux profils de navigateur ou depuis deux ordinateurs. Utiliser les comptes fictifs fournis séparément. La configuration publiée contient uniquement l’URL Supabase et sa clé publique ; aucun mot de passe ni secret d’administration.

Pour travailler localement, lancer `python scripts/serve-dev.py --config dev/config.json`, puis ouvrir `http://127.0.0.1:8000/dev.html`. Python 3.10 ou ultérieur suffit pour l’interface. La configuration privée `.env.local.json` peut aussi être utilisée, comme décrit dans le guide.

La page `index.html` reste autonome : cartes ESSAI, utilisateurs et activités en mémoire, réglages de démonstration propres au navigateur, aucune connexion applicative. Elle peut toujours s’ouvrir directement depuis le disque.

**[Guide de développement et lancement](DEVELOPPEMENT.md)** · **[Recette complète](RECETTE-GUICHET.md)** · **[Cahier des charges](CAHIER-DES-CHARGES.md)** · **[Revue de la collectivité](REVUE-COLLECTIVITE.md)** · **[Droits et composants](DROITS.md)**

## Vérifications

Avec les deux comptes fictifs configurés localement : `npm ci`, `npx playwright install chromium`, puis `npm test`. Les tests démarrent leurs propres serveurs temporaires. Le workflow GitHub vérifie la démonstration et les sources sans recevoir les mots de passe des comptes. Les essais connectés et la recette SQL de clôture ont aussi été exécutés sur la véritable base distante.

Le serveur interne, l’usage de données réelles, les sauvegardes d’exploitation et les validations institutionnelles restent à organiser avec la collectivité. Cette version fournit le développement partagé et sa recette fictive.

# Guichet médiathèque

Une carte commune pour les consultations de jeux de société, les créneaux de jeux vidéo et les inscriptions aux animations.

**[Lire le cahier des charges](CAHIER-DES-CHARGES.md)** · **[Ouvrir la démonstration](https://raw.githack.com/Upsylon3/guichet-mediatheque/main/index.html)**

### Essayer à deux collègues

1. En **Jeux de société**, enregistrer une consultation en Jeunesse avec la carte fictive `ESSAI-01` et un nom inventé.
2. En **Jeux vidéo**, cliquer sur **Inscrire** et ressaisir cette carte. Le nom est proposé. Enchaîner avec une deuxième carte sur le même créneau.
3. En **Animations**, cliquer sur une date, créer une séance et y inscrire la première carte. Rouvrir la fiche pour modifier la séance ou retirer une inscription.

La démonstration conserve les saisies dans le navigateur utilisé. Les jeux et les horaires proposés servent aux essais. La base partagée entre postes, les récurrences, la reprise des classeurs et les règles fines d’accompagnement figurent au cahier des charges pour le pilote interne. Utiliser uniquement des données fictives dans cette page publique.

### Travailler depuis chez soi

Cloner le dépôt et ouvrir `index.html` dans un navigateur récent. Pour servir la page en local, lancer `python -m http.server 8000` dans ce dossier, puis ouvrir `http://localhost:8000`. Aucun composant à installer pour la page elle-même.

Modifier le cahier des charges en Markdown, puis enregistrer les changements dans Git. Conserver les fichiers métier et les exports nominatifs sur l’infrastructure interne.

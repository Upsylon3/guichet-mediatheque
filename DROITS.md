# Droits, licences et composants

**Titulaire des droits du projet Ludion.** Upsylon3, développeur et mainteneur indépendant, déclare en être le titulaire. La diffusion et les autorisations de réutilisation du logiciel relèvent de son choix.

Le dépôt est public. Les droits sur le code et la documentation de Ludion sont réservés, sous réserve des exceptions légales et des conditions de GitHub qui permettent notamment de consulter et de forker un dépôt public. Aucune licence open source n’est accordée pour Ludion. [Licences des dépôts GitHub](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)

| Élément | Composants présents ou décision à prendre |
|---|---|
| Interface et démonstration locale | HTML, CSS et JavaScript du projet. Le livre ouvert est dessiné avec les styles de Ludion. L’interface emploie les polices installées sur le poste. Le paquet publié ne redistribue aucun fichier de police, image, logo ou bibliothèque tierce. |
| Documentation | Textes de travail du projet et liens vers des sources officielles. Les contenus des sites cités relèvent de leurs conditions respectives. |
| Noms de consoles et postes | Désignations textuelles utiles à l’identification des postes. Les marques et les visuels des éditeurs restent distincts des droits sur le logiciel. |
| Classeurs et données métier | Les données personnelles, les fichiers de travail et les contenus de tiers restent hors du dépôt et du périmètre de toute future licence du logiciel. |
| Évolutions | Pour chaque dépendance ou contenu ajouté, inventorier nom, version, origine, licence, obligations d’attribution et avis à conserver. Vérifier la compatibilité lors de chaque diffusion. |
| Recette automatisée | Playwright et playwright-core 1.58.2, licence Apache-2.0, distribution officielle npm / Microsoft. Fsevents 2.3.2 est une dépendance optionnelle macOS, licence MIT. Dépendances de développement uniquement, absentes de la page publique et du client de développement. Versions et intégrités dans `package-lock.json` ; conserver leurs fichiers LICENSE/NOTICE lors d’une redistribution des paquets. |
| Services d’hébergement | GitHub Pages distribue l’interface et Supabase héberge la base dans la région Paris. Les API HTTP sont appelées directement, sans SDK embarqué. Les conditions d’usage des services sont suivies dans le [dossier d’exploitation](EXPLOITATION.md). |

**Nom, logo et contenus.** La disponibilité de « Ludion » et du logo reste à vérifier pour les usages et territoires visés. Pour les animations, privilégier les visuels produits par le service ou dont l’autorisation couvre la diffusion prévue. Garder la preuve de cette autorisation et les crédits exigés. [Recherche de marques INPI](https://www.inpi.fr/ressources/propriete-intellectuelle/rechercher-une-marque-base-marques)

Si Upsylon3 choisit une diffusion libre, il pourra préciser le périmètre de la licence, ajouter son texte officiel au dépôt et dater la décision. Les droits sur les marques, visuels de tiers et données restent soumis à leurs règles propres.

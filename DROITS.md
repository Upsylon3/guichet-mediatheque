# Droits, licences et composants

**Décision à prendre par le titulaire des droits.** Le dépôt est public. Aucune licence libre de redistribution du projet n’a été attribuée dans cette version. L’article L113-9 du code de la propriété intellectuelle prévoit, sous réserve des exceptions qu’il précise, la dévolution à l’employeur des droits patrimoniaux sur les logiciels et leur documentation créés dans l’exercice des fonctions ou sur instruction. Il vise également les agents des collectivités publiques. Le service juridique doit établir les conditions de création, qui détient quels droits et qui peut autoriser la publication et la réutilisation. [Texte de l’article L113-9](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000039279818/)

| Élément | Composants présents ou décision à prendre |
|---|---|
| Interface et démonstration locale | HTML, CSS et JavaScript du projet. Le livre ouvert est dessiné avec les styles de Ludion. L’interface emploie les polices installées sur le poste. Le paquet publié ne redistribue aucun fichier de police, image, logo ou bibliothèque tierce. |
| Documentation | Textes de travail et liens vers des sources officielles. Confirmer les droits de diffusion de la documentation avec ceux du logiciel. |
| Noms de consoles et postes | Désignations textuelles utiles à l’identification des postes. Les marques et les visuels des éditeurs restent distincts des droits sur le logiciel. |
| Classeurs et données métier | Les données personnelles, les fichiers de travail et les contenus de tiers restent hors du dépôt et du périmètre de toute future licence du logiciel. |
| Évolutions | Pour chaque dépendance ou contenu ajouté, inventorier nom, version, origine, licence, obligations d’attribution et avis à conserver. Vérifier la compatibilité lors de chaque diffusion. |
| Recette automatisée | Playwright et playwright-core 1.58.2, licence Apache-2.0, distribution officielle npm / Microsoft. Fsevents 2.3.2 est une dépendance optionnelle macOS, licence MIT. Dépendances de développement uniquement, absentes de la page publique et du client de développement. Versions et intégrités dans `package-lock.json` ; conserver leurs fichiers LICENSE/NOTICE lors d’une redistribution des paquets. |
| Services d’hébergement | GitHub Pages distribue l’interface et Supabase héberge la base dans la région Paris. Les API HTTP sont appelées directement, sans SDK embarqué. Les conditions applicables à l’exploitation figurent dans la [revue de la collectivité](REVUE-COLLECTIVITE.md). |

**Nom, logo et contenus.** La disponibilité de « Ludion » et du logo reste à vérifier pour les usages et territoires visés. Pour les animations, privilégier les visuels produits par le service ou dont l’autorisation couvre la diffusion prévue. Garder la preuve de cette autorisation et les crédits exigés. [Recherche de marques INPI](https://www.inpi.fr/ressources/propriete-intellectuelle/rechercher-une-marque-base-marques)

Si la collectivité souhaite une diffusion libre avec réciprocité, elle peut examiner la licence française [CeCILL 2.1](https://cecill.info/licences/Licence_CeCILL_V2.1-fr.html). Après décision, ajouter le texte officiel de la licence retenue, identifier précisément son périmètre et son titulaire, mettre à jour les mentions du dépôt et dater la décision. Soumettre aussi la visibilité publique actuelle à la revue du titulaire.

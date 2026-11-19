# Horaires des jeux vidéo

La grille provient des nouveaux modèles JV du classeur « INSCRIPTION AUX ANIMATIONS 2026.xlsx ». Seuls les horaires et les dates de référence sont repris, sans inscriptions ni identités.

| Période | Jour | Créneaux |
| --- | --- | --- |
| Toute l’année | Mercredi | 13:45–15:15 · 15:15–16:45 · 16:45–17:45 |
| Toute l’année | Samedi, hors SPYRO | 10:15–11:15 · 11:15–12:15 · 13:45–14:45 · 14:45–15:45 · 15:45–16:45 · 16:45–17:45 |
| Toute l’année | Samedi, SPYRO | 10:15–11:45 · 13:45–15:15 · 15:15–16:45 · 16:45–17:45 |
| Vacances scolaires Zone C | Mardi | 13:45–15:15 · 15:15–16:45 · 16:45–17:45 |
| Vacances scolaires Zone C | Jeudi et vendredi | 15:15–16:45 · 16:45–18:15 |

Les lundis et dimanches sont fermés. Les jours fériés métropolitains restent fermés, y compris pendant les vacances. Une exception datée administrative peut modifier une ouverture ou ses horaires. Les dates de fermeture générale du service restent prioritaires.

Les quatre créneaux du samedi pour SPYRO sont confirmés. La grille reprend les quatre en-têtes horaires du classeur, dont le dernier créneau d’une heure.

## Corrélation avec la Zone C

Les 29 dates supplémentaires explicites du calendrier du classeur ont été comparées aux périodes officielles de l’académie de Montpellier, en Zone C : elles concordent toutes. Les ouvertures sont ensuite calculées pour **tous** les mardis, jeudis et vendredis des périodes officielles complètes, et non limitées aux seules feuilles déjà créées dans le classeur.

Sources officielles :

- [Calendrier scolaire du ministère de l’Éducation nationale](https://data.education.gouv.fr/explore/dataset/fr-en-calendrier-scolaire/) : académie de Montpellier, Zone C, calendrier des élèves ; les rentrées des enseignants ne sont pas utilisées.
- [Jours fériés métropolitains](https://calendrier.api.gouv.fr/jours-feries/metropole.json).

Les dates sont converties en Europe/Paris. Le début est inclus et le jour de reprise des cours est exclu. Les périodes dont la date de fin n’est pas publiée ou exploitable ne sont pas prolongées arbitrairement. La version initiale contient les périodes complètes reçues pour les années scolaires 2025–2026 à 2027–2028 ; la dernière période complète se termine en mai 2028. Les ouvertures supplémentaires de l’été 2028 restent à actualiser lorsque ses deux bornes sont disponibles. Les administrateurs peuvent définir une exception en attendant.

Les données vérifiées sont dans `dev/video-schedule.json`, avec leurs sources et la date de vérification. L’application ne dépend pas d’un appel réseau vers ces sources à chaque inscription.

## Actualisation et déploiement

1. Lancer `python scripts/update-video-calendar.py`. Le script vérifie la source et refuse une réponse partielle ou une contradiction avec les dates témoins du classeur.
2. Lancer `npm run build` et `npm run test:demo`.
3. Préparer une **nouvelle** migration pour mettre à jour les réglages partagés depuis la nouvelle grille. Ne pas réexécuter une ancienne migration pour actualiser les données : ses ouvertures sont figées pour assurer la reproductibilité.
4. Appliquer les migrations du quota quotidien puis des horaires avant de fusionner les sources et publier GitHub Pages.

L’installation initiale est `20261114163456_horaires_jv_classeur_2026.sql`, après `20261114162554_quota_jv_quotidien.sql`. Elle conserve jeux, capacités et exceptions administratives existantes. Une réservation à venir incompatible bloque la migration avec sa date, son poste et son horaire ; ajouter une exception administrative appropriée avant de réessayer. Aucune réservation n’est annulée ou déplacée par cette migration.

Une sauvegarde privée de la grille précédente est conservée dans `guichet_prive.sauvegarde_grille_jv_2026`. Un rejeu ne remplace pas les modifications administratives postérieures. Avant toute restauration de cette sauvegarde, vérifier les réservations et les réglages ajoutés depuis, afin de ne pas les perdre ni les rendre incompatibles.

`supabase/tests/horaires_jv.sql` vérifie les horaires, fermetures, vacances 2027, jours fériés et dérogations via les fonctions serveur, dans une transaction annulée. Les tests Python vérifient la Zone C, les bornes Europe/Paris et la corrélation avec le classeur.

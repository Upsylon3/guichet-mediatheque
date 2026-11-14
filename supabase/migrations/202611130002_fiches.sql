-- Migration : fiches.
-- Historique appliqué dans l’ordre des fichiers ; ne pas rejouer sur une base déjà migrée.

alter table public.usagers
  add column date_naissance date check (date_naissance <= (current_timestamp at time zone 'Europe/Paris')::date),
  add column note_interne text check (length(note_interne) <= 500);
grant update(date_naissance,note_interne) on public.usagers to authenticated;
-- Les politiques de la migration précédente réservent la suppression au profil administrateur.

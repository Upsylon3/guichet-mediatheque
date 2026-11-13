-- Socle de développement. Les habilitations sont attribuées côté serveur.
create schema if not exists guichet_prive;
revoke all on schema guichet_prive from public;
grant usage on schema guichet_prive to authenticated;
create table guichet_prive.habilitations (
  compte uuid primary key references auth.users(id) on delete cascade,
  profil text not null check (profil in ('agent','administrateur'))
);
create function guichet_prive.profil() returns text
language sql stable security definer set search_path = ''
as $$ select profil from guichet_prive.habilitations where compte = (select auth.uid()) $$;
revoke all on function guichet_prive.profil() from public;
grant execute on function guichet_prive.profil() to authenticated;

create table public.usagers (
  carte text primary key check (carte ~ '^[0-9]{7}$'),
  prenom text, nom text
);
create table public.postes (
  code text primary key,
  capacite integer not null check (capacite between 1 and 4)
);
alter table public.usagers enable row level security;
alter table public.postes enable row level security;
revoke all on public.usagers, public.postes from public, anon, authenticated;
grant select, insert, delete on public.usagers to authenticated;
grant update(prenom,nom) on public.usagers to authenticated;
grant select, insert, update, delete on public.postes to authenticated;
create policy lire_usagers on public.usagers for select to authenticated
  using ((select guichet_prive.profil()) in ('agent','administrateur'));
create policy creer_usagers on public.usagers for insert to authenticated
  with check ((select guichet_prive.profil()) in ('agent','administrateur'));
create policy completer_usagers on public.usagers for update to authenticated
  using ((select guichet_prive.profil()) in ('agent','administrateur'))
  with check ((select guichet_prive.profil()) in ('agent','administrateur'));
create policy supprimer_usagers on public.usagers for delete to authenticated
  using ((select guichet_prive.profil()) = 'administrateur');
create policy lire_postes on public.postes for select to authenticated
  using ((select guichet_prive.profil()) in ('agent','administrateur'));
create policy gerer_postes on public.postes for all to authenticated
  using ((select guichet_prive.profil()) = 'administrateur')
  with check ((select guichet_prive.profil()) = 'administrateur');

-- Le collecteur s’authentifie avec un secret provisionné hors Git.
create role ludion_sauvegarde login noinherit connection limit 2;

grant usage on schema guichet_prive, public to ludion_sauvegarde;
grant select on guichet_prive.activites to ludion_sauvegarde;
grant select (id, carte) on public.usagers to ludion_sauvegarde;

create policy sauvegarder_activites on guichet_prive.activites
  for select to ludion_sauvegarde
  using (type in ('vid', 'ani', 'guest', 'count'));

create policy sauvegarder_references_usagers on public.usagers
  for select to ludion_sauvegarde
  using (exists (select 1 from guichet_prive.activites a where a.carte = usagers.carte));

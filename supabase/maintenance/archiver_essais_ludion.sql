-- À exécuter une seule fois sur le projet repris de l’ancien guichet de test.
begin;
select pg_advisory_xact_lock(14458001);
lock table public.usagers, guichet_prive.activites, guichet_prive.reglages
  in share row exclusive mode;

do $controle$
begin
  if exists (select 1 from public.usagers where not coalesce(nom ~* '^Démo [0-9]{3}$|fictif|essai|test',false))
    or exists (
      select 1 from guichet_prive.activites a
      where not (
        exists (select 1 from public.usagers u where u.carte=a.carte)
        or coalesce(a.donnees->>'title' like 'DÉMO · %',false)
        or exists (
          select 1 from guichet_prive.activites p
          where p.id=a.parent and p.donnees->>'title' like 'DÉMO · %'
        )
      )
    )
  then raise exception 'Jeu de données de recette non reconnu. Aucune donnée archivée.'; end if;
end
$controle$;

create table guichet_prive.archive_essais_avant_ludion as
select now() as date_archive, jsonb_build_object(
  'usagers', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.usagers t),
  'activites', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from guichet_prive.activites t),
  'operations', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from guichet_prive.operations t),
  'statistiques', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from guichet_prive.statistiques t),
  'totaux', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from guichet_prive.totaux t),
  'fusions', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from guichet_prive.fusions t),
  'quotas_jv', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from guichet_prive.quotas_jv t),
  'jours_a_recalculer', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from guichet_prive.jours_a_recalculer t),
  'reglages', (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from guichet_prive.reglages t)
) as sauvegarde;
alter table guichet_prive.archive_essais_avant_ludion enable row level security;
revoke all on guichet_prive.archive_essais_avant_ludion from public, anon, authenticated;

delete from guichet_prive.fusions;
delete from guichet_prive.activites;
delete from public.usagers;
delete from guichet_prive.operations;
delete from guichet_prive.statistiques;
delete from guichet_prive.totaux;
delete from guichet_prive.jours_a_recalculer;

update guichet_prive.reglages r set
  contenu = r.contenu || jsonb_build_object(
    'boxes', (select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(r.contenu->'boxes') where key !~ '^DEMO-[1-6]$'),
    'eventTemplates', (select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(r.contenu->'eventTemplates') where key not like 'DÉMO · %')
  ),
  revision = r.revision + 1;
commit;

begin;

create table guichet_prive.postes_agents (
  compte uuid primary key references auth.users(id) on delete cascade,
  libelle text not null check (char_length(trim(libelle)) between 1 and 80),
  activation timestamptz not null default now()
);
alter table guichet_prive.postes_agents enable row level security;
revoke all on guichet_prive.postes_agents from public, anon, authenticated;

create or replace function guichet_prive.profil() returns text
language sql stable security definer set search_path = ''
as $$
  select case when (select auth.jwt()->>'is_anonymous') = 'true'
    then (select 'agent' from guichet_prive.postes_agents where compte = (select auth.uid()))
    else (select profil from guichet_prive.habilitations where compte = (select auth.uid()))
  end
$$;

create function guichet_prive.administrer_postes_agents(
  action text, identifiant uuid, nom text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if guichet_prive.profil() is distinct from 'administrateur' then
    raise exception 'Accès administrateur requis' using errcode = '42501';
  end if;

  if action = 'activer' then
    if not exists (select 1 from auth.users where id = identifiant and is_anonymous) then
      raise exception 'Session de poste absente' using errcode = '22023';
    end if;
    insert into guichet_prive.postes_agents (compte, libelle)
    values (identifiant, trim(nom))
    on conflict (compte) do update set libelle = excluded.libelle;
  elsif action = 'revoquer' then
    delete from guichet_prive.postes_agents where compte = identifiant;
  elsif action is distinct from 'lister' then
    raise exception 'Action inconnue' using errcode = '22023';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(p) order by p.libelle, p.compte)
    from guichet_prive.postes_agents p
  ), '[]'::jsonb);
end
$$;

create function public.administrer_postes_agents(
  action text, identifiant uuid default null, nom text default null
) returns jsonb
language sql security invoker set search_path = ''
as $$ select guichet_prive.administrer_postes_agents(action, identifiant, nom) $$;

revoke all on function public.administrer_postes_agents(text, uuid, text),
  guichet_prive.administrer_postes_agents(text, uuid, text) from public, anon, authenticated;
grant execute on function public.administrer_postes_agents(text, uuid, text),
  guichet_prive.administrer_postes_agents(text, uuid, text) to authenticated;

commit;

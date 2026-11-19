-- Exécuter dans une transaction, sur la base de restauration isolée.
-- La table temporaire copie_ludion contient un seul document déchiffré.
lock table public.usagers, guichet_prive.activites in share row exclusive mode;

do $verification$
begin
  if current_database() <> 'ludion_restauration' then
    raise exception 'Base de restauration isolée requise';
  end if;
  if exists (select 1 from public.usagers) or exists (select 1 from guichet_prive.activites) then
    raise exception 'La base de restauration doit être vide';
  end if;
  if (select count(*) from pg_temp.copie_ludion) <> 1 or exists (
    select 1 from pg_temp.copie_ludion
    where document->'version' is distinct from '1'::jsonb
       or jsonb_typeof(document->'cartes') is distinct from 'array'
       or jsonb_typeof(document->'activites') is distinct from 'array'
  ) then
    raise exception 'Format de sauvegarde inconnu';
  end if;
end
$verification$;

insert into public.usagers (id, carte)
select u.id, u.carte from pg_temp.copie_ludion c
cross join lateral jsonb_to_recordset(c.document->'cartes') as u(id uuid, carte text);

-- Les séances doivent exister lors de la validation des inscriptions.
insert into guichet_prive.activites
select a.* from pg_temp.copie_ludion c
cross join lateral jsonb_populate_recordset(null::guichet_prive.activites, c.document->'activites') a
where a.parent is null;

insert into guichet_prive.activites
select a.* from pg_temp.copie_ludion c
cross join lateral jsonb_populate_recordset(null::guichet_prive.activites, c.document->'activites') a
where a.parent is not null;

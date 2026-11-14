-- Passer d’une réservation JV par semaine à une réservation par date Europe/Paris.
-- Le bloc est atomique et rejouable ; aucune activité ni fiche usager n’est supprimée.
do $migration$
declare
  definition text;
  video text;
  cloture text;
  fusion text;
begin
  perform pg_advisory_xact_lock(14458001);
  if exists (
    select 1 from information_schema.columns
    where table_schema='guichet_prive' and table_name='quotas_jv' and column_name='jour'
  ) then
    if position('q.jour=j' in pg_get_functiondef('guichet_prive.video(uuid,jsonb,uuid[])'::regprocedure))=0 then
      raise exception 'Migration quotidienne incomplète : vérifier les fonctions serveur';
    end if;
    raise notice 'Quota quotidien déjà installé';
    return;
  end if;

  -- Vérifier les points de transition AVANT de toucher à l’index dérivé.
  video := pg_get_functiondef('guichet_prive.video(uuid,jsonb,uuid[])'::regprocedure);
  cloture := pg_get_functiondef('guichet_prive.cloturer(date)'::regprocedure);
  fusion := pg_get_functiondef('guichet_prive.fusion(text,text,uuid,boolean)'::regprocedure);
  if position($avant$q.semaine=date_trunc('week',j::timestamp)::date$avant$ in video)=0
    or position($avant$semaine<date_trunc('week',reference::timestamp)::date$avant$ in cloture)=0
    or position('a.semaine=b.semaine' in fusion)=0 then
    raise exception 'Version du quota hebdomadaire non reconnue : aucune modification appliquée';
  end if;

  -- Cet index est reconstruit depuis les réservations vivantes, sans modifier leur contenu.
  delete from guichet_prive.quotas_jv;
  alter table guichet_prive.quotas_jv rename column semaine to jour;
  alter table guichet_prive.quotas_jv rename constraint quotas_jv_usager_semaine_key to quotas_jv_usager_jour_key;
  insert into guichet_prive.quotas_jv(reservation,usager,jour)
  select a.id,u.id,a.jour from guichet_prive.activites a
  join public.usagers u on u.carte=a.carte
  where a.type='vid' and not a.supprime and a.jour>=guichet_prive.jour();

  execute $sql$
    create or replace function guichet_prive.retenir_quota() returns trigger
    language plpgsql security definer set search_path='' as $fonction$
    declare identifiant uuid;
    begin
      if new.type='vid' then
        delete from guichet_prive.quotas_jv where reservation=new.id;
        if not new.supprime and new.jour>=guichet_prive.jour() then
          select id into identifiant from public.usagers where carte=new.carte;
          insert into guichet_prive.quotas_jv(reservation,usager,jour)
          values(new.id,identifiant,new.jour);
        end if;
      end if;
      return new;
    end $fonction$;
  $sql$;

  video := replace(video,$avant$q.semaine=date_trunc('week',j::timestamp)::date$avant$,'q.jour=j');
  video := replace(video,'Une seule inscription JV par semaine, du lundi au dimanche.','Une seule inscription JV par jour.');
  video := replace(video,'cette semaine, du lundi au dimanche','ce jour');
  video := replace(video,'après la clôture quotidienne','pendant sa période de conservation');
  execute video;
  execute replace(cloture,$avant$semaine<date_trunc('week',reference::timestamp)::date$avant$,'jour<reference');
  fusion := replace(fusion,'a.semaine=b.semaine','a.jour=b.jour');
  fusion := replace(fusion,'limite hebdomadaire','limite quotidienne');
  fusion := replace(fusion,'dans la même semaine','le même jour');
  execute fusion;
end $migration$;

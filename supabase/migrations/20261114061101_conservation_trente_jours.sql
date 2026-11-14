-- Conserver les activités 30 jours ; calculer les agrégats sans consommer les lignes.
create table guichet_prive.jours_a_recalculer (jour date primary key);
alter table guichet_prive.jours_a_recalculer enable row level security;
create policy fermer_jours_statistiques on guichet_prive.jours_a_recalculer for all using(false) with check(false);
revoke all on guichet_prive.jours_a_recalculer from public,anon,authenticated;
insert into guichet_prive.jours_a_recalculer select distinct jour from guichet_prive.activites;

create function guichet_prive.marquer_jour_statistique() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op<>'INSERT' then
  insert into guichet_prive.jours_a_recalculer values(old.jour) on conflict do nothing;
 end if;
 if tg_op<>'DELETE' then
  insert into guichet_prive.jours_a_recalculer values(new.jour) on conflict do nothing;
 end if;
 return null;
end $$;
revoke all on function guichet_prive.marquer_jour_statistique() from public,anon,authenticated;
create trigger marquer_jour_statistique after insert or update or delete on guichet_prive.activites
for each row execute function guichet_prive.marquer_jour_statistique();

create or replace function guichet_prive.cloturer(reference date default guichet_prive.jour())
returns void language plpgsql security definer set search_path='' as $$
declare jours date[]; limite date:=reference-30;
begin
 if reference is null then raise exception 'Date de clôture requise';end if;
 perform pg_advisory_xact_lock(14458001);
 select coalesce(array_agg(jour),'{}'::date[]) into jours
 from guichet_prive.jours_a_recalculer where jour<reference;
 -- Remplacer les journées modifiées, y compris celles devenues vides après annulation.
 -- Les archives déjà purgées, sans journée à recalculer, restent intactes.
 delete from guichet_prive.statistiques where jour=any(jours);
 delete from guichet_prive.totaux where jour=any(jours);
 insert into guichet_prive.statistiques(jour,dimensions,passages,personnes,enfants,adultes,accompagnateurs)
 select jour,dimensions,sum(passages),sum(personnes),sum(enfants),sum(adultes),sum(accompagnateurs)
 from guichet_prive.mesures() where jour=any(jours) group by jour,dimensions;
 insert into guichet_prive.totaux(jour,activite,secteur,passages,personnes)
 select jour,dimensions->>'activite',dimensions->>'secteur',sum(passages),sum(personnes)
 from guichet_prive.mesures() where jour=any(jours) group by jour,dimensions->>'activite',dimensions->>'secteur';
 -- La date J-30 est conservée ; seules les dates strictement antérieures sont supprimées.
 delete from guichet_prive.activites where jour<limite;
 delete from guichet_prive.operations where jour<limite;
 delete from guichet_prive.fusions where jour<limite;
 delete from guichet_prive.quotas_jv where semaine<date_trunc('week',reference::timestamp)::date;
 -- Les suppressions physiques déclenchent aussi le marquage : ne pas recalculer une archive purgée.
 delete from guichet_prive.jours_a_recalculer where jour=any(jours) or jour<limite;
end $$;

do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('guichet_prive.etat()'::regprocedure);
 if position('a.jour>=guichet_prive.jour()' in definition)=0 then raise exception 'Filtre des activités introuvable';end if;
 execute replace(definition,'a.jour>=guichet_prive.jour()','a.jour>=guichet_prive.jour()-30');
 definition:=pg_get_functiondef('guichet_prive.statistiques(date,date)'::regprocedure);
 -- Les jours passés sont dans le cache ; le jour courant et le futur proviennent des lignes vivantes.
 if position('from guichet_prive.mesures() where jour between debut and fin' in definition)=0 then raise exception 'Mesures en direct introuvables';end if;
 execute replace(definition,'from guichet_prive.mesures() where jour between debut and fin','from guichet_prive.mesures() where jour between debut and fin and jour>=guichet_prive.jour()');
 definition:=pg_get_functiondef('guichet_prive.video(uuid,jsonb,uuid[])'::regprocedure);
 execute replace(definition,'Le détail de cette inscription passée n’est plus disponible après la clôture quotidienne.','Le détail de cette inscription n’est plus disponible.');
end $migration$;

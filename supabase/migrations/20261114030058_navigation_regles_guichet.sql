-- Migration : navigation regles guichet.
-- Historique appliqué dans l’ordre des fichiers ; ne pas rejouer sur une base déjà migrée.

-- Navigation métier, inscriptions individuelles et indicateurs anonymes.
create table guichet_prive.quotas_jv (
 reservation uuid primary key, usager uuid not null references public.usagers(id) on delete cascade,
 semaine date not null, unique(usager,semaine)
);
alter table guichet_prive.quotas_jv enable row level security;
create policy fermer_quotas on guichet_prive.quotas_jv for all using(false) with check(false);
revoke all on guichet_prive.quotas_jv from public,anon,authenticated;
-- Les semaines échues seront supprimées à la clôture. Aucun horaire ou jeu n'est conservé ici.
insert into guichet_prive.quotas_jv(reservation,usager,semaine)
select distinct on (u.id,date_trunc('week',a.jour::timestamp)::date) a.id,u.id,date_trunc('week',a.jour::timestamp)::date
from guichet_prive.activites a join public.usagers u on u.carte=a.carte
where a.type='vid' and not a.supprime order by u.id,date_trunc('week',a.jour::timestamp)::date,a.id;

create table guichet_prive.statistiques (
 jour date not null, dimensions jsonb not null, passages integer not null, personnes integer not null,
 enfants integer not null, adultes integer not null, accompagnateurs integer not null,
 primary key(jour,dimensions)
);
alter table guichet_prive.statistiques enable row level security;
create policy fermer_statistiques on guichet_prive.statistiques for all using(false) with check(false);
revoke all on guichet_prive.statistiques from public,anon,authenticated;
create index activites_salle_jour on guichet_prive.activites(jour,(donnees->>'room')) where type='ani' and not supprime;
create unique index participant_unique_seance on guichet_prive.activites(parent,carte) where type='guest' and not supprime;

alter table guichet_prive.activites drop constraint activites_carte_fkey,
 add constraint activites_carte_fkey foreign key(carte) references public.usagers(carte) on update cascade on delete restrict;
alter table public.usagers drop constraint usagers_fusion_cible_fkey,
 add constraint usagers_fusion_cible_fkey foreign key(fusion_cible) references public.usagers(carte) on update cascade on delete restrict;
alter table guichet_prive.fusions drop constraint fusions_source_fkey, drop constraint fusions_cible_fkey,
 add constraint fusions_source_fkey foreign key(source) references public.usagers(carte) on update cascade,
 add constraint fusions_cible_fkey foreign key(cible) references public.usagers(carte) on update cascade;

create function guichet_prive.verifier_horizon(j date, confirmation boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 if guichet_prive.profil()='agent' and j>guichet_prive.jour()+15 and not coalesce(confirmation,false) then
 raise exception 'Animation au-delà de J+15 : confirmer explicitement cette inscription anticipée.' using errcode='PT409';end if;
end $$;

create function guichet_prive.retenir_quota() returns trigger
language plpgsql security definer set search_path='' as $$
declare identifiant uuid;
begin
 if new.type='vid' then
 delete from guichet_prive.quotas_jv where reservation=new.id;
 if not new.supprime then
 select id into identifiant from public.usagers where carte=new.carte;
 insert into guichet_prive.quotas_jv(reservation,usager,semaine)
 values(new.id,identifiant,date_trunc('week',new.jour::timestamp)::date);
 end if;end if;return new;
end $$;
create trigger retenir_quota after insert or update on guichet_prive.activites for each row execute function guichet_prive.retenir_quota();

create function guichet_prive.mesures() returns table(jour date,dimensions jsonb,passages integer,personnes integer,enfants integer,adultes integer,accompagnateurs integer)
language sql security definer set search_path='' as $$
 select a.jour,jsonb_build_object('activite',case a.type when 'soc' then 'Jeux de société' when 'vid' then 'Jeux vidéo' else 'Animations' end,
 'secteur',coalesce(a.donnees->>'sector',''),'poste',coalesce(a.donnees->>'post',''),'jeu',coalesce(a.donnees->>'game',''),
 'boite',coalesce(a.donnees->>'box',''),'salle',coalesce(e.donnees->>'room',''),
 'type',coalesce(e.donnees->>'eventType',''),'heure',coalesce(a.donnees->>'slot',e.donnees->>'time',''),
 'categorie',coalesce(a.donnees->>'category','')),
 1,case a.type when 'soc' then (a.donnees->>'kids')::int+(a.donnees->>'adults')::int
 when 'vid' then 1 when 'guest' then 1+coalesce((a.donnees->>'companions')::int,0)
 else (a.donnees->>'kids')::int+(a.donnees->>'adults')::int end,
 case when a.type in ('soc','count') then (a.donnees->>'kids')::int when a.type='guest' and a.donnees->>'category'='Enfant' then 1 else 0 end,
 case when a.type in ('soc','count') then (a.donnees->>'adults')::int when a.type='guest' and a.donnees->>'category'='Adulte' then 1 else 0 end,
 case when a.type='guest' then coalesce((a.donnees->>'companions')::int,0) else 0 end
 from guichet_prive.activites a left join guichet_prive.activites e on e.id=a.parent
 where not a.supprime and a.type in ('soc','vid','guest','count') and (a.parent is null or not e.supprime)
$$;

create function guichet_prive.statistiques(debut date,fin date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare resultat jsonb;
begin
 perform guichet_prive.autoriser('stats');perform guichet_prive.cloturer();
 if debut is null or fin is null or debut>fin or fin-debut>3660 then raise exception 'Choisir une période valide, de dix ans au plus';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.jour),'[]') into resultat from (
 select * from guichet_prive.statistiques where jour between debut and fin
 union all select jour,dimensions,sum(passages)::int,sum(personnes)::int,sum(enfants)::int,sum(adultes)::int,sum(accompagnateurs)::int
 from guichet_prive.mesures() where jour between debut and fin group by jour,dimensions
 union all select t.jour,jsonb_build_object('activite',t.activite,'secteur',t.secteur,'detail','Archives sans détail'),t.passages,t.personnes,0,0,0
 from guichet_prive.totaux t where t.jour between debut and fin
 and not exists(select 1 from guichet_prive.statistiques s where s.jour=t.jour and s.dimensions->>'activite'=t.activite and s.dimensions->>'secteur'=t.secteur)
 ) x;return resultat;
end $$;
create function public.statistiques_guichet(debut date,fin date) returns jsonb language sql security invoker set search_path='' as $$select guichet_prive.statistiques(debut,fin)$$;


CREATE OR REPLACE FUNCTION guichet_prive.autoriser(action text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare profil text:=guichet_prive.profil(); cfg jsonb; droit text;
begin
 if auth.uid() is null or profil is null then raise exception 'Compte sans habilitation' using errcode='42501'; end if;
 if profil='administrateur' then return; end if;
 select contenu into cfg from guichet_prive.reglages;
 if action in ('config.save','user.merge','user.unmerge','roles.save','stats','export','batch') then raise exception 'Administration réservée' using errcode='42501'; end if;
 if action like 'event.%' and not coalesce((cfg->>'manageEvents')::boolean,false) then
 raise exception 'Gestion des séances réservée' using errcode='42501'; end if;
 droit:=case when action='batch' then 'bulk' when action='export' then 'export' when action like '%.remove' then 'cancel'
 when action in ('board.save','video.move','guest.move') then 'edit' end;
 if droit is not null and not coalesce((cfg->'permissions'->>droit)::boolean,droit in ('cancel','edit')) then
 raise exception 'Action non déléguée' using errcode='42501'; end if;
end $function$;


CREATE OR REPLACE FUNCTION guichet_prive.video(op uuid, d jsonb, anciens uuid[] DEFAULT '{}'::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare cfg jsonb; station jsonb; plages jsonb; plage text; debut time; fin time; j date:=(d->>'date')::date;
 p jsonb; card text; n integer:=0; occ integer; i integer:=0; ids jsonb:='[]'; cle uuid;
begin
 perform guichet_prive.date_ouverte(j);
 select contenu into cfg from guichet_prive.reglages;
 station:=cfg->'stations'->(d->>'post'); station:=station||coalesce(station->'weekdays'->(extract(dow from j)::int)::text,'{}'::jsonb);
 station:=station||coalesce(station->'exceptions'->j::text,'{}');
 if station is null or coalesce((station->>'enabled')::boolean,true)=false or cfg->'closedDates' ? j::text then
 raise exception 'Poste ou journée fermé' using errcode='22023'; end if;
 plages:=station->'slots';
 select x into plage from jsonb_array_elements_text(plages) x where left(x,5)=d->>'slot';
 if plage is null or not (station->'games' ? (d->>'game')) then raise exception 'Horaire ou jeu incompatible' using errcode='22023'; end if;
 debut:=left(plage,5)::time;fin:=right(plage,5)::time;
 if jsonb_typeof(d->'players') is distinct from 'array' or jsonb_array_length(d->'players') not between 1 and 4 then raise exception 'Vérifier les joueurs du groupe' using errcode='22023'; end if;
 if (select count(distinct x->>'card') from jsonb_array_elements(d->'players') x)<>jsonb_array_length(d->'players') then raise exception 'Carte en double dans le groupe' using errcode='22023'; end if;
 for p in select * from jsonb_array_elements(d->'players') loop
 card:=p->>'card';
 if card is null or card !~ '^[0-9]{7}$' or coalesce((p->>'companions')::int,0)<>0 then raise exception 'Une carte par joueur : aucun accompagnateur en jeux vidéo' using errcode='22023'; end if;
 n:=n+1;
 if exists(select 1 from guichet_prive.quotas_jv q join public.usagers u on u.id=q.usager where u.carte=card and q.semaine=date_trunc('week',j::timestamp)::date and not(q.reservation=any(anciens))) then raise exception 'Une seule inscription aux jeux vidéo par semaine, du lundi au dimanche.' using errcode='PT409';end if;
 if exists(select 1 from guichet_prive.activites a where a.type='vid' and not a.supprime and a.jour=j and a.carte=card
 and not(a.id=any(anciens)) and (a.donnees->>'slot')::time<fin and debut<(a.donnees->>'end')::time) then
 raise exception 'Carte déjà inscrite sur cet horaire' using errcode='23505'; end if;
 end loop;
 select coalesce(sum(1+(a.donnees->>'companions')::int),0) into occ from guichet_prive.activites a
 where a.type='vid' and not a.supprime and a.jour=j and a.donnees->>'post'=d->>'post'
 and a.donnees->>'slot'=d->>'slot' and not(a.id=any(anciens));
 if occ+n>(station->>'capacity')::int then raise exception 'Places insuffisantes pour ce groupe. Choisir un autre créneau ou poste.' using errcode='23514'; end if;
 if exists(select 1 from guichet_prive.activites a where a.type='vid' and not a.supprime and a.jour=j
 and a.donnees->>'post'=d->>'post' and a.donnees->>'slot'=d->>'slot' and a.donnees->>'game'<>d->>'game' and not(a.id=any(anciens))) then
 raise exception 'Les places libres rejoignent le jeu déjà choisi' using errcode='23514'; end if;
 for p in select * from jsonb_array_elements(d->'players') loop
 i:=i+1;perform guichet_prive.fiche(p->>'card');
 cle:=case when cardinality(anciens)>0 then anciens[i] else md5(op::text||':'||i)::uuid end;
 if cardinality(anciens)>0 then
 update guichet_prive.activites set jour=j,supprime=false,revision=revision+1,
 donnees=jsonb_build_object('post',d->>'post','slot',left(plage,5),'end',right(plage,5),'game',d->>'game','companions',0) where id=cle;
 else
 insert into guichet_prive.activites(id,type,jour,carte,groupe,donnees) values(cle,'vid',j,p->>'card',op,
 jsonb_build_object('post',d->>'post','slot',left(plage,5),'end',right(plage,5),'game',d->>'game','companions',0));
 end if;
 ids:=ids||to_jsonb(cle);
 end loop;
 return ids;
end $function$;


CREATE OR REPLACE FUNCTION guichet_prive.inscrire(op uuid, d jsonb, anciens uuid[] DEFAULT '{}'::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ev guichet_prive.activites; p jsonb; n integer:=0; occ integer; i integer:=0; cle uuid; ids jsonb:='[]'; age numeric;
begin
 select * into ev from guichet_prive.activites where id=(d->>'eventId')::uuid and type='ani' and not supprime;
 if not found then raise exception 'Séance absente ou supprimée' using errcode='P0002'; end if;
 perform guichet_prive.date_ouverte(ev.jour);
 if ev.donnees->>'mode'='libre' then raise exception 'Cette séance est en entrée libre : utiliser le comptage' using errcode='22023'; end if;
 perform guichet_prive.verifier_horizon(ev.jour,(d->>'confirmEarly')::boolean);
 if (select count(distinct p->>'card') from jsonb_array_elements(d->'players') p)<>jsonb_array_length(d->'players') then raise exception 'Une carte par participant : carte en double dans le groupe' using errcode='23505';end if;
 if jsonb_typeof(d->'players') is distinct from 'array' or jsonb_array_length(d->'players') not between 1 and 100 then raise exception 'Vérifier les participants' using errcode='22023'; end if;
 for p in select * from jsonb_array_elements(d->'players') loop
 if p->>'card' is null or p->>'card' !~ '^[0-9]{7}$' or (p->>'companions')::int is null or (p->>'companions')::int not between 0 and 100 then raise exception 'Vérifier carte et accompagnateurs' using errcode='22023'; end if;
 if exists(select 1 from guichet_prive.activites a where a.parent=ev.id and a.type='guest' and not a.supprime and a.carte=p->>'card' and not(a.id=any(anciens))) then raise exception 'Cette carte est déjà inscrite à cette animation' using errcode='23505';end if;
 if nullif(ev.donnees->>'cap','') is not null and ((p->>'companions')::int<>0 or coalesce(jsonb_array_length(p->'companionNames'),0)<>0) then raise exception 'Animation avec jauge : chaque personne doit avoir sa carte';end if;
 if (p->>'companions')::int<>coalesce(jsonb_array_length(p->'companionNames'),0) or exists(select 1 from jsonb_array_elements_text(p->'companionNames') s where trim(s)='' or length(s)>150) then raise exception 'Renseigner le nom de chaque accompagnateur sans carte';end if;
 age:=nullif(p->>'age','')::numeric;
 if p->>'ageUnit'='mois' then age:=age/12; end if;
 if age<0 or age>130 or ((ev.donnees->>'minAge' is not null or ev.donnees->>'maxAge' is not null) and age is null)
 or age<nullif(ev.donnees->>'minAge','')::numeric or age>nullif(ev.donnees->>'maxAge','')::numeric then raise exception 'Vérifier les conditions d’âge de la séance' using errcode='22023'; end if;
 n:=n+1+case when coalesce((ev.donnees->>'count')::boolean,true) then (p->>'companions')::int else 0 end;
 end loop;
 select coalesce(sum(1+case when coalesce((ev.donnees->>'count')::boolean,true) then (a.donnees->>'companions')::int else 0 end),0) into occ
 from guichet_prive.activites a where a.parent=ev.id and not a.supprime and a.type='guest' and not(a.id=any(anciens));
 if nullif(ev.donnees->>'cap','')::int is not null and occ+n>(ev.donnees->>'cap')::int then raise exception 'Plafond dépassé pour ce groupe' using errcode='23514'; end if;
 for p in select * from jsonb_array_elements(d->'players') loop
 i:=i+1;perform guichet_prive.fiche(p->>'card');cle:=case when cardinality(anciens)>0 then anciens[i] else md5(op::text||':'||i)::uuid end;
 if cardinality(anciens)>0 then
 update guichet_prive.activites set jour=ev.jour,parent=ev.id,supprime=false,revision=revision+1 where id=cle;
 else
 insert into guichet_prive.activites(id,type,jour,carte,parent,groupe,donnees) values(cle,'guest',ev.jour,p->>'card',ev.id,op,
 jsonb_build_object('companions',(p->>'companions')::int,'age',p->>'age','ageUnit',coalesce(p->>'ageUnit','ans'),'category',p->>'category','companionNames',coalesce(p->'companionNames','[]')));
 end if;ids:=ids||to_jsonb(cle);
 end loop;return ids;
end $function$;


CREATE OR REPLACE FUNCTION guichet_prive.valider_activite()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d jsonb:=new.donnees;ev guichet_prive.activites;n int;
begin
 if new.carte is not null and exists(select 1 from public.usagers where carte=new.carte and fusion_cible is not null) then raise exception 'Carte remplacée : utiliser la carte cible';end if;
 if new.type='soc' and not coalesce(d->>'sector' in ('Jeunesse','Pop Zone') and length(trim(d->>'box'))>0 and (d->>'kids')::int between 0 and 1000 and (d->>'adults')::int between 0 and 1000,false) then raise exception 'Consultation invalide' using errcode='22023';end if;
 if new.type='vid' and not coalesce(length(d->>'post')>0 and length(d->>'game')>0 and (d->>'slot')::time<(d->>'end')::time and coalesce((d->>'companions')::int,0)=0,false) then raise exception 'Réservation vidéo invalide' using errcode='22023';end if;
 if new.type='ani' and not new.supprime then
 if d->>'room' is null or d->>'room' not in ('Créazone','Salle JV') or nullif(d->>'endTime','') is null then raise exception 'Choisir Créazone ou Salle JV et renseigner les deux horaires';end if;
 if exists(select 1 from guichet_prive.activites a where a.type='ani' and not a.supprime and a.id<>new.id and a.jour=new.jour and a.donnees->>'room'=d->>'room' and (a.donnees->>'time')::time<(d->>'endTime')::time and (d->>'time')::time<(a.donnees->>'endTime')::time) then raise exception 'La salle accueille déjà une animation sur cet horaire' using errcode='PT409';end if;
 if nullif(d->>'cap','') is not null and exists(select 1 from guichet_prive.activites g where g.parent=new.id and not g.supprime and g.type='guest' and coalesce((g.donnees->>'companions')::int,0)>0) then raise exception 'Des accompagnateurs sans carte sont encore inscrits : conserver une animation sans jauge';end if;
 if not coalesce(length(trim(d->>'title'))>0 and (d->>'time')::time is not null and d->>'mode' in ('inscription','libre') and jsonb_typeof(d->'count')='boolean',false)
 or (nullif(d->>'endTime','')::time is not null and (d->>'endTime')::time<=(d->>'time')::time) then raise exception 'Séance invalide' using errcode='22023';end if;
 if exists(select 1 from guichet_prive.activites g where g.parent=new.id and not g.supprime and g.type='guest' and
 ((nullif(d->>'minAge','') is not null or nullif(d->>'maxAge','') is not null) and nullif(g.donnees->>'age','') is null
 or nullif(g.donnees->>'age','')::numeric/(case when g.donnees->>'ageUnit'='mois' then 12 else 1 end)<nullif(d->>'minAge','')::numeric
 or nullif(g.donnees->>'age','')::numeric/(case when g.donnees->>'ageUnit'='mois' then 12 else 1 end)>nullif(d->>'maxAge','')::numeric)) then raise exception 'Un participant existant est incompatible avec les conditions d’âge';end if;
 end if;
 if new.type in ('guest','count') then
 select * into ev from guichet_prive.activites where id=new.parent;
 if ev.type<>'ani' or ev.jour<>new.jour or (not new.supprime and ev.supprime) then raise exception 'Séance indisponible ou date incompatible';end if;
 if new.type='count' then
 if not coalesce((d->>'kids')::int between 0 and 1000 and (d->>'adults')::int between 0 and 1000,false) or ev.donnees->>'mode'<>'libre' then raise exception 'Comptage invalide';end if;
 if not new.supprime then
 select coalesce(sum((donnees->>'kids')::int+(donnees->>'adults')::int),0) into n from guichet_prive.activites where parent=new.parent and not supprime and id<>new.id;
 if n+(d->>'kids')::int+(d->>'adults')::int>coalesce(nullif(ev.donnees->>'cap','')::int,2147483647) then raise exception 'Plafond dépassé' using errcode='23514';end if;end if;
 elsif not coalesce((d->>'companions')::int between 0 and 100,false) then raise exception 'Participant invalide';end if;
 end if;
 return new;
end $function$;


CREATE OR REPLACE FUNCTION guichet_prive.cloturer(reference date DEFAULT guichet_prive.jour())
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform pg_advisory_xact_lock(14458001);
 insert into guichet_prive.statistiques(jour,dimensions,passages,personnes,enfants,adultes,accompagnateurs)
 select jour,dimensions,sum(passages),sum(personnes),sum(enfants),sum(adultes),sum(accompagnateurs)
 from guichet_prive.mesures() where jour<reference group by jour,dimensions
 on conflict(jour,dimensions) do update set passages=statistiques.passages+excluded.passages,personnes=statistiques.personnes+excluded.personnes,enfants=statistiques.enfants+excluded.enfants,adultes=statistiques.adultes+excluded.adultes,accompagnateurs=statistiques.accompagnateurs+excluded.accompagnateurs;
 delete from guichet_prive.quotas_jv where semaine<date_trunc('week',reference::timestamp)::date;
 insert into guichet_prive.totaux(jour,activite,secteur,passages,personnes)
 select a.jour,case a.type when 'soc' then 'Jeux de société' when 'vid' then 'Jeux vidéo' else 'Animations' end,
 case when a.type='soc' then a.donnees->>'sector' else '' end,count(*)::int,
 sum(case a.type when 'soc' then (a.donnees->>'kids')::int+(a.donnees->>'adults')::int
 when 'vid' then 1+(a.donnees->>'companions')::int
 when 'guest' then 1+(a.donnees->>'companions')::int
 else (a.donnees->>'kids')::int+(a.donnees->>'adults')::int end)::int
 from guichet_prive.activites a where a.jour<reference and not a.supprime
 and a.type in ('soc','vid','guest','count')
 and (a.parent is null or exists(select 1 from guichet_prive.activites p where p.id=a.parent and not p.supprime))
 group by a.jour,2,3
 on conflict(jour,activite,secteur) do update set
 passages=guichet_prive.totaux.passages+excluded.passages,
 personnes=guichet_prive.totaux.personnes+excluded.personnes;
 delete from guichet_prive.activites where jour<reference;
 delete from guichet_prive.operations where jour<reference; delete from guichet_prive.fusions where jour<reference;
end $function$;


CREATE OR REPLACE FUNCTION guichet_prive.etat()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare resultat jsonb;
begin
 perform guichet_prive.autoriser('read');
 perform guichet_prive.cloturer();
 select jsonb_build_object(
 'day',guichet_prive.jour(),'settings',r.contenu,'settingsRevision',r.revision,
 'boards',coalesce((select jsonb_agg(guichet_prive.ligne(a) order by a.jour desc,a.id) from guichet_prive.activites a where a.type='soc' and not a.supprime and a.jour>=guichet_prive.jour()),'[]'),
 'videos',coalesce((select jsonb_agg(guichet_prive.ligne(a) order by a.jour,a.donnees->>'slot',a.id) from guichet_prive.activites a where a.type='vid' and not a.supprime and a.jour>=guichet_prive.jour()),'[]'),
 'events',coalesce((select jsonb_agg(guichet_prive.ligne(a)||jsonb_build_object('guests',coalesce((select jsonb_agg(guichet_prive.ligne(g)) from guichet_prive.activites g where g.parent=a.id and g.type='guest' and not g.supprime),'[]'),'counts',coalesce((select jsonb_agg(guichet_prive.ligne(g)) from guichet_prive.activites g where g.parent=a.id and g.type='count' and not g.supprime),'[]')) order by a.jour,a.donnees->>'time') from guichet_prive.activites a where a.type='ani' and not a.supprime and a.jour>=guichet_prive.jour()),'[]'),
 'trash',coalesce((select jsonb_agg(guichet_prive.ligne(a)||jsonb_build_object('kind',a.type)) from guichet_prive.activites a where a.supprime and a.jour>=guichet_prive.jour()),'[]'),
 'totals',coalesce((select jsonb_agg(to_jsonb(t) order by jour desc,activite,secteur) from guichet_prive.totaux t),'[]')) into resultat from guichet_prive.reglages r;
 if guichet_prive.profil()<>'administrateur' then resultat:=resultat-'totals';end if;
 return resultat;
end $function$;


CREATE OR REPLACE FUNCTION guichet_prive.commande(action text, d jsonb, op uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a guichet_prive.activites; b guichet_prive.activites; precedent guichet_prive.operations;
 cfg jsonb; r integer; j date; resultat jsonb; x jsonb; k text; v jsonb; slot text; avant text;
 ids uuid[]:='{}'; cle uuid; joueurs jsonb:='[]'; n integer; i integer; serie uuid; cible date;
 signature text:=md5(action||d::text); conservation date:=guichet_prive.jour();
begin
 perform guichet_prive.autoriser(action);perform pg_advisory_xact_lock(14458001);perform guichet_prive.cloturer();
 if op is null or d is null or jsonb_typeof(d)<>'object' then raise exception 'Commande incomplète' using errcode='22023'; end if;
 select * into precedent from guichet_prive.operations where id=op;
 if found then
 if precedent.compte<>auth.uid() or precedent.signature<>signature then raise exception 'Cette tentative a déjà été utilisée pour une autre saisie. Vérifier les lignes confirmées avant un nouveau passage.' using errcode='PT409'; end if;
 return precedent.resultat;
 end if;
 select contenu,revision into cfg,r from guichet_prive.reglages;
 if action='board.save' then
 j:=(d->>'date')::date;perform guichet_prive.date_ouverte(j);
 if d->>'sector' not in ('Jeunesse','Pop Zone') or nullif(trim(d->>'box'),'') is null
 or (d->>'kids')::int is null or (d->>'adults')::int is null or (d->>'kids')::int not between 0 and 1000 or (d->>'adults')::int not between 0 and 1000 then raise exception 'Vérifier boîte, secteur et effectifs' using errcode='22023'; end if;
 perform guichet_prive.fiche(d->>'card');
 if d->>'id' is not null then
 a:=guichet_prive.verifier_version((d->>'id')::uuid,(d->>'revision')::int);
 if a.type<>'soc' or a.supprime then raise exception 'Consultation indisponible'; end if;
 update guichet_prive.activites set carte=d->>'card',jour=j,donnees=d-'id'-'revision'-'card'-'date',revision=revision+1 where id=a.id;
 cle:=a.id;
 else cle:=op;insert into guichet_prive.activites(id,type,jour,carte,donnees) values(cle,'soc',j,d->>'card',d-'id'-'revision'-'card'-'date');end if;
 resultat:=jsonb_build_object('ids',jsonb_build_array(cle));conservation:=j;
 elsif action='video.book' then
 resultat:=jsonb_build_object('ids',guichet_prive.video(op,d));conservation:=(d->>'date')::date;
 elsif action in ('video.move','video.restore','guest.move','guest.restore') then
 for x in select * from jsonb_array_elements(d->'rows') loop
 a:=guichet_prive.verifier_version((x->>'id')::uuid,(x->>'revision')::int);
 if a.type<>(case when action like 'video.%' then 'vid' else 'guest' end) then raise exception 'Type de saisie incorrect'; end if;
 if (action like '%.restore') is distinct from a.supprime then raise exception 'État de la saisie modifié' using errcode='PT409'; end if;
 ids:=array_append(ids,a.id);joueurs:=joueurs||jsonb_build_array(a.donnees||jsonb_build_object('card',a.carte));
 end loop;
 if cardinality(ids)=0 then raise exception 'Sélection vide'; end if;
 if action='video.restore' then d:=a.donnees||jsonb_build_object('date',a.jour); end if;
 if action='guest.restore' then d:=jsonb_build_object('eventId',a.parent,'confirmEarly',coalesce((d->>'confirmEarly')::boolean,false)); end if;
 if action like 'video.%' then resultat:=jsonb_build_object('ids',guichet_prive.video(op,d||jsonb_build_object('players',joueurs),ids));
 else resultat:=jsonb_build_object('ids',guichet_prive.inscrire(op,d||jsonb_build_object('players',joueurs),ids));end if;
 select max(jour) into conservation from guichet_prive.activites where id=any(ids);
 elsif action='guest.book' then
 resultat:=jsonb_build_object('ids',guichet_prive.inscrire(op,d));select jour into conservation from guichet_prive.activites where id=(d->>'eventId')::uuid;
 elsif action in ('board.remove','video.remove','guest.remove','count.remove','event.remove','board.restore','event.restore','count.restore') then
 for x in select * from jsonb_array_elements(d->'rows') loop
 a:=guichet_prive.verifier_version((x->>'id')::uuid,(x->>'revision')::int);
 if a.type<>(case split_part(action,'.',1) when 'board' then 'soc' when 'video' then 'vid' when 'event' then 'ani' else split_part(action,'.',1) end) then raise exception 'Type de saisie incorrect'; end if;
 if (action like '%.restore') is distinct from a.supprime then raise exception 'État de la saisie modifié' using errcode='PT409'; end if;

 update guichet_prive.activites set supprime=action like '%.remove',revision=revision+1 where id=a.id;
 ids:=array_append(ids,a.id);conservation:=greatest(conservation,a.jour);
 end loop;resultat:=jsonb_build_object('ids',to_jsonb(ids));
 elsif action='user.replace' then
 if d->>'target' is null or d->>'target' !~ '^[0-9]{7}$' then raise exception 'Saisir les 7 chiffres de la nouvelle carte';end if;
 if exists(select 1 from public.usagers where carte=d->>'target') then raise exception 'Cette nouvelle carte appartient déjà à une fiche. Utiliser la fusion administrative.' using errcode='PT409';end if;
 update public.usagers set carte=d->>'target' where carte=d->>'source' and revision=(d->>'revision')::int and fusion_cible is null;
 if not found then raise exception 'La fiche a changé : recharger sa version avant de remplacer la carte' using errcode='PT409';end if;
 resultat:=jsonb_build_object('card',d->>'target');
 elsif action='event.save' then
 j:=(d->>'date')::date;perform guichet_prive.date_ouverte(j);
 if nullif(trim(d->>'title'),'') is null or (d->>'time')::time is null or d->>'mode' not in ('inscription','libre')
 or nullif(d->>'cap','')::int<1 or nullif(d->>'minAge','')::numeric<0 or nullif(d->>'maxAge','')::numeric<nullif(d->>'minAge','')::numeric then raise exception 'Vérifier les paramètres de la séance' using errcode='22023'; end if;
 if d->>'id' is not null then
 a:=guichet_prive.verifier_version((d->>'id')::uuid,(d->>'revision')::int);
 if a.type<>'ani' or a.supprime then raise exception 'Séance indisponible'; end if;
 -- Un changement de série conserve les exceptions déjà personnalisées.
 for b in select * from guichet_prive.activites where type='ani' and not supprime and
 (id=a.id or (a.groupe is not null and groupe=a.groupe and not coalesce((donnees->>'exception')::boolean,false)
 and (d->>'scope'='all' or (d->>'scope'='following' and jour>=a.jour)))) loop
 cible:=b.jour+(j-a.jour);perform guichet_prive.date_ouverte(cible);
 select coalesce(sum(case when type='guest' then 1+case when (d->>'count')::boolean then (donnees->>'companions')::int else 0 end else (donnees->>'kids')::int+(donnees->>'adults')::int end),0) into n from guichet_prive.activites where parent=b.id and not supprime;
 if n>coalesce(nullif(d->>'cap','')::int,2147483647) or (n>0 and d->>'mode'<>b.donnees->>'mode') then raise exception 'Une inscription existante est incompatible avec cette modification' using errcode='23514'; end if;
 update guichet_prive.activites set jour=cible,donnees=(d-'id'-'revision'-'date'-'repeat'-'scope')||jsonb_build_object('exception',case when d ? 'restoreException' then (d->>'restoreException')::boolean else coalesce(d->>'scope','one')='one' and b.groupe is not null end),revision=revision+1 where id=b.id;
 update guichet_prive.activites set jour=cible,revision=revision+1 where parent=b.id;
 ids:=array_append(ids,b.id);conservation:=greatest(conservation,cible);
 end loop;
 else
 n:=coalesce((d->>'repeat')::int,1);if n not between 1 and 52 then raise exception 'Répétition entre 1 et 52 semaines'; end if;
 if coalesce((d->>'repeatEvery')::int,1) not between 1 and 12 or coalesce(d->>'frequency','week') not in ('week','month') then raise exception 'Récurrence invalide';end if; serie:=case when n>1 then op end;
 for i in 0..n-1 loop cle:=case when i=0 then op else md5(op::text||':'||i)::uuid end;cible:=case when d->>'frequency'='month' then (j+make_interval(months=>i*coalesce((d->>'repeatEvery')::int,1)))::date else j+7*i*coalesce((d->>'repeatEvery')::int,1) end;
 insert into guichet_prive.activites(id,type,jour,groupe,donnees) values(cle,'ani',cible,serie,d-'id'-'revision'-'date'-'repeat'-'scope');
 ids:=array_append(ids,cle);conservation:=greatest(conservation,cible);end loop;
 end if;resultat:=jsonb_build_object('ids',to_jsonb(ids));
 elsif action='count.add' then
 select * into a from guichet_prive.activites where id=(d->>'eventId')::uuid and type='ani' and not supprime;
 perform guichet_prive.verifier_horizon(a.jour,(d->>'confirmEarly')::boolean);
 if a.id is null or a.donnees->>'mode'<>'libre' then raise exception 'Séance en entrée libre requise'; end if;
 if (d->>'kids')::int is null or (d->>'adults')::int is null or (d->>'kids')::int<0 or (d->>'adults')::int<0 then raise exception 'Vérifier les effectifs'; end if;
 select coalesce(sum((donnees->>'kids')::int+(donnees->>'adults')::int),0) into n from guichet_prive.activites where parent=a.id and not supprime;
 if n+(d->>'kids')::int+(d->>'adults')::int>coalesce(nullif(a.donnees->>'cap','')::int,2147483647) then raise exception 'Plafond dépassé' using errcode='23514'; end if;
 insert into guichet_prive.activites(id,type,jour,parent,donnees) values(op,'count',a.jour,a.id,d-'eventId');resultat:=jsonb_build_object('ids',jsonb_build_array(op));conservation:=a.jour;
 elsif action='config.save' then
 if (d->>'revision')::int is distinct from r then raise exception 'Conflit : réglages modifiés depuis une autre session. Brouillon conservé.' using errcode='PT409',detail=cfg::text; end if;
 v:=d->'settings';
 if jsonb_typeof(v->'stations') is distinct from 'object' or not exists(select 1 from jsonb_object_keys(v->'stations')) then raise exception 'Configurer au moins un poste';end if;
 for k,x in select * from jsonb_each(v->'stations') loop
 if trim(k)='' or (x->>'capacity')::int is null or (x->>'capacity')::int not between 1 and 4 or jsonb_array_length(x->'games')<1 or jsonb_array_length(x->'slots')<1 then raise exception 'Vérifier poste, jeux et capacité';end if;
 avant:='';for slot in select * from jsonb_array_elements_text(x->'slots') order by 1 loop
 if slot !~ '^([01][0-9]|2[0-3]):[0-5][0-9]–([01][0-9]|2[0-3]):[0-5][0-9]$' or left(slot,5)>=right(slot,5) or left(slot,5)<avant then raise exception 'Horaires invalides ou chevauchants';end if;avant:=right(slot,5);end loop;
 end loop;
 -- Une fermeture forcée annule les réservations concernées dans la même transaction.
 if coalesce((d->>'forceClose')::boolean,false) then
 for a in select * from guichet_prive.activites where type='vid' and not supprime loop
 x:=v->'stations'->(a.donnees->>'post');x:=x||coalesce(x->'weekdays'->(extract(dow from a.jour)::int)::text,'{}'::jsonb);x:=x||coalesce(x->'exceptions'->a.jour::text,'{}');
 if x is not null and (not coalesce((x->>'enabled')::boolean,true) or v->'closedDates' ? a.jour::text) then
 update guichet_prive.activites set supprime=true,revision=revision+1 where id=a.id;ids:=array_append(ids,a.id);end if;
 end loop;end if;
 for a in select * from guichet_prive.activites where type='vid' and not supprime loop
 x:=v->'stations'->(a.donnees->>'post'); x:=x||coalesce(x->'weekdays'->(extract(dow from a.jour)::int)::text,'{}'::jsonb);x:=x||coalesce(x->'exceptions'->a.jour::text,'{}');
 if x is null or not coalesce((x->>'enabled')::boolean,true) or v->'closedDates' ? a.jour::text or not(x->'games' ? (a.donnees->>'game')) or not(x->'slots' ? ((a.donnees->>'slot')||'–'||(a.donnees->>'end'))) then raise exception 'Réservation incompatible : % / % / %',a.jour,a.donnees->>'post',a.donnees->>'slot' using errcode='23514';end if;
 select sum(1+(donnees->>'companions')::int) into n from guichet_prive.activites where type='vid' and not supprime and jour=a.jour and donnees->>'post'=a.donnees->>'post' and donnees->>'slot'=a.donnees->>'slot';
 if n>(x->>'capacity')::int then raise exception 'Places déjà réservées : % / %',a.jour,a.donnees->>'post' using errcode='23514';end if;
 end loop;
 update guichet_prive.reglages set contenu=v,revision=revision+1 where singleton;resultat:=jsonb_build_object('revision',r+1,'cancelled',to_jsonb(ids));
 elsif action='event.undo' then
 if jsonb_array_length(d->'events') not between 1 and 52 then raise exception 'Annulation de série invalide';end if;
 i:=0;for x in select * from jsonb_array_elements(d->'events') loop
 i:=i+1;v:=guichet_prive.commande('event.save',x,md5(op::text||':'||i)::uuid);
 ids:=ids||array(select jsonb_array_elements_text(v->'ids')::uuid);
 end loop;
 select greatest(guichet_prive.jour(),max(jour)) into conservation from guichet_prive.activites where id=any(ids);
 resultat:=jsonb_build_object('ids',to_jsonb(ids));
 elsif action='batch' then
 if jsonb_array_length(d->'commands') not between 1 and 200 then raise exception 'Lot de 1 à 200 lignes requis';end if;
 i:=0;resultat:='[]';for x in select * from jsonb_array_elements(d->'commands') loop
 if x->>'action' not in ('board.save','video.book','guest.book') then raise exception 'Type de ligne non importable';end if;
 i:=i+1;resultat:=resultat||jsonb_build_array(guichet_prive.commande(x->>'action',x->'data',md5(op::text||':'||i)::uuid));end loop;
 elsif action='export' then
 resultat:=guichet_prive.etat();
 else raise exception 'Action inconnue' using errcode='22023';end if;
 insert into guichet_prive.operations(id,compte,signature,jour,resultat) values(op,auth.uid(),signature,conservation,coalesce(resultat,'{}'));
 return resultat;
end $function$;


CREATE OR REPLACE FUNCTION guichet_prive.fusion(source text, cible text, op uuid, annuler boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare journal guichet_prive.fusions; s public.usagers;t public.usagers;m jsonb;mov jsonb:='[]';
begin
 perform guichet_prive.autoriser('user.merge');perform pg_advisory_xact_lock(14458001);perform guichet_prive.cloturer();
 if annuler then
 select * into journal from guichet_prive.fusions where id=op;
 if not found then raise exception 'Fusion absente ou délai d’annulation terminé';end if;
 select * into s from public.usagers where carte=journal.source;select * into t from public.usagers where carte=journal.cible;
 if s.revision<>journal.revision_source or t.revision<>journal.revision_cible then raise exception 'Conflit : une fiche a changé depuis la fusion' using errcode='PT409';end if;
 for m in select * from jsonb_array_elements(journal.mouvements) loop
 if not exists(select 1 from guichet_prive.activites where id=(m->>'id')::uuid and revision=(m->>'revision')::int and carte=journal.cible) then raise exception 'Conflit : une activité a changé depuis la fusion' using errcode='PT409';end if;end loop;
 if exists(select 1 from guichet_prive.quotas_jv where usager=t.id) then raise exception 'Une inscription JV protège la limite hebdomadaire : annulation de fusion indisponible';end if;
 update public.usagers set fusion_cible=null where carte=journal.source;
 for m in select * from jsonb_array_elements(journal.mouvements) loop update guichet_prive.activites set carte=journal.source,revision=revision+1 where id=(m->>'id')::uuid;end loop;
 delete from guichet_prive.fusions where id=op;return jsonb_build_object('restored',journal.source);
 end if;
 if exists(select 1 from guichet_prive.fusions where id=op and fusions.source=fusion.source and fusions.cible=fusion.cible) then return jsonb_build_object('id',op);end if;
 if source=cible then raise exception 'Choisir deux cartes distinctes';end if;
 select * into s from public.usagers where carte=source and fusion_cible is null;select * into t from public.usagers where carte=cible and fusion_cible is null;
 if s.carte is null or t.carte is null then raise exception 'Deux fiches actives sont nécessaires';end if;
 if exists(select 1 from guichet_prive.activites a join guichet_prive.activites b on b.jour=a.jour and b.type='vid' and not b.supprime and b.carte=cible where a.carte=source and a.type='vid' and not a.supprime and (a.donnees->>'slot')::time<(b.donnees->>'end')::time and (b.donnees->>'slot')::time<(a.donnees->>'end')::time) then raise exception 'Les deux cartes ont des réservations qui se chevauchent';end if;
 if exists(select 1 from guichet_prive.quotas_jv a join guichet_prive.quotas_jv b on a.semaine=b.semaine where a.usager=s.id and b.usager=t.id) then raise exception 'Les deux cartes ont une inscription JV dans la même semaine';end if;
 update guichet_prive.quotas_jv set usager=t.id where usager=s.id;
 for m in select jsonb_build_object('id',id,'revision',revision+1) from guichet_prive.activites where carte=source loop mov:=mov||jsonb_build_array(m);end loop;
 update guichet_prive.activites set carte=cible,revision=revision+1 where carte=source;
 update public.usagers set fusion_cible=cible where carte=source returning * into s;
 insert into guichet_prive.fusions(id,source,cible,jour,mouvements,revision_source,revision_cible) values(op,source,cible,guichet_prive.jour(),mov,s.revision,t.revision);
 return jsonb_build_object('id',op,'moved',jsonb_array_length(mov));
end $function$;



revoke all on all functions in schema guichet_prive from public,anon,authenticated;
grant execute on function guichet_prive.profil(),guichet_prive.etat(),guichet_prive.commande(text,jsonb,uuid),guichet_prive.fusion(text,text,uuid,boolean),guichet_prive.comptes(),guichet_prive.habiliter(uuid,text),guichet_prive.statistiques(date,date) to authenticated;
revoke all on function public.statistiques_guichet(date,date) from public,anon;
grant execute on function public.statistiques_guichet(date,date) to authenticated;

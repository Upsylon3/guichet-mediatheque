-- Tables privées : seul le service transactionnel ci-dessous peut les modifier.
alter table public.usagers add column id uuid not null default gen_random_uuid() unique;
create table guichet_prive.reglages (
 singleton boolean primary key default true check(singleton),
 revision integer not null default 1,
 contenu jsonb not null
);
insert into guichet_prive.reglages(contenu) values ('{
 "stations":{
 "ZELDA":{"capacity":1,"games":["Exploration"],"slots":["10:15–11:15","11:15–12:15","13:45–14:45","14:45–15:45","15:45–16:45","16:45–17:45"]},
 "PEACH":{"capacity":2,"games":["Course"],"slots":["10:15–11:15","11:15–12:15","13:45–14:45","14:45–15:45","15:45–16:45","16:45–17:45"]},
 "MARIO":{"capacity":4,"games":["Circuit","Rallye"],"slots":["10:15–11:15","11:15–12:15","13:45–14:45","14:45–15:45","15:45–16:45","16:45–17:45"]},
 "ELLIE":{"capacity":2,"games":["Aventure"],"slots":["10:15–11:15","11:15–12:15","13:45–14:45","14:45–15:45","15:45–16:45","16:45–17:45"]},
 "SACKBOY":{"capacity":2,"games":["Sports"],"slots":["10:15–11:15","11:15–12:15","13:45–14:45","14:45–15:45","15:45–16:45","16:45–17:45"]},
 "SPYRO":{"capacity":1,"games":["Voyage"],"slots":["10:15–11:45","13:45–15:15","15:15–16:45","16:45–17:45"]}},
 "limit":null,"count":"oui","manageEvents":false,"closedDates":[],"boxes":{},"permissions":{"cancel":true,"edit":true,"bulk":false,"export":false},"links":{"catalogue":"https://mediatheques.montpellier3m.fr/accueil-general.aspx","vsmart":"","selections":""}}
'::jsonb);
create table guichet_prive.activites (
 id uuid primary key,
 type text not null check(type in ('soc','vid','ani','guest','count')),
 jour date not null,
 carte text references public.usagers(carte) on delete restrict,
 parent uuid references guichet_prive.activites(id) on delete cascade,
 groupe uuid,
 donnees jsonb not null default '{}',
 revision integer not null default 1,
 supprime boolean not null default false,
 check ((type in ('soc','vid','guest')) = (carte is not null)),
 check ((type in ('guest','count')) = (parent is not null))
);
create index activites_jour on guichet_prive.activites(jour);
create index activites_carte on guichet_prive.activites(carte) where carte is not null;
create index activites_parent on guichet_prive.activites(parent) where parent is not null;
create index activites_groupe on guichet_prive.activites(groupe) where groupe is not null;
create table guichet_prive.operations (
 id uuid primary key, compte uuid not null, signature text not null,
 jour date not null, resultat jsonb not null
);
create index operations_jour on guichet_prive.operations(jour);
create table guichet_prive.totaux (
 jour date not null, activite text not null, secteur text not null default '',
 passages integer not null, personnes integer not null,
 primary key(jour,activite,secteur)
);
alter table guichet_prive.habilitations enable row level security;
alter table guichet_prive.reglages enable row level security;
alter table guichet_prive.activites enable row level security;
alter table guichet_prive.operations enable row level security;
alter table guichet_prive.totaux enable row level security;
revoke all on all tables in schema guichet_prive from public,anon,authenticated;

-- Verrou commun volontaire pour ce guichet à faible volume. Il coordonne aussi
-- les changements de réglages, restaurations, déplacements et la clôture.
create function guichet_prive.jour() returns date language sql stable set search_path='' as $$
 select (current_timestamp at time zone 'Europe/Paris')::date
$$;
create function guichet_prive.cloturer(reference date default guichet_prive.jour()) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(14458001);
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
 delete from guichet_prive.operations where jour<reference;
end $$;

create function guichet_prive.autoriser(action text) returns void
language plpgsql security definer set search_path='' as $$
declare profil text:=guichet_prive.profil(); cfg jsonb; droit text;
begin
 if auth.uid() is null or profil is null then raise exception 'Compte sans habilitation' using errcode='42501'; end if;
 if profil='administrateur' then return; end if;
 select contenu into cfg from guichet_prive.reglages;
 if action in ('config.save','user.merge','user.unmerge','roles.save') then raise exception 'Administration réservée' using errcode='42501'; end if;
 if action like 'event.%' and not coalesce((cfg->>'manageEvents')::boolean,false) then
 raise exception 'Gestion des séances réservée' using errcode='42501'; end if;
 droit:=case when action in ('batch','export') then action when action like '%.remove' then 'cancel'
 when action in ('board.save','video.move','guest.move') then 'edit' end;
 if droit is not null and not coalesce((cfg->'permissions'->>droit)::boolean,droit in ('cancel','edit')) then
 raise exception 'Action non déléguée' using errcode='42501'; end if;
end $$;

create function guichet_prive.fiche(numero text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if numero is null or numero !~ '^[0-9]{7}$' then
 raise exception 'Saisir les 7 chiffres imprimés sous le code-barres' using errcode='22023'; end if;
 insert into public.usagers(carte) values(numero) on conflict do nothing;
end $$;

create function guichet_prive.ligne(a guichet_prive.activites) returns jsonb
language sql stable set search_path='' as $$
 select a.donnees||jsonb_build_object('id',a.id,'date',a.jour,'card',a.carte,'eventId',a.parent,'group',a.groupe,'revision',a.revision,'deleted',a.supprime)
$$;

create function guichet_prive.etat() returns jsonb
language plpgsql security definer set search_path='' as $$
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
 return resultat;
end $$;

-- Les dates et les identifiants sont toujours validés au serveur.
create function guichet_prive.date_ouverte(d date) returns void
language plpgsql set search_path='' as $$
begin
 if d is null or d<guichet_prive.jour() then raise exception 'Journée clôturée. Choisir aujourd’hui ou une date future.' using errcode='22023'; end if;
end $$;
create function guichet_prive.verifier_version(cible uuid, attendu integer) returns guichet_prive.activites
language plpgsql security definer set search_path='' as $$
declare a guichet_prive.activites;
begin
 select * into a from guichet_prive.activites where id=cible;
 if not found then raise exception 'Saisie absente ou journée clôturée' using errcode='P0002'; end if;
 if attendu is null or a.revision<>attendu then
 raise exception 'Conflit : une autre session a modifié cette saisie. Votre brouillon est conservé.'
 using errcode='40001',detail=guichet_prive.ligne(a)::text; end if;
 return a;
end $$;

create function guichet_prive.video(op uuid,d jsonb,anciens uuid[] default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg jsonb; station jsonb; plages jsonb; plage text; debut time; fin time; j date:=(d->>'date')::date;
 p jsonb; card text; n integer:=0; occ integer; i integer:=0; ids jsonb:='[]'; cle uuid;
begin
 perform guichet_prive.date_ouverte(j);
 select contenu into cfg from guichet_prive.reglages;
 station:=cfg->'stations'->(d->>'post');
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
 if card is null or card !~ '^[0-9]{7}$' or (p->>'companions')::int is null or (p->>'companions')::int not between 0 and 3 then raise exception 'Vérifier carte et accompagnateurs' using errcode='22023'; end if;
 n:=n+1+(p->>'companions')::int;
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
 donnees=jsonb_build_object('post',d->>'post','slot',left(plage,5),'end',right(plage,5),'game',d->>'game','companions',(p->>'companions')::int) where id=cle;
 else
 insert into guichet_prive.activites(id,type,jour,carte,groupe,donnees) values(cle,'vid',j,p->>'card',op,
 jsonb_build_object('post',d->>'post','slot',left(plage,5),'end',right(plage,5),'game',d->>'game','companions',(p->>'companions')::int));
 end if;
 ids:=ids||to_jsonb(cle);
 end loop;
 return ids;
end $$;

create function guichet_prive.inscrire(op uuid,d jsonb,anciens uuid[] default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare ev guichet_prive.activites; p jsonb; n integer:=0; occ integer; i integer:=0; cle uuid; ids jsonb:='[]'; age numeric;
begin
 select * into ev from guichet_prive.activites where id=(d->>'eventId')::uuid and type='ani' and not supprime;
 if not found then raise exception 'Séance absente ou supprimée' using errcode='P0002'; end if;
 perform guichet_prive.date_ouverte(ev.jour);
 if ev.donnees->>'mode'='libre' then raise exception 'Cette séance est en entrée libre : utiliser le comptage' using errcode='22023'; end if;
 if nullif(ev.donnees->>'openDate','')::date>guichet_prive.jour() then raise exception 'Les inscriptions ne sont pas encore ouvertes' using errcode='22023'; end if;
 if jsonb_typeof(d->'players') is distinct from 'array' or jsonb_array_length(d->'players') not between 1 and 100 then raise exception 'Vérifier les participants' using errcode='22023'; end if;
 for p in select * from jsonb_array_elements(d->'players') loop
 if p->>'card' is null or p->>'card' !~ '^[0-9]{7}$' or (p->>'companions')::int is null or (p->>'companions')::int not between 0 and 100 then raise exception 'Vérifier carte et accompagnateurs' using errcode='22023'; end if;
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
 jsonb_build_object('companions',(p->>'companions')::int,'age',p->>'age','ageUnit',coalesce(p->>'ageUnit','ans')));
 end if;ids:=ids||to_jsonb(cle);
 end loop;return ids;
end $$;

create function guichet_prive.commande(action text,d jsonb,op uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a guichet_prive.activites; b guichet_prive.activites; precedent guichet_prive.operations;
 cfg jsonb; r integer; j date; resultat jsonb; x jsonb; k text; v jsonb; slot text; avant text;
 ids uuid[]:='{}'; cle uuid; joueurs jsonb:='[]'; n integer; i integer; serie uuid; cible date;
 signature text:=md5(action||d::text); conservation date:=guichet_prive.jour();
begin
 perform guichet_prive.autoriser(action);perform pg_advisory_xact_lock(14458001);perform guichet_prive.cloturer();
 if op is null or d is null or jsonb_typeof(d)<>'object' then raise exception 'Commande incomplète' using errcode='22023'; end if;
 select * into precedent from guichet_prive.operations where id=op;
 if found then
 if precedent.compte<>auth.uid() or precedent.signature<>signature then raise exception 'Cette tentative a déjà été utilisée pour une autre saisie. Vérifier les lignes confirmées avant un nouveau passage.' using errcode='40001'; end if;
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
 if (action like '%.restore') is distinct from a.supprime then raise exception 'État de la saisie modifié' using errcode='40001'; end if;
 ids:=array_append(ids,a.id);joueurs:=joueurs||jsonb_build_array(a.donnees||jsonb_build_object('card',a.carte));
 end loop;
 if cardinality(ids)=0 then raise exception 'Sélection vide'; end if;
 if action='video.restore' then d:=a.donnees||jsonb_build_object('date',a.jour); end if;
 if action='guest.restore' then d:=jsonb_build_object('eventId',a.parent); end if;
 if action like 'video.%' then resultat:=jsonb_build_object('ids',guichet_prive.video(op,d||jsonb_build_object('players',joueurs),ids));
 else resultat:=jsonb_build_object('ids',guichet_prive.inscrire(op,d||jsonb_build_object('players',joueurs),ids));end if;
 select max(jour) into conservation from guichet_prive.activites where id=any(ids);
 elsif action='guest.book' then
 resultat:=jsonb_build_object('ids',guichet_prive.inscrire(op,d));select jour into conservation from guichet_prive.activites where id=(d->>'eventId')::uuid;
 elsif action in ('board.remove','video.remove','guest.remove','count.remove','event.remove','board.restore','event.restore','count.restore') then
 for x in select * from jsonb_array_elements(d->'rows') loop
 a:=guichet_prive.verifier_version((x->>'id')::uuid,(x->>'revision')::int);
 if a.type<>(case split_part(action,'.',1) when 'board' then 'soc' when 'video' then 'vid' when 'event' then 'ani' else split_part(action,'.',1) end) then raise exception 'Type de saisie incorrect'; end if;
 if (action like '%.restore') is distinct from a.supprime then raise exception 'État de la saisie modifié' using errcode='40001'; end if;
 if action='count.restore' then raise exception 'Recréer le comptage après vérification de la jauge'; end if;
 update guichet_prive.activites set supprime=action like '%.remove',revision=revision+1 where id=a.id;
 ids:=array_append(ids,a.id);conservation:=greatest(conservation,a.jour);
 end loop;resultat:=jsonb_build_object('ids',to_jsonb(ids));
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
 update guichet_prive.activites set jour=cible,donnees=(d-'id'-'revision'-'date'-'repeat'-'scope')||jsonb_build_object('exception',coalesce(d->>'scope','one')='one' and b.groupe is not null),revision=revision+1 where id=b.id;
 update guichet_prive.activites set jour=cible,revision=revision+1 where parent=b.id;
 ids:=array_append(ids,b.id);conservation:=greatest(conservation,cible);
 end loop;
 else
 n:=coalesce((d->>'repeat')::int,1);if n not between 1 and 52 then raise exception 'Répétition entre 1 et 52 semaines'; end if;
 serie:=case when n>1 then op end;
 for i in 0..n-1 loop cle:=case when i=0 then op else md5(op::text||':'||i)::uuid end;cible:=j+7*i;
 insert into guichet_prive.activites(id,type,jour,groupe,donnees) values(cle,'ani',cible,serie,d-'id'-'revision'-'date'-'repeat'-'scope');
 ids:=array_append(ids,cle);conservation:=greatest(conservation,cible);end loop;
 end if;resultat:=jsonb_build_object('ids',to_jsonb(ids));
 elsif action='count.add' then
 select * into a from guichet_prive.activites where id=(d->>'eventId')::uuid and type='ani' and not supprime;
 if not found or a.donnees->>'mode'<>'libre' then raise exception 'Séance en entrée libre requise'; end if;
 if (d->>'kids')::int is null or (d->>'adults')::int is null or (d->>'kids')::int<0 or (d->>'adults')::int<0 then raise exception 'Vérifier les effectifs'; end if;
 select coalesce(sum((donnees->>'kids')::int+(donnees->>'adults')::int),0) into n from guichet_prive.activites where parent=a.id and not supprime;
 if n+(d->>'kids')::int+(d->>'adults')::int>coalesce(nullif(a.donnees->>'cap','')::int,2147483647) then raise exception 'Plafond dépassé' using errcode='23514'; end if;
 insert into guichet_prive.activites(id,type,jour,parent,donnees) values(op,'count',a.jour,a.id,d-'eventId');resultat:=jsonb_build_object('ids',jsonb_build_array(op));conservation:=a.jour;
 elsif action='config.save' then
 if (d->>'revision')::int is distinct from r then raise exception 'Conflit : réglages modifiés depuis une autre session. Brouillon conservé.' using errcode='40001',detail=cfg::text; end if;
 v:=d->'settings';
 if jsonb_typeof(v->'stations') is distinct from 'object' or not exists(select 1 from jsonb_object_keys(v->'stations')) then raise exception 'Configurer au moins un poste';end if;
 for k,x in select * from jsonb_each(v->'stations') loop
 if trim(k)='' or (x->>'capacity')::int is null or (x->>'capacity')::int not between 1 and 4 or jsonb_array_length(x->'games')<1 or jsonb_array_length(x->'slots')<1 then raise exception 'Vérifier poste, jeux et capacité';end if;
 avant:='';for slot in select * from jsonb_array_elements_text(x->'slots') order by 1 loop
 if slot !~ '^([01][0-9]|2[0-3]):[0-5][0-9]–([01][0-9]|2[0-3]):[0-5][0-9]$' or left(slot,5)>=right(slot,5) or left(slot,5)<avant then raise exception 'Horaires invalides ou chevauchants';end if;avant:=right(slot,5);end loop;
 end loop;
 for a in select * from guichet_prive.activites where type='vid' and not supprime loop
 x:=v->'stations'->(a.donnees->>'post');x:=x||coalesce(x->'exceptions'->a.jour::text,'{}');
 if x is null or not coalesce((x->>'enabled')::boolean,true) or v->'closedDates' ? a.jour::text or not(x->'games' ? (a.donnees->>'game')) or not(x->'slots' ? ((a.donnees->>'slot')||'–'||(a.donnees->>'end'))) then raise exception 'Réservation incompatible : % / % / %',a.jour,a.donnees->>'post',a.donnees->>'slot' using errcode='23514';end if;
 select sum(1+(donnees->>'companions')::int) into n from guichet_prive.activites where type='vid' and not supprime and jour=a.jour and donnees->>'post'=a.donnees->>'post' and donnees->>'slot'=a.donnees->>'slot';
 if n>(x->>'capacity')::int then raise exception 'Places déjà réservées : % / %',a.jour,a.donnees->>'post' using errcode='23514';end if;
 end loop;
 update guichet_prive.reglages set contenu=v,revision=revision+1;resultat:=jsonb_build_object('revision',r+1);
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
end $$;

-- Toutes les fonctions privilégiées sont privées, à search_path vide, sans
-- droits implicites. Seules deux façades publiques sont exposées.
revoke all on all functions in schema guichet_prive from public,anon,authenticated;
grant execute on function guichet_prive.profil() to authenticated;
grant execute on function guichet_prive.etat() to authenticated;
grant execute on function guichet_prive.commande(text,jsonb,uuid) to authenticated;
create function public.etat_guichet() returns jsonb language sql security invoker set search_path='' as $$ select guichet_prive.etat() $$;
create function public.commande_guichet(action text,donnees jsonb,operation uuid) returns jsonb language sql security invoker set search_path='' as $$ select guichet_prive.commande(action,donnees,operation) $$;
revoke all on function public.etat_guichet(),public.commande_guichet(text,jsonb,uuid) from public,anon;
grant execute on function public.etat_guichet(),public.commande_guichet(text,jsonb,uuid) to authenticated;

-- La clé étrangère protège aussi un DELETE direct d'une fiche liée à un autre poste.
create or replace function public.supprimer_usager(numero text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if guichet_prive.profil() is distinct from 'administrateur' then raise exception 'Suppression réservée aux administrateurs' using errcode='42501';end if;
 delete from public.usagers where carte=numero;
 if not found then raise exception 'Fiche absente ou déjà supprimée' using errcode='P0002';end if;
exception when foreign_key_violation then raise exception 'Cette fiche est liée à une activité du jour, une réservation future ou la corbeille.' using errcode='23503';
end $$;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('guichet-cloture','* * * * *','select guichet_prive.cloturer();');

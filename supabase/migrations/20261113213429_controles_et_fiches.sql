-- Migration : controles et fiches.
-- Historique appliqué dans l’ordre des fichiers ; ne pas rejouer sur une base déjà migrée.

-- Défense en profondeur sur les paramètres et les données transactionnelles.
alter table public.usagers add column revision integer not null default 1;
alter table public.usagers add column fusion_cible text references public.usagers(carte) on delete restrict;
create table guichet_prive.fusions (
 id uuid primary key, source text not null references public.usagers(carte),
 cible text not null references public.usagers(carte), jour date not null,
 mouvements jsonb not null, revision_source integer not null, revision_cible integer not null
);
alter table guichet_prive.fusions enable row level security;
revoke all on guichet_prive.fusions from public,anon,authenticated;

create function guichet_prive.revision_fiche() returns trigger
language plpgsql set search_path='' as $$
begin
 if old.fusion_cible is not null and new.fusion_cible is not distinct from old.fusion_cible then
 raise exception 'Carte fusionnée. Ouvrir la fiche de remplacement.' using errcode='22023';end if;
 new.revision:=old.revision+1;return new;
end $$;
create trigger revision_fiche before update on public.usagers for each row execute function guichet_prive.revision_fiche();
create or replace function guichet_prive.fiche(numero text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if numero is null or numero !~ '^[0-9]{7}$' then raise exception 'Saisir les 7 chiffres imprimés sous le code-barres' using errcode='22023';end if;
 insert into public.usagers(carte) values(numero) on conflict do nothing;
 if exists(select 1 from public.usagers where carte=numero and fusion_cible is not null) then raise exception 'Carte remplacée : ouvrir la fiche de remplacement dans l’annuaire.' using errcode='22023';end if;
end $$;

create function guichet_prive.valider_poste(p jsonb) returns void language plpgsql set search_path='' as $$
declare plage text; avant text:='';ex jsonb;d text;
begin
 if jsonb_typeof(p) is distinct from 'object' or jsonb_typeof(p->'games') is distinct from 'array' or jsonb_typeof(p->'slots') is distinct from 'array'
 or (p->>'capacity')::int is null or (p->>'capacity')::int not between 1 and 4
 or jsonb_array_length(p->'games')=0 or jsonb_array_length(p->'slots')=0 then raise exception 'Configurer jeux, horaires et capacité de 1 à 4' using errcode='22023';end if;
 for plage in select * from jsonb_array_elements_text(p->'slots') order by 1 loop
 if plage !~ '^([01][0-9]|2[0-3]):[0-5][0-9]–([01][0-9]|2[0-3]):[0-5][0-9]$' or left(plage,5)>=right(plage,5) or left(plage,5)<avant then raise exception 'Horaires invalides ou chevauchants' using errcode='22023';end if;avant:=right(plage,5);end loop;
 if p->'exceptions' is not null then
 for d,ex in select * from jsonb_each(p->'exceptions') loop
 if d !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Date d’exception invalide';end if;
 perform d::date;perform guichet_prive.valider_poste((p-'exceptions')||ex);
 end loop;end if;
end $$;
create function guichet_prive.valider_reglages() returns trigger language plpgsql set search_path='' as $$
declare k text;p jsonb;cfg jsonb:=new.contenu;d text;
begin
 if jsonb_typeof(cfg->'stations') is distinct from 'object' or not exists(select 1 from jsonb_object_keys(cfg->'stations')) then raise exception 'Au moins un poste requis';end if;
 for k,p in select * from jsonb_each(cfg->'stations') loop
 if trim(k)='' or length(k)>50 or k in ('__proto__','constructor','prototype') then raise exception 'Nom de poste invalide';end if;perform guichet_prive.valider_poste(p);end loop;
 for d in select * from jsonb_array_elements_text(cfg->'closedDates') loop perform d::date;end loop;
 if cfg->>'count' not in ('oui','non') or coalesce((cfg->>'limit')::int,1)<1 then raise exception 'Valeurs par défaut invalides';end if;
 perform (cfg->>'manageEvents')::boolean;
 return new;
end $$;
create trigger valider_reglages before insert or update on guichet_prive.reglages for each row execute function guichet_prive.valider_reglages();

create function guichet_prive.valider_activite() returns trigger language plpgsql security definer set search_path='' as $$
declare d jsonb:=new.donnees;ev guichet_prive.activites;n int;
begin
 if new.carte is not null and exists(select 1 from public.usagers where carte=new.carte and fusion_cible is not null) then raise exception 'Carte remplacée : utiliser la carte cible';end if;
 if new.type='soc' and not coalesce(d->>'sector' in ('Jeunesse','Pop Zone') and length(trim(d->>'box'))>0 and (d->>'kids')::int between 0 and 1000 and (d->>'adults')::int between 0 and 1000,false) then raise exception 'Consultation invalide' using errcode='22023';end if;
 if new.type='vid' and not coalesce(length(d->>'post')>0 and length(d->>'game')>0 and (d->>'slot')::time<(d->>'end')::time and (d->>'companions')::int between 0 and 3,false) then raise exception 'Réservation vidéo invalide' using errcode='22023';end if;
 if new.type='ani' then
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
end $$;
create trigger valider_activite before insert or update on guichet_prive.activites for each row execute function guichet_prive.valider_activite();

create function guichet_prive.fusion(source text,cible text,op uuid,annuler boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare journal guichet_prive.fusions; s public.usagers;t public.usagers;m jsonb;mov jsonb:='[]';
begin
 perform guichet_prive.autoriser('user.merge');perform pg_advisory_xact_lock(14458001);perform guichet_prive.cloturer();
 if annuler then
 select * into journal from guichet_prive.fusions where id=op;
 if not found then raise exception 'Fusion absente ou délai d’annulation terminé';end if;
 select * into s from public.usagers where carte=journal.source;select * into t from public.usagers where carte=journal.cible;
 if s.revision<>journal.revision_source or t.revision<>journal.revision_cible then raise exception 'Conflit : une fiche a changé depuis la fusion' using errcode='40001';end if;
 for m in select * from jsonb_array_elements(journal.mouvements) loop
 if not exists(select 1 from guichet_prive.activites where id=(m->>'id')::uuid and revision=(m->>'revision')::int and carte=journal.cible) then raise exception 'Conflit : une activité a changé depuis la fusion' using errcode='40001';end if;end loop;
 update public.usagers set fusion_cible=null where carte=journal.source;
 for m in select * from jsonb_array_elements(journal.mouvements) loop update guichet_prive.activites set carte=journal.source,revision=revision+1 where id=(m->>'id')::uuid;end loop;
 delete from guichet_prive.fusions where id=op;return jsonb_build_object('restored',journal.source);
 end if;
 if exists(select 1 from guichet_prive.fusions where id=op and fusions.source=fusion.source and fusions.cible=fusion.cible) then return jsonb_build_object('id',op);end if;
 if source=cible then raise exception 'Choisir deux cartes distinctes';end if;
 select * into s from public.usagers where carte=source and fusion_cible is null;select * into t from public.usagers where carte=cible and fusion_cible is null;
 if s.carte is null or t.carte is null then raise exception 'Deux fiches actives sont nécessaires';end if;
 if exists(select 1 from guichet_prive.activites a join guichet_prive.activites b on b.jour=a.jour and b.type='vid' and not b.supprime and b.carte=cible where a.carte=source and a.type='vid' and not a.supprime and (a.donnees->>'slot')::time<(b.donnees->>'end')::time and (b.donnees->>'slot')::time<(a.donnees->>'end')::time) then raise exception 'Les deux cartes ont des réservations qui se chevauchent';end if;
 for m in select jsonb_build_object('id',id,'revision',revision+1) from guichet_prive.activites where carte=source loop mov:=mov||jsonb_build_array(m);end loop;
 update guichet_prive.activites set carte=cible,revision=revision+1 where carte=source;
 update public.usagers set fusion_cible=cible where carte=source returning * into s;
 insert into guichet_prive.fusions(id,source,cible,jour,mouvements,revision_source,revision_cible) values(op,source,cible,guichet_prive.jour(),mov,s.revision,t.revision);
 return jsonb_build_object('id',op,'moved',jsonb_array_length(mov));
end $$;
create function public.fusionner_fiches(source text,cible text,operation uuid,annuler boolean default false) returns jsonb
language sql security invoker set search_path='' as $$select guichet_prive.fusion(source,cible,operation,annuler)$$;

create function guichet_prive.comptes() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform guichet_prive.autoriser('roles.save');
 return (select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'profil',h.profil) order by u.email),'[]') from auth.users u left join guichet_prive.habilitations h on h.compte=u.id);
end $$;
create function public.comptes_guichet() returns jsonb language sql security invoker set search_path='' as $$select guichet_prive.comptes()$$;
create function guichet_prive.habiliter(compte_cible uuid,nouveau_profil text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform guichet_prive.autoriser('roles.save');perform pg_advisory_xact_lock(14458001);
 if nouveau_profil is not null and nouveau_profil not in ('agent','administrateur') then raise exception 'Profil invalide';end if;
 if exists(select 1 from guichet_prive.habilitations where compte=compte_cible and profil='administrateur') and nouveau_profil is distinct from 'administrateur'
 and (select count(*) from guichet_prive.habilitations where profil='administrateur')=1 then raise exception 'Conserver au moins un administrateur';end if;
 if nouveau_profil is null then delete from guichet_prive.habilitations where compte=compte_cible;
 else insert into guichet_prive.habilitations(compte,profil) values(compte_cible,nouveau_profil) on conflict(compte) do update set profil=excluded.profil;end if;
end $$;
create function public.attribuer_profil(compte uuid,profil text) returns void language sql security invoker set search_path='' as $$select guichet_prive.habiliter(compte,profil)$$;

revoke all on all functions in schema guichet_prive from public,anon,authenticated;
grant execute on function guichet_prive.profil(),guichet_prive.etat(),guichet_prive.commande(text,jsonb,uuid),guichet_prive.fusion(text,text,uuid,boolean),guichet_prive.comptes(),guichet_prive.habiliter(uuid,text) to authenticated;
revoke all on function public.fusionner_fiches(text,text,uuid,boolean),public.comptes_guichet(),public.attribuer_profil(uuid,text) from public,anon;
grant execute on function public.fusionner_fiches(text,text,uuid,boolean),public.comptes_guichet(),public.attribuer_profil(uuid,text) to authenticated;
select cron.schedule('guichet-cloture','* * * * *','select guichet_prive.cloturer(); delete from guichet_prive.fusions where jour<guichet_prive.jour();');

-- La restauration des comptages est vérifiée par le déclencheur de jauge.
create or replace function guichet_prive.commande(action text,d jsonb,op uuid) returns jsonb
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

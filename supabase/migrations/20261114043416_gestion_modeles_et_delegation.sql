-- Gestion des modèles sans déléguer la modification des autres réglages.
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
 if action in ('config.save','user.merge','user.unmerge','roles.save','stats','export','batch') then raise exception 'Administration rÃ©servÃ©e' using errcode='42501'; end if;
 if action in ('template.save','template.remove') then
  if not coalesce((cfg->'permissions'->>'templates')::boolean,false) then raise exception 'Gestion des modèles non déléguée' using errcode='42501';end if;
  return;
 end if;
 if action like 'event.%' and not coalesce((cfg->>'manageEvents')::boolean,false) then
 raise exception 'Gestion des sÃ©ances rÃ©servÃ©e' using errcode='42501'; end if;
 droit:=case when action='batch' then 'bulk' when action='export' then 'export' when action like '%.remove' then 'cancel'
 when action in ('board.save','video.move','guest.move') then 'edit' end;
 if droit is not null and not coalesce((cfg->'permissions'->>droit)::boolean,droit in ('cancel','edit')) then
 raise exception 'Action non dÃ©lÃ©guÃ©e' using errcode='42501'; end if;
end $function$
;
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
 if op is null or d is null or jsonb_typeof(d)<>'object' then raise exception 'Commande incomplÃ¨te' using errcode='22023'; end if;
 select * into precedent from guichet_prive.operations where id=op;
 if found then
 if precedent.compte<>auth.uid() or precedent.signature<>signature then raise exception 'Cette tentative a dÃ©jÃ  Ã©tÃ© utilisÃ©e pour une autre saisie. VÃ©rifier les lignes confirmÃ©es avant un nouveau passage.' using errcode='PT409'; end if;
 return precedent.resultat;
 end if;
 select contenu,revision into cfg,r from guichet_prive.reglages;
 if action in ('template.save','template.remove') then
 perform guichet_prive.autoriser(action);
 if (d->>'revision')::int is distinct from r then raise exception 'Conflit : modèles modifiés depuis une autre session. Brouillon conservé.' using errcode='PT409';end if;
 k:=d->>'name';avant:=coalesce(d->>'oldName','');v:=coalesce(cfg->'eventTemplates','{}'::jsonb);
 if k is null or trim(k)='' or trim(k)<>k or length(k)>100 or k in ('__proto__','constructor','prototype') then raise exception 'Nom de modèle invalide' using errcode='22023';end if;
 if action='template.remove' then
  if not(v ? k) then raise exception 'Modèle absent ou supprimé' using errcode='PT409';end if;
  v:=v-k;
 else
  if (avant<>'' and not(v ? avant)) or (k<>avant and v ? k) then raise exception 'Modèle absent ou nom déjà utilisé' using errcode='PT409';end if;
  x:=d->'model';
  if jsonb_typeof(x) is distinct from 'object' or nullif(trim(x->>'title'),'') is null or length(x->>'title')>200
  or (x->>'room') is null or x->>'room' not in ('Créazone','Salle JV')
  or (x->>'time') is null or (x->>'endTime') is null
  or x->>'time' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or x->>'endTime' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  or x->>'time'>=x->>'endTime' or (x->>'mode') is null or x->>'mode' not in ('inscription','libre')
  or nullif(x->>'cap','')::int<1 or nullif(x->>'minAge','')::numeric<0 or nullif(x->>'maxAge','')::numeric<coalesce(nullif(x->>'minAge','')::numeric,0)
  then raise exception 'Vérifier les paramètres du modèle' using errcode='22023';end if;
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into x from jsonb_each(x) where key=any(array['title','time','endTime','room','info','referent','audience','minAge','maxAge','mode','cap','announcement','image','eventType']);
  v:=(v-avant)||jsonb_build_object(k,x||'{"count":true}'::jsonb);
 end if;
 update guichet_prive.reglages set contenu=jsonb_set(cfg,'{eventTemplates}',v),revision=revision+1 where singleton;
 resultat:=jsonb_build_object('revision',r+1);
 elsif action='board.save' then
 j:=(d->>'date')::date;perform guichet_prive.date_ouverte(j);
 if d->>'sector' not in ('Jeunesse','Pop Zone') or nullif(trim(d->>'box'),'') is null
 or (d->>'kids')::int is null or (d->>'adults')::int is null or (d->>'kids')::int not between 0 and 1000 or (d->>'adults')::int not between 0 and 1000 then raise exception 'VÃ©rifier boÃ®te, secteur et effectifs' using errcode='22023'; end if;
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
 if (action like '%.restore') is distinct from a.supprime then raise exception 'Ã‰tat de la saisie modifiÃ©' using errcode='PT409'; end if;
 ids:=array_append(ids,a.id);joueurs:=joueurs||jsonb_build_array(a.donnees||jsonb_build_object('card',a.carte));
 end loop;
 if cardinality(ids)=0 then raise exception 'SÃ©lection vide'; end if;
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
 if (action like '%.restore') is distinct from a.supprime then raise exception 'Ã‰tat de la saisie modifiÃ©' using errcode='PT409'; end if;

 update guichet_prive.activites set supprime=action like '%.remove',revision=revision+1 where id=a.id;
 ids:=array_append(ids,a.id);conservation:=greatest(conservation,a.jour);
 end loop;resultat:=jsonb_build_object('ids',to_jsonb(ids));
 elsif action='user.replace' then
 if d->>'target' is null or d->>'target' !~ '^[0-9]{7}$' then raise exception 'Saisir les 7 chiffres de la nouvelle carte';end if;
 if exists(select 1 from public.usagers where carte=d->>'target') then raise exception 'Cette nouvelle carte appartient dÃ©jÃ  Ã  une fiche. Utiliser la fusion administrative.' using errcode='PT409';end if;
 update public.usagers set carte=d->>'target' where carte=d->>'source' and revision=(d->>'revision')::int and fusion_cible is null;
 if not found then raise exception 'La fiche a changÃ© : recharger sa version avant de remplacer la carte' using errcode='PT409';end if;
 resultat:=jsonb_build_object('card',d->>'target');
 elsif action='event.save' then
 j:=(d->>'date')::date;perform guichet_prive.date_ouverte(j);
 if nullif(trim(d->>'title'),'') is null or (d->>'time')::time is null or d->>'mode' not in ('inscription','libre')
 or nullif(d->>'cap','')::int<1 or nullif(d->>'minAge','')::numeric<0 or nullif(d->>'maxAge','')::numeric<nullif(d->>'minAge','')::numeric then raise exception 'VÃ©rifier les paramÃ¨tres de la sÃ©ance' using errcode='22023'; end if;
 if d->>'id' is not null then
 a:=guichet_prive.verifier_version((d->>'id')::uuid,(d->>'revision')::int);
 if a.type<>'ani' or a.supprime then raise exception 'SÃ©ance indisponible'; end if;
 -- Un changement de sÃ©rie conserve les exceptions dÃ©jÃ  personnalisÃ©es.
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
 n:=coalesce((d->>'repeat')::int,1);if n not between 1 and 52 then raise exception 'RÃ©pÃ©tition entre 1 et 52 semaines'; end if;
 if coalesce((d->>'repeatEvery')::int,1) not between 1 and 12 or coalesce(d->>'frequency','week') not in ('week','month') then raise exception 'RÃ©currence invalide';end if; serie:=case when n>1 then op end;
 for i in 0..n-1 loop cle:=case when i=0 then op else md5(op::text||':'||i)::uuid end;cible:=case when d->>'frequency'='month' then (j+make_interval(months=>i*coalesce((d->>'repeatEvery')::int,1)))::date else j+7*i*coalesce((d->>'repeatEvery')::int,1) end;
 insert into guichet_prive.activites(id,type,jour,groupe,donnees) values(cle,'ani',cible,serie,d-'id'-'revision'-'date'-'repeat'-'scope');
 ids:=array_append(ids,cle);conservation:=greatest(conservation,cible);end loop;
 end if;resultat:=jsonb_build_object('ids',to_jsonb(ids));
 elsif action='count.add' then
 select * into a from guichet_prive.activites where id=(d->>'eventId')::uuid and type='ani' and not supprime;
 perform guichet_prive.verifier_horizon(a.jour,(d->>'confirmEarly')::boolean);
 if a.id is null or a.donnees->>'mode'<>'libre' then raise exception 'SÃ©ance en entrÃ©e libre requise'; end if;
 if (d->>'kids')::int is null or (d->>'adults')::int is null or (d->>'kids')::int<0 or (d->>'adults')::int<0 then raise exception 'VÃ©rifier les effectifs'; end if;
 select coalesce(sum((donnees->>'kids')::int+(donnees->>'adults')::int),0) into n from guichet_prive.activites where parent=a.id and not supprime;
 if n+(d->>'kids')::int+(d->>'adults')::int>coalesce(nullif(a.donnees->>'cap','')::int,2147483647) then raise exception 'Plafond dÃ©passÃ©' using errcode='23514'; end if;
 insert into guichet_prive.activites(id,type,jour,parent,donnees) values(op,'count',a.jour,a.id,d-'eventId');resultat:=jsonb_build_object('ids',jsonb_build_array(op));conservation:=a.jour;
 elsif action='config.save' then
 if (d->>'revision')::int is distinct from r then raise exception 'Conflit : rÃ©glages modifiÃ©s depuis une autre session. Brouillon conservÃ©.' using errcode='PT409',detail=cfg::text; end if;

 v:=d->'settings';
 if d ? 'renamePost' then
  if jsonb_typeof(d->'renamePost') is distinct from 'object'
  or nullif(trim(d->'renamePost'->>'source'),'') is null
  or nullif(trim(d->'renamePost'->>'target'),'') is null
  or length(d->'renamePost'->>'target')>50
  or d->'renamePost'->>'target' in ('__proto__','constructor','prototype')
  or d->'renamePost'->>'target'<>trim(d->'renamePost'->>'target')
  or d->'renamePost'->>'source'=d->'renamePost'->>'target'
  then raise exception 'Renommage de poste invalide' using errcode='22023';end if;
  if not(cfg->'stations' ? (d->'renamePost'->>'source'))
  or exists(select 1 from jsonb_object_keys(cfg->'stations') nom where nom<>d->'renamePost'->>'source' and lower(nom)=lower(d->'renamePost'->>'target'))
  or v->'stations' ? (d->'renamePost'->>'source')
  or not(v->'stations' ? (d->'renamePost'->>'target'))
  then raise exception 'Le poste source a changÃ© ou le nouveau nom est dÃ©jÃ  utilisÃ©' using errcode='PT409';end if;
  update guichet_prive.activites
  set donnees=jsonb_set(donnees,'{post}',to_jsonb(d->'renamePost'->>'target')),revision=revision+1
  where type='vid' and donnees->>'post'=d->'renamePost'->>'source';
 end if;

 if jsonb_typeof(v->'stations') is distinct from 'object' or not exists(select 1 from jsonb_object_keys(v->'stations')) then raise exception 'Configurer au moins un poste';end if;
 for k,x in select * from jsonb_each(v->'stations') loop
 if trim(k)='' or (x->>'capacity')::int is null or (x->>'capacity')::int not between 1 and 4 or jsonb_array_length(x->'games')<1 or jsonb_array_length(x->'slots')<1 then raise exception 'VÃ©rifier poste, jeux et capacitÃ©';end if;
 avant:='';for slot in select * from jsonb_array_elements_text(x->'slots') order by 1 loop
 if slot !~ '^([01][0-9]|2[0-3]):[0-5][0-9]â€“([01][0-9]|2[0-3]):[0-5][0-9]$' or left(slot,5)>=right(slot,5) or left(slot,5)<avant then raise exception 'Horaires invalides ou chevauchants';end if;avant:=right(slot,5);end loop;
 end loop;
 -- Une fermeture forcÃ©e annule les rÃ©servations concernÃ©es dans la mÃªme transaction.
 if coalesce((d->>'forceClose')::boolean,false) then
 for a in select * from guichet_prive.activites where type='vid' and not supprime loop
 x:=v->'stations'->(a.donnees->>'post');x:=x||coalesce(x->'weekdays'->(extract(dow from a.jour)::int)::text,'{}'::jsonb);x:=x||coalesce(x->'exceptions'->a.jour::text,'{}');
 if x is not null and (not coalesce((x->>'enabled')::boolean,true) or v->'closedDates' ? a.jour::text) then
 update guichet_prive.activites set supprime=true,revision=revision+1 where id=a.id;ids:=array_append(ids,a.id);end if;
 end loop;end if;
 for a in select * from guichet_prive.activites where type='vid' and not supprime loop
 x:=v->'stations'->(a.donnees->>'post'); x:=x||coalesce(x->'weekdays'->(extract(dow from a.jour)::int)::text,'{}'::jsonb);x:=x||coalesce(x->'exceptions'->a.jour::text,'{}');
 if x is null or not coalesce((x->>'enabled')::boolean,true) or v->'closedDates' ? a.jour::text or not(x->'games' ? (a.donnees->>'game')) or not(x->'slots' ? ((a.donnees->>'slot')||'â€“'||(a.donnees->>'end'))) then raise exception 'RÃ©servation incompatible : % / % / %',a.jour,a.donnees->>'post',a.donnees->>'slot' using errcode='23514';end if;
 select sum(1+(donnees->>'companions')::int) into n from guichet_prive.activites where type='vid' and not supprime and jour=a.jour and donnees->>'post'=a.donnees->>'post' and donnees->>'slot'=a.donnees->>'slot';
 if n>(x->>'capacity')::int then raise exception 'Places dÃ©jÃ  rÃ©servÃ©es : % / %',a.jour,a.donnees->>'post' using errcode='23514';end if;
 end loop;
 update guichet_prive.reglages set contenu=v,revision=revision+1 where singleton;resultat:=jsonb_build_object('revision',r+1,'cancelled',to_jsonb(ids));
 elsif action='event.undo' then
 if jsonb_array_length(d->'events') not between 1 and 52 then raise exception 'Annulation de sÃ©rie invalide';end if;
 i:=0;for x in select * from jsonb_array_elements(d->'events') loop
 i:=i+1;v:=guichet_prive.commande('event.save',x,md5(op::text||':'||i)::uuid);
 ids:=ids||array(select jsonb_array_elements_text(v->'ids')::uuid);
 end loop;
 select greatest(guichet_prive.jour(),max(jour)) into conservation from guichet_prive.activites where id=any(ids);
 resultat:=jsonb_build_object('ids',to_jsonb(ids));
 elsif action='batch' then
 if jsonb_array_length(d->'commands') not between 1 and 200 then raise exception 'Lot de 1 Ã  200 lignes requis';end if;
 i:=0;resultat:='[]';for x in select * from jsonb_array_elements(d->'commands') loop
 if x->>'action' not in ('board.save','video.book','guest.book') then raise exception 'Type de ligne non importable';end if;
 i:=i+1;resultat:=resultat||jsonb_build_array(guichet_prive.commande(x->>'action',x->'data',md5(op::text||':'||i)::uuid));end loop;
 elsif action='export' then
 resultat:=guichet_prive.etat();
 else raise exception 'Action inconnue' using errcode='22023';end if;
 insert into guichet_prive.operations(id,compte,signature,jour,resultat) values(op,auth.uid(),signature,conservation,coalesce(resultat,'{}'));
 return resultat;
end $function$
;

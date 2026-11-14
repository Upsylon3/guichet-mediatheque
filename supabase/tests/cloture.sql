-- Recette privilégiée ; changements fictifs intégralement annulés.
begin;
select pg_advisory_xact_lock(14458001);
do $test$
declare d date:=guichet_prive.jour(); numero text; cible text; profil_test uuid;
 ancien uuid:=gen_random_uuid(); borne uuid:=gen_random_uuid(); recent uuid:=gen_random_uuid();
 video uuid:=gen_random_uuid(); futur uuid:=gen_random_uuid(); ev uuid:=gen_random_uuid();
 guest uuid:=gen_random_uuid(); libre uuid:=gen_random_uuid(); compteur uuid:=gen_random_uuid();
 op_ancien uuid:=gen_random_uuid();op_recent uuid:=gen_random_uuid();fusion uuid:=gen_random_uuid();
 instantane jsonb; avant jsonb; stats jsonb; cfg jsonb; revision_cfg integer;
 video_passee uuid:=gen_random_uuid();passee uuid:=gen_random_uuid();prochaine uuid:=gen_random_uuid();serie uuid:=gen_random_uuid();
begin
 loop numero:='0'||lpad((random()*999999)::int::text,6,'0');exit when not exists(select 1 from public.usagers where carte=numero);end loop;
 loop cible:='0'||lpad((random()*999999)::int::text,6,'0');exit when cible<>numero and not exists(select 1 from public.usagers where carte=cible);end loop;
 insert into public.usagers(carte,prenom) values(numero,'Conservation fictive'),(cible,'Futur fictif');
 select compte into profil_test from guichet_prive.habilitations where profil='agent' limit 1;
 insert into guichet_prive.activites(id,type,jour,carte,donnees) values
 (ancien,'soc',d-31,numero,'{"sector":"Jeunesse","box":"RECETTE-31","kids":2,"adults":1}'),
 (borne,'soc',d-30,numero,'{"sector":"Jeunesse","box":"RECETTE-30","kids":2,"adults":1}'),
 (recent,'soc',d-1,numero,'{"sector":"Jeunesse","box":"RECETTE-RECENT","kids":2,"adults":1}'),
 (video,'vid',d,numero,'{"post":"MARIO","slot":"16:45","end":"17:45","game":"Circuit","companions":0}'),
 (futur,'vid',d+45,cible,'{"post":"MARIO","slot":"10:15","end":"11:15","game":"Circuit","companions":0}');
 insert into guichet_prive.activites(id,type,jour,donnees) values
 (ev,'ani',d-1,'{"title":"Conservation fictive","time":"23:00","endTime":"23:30","room":"Créazone","mode":"inscription","count":true,"eventType":"RECETTE-30J"}'),
 (libre,'ani',d-1,'{"title":"Comptage fictif","time":"23:00","endTime":"23:30","room":"Salle JV","mode":"libre","count":true,"eventType":"RECETTE-30J"}');
 insert into guichet_prive.activites(id,type,jour,carte,parent,donnees) values
 (guest,'guest',d-1,numero,ev,'{"companions":2,"companionNames":["Alex Fictif","Sam Fictif"],"age":"4","ageUnit":"ans"}');
 insert into guichet_prive.activites(id,type,jour,parent,donnees) values(compteur,'count',d-1,libre,'{"kids":2,"adults":2}');
 insert into guichet_prive.operations(id,compte,signature,jour,resultat) values
 (op_ancien,profil_test,'fictif',d-31,'{}'),(op_recent,profil_test,'fictif',d-1,'{}');
 insert into guichet_prive.fusions(id,source,cible,jour,mouvements,revision_source,revision_cible)
 values(fusion,numero,cible,d-1,jsonb_build_array(jsonb_build_object('id',recent)),1,1);
 insert into guichet_prive.statistiques values(d-60,'{"activite":"Jeux de société","secteur":"Jeunesse","boite":"ARCHIVE-FICTIVE"}',1,9,5,4,0);
 perform guichet_prive.cloturer();
 if exists(select 1 from guichet_prive.activites where id=ancien) then raise exception 'J-31 non purgé';end if;
 if (select count(*) from guichet_prive.activites where id in (borne,recent,video,futur,ev,guest,libre,compteur))<>8 then raise exception 'Activités récentes, borne ou futur perdues';end if;
 if exists(select 1 from guichet_prive.operations where id=op_ancien) or not exists(select 1 from guichet_prive.operations where id=op_recent) or not exists(select 1 from guichet_prive.fusions where id=fusion) then raise exception 'Reprises ou fusions mal conservées';end if;
 if (select personnes from guichet_prive.statistiques where jour=d-31 and dimensions->>'boite'='RECETTE-31') is distinct from 3 then raise exception 'Statistiques non conservées avant purge';end if;
 if (select sum(personnes) from guichet_prive.statistiques where jour=d-1 and dimensions->>'type'='RECETTE-30J') is distinct from 7::bigint then raise exception 'Comptage animations incorrect';end if;
 select jsonb_agg(to_jsonb(s) order by jour,dimensions) into avant from guichet_prive.statistiques s;
 perform guichet_prive.cloturer();
 if avant is distinct from (select jsonb_agg(to_jsonb(s) order by jour,dimensions) from guichet_prive.statistiques s) then raise exception 'Reprise : doublon ou archive effacée';end if;
 perform set_config('request.jwt.claim.sub',profil_test::text,true);
 instantane:=guichet_prive.etat();
 if not instantane::text like '%'||recent::text||'%' or not instantane::text like '%'||borne::text||'%' or instantane::text like '%'||ancien::text||'%' then raise exception 'Historique trente jours absent de l’état agent';end if;
 if instantane ? 'totals' then raise exception 'Statistiques exposées à un agent';end if;
 select compte into profil_test from guichet_prive.habilitations where profil='administrateur' limit 1;
 perform set_config('request.jwt.claim.sub',profil_test::text,true);
 stats:=guichet_prive.statistiques(d-60,d+45);
 if (select sum((x->>'personnes')::int) from jsonb_array_elements(stats) x where x->'dimensions'->>'boite'='RECETTE-RECENT') is distinct from 3::bigint then raise exception 'Passé compté deux fois dans l’API';end if;
 if (select sum((x->>'personnes')::int) from jsonb_array_elements(stats) x where x->'dimensions'->>'boite'='ARCHIVE-FICTIVE') is distinct from 9::bigint then raise exception 'Ancienne archive perdue';end if;
 if stats::text like '%'||numero||'%' or stats::text like '%Conservation fictive%' then raise exception 'Identité dans les statistiques';end if;
 update guichet_prive.activites set donnees=jsonb_set(jsonb_set(donnees,'{kids}','4'),'{box}','"RECETTE-CORRIGEE"') where id=recent;
 perform guichet_prive.cloturer();
 if exists(select 1 from guichet_prive.statistiques where jour=d-1 and dimensions->>'boite'='RECETTE-RECENT') or (select personnes from guichet_prive.statistiques where jour=d-1 and dimensions->>'boite'='RECETTE-CORRIGEE') is distinct from 5 then raise exception 'Correction statistique incorrecte';end if;
 update guichet_prive.activites set supprime=true where id=recent;perform guichet_prive.cloturer();
 if exists(select 1 from guichet_prive.statistiques where jour=d-1 and dimensions->>'boite'='RECETTE-CORRIGEE') then raise exception 'Annulation encore comptée';end if;
 update guichet_prive.activites set supprime=false where id=recent;perform guichet_prive.cloturer();
 if (select personnes from guichet_prive.statistiques where jour=d-1 and dimensions->>'boite'='RECETTE-CORRIGEE') is distinct from 5 then raise exception 'Restauration statistique incorrecte';end if;
 -- La dernière ligne quitte une date : son ancien agrégat doit disparaître.
 update guichet_prive.activites set jour=d+45 where id=borne;perform guichet_prive.cloturer();
 if exists(select 1 from guichet_prive.statistiques where jour=d-30 and dimensions->>'boite'='RECETTE-30') then raise exception 'Ancien jour vide encore compté';end if;
 -- Fermer ou reconfigurer un poste ne doit pas toucher ses réservations déjà passées.
 select contenu,revision into cfg,revision_cfg from guichet_prive.reglages;
 cfg:=jsonb_set(cfg,'{stations,HISTORIQUE-30J}','{"capacity":1,"games":["Fictif"],"slots":["09:00–10:00"],"enabled":true}');
 perform guichet_prive.commande('config.save',jsonb_build_object('settings',cfg,'revision',revision_cfg),gen_random_uuid());
 insert into guichet_prive.activites(id,type,jour,carte,donnees) values(video_passee,'vid',d-7,numero,'{"post":"HISTORIQUE-30J","slot":"09:00","end":"10:00","game":"Fictif","companions":0}');
 select contenu,revision into cfg,revision_cfg from guichet_prive.reglages;
 cfg:=jsonb_set(cfg,'{stations,HISTORIQUE-30J,enabled}','false');
 perform guichet_prive.commande('config.save',jsonb_build_object('settings',cfg,'revision',revision_cfg),gen_random_uuid());
 if (select supprime from guichet_prive.activites where id=video_passee) is distinct from false then raise exception 'La fermeture a annulé une réservation historique';end if;
 -- La modification des séances à venir laisse intactes celles déjà terminées.
 insert into guichet_prive.activites(id,type,jour,groupe,donnees) values
 (passee,'ani',d-7,serie,'{"title":"Titre passé","time":"23:40","endTime":"23:55","room":"Créazone","mode":"inscription","count":true}'),
 (prochaine,'ani',d+7,serie,'{"title":"Titre futur","time":"23:40","endTime":"23:55","room":"Créazone","mode":"inscription","count":true}');
 perform guichet_prive.commande('event.save',jsonb_build_object('id',prochaine,'revision',1,'date',d+7,'title','Futur corrigé','time','23:40','endTime','23:55','room','Créazone','mode','inscription','count',true,'scope','all'),gen_random_uuid());
 if (select donnees->>'title' from guichet_prive.activites where id=passee)<>'Titre passé' or (select donnees->>'title' from guichet_prive.activites where id=prochaine)<>'Futur corrigé' then raise exception 'Modification de série incompatible avec historique';end if;
 perform guichet_prive.cloturer(d+1);
 begin
  perform guichet_prive.video(gen_random_uuid(),jsonb_build_object('date',d,'post','MARIO','slot','11:15','game','Circuit','players',jsonb_build_array(jsonb_build_object('card',numero,'companions',0))));
  raise exception 'Seconde inscription JV acceptée';
 exception when sqlstate 'PT409' then
  if position('de 16:45 à 17:45 sur le poste MARIO' in sqlerrm)=0 then raise exception 'Détail JV perdu après minuit';end if;
 end;
 perform guichet_prive.cloturer(d+31);
 if exists(select 1 from guichet_prive.activites where id in (recent,video,ev,guest,libre,compteur)) then raise exception 'Activités expirées présentes';end if;
 if not exists(select 1 from guichet_prive.activites where id=futur) or not exists(select 1 from public.usagers where carte=numero) then raise exception 'Futur ou fiche effacé';end if;
 if exists(select 1 from guichet_prive.operations where id=op_recent) or exists(select 1 from guichet_prive.fusions where id=fusion) then raise exception 'Anciennes références conservées';end if;
 select jsonb_agg(to_jsonb(s) order by jour,dimensions) into avant from guichet_prive.statistiques s;
 perform guichet_prive.cloturer(d+31);
 if avant is distinct from (select jsonb_agg(to_jsonb(s) order by jour,dimensions) from guichet_prive.statistiques s) then raise exception 'Agrégats modifiés après purge rejouée';end if;
 if exists(select 1 from guichet_prive.quotas_jv where usager=(select id from public.usagers where carte=numero)) then raise exception 'Quota périmé conservé';end if;
 if not exists(select 1 from cron.job where jobname='guichet-cloture' and active) then raise exception 'Planification inactive';end if;
end $test$;
do $fusion$
declare source text; cible text; a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
begin
 loop source:='0'||lpad((random()*999999)::int::text,6,'0');exit when not exists(select 1 from public.usagers where carte=source);end loop;
 loop cible:='0'||lpad((random()*999999)::int::text,6,'0');exit when cible<>source and not exists(select 1 from public.usagers where carte=cible);end loop;
 insert into public.usagers(carte,prenom) values(source,'Fusion fictive'),(cible,'Cible fictive');
 insert into guichet_prive.activites(id,type,jour,carte,donnees) values
 (a,'vid',guichet_prive.jour()-7,source,'{"post":"MARIO","slot":"10:15","end":"11:15","game":"Circuit","companions":0}'),
 (b,'vid',guichet_prive.jour()-7,cible,'{"post":"MARIO","slot":"11:15","end":"12:15","game":"Circuit","companions":0}');
 if exists(select 1 from guichet_prive.quotas_jv where reservation in (a,b)) then raise exception 'Quota ancien recréé';end if;
 perform guichet_prive.fusion(source,cible,gen_random_uuid(),false);
 if (select count(*) from guichet_prive.activites where id in(a,b) and carte=cible)<>2 then raise exception 'Fusion des inscriptions historiques incorrecte';end if;
end $fusion$;
select 'Conservation 30 jours, historique agent, statistiques sans doublons, corrections, purge, futur et fusions : OK' as resultat;
rollback;

-- Recette privilégiée sur la base de développement ; tous les changements sont
-- annulés, y compris l'agrégation de données fictives et le nettoyage testé.
begin;
do $test$
declare numero text; cible text; date_test date:=guichet_prive.jour()-1;
 soc uuid:=gen_random_uuid();vid uuid:=gen_random_uuid();ev uuid:=gen_random_uuid();g uuid:=gen_random_uuid();
 libre uuid:=gen_random_uuid();compteur uuid:=gen_random_uuid();futur uuid:=gen_random_uuid();operation uuid:=gen_random_uuid();fusion uuid:=gen_random_uuid();
 avant_soc int;avant_vid int;avant_ani int;apres jsonb;profil_test uuid;instantane jsonb;
begin
 loop numero:='0'||lpad((random()*999999)::int::text,6,'0');exit when not exists(select 1 from public.usagers where carte=numero);end loop;
 insert into public.usagers(carte,prenom) values(numero,'Recette fictive clôture');
 loop cible:='0'||lpad((random()*999999)::int::text,6,'0');exit when not exists(select 1 from public.usagers where carte=cible);end loop;
 insert into public.usagers(carte,prenom) values(cible,'Réservation fictive future');
 select coalesce(sum(personnes),0) into avant_soc from guichet_prive.totaux where jour=date_test and activite='Jeux de société';
 select coalesce(sum(personnes),0) into avant_vid from guichet_prive.totaux where jour=date_test and activite='Jeux vidéo';
 select coalesce(sum(personnes),0) into avant_ani from guichet_prive.totaux where jour=date_test and activite='Animations';
 insert into guichet_prive.activites(id,type,jour,carte,donnees) values
 (soc,'soc',date_test,numero,'{"sector":"Jeunesse","box":"TEST-CLOTURE","kids":2,"adults":1}'),
 (vid,'vid',date_test,numero,'{"post":"MARIO","slot":"10:15","end":"11:15","game":"Circuit","companions":1}'),
 (futur,'vid',guichet_prive.jour()+3,cible,'{"post":"MARIO","slot":"10:15","end":"11:15","game":"Circuit","companions":0}');
 insert into guichet_prive.activites(id,type,jour,donnees) values
 (ev,'ani',date_test,'{"title":"Clôture fictive","time":"14:00","mode":"inscription","count":true,"cap":10}'),
 (libre,'ani',date_test,'{"title":"Entrée libre fictive","time":"14:00","mode":"libre","count":true,"cap":10}');
 insert into guichet_prive.activites(id,type,jour,carte,parent,donnees) values(g,'guest',date_test,numero,ev,'{"companions":2,"age":"4","ageUnit":"ans"}');
 insert into guichet_prive.activites(id,type,jour,parent,donnees) values(compteur,'count',date_test,libre,'{"kids":2,"adults":2}');
 select compte into profil_test from guichet_prive.habilitations where profil='agent' limit 1;
 insert into guichet_prive.operations(id,compte,signature,jour,resultat) values(operation,profil_test,'fictif',date_test,jsonb_build_object('ids',jsonb_build_array(soc)));
 insert into guichet_prive.fusions(id,source,cible,jour,mouvements,revision_source,revision_cible) values(fusion,numero,cible,date_test,jsonb_build_array(jsonb_build_object('id',soc)),1,1);
 perform guichet_prive.cloturer();
 if exists(select 1 from guichet_prive.activites where id in (soc,vid,ev,g,libre,compteur)) then raise exception 'Échec : liens nominatifs anciens conservés';end if;
 if exists(select 1 from guichet_prive.operations where id=operation) or exists(select 1 from guichet_prive.fusions where id=fusion) then raise exception 'Échec : références anciennes dans les journaux';end if;
 if not exists(select 1 from guichet_prive.activites where id=futur and carte=cible) then raise exception 'Échec : réservation future effacée';end if;
 if not exists(select 1 from public.usagers where carte=numero) then raise exception 'Échec : fiche usager effacée';end if;
 if (select sum(personnes) from guichet_prive.totaux where jour=date_test and activite='Jeux de société')<>avant_soc+3 then raise exception 'Total société incorrect';end if;
 if (select sum(personnes) from guichet_prive.totaux where jour=date_test and activite='Jeux vidéo')<>avant_vid+2 then raise exception 'Total vidéo incorrect';end if;
 if (select sum(personnes) from guichet_prive.totaux where jour=date_test and activite='Animations')<>avant_ani+7 then raise exception 'Total animations incorrect';end if;
 select jsonb_agg(to_jsonb(t) order by jour,activite,secteur) into apres from guichet_prive.totaux t;
 perform guichet_prive.cloturer();
 if apres is distinct from (select jsonb_agg(to_jsonb(t) order by jour,activite,secteur) from guichet_prive.totaux t) then raise exception 'Clôture rejouée : totaux doublés';end if;
 perform set_config('request.jwt.claim.sub',profil_test::text,true);
 instantane:=guichet_prive.etat();
 if instantane::text like '%'||numero||'%' or instantane::text like '%'||soc::text||'%' then raise exception 'Historique nominatif réexposé par l’API';end if;
 if not exists(select 1 from cron.job where jobname='guichet-cloture' and active) then raise exception 'Planification de clôture inactive';end if;
end $test$;
select 'Clôture atomique, totaux exacts, replay sans doublon, purge des liens et réservations futures : OK' as resultat;
rollback;

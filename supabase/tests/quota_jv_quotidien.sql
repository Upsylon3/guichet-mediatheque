-- Recette privilégiée : changement de quota sans effacer les réservations existantes.
begin;
select pg_advisory_xact_lock(14458001);
do $test$
declare
  compte uuid:=gen_random_uuid();
  d date:=guichet_prive.jour()+((8-extract(dow from guichet_prive.jour())::int)%7);
  numero text; nouvelle text; autre text;
  cfg jsonb; rev integer; reservation uuid; lendemain uuid; op uuid:=gen_random_uuid();
  resultat jsonb; data jsonb; v integer;
begin
  insert into auth.users(id,email) values(compte,'quota-quotidien@example.invalid');
  insert into guichet_prive.habilitations(compte,profil) values(compte,'administrateur');
  perform set_config('request.jwt.claim.sub',compte::text,true);
  loop numero:='0'||lpad((random()*999999)::int::text,6,'0');exit when not exists(select 1 from public.usagers where usagers.carte=numero);end loop;
  loop nouvelle:='0'||lpad((random()*999999)::int::text,6,'0');exit when nouvelle<>numero and not exists(select 1 from public.usagers where usagers.carte=nouvelle);end loop;
  loop autre:='0'||lpad((random()*999999)::int::text,6,'0');exit when autre not in(numero,nouvelle) and not exists(select 1 from public.usagers where usagers.carte=autre);end loop;
  select contenu,revision into cfg,rev from guichet_prive.reglages;
  cfg:=jsonb_set(cfg,'{stations,RECETTE-JOUR}','{"capacity":4,"games":["Fictif"],"slots":["09:00–10:00","10:00–11:00","11:00–12:00"],"enabled":true}');
  cfg:=jsonb_set(cfg,'{stations,RECETTE-AUTRE}',cfg->'stations'->'RECETTE-JOUR');
  cfg:=jsonb_set(cfg,'{closedDates}','[]');
  perform public.commande_guichet('config.save',jsonb_build_object('settings',cfg,'revision',rev),gen_random_uuid());
  data:=jsonb_build_object('date',d,'post','RECETTE-JOUR','slot','09:00','game','Fictif','players',jsonb_build_array(jsonb_build_object('card',numero,'companions',0)));
  resultat:=public.commande_guichet('video.book',data,op);
  reservation:=(resultat->'ids'->>0)::uuid;
  if public.commande_guichet('video.book',data,op) is distinct from resultat then raise exception 'Reprise non idempotente';end if;
  begin
    perform public.commande_guichet('video.book',data||'{"post":"RECETTE-AUTRE","slot":"10:00"}',gen_random_uuid());
    raise exception 'Deux inscriptions acceptées le même jour';
  exception when sqlstate 'PT409' then
    if position('Une seule inscription JV par jour.' in sqlerrm)=0 or position('de 09:00 à 10:00' in sqlerrm)=0 then raise exception 'Détail du quota quotidien absent : %',sqlerrm;end if;
  end;
  -- Lundi et mardi de la même semaine : deux réservations autorisées.
  lendemain:=(public.commande_guichet('video.book',data||jsonb_build_object('date',d+1),gen_random_uuid())->'ids'->>0)::uuid;
  if (select count(*) from guichet_prive.quotas_jv q join public.usagers u on u.id=q.usager where u.carte=numero)<>2 then raise exception 'Deux dates de la même semaine refusées';end if;
  begin
    perform public.commande_guichet('video.move',jsonb_build_object('date',d+1,'post','RECETTE-JOUR','slot','10:00','game','Fictif','rows',jsonb_build_array(jsonb_build_object('id',reservation,'revision',1))),gen_random_uuid());
    raise exception 'Déplacement doublant le quota accepté';
  exception when sqlstate 'PT409' then null;
  end;
  perform public.commande_guichet('video.move',jsonb_build_object('date',d,'post','RECETTE-JOUR','slot','10:00','game','Fictif','rows',jsonb_build_array(jsonb_build_object('id',reservation,'revision',1))),gen_random_uuid());
  -- Annuler libère la date ; restaurer ne doit pas contourner la nouvelle inscription.
  perform public.commande_guichet('video.remove',jsonb_build_object('rows',jsonb_build_array(jsonb_build_object('id',lendemain,'revision',1))),gen_random_uuid());
  perform public.commande_guichet('video.book',data||jsonb_build_object('date',d+1,'slot','11:00'),gen_random_uuid());
  begin
    perform public.commande_guichet('video.restore',jsonb_build_object('rows',jsonb_build_array(jsonb_build_object('id',lendemain,'revision',2))),gen_random_uuid());
    raise exception 'Restauration doublant le quota acceptée';
  exception when sqlstate 'PT409' then null;
  end;
  select revision into v from public.usagers u where u.carte=numero;
  perform public.commande_guichet('user.replace',jsonb_build_object('source',numero,'target',nouvelle,'revision',v),gen_random_uuid());
  begin
    perform public.commande_guichet('video.book',jsonb_set(data,'{players}',jsonb_build_array(jsonb_build_object('card',nouvelle,'companions',0))),gen_random_uuid());
    raise exception 'Changement de numero contournant le quota';
  exception when sqlstate 'PT409' then null;
  end;
  -- Fusionner deux dates différentes est permis ; les index suivent la même fiche.
  perform public.commande_guichet('video.book',data||jsonb_build_object('date',d+2,'players',jsonb_build_array(jsonb_build_object('card',autre,'companions',0))),gen_random_uuid());
  perform guichet_prive.fusion(autre,nouvelle,gen_random_uuid(),false);
  if (select count(*) from guichet_prive.quotas_jv q join public.usagers u on u.id=q.usager where u.carte=nouvelle)<>3 then raise exception 'Fusion de journées distinctes incorrecte';end if;
  perform guichet_prive.cloturer(d+1);
  if exists(select 1 from guichet_prive.quotas_jv where jour<d+1) then raise exception 'Quota passé conservé';end if;
  if not exists(select 1 from guichet_prive.activites where id=reservation) then raise exception 'Historique effacé à l’expiration du quota';end if;
end $test$;
select 'Quota JV quotidien : doublons, lendemain, déplacement, annulation, restauration, numero, fusion et expiration : OK' as resultat;
rollback;

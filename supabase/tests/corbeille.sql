-- Recette privilégiée, intégralement annulée : droits, concurrence, cascade et reprise.
begin;
select pg_advisory_xact_lock(14458001);
do $test$
declare
  administrateur uuid := gen_random_uuid();
  agent uuid := gen_random_uuid();
  seance uuid := gen_random_uuid();
  participant uuid := gen_random_uuid();
  active uuid := gen_random_uuid();
  ajout uuid := gen_random_uuid();
  operation uuid := gen_random_uuid();
  instantane jsonb;
  resultat jsonb;
  numero text;
begin
  insert into auth.users(id,email) values (administrateur,'corbeille-admin@example.invalid'),(agent,'corbeille-agent@example.invalid');
  insert into guichet_prive.habilitations(compte,profil) values (administrateur,'administrateur'),(agent,'agent');
  -- Isoler cette recette des données existantes ; le rollback rétablit tout.
  delete from guichet_prive.activites;
  loop
    numero := '0'||lpad((random()*999999)::int::text,6,'0');
    exit when not exists(select 1 from public.usagers where carte=numero);
  end loop;
  insert into public.usagers(carte) values(numero);
  insert into guichet_prive.activites(id,type,jour,supprime,donnees) values
    (seance,'ani',guichet_prive.jour()+7,false,'{"title":"Corbeille fictive","room":"Créazone","time":"23:00","endTime":"23:30","mode":"inscription","count":true}');
  insert into guichet_prive.activites(id,type,jour,carte,parent,donnees) values
    (participant,'guest',guichet_prive.jour()+7,numero,seance,'{"companions":0,"category":"Enfant"}');
  update guichet_prive.activites set supprime=true where id=seance;
  insert into guichet_prive.activites(id,type,jour,carte,donnees) values
    (active,'soc',guichet_prive.jour(),numero,'{"sector":"Jeunesse","box":"TEST","kids":1,"adults":0}');
  instantane := jsonb_build_object('rows',jsonb_build_array(jsonb_build_object('id',seance,'revision',1)));
  perform set_config('request.jwt.claim.sub',agent::text,true);
  begin
    perform public.commande_guichet('trash.empty',instantane,gen_random_uuid());
    raise exception 'Purge acceptée pour un agent';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.commande_guichet('trash.empty',instantane,gen_random_uuid());
    raise exception 'Purge acceptée sans connexion';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',administrateur::text,true);
  update guichet_prive.activites set revision=revision+1 where id=seance;
  begin
    perform public.commande_guichet('trash.empty',instantane,gen_random_uuid());
    raise exception 'Instantané périmé accepté';
  exception when sqlstate 'PT409' then null;
  end;
  if not exists(select 1 from guichet_prive.activites where id=seance) then raise exception 'Suppression partielle après conflit'; end if;
  instantane := jsonb_build_object('rows',jsonb_build_array(jsonb_build_object('id',seance,'revision',2)));
  resultat := public.commande_guichet('trash.empty',instantane,operation);
  if resultat->>'deleted'<>'1' or exists(select 1 from guichet_prive.activites where id in (seance,participant)) then raise exception 'Purge ou cascade incorrecte'; end if;
  if not exists(select 1 from guichet_prive.activites where id=active) or not exists(select 1 from public.usagers where carte=numero) then raise exception 'Activité active ou fiche effacée'; end if;
  insert into guichet_prive.activites(id,type,jour,carte,supprime,donnees) values
    (ajout,'soc',guichet_prive.jour(),numero,true,'{"sector":"Jeunesse","box":"APRES","kids":1,"adults":0}');
  if public.commande_guichet('trash.empty',instantane,operation) is distinct from resultat then raise exception 'Reprise non idempotente'; end if;
  if not exists(select 1 from guichet_prive.activites where id=ajout) then raise exception 'Reprise ayant effacé une nouvelle saisie'; end if;
  begin
    perform public.commande_guichet('trash.empty','{"rows":[]}',gen_random_uuid());
    raise exception 'Nouvelle saisie ignorée dans la confirmation';
  exception when sqlstate 'PT409' then null;
  end;
end $test$;
select 'Corbeille : droits, instantané, cascade, activités préservées et reprise : OK' as resultat;
rollback;

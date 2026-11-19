-- Recette transactionnelle des accès et des nouvelles inscriptions.
begin;
select pg_advisory_xact_lock(14458001);
do $test$
declare
  acteur uuid := gen_random_uuid();
  poste uuid := gen_random_uuid();
  date_seance date := guichet_prive.jour() + 2;
  numero text;
  seance uuid;
  inscription uuid;
  modele jsonb;
begin
  insert into auth.users(id,email) values(acteur,'simplification-guichet@example.invalid');
  insert into auth.users(id,is_anonymous) values(poste,true);
  insert into guichet_prive.habilitations(compte,profil) values(acteur,'administrateur');
  perform set_config('request.jwt.claim.sub',acteur::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',acteur,'is_anonymous',false)::text,true);
  perform public.administrer_postes_agents('activer',poste,'Navigateur de recette');
  perform set_config('request.jwt.claim.sub',poste::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',poste,'is_anonymous',true)::text,true);
  if public.mon_profil() is distinct from 'agent' then raise exception 'Session agent mal habilitée'; end if;
  begin
    perform public.administrer_postes_agents('lister');
    raise exception 'La gestion des postes est accessible à un agent';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.statistiques_guichet(date_seance,date_seance);
    raise exception 'Statistiques accessibles à une session agent';
  exception when insufficient_privilege then null;
  end;
  if guichet_prive.autoriser_session_anonyme('{"user":{"is_anonymous":true}}') ? 'error'
    or not (guichet_prive.autoriser_session_anonyme('{"user":{"is_anonymous":false}}') ? 'error')
  then raise exception 'Contrôle de création des sessions incorrect'; end if;
  perform set_config('request.jwt.claim.sub',acteur::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',acteur,'is_anonymous',false)::text,true);
  perform public.administrer_postes_agents('revoquer',poste);
  perform set_config('request.jwt.claim.sub',poste::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',poste,'is_anonymous',true)::text,true);
  if public.mon_profil() is not null then raise exception 'Un poste révoqué reste habilité'; end if;
  begin
    perform public.etat_guichet();
    raise exception 'L’état partagé est accessible après révocation';
  exception when insufficient_privilege then null;
  end;
  perform set_config('request.jwt.claim.sub',acteur::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',acteur,'is_anonymous',false)::text,true);

  modele := '{"title":"Recette accès","time":"10:00","endTime":"11:00","mode":"inscription","count":true,"room":"Créazone"}';
  perform public.commande_guichet('event.save',modele || jsonb_build_object('date',date_seance),gen_random_uuid());
  perform public.commande_guichet('event.save',modele || jsonb_build_object('date',date_seance),gen_random_uuid());
  seance := (public.commande_guichet('event.save',(modele-'room') || jsonb_build_object('date',date_seance),gen_random_uuid())->'ids'->>0)::uuid;
  perform public.commande_guichet('template.save',jsonb_build_object(
    'name','Recette '||acteur, 'model',modele-'room', 'revision',(select revision from guichet_prive.reglages)
  ),gen_random_uuid());
  loop
    numero := '0'||lpad((random()*999999)::int::text,6,'0');
    exit when not exists(select 1 from public.usagers where carte=numero);
  end loop;
  begin
    perform public.commande_guichet('guest.book',jsonb_build_object(
      'eventId',seance,'players',jsonb_build_array(jsonb_build_object('card',numero))
    ),gen_random_uuid());
    raise exception 'Inscription sans âge acceptée';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.commande_guichet('guest.book',jsonb_build_object(
      'eventId',seance,'players',jsonb_build_array(jsonb_build_object(
        'card',numero,'age',10,'companions',1,'companionNames',jsonb_build_array('Nom fictif')
      ))
    ),gen_random_uuid());
    raise exception 'Accompagnateur accepté dans une séance sans jauge';
  exception when invalid_parameter_value then null;
  end;
  if exists(select 1 from public.usagers where carte=numero)
  then raise exception 'Une inscription refusée a créé une fiche'; end if;
  inscription := (public.commande_guichet('guest.book',jsonb_build_object(
    'eventId',seance,'players',jsonb_build_array(jsonb_build_object('card',numero,'age',0,'ageUnit','mois'))
  ),gen_random_uuid())->'ids'->>0)::uuid;
  if not exists(select 1 from guichet_prive.activites
    where id=inscription and donnees->>'age'='0' and donnees->>'companions'='0')
  then raise exception 'Inscription individuelle incorrecte'; end if;
end
$test$;
rollback;

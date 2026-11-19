-- Recette privilégiée annulée : tester les vrais appels de réservation et les dérogations.
begin;
create or replace function guichet_prive.jour() returns date language sql stable set search_path='' as $$ select date '2026-11-14' $$;
select pg_advisory_xact_lock(14458001);
update guichet_prive.reglages set contenu=jsonb_set(
  jsonb_set(contenu,'{stations,MARIO,games}','["Circuit"]'),
  '{stations,SPYRO,games}','["Voyage"]'
);
do $test$
declare
  acteur uuid:=gen_random_uuid();
  numero text;
  joueur jsonb;
  cfg jsonb;
  rev integer;
  resultat jsonb;
begin
  insert into auth.users(id,email) values(acteur,'horaires-agent@example.invalid');
  insert into guichet_prive.habilitations(compte,profil) values(acteur,'agent');
  perform set_config('request.jwt.claim.sub',acteur::text,true);
  loop numero:='0'||lpad((random()*999999)::int::text,6,'0');exit when not exists(select 1 from public.usagers where carte=numero);end loop;
  joueur:=jsonb_build_array(jsonb_build_object('card',numero,'companions',0));
  begin
    perform public.commande_guichet('video.book',jsonb_build_object('date','2026-11-16','post','MARIO','slot','10:15','game','Circuit','players',joueur),gen_random_uuid());
    raise exception 'Lundi ordinaire accepté';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.commande_guichet('video.book',jsonb_build_object('date','2026-11-18','post','MARIO','slot','10:15','game','Circuit','players',joueur),gen_random_uuid());
    raise exception 'Mercredi matin accepté';
  exception when invalid_parameter_value then null;
  end;
  perform public.commande_guichet('video.book',jsonb_build_object('date','2026-11-18','post','MARIO','slot','13:45','game','Circuit','players',joueur),gen_random_uuid());
  -- Une autre date de la même semaine reste possible, même avec les horaires restreints.
  perform public.commande_guichet('video.book',jsonb_build_object('date','2026-11-21','post','MARIO','slot','10:15','game','Circuit','players',joueur),gen_random_uuid());
  begin
    perform public.commande_guichet('video.book',jsonb_build_object('date','2026-11-21','post','SPYRO','slot','13:45','game','Voyage','players',joueur),gen_random_uuid());
    raise exception 'Second poste du même jour accepté';
  exception when sqlstate 'PT409' then null;
  end;
  begin
    perform public.commande_guichet('video.book',jsonb_build_object('date','2026-11-28','post','SPYRO','slot','11:15','game','Voyage','players',joueur),gen_random_uuid());
    raise exception 'Créneau SPYRO inexistant accepté';
  exception when invalid_parameter_value then null;
  end;
  resultat:=public.commande_guichet('video.book',jsonb_build_object('date','2026-11-28','post','SPYRO','slot','10:15','game','Voyage','players',joueur),gen_random_uuid());
  if (select donnees->>'end' from guichet_prive.activites where id=(resultat->'ids'->>0)::uuid)<>'11:45' then raise exception 'Durée SPYRO incorrecte';end if;
  perform public.commande_guichet('video.book',jsonb_build_object('date','2026-12-22','post','MARIO','slot','13:45','game','Circuit','players',joueur),gen_random_uuid());
  begin
    perform public.commande_guichet('video.book',jsonb_build_object('date','2026-12-24','post','MARIO','slot','13:45','game','Circuit','players',joueur),gen_random_uuid());
    raise exception 'Jeudi avant ouverture accepté';
  exception when invalid_parameter_value then null;
  end;
  perform public.commande_guichet('video.book',jsonb_build_object('date','2026-12-24','post','MARIO','slot','15:15','game','Circuit','players',joueur),gen_random_uuid());
  -- Les vacances de la zone C sont évaluées en 2027, au-delà des dates du classeur.
  perform public.commande_guichet('video.book',jsonb_build_object('date','2027-02-09','post','MARIO','slot','13:45','game','Circuit','players',joueur),gen_random_uuid());
  begin
    perform public.commande_guichet('video.book',jsonb_build_object('date','2027-02-23','post','MARIO','slot','13:45','game','Circuit','players',joueur),gen_random_uuid());
    raise exception 'Vacances d’une autre zone acceptées';
  exception when invalid_parameter_value then null;
  end;
  begin
    perform public.commande_guichet('video.book',jsonb_build_object('date','2026-12-25','post','MARIO','slot','15:15','game','Circuit','players',joueur),gen_random_uuid());
    raise exception 'Jour férié ouvert automatiquement';
  exception when invalid_parameter_value then null;
  end;
  -- Seul l’administrateur peut rouvrir un lundi dans les réglages.
  select contenu,revision into cfg,rev from guichet_prive.reglages;
  cfg:=jsonb_set(cfg,'{stations,MARIO,exceptions,2026-11-16}','{"enabled":true,"slots":["09:00–10:00"]}');
  begin
    perform public.commande_guichet('config.save',jsonb_build_object('settings',cfg,'revision',rev),gen_random_uuid());
    raise exception 'Dérogation accordée par un agent';
  exception when insufficient_privilege then null;
  end;
  update guichet_prive.habilitations set profil='administrateur' where compte=acteur;
  perform public.commande_guichet('config.save',jsonb_build_object('settings',cfg,'revision',rev),gen_random_uuid());
  update guichet_prive.habilitations set profil='agent' where compte=acteur;
  perform public.commande_guichet('video.book',jsonb_build_object('date','2026-11-16','post','MARIO','slot','09:00','game','Circuit','players',joueur),gen_random_uuid());
end $test$;
select 'Horaires JV : jours fermés, durées, dates du classeur, quota quotidien et dérogation administrative : OK' as resultat;
rollback;

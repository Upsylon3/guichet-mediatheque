-- Les séances et modèles conservent un libellé de salle facultatif.
begin;

drop trigger if exists verifier_salle_finale on guichet_prive.activites;
drop function if exists guichet_prive.verifier_salle_finale();
drop index if exists guichet_prive.activites_salle_jour;

do $migration$
declare
  definition text;
  salle_seance text := $rule$d->>'room' is null or d->>'room' not in ('Créazone','Salle JV') or $rule$;
  salle_modele text := $rule$or (x->>'room') is null or x->>'room' not in ('Créazone','Salle JV')$rule$;
  anciens_accompagnateurs text := $rule$if nullif(d->>'cap','') is not null and exists(select 1 from guichet_prive.activites g where g.parent=new.id and not g.supprime and g.type='guest' and coalesce((g.donnees->>'companions')::int,0)>0) then raise exception 'Des accompagnateurs sans carte sont encore inscrits : conserver une animation sans jauge';end if;$rule$;
begin
  definition := pg_get_functiondef('guichet_prive.valider_activite()'::regprocedure);
  if strpos(definition,salle_seance)=0 or strpos(definition,anciens_accompagnateurs)=0 then
    raise exception 'Définition de validation inattendue';
  end if;
  definition := replace(definition,salle_seance,'');
  definition := replace(definition,anciens_accompagnateurs,'');
  execute replace(definition,'Choisir Créazone ou Salle JV et renseigner les deux horaires','Renseigner les deux horaires');

  definition := pg_get_functiondef('guichet_prive.commande(text,jsonb,uuid)'::regprocedure);
  if strpos(definition,salle_modele)=0 then raise exception 'Validation des modèles inattendue'; end if;
  execute replace(definition,salle_modele,'');
end
$migration$;

-- Les nouvelles inscriptions exigent un âge. Les inscriptions existantes
-- sans âge restent déplaçables et restaurables si les bornes le permettent.
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
 if (select count(distinct participant->>'card') from jsonb_array_elements(d->'players') participant)<>jsonb_array_length(d->'players') then raise exception 'Une carte par participant : carte en double dans le groupe' using errcode='23505';end if;
 if jsonb_typeof(d->'players') is distinct from 'array' or jsonb_array_length(d->'players') not between 1 and 100 then raise exception 'Vérifier les participants' using errcode='22023'; end if;
 for p in select * from jsonb_array_elements(d->'players') loop
 if p->>'card' is null or p->>'card' !~ '^[0-9]{7}$' then raise exception 'Vérifier les sept chiffres de la carte' using errcode='22023'; end if;
 if exists(select 1 from guichet_prive.activites a where a.parent=ev.id and a.type='guest' and not a.supprime and a.carte=p->>'card' and not(a.id=any(anciens))) then raise exception 'Cette carte est déjà inscrite à cette animation' using errcode='23505';end if;
 if cardinality(anciens)=0 and
    (coalesce((p->>'companions')::int,0)<>0 or coalesce(jsonb_array_length(p->'companionNames'),0)<>0)
 then raise exception 'Inscrire uniquement des participants avec une carte' using errcode='22023'; end if;
 age:=nullif(p->>'age','')::numeric;
 if cardinality(anciens)=0 and age is null then
  raise exception 'Renseigner l’âge de chaque participant' using errcode='22023';
 end if;
 if p->>'ageUnit'='mois' then age:=age/12; end if;
 if age<0 or age>130 or ((ev.donnees->>'minAge' is not null or ev.donnees->>'maxAge' is not null) and age is null)
 or age<nullif(ev.donnees->>'minAge','')::numeric or age>nullif(ev.donnees->>'maxAge','')::numeric then raise exception 'Vérifier les conditions d’âge de la séance' using errcode='22023'; end if;
 n:=n+1;
 end loop;
 select count(*) into occ
 from guichet_prive.activites a where a.parent=ev.id and not a.supprime and a.type='guest' and not(a.id=any(anciens));
 if nullif(ev.donnees->>'cap','')::int is not null and occ+n>(ev.donnees->>'cap')::int then raise exception 'Plafond dépassé pour ce groupe' using errcode='23514'; end if;
 for p in select * from jsonb_array_elements(d->'players') loop
 i:=i+1;perform guichet_prive.fiche(p->>'card');cle:=case when cardinality(anciens)>0 then anciens[i] else md5(op::text||':'||i)::uuid end;
 if cardinality(anciens)>0 then
 update guichet_prive.activites set jour=ev.jour,parent=ev.id,supprime=false,revision=revision+1 where id=cle;
 else
 insert into guichet_prive.activites(id,type,jour,carte,parent,groupe,donnees) values(cle,'guest',ev.jour,p->>'card',ev.id,op,
 jsonb_build_object('companions',0,'age',p->>'age','ageUnit',coalesce(p->>'ageUnit','ans'),'category',p->>'category'));
 end if;ids:=ids||to_jsonb(cle);
 end loop;return ids;
end $function$;

-- Une identité de session anonyme reçoit uniquement le profil agent.
-- L’activation des connexions anonymes dans Auth est réservée au projet fictif.
create or replace function guichet_prive.profil() returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then null
    when (select auth.jwt()->>'is_anonymous') = 'true' then 'agent'
    else (
      select profil from guichet_prive.habilitations
      where compte = (select auth.uid())
    )
  end
$$;

-- Auth exige l’ouverture des inscriptions pour les sessions anonymes.
-- Le hook refuse la création publique d’une identité permanente.
create or replace function guichet_prive.autoriser_session_anonyme(event jsonb) returns jsonb
language sql stable set search_path = ''
as $$
  select case when event->'user'->>'is_anonymous' = 'true' then '{}'::jsonb
    else '{"error":{"http_code":403,"message":"Création de compte désactivée."}}'::jsonb
  end
$$;
revoke all on function guichet_prive.autoriser_session_anonyme(jsonb) from public, anon, authenticated;
grant usage on schema guichet_prive to supabase_auth_admin;
grant execute on function guichet_prive.autoriser_session_anonyme(jsonb) to supabase_auth_admin;

-- Le guichet ne propose plus d’administration des identités Auth.
revoke execute on function public.comptes_guichet(), public.attribuer_profil(uuid,text),
  guichet_prive.comptes(), guichet_prive.habiliter(uuid,text) from public, anon, authenticated;

commit;

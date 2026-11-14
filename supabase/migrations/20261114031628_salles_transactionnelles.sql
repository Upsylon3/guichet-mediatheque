-- Vérifier le planning final, y compris les déplacements de séries complètes.
do $migration$
declare definition text; controle text:=' if exists(select 1 from guichet_prive.activites a where a.type=''ani'' and not a.supprime and a.id<>new.id and a.jour=new.jour and a.donnees->>''room''=d->>''room'' and (a.donnees->>''time'')::time<(d->>''endTime'')::time and (d->>''time'')::time<(a.donnees->>''endTime'')::time) then raise exception ''La salle accueille déjà une animation sur cet horaire'' using errcode=''PT409'';end if;';
begin
 definition:=pg_get_functiondef('guichet_prive.valider_activite()'::regprocedure);
 if strpos(definition,controle)=0 then raise exception 'Contrôle de salle inattendu';end if;
 execute replace(definition,controle,'');
end $migration$;

create function guichet_prive.verifier_salle_finale() returns trigger
language plpgsql security definer set search_path='' as $$
declare ev guichet_prive.activites;
begin
 perform pg_advisory_xact_lock(14458001);
 select * into ev from guichet_prive.activites where id=new.id and type='ani' and not supprime;
 if not found then return null;end if;
 if exists(select 1 from guichet_prive.activites a where a.type='ani' and not a.supprime and a.id<>ev.id and a.jour=ev.jour and a.donnees->>'room'=ev.donnees->>'room'
 and (a.donnees->>'time')::time<(ev.donnees->>'endTime')::time and (ev.donnees->>'time')::time<(a.donnees->>'endTime')::time) then
 raise exception 'La salle accueille déjà une animation sur cet horaire' using errcode='PT409';end if;
 return null;
end $$;
create constraint trigger verifier_salle_finale after insert or update on guichet_prive.activites
deferrable initially deferred for each row when (new.type='ani') execute function guichet_prive.verifier_salle_finale();
revoke all on function guichet_prive.verifier_salle_finale() from public,anon,authenticated;

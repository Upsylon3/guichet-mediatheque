-- 40001 est réservé aux véritables erreurs de sérialisation, automatiquement
-- rejouées par PostgREST. Les conflits métier doivent répondre immédiatement.
do $migration$
declare cible regprocedure; definition text;
begin
 foreach cible in array array[
 'guichet_prive.commande(text,jsonb,uuid)'::regprocedure,
 'guichet_prive.verifier_version(uuid,integer)'::regprocedure,
 'guichet_prive.fusion(text,text,uuid,boolean)'::regprocedure] loop
 definition:=replace(pg_get_functiondef(cible),quote_literal('40001'),quote_literal('PT409'));
 execute definition;
 end loop;
end $migration$;

-- Migration : quotas historique.
-- Historique appliqué dans l’ordre des fichiers ; ne pas rejouer sur une base déjà migrée.

-- Un changement de carte historique ne recrée pas les quotas des semaines échues.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('guichet_prive.retenir_quota()'::regprocedure);
 if position('if not new.supprime then' in definition)=0 then raise exception 'Mise à jour du quota introuvable';end if;
 execute replace(definition,'if not new.supprime then','if not new.supprime and new.jour>=date_trunc(''week'',guichet_prive.jour()::timestamp)::date then');
end $migration$;

-- Migration : confidentialite cloture.
-- Historique appliqué dans l’ordre des fichiers ; ne pas rejouer sur une base déjà migrée.

-- La clôture purge également les références d'annulation des anciennes fusions.
-- Le planning Cron reste une reprise complémentaire, pas une condition de purge.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('guichet_prive.cloturer(date)'::regprocedure);
 definition:=replace(definition,'delete from guichet_prive.operations where jour<reference;',
 'delete from guichet_prive.operations where jour<reference; delete from guichet_prive.fusions where jour<reference;');
 execute definition;
end $migration$;

-- Compatible avec l'extension safeupdate activée sur l'API Supabase.
-- La définition provient exclusivement des migrations versionnées précédentes.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('guichet_prive.commande(text,jsonb,uuid)'::regprocedure);
 if strpos(definition,'update guichet_prive.reglages set contenu=v,revision=revision+1;')=0 then
 raise exception 'Définition de commande inattendue';end if;
 definition:=replace(definition,'update guichet_prive.reglages set contenu=v,revision=revision+1;',
 'update guichet_prive.reglages set contenu=v,revision=revision+1 where singleton;');
 execute definition;
end $migration$;

do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('guichet_prive.autoriser(text)'::regprocedure);
 if strpos(definition,'when action in (''batch'',''export'') then action')=0 then raise exception 'Définition des droits inattendue';end if;
 definition:=replace(definition,'when action in (''batch'',''export'') then action','when action=''batch'' then ''bulk'' when action=''export'' then ''export''');
 execute definition;
end $migration$;

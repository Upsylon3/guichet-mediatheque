do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('guichet_prive.inscrire(uuid,jsonb,uuid[])'::regprocedure);
 definition:=replace(definition,'''ageUnit'',coalesce(p->>''ageUnit'',''ans'')','''ageUnit'',coalesce(p->>''ageUnit'',''ans''),''category'',p->>''category''');
 execute definition;
 definition:=pg_get_functiondef('guichet_prive.commande(text,jsonb,uuid)'::regprocedure);
 definition:=replace(definition,'serie:=case when n>1 then op end;',
 'if coalesce((d->>''repeatEvery'')::int,1) not between 1 and 12 or coalesce(d->>''frequency'',''week'') not in (''week'',''month'') then raise exception ''Récurrence invalide'';end if; serie:=case when n>1 then op end;');
 definition:=replace(definition,'cible:=j+7*i;',
 'cible:=case when d->>''frequency''=''month'' then (j+make_interval(months=>i*coalesce((d->>''repeatEvery'')::int,1)))::date else j+7*i*coalesce((d->>''repeatEvery'')::int,1) end;');
 execute definition;
end $migration$;

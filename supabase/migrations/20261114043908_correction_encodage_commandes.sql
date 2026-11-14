-- Corrige les caractères de la définition précédente sans modifier les données.
do $$
declare f text; signature text;
begin
 foreach signature in array array['guichet_prive.autoriser(text)','guichet_prive.commande(text,jsonb,uuid)'] loop
  f:=pg_get_functiondef(signature::regprocedure);
  f:=replace(f,'Ã©','é');
  f:=replace(f,'Ã¨','è');
  f:=replace(f,'Ã ','à');
  f:=replace(f,'Ã®','î');
  f:=replace(f,'Ã‰','É');
  f:=replace(f,'â€“','–');
  f:=replace(f,'Ãª','ê');
  execute f;
 end loop;
end $$;

-- Le nom d'un poste est aussi sa référence dans les inscriptions.
-- Le changement de réglages et de réservations reste une seule transaction.
do $migration$
declare definition text; ajout text:=$rename$
 v:=d->'settings';
 if d ? 'renamePost' then
  if jsonb_typeof(d->'renamePost') is distinct from 'object'
  or nullif(trim(d->'renamePost'->>'source'),'') is null
  or nullif(trim(d->'renamePost'->>'target'),'') is null
  or length(d->'renamePost'->>'target')>50
  or d->'renamePost'->>'target' in ('__proto__','constructor','prototype')
  or d->'renamePost'->>'target'<>trim(d->'renamePost'->>'target')
  or d->'renamePost'->>'source'=d->'renamePost'->>'target'
  then raise exception 'Renommage de poste invalide' using errcode='22023';end if;
  if not(cfg->'stations' ? (d->'renamePost'->>'source'))
  or exists(select 1 from jsonb_object_keys(cfg->'stations') nom where nom<>d->'renamePost'->>'source' and lower(nom)=lower(d->'renamePost'->>'target'))
  or v->'stations' ? (d->'renamePost'->>'source')
  or not(v->'stations' ? (d->'renamePost'->>'target'))
  then raise exception 'Le poste source a changé ou le nouveau nom est déjà utilisé' using errcode='PT409';end if;
  update guichet_prive.activites
  set donnees=jsonb_set(donnees,'{post}',to_jsonb(d->'renamePost'->>'target')),revision=revision+1
  where type='vid' and donnees->>'post'=d->'renamePost'->>'source';
 end if;
$rename$;
begin
 definition:=pg_get_functiondef('guichet_prive.commande(text,jsonb,uuid)'::regprocedure);
 if strpos(definition,' v:=d->''settings'';')=0 then raise exception 'Définition des réglages inattendue';end if;
 execute replace(definition,' v:=d->''settings'';',ajout);
end $migration$;

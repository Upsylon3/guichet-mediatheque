-- Migration : reglages et series avec historique.
-- Historique appliqué dans l’ordre des fichiers ; ne pas rejouer sur une base déjà migrée.

-- Les réglages futurs ne doivent ni annuler ni bloquer les activités déjà passées.
do $migration$
declare definition text; avant text;
begin
 definition:=pg_get_functiondef('guichet_prive.commande(text,jsonb,uuid)'::regprocedure);
 avant:='for a in select * from guichet_prive.activites where type=''vid'' and not supprime loop';
 if position(avant in definition)=0 then raise exception 'Validation des postes introuvable';end if;
 definition:=replace(definition,avant,'for a in select * from guichet_prive.activites where type=''vid'' and not supprime and jour>=guichet_prive.jour() loop');
 avant:='groupe=a.groupe and not coalesce((donnees->>''exception'')::boolean,false)';
 if position(avant in definition)=0 then raise exception 'Séances de série introuvables';end if;
 definition:=replace(definition,avant,avant||' and jour>=guichet_prive.jour()');
 execute definition;
end $migration$;

-- Politiques fermées explicites : les accès passent par les façades contrôlées.
do $migration$
declare nom text;
begin
 foreach nom in array array['habilitations','reglages','activites','operations','totaux','fusions'] loop
 execute format('create policy aucun_acces_client on guichet_prive.%I for all to anon,authenticated using(false) with check(false)',nom);
 end loop;
end $migration$;

-- Horaires par jour de semaine, puis exceptions par date en priorité.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('guichet_prive.video(uuid,jsonb,uuid[])'::regprocedure);
 definition:=replace(definition,'station:=cfg->''stations''->(d->>''post'');',
 'station:=cfg->''stations''->(d->>''post''); station:=station||coalesce(station->''weekdays''->(extract(dow from j)::int)::text,''{}''::jsonb);');
 execute definition;
 definition:=pg_get_functiondef('guichet_prive.commande(text,jsonb,uuid)'::regprocedure);
 definition:=replace(definition,'x:=v->''stations''->(a.donnees->>''post'');',
 'x:=v->''stations''->(a.donnees->>''post''); x:=x||coalesce(x->''weekdays''->(extract(dow from a.jour)::int)::text,''{}''::jsonb);');
 definition:=replace(definition,'coalesce(d->>''scope'',''one'')=''one'' and b.groupe is not null',
 'case when d ? ''restoreException'' then (d->>''restoreException'')::boolean else coalesce(d->>''scope'',''one'')=''one'' and b.groupe is not null end');
 definition:=replace(definition,'elsif action=''batch'' then',
 $branch$elsif action='event.undo' then
 if jsonb_array_length(d->'events') not between 1 and 52 then raise exception 'Annulation de série invalide';end if;
 i:=0;for x in select * from jsonb_array_elements(d->'events') loop
 i:=i+1;v:=guichet_prive.commande('event.save',x,md5(op::text||':'||i)::uuid);
 ids:=ids||array(select jsonb_array_elements_text(v->'ids')::uuid);
 end loop;
 select greatest(guichet_prive.jour(),max(jour)) into conservation from guichet_prive.activites where id=any(ids);
 resultat:=jsonb_build_object('ids',to_jsonb(ids));
 elsif action='batch' then$branch$);
 execute definition;
 definition:=pg_get_functiondef('guichet_prive.valider_poste(jsonb)'::regprocedure);
 definition:=replace(definition,'if p->''exceptions'' is not null then',
 $branch$if p->'weekdays' is not null then
 for d,ex in select * from jsonb_each(p->'weekdays') loop
 if d !~ '^[0-6]$' then raise exception 'Jour de semaine invalide';end if;
 perform guichet_prive.valider_poste((p-'weekdays'-'exceptions')||ex);
 end loop;end if;
 if p->'exceptions' is not null then$branch$);
 definition:=replace(definition,'(p-''exceptions'')||ex','(p-''exceptions''-''weekdays'')||ex');
 execute definition;
end $migration$;

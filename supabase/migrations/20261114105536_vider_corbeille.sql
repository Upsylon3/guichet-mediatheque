-- Vider la corbeille : accès administrateur, instantané confirmé et suppression atomique.
-- Réutiliser le verrou et le journal d’opérations de la commande existante.
do $migration$
declare
  definition text;
  branche text := $branche$if action='trash.empty' then
    if jsonb_typeof(d->'rows') is distinct from 'array' then
      raise exception 'Instantané de la corbeille requis' using errcode='22023';
    end if;
    -- Comparer les identifiants ET les révisions, sans dépendre de l’ordre affiché.
    select coalesce(jsonb_agg(jsonb_build_object('id',discarded.id,'revision',discarded.revision) order by discarded.id),'[]'::jsonb)
      into v from guichet_prive.activites discarded where discarded.supprime;
    select coalesce(jsonb_agg(jsonb_build_object('id',(entry.value->>'id')::uuid,'revision',(entry.value->>'revision')::int) order by (entry.value->>'id')::uuid),'[]'::jsonb)
      into x from jsonb_array_elements(d->'rows') as entry(value);
    if v is distinct from x then
      raise exception 'La corbeille a changé. Actualisez-la puis confirmez à nouveau.' using errcode='PT409';
    end if;
    -- La clé étrangère parent supprime aussi les participants/comptages des séances jetées.
    -- Les fiches usagers et les activités qui ne sont pas dans la corbeille restent intactes.
    delete from guichet_prive.activites where supprime;
    get diagnostics n = row_count;
    resultat := jsonb_build_object('deleted',n);
  elsif action in ('template.save','template.remove') then$branche$;
begin
  definition := pg_get_functiondef('guichet_prive.autoriser(text)'::regprocedure);
  if position($repere$if action in ('config.save',$repere$ in definition) = 0 then
    raise exception 'Contrôle administrateur introuvable';
  end if;
  execute replace(definition, $repere$if action in ('config.save',$repere$, $repere$if action in ('trash.empty','config.save',$repere$);

  definition := pg_get_functiondef('guichet_prive.commande(text,jsonb,uuid)'::regprocedure);
  if position($repere$if action in ('template.save','template.remove') then$repere$ in definition) = 0 then
    raise exception 'Point d’entrée des commandes introuvable';
  end if;
  execute replace(definition, $repere$if action in ('template.save','template.remove') then$repere$, branche);
end $migration$;

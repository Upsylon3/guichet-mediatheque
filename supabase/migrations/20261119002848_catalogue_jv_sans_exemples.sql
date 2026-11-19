begin;

-- Un poste peut avoir des horaires configurés avant la saisie de son catalogue.
do $migration$
declare
  definition text;
  liste_obligatoire text := $r$or jsonb_array_length(p->'games')=0 $r$;
  liste_commande text := $r$jsonb_array_length(x->'games')<1$r$;
begin
  definition := pg_get_functiondef('guichet_prive.valider_poste(jsonb)'::regprocedure);
  if strpos(definition, liste_obligatoire)=0 then raise exception 'Validation de poste inattendue'; end if;
  execute replace(replace(definition, liste_obligatoire, ''), 'Configurer jeux, horaires et capacité', 'Configurer horaires et capacité');
  definition := pg_get_functiondef('guichet_prive.commande(text,jsonb,uuid)'::regprocedure);
  if strpos(definition, liste_commande)=0 then raise exception 'Validation des réglages inattendue'; end if;
  execute replace(definition, liste_commande, $r$jsonb_typeof(x->'games') is distinct from 'array'$r$);
end
$migration$;

-- Retirer les libellés livrés en exemple sur un guichet sans réservation JV.
with exemples(poste, jeux) as (
  values ('ELLIE','["Aventure"]'::jsonb), ('MARIO','["Circuit","Rallye"]'::jsonb),
    ('PEACH','["Course"]'::jsonb), ('SPYRO','["Voyage"]'::jsonb),
    ('ZELDA','["Exploration"]'::jsonb), ('SACKBOY','["Sports"]'::jsonb)
), catalogue as (
  select jsonb_object_agg(p.key, case when p.value->'games'=e.jeux
    then jsonb_set(p.value,'{games}','[]') else p.value end) as postes
  from guichet_prive.reglages r
  cross join lateral jsonb_each(r.contenu->'stations') p
  left join exemples e on e.poste=p.key
)
update guichet_prive.reglages r
set contenu=jsonb_set(r.contenu,'{stations}',c.postes), revision=revision+1
from catalogue c
where c.postes is distinct from r.contenu->'stations'
  and not exists (select 1 from guichet_prive.activites where type='vid');

commit;

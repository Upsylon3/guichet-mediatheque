CREATE OR REPLACE FUNCTION guichet_prive.inscrire(op uuid, d jsonb, anciens uuid[] DEFAULT '{}'::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ev guichet_prive.activites; p jsonb; n integer:=0; occ integer; i integer:=0; cle uuid; ids jsonb:='[]'; age numeric;
begin
 select * into ev from guichet_prive.activites where id=(d->>'eventId')::uuid and type='ani' and not supprime;
 if not found then raise exception 'Séance absente ou supprimée' using errcode='P0002'; end if;
 perform guichet_prive.date_ouverte(ev.jour);
 if ev.donnees->>'mode'='libre' then raise exception 'Cette séance est en entrée libre : utiliser le comptage' using errcode='22023'; end if;
 perform guichet_prive.verifier_horizon(ev.jour,(d->>'confirmEarly')::boolean);
 if (select count(distinct participant->>'card') from jsonb_array_elements(d->'players') participant)<>jsonb_array_length(d->'players') then raise exception 'Une carte par participant : carte en double dans le groupe' using errcode='23505';end if;
 if jsonb_typeof(d->'players') is distinct from 'array' or jsonb_array_length(d->'players') not between 1 and 100 then raise exception 'Vérifier les participants' using errcode='22023'; end if;
 for p in select * from jsonb_array_elements(d->'players') loop
 if p->>'card' is null or p->>'card' !~ '^[0-9]{7}$' or (p->>'companions')::int is null or (p->>'companions')::int not between 0 and 100 then raise exception 'Vérifier carte et accompagnateurs' using errcode='22023'; end if;
 if exists(select 1 from guichet_prive.activites a where a.parent=ev.id and a.type='guest' and not a.supprime and a.carte=p->>'card' and not(a.id=any(anciens))) then raise exception 'Cette carte est déjà inscrite à cette animation' using errcode='23505';end if;
 if nullif(ev.donnees->>'cap','') is not null and ((p->>'companions')::int<>0 or coalesce(jsonb_array_length(p->'companionNames'),0)<>0) then raise exception 'Animation avec jauge : chaque personne doit avoir sa carte';end if;
 if (p->>'companions')::int<>coalesce(jsonb_array_length(p->'companionNames'),0) or exists(select 1 from jsonb_array_elements_text(p->'companionNames') s where trim(s)='' or length(s)>150) then raise exception 'Renseigner le nom de chaque accompagnateur sans carte';end if;
 age:=nullif(p->>'age','')::numeric;
 if p->>'ageUnit'='mois' then age:=age/12; end if;
 if age<0 or age>130 or ((ev.donnees->>'minAge' is not null or ev.donnees->>'maxAge' is not null) and age is null)
 or age<nullif(ev.donnees->>'minAge','')::numeric or age>nullif(ev.donnees->>'maxAge','')::numeric then raise exception 'Vérifier les conditions d’âge de la séance' using errcode='22023'; end if;
 n:=n+1+case when coalesce((ev.donnees->>'count')::boolean,true) then (p->>'companions')::int else 0 end;
 end loop;
 select coalesce(sum(1+case when coalesce((ev.donnees->>'count')::boolean,true) then (a.donnees->>'companions')::int else 0 end),0) into occ
 from guichet_prive.activites a where a.parent=ev.id and not a.supprime and a.type='guest' and not(a.id=any(anciens));
 if nullif(ev.donnees->>'cap','')::int is not null and occ+n>(ev.donnees->>'cap')::int then raise exception 'Plafond dépassé pour ce groupe' using errcode='23514'; end if;
 for p in select * from jsonb_array_elements(d->'players') loop
 i:=i+1;perform guichet_prive.fiche(p->>'card');cle:=case when cardinality(anciens)>0 then anciens[i] else md5(op::text||':'||i)::uuid end;
 if cardinality(anciens)>0 then
 update guichet_prive.activites set jour=ev.jour,parent=ev.id,supprime=false,revision=revision+1 where id=cle;
 else
 insert into guichet_prive.activites(id,type,jour,carte,parent,groupe,donnees) values(cle,'guest',ev.jour,p->>'card',ev.id,op,
 jsonb_build_object('companions',(p->>'companions')::int,'age',p->>'age','ageUnit',coalesce(p->>'ageUnit','ans'),'category',p->>'category','companionNames',coalesce(p->'companionNames','[]')));
 end if;ids:=ids||to_jsonb(cle);
 end loop;return ids;
end $function$;

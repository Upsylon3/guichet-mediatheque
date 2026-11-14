-- Le refus du quota rappelle la réservation encore disponible, sans prolonger sa conservation.
do $migration$
declare definition text; precedent text; remplacement text;
begin
 definition:=pg_get_functiondef('guichet_prive.video(uuid,jsonb,uuid[])'::regprocedure);
 precedent:=$avant$then raise exception 'Une seule inscription aux jeux vidéo par semaine, du lundi au dimanche.' using errcode='PT409';end if;$avant$;
 remplacement:=$apres$then
  declare reservation guichet_prive.activites; jour_semaine text;
  begin
   select a.* into reservation
   from guichet_prive.quotas_jv q
   join public.usagers u on u.id=q.usager
   join guichet_prive.activites a on a.id=q.reservation
   where u.carte=card and q.semaine=date_trunc('week',j::timestamp)::date
   and not(q.reservation=any(anciens)) and a.type='vid' and not a.supprime;
   if found then
    jour_semaine:=(array['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'])[extract(dow from reservation.jour)::int+1];
    raise exception 'Carte % : déjà inscrit(e) le % % de % à % sur le poste %. Une seule inscription JV par semaine, du lundi au dimanche.',
     card,jour_semaine,to_char(reservation.jour,'DD/MM/YYYY'),reservation.donnees->>'slot',reservation.donnees->>'end',reservation.donnees->>'post'
     using errcode='PT409';
   end if;
   raise exception 'Carte % : une inscription JV a déjà été utilisée cette semaine, du lundi au dimanche. Le détail de cette inscription passée n’est plus disponible après la clôture quotidienne.',card using errcode='PT409';
  end;
 end if;$apres$;
 if position(precedent in definition)=0 then raise exception 'Contrôle du quota JV introuvable';end if;
 execute replace(definition,precedent,remplacement);
end $migration$;

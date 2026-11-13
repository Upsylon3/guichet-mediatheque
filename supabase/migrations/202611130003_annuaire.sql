-- Profil de la session : aucune habilitation modifiable depuis l'API.
create function public.mon_profil() returns text
language sql stable security invoker set search_path = ''
as $$ select guichet_prive.profil() $$;
revoke all on function public.mon_profil() from public, anon;
grant execute on function public.mon_profil() to authenticated;

-- Une erreur explicite pour la commande de suppression de l'interface.
-- Les DELETE directs restent également protégés par la politique RLS.
create function public.supprimer_usager(numero text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if guichet_prive.profil() is distinct from 'administrateur' then
    raise exception 'Suppression réservée aux administrateurs' using errcode = '42501';
  end if;
  delete from public.usagers where carte = numero;
  if not found then
    raise exception 'Fiche absente ou déjà supprimée' using errcode = 'P0002';
  end if;
end $$;
revoke all on function public.supprimer_usager(text) from public, anon;
grant execute on function public.supprimer_usager(text) to authenticated;

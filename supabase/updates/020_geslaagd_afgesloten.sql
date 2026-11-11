-- 020: geslaagde kandidaten kunnen niets meer wijzigen aan hun casus, foto's, theorie/trainingen of CBR-bevestiging.
-- Lezen blijft mogelijk (de kandidaat kan zijn casus nog als PDF downloaden). Medewerkers en leermeesters kunnen alles blijven doen.
-- Werkt ook voor functies die met security definer schrijven (zoals bewaar_casus), omdat het een trigger is.
-- Veilig om opnieuw uit te voeren.
create schema if not exists private;

create or replace function private.geslaagd_blokkeren() returns trigger
language plpgsql security definer set search_path = '' as $$
declare kid uuid;
begin
  if tg_op = 'DELETE' then kid := old.kandidaat_id; else kid := new.kandidaat_id; end if;
  if exists (select 1 from public.leden l
              where l.id = kid and l.user_id = auth.uid() and l.rol = 'kandidaat' and l.status = 'geslaagd') then
    raise exception 'Je bent geslaagd: je casus en leeromgeving zijn afgesloten.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
revoke all on function private.geslaagd_blokkeren() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['casussen', 'fotos', 'theorie', 'cbr_bevestiging'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists geslaagd_blokkeren on public.%I', t);
      execute format('create trigger geslaagd_blokkeren before insert or update or delete on public.%I
                      for each row execute function private.geslaagd_blokkeren()', t);
    end if;
  end loop;
end $$;

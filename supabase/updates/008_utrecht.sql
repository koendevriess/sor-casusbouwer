-- ---------- aanvulling: vaargebied Utrecht ----------
alter table public.leden drop constraint if exists leden_stad_check;
alter table public.leden add constraint leden_stad_check check (stad in ('amsterdam','groningen','utrecht'));

create or replace function public.lid_toevoegen(p_naam text, p_rol text, p_stad text) returns public.leden
language plpgsql security definer set search_path = '' as $$
declare r public.leden;
begin
  if not private.is_medewerker() then
    raise exception 'Alleen medewerkers kunnen mensen toevoegen.' using errcode = '42501';
  end if;
  if p_rol not in ('kandidaat', 'medewerker', 'leermeester') then
    raise exception 'Onbekende rol.' using errcode = '22023';
  end if;
  if coalesce(p_stad, 'amsterdam') not in ('amsterdam', 'groningen', 'utrecht') then
    raise exception 'Onbekend vaargebied.' using errcode = '22023';
  end if;
  insert into public.leden (naam, rol, code, stad)
  values (trim(p_naam), p_rol, private.code_maken(), case when p_rol = 'kandidaat' then coalesce(p_stad, 'amsterdam') else 'amsterdam' end)
  returning * into r;
  return r;
end $$;
revoke all on function public.lid_toevoegen(text, text, text) from public, anon;
grant execute on function public.lid_toevoegen(text, text, text) to authenticated;

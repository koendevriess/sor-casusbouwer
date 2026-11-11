-- 013: kandidaten in één keer aan een groep koppelen
create or replace function public.groep_koppelen(p_groep uuid, p_kandidaten jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not private.is_medewerker() then
    raise exception 'Alleen medewerkers kunnen groepen indelen.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.groepen where id = p_groep) then
    raise exception 'Deze groep bestaat niet.' using errcode = '22023';
  end if;
  update public.leden set groep_id = null
   where groep_id = p_groep and id::text not in (select jsonb_array_elements_text(coalesce(p_kandidaten, '[]'::jsonb)));
  update public.leden set groep_id = p_groep
   where rol = 'kandidaat' and id::text in (select jsonb_array_elements_text(coalesce(p_kandidaten, '[]'::jsonb)));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.groep_koppelen(uuid, jsonb) from public, anon;
grant execute on function public.groep_koppelen(uuid, jsonb) to authenticated;

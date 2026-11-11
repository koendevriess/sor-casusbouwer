-- 021: examengroepen in één keer koppelen aan een leermeester
-- Een leermeester die aan een groep is gekoppeld, ziet alle kandidaten in die groep,
-- ook kandidaten die later aan de groep worden toegevoegd.
-- Veilig om meer dan één keer uit te voeren.

create table if not exists public.leermeester_groep (
  leermeester_id uuid not null references public.leden(id) on delete cascade,
  groep_id       uuid not null references public.groepen(id) on delete cascade,
  aangemaakt     timestamptz not null default now(),
  primary key (leermeester_id, groep_id)
);
create index if not exists leermeester_groep_groep_idx on public.leermeester_groep (groep_id);

alter table public.leermeester_groep enable row level security;
drop policy if exists lgr_lezen on public.leermeester_groep;
create policy lgr_lezen on public.leermeester_groep for select to authenticated
  using (private.is_medewerker() or leermeester_id = private.mijn_lid_id());
revoke all on public.leermeester_groep from anon;
revoke insert, update, delete on public.leermeester_groep from authenticated;
grant select on public.leermeester_groep to authenticated;

-- Medewerker zet in één keer welke leermeesters bij een groep horen
create or replace function public.groep_leermeesters_zetten(p_groep uuid, p_lms jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not private.is_medewerker() then
    raise exception 'Alleen medewerkers kunnen leermeesters aan een groep koppelen.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.groepen where id = p_groep) then
    raise exception 'Deze groep bestaat niet.' using errcode = '22023';
  end if;
  delete from public.leermeester_groep where groep_id = p_groep;
  insert into public.leermeester_groep (leermeester_id, groep_id)
  select l.id, p_groep from public.leden l
   where l.rol = 'leermeester'
     and l.id::text in (select jsonb_array_elements_text(coalesce(p_lms, '[]'::jsonb)));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.groep_leermeesters_zetten(uuid, jsonb) from public, anon;
grant execute on function public.groep_leermeesters_zetten(uuid, jsonb) to authenticated;

-- Toegangsregel uitbreiden: losse koppeling, heel vaargebied, of via een groep
create or replace function private.mag_kandidaat(p_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.leden where user_id = auth.uid() and rol = 'medewerker')
      or exists (select 1 from public.leermeester_toegang t join public.leden l on l.id = t.leermeester_id
                  where l.user_id = auth.uid() and l.rol = 'leermeester' and t.kandidaat_id = p_id)
      or exists (select 1 from public.leermeester_gebied g
                   join public.leden l on l.id = g.leermeester_id
                   join public.leden k on k.id = p_id
                  where l.user_id = auth.uid() and l.rol = 'leermeester' and k.rol = 'kandidaat'
                    and coalesce(k.stad, 'amsterdam') = g.stad)
      or exists (select 1 from public.leermeester_groep lg
                   join public.leden l on l.id = lg.leermeester_id
                   join public.leden k on k.id = p_id
                  where l.user_id = auth.uid() and l.rol = 'leermeester' and k.rol = 'kandidaat'
                    and k.groep_id = lg.groep_id)
$$;

-- Live bijwerken in het medewerkersoverzicht
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                      and schemaname = 'public' and tablename = 'leermeester_groep') then
    execute 'alter publication supabase_realtime add table public.leermeester_groep';
  end if;
end $$;

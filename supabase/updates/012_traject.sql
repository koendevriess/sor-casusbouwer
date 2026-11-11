-- 012: traject per kandidaat: groepen (lichtingen) met examen- en generaledatum,
-- eigen datums per kandidaat, en de stappen van de vrijstelling vaardagen.
create table if not exists public.groepen (
  id          uuid primary key default gen_random_uuid(),
  naam        text not null check (char_length(naam) between 1 and 80),
  stad        text not null default 'amsterdam' check (stad in ('amsterdam','groningen','utrecht')),
  examen_op   date,
  generale_op date,
  aangemaakt  timestamptz not null default now()
);
alter table public.groepen enable row level security;
drop policy if exists groep_lezen on public.groepen;
drop policy if exists groep_nieuw on public.groepen;
drop policy if exists groep_wijzigen on public.groepen;
drop policy if exists groep_weg on public.groepen;
create policy groep_lezen    on public.groepen for select to authenticated using (true);
create policy groep_nieuw    on public.groepen for insert to authenticated with check (private.is_medewerker());
create policy groep_wijzigen on public.groepen for update to authenticated using (private.is_medewerker()) with check (private.is_medewerker());
create policy groep_weg      on public.groepen for delete to authenticated using (private.is_medewerker());
revoke all on public.groepen from anon, authenticated;
grant select, insert, update, delete on public.groepen to authenticated;

alter table public.leden
  add column if not exists groep_id uuid references public.groepen(id) on delete set null,
  add column if not exists examen_op date,
  add column if not exists generale_op date,
  add column if not exists vrij_nodig boolean not null default true,
  add column if not exists vrij_verstuurd_op date,
  add column if not exists vrij_geupload_op date,
  add column if not exists vrij_geregistreerd_op date;
create index if not exists leden_groep_idx on public.leden(groep_id);

-- de kandidaat meldt zelf dat de vrijstelling is geüpload of geregistreerd staat bij het CBR
create or replace function public.traject_melden(p_stap text, p_aan boolean) returns public.leden
language plpgsql security definer set search_path = '' as $$
declare r public.leden;
begin
  if p_stap not in ('geupload', 'geregistreerd') then
    raise exception 'Onbekende stap.' using errcode = '22023';
  end if;
  update public.leden
     set vrij_geupload_op      = case when p_stap = 'geupload'      then (case when p_aan then coalesce(vrij_geupload_op, current_date) end) else vrij_geupload_op end,
         vrij_geregistreerd_op = case when p_stap = 'geregistreerd' then (case when p_aan then coalesce(vrij_geregistreerd_op, current_date) end) else vrij_geregistreerd_op end
   where user_id = auth.uid() and rol = 'kandidaat'
  returning * into r;
  if r.id is null then
    raise exception 'Alleen kandidaten kunnen dit melden.' using errcode = '42501';
  end if;
  return r;
end $$;
revoke all on function public.traject_melden(text, boolean) from public, anon;
grant execute on function public.traject_melden(text, boolean) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.groepen; exception when duplicate_object then null; end;
  end if;
end $$;

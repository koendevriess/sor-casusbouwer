-- 010: leermeester koppelen aan een heel vaargebied (ziet dan alle kandidaten van die stad, ook nieuwe)
create table if not exists public.leermeester_gebied (
  leermeester_id uuid not null references public.leden(id) on delete cascade,
  stad           text not null check (stad in ('amsterdam','groningen','utrecht')),
  aangemaakt     timestamptz not null default now(),
  primary key (leermeester_id, stad)
);
alter table public.leermeester_gebied enable row level security;
drop policy if exists lg_lezen on public.leermeester_gebied;
create policy lg_lezen on public.leermeester_gebied for select to authenticated
  using (private.is_medewerker() or leermeester_id = private.mijn_lid_id());
revoke all on public.leermeester_gebied from anon, authenticated;
grant select on public.leermeester_gebied to authenticated;

-- mag de ingelogde gebruiker deze kandidaat zien? medewerker: altijd; leermeester: gekoppeld of in zijn gebied
create or replace function private.mag_kandidaat(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.leden where user_id = auth.uid() and rol = 'medewerker')
      or exists (select 1 from public.leermeester_toegang t join public.leden l on l.id = t.leermeester_id
                  where l.user_id = auth.uid() and l.rol = 'leermeester' and t.kandidaat_id = p_id)
      or exists (select 1 from public.leermeester_gebied g
                   join public.leden l on l.id = g.leermeester_id
                   join public.leden k on k.id = p_id
                  where l.user_id = auth.uid() and l.rol = 'leermeester' and k.rol = 'kandidaat'
                    and coalesce(k.stad, 'amsterdam') = g.stad)
$$;

-- één gebied aan of uit zetten voor een leermeester
create or replace function public.leermeester_gebied_zetten(p_lm uuid, p_stad text, p_aan boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_medewerker() then
    raise exception 'Alleen medewerkers kunnen leermeesters koppelen.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.leden where id = p_lm and rol = 'leermeester') then
    raise exception 'Dit is geen leermeester.' using errcode = '22023';
  end if;
  if p_stad not in ('amsterdam','groningen','utrecht') then
    raise exception 'Onbekend vaargebied.' using errcode = '22023';
  end if;
  if p_aan then
    insert into public.leermeester_gebied (leermeester_id, stad) values (p_lm, p_stad) on conflict do nothing;
  else
    delete from public.leermeester_gebied where leermeester_id = p_lm and stad = p_stad;
  end if;
  return p_aan;
end $$;
revoke all on function public.leermeester_gebied_zetten(uuid, text, boolean) from public, anon;
grant execute on function public.leermeester_gebied_zetten(uuid, text, boolean) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.leermeester_gebied; exception when duplicate_object then null; end;
  end if;
end $$;

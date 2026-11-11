-- ---------- aanvulling: leeromgeving (theorie) ----------
-- Voortgang van de kandidaat in de theorie, en of een medewerker de casus handmatig heeft vrijgegeven.
alter table public.leden add column if not exists casus_vrij boolean not null default false;
-- kandidaten die al aan een casus werkten houden toegang
update public.leden l set casus_vrij = true
 where l.rol = 'kandidaat' and not l.casus_vrij
   and exists (select 1 from public.casussen c where c.kandidaat_id = l.id and c.voortgang > 0);

create table if not exists public.theorie (
  kandidaat_id uuid primary key references public.leden(id) on delete cascade,
  data         jsonb not null default '{}'::jsonb check (octet_length(data::text) < 200000),
  xp           int not null default 0,
  hoofdstukken int not null default 0,
  geslaagd_op  timestamptz,
  bijgewerkt   timestamptz not null default now()
);
alter table public.theorie enable row level security;

drop policy if exists theorie_lezen    on public.theorie;
drop policy if exists theorie_nieuw    on public.theorie;
drop policy if exists theorie_wijzigen on public.theorie;
create policy theorie_lezen    on public.theorie for select to authenticated
  using (kandidaat_id = private.mijn_lid_id() or private.is_medewerker());
create policy theorie_nieuw    on public.theorie for insert to authenticated
  with check (kandidaat_id = private.mijn_lid_id());
create policy theorie_wijzigen on public.theorie for update to authenticated
  using (kandidaat_id = private.mijn_lid_id()) with check (kandidaat_id = private.mijn_lid_id());

revoke all on public.theorie from anon, authenticated;
grant select, insert, update on public.theorie to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.theorie; exception when duplicate_object then null; end;
  end if;
end $$;

-- 022: instellingen (privacyverklaring, AI, opslag), opslag opruimen, snellere toegangsregels
-- Veilig om meer dan één keer uit te voeren. Bestaande gegevens blijven staan.

-- ---------- 1. instellingen die medewerkers in de site beheren ----------
create table if not exists public.instellingen (
  sleutel         text primary key check (sleutel in ('privacy', 'ai', 'opslag')),
  waarde          jsonb not null default '{}'::jsonb check (octet_length(waarde::text) < 20000),
  bijgewerkt      timestamptz not null default now(),
  bijgewerkt_door uuid references auth.users(id) on delete set null
);
create index if not exists instellingen_door_idx on public.instellingen (bijgewerkt_door);
alter table public.instellingen enable row level security;

drop policy if exists inst_lezen on public.instellingen;
drop policy if exists inst_lezen_anon on public.instellingen;
drop policy if exists inst_nieuw on public.instellingen;
drop policy if exists inst_wijzigen on public.instellingen;
-- ingelogd: alles lezen (er staan geen geheimen in); niet ingelogd: alleen de privacyverklaring
create policy inst_lezen      on public.instellingen for select to authenticated using (true);
create policy inst_lezen_anon on public.instellingen for select to anon using (sleutel = 'privacy');
create policy inst_nieuw      on public.instellingen for insert to authenticated
  with check ((select private.is_medewerker()));
create policy inst_wijzigen   on public.instellingen for update to authenticated
  using ((select private.is_medewerker())) with check ((select private.is_medewerker()));
revoke all on public.instellingen from anon, authenticated;
grant select on public.instellingen to anon, authenticated;
grant insert, update on public.instellingen to authenticated;

insert into public.instellingen (sleutel, waarde) values
  ('privacy', '{"gepubliceerd": false}'::jsonb),
  ('ai',      '{"aan": false, "maandlimiet": 100}'::jsonb),
  ('opslag',  '{"maanden": 6}'::jsonb)
on conflict (sleutel) do nothing;

-- ---------- 2. AI: teller per maand (alleen de Edge Function schrijft; medewerkers lezen) ----------
create table if not exists public.ai_gebruik (
  maand  date primary key,
  aantal integer not null default 0 check (aantal >= 0)
);
alter table public.ai_gebruik enable row level security;
drop policy if exists aig_lezen on public.ai_gebruik;
create policy aig_lezen on public.ai_gebruik for select to authenticated using ((select private.is_medewerker()));
revoke all on public.ai_gebruik from anon, authenticated;
grant select on public.ai_gebruik to authenticated;

-- Telt één analyse voor deze maand, alleen als AI aan staat en de maandlimiet nog niet bereikt is.
-- Geeft true als de analyse mag doorgaan. Alleen aan te roepen door de Edge Function (service role).
create or replace function public.ai_gebruik_tellen()
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  inst jsonb;
  lim  int;
  m    date := date_trunc('month', now())::date;
  n    int;
begin
  select waarde into inst from public.instellingen where sleutel = 'ai';
  if coalesce((inst->>'aan')::boolean, false) is not true then return false; end if;
  lim := greatest(0, least(100000, coalesce((inst->>'maandlimiet')::int, 100)));
  insert into public.ai_gebruik (maand, aantal) values (m, 0) on conflict (maand) do nothing;
  update public.ai_gebruik set aantal = aantal + 1 where maand = m and aantal < lim returning aantal into n;
  return n is not null;
end $$;
revoke all on function public.ai_gebruik_tellen() from public, anon, authenticated;
grant execute on function public.ai_gebruik_tellen() to service_role;

create index if not exists ai_voorbeeld_door_idx on public.ai_voorbeeld (door);

-- ---------- 3. opslag: overzicht en opruimen van geslaagde kandidaten ----------
-- Overzicht voor medewerkers: hoeveel ruimte is in gebruik en wat kan er weg.
create or replace function public.opslag_overzicht(p_maanden integer default 6)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  grens timestamptz := now() - make_interval(months => greatest(1, least(120, coalesce(p_maanden, 6))));
  r jsonb;
begin
  if not private.is_medewerker() then
    raise exception 'Alleen medewerkers kunnen het opslagoverzicht zien.' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'database', pg_database_size(current_database()),
    'fotos', (select coalesce(sum(octet_length(src)), 0) from public.fotos),
    'fotos_aantal', (select count(*) from public.fotos),
    'cbr', (select coalesce(sum(octet_length(data)), 0) from public.cbr_bevestiging),
    'cbr_aantal', (select count(*) from public.cbr_bevestiging),
    'kandidaten', (select count(*) from public.leden where rol = 'kandidaat'),
    'geslaagd', (select count(*) from public.leden where rol = 'kandidaat' and status = 'geslaagd'),
    'weg_kandidaten', (select count(*) from public.leden l where l.rol = 'kandidaat' and l.status = 'geslaagd' and l.geslaagd_op < grens
                         and (exists (select 1 from public.fotos f where f.kandidaat_id = l.id)
                           or exists (select 1 from public.cbr_bevestiging c where c.kandidaat_id = l.id))),
    'weg_fotos', (select count(*) from public.fotos f join public.leden l on l.id = f.kandidaat_id
                   where l.rol = 'kandidaat' and l.status = 'geslaagd' and l.geslaagd_op < grens),
    'weg_cbr', (select count(*) from public.cbr_bevestiging c join public.leden l on l.id = c.kandidaat_id
                 where l.rol = 'kandidaat' and l.status = 'geslaagd' and l.geslaagd_op < grens),
    'weg_bytes', (select coalesce(sum(octet_length(f.src)), 0) from public.fotos f join public.leden l on l.id = f.kandidaat_id
                   where l.rol = 'kandidaat' and l.status = 'geslaagd' and l.geslaagd_op < grens)
               + (select coalesce(sum(octet_length(c.data)), 0) from public.cbr_bevestiging c join public.leden l on l.id = c.kandidaat_id
                   where l.rol = 'kandidaat' and l.status = 'geslaagd' and l.geslaagd_op < grens)
  ) into r;
  return r;
end $$;
revoke all on function public.opslag_overzicht(integer) from public, anon;
grant execute on function public.opslag_overzicht(integer) to authenticated;

-- Wist de foto's en de CBR-bevestiging van kandidaten die langer dan p_maanden geleden geslaagd zijn.
-- De casus zelf (tekst en route), de feedback en het account blijven staan.
create or replace function public.opslag_opruimen(p_maanden integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  grens timestamptz;
  nf int; nc int;
begin
  if not private.is_medewerker() then
    raise exception 'Alleen medewerkers kunnen opslag opruimen.' using errcode = '42501';
  end if;
  if p_maanden is null or p_maanden < 1 or p_maanden > 120 then
    raise exception 'Kies een termijn van 1 tot 120 maanden.' using errcode = '22023';
  end if;
  grens := now() - make_interval(months => p_maanden);
  delete from public.fotos f using public.leden l
   where l.id = f.kandidaat_id and l.rol = 'kandidaat' and l.status = 'geslaagd' and l.geslaagd_op < grens;
  get diagnostics nf = row_count;
  delete from public.cbr_bevestiging c using public.leden l
   where l.id = c.kandidaat_id and l.rol = 'kandidaat' and l.status = 'geslaagd' and l.geslaagd_op < grens;
  get diagnostics nc = row_count;
  return jsonb_build_object('fotos', nf, 'cbr', nc);
end $$;
revoke all on function public.opslag_opruimen(integer) from public, anon;
grant execute on function public.opslag_opruimen(integer) to authenticated;

-- ---------- 4. oude dubbele functie opruimen (de site gebruikt alleen de versie met vaargebied) ----------
drop function if exists public.lid_toevoegen(text, text);

-- ---------- 5. snellere toegangsregels: vaste controles één keer per opdracht in plaats van per rij ----------
-- De regels zelf veranderen niet; alleen de schrijfwijze (select ...) zodat Postgres het resultaat hergebruikt.
drop policy if exists leden_lezen on public.leden;
create policy leden_lezen on public.leden for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_medewerker())
         or (rol = 'kandidaat' and private.mag_kandidaat(id)));
drop policy if exists leden_wijzigen on public.leden;
create policy leden_wijzigen on public.leden for update to authenticated
  using ((select private.is_medewerker())) with check ((select private.is_medewerker()));

drop policy if exists stad_lezen on public.stad_casussen;
drop policy if exists stad_nieuw on public.stad_casussen;
drop policy if exists stad_wijzigen on public.stad_casussen;
drop policy if exists stad_weg on public.stad_casussen;
create policy stad_lezen    on public.stad_casussen for select to authenticated
  using (user_id = (select auth.uid()) and (select private.is_medewerker()));
create policy stad_nieuw    on public.stad_casussen for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.is_medewerker()));
create policy stad_wijzigen on public.stad_casussen for update to authenticated
  using (user_id = (select auth.uid()) and (select private.is_medewerker()))
  with check (user_id = (select auth.uid()) and (select private.is_medewerker()));
create policy stad_weg      on public.stad_casussen for delete to authenticated
  using (user_id = (select auth.uid()) and (select private.is_medewerker()));

drop policy if exists casus_lezen on public.casussen;
drop policy if exists casus_nieuw on public.casussen;
drop policy if exists casus_wijzigen on public.casussen;
create policy casus_lezen    on public.casussen for select to authenticated
  using (kandidaat_id = (select private.mijn_lid_id()) or (select private.is_medewerker()) or private.mag_kandidaat(kandidaat_id));
create policy casus_nieuw    on public.casussen for insert to authenticated
  with check (kandidaat_id = (select private.mijn_lid_id()) or (select private.is_medewerker()));
create policy casus_wijzigen on public.casussen for update to authenticated
  using (kandidaat_id = (select private.mijn_lid_id()) or (select private.is_medewerker()))
  with check (kandidaat_id = (select private.mijn_lid_id()) or (select private.is_medewerker()));

drop policy if exists fb_lezen on public.feedback;
create policy fb_lezen on public.feedback for select to authenticated
  using (kandidaat_id = (select private.mijn_lid_id()) or (select private.is_medewerker()) or private.mag_kandidaat(kandidaat_id));

drop policy if exists foto_lezen on public.fotos;
drop policy if exists foto_nieuw on public.fotos;
drop policy if exists foto_weg on public.fotos;
create policy foto_lezen on public.fotos for select to authenticated
  using (kandidaat_id = (select private.mijn_lid_id()) or (select private.is_medewerker()) or private.mag_kandidaat(kandidaat_id));
create policy foto_nieuw on public.fotos for insert to authenticated
  with check (kandidaat_id = (select private.mijn_lid_id()) or (select private.is_medewerker()));
create policy foto_weg   on public.fotos for delete to authenticated
  using (kandidaat_id = (select private.mijn_lid_id()) or (select private.is_medewerker()));

drop policy if exists theorie_lezen on public.theorie;
drop policy if exists theorie_nieuw on public.theorie;
drop policy if exists theorie_wijzigen on public.theorie;
create policy theorie_lezen    on public.theorie for select to authenticated
  using (kandidaat_id = (select private.mijn_lid_id()) or (select private.is_medewerker()) or private.mag_kandidaat(kandidaat_id));
create policy theorie_nieuw    on public.theorie for insert to authenticated
  with check (kandidaat_id = (select private.mijn_lid_id()));
create policy theorie_wijzigen on public.theorie for update to authenticated
  using (kandidaat_id = (select private.mijn_lid_id())) with check (kandidaat_id = (select private.mijn_lid_id()));

drop policy if exists groep_nieuw on public.groepen;
drop policy if exists groep_wijzigen on public.groepen;
drop policy if exists groep_weg on public.groepen;
create policy groep_nieuw    on public.groepen for insert to authenticated with check ((select private.is_medewerker()));
create policy groep_wijzigen on public.groepen for update to authenticated
  using ((select private.is_medewerker())) with check ((select private.is_medewerker()));
create policy groep_weg      on public.groepen for delete to authenticated using ((select private.is_medewerker()));

drop policy if exists lt_lezen on public.leermeester_toegang;
create policy lt_lezen on public.leermeester_toegang for select to authenticated
  using ((select private.is_medewerker()) or leermeester_id = (select private.mijn_lid_id()));
drop policy if exists lg_lezen on public.leermeester_gebied;
create policy lg_lezen on public.leermeester_gebied for select to authenticated
  using ((select private.is_medewerker()) or leermeester_id = (select private.mijn_lid_id()));
drop policy if exists lgr_lezen on public.leermeester_groep;
create policy lgr_lezen on public.leermeester_groep for select to authenticated
  using ((select private.is_medewerker()) or leermeester_id = (select private.mijn_lid_id()));

-- ---------- 6. live bijwerken van instellingen ----------
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                      and schemaname = 'public' and tablename = 'instellingen') then
    execute 'alter publication supabase_realtime add table public.instellingen';
  end if;
end $$;

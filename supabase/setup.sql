-- =====================================================================
-- SOR Casusbouwer · Flagship Academy
-- Database-opzet voor Supabase. Eenmalig uitvoeren in de SQL Editor.
-- Maakt de tabellen, de toegangsregels (RLS) en de functies aan die de
-- website gebruikt. Veilig om opnieuw uit te voeren: bestaande gegevens
-- blijven staan.
-- =====================================================================

-- ---------- tabellen ----------
create table if not exists public.leden (
  id            uuid primary key default gen_random_uuid(),
  naam          text not null check (char_length(naam) between 1 and 120),
  rol           text not null default 'kandidaat' check (rol in ('kandidaat','medewerker')),
  code          text unique,
  user_id       uuid unique references auth.users(id) on delete set null,
  status        text not null default 'uitgenodigd' check (status in ('uitgenodigd','bezig','ingeleverd','geslaagd')),
  aangemaakt    timestamptz not null default now(),
  gekoppeld_op  timestamptz,
  ingeleverd_op timestamptz,
  geslaagd_op   timestamptz
);

create table if not exists public.casussen (
  kandidaat_id    uuid primary key references public.leden(id) on delete cascade,
  casus           jsonb not null default '{}'::jsonb check (octet_length(casus::text) < 2000000),
  voortgang       int not null default 0,
  rev             text,
  bijgewerkt      timestamptz not null default now(),
  bijgewerkt_door uuid references auth.users(id) on delete set null
);

create table if not exists public.feedback (
  kandidaat_id    uuid primary key references public.leden(id) on delete cascade,
  stappen         jsonb not null default '{}'::jsonb check (octet_length(stappen::text) < 500000),
  bijgewerkt      timestamptz not null default now(),
  bijgewerkt_door uuid references auth.users(id) on delete set null
);

create table if not exists public.fotos (
  id           text primary key check (char_length(id) between 4 and 40),
  kandidaat_id uuid not null references public.leden(id) on delete cascade,
  src          text not null check (char_length(src) < 1500000),
  w            int,
  h            int,
  aangemaakt   timestamptz not null default now()
);
create index if not exists fotos_kandidaat_idx on public.fotos(kandidaat_id);

-- mislukte codepogingen (tegen raden van codes); alleen via functies bereikbaar
create table if not exists public.code_pogingen (
  user_id uuid primary key references auth.users(id) on delete cascade,
  aantal  int not null default 0,
  sinds   timestamptz not null default now()
);

-- ---------- hulpfuncties (in een schema dat niet via de API bereikbaar is) ----------
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_medewerker() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.leden where user_id = auth.uid() and rol = 'medewerker')
$$;

create or replace function private.mijn_lid_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.leden where user_id = auth.uid()
$$;

create or replace function private.code_maken() returns text
language plpgsql volatile set search_path = '' as $$
declare
  b bytea := uuid_send(gen_random_uuid());
  a text  := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  r text  := '';
  i int;
begin
  foreach i in array array[0,1,2,3,4,5,9,10] loop
    r := r || substr(a, (get_byte(b, i) % 31) + 1, 1);
  end loop;
  return r;
end $$;

-- ---------- toegangsregels ----------
alter table public.leden         enable row level security;
alter table public.casussen      enable row level security;
alter table public.feedback      enable row level security;
alter table public.fotos         enable row level security;
alter table public.code_pogingen enable row level security;

drop policy if exists leden_lezen    on public.leden;
drop policy if exists leden_wijzigen on public.leden;
create policy leden_lezen    on public.leden for select to authenticated
  using (user_id = auth.uid() or private.is_medewerker());
create policy leden_wijzigen on public.leden for update to authenticated
  using (private.is_medewerker()) with check (private.is_medewerker());

drop policy if exists casus_lezen    on public.casussen;
drop policy if exists casus_nieuw    on public.casussen;
drop policy if exists casus_wijzigen on public.casussen;
create policy casus_lezen    on public.casussen for select to authenticated
  using (kandidaat_id = private.mijn_lid_id() or private.is_medewerker());
create policy casus_nieuw    on public.casussen for insert to authenticated
  with check (kandidaat_id = private.mijn_lid_id() or private.is_medewerker());
create policy casus_wijzigen on public.casussen for update to authenticated
  using (kandidaat_id = private.mijn_lid_id() or private.is_medewerker())
  with check (kandidaat_id = private.mijn_lid_id() or private.is_medewerker());

drop policy if exists fb_lezen    on public.feedback;
drop policy if exists fb_nieuw    on public.feedback;
drop policy if exists fb_wijzigen on public.feedback;
create policy fb_lezen    on public.feedback for select to authenticated
  using (kandidaat_id = private.mijn_lid_id() or private.is_medewerker());
create policy fb_nieuw    on public.feedback for insert to authenticated
  with check (private.is_medewerker());
create policy fb_wijzigen on public.feedback for update to authenticated
  using (private.is_medewerker()) with check (private.is_medewerker());

drop policy if exists foto_lezen on public.fotos;
drop policy if exists foto_nieuw on public.fotos;
drop policy if exists foto_weg   on public.fotos;
create policy foto_lezen on public.fotos for select to authenticated
  using (kandidaat_id = private.mijn_lid_id() or private.is_medewerker());
create policy foto_nieuw on public.fotos for insert to authenticated
  with check (kandidaat_id = private.mijn_lid_id() or private.is_medewerker());
create policy foto_weg   on public.fotos for delete to authenticated
  using (kandidaat_id = private.mijn_lid_id() or private.is_medewerker());

-- alleen de rechten die de website nodig heeft
revoke all on public.leden, public.casussen, public.feedback, public.fotos, public.code_pogingen from anon, authenticated;
grant select, update         on public.leden    to authenticated;
grant select, insert, update on public.casussen to authenticated;
grant select, insert, update on public.feedback to authenticated;
grant select, insert, delete on public.fotos    to authenticated;

-- ---------- functies voor de website ----------
create or replace function public.code_koppelen(p_code text) returns public.leden
language plpgsql security definer set search_path = '' as $$
declare
  r public.leden;
  c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  p public.code_pogingen;
begin
  if auth.uid() is null then
    raise exception 'Log eerst in.' using errcode = '28000';
  end if;
  if exists (select 1 from public.leden where user_id = auth.uid()) then
    raise exception 'Dit account is al gekoppeld.' using errcode = 'P0001';
  end if;
  select * into p from public.code_pogingen where user_id = auth.uid();
  if p.user_id is not null and p.sinds > now() - interval '1 hour' and p.aantal >= 10 then
    raise exception 'Te veel onjuiste codes. Probeer het over een uur opnieuw.' using errcode = 'P0001';
  end if;
  update public.leden
     set user_id = auth.uid(), code = null, gekoppeld_op = now(),
         status = case when status = 'uitgenodigd' then 'bezig' else status end
   where code = c and user_id is null
  returning * into r;
  if r.id is null then
    insert into public.code_pogingen as cp (user_id, aantal, sinds) values (auth.uid(), 1, now())
    on conflict (user_id) do update
      set aantal = case when cp.sinds > now() - interval '1 hour' then cp.aantal + 1 else 1 end,
          sinds  = case when cp.sinds > now() - interval '1 hour' then cp.sinds else now() end;
    return null;  -- onjuiste code (geen exception, anders telt de poging niet)
  end if;
  delete from public.code_pogingen where user_id = auth.uid();
  return r;
end $$;

create or replace function public.lid_toevoegen(p_naam text, p_rol text default 'kandidaat') returns public.leden
language plpgsql security definer set search_path = '' as $$
declare r public.leden;
begin
  if not private.is_medewerker() then
    raise exception 'Alleen medewerkers kunnen mensen toevoegen.' using errcode = '42501';
  end if;
  if p_rol not in ('kandidaat', 'medewerker') then
    raise exception 'Onbekende rol.' using errcode = '22023';
  end if;
  insert into public.leden (naam, rol, code) values (trim(p_naam), p_rol, private.code_maken())
  returning * into r;
  return r;
end $$;

create or replace function public.nieuwe_code(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid; c text;
begin
  if not private.is_medewerker() then
    raise exception 'Alleen medewerkers kunnen codes maken.' using errcode = '42501';
  end if;
  select user_id into u from public.leden where id = p_id;
  if not found then raise exception 'Niet gevonden.' using errcode = 'P0002'; end if;
  if u = auth.uid() then raise exception 'Je kunt je eigen code niet vernieuwen.' using errcode = 'P0001'; end if;
  update public.leden set code = private.code_maken(), user_id = null, gekoppeld_op = null
   where id = p_id returning code into c;
  if u is not null then delete from auth.users where id = u; end if;  -- oude account vervalt
  return c;
end $$;

create or replace function public.lid_verwijderen(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid;
begin
  if not private.is_medewerker() then
    raise exception 'Alleen medewerkers kunnen mensen verwijderen.' using errcode = '42501';
  end if;
  select user_id into u from public.leden where id = p_id;
  if not found then return; end if;
  if u = auth.uid() then raise exception 'Je kunt jezelf niet verwijderen.' using errcode = 'P0001'; end if;
  delete from public.leden where id = p_id;          -- wist ook casus, feedback en foto's
  if u is not null then delete from auth.users where id = u; end if;
end $$;

create or replace function public.lever_in() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.leden set status = 'ingeleverd', ingeleverd_op = now()
   where user_id = auth.uid() and rol = 'kandidaat' and status in ('uitgenodigd', 'bezig');
end $$;

create or replace function public.bewaar_casus(p_id uuid, p_patch jsonb, p_voortgang int, p_rev text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.casussen as c (kandidaat_id, casus, voortgang, rev, bijgewerkt, bijgewerkt_door)
  values (p_id, coalesce(p_patch, '{}'::jsonb), coalesce(p_voortgang, 0), p_rev, now(), auth.uid())
  on conflict (kandidaat_id) do update
    set casus = c.casus || excluded.casus, voortgang = excluded.voortgang, rev = excluded.rev,
        bijgewerkt = now(), bijgewerkt_door = auth.uid();
end $$;

-- uitvoerrechten: niets voor anonieme bezoekers
revoke all on function private.is_medewerker(), private.mijn_lid_id(), private.code_maken(),
  public.code_koppelen(text), public.lid_toevoegen(text, text), public.nieuwe_code(uuid),
  public.lid_verwijderen(uuid), public.lever_in(), public.bewaar_casus(uuid, jsonb, int, text)
  from public, anon;
revoke all on function private.code_maken() from authenticated;
grant execute on function private.is_medewerker(), private.mijn_lid_id() to authenticated;
grant execute on function public.code_koppelen(text), public.lid_toevoegen(text, text),
  public.nieuwe_code(uuid), public.lid_verwijderen(uuid), public.lever_in(),
  public.bewaar_casus(uuid, jsonb, int, text)
  to authenticated;
-- Let op: code_koppelen, lid_toevoegen, nieuwe_code, lid_verwijderen en lever_in zijn bewust
-- SECURITY DEFINER en aanroepbaar voor ingelogde gebruikers; elke functie controleert zelf
-- wie de aanroeper is (auth.uid() / private.is_medewerker()).

-- ---------- live bijwerken ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.casussen; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.feedback; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.leden;    exception when duplicate_object then null; end;
  end if;
end $$;

-- ---------- aanvulling: e-mailadres voor mailen van kandidaten ----------
-- E-mailadres van het gekoppelde account bewaren, zodat medewerkers de kandidaat kunnen mailen.
alter table public.leden add column if not exists email text;
update public.leden l set email = u.email from auth.users u where u.id = l.user_id and l.email is null;

create or replace function public.code_koppelen(p_code text) returns public.leden
language plpgsql security definer set search_path = '' as $$
declare
  r public.leden;
  c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  p public.code_pogingen;
begin
  if auth.uid() is null then
    raise exception 'Log eerst in.' using errcode = '28000';
  end if;
  if exists (select 1 from public.leden where user_id = auth.uid()) then
    raise exception 'Dit account is al gekoppeld.' using errcode = 'P0001';
  end if;
  select * into p from public.code_pogingen where user_id = auth.uid();
  if p.user_id is not null and p.sinds > now() - interval '1 hour' and p.aantal >= 10 then
    raise exception 'Te veel onjuiste codes. Probeer het over een uur opnieuw.' using errcode = 'P0001';
  end if;
  update public.leden
     set user_id = auth.uid(), code = null, gekoppeld_op = now(),
         email = (select u.email from auth.users u where u.id = auth.uid()),
         status = case when status = 'uitgenodigd' then 'bezig' else status end
   where code = c and user_id is null
  returning * into r;
  if r.id is null then
    insert into public.code_pogingen as cp (user_id, aantal, sinds) values (auth.uid(), 1, now())
    on conflict (user_id) do update
      set aantal = case when cp.sinds > now() - interval '1 hour' then cp.aantal + 1 else 1 end,
          sinds  = case when cp.sinds > now() - interval '1 hour' then cp.sinds else now() end;
    return null;
  end if;
  delete from public.code_pogingen where user_id = auth.uid();
  return r;
end $$;

create or replace function public.nieuwe_code(p_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid; c text;
begin
  if not private.is_medewerker() then
    raise exception 'Alleen medewerkers kunnen codes maken.' using errcode = '42501';
  end if;
  select user_id into u from public.leden where id = p_id;
  if not found then raise exception 'Niet gevonden.' using errcode = 'P0002'; end if;
  if u = auth.uid() then raise exception 'Je kunt je eigen code niet vernieuwen.' using errcode = 'P0001'; end if;
  update public.leden set code = private.code_maken(), user_id = null, gekoppeld_op = null, email = null
   where id = p_id returning code into c;
  if u is not null then delete from auth.users where id = u; end if;
  return c;
end $$;

revoke all on function public.code_koppelen(text), public.nieuwe_code(uuid) from public, anon;
grant execute on function public.code_koppelen(text), public.nieuwe_code(uuid) to authenticated;

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

-- ---------- aanvulling: casussen van medewerkers in andere steden (Utrecht-beta) ----------
create table if not exists public.stad_casussen (
  user_id    uuid not null references auth.users(id) on delete cascade,
  stad       text not null check (stad in ('utrecht')),
  casus      jsonb not null default '{}'::jsonb check (octet_length(casus::text) < 5000000),
  voortgang  int not null default 0,
  bijgewerkt timestamptz not null default now(),
  primary key (user_id, stad)
);
alter table public.stad_casussen enable row level security;
drop policy if exists stad_lezen    on public.stad_casussen;
drop policy if exists stad_nieuw    on public.stad_casussen;
drop policy if exists stad_wijzigen on public.stad_casussen;
drop policy if exists stad_weg      on public.stad_casussen;
create policy stad_lezen    on public.stad_casussen for select to authenticated
  using (user_id = auth.uid() and private.is_medewerker());
create policy stad_nieuw    on public.stad_casussen for insert to authenticated
  with check (user_id = auth.uid() and private.is_medewerker());
create policy stad_wijzigen on public.stad_casussen for update to authenticated
  using (user_id = auth.uid() and private.is_medewerker()) with check (user_id = auth.uid() and private.is_medewerker());
create policy stad_weg      on public.stad_casussen for delete to authenticated
  using (user_id = auth.uid() and private.is_medewerker());
revoke all on public.stad_casussen from anon, authenticated;
grant select, insert, update, delete on public.stad_casussen to authenticated;

-- ---------- aanvulling: rol leermeester ----------
-- Een leermeester ziet alleen de kandidaten die een medewerker aan hem koppelt,
-- kan hun casus bekijken en feedback geven. Geen beheer van mensen, geen Utrecht-beta.
alter table public.leden drop constraint if exists leden_rol_check;
alter table public.leden add constraint leden_rol_check check (rol in ('kandidaat','medewerker','leermeester'));

create table if not exists public.leermeester_toegang (
  leermeester_id uuid not null references public.leden(id) on delete cascade,
  kandidaat_id   uuid not null references public.leden(id) on delete cascade,
  aangemaakt     timestamptz not null default now(),
  primary key (leermeester_id, kandidaat_id)
);
create index if not exists leermeester_toegang_kandidaat_idx on public.leermeester_toegang(kandidaat_id);
alter table public.leermeester_toegang enable row level security;

-- mag de ingelogde gebruiker deze kandidaat zien? (medewerker: altijd; leermeester: alleen gekoppeld)
create or replace function private.mag_kandidaat(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.leden where user_id = auth.uid() and rol = 'medewerker')
      or exists (select 1 from public.leermeester_toegang t join public.leden l on l.id = t.leermeester_id
                  where l.user_id = auth.uid() and l.rol = 'leermeester' and t.kandidaat_id = p_id)
$$;
revoke all on function private.mag_kandidaat(uuid) from public, anon;
grant execute on function private.mag_kandidaat(uuid) to authenticated;

drop policy if exists lt_lezen on public.leermeester_toegang;
create policy lt_lezen on public.leermeester_toegang for select to authenticated
  using (private.is_medewerker() or leermeester_id = private.mijn_lid_id());
revoke all on public.leermeester_toegang from anon, authenticated;
grant select on public.leermeester_toegang to authenticated;

drop policy if exists leden_lezen on public.leden;
create policy leden_lezen on public.leden for select to authenticated
  using (user_id = auth.uid() or private.is_medewerker() or (rol = 'kandidaat' and private.mag_kandidaat(id)));

drop policy if exists casus_lezen on public.casussen;
create policy casus_lezen on public.casussen for select to authenticated
  using (kandidaat_id = private.mijn_lid_id() or private.mag_kandidaat(kandidaat_id));

drop policy if exists fb_lezen    on public.feedback;
drop policy if exists fb_nieuw    on public.feedback;
drop policy if exists fb_wijzigen on public.feedback;
create policy fb_lezen    on public.feedback for select to authenticated
  using (kandidaat_id = private.mijn_lid_id() or private.mag_kandidaat(kandidaat_id));
create policy fb_nieuw    on public.feedback for insert to authenticated
  with check (private.mag_kandidaat(kandidaat_id));
create policy fb_wijzigen on public.feedback for update to authenticated
  using (private.mag_kandidaat(kandidaat_id)) with check (private.mag_kandidaat(kandidaat_id));

drop policy if exists foto_lezen on public.fotos;
create policy foto_lezen on public.fotos for select to authenticated
  using (kandidaat_id = private.mijn_lid_id() or private.mag_kandidaat(kandidaat_id));

drop policy if exists theorie_lezen on public.theorie;
create policy theorie_lezen on public.theorie for select to authenticated
  using (kandidaat_id = private.mijn_lid_id() or private.mag_kandidaat(kandidaat_id));

create or replace function public.lid_toevoegen(p_naam text, p_rol text default 'kandidaat') returns public.leden
language plpgsql security definer set search_path = '' as $$
declare r public.leden;
begin
  if not private.is_medewerker() then
    raise exception 'Alleen medewerkers kunnen mensen toevoegen.' using errcode = '42501';
  end if;
  if p_rol not in ('kandidaat', 'medewerker', 'leermeester') then
    raise exception 'Onbekende rol.' using errcode = '22023';
  end if;
  insert into public.leden (naam, rol, code) values (trim(p_naam), p_rol, private.code_maken())
  returning * into r;
  return r;
end $$;

-- koppelingen van een leermeester in één keer vervangen
create or replace function public.leermeester_koppelen(p_lm uuid, p_kandidaten jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if not private.is_medewerker() then
    raise exception 'Alleen medewerkers kunnen leermeesters koppelen.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.leden where id = p_lm and rol = 'leermeester') then
    raise exception 'Dit is geen leermeester.' using errcode = '22023';
  end if;
  delete from public.leermeester_toegang where leermeester_id = p_lm;
  insert into public.leermeester_toegang (leermeester_id, kandidaat_id)
  select p_lm, k.id from public.leden k
   where k.rol = 'kandidaat' and k.id::text in (select jsonb_array_elements_text(coalesce(p_kandidaten, '[]'::jsonb)));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.lid_toevoegen(text, text), public.leermeester_koppelen(uuid, jsonb) from public, anon;
grant execute on function public.lid_toevoegen(text, text), public.leermeester_koppelen(uuid, jsonb) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.leermeester_toegang; exception when duplicate_object then null; end;
  end if;
end $$;

-- ---------- aanvulling: Groningen-beta ----------
alter table public.stad_casussen drop constraint if exists stad_casussen_stad_check;
alter table public.stad_casussen add constraint stad_casussen_stad_check check (stad in ('utrecht','groningen'));

-- ---------- aanvulling: vaargebied per kandidaat (Amsterdam of Groningen) ----------
alter table public.leden add column if not exists stad text not null default 'amsterdam';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'leden_stad_check') then
    alter table public.leden add constraint leden_stad_check check (stad in ('amsterdam','groningen'));
  end if;
end $$;

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
  if coalesce(p_stad, 'amsterdam') not in ('amsterdam', 'groningen') then
    raise exception 'Onbekend vaargebied.' using errcode = '22023';
  end if;
  insert into public.leden (naam, rol, code, stad)
  values (trim(p_naam), p_rol, private.code_maken(), case when p_rol = 'kandidaat' then coalesce(p_stad, 'amsterdam') else 'amsterdam' end)
  returning * into r;
  return r;
end $$;
revoke all on function public.lid_toevoegen(text, text, text) from public, anon;
grant execute on function public.lid_toevoegen(text, text, text) to authenticated;

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

-- 009_feedback_gemaild: wanneer de feedback voor het laatst per e-mail naar de kandidaat is gestuurd (gezet door de Edge Function feedback-mail)
alter table public.feedback add column if not exists gemaild_op timestamptz;

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

-- 011: indexen op verwijzingen (prestatie)
create index if not exists casussen_bijgewerkt_door_idx on public.casussen(bijgewerkt_door);
create index if not exists feedback_bijgewerkt_door_idx on public.feedback(bijgewerkt_door);

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

-- 015: gebieden als gegevens in plaats van vaste waarden in de code.
-- Elk gebied heeft een eigen adres (/<slug>/), instellingen, eventueel een kaart uit OpenStreetMap,
-- en eigen traject-instellingen (termijnen en stappen). Amsterdam, Groningen en Utrecht zijn ingebouwd.
create table if not exists public.gebieden (
  slug         text primary key check (slug ~ '^[a-z][a-z0-9-]{1,30}$'),
  naam         text not null check (char_length(naam) between 1 and 60),
  actief       boolean not null default true,
  ingebouwd    boolean not null default false,
  volgorde     integer not null default 100,
  instellingen jsonb not null default '{}'::jsonb,
  kaart        jsonb,
  traject      jsonb not null default '{}'::jsonb,
  aangemaakt   timestamptz not null default now(),
  bijgewerkt   timestamptz not null default now()
);
insert into public.gebieden (slug, naam, ingebouwd, volgorde) values
  ('amsterdam', 'Amsterdam', true, 1), ('groningen', 'Groningen', true, 2), ('utrecht', 'Utrecht', true, 3)
on conflict (slug) do nothing;

alter table public.gebieden enable row level security;
drop policy if exists gebied_lezen_anon on public.gebieden;
drop policy if exists gebied_lezen on public.gebieden;
drop policy if exists gebied_nieuw on public.gebieden;
drop policy if exists gebied_wijzigen on public.gebieden;
drop policy if exists gebied_weg on public.gebieden;
-- de kaart en de instellingen zijn geen persoonsgegevens; een actief gebied mag iedereen lezen (nodig om de site te laden)
create policy gebied_lezen_anon on public.gebieden for select to anon using (actief);
create policy gebied_lezen      on public.gebieden for select to authenticated using (actief or (select private.is_medewerker()));
create policy gebied_nieuw      on public.gebieden for insert to authenticated with check ((select private.is_medewerker()) and not ingebouwd);
create policy gebied_wijzigen   on public.gebieden for update to authenticated using ((select private.is_medewerker())) with check ((select private.is_medewerker()));
create policy gebied_weg        on public.gebieden for delete to authenticated using ((select private.is_medewerker()) and not ingebouwd);
revoke all on public.gebieden from anon, authenticated;
grant select on public.gebieden to anon, authenticated;
grant insert (slug, naam, actief, volgorde, instellingen, kaart, traject) on public.gebieden to authenticated;
grant update (naam, actief, volgorde, instellingen, kaart, traject, bijgewerkt) on public.gebieden to authenticated;
grant delete on public.gebieden to authenticated;

-- vaste lijsten van steden vervangen door een verwijzing naar gebieden
alter table public.leden drop constraint if exists leden_stad_check;
alter table public.leden drop constraint if exists leden_stad_fk;
alter table public.leden add constraint leden_stad_fk foreign key (stad) references public.gebieden(slug) on update cascade;
alter table public.groepen drop constraint if exists groepen_stad_check;
alter table public.groepen drop constraint if exists groepen_stad_fk;
alter table public.groepen add constraint groepen_stad_fk foreign key (stad) references public.gebieden(slug) on update cascade on delete restrict;
alter table public.leermeester_gebied drop constraint if exists leermeester_gebied_stad_check;
alter table public.leermeester_gebied drop constraint if exists leermeester_gebied_stad_fk;
alter table public.leermeester_gebied add constraint leermeester_gebied_stad_fk foreign key (stad) references public.gebieden(slug) on update cascade on delete cascade;
alter table public.stad_casussen drop constraint if exists stad_casussen_stad_check;
create index if not exists leden_stad_idx on public.leden(stad);
create index if not exists groepen_stad_idx on public.groepen(stad);
create index if not exists leermeester_gebied_stad_idx on public.leermeester_gebied(stad);

-- eigen trajectstappen per kandidaat (stap-id -> datum afgerond), naast de vaste vrijstellingsstappen
alter table public.leden add column if not exists stappen jsonb not null default '{}'::jsonb;

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
  if not exists (select 1 from public.gebieden where slug = coalesce(p_stad, 'amsterdam')) then
    raise exception 'Onbekend vaargebied.' using errcode = '22023';
  end if;
  insert into public.leden (naam, rol, code, stad)
  values (trim(p_naam), p_rol, private.code_maken(), case when p_rol = 'kandidaat' then coalesce(p_stad, 'amsterdam') else 'amsterdam' end)
  returning * into r;
  return r;
end $$;
revoke all on function public.lid_toevoegen(text, text, text) from public, anon;
grant execute on function public.lid_toevoegen(text, text, text) to authenticated;

create or replace function public.leermeester_gebied_zetten(p_lm uuid, p_stad text, p_aan boolean) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_medewerker() then
    raise exception 'Alleen medewerkers kunnen leermeesters koppelen.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.leden where id = p_lm and rol = 'leermeester') then
    raise exception 'Dit is geen leermeester.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.gebieden where slug = p_stad) then
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

-- leermodules per gebied, opgebouwd uit vaste sjablonen (hoofdstuk met quiz, vaargebied leren kennen)
create table if not exists public.leermodules (
  id         uuid primary key default gen_random_uuid(),
  gebied     text not null references public.gebieden(slug) on update cascade on delete cascade,
  soort      text not null check (soort in ('hoofdstuk', 'vaargebied')),
  titel      text not null check (char_length(titel) between 1 and 100),
  volgorde   integer not null default 100,
  actief     boolean not null default false,
  inhoud     jsonb not null default '{}'::jsonb,
  aangemaakt timestamptz not null default now(),
  bijgewerkt timestamptz not null default now()
);
create index if not exists leermodules_gebied_idx on public.leermodules(gebied);
alter table public.leermodules enable row level security;
drop policy if exists module_lezen on public.leermodules;
drop policy if exists module_nieuw on public.leermodules;
drop policy if exists module_wijzigen on public.leermodules;
drop policy if exists module_weg on public.leermodules;
-- kandidaten lezen alleen actieve modules van hun eigen gebied; medewerkers en leermeesters alles
create policy module_lezen on public.leermodules for select to authenticated using (
  (select private.is_medewerker())
  or exists (select 1 from public.leden l where l.user_id = (select auth.uid()) and l.rol = 'leermeester')
  or (actief and exists (select 1 from public.leden l where l.user_id = (select auth.uid()) and coalesce(l.stad, 'amsterdam') = leermodules.gebied)));
create policy module_nieuw    on public.leermodules for insert to authenticated with check ((select private.is_medewerker()));
create policy module_wijzigen on public.leermodules for update to authenticated using ((select private.is_medewerker())) with check ((select private.is_medewerker()));
create policy module_weg      on public.leermodules for delete to authenticated using ((select private.is_medewerker()));
revoke all on public.leermodules from anon, authenticated;
grant select, insert, update, delete on public.leermodules to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.gebieden; exception when duplicate_object then null; end;
  end if;
end $$;

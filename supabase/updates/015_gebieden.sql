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

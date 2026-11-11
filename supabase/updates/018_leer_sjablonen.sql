-- 018: sjablonen voor de leeromgeving per vaargebied. Een sjabloon bepaalt welke theoriehoofdstukken
-- een kandidaat krijgt, in welke volgorde, en welke extra modules (uit leermodules) erbij horen.
-- Toewijzen: per kandidaat (leden.sjabloon_id) of per groep (groepen.sjabloon_id).
-- Volgorde bij een kandidaat: eigen sjabloon > sjabloon van de groep > standaardsjabloon van het gebied > alle hoofdstukken.
-- Alleen medewerkers maken, wijzigen en wijzen toe; iedereen die is ingelogd mag een sjabloon lezen
-- (de kandidaat heeft het nodig om zijn leeromgeving op te bouwen; er staan geen persoonsgegevens in).
create table if not exists public.leer_sjablonen (
  id          uuid primary key default gen_random_uuid(),
  gebied      text not null references public.gebieden(slug) on delete cascade,
  naam        text not null check (char_length(naam) between 1 and 80),
  standaard   boolean not null default false,
  items       jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array' and octet_length(items::text) < 20000),
  aangemaakt  timestamptz not null default now(),
  bijgewerkt  timestamptz not null default now()
);
create unique index if not exists leer_sjablonen_standaard on public.leer_sjablonen(gebied) where standaard;
create index if not exists leer_sjablonen_gebied_idx on public.leer_sjablonen(gebied);
alter table public.leer_sjablonen enable row level security;
drop policy if exists sj_lezen on public.leer_sjablonen;
drop policy if exists sj_nieuw on public.leer_sjablonen;
drop policy if exists sj_wijzigen on public.leer_sjablonen;
drop policy if exists sj_weg on public.leer_sjablonen;
create policy sj_lezen    on public.leer_sjablonen for select to authenticated using (true);
create policy sj_nieuw    on public.leer_sjablonen for insert to authenticated with check ((select private.is_medewerker()));
create policy sj_wijzigen on public.leer_sjablonen for update to authenticated using ((select private.is_medewerker())) with check ((select private.is_medewerker()));
create policy sj_weg      on public.leer_sjablonen for delete to authenticated using ((select private.is_medewerker()));
revoke all on public.leer_sjablonen from anon, authenticated;
grant select, insert, update, delete on public.leer_sjablonen to authenticated;

alter table public.leden   add column if not exists sjabloon_id uuid references public.leer_sjablonen(id) on delete set null;
alter table public.groepen add column if not exists sjabloon_id uuid references public.leer_sjablonen(id) on delete set null;
create index if not exists leden_sjabloon_idx on public.leden(sjabloon_id);
create index if not exists groepen_sjabloon_idx on public.groepen(sjabloon_id);

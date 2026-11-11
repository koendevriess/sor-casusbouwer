-- 016: kandidaat uploadt de bevestiging van het CBR (vrijstelling geregistreerd) in zijn voortgang.
-- Eén bestand per kandidaat (pdf of foto, max. 5 MB), opgeslagen als data-URL, net als de foto's in de casus.
create table if not exists public.cbr_bevestiging (
  kandidaat_id uuid primary key references public.leden(id) on delete cascade,
  naam         text not null check (char_length(naam) between 1 and 200),
  type         text not null check (type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  grootte      integer not null check (grootte between 1 and 5242880),
  data         text not null check (char_length(data) < 7100000),
  geupload     timestamptz not null default now()
);
alter table public.cbr_bevestiging enable row level security;
drop policy if exists cbr_lezen on public.cbr_bevestiging;
drop policy if exists cbr_nieuw on public.cbr_bevestiging;
drop policy if exists cbr_wijzigen on public.cbr_bevestiging;
drop policy if exists cbr_weg on public.cbr_bevestiging;
-- de kandidaat zelf, medewerkers en leermeesters die deze kandidaat mogen zien
create policy cbr_lezen    on public.cbr_bevestiging for select to authenticated
  using (kandidaat_id = (select private.mijn_lid_id()) or (select private.mag_kandidaat(kandidaat_id)));
-- uploaden, vervangen en verwijderen: de kandidaat zelf of een medewerker
create policy cbr_nieuw    on public.cbr_bevestiging for insert to authenticated
  with check (kandidaat_id = (select private.mijn_lid_id()) or (select private.is_medewerker()));
create policy cbr_wijzigen on public.cbr_bevestiging for update to authenticated
  using (kandidaat_id = (select private.mijn_lid_id()) or (select private.is_medewerker()))
  with check (kandidaat_id = (select private.mijn_lid_id()) or (select private.is_medewerker()));
create policy cbr_weg      on public.cbr_bevestiging for delete to authenticated
  using (kandidaat_id = (select private.mijn_lid_id()) or (select private.is_medewerker()));
revoke all on public.cbr_bevestiging from anon, authenticated;
grant select, insert, update, delete on public.cbr_bevestiging to authenticated;

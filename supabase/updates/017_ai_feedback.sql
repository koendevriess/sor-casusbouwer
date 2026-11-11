-- 017: AI-conceptfeedback. Bij het inleveren analyseert de Edge Function ai-feedback de casus
-- (met goede eerdere casussen als voorbeeld) en zet per stap een concept klaar.
-- Alleen medewerkers en leermeesters die de kandidaat mogen zien, kunnen het concept lezen; de kandidaat niet.
-- Het concept wordt alleen door de Edge Function geschreven (service role). Medewerkers en leermeesters
-- kunnen alleen bijhouden welke stappen ze hebben overgenomen of genegeerd (kolom afgehandeld).
create table if not exists public.ai_concept (
  kandidaat_id     uuid primary key references public.leden(id) on delete cascade,
  status           text not null default 'bezig' check (status in ('bezig', 'klaar', 'fout', 'uit')),
  stappen          jsonb not null default '{}'::jsonb check (octet_length(stappen::text) < 200000),
  algemeen         text check (char_length(algemeen) < 20000),
  controles        jsonb check (octet_length(controles::text) < 200000),
  voorbeelden      int not null default 0,
  model            text,
  fout             text check (char_length(fout) < 2000),
  reden            text,
  casus_bijgewerkt timestamptz,
  afgehandeld      jsonb not null default '{}'::jsonb check (octet_length(afgehandeld::text) < 20000),
  gestart          timestamptz not null default now(),
  gemaakt          timestamptz
);
alter table public.ai_concept enable row level security;
drop policy if exists ai_lezen on public.ai_concept;
drop policy if exists ai_afhandelen on public.ai_concept;
create policy ai_lezen      on public.ai_concept for select to authenticated
  using ((select private.mag_kandidaat(kandidaat_id)));
create policy ai_afhandelen on public.ai_concept for update to authenticated
  using ((select private.mag_kandidaat(kandidaat_id))) with check ((select private.mag_kandidaat(kandidaat_id)));
revoke all on public.ai_concept from anon, authenticated;
grant select on public.ai_concept to authenticated;
grant update (afgehandeld) on public.ai_concept to authenticated;

-- Goede casussen die medewerkers als voorbeeld voor de AI aanwijzen (zonder aanwijzing: recent geslaagde casussen).
create table if not exists public.ai_voorbeeld (
  kandidaat_id uuid primary key references public.leden(id) on delete cascade,
  door         uuid references auth.users(id) on delete set null default auth.uid(),
  op           timestamptz not null default now()
);
alter table public.ai_voorbeeld enable row level security;
drop policy if exists aiv_lezen on public.ai_voorbeeld;
drop policy if exists aiv_nieuw on public.ai_voorbeeld;
drop policy if exists aiv_weg on public.ai_voorbeeld;
create policy aiv_lezen on public.ai_voorbeeld for select to authenticated using ((select private.is_medewerker()));
create policy aiv_nieuw on public.ai_voorbeeld for insert to authenticated
  with check ((select private.is_medewerker())
              and exists (select 1 from public.leden k where k.id = kandidaat_id and k.rol = 'kandidaat'));
create policy aiv_weg   on public.ai_voorbeeld for delete to authenticated using ((select private.is_medewerker()));
revoke all on public.ai_voorbeeld from anon, authenticated;
grant select, insert, delete on public.ai_voorbeeld to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.ai_concept; exception when duplicate_object then null; end;
  end if;
end $$;

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

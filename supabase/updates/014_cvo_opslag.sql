-- 014: CVO's in afgeschermde opslag (niet meer als openbaar bestand op de website).
-- Lezen: iedereen met een gekoppeld account (kandidaat voor de bijlage in de eigen casus,
-- leermeester en medewerker via het menu CVO's). Toevoegen, vervangen en verwijderen: alleen medewerkers.
do $mig$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'Geen storage-schema: CVO-opslag overgeslagen';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('cvo', 'cvo', false, 20971520, array['image/jpeg', 'application/pdf'])
  on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  execute 'drop policy if exists cvo_lezen on storage.objects';
  execute 'drop policy if exists cvo_nieuw on storage.objects';
  execute 'drop policy if exists cvo_wijzigen on storage.objects';
  execute 'drop policy if exists cvo_weg on storage.objects';
  execute $p$create policy cvo_lezen on storage.objects for select to authenticated
    using (bucket_id = 'cvo' and (select private.mijn_lid_id()) is not null)$p$;
  execute $p$create policy cvo_nieuw on storage.objects for insert to authenticated
    with check (bucket_id = 'cvo' and (select private.is_medewerker()))$p$;
  execute $p$create policy cvo_wijzigen on storage.objects for update to authenticated
    using (bucket_id = 'cvo' and (select private.is_medewerker())) with check (bucket_id = 'cvo' and (select private.is_medewerker()))$p$;
  execute $p$create policy cvo_weg on storage.objects for delete to authenticated
    using (bucket_id = 'cvo' and (select private.is_medewerker()))$p$;
end
$mig$;

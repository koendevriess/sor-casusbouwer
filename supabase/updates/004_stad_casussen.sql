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

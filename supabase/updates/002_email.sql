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

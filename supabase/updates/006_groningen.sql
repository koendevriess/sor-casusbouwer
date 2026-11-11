-- ---------- aanvulling: Groningen-beta ----------
alter table public.stad_casussen drop constraint if exists stad_casussen_stad_check;
alter table public.stad_casussen add constraint stad_casussen_stad_check check (stad in ('utrecht','groningen'));

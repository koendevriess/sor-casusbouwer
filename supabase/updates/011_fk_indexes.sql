
-- 011: indexen op verwijzingen (prestatie)
create index if not exists casussen_bijgewerkt_door_idx on public.casussen(bijgewerkt_door);
create index if not exists feedback_bijgewerkt_door_idx on public.feedback(bijgewerkt_door);

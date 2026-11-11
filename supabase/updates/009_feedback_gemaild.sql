-- 009: tijdstip waarop de feedback voor het laatst per e-mail naar de kandidaat is gestuurd
alter table public.feedback add column if not exists gemaild_op timestamptz;

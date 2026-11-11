-- 019: welke leeromgeving(en) iemand krijgt. 'sor' = SOR-traject (theorie + casus), 'kvb' = interne training
-- Schipper KVB – Basic Training. Bestaande kandidaten houden alleen 'sor'. Alleen medewerkers wijzigen dit
-- (via de bestaande regel leden_wijzigen). De voortgang van een training staat bij de theorie (theorie.data.x.tr).
alter table public.leden add column if not exists trainingen text[] not null default array['sor']::text[];
do $$ begin
  alter table public.leden add constraint leden_trainingen_check
    check (cardinality(trainingen) between 1 and 10 and trainingen <@ array['sor','kvb']::text[]);
exception when duplicate_object then null; end $$;

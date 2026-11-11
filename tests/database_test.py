#!/usr/bin/env python3
"""Test de database-scripts op een lege Postgres (geen Supabase nodig).

Gebruik:  python3 tests/database_test.py
Verbinding via de gewone PG-variabelen (PGHOST, PGPORT, PGUSER, PGPASSWORD). De test maakt zelf een
tijdelijke database 'sor_test' aan, voert supabase/setup.sql en alle supabase/updates/020+ uit
(elk twee keer, om te bewijzen dat opnieuw uitvoeren veilig is) en controleert daarna de toegangsregels.
"""
import os, subprocess, sys, uuid, json, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB = 'sor_test'
SHIM = """
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text);
create or replace function auth.uid() returns uuid language sql stable as
  $f$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $f$;
grant usage on schema auth to authenticated, anon, service_role;
grant execute on function auth.uid() to authenticated, anon, service_role;
grant usage on schema public to authenticated, anon, service_role;
"""

def psql(sql, db=DB, stop=True):
    r = subprocess.run(['psql', '-X', '-q', '-t', '-A', '-d', db] + (['-v', 'ON_ERROR_STOP=1'] if stop else []),
                       input=sql, capture_output=True, text=True)
    return (r.stdout.strip(), r.stderr.strip(), r.returncode)

def admin(sql):
    o, e, c = psql(sql)
    if c: raise SystemExit('SQL mislukt: ' + e + '\n' + sql[:300])
    return o

def als(rol, uid, sql):
    """Voert sql uit als ingelogde gebruiker (authenticated), niet ingelogd (anon) of de Edge Function (service_role)."""
    claims = json.dumps({'sub': str(uid) if uid else '', 'role': rol})
    o, e, c = psql(f"begin; set local role {rol}; select set_config('request.jwt.claims','{claims}',true) \\g /dev/null\n{sql};\ncommit;")
    return ('FOUT: ' + e.split('\n')[0]) if c else o

uit = []
def ok(c, label, info=''):
    uit.append(bool(c)); print(('PASS ' if c else 'FAIL ') + label + ('' if c else '  -> ' + str(info)[:200]), flush=True)

def main():
    psql(f'drop database if exists {DB}', 'postgres'); o, e, c = psql(f'create database {DB}', 'postgres')
    if c: raise SystemExit('Kan geen testdatabase maken: ' + e)
    admin(SHIM)
    scripts = [os.path.join(ROOT, 'supabase', 'setup.sql')] + sorted(
        f for f in glob.glob(os.path.join(ROOT, 'supabase', 'updates', '*.sql')) if os.path.basename(f)[:3] >= '020')
    for f in scripts:
        for keer in (1, 2):
            o, e, c = psql(open(f, encoding='utf-8').read())
            ok(c == 0, f'{os.path.basename(f)} uitvoeren ({keer}e keer)', e)

    S, L, L2, K, K2, KG = (uuid.uuid4() for _ in range(6))
    for u in (S, L, L2, K, K2, KG): admin(f"insert into auth.users(id,email) values ('{u}','{str(u)[:8]}@test.nl')")
    def lid(naam, rol, u=None, **kw):
        cols = ['naam', 'rol'] + (['user_id'] if u else []) + list(kw); vals = [naam, rol] + ([str(u)] if u else []) + list(kw.values())
        return admin(f"insert into public.leden({','.join(cols)}) values ({','.join(chr(39)+str(v)+chr(39) for v in vals)}) returning id").split('\n')[0]
    lid('Medewerker Test', 'medewerker', S)
    lm = lid('Leermeester Een', 'leermeester', L); lid('Leermeester Twee', 'leermeester', L2)
    g = admin("insert into public.groepen(naam,stad) values ('Examen test','amsterdam') returning id").split('\n')[0]
    k1 = lid('Voorbeeld Een', 'kandidaat', K, status='bezig', stad='amsterdam', groep_id=g)
    k2 = lid('Voorbeeld Twee', 'kandidaat', K2, status='bezig', stad='amsterdam')
    kg = lid('Voorbeeld Geslaagd', 'kandidaat', KG, status='bezig', stad='amsterdam')

    # --- kandidaat: alleen eigen gegevens ---
    r = als('authenticated', K, f"select public.bewaar_casus('{k1}','{{\"opstap\":\"A\"}}'::jsonb,10,'r1')"); ok('FOUT' not in r, 'kandidaat slaat eigen casus op', r)
    r = als('authenticated', K, "select count(*) from public.leden"); ok(r == '1', 'kandidaat ziet alleen zichzelf in leden', r)
    r = als('authenticated', K2, "select count(*) from public.casussen"); ok(r == '0', 'kandidaat ziet de casus van een ander niet', r)
    r = als('authenticated', K2, f"update public.casussen set voortgang=1 where kandidaat_id='{k1}' returning 1"); ok(r == '', 'kandidaat kan de casus van een ander niet wijzigen', r)
    r = als('authenticated', K, f"insert into public.theorie(kandidaat_id,data) values ('{k1}','{{}}')"); ok('FOUT' not in r, 'kandidaat slaat eigen theorie op', r)
    r = als('authenticated', K, f"insert into public.fotos(id,kandidaat_id,src) values ('foto-k1','{k1}','data:x')"); ok('FOUT' not in r, 'kandidaat voegt eigen foto toe', r)
    r = als('authenticated', K, f"update public.leden set status='geslaagd' where id='{k1}' returning 1"); ok(r == '', 'kandidaat kan zichzelf niet geslaagd maken', r)

    # --- medewerker en leermeester ---
    r = als('authenticated', S, "select count(*) from public.leden"); ok(r == '6', 'medewerker ziet alle leden', r)
    r = als('authenticated', S, "select count(*) from public.casussen"); ok(r == '1', 'medewerker ziet alle casussen', r)
    r = als('authenticated', L, "select count(*) from public.leden where rol='kandidaat'"); ok(r == '0', 'leermeester zonder koppeling ziet geen kandidaten', r)
    r = als('authenticated', L, f"select public.groep_leermeesters_zetten('{g}','[\"{lm}\"]')"); ok('FOUT' in r, 'leermeester mag zelf geen groep koppelen', r)
    r = als('authenticated', S, f"select public.groep_leermeesters_zetten('{g}','[\"{lm}\"]')"); ok(r == '1', 'medewerker koppelt leermeester aan groep', r)
    r = als('authenticated', L, "select naam from public.leden where rol='kandidaat'"); ok(r == 'Voorbeeld Een', 'leermeester ziet alleen de kandidaat uit zijn groep', r)
    r = als('authenticated', L, "select count(*) from public.casussen"); ok(r == '1', 'leermeester ziet de casus van zijn groepskandidaat', r)
    admin(f"update public.leden set groep_id='{g}' where id='{k2}'")
    r = als('authenticated', L, "select count(*) from public.leden where rol='kandidaat'"); ok(r == '2', 'later toegevoegde kandidaat is automatisch zichtbaar', r)
    r = als('authenticated', L2, "select count(*) from public.leden where rol='kandidaat'"); ok(r == '0', 'andere leermeester ziet niets', r)
    r = als('authenticated', S, "select count(*) from (select public.lid_toevoegen('Voorbeeld Nieuw','kandidaat','amsterdam')) x"); ok(r == '1', 'medewerker voegt kandidaat toe (versie met vaargebied)', r)
    r = admin("select count(*) from pg_proc where proname='lid_toevoegen'"); ok(r == '1', 'oude dubbele functie lid_toevoegen is weg', r)
    r = als('authenticated', S, "insert into public.stad_casussen(user_id,stad,casus) values ('%s','utrecht','{}')" % S); ok('FOUT' not in r, 'medewerker bewaart eigen oefencasus', r)
    r = als('authenticated', K, "select count(*) from public.stad_casussen"); ok(r == '0', 'kandidaat ziet geen oefencasussen van medewerkers', r)

    # --- geslaagd: afgesloten ---
    als('authenticated', KG, f"select public.bewaar_casus('{kg}','{{\"opstap\":\"B\"}}'::jsonb,10,'r1')")
    als('authenticated', KG, f"insert into public.fotos(id,kandidaat_id,src) values ('foto-kg','{kg}','data:{'x'*5000}')")
    admin(f"update public.leden set status='geslaagd', geslaagd_op=now() - interval '8 months' where id='{kg}'")
    r = als('authenticated', KG, f"select public.bewaar_casus('{kg}','{{\"opstap\":\"C\"}}'::jsonb,20,'r2')"); ok('Je bent geslaagd' in r, 'geslaagde kandidaat kan casus niet meer wijzigen', r)
    r = als('authenticated', KG, f"select casus->>'opstap' from public.casussen where kandidaat_id='{kg}'"); ok(r == 'B', 'geslaagde kandidaat kan casus nog lezen (PDF)', r)
    r = als('authenticated', S, f"update public.casussen set voortgang=99 where kandidaat_id='{kg}' returning 1"); ok(r == '1', 'medewerker kan casus van geslaagde nog wijzigen', r)

    # --- instellingen ---
    r = als('anon', None, "select string_agg(sleutel,',') from public.instellingen"); ok(r == 'privacy', 'niet ingelogd: alleen de privacy-instelling leesbaar', r)
    r = als('anon', None, "select count(*) from public.leden"); ok('FOUT' in r or r == '0', 'niet ingelogd: geen leden leesbaar', r)
    r = als('authenticated', K, "select count(*) from public.instellingen"); ok(r == '3', 'kandidaat kan instellingen lezen', r)
    r = als('authenticated', K, "update public.instellingen set waarde='{\"aan\":true}' where sleutel='ai' returning 1"); ok(r == '', 'kandidaat kan instellingen niet wijzigen', r)
    r = als('authenticated', S, "update public.instellingen set waarde='{\"aan\":false,\"maandlimiet\":2}' where sleutel='ai' returning 1"); ok(r == '1', 'medewerker wijzigt instellingen', r)

    # --- AI-teller ---
    r = als('authenticated', S, "select public.ai_gebruik_tellen()"); ok('FOUT' in r, 'ingelogde gebruiker kan de AI-teller niet aanroepen', r)
    r = als('service_role', None, "select public.ai_gebruik_tellen()"); ok(r == 'f', 'AI uit: geen analyse toegestaan', r)
    admin("update public.instellingen set waarde='{\"aan\":true,\"maandlimiet\":2}' where sleutel='ai'")
    r = [als('service_role', None, "select public.ai_gebruik_tellen()") for _ in range(3)]; ok(r == ['t', 't', 'f'], 'AI aan: maandlimiet van 2 wordt afgedwongen', r)
    r = als('authenticated', S, "select aantal from public.ai_gebruik"); ok(r == '2', 'medewerker ziet het AI-gebruik van deze maand', r)
    r = als('authenticated', K, "select count(*) from public.ai_gebruik"); ok(r == '0', 'kandidaat ziet het AI-gebruik niet', r)

    # --- opslag ---
    r = als('authenticated', K, "select public.opslag_overzicht(6)"); ok('FOUT' in r, 'kandidaat mag het opslagoverzicht niet zien', r)
    r = als('authenticated', S, "select public.opslag_overzicht(6)"); j = json.loads(r) if r.startswith('{') else {}
    ok(j.get('weg_fotos') == 1 and j.get('weg_kandidaten') == 1 and j.get('fotos_aantal') == 2, 'opslagoverzicht telt 1 foto van 1 lang geslaagde kandidaat', r)
    r = als('authenticated', S, "select public.opslag_overzicht(12)"); ok(json.loads(r).get('weg_fotos') == 0, 'bij 12 maanden valt er nog niets weg', r)
    r = als('authenticated', K, "select public.opslag_opruimen(6)"); ok('FOUT' in r, 'kandidaat mag niet opruimen', r)
    r = als('authenticated', S, "select public.opslag_opruimen(0)"); ok('FOUT' in r, 'termijn van 0 maanden wordt geweigerd', r)
    r = als('authenticated', S, "select public.opslag_opruimen(6)"); ok(json.loads(r) == {'fotos': 1, 'cbr': 0}, 'opruimen wist alleen de foto van de lang geslaagde kandidaat', r)
    r = admin("select string_agg(id,',') from public.fotos"); ok(r == 'foto-k1', 'foto van de actieve kandidaat blijft staan', r)
    r = admin(f"select count(*) from public.casussen where kandidaat_id='{kg}'"); ok(r == '1', 'casus van de geslaagde kandidaat blijft staan', r)

    r = als('authenticated', S, f"select public.lid_verwijderen('{kg}')"); ok('FOUT' not in r, 'medewerker verwijdert een geslaagde kandidaat', r)
    psql(f'drop database if exists {DB}', 'postgres')
    print(f'{sum(uit)}/{len(uit)} geslaagd')
    sys.exit(0 if all(uit) else 1)

if __name__ == '__main__':
    main()

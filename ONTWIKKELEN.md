# Ontwikkelen

Voor wie de site aanpast. Je hebt Python 3 nodig; voor de tests ook Node, PostgreSQL (alleen `psql` en een lokale server) en Playwright.

## Een wijziging maken

1. Pas de bestanden in `src/` aan. Nooit de gebouwde pagina's (`index.html`, `amsterdam/index.html`, …): die worden overschreven.
2. Bouw: `python3 bouw.py`
3. Test: `python3 tests/browser_test.py` en, als je SQL hebt aangepast, `python3 tests/database_test.py`
4. Commit **de bron én de gebouwde pagina's** en push naar `main`. GitHub Pages zet de site binnen een paar minuten online.

GitHub controleert bij elke push automatisch of de pagina's bij de bron horen en of de tests slagen (`.github/workflows/controle.yml`).

## Hoe de bron werkt

- `src/pagina.html` is het geraamte. De rest wordt ingevoegd:
  - `//#include pad` op een eigen regel voegt `src/pad` in;
  - `{{bestand:pad}}` midden in een regel voegt een (groot) gegevensbestand in.
- `src/stijl.css`: alle opmaak.
- `src/app/NN-naam.js`: de app, in de volgorde waarin de bestanden worden ingevoegd. Samen vormen ze één script; functies uit het ene bestand zijn in het andere te gebruiken.
- `src/kaartdata/`: water en straten per ingebouwd vaargebied. `src/logo.js`: het logo.

### Varianten

Uit dezelfde bron komen vijf pagina's. Verschillen staan tussen aanwijzingen:

```
//#if amsterdam,portaal
…alleen voor deze varianten…
//#elif groningen
…
//#else
…
//#endif
```

| Variant | Uitvoer | Wat |
| --- | --- | --- |
| `portaal` | `index.html` | Startpagina (kaart van Amsterdam) |
| `amsterdam` | `amsterdam/index.html` | |
| `groningen` | `groningen/index.html` | |
| `utrecht` | `utrecht/index.html` | |
| `gebied` | `404.html` | Algemene pagina voor gebieden die medewerkers zelf toevoegen; laadt het gebied uit de database |

### Schakelaars

| Waar | Wat |
| --- | --- |
| Pagina Instellingen (tabel `instellingen`) | Privacyverklaring zichtbaar, AI-conceptfeedback aan/uit en maandlimiet, opruimtermijn |
| `LEER_LIVE`, `LEER_GATE`, `TRAJECT_KANDIDAAT`, `TRAJECT_LM` in `src/app/` | Vaste schakelaars in de code |

## Database

- Nieuw project: voer `supabase/setup.sql` uit in de SQL Editor en daarna elk bestand in `supabase/updates/` met nummer **020 of hoger**, op volgorde. (002–019 zitten al in `setup.sql` en staan er alleen bij als naslag.)
- Bestaand project: voer alleen de updates uit die er nog niet in staan. Elk script is veilig om opnieuw uit te voeren.
- Een nieuwe update: maak `supabase/updates/NNN_naam.sql`, schrijf hem zo dat opnieuw uitvoeren geen kwaad kan, en voeg een controle toe in `tests/database_test.py`.
- De site blijft werken als een update nog niet is uitgevoerd: het betreffende onderdeel toont dan een melding.

### Edge Functions

Broncode in `supabase/functions/`. Uitrollen kan met de Supabase CLI (`supabase functions deploy <naam>`) of via het dashboard.

| Functie | Secrets (alleen namen) |
| --- | --- |
| `feedback-mail` | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, optioneel `SMTP_PORT`, `SMTP_FROM` |
| `ai-feedback` | `ANTHROPIC_API_KEY`, optioneel `AI_MODEL` |

`SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` zijn in elke Edge Function vanzelf aanwezig.

AI kost alleen geld als de schakelaar bij Instellingen aan staat, de sleutel is ingesteld en de maandlimiet niet is bereikt. De functie controleert dat zelf.

## Tests

```
# database-scripts op een lokale, lege Postgres (maakt en verwijdert de database sor_test)
PGHOST=localhost PGUSER=postgres PGPASSWORD=… python3 tests/database_test.py

# de site in een echte browser, met een nagebootste Supabase (er gaat niets naar de echte database)
pip install playwright && playwright install chromium
python3 tests/browser_test.py            # alles
python3 tests/browser_test.py staff ai   # alleen deze scenario's
SHOTS=/tmp/shots python3 tests/browser_test.py   # ook schermafbeeldingen bewaren
```

Gebruik in tests en voorbeelden nooit echte gegevens van kandidaten.

## Naar een eigen server

De site is statisch: zet de repo-inhoud (zonder `.git`, `src/`, `tests/`, `supabase/`) op de server. Voorbeelden van de serverinstellingen staan in `.htaccess` (Apache), `web.config` (IIS) en `server/nginx.conf`. Een adres `/<gebied>/` dat niet als map bestaat moet `404.html` laden.
Verhuist de database naar een ander Supabase-project, pas dan `SB_URL` en `SB_KEY` aan in `src/app/` en bouw opnieuw.

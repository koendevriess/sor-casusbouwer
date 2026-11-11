# Flagship Academy Leeromgeving

Website van Flagship Academy voor schippers in opleiding:

- **Leeromgeving SOR**: theorie met quizzen en eindtoets, het traject met deadlines, en uitlegfilmpjes.
- **Casusbouwer**: kandidaten maken stap voor stap hun casus voor praktijktoets 3 (Schipper Open Rondvaartboot) op de waterkaart, met feedback van de opleider en een PDF om in te leveren.
- **Interne training**: Schipper KVB – Basic Training.
- **Voor medewerkers en leermeesters**: kandidaten, examengroepen, voortgang, sjablonen, vaargebieden, hulpmiddelen en instellingen.

Vaargebieden: Amsterdam, Groningen en Utrecht zijn ingebouwd. Medewerkers kunnen in de site zelf extra gebieden toevoegen.

## Hoe het in elkaar zit

| Onderdeel | Waar |
| --- | --- |
| Website (statisch) | GitHub Pages, vanuit de branch `main` |
| Inloggen en gegevens | Supabase (database in de EU), met toegangsregels per rol |
| Mail en AI | Supabase Edge Functions `feedback-mail` en `ai-feedback` |

In de site staan alleen het adres van het Supabase-project en de publieke sleutel. Geheime sleutels staan uitsluitend in Supabase (Edge Functions → Secrets) en horen nooit in deze repo.

## Mappen

| Pad | Inhoud |
| --- | --- |
| `src/` | **De broncode.** Hier pas je de site aan. |
| `bouw.py` | Bouwt de vijf pagina's uit `src/` |
| `index.html`, `amsterdam/`, `groningen/`, `utrecht/`, `404.html` | De gebouwde pagina's (niet met de hand aanpassen) |
| `assets/` | Bibliotheken, lettertype, CVO's, theorie-afbeeldingen, trainingsmateriaal en filmpjes |
| `supabase/setup.sql` | Database-opzet voor een leeg project (t/m update 019) |
| `supabase/updates/` | Database-updates op volgorde; 020 en hoger komen na `setup.sql` |
| `supabase/functions/` | Broncode van de Edge Functions |
| `tests/` | Automatische tests van de database-scripts en van de site |
| `server/`, `.htaccess`, `web.config` | Instellingen voor nginx, Apache en IIS (voor een eigen server) |

Hoe je een wijziging maakt, test en online zet staat in **[ONTWIKKELEN.md](ONTWIKKELEN.md)**.

## Beheer in het kort

- **Kandidaat, leermeester of medewerker toevoegen**: menu Kandidaten. Geef de uitnodigingscode door; daarmee maakt iemand zelf een account.
- **Wachtwoord vergeten**: ⋯ → Nieuwe code. Het oude account vervalt, de casus blijft bewaard.
- **Geslaagd**: ⋯ → Markeren als geslaagd. De kandidaat ziet dan alleen nog een felicitatiescherm en kan de casus downloaden.
- **Examengroepen**: groepen per vaargebied, met leermeesters die de hele groep zien.
- **Instellingen**: privacyverklaring invullen en zichtbaar maken, AI-conceptfeedback aan of uit (met maandlimiet), opslag opruimen en een back-up downloaden.
- **Supabase**: onder Authentication → Sign In / Providers → Email moet *Confirm email* uit staan. Het gratis plan pauzeert een project na een week zonder gebruik; zet het dan in het dashboard weer aan.

Kaartgegevens: © OpenStreetMap-bijdragers (ODbL).

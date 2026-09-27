# SOR Casusbouwer · Flagship Academy

Website waarmee kandidaten van de opleiding Schipper Open Rondvaartboot (SOR) stap voor stap hun casus voor praktijktoets 3 maken: route op de waterkaart van Amsterdam, alle opdrachten, feedback van de opleider en een PDF om in te leveren.

## Hoe het werkt

- **Website:** `index.html`, gehost met GitHub Pages. De kaartgegevens (© OpenStreetMap-bijdragers, ODbL) zitten in de pagina zelf.
- **Inloggen en opslag:** Supabase (project in de EU, regio Ierland). Kandidaten en medewerkers loggen in met e-mail en wachtwoord en koppelen hun account één keer met een uitnodigingscode.
- **Database-opzet:** `supabase/setup.sql` bevat de tabellen, toegangsregels (row level security) en functies. Dit script is al uitgevoerd in Supabase; bewaar het als documentatie.

## Beheer

- Medewerkers voegen kandidaten en collega's toe via **Kandidaat toevoegen** / **Medewerker toevoegen** in het overzicht en geven de code door.
- **Wachtwoord vergeten:** klik op *Nieuwe code*. Het oude account vervalt, de casus blijft bewaard.
- **Na het examen:** klik op *Verwijderen*. Dat wist de casus, feedback, foto's en het account.
- Toegang is alleen mogelijk met een uitnodigingscode. Feedback mailen gaat via de knop *Feedback mailen*; die opent een e-mail aan de kandidaat in het mailprogramma van de medewerker.
- In Supabase moet onder Authentication → Sign In / Providers → Email de optie **Confirm email** uit staan (de ingebouwde mail van Supabase stuurt geen mail naar kandidaten).
- Het gratis Supabase-plan pauzeert een project na een week zonder gebruik. Zet het dan in het Supabase-dashboard weer aan; de gegevens blijven bewaard.

## Bestanden

| Pad | Inhoud |
| --- | --- |
| `index.html` | De volledige app |
| `assets/` | Leaflet 1.9.4, jsPDF 2.5.1, supabase-js 2.117.2, lettertype Atkinson Hyperlegible, icoon |
| `supabase/setup.sql` | Database-opzet |

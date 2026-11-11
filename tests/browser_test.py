#!/usr/bin/env python3
"""Browsertest van de gebouwde site, met een nagebootste Supabase (er gaat niets naar de echte database).

Gebruik:  python3 tests/browser_test.py            (alles)
          python3 tests/browser_test.py staff ai   (alleen scenario's waarvan de naam hiermee begint)
Nodig:    pip install playwright && playwright install chromium
"""
import asyncio, base64, json, os, re, subprocess, sys, time
from urllib.parse import unquote, urlparse, parse_qsl
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8765
BASE = f'http://127.0.0.1:{PORT}'
SB = re.search(r"const SB_URL='([^']+)'", open(os.path.join(ROOT, 'amsterdam/index.html'), encoding='utf-8').read()).group(1)
SHOTS = os.environ.get('SHOTS')            # map voor schermafbeeldingen (optioneel)

uit = []
def ok(c, label, info=''):
    uit.append((bool(c), label)); print(('PASS ' if c else 'FAIL ') + label + ('' if c else '  -> ' + str(info)[:300]), flush=True)

b64 = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip('=')
def sessie(uid):
    jwt = b64({'alg': 'HS256', 'typ': 'JWT'}) + '.' + b64({'sub': uid, 'exp': int(time.time()) + 7200, 'role': 'authenticated', 'aud': 'authenticated', 'email': 'test@test.nl'}) + '.sig'
    user = {'id': uid, 'email': 'test@test.nl', 'aud': 'authenticated', 'role': 'authenticated'}
    return user, {'access_token': jwt, 'refresh_token': 'r', 'expires_in': 7200, 'expires_at': int(time.time()) + 7200, 'token_type': 'bearer', 'user': user}

G = '99999999-9999-4999-8999-999999999999'
def lid(i, naam, rol, stad='amsterdam', uid=None, status='bezig', **kw):
    r = {'id': i, 'naam': naam, 'rol': rol, 'user_id': uid, 'email': None, 'status': status, 'stad': stad, 'groep_id': None, 'code': None,
         'aangemaakt': '2026-10-01T10:00:00Z', 'gekoppeld_op': None, 'ingeleverd_op': None, 'geslaagd_op': '2026-10-29T10:00:00Z' if status == 'geslaagd' else None,
         'casus_vrij': False, 'examen_op': None, 'generale_op': None, 'vrij_nodig': True, 'vrij_verstuurd_op': None, 'vrij_geupload_op': None,
         'vrij_geregistreerd_op': None, 'stappen': {}, 'sjabloon_id': None, 'trainingen': ['sor'], 'casussen': [], 'feedback': [], 'theorie': []}
    r.update(kw); return r

INST_UIT = [{'sleutel': 'privacy', 'waarde': {'gepubliceerd': False}}, {'sleutel': 'ai', 'waarde': {'aan': False, 'maandlimiet': 100}}, {'sleutel': 'opslag', 'waarde': {'maanden': 6}}]
PRIVACY_VOL = {'gepubliceerd': True, 'datum': '2026-11-11', 'adres': 'Teststraat 1, 1000 AA Amsterdam', 'kvk': '12345678', 'email': 'privacy@test.nl',
               'hosting': 'Testhost', 'maildienst': 'Testmail', 'termijn': '12 maanden', 'verwerker': 'is'}

class Nep:
    """Nagebootste Supabase: tabellen in het geheugen, eenvoudige filters (kolom=eq.waarde), en een logboek van schrijfacties."""
    def __init__(self, wie=None, tabellen=None, ontbreekt=(), rpc=None, functies=None):
        self.wie = wie; self.t = tabellen or {}; self.ontbreekt = set(ontbreekt); self.rpc = rpc or {}; self.functies = functies or {}
        self.schrijf = []; self.rpcs = []; self.fn = []
        self.user, self.sessie = sessie(wie['user_id']) if wie else (None, None)

    async def route(self, route):
        req = route.request; u = urlparse(req.url); pad = u.path; q = dict(parse_qsl(unquote(u.query)))
        obj = 'vnd.pgrst.object' in (req.headers.get('accept') or '')
        if pad.startswith('/auth/v1/user'): return await route.fulfill(json=self.user) if self.user else await route.fulfill(status=401, json={'msg': 'geen sessie'})
        if pad.startswith('/auth/v1/token'): return await route.fulfill(json=self.sessie)
        if pad.startswith('/auth/v1/'): return await route.fulfill(json={})
        if pad.startswith('/functions/v1/'):
            naam = pad.split('/')[-1]; body = json.loads(req.post_data or '{}'); self.fn.append((naam, body))
            f = self.functies.get(naam)
            if not f: return await route.fulfill(status=404, json={'error': 'bestaat niet'})
            status, antw = f(body); return await route.fulfill(status=status, json=antw)
        if pad.startswith('/rest/v1/rpc/'):
            naam = pad.split('/')[-1]; body = json.loads(req.post_data or '{}'); self.rpcs.append((naam, body))
            f = self.rpc.get(naam); return await route.fulfill(json=f(body) if f else None)
        if pad.startswith('/rest/v1/'):
            tabel = pad.split('/')[-1]
            if tabel in self.ontbreekt:
                return await route.fulfill(status=404, json={'code': 'PGRST205', 'message': f"Could not find the table 'public.{tabel}' in the schema cache"})
            rijen = self.t.setdefault(tabel, [])
            if req.method == 'GET':
                r = [x for x in rijen if all(str(x.get(k)) == v[3:] for k, v in q.items() if v.startswith('eq.') and k in x)]
                if 'range' in req.headers:
                    a, b = req.headers['range'].split('-'); r = r[int(a):int(b) + 1]
                return await route.fulfill(json=(r[0] if r else None) if obj else r)
            body = json.loads(req.post_data or 'null'); self.schrijf.append((req.method, tabel, body, q))
            if req.method == 'POST' and isinstance(body, dict):
                sleutel = next((k for k in ('sleutel', 'kandidaat_id', 'id') if k in body), None)
                oud = next((x for x in rijen if sleutel and x.get(sleutel) == body.get(sleutel)), None)
                if oud: oud.update(body)
                else: rijen.append(body)
            if req.method == 'PATCH' and isinstance(body, dict):
                for x in rijen:
                    if all(str(x.get(k)) == v[3:] for k, v in q.items() if v.startswith('eq.') and k in x): x.update(body)
            return await route.fulfill(json=body if obj else [body] if isinstance(body, dict) else [])
        return await route.abort()

async def open_pagina(pw, nep, pad='/amsterdam/', breed=1280, hoog=850, wacht=3200):
    b = await pw.chromium.launch(); ctx = await b.new_context(accept_downloads=True, viewport={'width': breed, 'height': hoog}); pg = await ctx.new_page()
    if nep.sessie: await pg.add_init_script("localStorage.setItem('sor-casusbouwer-auth'," + json.dumps(json.dumps(nep.sessie)) + ")")
    await pg.route(SB + '/**', nep.route)
    pg.fouten = []; pg.on('pageerror', lambda e: pg.fouten.append(str(e)))
    await pg.goto(BASE + pad); await pg.wait_for_timeout(wacht)
    return b, ctx, pg

async def foto(pg, naam):
    if SHOTS: os.makedirs(SHOTS, exist_ok=True); await pg.screenshot(path=os.path.join(SHOTS, naam + '.jpg'), type='jpeg', quality=75, full_page=True)

UID_K = '11111111-1111-4111-8111-111111111111'; UID_S = 'aaaaaaaa-0000-4000-8000-000000000001'; UID_L = 'aaaaaaaa-0000-4000-8000-000000000002'
CASUS = {'kandidaat_id': 'k1', 'casus': {'kandidaat': {'naam': 'Voorbeeld Kandidaat'}, 'opstap': 'Seapalace'}, 'voortgang': 40, 'rev': 'x', 'bijgewerkt': '2026-10-01T10:00:00Z'}

# ---------------------------------------------------------------- scenario's
async def inlog_privacy(pw):
    for vol in (False, True):
        nep = Nep(tabellen={'instellingen': [{'sleutel': 'privacy', 'waarde': PRIVACY_VOL if vol else {'gepubliceerd': False}}]})
        b, ctx, pg = await open_pagina(pw, nep)
        ok(await pg.locator('#loginForm').count() == 1, f'inlogpagina verschijnt (privacy {"aan" if vol else "uit"})')
        n = await pg.locator('[data-lact="privacy"]').count()
        ok(n == (1 if vol else 0), f'link naar privacyverklaring {"zichtbaar" if vol else "verborgen"}', n)
        if vol:
            await pg.click('[data-lact="privacy"]'); await pg.wait_for_timeout(300); t = await pg.inner_text('#modalBody')
            ok('[' not in t and 'Teststraat 1' in t and '11 november 2026' in t and 'privacy@test.nl' in t, 'privacyverklaring toont de ingevulde gegevens, zonder lege plekken', t[:200])
            ok('AI' not in t, 'privacyverklaring noemt AI niet zolang AI uit staat')
            await foto(pg, 'privacy')
        ok('Flagship Academy Leeromgeving' in await pg.title(), 'paginatitel is Flagship Academy Leeromgeving', await pg.title())
        ok(not pg.fouten, 'inlogpagina: geen JavaScript-fouten', pg.fouten[:2]); await b.close()
    nep = Nep(ontbreekt=['instellingen']); b, ctx, pg = await open_pagina(pw, nep)
    ok(await pg.locator('#loginForm').count() == 1 and await pg.locator('[data-lact="privacy"]').count() == 0 and not pg.fouten, 'zonder database-update 022: inlogpagina werkt, geen privacylink', pg.fouten[:2]); await b.close()

async def kandidaat(pw):
    gevallen = [('bezig', 'amsterdam', ['sor'], '/', 2, 1), ('bezig', 'amsterdam', ['kvb'], '/amsterdam/', 0, 1), ('bezig', 'groningen', ['sor'], '/groningen/', 2, 0)]
    for status, stad, tr, pad, nvideo, ncvo in gevallen:
        me = lid('k1', 'Voorbeeld Kandidaat', 'kandidaat', stad=stad, uid=UID_K, status=status, trainingen=tr)
        nep = Nep(me, {'leden': [me], 'casussen': [dict(CASUS)], 'instellingen': [dict(x) for x in INST_UIT]})
        b, ctx, pg = await open_pagina(pw, nep, pad); lab = f'kandidaat {stad}/{"+".join(tr)}'
        v = await pg.locator('#leer [data-top^="video-"]').count(); c = await pg.locator('#leer [data-top="cvo"]').count()
        ok(v == nvideo, f'{lab}: {nvideo} filmpjes in de leeromgeving', v); ok(c == ncvo, f'{lab}: CVO-tegel {"zichtbaar" if ncvo else "niet zichtbaar"}', c)
        ok(await pg.locator('#snav button').count() == 0, f'{lab}: geen medewerkersmenu')
        if nvideo and stad == 'amsterdam':
            await pg.click('#leer [data-top="video-sor"]'); await pg.wait_for_timeout(600)
            src = await pg.get_attribute('#modalBody video', 'src')
            r = await pg.request.get(BASE + '/' + src.replace('../', '').lstrip('/'))
            ok(src.endswith('assets/video/sor-traject.mp4') and r.status in (200, 206) and len(await r.body()) > 1_000_000, f'{lab}: filmpje opent en het bestand bestaat', (src, r.status))
            await foto(pg, 'kandidaat_video'); await pg.click('#modalYes'); await pg.wait_for_timeout(200)
            ok(await pg.locator('#modalBody video').count() == 0, f'{lab}: filmpje stopt na sluiten')
            await foto(pg, 'kandidaat_start')
        if ncvo and tr == ['sor']:
            await pg.click('#leer [data-top="cvo"]'); await pg.wait_for_timeout(500)
            ok(await pg.locator('#modalBody .cvo-r').count() >= 20, f'{lab}: CVO-lijst met schepen')
            async with pg.expect_download(timeout=30000) as dl: await pg.locator('#modalBody [data-cvo="p2"]').first.click()
            ok((await dl.value).suggested_filename.endswith('.pdf'), f'{lab}: CVO pagina 2 downloaden'); await pg.click('#modalYes')
        ok(not pg.fouten, f'{lab}: geen JavaScript-fouten', pg.fouten[:2]); await b.close()

async def geslaagd(pw):
    for stad, ncvo in (('amsterdam', 1), ('groningen', 0)):
        me = lid('k1', 'Voorbeeld Kandidaat', 'kandidaat', stad=stad, uid=UID_K, status='geslaagd')
        nep = Nep(me, {'leden': [me], 'casussen': [dict(CASUS)], 'instellingen': [dict(x) for x in INST_UIT]})
        b, ctx, pg = await open_pagina(pw, nep, '/'); t = await pg.inner_text('body'); lab = f'geslaagd {stad}'
        ok('Gefeliciteerd, Voorbeeld' in t and await pg.locator('#leer:visible').count() == 0, f'{lab}: alleen het felicitatiescherm')
        ok(not any(m == 'GET' for m, *_ in nep.schrijf) and 'theorie' not in nep.t, f'{lab}: theorie wordt niet geladen')
        ok(await pg.locator('#screen [data-top="cvo"]').count() == ncvo, f'{lab}: CVO-knop {"zichtbaar" if ncvo else "niet zichtbaar"}')
        async with pg.expect_download(timeout=60000) as dl: await pg.click('[data-geslaagd="pdf"]')
        ok((await dl.value).suggested_filename.endswith('.pdf'), f'{lab}: casus als PDF downloaden')
        if ncvo:
            await pg.click('#screen [data-top="cvo"]'); await pg.wait_for_timeout(500)
            ok(await pg.locator('#modalBody .cvo-r').count() >= 20, f'{lab}: CVO-lijst opent vanaf het felicitatiescherm'); await pg.click('#modalYes'); await foto(pg, 'geslaagd')
        for st in ({'k': 'leer'}, {'k': 'edit', 'id': 'k1', 'step': 'route'}):
            await pg.evaluate("s=>window.dispatchEvent(new PopStateEvent('popstate',{state:s}))", st); await pg.wait_for_timeout(500)
        ok('Gefeliciteerd' in await pg.inner_text('#screen') and await pg.locator('#leer:visible').count() == 0, f'{lab}: terugknop of oude link opent niets anders')
        ok(not pg.fouten, f'{lab}: geen JavaScript-fouten', pg.fouten[:2]); await b.close()

def staf_tabellen(inst=None, ai_concept=None):
    me = lid('m1', 'Medewerker Test', 'medewerker', uid=UID_S)
    ks = [lid('k1', 'Voorbeeld Amsterdam', 'kandidaat', groep_id=G, status='ingeleverd', casussen=[{'voortgang': 80, 'bijgewerkt': '2026-11-01T10:00:00Z'}]),
          lid('k2', 'Voorbeeld Tweede', 'kandidaat'), lid('k3', 'Voorbeeld Groningen', 'kandidaat', stad='groningen')]
    lms = [lid('l1', 'Lm Een', 'leermeester', uid=UID_L), lid('l2', 'Lm Twee', 'leermeester')]
    t = {'leden': [me] + lms + ks, 'groepen': [{'id': G, 'naam': 'Examen november', 'stad': 'amsterdam', 'examen_op': '2026-11-20', 'generale_op': None, 'aangemaakt': '2026-10-01T10:00:00Z', 'sjabloon_id': None}],
         'gebieden': [{'slug': s, 'naam': s.capitalize(), 'actief': True, 'ingebouwd': True, 'volgorde': i, 'instellingen': {}, 'traject': {}} for i, s in enumerate(['amsterdam', 'groningen', 'utrecht'])],
         'instellingen': [dict(x) for x in (inst or INST_UIT)], 'casussen': [dict(CASUS)], 'leermeester_groep': [], 'ai_voorbeeld': [{'kandidaat_id': 'k2'}],
         'ai_gebruik': [{'maand': time.strftime('%Y-%m-01'), 'aantal': 7}], 'ai_concept': ai_concept or []}
    return me, t

OPSLAG = {'database': 22 * 1048576, 'fotos': 4 * 1048576, 'fotos_aantal': 24, 'cbr': 2 * 1048576, 'cbr_aantal': 3, 'kandidaten': 22, 'geslaagd': 10,
          'weg_kandidaten': 2, 'weg_fotos': 5, 'weg_cbr': 1, 'weg_bytes': 1500000}

async def staff(pw):
    me, t = staf_tabellen()
    nep = Nep(me, t, rpc={'opslag_overzicht': lambda b: OPSLAG, 'opslag_opruimen': lambda b: {'fotos': 5, 'cbr': 1}, 'groep_leermeesters_zetten': lambda b: len(b['p_lms'])},
              functies={'ai-feedback': lambda b: (200, {'sleutel': False, 'aan': False}) if b.get('status') else (503, {'error': 'uitgeschakeld'})})
    b, ctx, pg = await open_pagina(pw, nep)
    menu = await pg.inner_text('#snav')
    ok(all(x in menu for x in ['Kandidaten', 'Examengroepen', 'Voortgang', 'Leeromgeving', 'Vaargebieden', 'Hulpmiddelen', 'Instellingen']), 'medewerker: menu compleet, met Instellingen', menu)
    ok('Flagship Academy' in await pg.inner_text('.brand-t') and 'Leeromgeving en casusbouwer' in await pg.inner_text('.brand-t'), 'bovenbalk toont de nieuwe naam')
    ok('AI-concept' not in await pg.inner_text('#dash'), 'AI uit: geen AI-labels in het overzicht')
    await foto(pg, 'staff_kandidaten')
    # alle menu-items openen zonder fouten
    for a in ['groepen', 'voortgang', 'leeromgeving', 'gebied', 'hulp', 'instellingen', 'kandidaten']:
        await pg.click(f'#snav [data-top="{a}"]'); await pg.wait_for_timeout(400)
        ok(len(await pg.inner_text('#dash')) > 80 and not pg.fouten, f'medewerker: pagina {a} opent', pg.fouten[:1])
    # examengroepen
    await pg.click('#snav [data-top="groepen"]'); await pg.wait_for_timeout(300)
    await pg.click('[data-dact="groep-lm"]'); await pg.wait_for_timeout(300)
    await pg.locator('#modalBody .kopt input').first.check(); await pg.click('#modalYes'); await pg.wait_for_timeout(600)
    ok(('groep_leermeesters_zetten', {'p_groep': G, 'p_lms': ['l1']}) in nep.rpcs, 'examengroep: leermeester in één keer koppelen', nep.rpcs[-2:])
    # hulpmiddelen: filmpjes
    await pg.click('#snav [data-top="hulp"]'); await pg.wait_for_timeout(300)
    ok(await pg.locator('#dash [data-top^="video-"]').count() == 2, 'hulpmiddelen: beide filmpjes staan erbij')
    # instellingen
    await pg.click('#snav [data-top="instellingen"]'); await pg.wait_for_timeout(1200); d = await pg.inner_text('#dash')
    ok('Nog niet compleet' in d and 'Nog invullen' in d, 'instellingen: privacy staat als nog niet compleet')
    ok('Nog niet ingesteld' in d and '7 van 100' in d and 'Voorbeeld Tweede' in d, 'instellingen: AI toont sleutelstatus, gebruik en voorbeeldcasus', d[d.find('AI-concept'):][:400])
    ok('22 MB' in d and '5 foto’s en 1 CBR-bevestiging van 2 kandidaten' in d, 'instellingen: opslagoverzicht', d[d.find('Opslag'):][:300])
    await foto(pg, 'staff_instellingen')
    # privacy: onvolledig opslaan met vinkje -> niet zichtbaar
    await pg.fill('#pv_adres', 'Teststraat 1'); await pg.check('#instPvForm [name=gepubliceerd]'); await pg.click('#instPvForm button[type=submit]'); await pg.wait_for_timeout(500)
    w = next(x[2]['waarde'] for x in reversed(nep.schrijf) if x[1] == 'instellingen')
    ok(w['adres'] == 'Teststraat 1' and w['gepubliceerd'] is False, 'privacy: onvolledig kan niet zichtbaar worden gemaakt', w)
    for k, v in PRIVACY_VOL.items():
        if k not in ('gepubliceerd', 'verwerker'): await pg.fill('#pv_' + k, v)
    await pg.click('[data-inst="pv-voorbeeld"]'); await pg.wait_for_timeout(300); t2 = await pg.inner_text('#modalBody')
    ok('Testhost' in t2 and '[' not in t2, 'privacy: voorbeeld toont de ingevulde tekst', t2[:120]); await pg.click('#modalYes')
    await pg.check('#instPvForm [name=gepubliceerd]'); await pg.click('#instPvForm button[type=submit]'); await pg.wait_for_timeout(500)
    w = next(x[2]['waarde'] for x in reversed(nep.schrijf) if x[1] == 'instellingen')
    ok(w['gepubliceerd'] is True and w['kvk'] == '12345678' and 'Zichtbaar voor kandidaten' in await pg.inner_text('#instPrivacy'), 'privacy: compleet ingevuld en zichtbaar gemaakt', w)
    # AI aanzetten vraagt bevestiging
    await pg.check('#instAiForm [name=aan]'); await pg.fill('#ai_lim', '50'); await pg.click('#instAiForm button[type=submit]'); await pg.wait_for_timeout(300)
    ok('kost geld' in await pg.inner_text('#modal'), 'AI aanzetten: eerst een bevestiging over de kosten'); await pg.click('#modalNo'); await pg.wait_for_timeout(300)
    ok(not any(x[1] == 'instellingen' and x[2].get('sleutel') == 'ai' for x in nep.schrijf), 'AI aanzetten geannuleerd: niets opgeslagen')
    await pg.check('#instAiForm [name=aan]'); await pg.fill('#ai_lim', '50'); await pg.click('#instAiForm button[type=submit]'); await pg.wait_for_timeout(300); await pg.click('#modalYes'); await pg.wait_for_timeout(500)
    w = next(x[2]['waarde'] for x in reversed(nep.schrijf) if x[1] == 'instellingen' and x[2].get('sleutel') == 'ai')
    ok(w == {'aan': True, 'maandlimiet': 50}, 'AI aanzetten bevestigd: schakelaar en limiet opgeslagen', w)
    # opruimen
    await pg.click('[data-inst="opruimen"]'); await pg.wait_for_timeout(300)
    ok('niet ongedaan' in await pg.inner_text('#modal'), 'opruimen: bevestiging met waarschuwing'); await pg.click('#modalYes'); await pg.wait_for_timeout(600)
    ok(('opslag_opruimen', {'p_maanden': 6}) in nep.rpcs, 'opruimen: wist via de database-functie', nep.rpcs[-2:])
    # back-up
    async with pg.expect_download(timeout=30000) as dl: await pg.click('[data-inst="backup"]')
    d = await dl.value; p = await d.path(); j = json.load(open(p, encoding='utf-8'))
    ok(d.suggested_filename.startswith('flagship-academy-backup-') and len(j['tabellen']['leden']) == 6 and 'casussen' in j['tabellen'] and 'instellingen' in j['tabellen'], 'back-up: bestand met alle tabellen', list(j['tabellen'])[:5])
    # geen internet
    await ctx.set_offline(True); await pg.evaluate("window.dispatchEvent(new Event('offline'))"); await pg.wait_for_timeout(200)
    ok(await pg.locator('.offbar:visible').count() == 1, 'geen internet: melding bovenaan')
    await ctx.set_offline(False); await pg.evaluate("window.dispatchEvent(new Event('online'))"); await pg.wait_for_timeout(200)
    ok(await pg.locator('.offbar:visible').count() == 0, 'weer online: melding weg')
    # terugknop naar instellingen
    await pg.click('#snav [data-top="kandidaten"]'); await pg.wait_for_timeout(300); await pg.go_back(); await pg.wait_for_timeout(600)
    ok('Instellingen' in await pg.inner_text('#dash h1'), 'terugknop van de browser gaat terug naar Instellingen', await pg.inner_text('#dash h1'))
    ok(not pg.fouten, 'medewerker: geen JavaScript-fouten', pg.fouten[:2]); await b.close()

async def staff_zonder_022(pw):
    me, t = staf_tabellen(); del t['instellingen']; del t['ai_gebruik']
    nep = Nep(me, t, ontbreekt=['instellingen', 'ai_gebruik'])
    b, ctx, pg = await open_pagina(pw, nep)
    ok(len(await pg.inner_text('#dash')) > 200, 'zonder database-update 022: overzicht werkt gewoon')
    await pg.click('#snav [data-top="instellingen"]'); await pg.wait_for_timeout(600)
    ok('database-update 022' in await pg.inner_text('#dash'), 'zonder database-update 022: duidelijke melding op Instellingen')
    ok(not pg.fouten, 'zonder database-update 022: geen JavaScript-fouten', pg.fouten[:2]); await b.close()

async def staff_telefoon(pw):
    me, t = staf_tabellen()
    nep = Nep(me, t, rpc={'opslag_overzicht': lambda b: OPSLAG}); b, ctx, pg = await open_pagina(pw, nep, breed=390, hoog=844)
    for a in ['kandidaten', 'groepen', 'voortgang', 'leeromgeving', 'gebied', 'hulp', 'instellingen']:
        await pg.evaluate("a=>document.querySelector('#snav [data-top=\"'+a+'\"]').click()", a); await pg.wait_for_timeout(500)
        sw = await pg.evaluate('document.documentElement.scrollWidth'); ok(sw <= 392, f'telefoon: pagina {a} schuift niet zijwaarts ({sw}px)')
        await foto(pg, 'telefoon_' + a)
    ok(not pg.fouten, 'telefoon: geen JavaScript-fouten', pg.fouten[:2]); await b.close()

AI_CONCEPT = {'kandidaat_id': 'k1', 'status': 'klaar', 'algemeen': 'Nette casus, let op de bruggen.', 'voorbeelden': 3, 'model': 'nep', 'fout': None, 'reden': 'inleveren',
              'stappen': {'route': {'status': 'aanpassen', 'tekst': 'Je route duurt te kort: maak hem minstens 30 minuten.', 'zekerheid': 'hoog'},
                          'bruggen': {'status': 'ok', 'tekst': 'Alle bruggen zijn goed ingevuld.', 'zekerheid': 'middel'}},
              'controles': {}, 'afgehandeld': {}, 'casus_bijgewerkt': '2026-11-01T10:00:00Z', 'gestart': '2026-11-01T10:00:00Z', 'gemaakt': '2026-11-01T10:01:00Z'}

async def ai(pw):
    """AI-conceptfeedback met nagebootste antwoorden: er wordt nooit een echte AI aangeroepen."""
    inst = [dict(x) for x in INST_UIT]; inst[1] = {'sleutel': 'ai', 'waarde': {'aan': True, 'maandlimiet': 100}}
    me, t = staf_tabellen(inst, [dict(AI_CONCEPT)])
    t['casussen'][0]['bijgewerkt'] = '2026-11-01T10:00:00Z'
    nep = Nep(me, t, functies={'ai-feedback': lambda b: (200, {'sleutel': True, 'aan': True}) if b.get('status') else (202, {'ok': True, 'status': 'bezig'})})
    b, ctx, pg = await open_pagina(pw, nep)
    d = await pg.inner_text('#dash')
    ok('AI-concept' in d and 'Voorbeeldcasus' in d, 'AI aan: overzicht toont AI-concept en voorbeeldcasus', d[:200])
    await pg.locator('[data-dact="open"]').first.click(); await pg.wait_for_timeout(2500)
    await pg.evaluate("()=>{const b=document.querySelector('#steps [data-step=\"route\"]');if(b)b.click()}"); await pg.wait_for_timeout(600)
    p = await pg.inner_text('#panel')
    ok('Conceptfeedback' in p and 'Je route duurt te kort' in p, 'AI aan: concept staat bij de stap Route, alleen voor de medewerker', p[-400:])
    await foto(pg, 'ai_concept')
    await pg.click('[data-ai="over"][data-step-ai="route"]'); await pg.wait_for_timeout(600)
    ok(any(x[1] == 'ai_concept' and (x[2] or {}).get('afgehandeld', {}).get('route') == 'over' for x in nep.schrijf), 'AI: Overnemen legt vast dat het concept is overgenomen', nep.schrijf[-3:])
    ok('Je route duurt te kort' in (await pg.input_value('#panel textarea[data-fb]') if await pg.locator('#panel textarea[data-fb]').count() else await pg.inner_text('#panel')), 'AI: de tekst staat nu in de feedback van de medewerker')
    await pg.evaluate("()=>{const b=document.querySelector('#steps [data-step=\"controle\"]');if(b)b.click()}"); await pg.wait_for_timeout(600)
    await pg.click('[data-ai="nieuw"]'); await pg.wait_for_timeout(800)
    ok(any(n == 'ai-feedback' and bd.get('kandidaat_id') == 'k1' and bd.get('reden') == 'handmatig' for n, bd in nep.fn), 'AI: Concept vernieuwen roept de (nagebootste) functie aan', nep.fn[-2:])
    ok(not any('naam' in json.dumps(bd) and 'Voorbeeld Amsterdam' in json.dumps(bd) for n, bd in nep.fn), 'AI: de naam van de kandidaat gaat niet mee in de aanroep')
    ok(not pg.fouten, 'AI: geen JavaScript-fouten', pg.fouten[:2]); await b.close()
    # AI uit: kandidaat levert in -> geen aanroep
    me2 = lid('k1', 'Voorbeeld Kandidaat', 'kandidaat', uid=UID_K, status='ingeleverd')
    nep = Nep(me2, {'leden': [me2], 'casussen': [dict(CASUS)], 'instellingen': [dict(x) for x in INST_UIT]}); b, ctx, pg = await open_pagina(pw, nep)
    ok(await pg.evaluate("window.__casus && typeof window.__casus.app==='object'") and not nep.fn, 'AI uit: er wordt geen AI-functie aangeroepen', nep.fn); await b.close()

async def leermeester(pw):
    me, t = staf_tabellen(); lm = next(x for x in t['leden'] if x['id'] == 'l1'); t['leden'] = [lm, next(x for x in t['leden'] if x['id'] == 'k1')]
    t['leermeester_groep'] = [{'leermeester_id': 'l1', 'groep_id': G}]
    nep = Nep(lm, t); b, ctx, pg = await open_pagina(pw, nep); menu = await pg.inner_text('#snav')
    ok('Instellingen' not in menu and 'Examengroepen' not in menu and 'Kandidaten' in menu, 'leermeester: geen Instellingen of Examengroepen in het menu', menu)
    ok('gekoppeld aan de groep Examen november' in await pg.inner_text('#dash'), 'leermeester: ziet aan welke groep hij gekoppeld is')
    await pg.evaluate("window.dispatchEvent(new PopStateEvent('popstate',{state:{k:'dash',v:'instellingen'}}))"); await pg.wait_for_timeout(400)
    ok('Opslag' not in await pg.inner_text('#dash'), 'leermeester: kan Instellingen ook niet via een oude link openen')
    ok(not pg.fouten, 'leermeester: geen JavaScript-fouten', pg.fouten[:2]); await b.close()

async def paginas(pw):
    for pad in ['/', '/amsterdam/', '/groningen/', '/utrecht/']:
        nep = Nep(tabellen={'instellingen': []}); b, ctx, pg = await open_pagina(pw, nep, pad, wacht=2000)
        ok(await pg.locator('#loginForm').count() == 1 and not pg.fouten, f'pagina {pad} laadt zonder fouten', pg.fouten[:2]); await b.close()

SCENARIOS = [inlog_privacy, kandidaat, geslaagd, staff, staff_zonder_022, staff_telefoon, ai, leermeester, paginas]

async def main():
    kies = sys.argv[1:]
    srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1)
    try:
        async with async_playwright() as pw:
            for s in SCENARIOS:
                if kies and not any(s.__name__.startswith(k) for k in kies): continue
                print('---', s.__name__, flush=True)
                try: await s(pw)
                except Exception as e: ok(False, f'{s.__name__}: test liep vast', repr(e)[:300])
    finally:
        srv.terminate()
    goed = sum(1 for c, _ in uit if c); print(f'{goed}/{len(uit)} geslaagd')
    sys.exit(0 if goed == len(uit) and uit else 1)

if __name__ == '__main__':
    asyncio.run(main())

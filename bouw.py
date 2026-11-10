#!/usr/bin/env python3
"""Bouwt de website uit de bronbestanden in src/.

Gebruik:
  python3 bouw.py            bouwt de vijf pagina's opnieuw
  python3 bouw.py --controle bouwt niets, maar meldt of de pagina's nog gelijk zijn aan de bron
                             (gebruikt door de automatische controle op GitHub)

Hoe de bron werkt (zie ook ONTWIKKELEN.md):
  src/pagina.html            het geraamte van de pagina
  //#include pad             op een eigen regel: voegt src/pad hier in
  {{bestand:pad}}            midden in een regel: voegt src/pad hier in (voor grote gegevensbestanden)
  //#if a,b / //#elif c / //#else / //#endif
                             alleen voor de genoemde varianten. Varianten: zie VARIANTEN hieronder.
"""
import os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
# variant -> uitvoerbestand
VARIANTEN = {
    'portaal':   'index.html',            # startpagina (Amsterdam-kaart, keuze van vaargebied)
    'amsterdam': 'amsterdam/index.html',
    'groningen': 'groningen/index.html',
    'utrecht':   'utrecht/index.html',
    'gebied':    '404.html',              # algemeen: vaargebieden die medewerkers zelf toevoegen
}


def lees(pad):
    with open(os.path.join(SRC, pad), encoding='utf-8') as f:
        t = f.read()
    return t[:-1] if t.endswith('\n') and pad != 'pagina.html' else t


def uitvouwen(pad, diepte=0):
    """Geeft de regels van src/pad terug, met alle //#include en {{bestand:}} ingevoegd."""
    if diepte > 8:
        raise SystemExit('Te diep geneste //#include in ' + pad)
    uit = []
    for regel in lees(pad).split('\n'):
        if regel.startswith('//#include '):
            uit += uitvouwen(regel[11:].strip(), diepte + 1)
        else:
            if '{{bestand:' in regel:
                regel = re.sub(r'\{\{bestand:([^}]+)\}\}', lambda m: lees(m.group(1)), regel)
            uit.append(regel)
    return uit


def kies(regels, variant):
    """Past de //#if-blokken toe voor één variant."""
    uit, stapel = [], []          # stapel: [actief, al_gekozen]
    for nr, r in enumerate(regels, 1):
        if r.startswith('//#if '):
            a = variant in [x.strip() for x in r[6:].split(',')]
            stapel.append([a, a]); continue
        if r.startswith('//#elif '):
            s = stapel[-1]; a = (not s[1]) and variant in [x.strip() for x in r[8:].split(',')]
            s[0] = a; s[1] = s[1] or a; continue
        if r == '//#else':
            s = stapel[-1]; s[0] = not s[1]; s[1] = True; continue
        if r == '//#endif':
            stapel.pop(); continue
        if r.startswith('//#'):
            raise SystemExit(f'Onbekende aanwijzing op regel {nr}: {r[:60]}')
        if all(s[0] for s in stapel):
            uit.append(r)
    if stapel:
        raise SystemExit('Er ontbreekt een //#endif')
    return '\n'.join(uit)


def main():
    controle = '--controle' in sys.argv
    regels = uitvouwen('pagina.html')
    fout = False
    for variant, doel in VARIANTEN.items():
        tekst = kies(regels, variant)
        pad = os.path.join(ROOT, doel)
        huidig = open(pad, encoding='utf-8').read() if os.path.exists(pad) else None
        if controle:
            ok = huidig == tekst
            fout = fout or not ok
            print(('gelijk   ' if ok else 'VERSCHILT') + ' ' + doel)
        else:
            os.makedirs(os.path.dirname(pad) or '.', exist_ok=True)
            with open(pad, 'w', encoding='utf-8') as f:
                f.write(tekst)
            print(('ongewijzigd ' if huidig == tekst else 'bijgewerkt  ') + f'{doel}  ({len(tekst)//1024} kB)')
    if controle and fout:
        raise SystemExit('De pagina\'s zijn niet gelijk aan de bron. Voer "python3 bouw.py" uit en commit het resultaat.')


if __name__ == '__main__':
    main()

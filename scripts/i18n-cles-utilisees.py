#!/usr/bin/env python3
"""Correctif immeuble (2026-11-07) — contrôle de RÉGRESSION i18n.

Le contrôle historique (i18n-check.py) ne vérifie que la parité
FR <-> EN des clés DÉFINIES. Il ne voyait donc pas les clés UTILISÉES
dans le code mais absentes des deux fichiers — c'est exactement le
bug « crud.common.create » affiché en clair sur les boutons de
création (6 pages), découvert par le fondateur en production.

Ce script extrait les appels statiques `x("a.b")` de app/, components/
et lib/, les rattache au namespace de la DERNIÈRE déclaration
`const x = useTranslations("ns")` qui les précède dans le fichier
(patron de ce codebase : chaque composant déclare ses hooks en tête),
et échoue (sortie 1) si une clé utilisée est absente de fr.json ou
de en.json.

Usage : python3 scripts/i18n-cles-utilisees.py
"""
import json, re, sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent


def feuilles(d, prefixe=""):
    out = set()
    for k, v in d.items():
        p = f"{prefixe}.{k}" if prefixe else k
        if isinstance(v, dict):
            out |= feuilles(v, p)
        else:
            out.add(p)
    return out


fr = json.loads((RACINE / "messages" / "fr.json").read_text(encoding="utf-8"))
en = json.loads((RACINE / "messages" / "en.json").read_text(encoding="utf-8"))
KF, KE = feuilles(fr), feuilles(en)

DECL = re.compile(
    r'(?:const|let|var)\s+(\w+)\s*=\s*(?:await\s+)?'
    r'(?:useTranslations|getTranslations)\(\s*["\']([^"\']*)["\']'
)
APPEL = re.compile(r'\b(\w+)\(\s*["\']([A-Za-z0-9_.\-]+)["\']')

manquantes = {}
fichiers = (
    sorted((RACINE / "app").rglob("*.tsx"))
    + sorted((RACINE / "app").rglob("*.ts"))
    + sorted((RACINE / "components").rglob("*.tsx"))
    + sorted((RACINE / "components").rglob("*.ts"))
    + sorted((RACINE / "lib").rglob("*.ts"))
)
for f in fichiers:
    texte = f.read_text(encoding="utf-8")
    decls = [(m.start(), m.group(1), m.group(2)) for m in DECL.finditer(texte)]
    if not decls:
        continue
    for m in APPEL.finditer(texte):
        var, cle = m.group(1), m.group(2)
        ns = None
        for pos, v, n in decls:
            if v == var and pos < m.start():
                ns = n
        if ns is None:
            continue
        complete = f"{ns}.{cle}" if ns else cle
        a_fr, a_en = complete not in KF, complete not in KE
        if a_fr or a_en:
            rel = f.relative_to(RACINE)
            manquantes.setdefault(complete, []).append(
                f"{rel} (fr:{'ABSENT' if a_fr else 'ok'}, en:{'ABSENT' if a_en else 'ok'})"
            )

if manquantes:
    print(f"ÉCHEC : {len(manquantes)} clé(s) utilisée(s) mais ABSENTE(S) des messages :")
    for k in sorted(manquantes):
        print(f"\n  {k}")
        for loc in manquantes[k][:8]:
            print(f"      {loc}")
    sys.exit(1)
print(f"i18n clés utilisées : OK (toutes présentes, {len(KF)} clés FR / {len(KE)} EN)")

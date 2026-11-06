#!/usr/bin/env python3
"""Vérifie que messages/fr.json et messages/en.json ont exactement le
même ensemble de clés (feuilles). Échoue (sortie 1) en cas d'écart.

Usage : python3 scripts/i18n-check.py
"""
import json, sys
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent

def cles(d, prefixe=""):
    out = set()
    for k, v in d.items():
        p = f"{prefixe}.{k}" if prefixe else k
        if isinstance(v, dict):
            out |= cles(v, p)
        else:
            out.add(p)
    return out

fr = json.loads((RACINE / "messages" / "fr.json").read_text(encoding="utf-8"))
en = json.loads((RACINE / "messages" / "en.json").read_text(encoding="utf-8"))
kf, ke = cles(fr), cles(en)
if kf != ke:
    for k in sorted(kf - ke):
        print(f"FR sans EN : {k}")
    for k in sorted(ke - kf):
        print(f"EN sans FR : {k}")
    print(f"ÉCART : {len(kf - ke)} clé(s) FR sans EN, {len(ke - kf)} clé(s) EN sans FR")
    sys.exit(1)
print(f"i18n : parité OK ({len(kf)} clés FR = EN)")

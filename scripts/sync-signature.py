#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Synchronise la signature du Président Directeur dans l'application.

Lit « public/signature-president.png » (déposé par le fondateur) et
régénère « lib/signature.ts » avec l'image embarquée en data URL.
L'image est NORMALISÉE avant embarquement (largeur max 480 px,
aplatie sur fond blanc, JPEG qualité 90) : la signature s'appose sur
la page blanche du contrat — l'aplatissement y est invisible — et le
PDF reste léger (même traitement que le cachet Ciza Group).
Si le fichier est absent, la constante est remise à null : le contrat
se génère alors sans l'image (avec le cachet).

En production, cette synchronisation est un SECOURS : le générateur
de contrat récupère d'abord le fichier public servi par l'application
(/signature-president.png), qui s'appose automatiquement dès qu'il
est déployé. La constante embarquée sert aux environnements sans
accès au fichier public.

Usage : python3 scripts/sync-signature.py
"""
import base64
import io
import os
import sys

from PIL import Image

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(RACINE, "public", "signature-president.png")
CIBLE = os.path.join(RACINE, "lib", "signature.ts")

ENTETE = """/**
 * Signature électronique du Président Directeur (v1.3, phase D).
 *
 * Le contrat du gestionnaire (lib/contrat.ts) appose l'image de la
 * signature de Ciza Misigaro dans le bloc signature entreprise, juste
 * au-dessus du nom « Ciza Misigaro, Président Directeur », à côté du
 * cachet rond officiel déjà apposé.
 *
 * Deux voies d'alimentation, par ordre de priorité :
 *  1. Le fichier public de l'application : dès que
 *     « public/signature-president.png » est déployé, le générateur le
 *     récupère automatiquement à chaque génération (aucun changement
 *     de code) — c'est la voie normale en production.
 *  2. Cette constante embarquée, régénérée par
 *     « scripts/sync-signature.py » lorsqu'un fichier est présent dans
 *     public/ (utile pour les environnements sans accès au fichier
 *     public, ex. génération hors navigateur).
 *
 * Tant qu'aucun fichier n'a été fourni, la constante vaut null et le
 * contrat se génère SANS l'image — avec le cachet, comme prévu.
 */
"""


def main() -> int:
    if os.path.isfile(SOURCE):
        with open(SOURCE, "rb") as f:
            octets = f.read()
        if not octets.startswith(b"\x89PNG"):
            print("ERREUR : public/signature-president.png n'est pas un PNG.")
            return 1
        # Normalisation : largeur max 480 px + aplatissement sur blanc
        # + JPEG q90 — le PDF final reste léger (voir l'en-tête).
        image = Image.open(io.BytesIO(octets)).convert("RGBA")
        if image.width > 480:
            hauteur = round(image.height * 480 / image.width)
            image = image.resize((480, hauteur), Image.LANCZOS)
        fond = Image.new("RGBA", image.size, (255, 255, 255, 255))
        fond.alpha_composite(image)
        tampon = io.BytesIO()
        fond.convert("RGB").save(tampon, format="JPEG", quality=90)
        octets_jpeg = tampon.getvalue()
        data_url = "data:image/jpeg;base64," + base64.b64encode(octets_jpeg).decode("ascii")
        corps = ENTETE + f'export const SIGNATURE_PRESIDENT_DATA_URL: string | null =\n  "{data_url}";\n'
        with open(CIBLE, "w", encoding="utf-8") as f:
            f.write(corps)
        print(f"Signature embarquée : PNG {len(octets)} octets -> JPEG {len(octets_jpeg)} octets -> lib/signature.ts")
    else:
        corps = ENTETE + "export const SIGNATURE_PRESIDENT_DATA_URL: string | null = null;\n"
        with open(CIBLE, "w", encoding="utf-8") as f:
            f.write(corps)
        print("Aucun fichier public/signature-president.png : constante remise à null.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

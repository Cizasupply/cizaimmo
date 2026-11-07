/**
 * Contexte d'inscription — anti-fraude tarifaire (extension v1.2).
 *
 * Renvoie UNIQUEMENT le code pays de l'IP de la visite, lu dans
 * l'en-tête `x-vercel-ip-country` fourni par Vercel. L'adresse IP
 * brute n'est ni lue, ni stockée, ni journalisée — seul le code pays
 * (2 lettres) alimente la matrice d'attribution de la grille
 * (lib/grille.ts). Hors Vercel (développement local), l'en-tête est
 * absent : pays_ip = null → la matrice suit le pays déclaré et
 * revérifie au premier paiement.
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const brut = req.headers.get("x-vercel-ip-country");
  const paysIp = brut && /^[A-Za-z]{2}$/.test(brut.trim()) ? brut.trim().toUpperCase() : null;
  return NextResponse.json(
    { pays_ip: paysIp },
    { headers: { "Cache-Control": "no-store" } }
  );
}

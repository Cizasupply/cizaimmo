/**
 * Route API PUBLIQUE — taux du convertisseur de la mini-grille tarifaire
 * de l'accueil (visiteur anonyme, sans compte).
 *
 * GET /api/taux/publics — aucune authentification : les taux de change
 * sont des données publiques. La table `taux_change` reste protégée par
 * RLS (un anonyme n'y lit rien) ; cette route interroge donc les deux
 * services gratuits sans clé via recupererTauxConvertisseur()
 * (Frankfurter prioritaire, ER-API en repli — appels mis en cache 1 h).
 *
 * Chaque ligne retournée porte la DATE de sa source : un taux daté
 * n'est jamais présenté comme un taux en direct. En cas d'échec des
 * deux sources, la route répond 502 et l'accueil affiche les prix en
 * USD — aucun taux n'est jamais inventé.
 */
import { NextResponse } from "next/server";
import { recupererTauxConvertisseur } from "@/lib/taux";

// Exécution à la demande : les appels amont sont eux-mêmes mis en
// cache (revalidate 3600 dans lib/taux.ts), pas la réponse complète.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const taux = await recupererTauxConvertisseur();
    return NextResponse.json({ taux });
  } catch {
    return NextResponse.json({ error: "taux_indisponible" }, { status: 502 });
  }
}

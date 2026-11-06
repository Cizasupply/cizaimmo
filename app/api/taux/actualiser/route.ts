/**
 * Route API — actualisation des taux de change (Module 6, spec §9).
 *
 * POST /api/taux/actualiser — protégée (session démo ou Supabase).
 *  1. Actualisation paresseuse : si les taux automatiques stockés datent
 *     de moins de ~24 h, la route ne refait PAS l'appel externe et
 *     retourne { actualise: false, raison: "recent", date_taux }.
 *  2. Sinon, récupère les taux auprès du service externe gratuit sans
 *     clé (open.er-api.com, surchargeable via TAUX_API_URL) et les
 *     enregistre dans la table `taux_change` (source « auto », datés).
 *  3. En mode démo, la route ne peut pas écrire dans le localStorage du
 *     navigateur : elle retourne les taux récupérés et c'est la page
 *     Paramètres qui les enregistre via le fournisseur (enregistrerTauxAuto).
 *
 * Aucun secret n'est exposé : le service de taux est public et sans clé.
 * Aucun taux n'est jamais inventé : en cas d'échec, la route répond 502
 * et les anciens taux (datés) restent affichés tels quels.
 */
import { NextRequest, NextResponse } from "next/server";
import { DEMO_SESSION_COOKIE } from "@/lib/data/demo";
import { isDemoMode } from "@/lib/supabase";
import { createSupabaseServerClient } from "@/lib/supabase";
import { getSupabaseServiceClient } from "@/lib/supabase-service";
import {
  construireTauxAuto,
  doitActualiserTaux,
  dernierTauxAuto,
  recupererTauxExternes,
} from "@/lib/taux";
import type { TauxChange } from "@/lib/data/types";

async function authentifie(req: NextRequest): Promise<boolean> {
  if (req.cookies.get(DEMO_SESSION_COOKIE)?.value === "1") return true;
  if (isDemoMode()) return false;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return false;
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

export async function POST(req: NextRequest) {
  if (!(await authentifie(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Lecture des taux stockés (mode réel uniquement : en démo, le client
  // vérifie la fraîcheur avant d'appeler et enregistre lui-même).
  let tauxStockes: TauxChange[] = [];
  let supabase = null as Awaited<ReturnType<typeof createSupabaseServerClient>>;
  if (!isDemoMode()) {
    supabase = await createSupabaseServerClient();
    if (supabase) {
      const { data } = await supabase
        .from("taux_change")
        .select("*")
        .order("date_taux", { ascending: false })
        .limit(200);
      tauxStockes = (data as TauxChange[] | null) ?? [];
    }
  }

  if (!isDemoMode() && !doitActualiserTaux(tauxStockes)) {
    const dernier = dernierTauxAuto(tauxStockes);
    return NextResponse.json({
      actualise: false,
      raison: "recent",
      date_taux: dernier?.date_taux ?? null,
      source: dernier?.source ?? null,
    });
  }

  let externes;
  try {
    externes = await recupererTauxExternes();
  } catch (e) {
    return NextResponse.json(
      {
        error: "taux_indisponible",
        detail: e instanceof Error ? e.message : "erreur service de taux",
      },
      { status: 502 }
    );
  }
  const lignes = construireTauxAuto(externes);

  // Mode réel : enregistrement côté serveur (service role si disponible,
  // sinon client utilisateur — politique taux_change_insert_auto_auth).
  let enregistres = false;
  if (!isDemoMode()) {
    const service = getSupabaseServiceClient();
    const client = service ?? supabase;
    if (client) {
      const existants = new Set(
        tauxStockes.map(
          (t) => `${t.devise_source}|${t.devise_cible}|${t.date_taux.slice(0, 10)}|${t.source}`
        )
      );
      const aInserer = lignes.filter(
        (l) =>
          !existants.has(`${l.devise_source}|${l.devise_cible}|${l.date_taux.slice(0, 10)}|${l.source}`)
      );
      if (aInserer.length > 0) {
        const { error } = await client.from("taux_change").insert(aInserer);
        if (error) {
          return NextResponse.json(
            { error: "enregistrement_echoue", detail: error.message },
            { status: 500 }
          );
        }
      }
      enregistres = true;
    }
  }

  return NextResponse.json({
    actualise: true,
    raison: "ok",
    date_taux: externes.date_taux,
    source: "auto",
    enregistres,
    taux: lignes,
  });
}

// La route ne sert qu'en POST ; GET explique l'usage (pas de secret exposé).
export async function GET() {
  return NextResponse.json({
    usage: "POST /api/taux/actualiser — actualise les taux (paresseux, ~24 h).",
  });
}

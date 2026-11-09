"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.GET = GET;
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
const server_1 = require("next/server");
const supabase_1 = require("@/lib/supabase");
const supabase_2 = require("@/lib/supabase");
const supabase_3 = require("@/lib/supabase");
const supabase_service_1 = require("@/lib/supabase-service");
const taux_1 = require("@/lib/taux");
async function authentifie(req) {
    if (req.cookies.get(supabase_1.DEMO_SESSION_COOKIE)?.value === "1")
        return true;
    if ((0, supabase_2.isDemoMode)())
        return false;
    const supabase = await (0, supabase_3.createSupabaseServerClient)();
    if (!supabase)
        return false;
    const { data } = await supabase.auth.getUser();
    return Boolean(data.user);
}
async function POST(req) {
    if (!(await authentifie(req))) {
        return server_1.NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    // Lecture des taux stockés (mode réel uniquement : en démo, le client
    // vérifie la fraîcheur avant d'appeler et enregistre lui-même).
    let tauxStockes = [];
    let supabase = null;
    if (!(0, supabase_2.isDemoMode)()) {
        supabase = await (0, supabase_3.createSupabaseServerClient)();
        if (supabase) {
            const { data } = await supabase
                .from("taux_change")
                .select("*")
                .order("date_taux", { ascending: false })
                .limit(200);
            tauxStockes = data ?? [];
        }
    }
    if (!(0, supabase_2.isDemoMode)() && !(0, taux_1.doitActualiserTaux)(tauxStockes)) {
        const dernier = (0, taux_1.dernierTauxAuto)(tauxStockes);
        return server_1.NextResponse.json({
            actualise: false,
            raison: "recent",
            date_taux: dernier?.date_taux ?? null,
            source: dernier?.source ?? null,
        });
    }
    let externes;
    try {
        externes = await (0, taux_1.recupererTauxExternes)();
    }
    catch (e) {
        return server_1.NextResponse.json({
            error: "taux_indisponible",
            detail: e instanceof Error ? e.message : "erreur service de taux",
        }, { status: 502 });
    }
    const lignes = (0, taux_1.construireTauxAuto)(externes);
    // Mode réel : enregistrement côté serveur (service role si disponible,
    // sinon client utilisateur — politique taux_change_insert_auto_auth).
    let enregistres = false;
    if (!(0, supabase_2.isDemoMode)()) {
        const service = (0, supabase_service_1.getSupabaseServiceClient)();
        const client = service ?? supabase;
        if (client) {
            const existants = new Set(tauxStockes.map((t) => `${t.devise_source}|${t.devise_cible}|${t.date_taux.slice(0, 10)}|${t.source}`));
            const aInserer = lignes.filter((l) => !existants.has(`${l.devise_source}|${l.devise_cible}|${l.date_taux.slice(0, 10)}|${l.source}`));
            if (aInserer.length > 0) {
                const { error } = await client.from("taux_change").insert(aInserer);
                if (error) {
                    return server_1.NextResponse.json({ error: "enregistrement_echoue", detail: error.message }, { status: 500 });
                }
            }
            enregistres = true;
        }
    }
    return server_1.NextResponse.json({
        actualise: true,
        raison: "ok",
        date_taux: externes.date_taux,
        source: "auto",
        enregistres,
        taux: lignes,
    });
}
// La route ne sert qu'en POST ; GET explique l'usage (pas de secret exposé).
async function GET() {
    return server_1.NextResponse.json({
        usage: "POST /api/taux/actualiser — actualise les taux (paresseux, ~24 h).",
    });
}

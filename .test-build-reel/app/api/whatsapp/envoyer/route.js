"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
/**
 * Route API — envoi WhatsApp via l'API officielle Meta (Module 6, spec §10).
 *
 * POST /api/whatsapp/envoyer — protégée (session démo ou Supabase).
 * Corps : { "to": "+257…", "message": "…" }.
 *
 * RÈGLE ABSOLUE : si WhatsApp n'est pas configuré (WHATSAPP_API_TOKEN /
 * WHATSAPP_PHONE_NUMBER_ID absents), la route répond { envoye: false,
 * raison: "non_configuré" } (HTTP 200 : ce n'est pas une erreur, c'est
 * un état affiché) — on ne simule JAMAIS un envoi. Un échec réel répond
 * { envoye: false, raison: "echec", detail } sans bloquer les autres
 * canaux : l'appelant affiche le statut et continue.
 *
 * Le token ne quitte jamais le serveur : la route est le seul point
 * d'entrée, lib/whatsapp.ts n'est jamais importé côté client.
 * Configuration : voir docs/whatsapp-setup.md.
 */
const server_1 = require("next/server");
const supabase_1 = require("@/lib/supabase");
const supabase_2 = require("@/lib/supabase");
const whatsapp_1 = require("@/lib/whatsapp");
async function authentifie(req) {
    if (req.cookies.get(supabase_1.DEMO_SESSION_COOKIE)?.value === "1")
        return true;
    if ((0, supabase_2.isDemoMode)())
        return false;
    const supabase = await (0, supabase_2.createSupabaseServerClient)();
    if (!supabase)
        return false;
    const { data } = await supabase.auth.getUser();
    return Boolean(data.user);
}
async function POST(req) {
    if (!(await authentifie(req))) {
        return server_1.NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    let corps = {};
    try {
        corps = await req.json();
    }
    catch {
        return server_1.NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    const to = typeof corps.to === "string" ? corps.to.trim() : "";
    const message = typeof corps.message === "string" ? corps.message.trim() : "";
    if (!to || !message) {
        return server_1.NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    if (message.length > 4000) {
        return server_1.NextResponse.json({ error: "message_trop_long" }, { status: 400 });
    }
    const resultat = await (0, whatsapp_1.envoyerWhatsApp)({ destinataire: to, texte: message });
    return server_1.NextResponse.json(resultat);
}

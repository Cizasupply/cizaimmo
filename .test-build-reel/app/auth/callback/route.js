"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_1 = require("@/lib/supabase");
/**
 * Callback Supabase Auth (Module 1) : confirmation d'e-mail et
 * réinitialisation du mot de passe.
 * Échange le `code` reçu par e-mail contre une session, puis redirige :
 *  - ?next=/nouveau-mot-de-passe -> choix du nouveau mot de passe
 *  - sinon -> tableau de bord (locale fr par défaut, ou celle du `next`).
 * En mode démo : pas de Supabase, redirection simple vers la connexion.
 */
async function GET(request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/dashboard";
    const locale = next.startsWith("/en/") || next === "/en" ? "en" : "fr";
    const target = next.startsWith("/") ? next : `/${locale}/dashboard`;
    if ((0, supabase_1.isDemoMode)() || !code) {
        return server_1.NextResponse.redirect(new URL(`/${locale}/connexion`, request.url));
    }
    const supabase = await (0, supabase_1.createSupabaseServerClient)();
    if (!supabase) {
        return server_1.NextResponse.redirect(new URL(`/${locale}/connexion`, request.url));
    }
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
        return server_1.NextResponse.redirect(new URL(`/${locale}/connexion?erreur=lien-invalide`, request.url));
    }
    return server_1.NextResponse.redirect(new URL(target, request.url));
}

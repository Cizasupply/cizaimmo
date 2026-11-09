"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.default = middleware;
const middleware_1 = __importDefault(require("next-intl/middleware"));
const server_1 = require("next/server");
const supabase_1 = require("@/lib/supabase");
const supabase_2 = require("@/lib/supabase");
const intlMiddleware = (0, middleware_1.default)({
    locales: ["fr", "en"],
    defaultLocale: "fr",
    localePrefix: "as-needed",
});
/** Routes de l'application : connexion obligatoire (spec §2). */
const PROTECTED_SEGMENTS = [
    "dashboard",
    "immeubles",
    "appartements",
    "locataires",
    "loyers",
    "depenses",
    "parametres",
    // Routes des modules suivants, protégées dès maintenant :
    "recus",
    "documents",
    "alertes",
    "rapports",
    "vitrine",
    "abonnement",
    // Extension v1.2 : console plateforme (Admin / Super Admin).
    "console",
];
/** Pages d'authentification (publiques). */
const AUTH_SEGMENTS = ["connexion", "inscription", "mot-de-passe-oublie", "nouveau-mot-de-passe"];
function firstSegment(pathname) {
    const parts = pathname.split("/").filter(Boolean);
    if (parts.length === 0)
        return "";
    // Avec localePrefix "as-needed", /fr/... porte le préfixe, /... non.
    if ((parts[0] === "fr" || parts[0] === "en") && parts.length > 1)
        return parts[1];
    return parts[0];
}
function localeOf(pathname) {
    const parts = pathname.split("/").filter(Boolean);
    return parts[0] === "en" ? "en" : "fr";
}
async function middleware(req) {
    const intlResponse = intlMiddleware(req);
    // Redirection de locale effectuée par next-intl : on la laisse passer.
    if (intlResponse.headers.get("location"))
        return intlResponse;
    const { pathname } = req.nextUrl;
    const segment = firstSegment(pathname);
    const locale = localeOf(pathname);
    const isProtected = PROTECTED_SEGMENTS.includes(segment);
    const isAuthPage = AUTH_SEGMENTS.includes(segment);
    if (!isProtected && !isAuthPage)
        return intlResponse;
    // Session démo : cookie posé par DemoProvider.signIn / signUp.
    // Correctif 2026-11-07 (zone connectée figée) : ce cookie ne vaut
    // QUE si le site tourne réellement en mode démo. En mode réel
    // (Supabase configuré), un cookie démo résiduel — posé pendant la
    // période démo du 2026-11-06, valable 30 jours — ne doit jamais
    // authentifier : sinon, après une déconnexion réelle, le
    // middleware renvoie l'utilisateur vers le tableau de bord alors
    // qu'il n'a plus aucune session (déconnexion impossible, pages
    // protégées rebondies, espace connecté figé sur un parc vide).
    const modeDemo = (0, supabase_1.isDemoMode)();
    const hasDemoSession = modeDemo && req.cookies.get(supabase_2.DEMO_SESSION_COOKIE)?.value === "1";
    let authenticated = hasDemoSession;
    if (!authenticated && !modeDemo) {
        // Mode réel : vérification de la session Supabase (RLS reste le
        // vrai garde-fou côté base ; le middleware ne fait que rediriger).
        const supabase = (0, supabase_1.createSupabaseMiddlewareClient)(req, intlResponse);
        if (supabase) {
            const { data } = await supabase.auth.getUser();
            authenticated = Boolean(data.user);
        }
    }
    if (isProtected && !authenticated) {
        const url = req.nextUrl.clone();
        url.pathname = `/${locale}/connexion`;
        return server_1.NextResponse.redirect(url);
    }
    if (isAuthPage && authenticated) {
        const url = req.nextUrl.clone();
        url.pathname = `/${locale}/dashboard`;
        return server_1.NextResponse.redirect(url);
    }
    return intlResponse;
}
exports.config = {
    // « auth » exclu : /auth/callback (confirmation d'e-mail, reset de mot
    // de passe Supabase) est une route handler SANS préfixe de locale — si
    // next-intl la réécrivait en /fr/auth/callback, elle aboutirait à un 404.
    matcher: ["/((?!api|auth|_next|_vercel|.*\\..*).*)"],
};

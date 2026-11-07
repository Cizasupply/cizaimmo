import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseMiddlewareClient, isDemoMode } from "@/lib/supabase";
import { DEMO_SESSION_COOKIE } from "@/lib/data/demo";

const intlMiddleware = createMiddleware({
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

function firstSegment(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return "";
  // Avec localePrefix "as-needed", /fr/... porte le préfixe, /... non.
  if ((parts[0] === "fr" || parts[0] === "en") && parts.length > 1) return parts[1];
  return parts[0];
}

function localeOf(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] === "en" ? "en" : "fr";
}

export default async function middleware(req: NextRequest) {
  const intlResponse = intlMiddleware(req);
  // Redirection de locale effectuée par next-intl : on la laisse passer.
  if (intlResponse.headers.get("location")) return intlResponse;

  const { pathname } = req.nextUrl;
  const segment = firstSegment(pathname);
  const locale = localeOf(pathname);
  const isProtected = PROTECTED_SEGMENTS.includes(segment);
  const isAuthPage = AUTH_SEGMENTS.includes(segment);
  if (!isProtected && !isAuthPage) return intlResponse;

  // Session démo : cookie posé par DemoProvider.signIn / signUp.
  const hasDemoSession = req.cookies.get(DEMO_SESSION_COOKIE)?.value === "1";

  let authenticated = hasDemoSession;
  if (!authenticated && !isDemoMode()) {
    // Mode réel : vérification de la session Supabase (RLS reste le
    // vrai garde-fou côté base ; le middleware ne fait que rediriger).
    const supabase = createSupabaseMiddlewareClient(req, intlResponse);
    if (supabase) {
      const { data } = await supabase.auth.getUser();
      authenticated = Boolean(data.user);
    }
  }

  if (isProtected && !authenticated) {
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/connexion`;
    return NextResponse.redirect(url);
  }
  if (isAuthPage && authenticated) {
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}/dashboard`;
    return NextResponse.redirect(url);
  }
  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, isDemoMode } from "@/lib/supabase";

/**
 * Callback Supabase Auth (Module 1) : confirmation d'e-mail et
 * réinitialisation du mot de passe.
 * Échange le `code` reçu par e-mail contre une session, puis redirige :
 *  - ?next=/nouveau-mot-de-passe -> choix du nouveau mot de passe
 *  - sinon -> tableau de bord (locale fr par défaut, ou celle du `next`).
 * En mode démo : pas de Supabase, redirection simple vers la connexion.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const locale = next.startsWith("/en/") || next === "/en" ? "en" : "fr";
  const target = next.startsWith("/") ? next : `/${locale}/dashboard`;

  if (isDemoMode() || !code) {
    return NextResponse.redirect(new URL(`/${locale}/connexion`, request.url));
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(new URL(`/${locale}/connexion`, request.url));
  }
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/${locale}/connexion?erreur=lien-invalide`, request.url)
    );
  }
  return NextResponse.redirect(new URL(target, request.url));
}

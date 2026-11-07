/**
 * Route API — envoi d'e-mail d'alerte via le fournisseur configuré
 * (Correctif 2, spec §10). Miroir de /api/whatsapp/envoyer.
 *
 * POST /api/email/envoyer — protégée (session démo ou Supabase).
 * Corps : { "to": "…", "subject": "…", "text": "…", "html"?: "…" }.
 *
 * RÈGLE ABSOLUE : si aucun fournisseur n'est configuré (EMAIL_API_URL /
 * EMAIL_API_KEY absents), la route répond { envoye: false, raison:
 * "non_configuré" } (HTTP 200 : ce n'est pas une erreur, c'est un état
 * affiché) — on ne simule JAMAIS un envoi. Un échec réel répond
 * { envoye: false, raison: "echec", detail } sans bloquer les autres
 * canaux : l'appelant affiche le statut et continue.
 *
 * La clé du fournisseur ne quitte jamais le serveur : la route est le
 * seul point d'entrée, lib/email.ts n'est jamais importé côté client
 * pour l'envoi direct (le client passe par envoyerEmailViaApi).
 * Configuration : renseigner EMAIL_API_URL + EMAIL_API_KEY (Resend,
 * SendGrid, Mailgun…) — aucun secret en clair dans le code, jamais.
 */
import { NextRequest, NextResponse } from "next/server";
import { DEMO_SESSION_COOKIE } from "@/lib/supabase";
import { createSupabaseServerClient, isDemoMode } from "@/lib/supabase";
import { envoyerEmailAlerte } from "@/lib/email";

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
  let corps: {
    to?: unknown;
    subject?: unknown;
    text?: unknown;
    html?: unknown;
    langue?: unknown;
    piecesJointes?: unknown;
  } = {};
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const to = typeof corps.to === "string" ? corps.to.trim() : "";
  const subject = typeof corps.subject === "string" ? corps.subject.trim() : "";
  const text = typeof corps.text === "string" ? corps.text.trim() : "";
  const html = typeof corps.html === "string" ? corps.html : undefined;
  // Langue du destinataire (gabarit e-mail) : « fr » / « en » seulement,
  // toute autre valeur est ignorée (gabarit bilingue par défaut).
  const langue = corps.langue === "en" ? "en" : corps.langue === "fr" ? "fr" : undefined;
  if (!to || !subject || !text) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (subject.length > 500 || text.length > 10000) {
    return NextResponse.json({ error: "message_trop_long" }, { status: 400 });
  }
  // Pièces jointes (v1.3 — contrat gestionnaire) : au plus 3 fichiers,
  // chacun ≤ ~10 Mo en base64 (≈ 14 M de caractères). Format strict :
  // { nom, contenuBase64 } — tout le reste est ignoré/rejeté.
  let piecesJointes: { nom: string; contenuBase64: string }[] | undefined;
  if (corps.piecesJointes !== undefined) {
    if (!Array.isArray(corps.piecesJointes) || corps.piecesJointes.length > 3) {
      return NextResponse.json({ error: "pieces_jointes_invalides" }, { status: 400 });
    }
    piecesJointes = [];
    for (const p of corps.piecesJointes as { nom?: unknown; contenuBase64?: unknown }[]) {
      const nom = typeof p?.nom === "string" ? p.nom.trim() : "";
      const contenuBase64 = typeof p?.contenuBase64 === "string" ? p.contenuBase64 : "";
      if (!nom || nom.length > 200 || contenuBase64.length === 0 || contenuBase64.length > 14_000_000) {
        return NextResponse.json({ error: "pieces_jointes_invalides" }, { status: 400 });
      }
      piecesJointes.push({ nom, contenuBase64 });
    }
  }
  const resultat = await envoyerEmailAlerte({
    destinataire: to,
    sujet: subject,
    texte: text,
    html,
    langue,
    piecesJointes,
  });
  return NextResponse.json(resultat);
}

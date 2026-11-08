/**
 * API Stripe Checkout — MODE TEST UNIQUEMENT (Module 5, spec §12).
 *
 * GET  -> { configured, testMode, testCard } : état de la configuration,
 *         sans jamais exposer de clé. La page Abonnement l'utilise pour
 *         afficher honnêtement « Stripe non configuré — mode test ».
 * POST -> crée une session Checkout (abonnement mensuel, mode test) pour
 *         le plan demandé et retourne son URL de redirection.
 *         Sans clé test ou sans identifiant de prix : 503, jamais de
 *         fausse confirmation de paiement.
 *         En MODE DÉMO (Supabase non configuré), le paiement est simulé
 *         côté client via le fournisseur démo : cette route refuse (503
 *         demo_mode) car il n'y a pas de vrai compte à facturer.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getStripeClient,
  getStripePriceId,
  STRIPE_TEST_CARD,
  stripeConfigured,
  stripeTestKeyPresentButLive,
} from "@/lib/stripe";
import { createSupabaseServerClient, isDemoMode } from "@/lib/supabase";
import type { Plan } from "@/lib/data/types";

const PLANS: Plan[] = ["starter", "pro", "agence"];

function appUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return base.replace(/\/$/, "");
}

export async function GET() {
  return NextResponse.json({
    configured: stripeConfigured(),
    testMode: true,
    liveKeyRefused: stripeTestKeyPresentButLive(),
    testCard: STRIPE_TEST_CARD,
  });
}

export async function POST(req: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json(
      { error: "demo_mode", message: "En mode démo, le paiement est simulé (DÉMO), sans Stripe." },
      { status: 503 }
    );
  }
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "stripe_not_configured", message: "Le paiement par carte n'est pas encore disponible. Vous serez prévenu dès son ouverture — aucun montant ne sera prélevé sans votre accord." },
      { status: 503 }
    );
  }
  let corps: { plan?: unknown } = {};
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const plan = corps.plan as Plan;
  if (!PLANS.includes(plan)) {
    return NextResponse.json({ error: "invalid_plan" }, { status: 400 });
  }

  // Grille + propriétaire : lus depuis l'abonnement en base.
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }
  const { data: sessionData } = await supabase.auth.getUser();
  const user = sessionData.user;
  if (!user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }
  const { data: abo } = await supabase
    .from("abonnements")
    .select("id, grille, stripe_customer_id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!abo) {
    return NextResponse.json({ error: "no_subscription" }, { status: 404 });
  }
  const priceId = getStripePriceId(
    (abo as { grille: "afrique" | "internationale" }).grille,
    plan
  );
  if (!priceId) {
    return NextResponse.json(
      { error: "stripe_price_not_configured", message: "Ce pack n'est pas encore ouvert au paiement par carte." },
      { status: 503 }
    );
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  }
  const base = appUrl();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer: ((abo as { stripe_customer_id?: string | null }).stripe_customer_id ?? undefined) || undefined,
    customer_email: !((abo as { stripe_customer_id?: string | null }).stripe_customer_id) ? user.email : undefined,
    success_url: `${base}/abonnement?session=ok`,
    cancel_url: `${base}/abonnement?session=cancel`,
    metadata: {
      owner_id: user.id,
      abonnement_id: (abo as { id: string }).id,
      plan,
    },
  });
  return NextResponse.json({ url: session.url });
}

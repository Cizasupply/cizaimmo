"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
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
const server_1 = require("next/server");
const stripe_1 = require("@/lib/stripe");
const supabase_1 = require("@/lib/supabase");
const PLANS = ["starter", "pro", "agence"];
function appUrl() {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return base.replace(/\/$/, "");
}
async function GET() {
    return server_1.NextResponse.json({
        configured: (0, stripe_1.stripeConfigured)(),
        testMode: true,
        liveKeyRefused: (0, stripe_1.stripeTestKeyPresentButLive)(),
        testCard: stripe_1.STRIPE_TEST_CARD,
    });
}
async function POST(req) {
    if ((0, supabase_1.isDemoMode)()) {
        return server_1.NextResponse.json({ error: "demo_mode", message: "En mode démo, le paiement est simulé (DÉMO), sans Stripe." }, { status: 503 });
    }
    if (!(0, stripe_1.stripeConfigured)()) {
        return server_1.NextResponse.json({ error: "stripe_not_configured", message: "Le paiement par carte n'est pas encore disponible. Vous serez prévenu dès son ouverture — aucun montant ne sera prélevé sans votre accord." }, { status: 503 });
    }
    let corps = {};
    try {
        corps = await req.json();
    }
    catch {
        return server_1.NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    const plan = corps.plan;
    if (!PLANS.includes(plan)) {
        return server_1.NextResponse.json({ error: "invalid_plan" }, { status: 400 });
    }
    // Grille + propriétaire : lus depuis l'abonnement en base.
    const supabase = await (0, supabase_1.createSupabaseServerClient)();
    if (!supabase) {
        return server_1.NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
    }
    const { data: sessionData } = await supabase.auth.getUser();
    const user = sessionData.user;
    if (!user) {
        return server_1.NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }
    const { data: abo } = await supabase
        .from("abonnements")
        .select("id, grille, stripe_customer_id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (!abo) {
        return server_1.NextResponse.json({ error: "no_subscription" }, { status: 404 });
    }
    const priceId = (0, stripe_1.getStripePriceId)(abo.grille, plan);
    if (!priceId) {
        return server_1.NextResponse.json({ error: "stripe_price_not_configured", message: "Ce pack n'est pas encore ouvert au paiement par carte." }, { status: 503 });
    }
    const stripe = (0, stripe_1.getStripeClient)();
    if (!stripe) {
        return server_1.NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
    }
    const base = appUrl();
    const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        customer: (abo.stripe_customer_id ?? undefined) || undefined,
        customer_email: !(abo.stripe_customer_id) ? user.email : undefined,
        success_url: `${base}/abonnement?session=ok`,
        cancel_url: `${base}/abonnement?session=cancel`,
        metadata: {
            owner_id: user.id,
            abonnement_id: abo.id,
            plan,
        },
    });
    return server_1.NextResponse.json({ url: session.url });
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
/**
 * Webhook Stripe — MODE TEST UNIQUEMENT (Module 5, spec §12).
 *
 * Signature vérifiée avec STRIPE_WEBHOOK_SECRET. Sans secret configuré,
 * la route refuse (503) : aucun événement non vérifié n'est appliqué.
 * Événements traités :
 *  - checkout.session.completed : active le plan payé (montée immédiate,
 *    nouvelle période d'1 mois, facture enregistrée) ;
 *  - invoice.payment_failed : échec de paiement -> grâce de 7 jours
 *    (alerte immédiate via la génération d'alertes) ;
 *  - customer.subscription.deleted : résiliation effective en fin de
 *    période (transition paresseuse, données conservées 90 jours).
 * Sans SUPABASE_SERVICE_ROLE_KEY, l'événement est accusé réception
 * (200) mais NON appliqué (applied: false) — jamais de fausse activation.
 */
const server_1 = require("next/server");
const stripe_1 = require("@/lib/stripe");
const supabase_service_1 = require("@/lib/supabase-service");
const abonnement_1 = require("@/lib/abonnement");
const tarifs_1 = require("@/lib/tarifs");
const grille_1 = require("@/lib/grille");
/**
 * Prix DYNAMIQUE (extension v1.2) : lu dans tarifs_plateforme via le
 * client service ; repli sur le seed (prixPlan) si la table est absente
 * ou vide — jamais un autre littéral.
 */
async function prixDynamiqueServeur(supabase, plan, grille) {
    try {
        const { data } = await supabase.from("tarifs_plateforme").select("*");
        const lignes = data ?? [];
        if (lignes.length > 0)
            return (0, tarifs_1.construirePrixPlans)(lignes)[plan][grille];
    }
    catch {
        // Table absente (module-finance non appliqué) : repli seed.
    }
    return (0, tarifs_1.construirePrixPlans)(tarifs_1.TARIFS_SEED)[plan][grille] ?? (0, abonnement_1.prixPlan)(plan, grille);
}
async function POST(req) {
    const stripe = (0, stripe_1.getStripeClient)();
    const secret = (0, stripe_1.stripeWebhookSecret)();
    if (!stripe || !secret) {
        return server_1.NextResponse.json({ error: "webhook_not_configured", message: "Webhook Stripe non configuré (clé test / secret manquant)." }, { status: 503 });
    }
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
        return server_1.NextResponse.json({ error: "missing_signature" }, { status: 400 });
    }
    let event;
    try {
        const rawBody = await req.text();
        event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    }
    catch {
        return server_1.NextResponse.json({ error: "invalid_signature" }, { status: 400 });
    }
    const supabase = (0, supabase_service_1.getSupabaseServiceClient)();
    if (!supabase) {
        // Accusé de réception sans application : l'activation attend la
        // configuration du service role (voir docs/stripe-test-setup.md).
        return server_1.NextResponse.json({ received: true, applied: false, reason: "supabase_service_role_not_configured" });
    }
    const maintenant = new Date().toISOString();
    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const meta = session.metadata ?? {};
        const abonnementId = meta.abonnement_id;
        const plan = meta.plan;
        if (!abonnementId || !plan || !["starter", "pro", "agence"].includes(plan)) {
            return server_1.NextResponse.json({ received: true, applied: false, reason: "metadata_missing" });
        }
        const { data: abo } = await supabase
            .from("abonnements")
            .select("*")
            .eq("id", abonnementId)
            .maybeSingle();
        if (!abo) {
            return server_1.NextResponse.json({ received: true, applied: false, reason: "subscription_not_found" });
        }
        const aboLu = abo;
        await supabase
            .from("abonnements")
            .update({
            plan,
            plan_en_attente: null,
            date_effet_plan: null,
            resiliation_programmee: false,
            echec_paiement: false,
            grace_ends_at: null,
            statut: "actif",
            trial_ends_at: null,
            debut_periode: maintenant,
            fin_periode: (0, abonnement_1.ajouterMois)(maintenant, 1),
            stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
            stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
        })
            .eq("id", abonnementId);
        const { data: existantes } = await supabase
            .from("factures_abonnement")
            .select("numero")
            .eq("owner_id", aboLu.owner_id);
        await supabase.from("factures_abonnement").insert({
            owner_id: aboLu.owner_id,
            numero: (0, abonnement_1.prochainNumeroFactureAbo)((existantes ?? []).map((r) => r.numero), new Date().getFullYear()),
            plan,
            grille: aboLu.grille,
            montant: await prixDynamiqueServeur(supabase, plan, aboLu.grille),
            devise: "USD",
            date_emission: maintenant,
            date_debut: maintenant,
            date_fin: (0, abonnement_1.ajouterMois)(maintenant, 1),
            moyen: "stripe",
            statut: "payee",
            stripe_invoice_id: null,
            reference_mobile_money: null,
        });
        // Anti-fraude (signal c) : au PREMIER paiement carte, capturer le
        // pays de la carte (payment method) ; contradiction avec la grille
        // attribuée → « a_verifier ». Best-effort : ne bloque jamais le flux.
        try {
            const { data: profil } = await supabase
                .from("profils")
                .select("pays_paiement")
                .eq("id", aboLu.owner_id)
                .maybeSingle();
            if (profil && !profil.pays_paiement && session.payment_intent) {
                const piId = typeof session.payment_intent === "string"
                    ? session.payment_intent
                    : session.payment_intent.id;
                const pi = await stripe.paymentIntents.retrieve(piId);
                const pmId = typeof pi.payment_method === "string"
                    ? pi.payment_method
                    : pi.payment_method?.id;
                if (pmId) {
                    const pm = await stripe.paymentMethods.retrieve(pmId);
                    const paysCarte = pm.card?.country ?? null;
                    if (paysCarte) {
                        const { data: params } = await supabase
                            .from("parametres_finance")
                            .select("pays_grille_afrique")
                            .eq("id", 1)
                            .maybeSingle();
                        const eligibles = params?.pays_grille_afrique ?? [];
                        const statutGrille = (0, grille_1.evaluerPaysPaiement)(aboLu.grille, paysCarte, eligibles);
                        await supabase
                            .from("profils")
                            .update({
                            pays_paiement: paysCarte,
                            ...(statutGrille === "a_verifier" ? { grille_statut: "a_verifier" } : {}),
                        })
                            .eq("id", aboLu.owner_id);
                    }
                }
            }
        }
        catch {
            // Signal (c) best-effort uniquement.
        }
        return server_1.NextResponse.json({ received: true, applied: true });
    }
    if (event.type === "invoice.payment_failed") {
        const invoice = event.data.object;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
        if (!customerId) {
            return server_1.NextResponse.json({ received: true, applied: false, reason: "no_customer" });
        }
        await supabase
            .from("abonnements")
            .update({
            echec_paiement: true,
            grace_ends_at: (0, abonnement_1.ajouterJours)(maintenant, abonnement_1.GRACE_ECHEC_PAIEMENT_JOURS),
        })
            .eq("stripe_customer_id", customerId)
            .eq("statut", "actif");
        return server_1.NextResponse.json({ received: true, applied: true });
    }
    if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object;
        // Résiliation effective en fin de période : on fige la fin à
        // maintenant et la transition paresseuse bascule en « annulé ».
        await supabase
            .from("abonnements")
            .update({ resiliation_programmee: true, fin_periode: maintenant })
            .eq("stripe_subscription_id", subscription.id);
        return server_1.NextResponse.json({ received: true, applied: true });
    }
    // Autres événements : accusé de réception, rien à appliquer.
    return server_1.NextResponse.json({ received: true, applied: false, reason: "event_ignored", type: event.type });
}

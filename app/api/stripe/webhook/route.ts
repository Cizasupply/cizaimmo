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
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient, stripeWebhookSecret } from "@/lib/stripe";
import { getSupabaseServiceClient } from "@/lib/supabase-service";
import { ajouterJours, ajouterMois, GRACE_ECHEC_PAIEMENT_JOURS, prixPlan, prochainNumeroFactureAbo } from "@/lib/abonnement";
import type { Abonnement, Plan } from "@/lib/data/types";

export async function POST(req: NextRequest) {
  const stripe = getStripeClient();
  const secret = stripeWebhookSecret();
  if (!stripe || !secret) {
    return NextResponse.json(
      { error: "webhook_not_configured", message: "Webhook Stripe non configuré (clé test / secret manquant)." },
      { status: 503 }
    );
  }
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }
  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const supabase = getSupabaseServiceClient();
  if (!supabase) {
    // Accusé de réception sans application : l'activation attend la
    // configuration du service role (voir docs/stripe-test-setup.md).
    return NextResponse.json({ received: true, applied: false, reason: "supabase_service_role_not_configured" });
  }

  const maintenant = new Date().toISOString();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata ?? {};
    const abonnementId = meta.abonnement_id;
    const plan = meta.plan as Plan | undefined;
    if (!abonnementId || !plan || !["starter", "pro", "agence"].includes(plan)) {
      return NextResponse.json({ received: true, applied: false, reason: "metadata_missing" });
    }
    const { data: abo } = await supabase
      .from("abonnements")
      .select("*")
      .eq("id", abonnementId)
      .maybeSingle();
    if (!abo) {
      return NextResponse.json({ received: true, applied: false, reason: "subscription_not_found" });
    }
    const aboLu = abo as Abonnement;
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
        fin_periode: ajouterMois(maintenant, 1),
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
      numero: prochainNumeroFactureAbo(
        (existantes ?? []).map((r) => (r as { numero: string }).numero),
        new Date().getFullYear()
      ),
      plan,
      grille: aboLu.grille,
      montant: prixPlan(plan, aboLu.grille),
      devise: "USD",
      date_emission: maintenant,
      date_debut: maintenant,
      date_fin: ajouterMois(maintenant, 1),
      moyen: "stripe",
      statut: "payee",
      stripe_invoice_id: null,
      reference_mobile_money: null,
    });
    return NextResponse.json({ received: true, applied: true });
  }

  if (event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
    if (!customerId) {
      return NextResponse.json({ received: true, applied: false, reason: "no_customer" });
    }
    await supabase
      .from("abonnements")
      .update({
        echec_paiement: true,
        grace_ends_at: ajouterJours(maintenant, GRACE_ECHEC_PAIEMENT_JOURS),
      })
      .eq("stripe_customer_id", customerId)
      .eq("statut", "actif");
    return NextResponse.json({ received: true, applied: true });
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    // Résiliation effective en fin de période : on fige la fin à
    // maintenant et la transition paresseuse bascule en « annulé ».
    await supabase
      .from("abonnements")
      .update({ resiliation_programmee: true, fin_periode: maintenant })
      .eq("stripe_subscription_id", subscription.id);
    return NextResponse.json({ received: true, applied: true });
  }

  // Autres événements : accusé de réception, rien à appliquer.
  return NextResponse.json({ received: true, applied: false, reason: "event_ignored", type: event.type });
}

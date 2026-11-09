"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
/**
 * Webhook mobile money (EcoCash, Lumicash, eNoti) — Module 5, spec §12.
 *
 * C'est LE point d'entrée par lequel la confirmation d'un paiement mobile
 * money arrive en mode réel : l'agrégateur / partenaire local appelle
 * cette route avec la référence (MM-XXXXXXXX) et le statut.
 *  - confirme : le paiement passe à « confirmé », l'abonnement s'active
 *    (plan, période d'1 mois) et la facture est émise ;
 *  - annule : le paiement est annulé, sans frais.
 * Sans SUPABASE_SERVICE_ROLE_KEY (fournisseur non branché), la route
 * refuse (503) : la demande reste « en attente de confirmation » avec
 * ses instructions, sans jamais prétendre être payée.
 * L'automatisation complète dépend d'un agrégateur/partenaire local —
 * voir docs/stripe-test-setup.md ; aucun numéro de paiement ni
 * partenaire n'est inventé ici.
 */
const server_1 = require("next/server");
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
    let corps = {};
    try {
        corps = await req.json();
    }
    catch {
        return server_1.NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
    const reference = typeof corps.reference === "string" ? corps.reference.trim() : "";
    const statut = corps.statut;
    if (!reference || !/^MM-[A-Z0-9]{8}$/.test(reference)) {
        return server_1.NextResponse.json({ error: "invalid_reference" }, { status: 400 });
    }
    if (statut !== "confirme" && statut !== "annule") {
        return server_1.NextResponse.json({ error: "invalid_status" }, { status: 400 });
    }
    const supabase = (0, supabase_service_1.getSupabaseServiceClient)();
    if (!supabase) {
        return server_1.NextResponse.json({ error: "mobile_money_not_configured", message: "Fournisseur mobile money non branché : la demande reste en attente de confirmation." }, { status: 503 });
    }
    const { data: paiement } = await supabase
        .from("paiements_mobile_money")
        .select("*")
        .eq("reference", reference)
        .maybeSingle();
    if (!paiement) {
        return server_1.NextResponse.json({ error: "reference_not_found" }, { status: 404 });
    }
    const p = paiement;
    if (p.statut !== "en_attente") {
        return server_1.NextResponse.json({ error: "already_processed", statut: p.statut }, { status: 409 });
    }
    if (Date.now() > new Date(p.expire_le).getTime()) {
        await supabase.from("paiements_mobile_money").update({ statut: "expire" }).eq("id", p.id);
        return server_1.NextResponse.json({ error: "expired", message: "Paiement non confirmé sous 24 h : annulé, sans frais." }, { status: 410 });
    }
    const maintenant = new Date().toISOString();
    if (statut === "annule") {
        await supabase.from("paiements_mobile_money").update({ statut: "annule" }).eq("id", p.id);
        return server_1.NextResponse.json({ received: true, applied: true, statut: "annule" });
    }
    // Confirmation : activation de l'abonnement + facture.
    await supabase
        .from("paiements_mobile_money")
        .update({ statut: "confirme", confirme_le: maintenant })
        .eq("id", p.id);
    const { data: abo } = await supabase
        .from("abonnements")
        .select("*")
        .eq("owner_id", p.owner_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (!abo) {
        return server_1.NextResponse.json({ received: true, applied: false, reason: "subscription_not_found" });
    }
    const aboLu = abo;
    await supabase
        .from("abonnements")
        .update({
        plan: p.plan,
        plan_en_attente: null,
        date_effet_plan: null,
        resiliation_programmee: false,
        echec_paiement: false,
        grace_ends_at: null,
        statut: "actif",
        trial_ends_at: null,
        debut_periode: maintenant,
        fin_periode: (0, abonnement_1.ajouterMois)(maintenant, 1),
        mobile_money_ref: reference,
    })
        .eq("id", aboLu.id);
    const { data: existantes } = await supabase
        .from("factures_abonnement")
        .select("numero")
        .eq("owner_id", p.owner_id);
    await supabase.from("factures_abonnement").insert({
        owner_id: p.owner_id,
        numero: (0, abonnement_1.prochainNumeroFactureAbo)((existantes ?? []).map((r) => r.numero), new Date().getFullYear()),
        plan: p.plan,
        grille: aboLu.grille,
        montant: await prixDynamiqueServeur(supabase, p.plan, aboLu.grille),
        devise: "USD",
        date_emission: maintenant,
        date_debut: maintenant,
        date_fin: (0, abonnement_1.ajouterMois)(maintenant, 1),
        moyen: "mobile_money",
        statut: "payee",
        stripe_invoice_id: null,
        reference_mobile_money: reference,
    });
    // Anti-fraude (signal c) : au PREMIER paiement, capturer le pays du
    // moyen de paiement (préfixe du numéro) ; contradiction avec la grille
    // attribuée → compte « a_verifier » (la console décide, rien d'auto).
    try {
        const { data: profil } = await supabase
            .from("profils")
            .select("pays_paiement, grille_attribuee")
            .eq("id", p.owner_id)
            .maybeSingle();
        if (profil && !profil.pays_paiement) {
            const paysPaiement = (0, grille_1.paysDepuisTelephone)(p.telephone);
            if (paysPaiement) {
                const { data: params } = await supabase
                    .from("parametres_finance")
                    .select("pays_grille_afrique")
                    .eq("id", 1)
                    .maybeSingle();
                const eligibles = params?.pays_grille_afrique ?? [];
                const statutGrille = (0, grille_1.evaluerPaysPaiement)(aboLu.grille, paysPaiement, eligibles);
                await supabase
                    .from("profils")
                    .update({
                    pays_paiement: paysPaiement,
                    ...(statutGrille === "a_verifier" ? { grille_statut: "a_verifier" } : {}),
                })
                    .eq("id", p.owner_id);
            }
        }
    }
    catch {
        // Le signal (c) ne doit jamais bloquer la confirmation du paiement.
    }
    return server_1.NextResponse.json({ received: true, applied: true, statut: "confirme" });
}

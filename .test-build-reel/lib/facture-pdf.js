"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.genererFactureAboPdf = genererFactureAboPdf;
exports.telechargerFactureAboPdf = telechargerFactureAboPdf;
/**
 * CizaImmo — facture d'abonnement PDF (Module 5, spec §12).
 *
 * Générée côté client avec jsPDF (aucun envoi serveur) : CizaImmo —
 * division de Ciza Group, numéro unique, dates de période, plan et
 * grille, montant mensuel en USD, moyen de paiement. Modèle bleu marine
 * et or, une page A4. En démo, la facture porte la mention DÉMO.
 */
const jspdf_1 = require("jspdf");
const format_1 = require("./format");
const NAVY = [27, 42, 74];
const GOLD = [212, 175, 55];
const GRIS = [100, 116, 139];
const TEXTES = {
    fr: {
        titre: "Facture d'abonnement",
        numero: "Facture n°",
        dateEmission: "Date d'émission",
        periode: "Période couverte",
        plan: "Plan",
        grille: "Grille",
        grilleAfrique: "Afrique",
        grilleInternationale: "Internationale",
        montant: "Montant mensuel",
        moyen: "Moyen de paiement",
        moyenStripe: "Carte bancaire (Stripe)",
        moyenMobileMoney: "Mobile money",
        moyenDemo: "Simulation démo",
        reference: "Référence",
        statut: "Statut",
        statutPayee: "Payée",
        statutEnAttente: "En attente",
        statutAnnulee: "Annulée",
        demo: "DÉMO — facture simulée, aucun paiement réel",
        mention: "CizaImmo, division de Ciza Group — abonnement mensuel, compté en blocs.",
    },
    en: {
        titre: "Subscription invoice",
        numero: "Invoice No.",
        dateEmission: "Issue on",
        periode: "Billing period",
        plan: "Plan",
        grille: "Pricing",
        grilleAfrique: "Africa",
        grilleInternationale: "International",
        montant: "Monthly amount",
        moyen: "Payment method",
        moyenStripe: "Card (Stripe)",
        moyenMobileMoney: "Mobile money",
        moyenDemo: "Demo simulation",
        reference: "Reference",
        statut: "Status",
        statutPayee: "Paid",
        statutEnAttente: "Pending",
        statutAnnulee: "Cancelled",
        demo: "DEMO — simulated invoice, no real payment",
        mention: "CizaImmo, a division of Ciza Group — monthly subscription, billed per block.",
    },
};
function nomPlan(plan) {
    return plan === "starter" ? "Starter" : plan === "pro" ? "Pro" : "Agence";
}
function genererFactureAboPdf(d) {
    const t = TEXTES[d.langue];
    const f = d.facture;
    const doc = new jspdf_1.jsPDF();
    const largeur = 210;
    // En-tête navy.
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, largeur, 34, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("CIZAIMMO", 14, 14);
    doc.setTextColor(...GOLD);
    doc.setFontSize(11);
    doc.text(t.titre, 14, 24);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`${t.numero} ${f.numero}`, 196, 14, { align: "right" });
    doc.text(`${t.dateEmission} : ${(0, format_1.formatDate)(f.date_emission, d.langue)}`, 196, 24, { align: "right" });
    let y = 48;
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const lignes = [
        [t.plan, nomPlan(f.plan)],
        [t.grille, f.grille === "afrique" ? t.grilleAfrique : t.grilleInternationale],
        [t.periode, `${(0, format_1.formatDate)(f.date_debut, d.langue)} — ${(0, format_1.formatDate)(f.date_fin, d.langue)}`],
        [t.moyen, f.moyen === "stripe" ? t.moyenStripe : f.moyen === "mobile_money" ? t.moyenMobileMoney : t.moyenDemo],
        [t.reference, f.reference_mobile_money ?? f.stripe_invoice_id ?? "—"],
        [t.statut, f.statut === "payee" ? t.statutPayee : f.statut === "en_attente" ? t.statutEnAttente : t.statutAnnulee],
    ];
    for (const [cle, valeur] of lignes) {
        doc.setFont("helvetica", "bold");
        doc.text(cle, 14, y);
        doc.setFont("helvetica", "normal");
        doc.text(valeur, 60, y);
        y += 8;
    }
    // Montant.
    y += 6;
    doc.setFillColor(245, 245, 244);
    doc.rect(14, y - 6, 182, 16, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(t.montant, 18, y + 5);
    doc.text((0, format_1.formatMoney)(f.montant, "USD", d.langue), 192, y + 5, { align: "right" });
    y += 28;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRIS);
    doc.text(t.mention, 14, y);
    if (d.demo) {
        y += 8;
        doc.setTextColor(185, 28, 28);
        doc.setFont("helvetica", "bold");
        doc.text(t.demo, 14, y);
    }
    return doc;
}
function telechargerFactureAboPdf(d) {
    const doc = genererFactureAboPdf(d);
    doc.save(`facture-${d.facture.numero}.pdf`);
}

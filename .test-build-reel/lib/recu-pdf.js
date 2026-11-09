"use strict";
/**
 * CizaImmo — reçu PDF (Module 3, spec §11).
 *
 * Généré côté client avec jsPDF (aucun envoi serveur) : logo et nom
 * CizaImmo — division de Ciza Group, numéro unique, date d'émission,
 * émetteur, locataire, immeuble et appartement, mois concerné, montant en
 * chiffres ET en lettres, devise, moyen de paiement, restant dû après ce
 * paiement, mention « Paiement déclaré par le gestionnaire — CizaImmo
 * n'encaisse pas les loyers ». Modèle bleu marine et or, une page A4.
 *
 * RÈGLE : un reçu émis ne se modifie pas — un reçu annulé est régénéré
 * avec la mention ANNULÉ bien visible, sous le même numéro.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.creerDocumentRecu = creerDocumentRecu;
exports.telechargerRecuPdf = telechargerRecuPdf;
exports.telechargerRecu = telechargerRecu;
const jspdf_1 = require("jspdf");
const format_1 = require("./format");
const loyers_1 = require("./loyers");
const NAVY = [27, 42, 74];
const GOLD = [212, 175, 55];
const GRIS = [100, 116, 139];
const ROUGE = [185, 28, 28];
const TEXTES = {
    fr: {
        titre: "Reçu de paiement de loyer",
        annule: "ANNULÉ",
        numero: "Reçu n°",
        dateEmission: "Date d'émission",
        emetteur: "Émis par (propriétaire / gestionnaire)",
        locataire: "Locataire",
        bien: "Immeuble — appartement",
        mois: "Mois concerné",
        moyen: "Moyen de paiement",
        datePaiement: "Date du paiement",
        reference: "Référence",
        montantChiffres: "Montant reçu",
        montantLettres: "Montant en lettres",
        restant: "Restant dû après ce paiement",
        mention: "Paiement déclaré par le gestionnaire — CizaImmo n'encaisse pas les loyers.",
        division: "CizaImmo — division de Ciza Group",
        nonRenseigne: "Non renseigné",
    },
    en: {
        titre: "Rent payment receipt",
        annule: "CANCELLED",
        numero: "Receipt No.",
        dateEmission: "Issue date",
        emetteur: "Issued by (owner / manager)",
        locataire: "Tenant",
        bien: "Building — unit",
        mois: "Month covered",
        moyen: "Payment method",
        datePaiement: "Payment date",
        reference: "Reference",
        montantChiffres: "Amount received",
        montantLettres: "Amount in words",
        restant: "Balance due after this payment",
        mention: "Payment declared by the manager — CizaImmo never collects rent.",
        division: "CizaImmo — a division of Ciza Group",
        nonRenseigne: "Not provided",
    },
};
function moisAffiche(moisIso, langue) {
    const [annee, mois] = (0, loyers_1.isoVersMois)(moisIso).split("-").map(Number);
    return new Intl.DateTimeFormat(langue === "en" ? "en-US" : "fr-FR", {
        month: "long",
        year: "numeric",
    }).format(new Date(annee, mois - 1, 1));
}
function creerDocumentRecu(d) {
    const t = TEXTES[d.langue];
    const doc = new jspdf_1.jsPDF({ unit: "mm", format: "a4" });
    const largeur = 210;
    const marge = 18;
    let y = 0;
    // Bandeau supérieur bleu marine + liseré or.
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, largeur, 38, "F");
    doc.setFillColor(...GOLD);
    doc.rect(0, 38, largeur, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("CIZA", marge, 16);
    const largeurCiza = doc.getTextWidth("CIZA");
    doc.setTextColor(...GOLD);
    doc.text("IMMO", marge + largeurCiza + 1, 16);
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(t.division, marge, 25);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(t.titre, marge, 33);
    y = 52;
    if (d.statut === "annule") {
        doc.setTextColor(...ROUGE);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(20);
        doc.text(t.annule, largeur - marge, y, { align: "right" });
        doc.setDrawColor(...ROUGE);
        doc.setLineWidth(0.8);
        const w = doc.getTextWidth(t.annule) + 8;
        doc.rect(largeur - marge - w, y - 8, w, 11);
        y += 12;
    }
    // Champs du reçu.
    const lignes = [
        [t.numero, d.numero],
        [t.dateEmission, (0, format_1.formatDate)(d.dateEmission, d.langue)],
        [t.emetteur, d.emetteurNom],
        [t.locataire, d.locataireNom],
        [t.bien, `${d.immeubleNom} — ${d.appartementNumero}`],
        [t.mois, moisAffiche(d.mois, d.langue)],
        [t.moyen, d.moyen],
        [t.datePaiement, (0, format_1.formatDate)(d.datePaiement, d.langue)],
        [t.reference, d.reference ?? t.nonRenseigne],
    ];
    doc.setFontSize(11);
    for (const [etiquette, valeur] of lignes) {
        doc.setTextColor(...GRIS);
        doc.setFont("helvetica", "normal");
        doc.text(etiquette, marge, y);
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        const lignesValeur = doc.splitTextToSize(valeur, largeur - marge * 2 - 52);
        doc.text(lignesValeur, marge + 52, y);
        y += 7 * lignesValeur.length + 1;
    }
    y += 4;
    // Encadré montant : chiffres + lettres.
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.6);
    doc.setFillColor(255, 251, 235);
    doc.roundedRect(marge, y, largeur - marge * 2, 34, 3, 3, "FD");
    doc.setTextColor(...GRIS);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(t.montantChiffres, marge + 4, y + 7);
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text((0, format_1.formatMoney)(d.montant, d.devise, d.langue), marge + 4, y + 15);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lettres = doc.splitTextToSize(`${t.montantLettres} : ${(0, loyers_1.nombreEnLettres)(d.montant, d.langue)} ${d.devise}`, largeur - marge * 2 - 8);
    doc.text(lettres, marge + 4, y + 22);
    y += 42;
    doc.setFontSize(11);
    doc.setTextColor(...GRIS);
    doc.setFont("helvetica", "normal");
    doc.text(t.restant, marge, y);
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.text((0, format_1.formatMoney)(d.restantApres, d.devise, d.langue), marge + 62, y);
    y += 16;
    // Mention permanente + pied de page.
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.4);
    doc.line(marge, y, largeur - marge, y);
    y += 8;
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const mention = doc.splitTextToSize(t.mention, largeur - marge * 2);
    doc.text(mention, marge, y);
    y += 7 * mention.length + 6;
    doc.setTextColor(...GRIS);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("cizaimmo.com", marge, y);
    return doc;
}
/** Télécharge le reçu en PDF (nom de fichier = numéro du reçu). */
function telechargerRecuPdf(donnees) {
    const doc = creerDocumentRecu(donnees);
    doc.save(`${donnees.numero}.pdf`);
}
/**
 * Raccourci utilisé par les pages Loyers et Reçus : construit les données
 * du PDF à partir d'un reçu et du restant dû après ce paiement, puis
 * télécharge le fichier. Le libellé du moyen de paiement est déjà traduit
 * par la page appelante.
 */
function telechargerRecu(recu, args) {
    telechargerRecuPdf({
        numero: recu.numero,
        dateEmission: recu.date_emission,
        emetteurNom: args.emetteurNom,
        locataireNom: recu.locataire_nom,
        immeubleNom: recu.immeuble_nom,
        appartementNumero: recu.appartement_numero,
        mois: recu.mois,
        montant: recu.montant,
        devise: recu.devise,
        moyen: args.moyenLabel,
        datePaiement: recu.date_paiement,
        reference: recu.reference,
        restantApres: args.restantApres,
        statut: recu.statut,
        langue: args.langue,
    });
}

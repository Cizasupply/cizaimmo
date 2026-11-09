"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLoyersWorkbook = buildLoyersWorkbook;
exports.buildDepensesWorkbook = buildDepensesWorkbook;
exports.buildLocatairesWorkbook = buildLocatairesWorkbook;
exports.buildRapportWorkbook = buildRapportWorkbook;
exports.telechargerWorkbook = telechargerWorkbook;
/**
 * CizaImmo — exports Excel (Module 4, spec §11).
 * Librairie : xlsx (SheetJS). Chaque export respecte les filtres actifs à
 * l'écran (les données filtrées sont passées en entrée) et mentionne en
 * première ligne la période, la date d'export et les devises concernées.
 * Aucun export n'est ajouté ailleurs que Loyers, Dépenses, Locataires,
 * Rapports.
 */
const XLSX = __importStar(require("xlsx"));
function ligneMeta(meta) {
    return [
        `Période : ${meta.periode} — Export du ${meta.dateExport} — Devises : ${meta.devises.join(", ") || "—"}`,
    ];
}
function feuilleAvecMeta(titre, entetes, lignes, meta) {
    const donnees = [ligneMeta(meta), [], entetes, ...lignes];
    const ws = XLSX.utils.aoa_to_sheet(donnees);
    ws["!cols"] = entetes.map(() => ({ wch: 22 }));
    return ws;
}
/** Excel Loyers : feuilles « Loyers », « Paiements », « Synthèse » (spec §11). */
function buildLoyersWorkbook(donnees, meta) {
    const wb = XLSX.utils.book_new();
    const lignesLoyers = donnees.echeances.map(({ echeance, bail, locataire, appartement, immeuble, paye, restant }) => [
        echeance.mois.slice(0, 7),
        locataire?.nom ?? "—",
        appartement?.numero ?? "—",
        immeuble?.nom ?? "—",
        echeance.montant_du,
        echeance.devise,
        paye,
        restant,
        echeance.statut,
        bail?.jour_exigibilite ?? "",
    ]);
    XLSX.utils.book_append_sheet(wb, feuilleAvecMeta("Loyers", ["Mois", "Locataire", "Appartement", "Immeuble", "Loyer dû", "Devise", "Payé (déclaré)", "Restant", "Statut", "Jour d'exigibilité"], lignesLoyers, meta), "Loyers");
    const lignesPaiements = donnees.paiements.map(({ paiement, locataireNom, mois }) => [
        mois.slice(0, 7),
        paiement.recu_numero ?? "—",
        locataireNom,
        paiement.date_paiement,
        paiement.montant,
        paiement.devise,
        paiement.moyen,
        paiement.reference ?? "",
        paiement.statut,
    ]);
    XLSX.utils.book_append_sheet(wb, feuilleAvecMeta("Paiements", ["Mois", "N° reçu", "Locataire", "Date du paiement", "Montant", "Devise", "Moyen", "Référence", "Statut"], lignesPaiements, meta), "Paiements");
    // Synthèse : totaux par mois et par immeuble (par devise, jamais mélangés).
    const cle = new Map();
    for (const { echeance, immeuble, paye } of donnees.echeances) {
        const k = `${echeance.mois.slice(0, 7)}|${immeuble?.nom ?? "—"}|${echeance.devise}`;
        const ligne = cle.get(k) ?? { mois: echeance.mois.slice(0, 7), immeuble: immeuble?.nom ?? "—", devise: echeance.devise, du: 0, paye: 0 };
        ligne.du += echeance.montant_du;
        ligne.paye += paye;
        cle.set(k, ligne);
    }
    const lignesSynthese = Array.from(cle.values())
        .sort((a, b) => a.mois.localeCompare(b.mois) || a.immeuble.localeCompare(b.immeuble))
        .map((l) => [l.mois, l.immeuble, l.devise, l.du, l.paye, Math.max(0, l.du - l.paye)]);
    XLSX.utils.book_append_sheet(wb, feuilleAvecMeta("Synthèse", ["Mois", "Immeuble", "Devise", "Total dû", "Total payé (déclaré)", "Restant"], lignesSynthese, meta), "Synthèse");
    return wb;
}
/** Excel Dépenses : une ligne par dépense (spec §11). */
function buildDepensesWorkbook(depenses, noms, meta) {
    const wb = XLSX.utils.book_new();
    const lignes = depenses.map((d) => [
        d.date,
        noms.immeuble(d.immeuble_id),
        noms.appartement(d.appartement_id),
        d.categorie,
        d.libelle,
        d.montant,
        d.devise,
        d.fournisseur ?? "",
        d.justificatif_url ? "Oui" : "Non",
    ]);
    XLSX.utils.book_append_sheet(wb, feuilleAvecMeta("Dépenses", ["Date", "Immeuble", "Appartement", "Catégorie", "Libellé", "Montant", "Devise", "Fournisseur", "Justificatif joint"], lignes, meta), "Dépenses");
    return wb;
}
/** Excel Locataires : annuaire (spec §11). */
function buildLocatairesWorkbook(locataires, meta) {
    const wb = XLSX.utils.book_new();
    const lignes = locataires.map(({ locataire, appartement, immeuble, bail, statutMois }) => [
        locataire.nom,
        locataire.telephone,
        locataire.email ?? "",
        appartement?.numero ?? "—",
        immeuble?.nom ?? "—",
        bail ? `${bail.debut.slice(0, 10)} → ${bail.fin ? bail.fin.slice(0, 10) : "—"}` : "—",
        statutMois,
    ]);
    XLSX.utils.book_append_sheet(wb, feuilleAvecMeta("Locataires", ["Nom", "Téléphone", "E-mail", "Appartement", "Immeuble", "Bail en cours", "Statut du mois"], lignes, meta), "Locataires");
    return wb;
}
/** Excel Rapport : données du rapport (revenus, dépenses, ROI, marge nette). */
function buildRapportWorkbook(rapport, meta) {
    const wb = XLSX.utils.book_new();
    const lignes = rapport.lignes.map((l) => [
        l.immeuble_nom,
        l.devise,
        l.revenus,
        l.depenses,
        l.resultatNet,
        l.valeurBien ?? "valeur à renseigner",
        l.roi === null ? "valeur à renseigner" : Math.round(l.roi * 10000) / 100,
        l.marge === null ? "—" : Math.round(l.marge * 10000) / 100,
        l.occupation === null ? "—" : Math.round(l.occupation * 1000) / 10,
        l.nbAppartements,
    ]);
    const ws = feuilleAvecMeta("Rapport", ["Immeuble", "Devise", "Revenus déclarés", "Dépenses", "Résultat net", "Valeur du bien", "ROI (%)", "Marge nette (%)", "Occupation (%)", "Appartements"], lignes, meta);
    XLSX.utils.book_append_sheet(wb, ws, "Rapport");
    const lignesTaux = meta.tauxUtilises.map((t) => [t]);
    XLSX.utils.book_append_sheet(wb, feuilleAvecMeta("Taux utilisés", ["Taux (source → cible, valeur, date, source)"], lignesTaux, meta), "Taux utilisés");
    return wb;
}
/** Télécharge un classeur côté client (nom de fichier horodaté). */
function telechargerWorkbook(wb, nomFichier) {
    XLSX.writeFile(wb, nomFichier);
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bailActif = bailActif;
exports.statsImmeuble = statsImmeuble;
exports.moisCourant = moisCourant;
const format_1 = require("./format");
function bailActif(baux, appartementId) {
    return baux.find((b) => b.appartement_id === appartementId && b.statut === "actif");
}
function statsImmeuble(immeuble, appartements, baux, echeances, paiements, depenses) {
    const apts = appartements.filter((a) => a.immeuble_id === immeuble.id && !a.archive);
    const louables = apts.filter((a) => a.statut !== "travaux");
    const bauxActifs = baux.filter((b) => b.statut === "actif" && apts.some((a) => a.id === b.appartement_id));
    const nbOccupes = apts.filter((a) => bailActif(baux, a.id)).length;
    const loyersMois = bauxActifs
        .filter((b) => b.devise === immeuble.devise)
        .reduce((s, b) => s + b.loyer_mensuel, 0);
    const deviseValeur = immeuble.devise_valeur ?? immeuble.devise;
    const echeanceIds = new Set(echeances
        .filter((e) => bauxActifs.some((b) => b.id === e.bail_id))
        .map((e) => e.id));
    const revenus = paiements
        .filter((p) => p.statut === "valide" && echeanceIds.has(p.echeance_id) && p.devise === deviseValeur)
        .reduce((s, p) => s + p.montant, 0);
    const depensesTotal = depenses
        .filter((d) => d.immeuble_id === immeuble.id && d.devise === deviseValeur)
        .reduce((s, d) => s + d.montant, 0);
    return {
        nbAppartements: apts.length,
        nbOccupes,
        nbLouables: louables.length,
        occupation: louables.length > 0 ? nbOccupes / louables.length : null,
        loyersMois,
        revenus,
        depenses: depensesTotal,
        roi: (0, format_1.calculerRoi)(revenus, depensesTotal, immeuble.valeur_bien),
        marge: (0, format_1.calculerMargeNette)(revenus, depensesTotal),
        deviseValeur: immeuble.valeur_bien ? deviseValeur : null,
    };
}
/** Premier jour du mois en cours (AAAA-MM-01), pour le statut du mois. */
function moisCourant() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

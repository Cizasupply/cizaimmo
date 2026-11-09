"use strict";
// Dossier employé des Admins (2026-11-08, décision du fondateur) :
// un Admin (employé) remplit SON dossier complet — photo de profil,
// pièce d'identité, téléphone et ADRESSE postale (adresse, ville,
// code postal optionnel, pays) — comme le dossier d'un client, en
// plus complet.
//
// La complétude est CALCULÉE ici, fonction pure partagée par les deux
// fournisseurs (réel + démo) et verrouillée par les tests : aucun
// statut n'est stocké, ni en base ni en démo — la présence des 4
// éléments EST le statut (patron « la base est la source de vérité »
// + exigence suivie NON bloquante du contrat propriétaires option C :
// l'accès console n'est jamais conditionné au dossier).
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluerDossierEmploye = evaluerDossierEmploye;
function rempli(valeur) {
    return typeof valeur === "string" && valeur.trim().length > 0;
}
/**
 * Évalue la complétude d'un dossier employé. L'adresse est complète
 * si adresse + ville + pays sont renseignés (le code postal est
 * optionnel et n'entre jamais dans le calcul).
 */
function evaluerDossierEmploye(ingredients) {
    const manquants = [];
    if (!ingredients.photoPresente)
        manquants.push("photo");
    if (!ingredients.piecePresente)
        manquants.push("piece_identite");
    if (!rempli(ingredients.telephone))
        manquants.push("telephone");
    const adresseComplete = rempli(ingredients.adresse) &&
        rempli(ingredients.adresseVille) &&
        rempli(ingredients.adressePays);
    if (!adresseComplete)
        manquants.push("adresse");
    return { complet: manquants.length === 0, manquants };
}

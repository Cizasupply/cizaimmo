"use strict";
/**
 * CizaImmo — Pack employé des Admins (2026-11-08, pack VALIDÉ par le
 * fondateur) : par-dessus le dossier employé (identité + adresse),
 * le CONTRAT d'engagement à signer, la CHARTE de confidentialité
 * acceptée et datée, et la CARTE employé à code-barres vérifiée
 * contre la base.
 *
 * Ce module porte les types et la logique PURE du pack (aucun
 * statut de carte ou de progression n'est stocké : tout est CALCULÉ
 * à partir du dossier, de la charte et du contrat — la base reste
 * la source de vérité, patron du dossier employé).
 *
 * Contrat à DEUX VOIES (décision validée) :
 *  - « travail »    : contrat de travail — employé au Burundi ;
 *  - « prestation » : contrat de prestation de services —
 *                     collaborateur indépendant hors du Burundi.
 * Exigence suivie, NON BLOQUANTE (patron option C) : aucun état du
 * pack ne conditionne l'accès console de l'employé.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.carteEmployeEmise = carteEmployeEmise;
exports.blocagesCarteEmploye = blocagesCarteEmploye;
exports.progressionPackEmploye = progressionPackEmploye;
exports.verificationEmployeValide = verificationEmployeValide;
exports.verdictVerificationEmploye = verdictVerificationEmploye;
exports.filtrerMembresEmployes = filtrerMembresEmployes;
/**
 * La carte employé est ÉMISE si et seulement si le dossier employé
 * est COMPLET et le contrat d'engagement est VALIDÉ. Calculé —
 * jamais stocké : si l'employé est suspendu ensuite, la
 * vérification contre la base ne « passe » plus (voir
 * verificationEmployeValide).
 */
function carteEmployeEmise(dossierComplet, statutContrat) {
    return dossierComplet && statutContrat === "valide";
}
/** Blocages restants avant émission de la carte (vide si émise). */
function blocagesCarteEmploye(dossierComplet, statutContrat) {
    const blocages = [];
    if (!dossierComplet)
        blocages.push("dossier");
    if (statutContrat !== "valide")
        blocages.push("contrat");
    return blocages;
}
/**
 * Progression en 4 étapes (Dossier → Charte → Contrat → Carte),
 * calculée : « faite » quand l'étape est accomplie, « en_cours »
 * pour la première étape non accomplie, « a_faire » ensuite.
 * Le contrat est « en cours » dès qu'il est préparé (à signer,
 * déposé ou refusé — un refus se corrige par un nouveau dépôt).
 */
function progressionPackEmploye(entrees) {
    const accomplies = {
        dossier: entrees.dossierComplet,
        charte: !!entrees.charteAccepteeLe,
        contrat: entrees.statutContrat === "valide",
        carte: entrees.carteEmise,
    };
    const ordre = ["dossier", "charte", "contrat", "carte"];
    let premierNonFait = true;
    return ordre.map((etape) => {
        if (accomplies[etape])
            return { etape, etat: "faite" };
        if (premierNonFait) {
            premierNonFait = false;
            return { etape, etat: "en_cours" };
        }
        return { etape, etat: "a_faire" };
    });
}
/**
 * Résultat d'une VÉRIFICATION contre la base : la carte « passe »
 * si le compte est ACTIF (non suspendu, accès console ouvert).
 * Un compte suspendu ressort donc toujours NON VALIDE, même avec
 * un dossier complet et un contrat validé.
 */
function verificationEmployeValide(entrees) {
    return entrees.statutCompte === "actif" && entrees.accesConsoleActif;
}
function verdictVerificationEmploye(entrees) {
    if (!verificationEmployeValide(entrees))
        return "non_valide";
    return entrees.carteEmise ? "valide" : "carte_non_emise";
}
function normaliserRecherche(valeur) {
    return valeur
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}
function filtrerMembresEmployes(membres, recherche) {
    const q = normaliserRecherche(recherche ?? "");
    if (!q)
        return [...membres];
    return membres.filter((m) => normaliserRecherche(m.nom).includes(q) ||
        normaliserRecherche(m.display_id ?? "").includes(q));
}

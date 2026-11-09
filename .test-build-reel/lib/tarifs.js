"use strict";
/**
 * CizaImmo — tarifs et paramètres finance DYNAMIQUES (extension v1.2).
 *
 * Exigence du fondateur : RIEN EN DUR. Les prix vivent dans la table
 * tarifs_plateforme (mode réel : Supabase ; mode démo : seed local) et
 * les paramètres dans parametres_finance. Le front public (page tarifs,
 * mini-grille de l'accueil), la page abonnement et la facturation lisent
 * cette source via la couche data — changer un prix dans la table ou la
 * console change l'affichage sans redéploiement.
 *
 * Les seuls littéraux de prix du code sont dans lib/abonnement.ts
 * (PRIX_PLANS) : ils servent EXCLUSIVEMENT de seed initial de la table
 * et de repli si la source est injoignable — jamais d'affichage direct.
 *
 * Fonctions pures, testables : construction de la grille de prix,
 * détection des retards de paiement, conversion + arrondis propres pour
 * l'affichage public dans les 12 devises.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAS_ARRONDI_AFFICHAGE = exports.PARAMETRES_FINANCE_DEFAUT = exports.TARIFS_SEED = void 0;
exports.construirePrixPlans = construirePrixPlans;
exports.prixDepuisTarifs = prixDepuisTarifs;
exports.estEnRetardPaiement = estEnRetardPaiement;
exports.arrondirMontantAffiche = arrondirMontantAffiche;
exports.convertirPrixAffichage = convertirPrixAffichage;
const abonnement_1 = require("./abonnement");
const grille_1 = require("./grille");
const module4_1 = require("./module4");
/** Seed initial de tarifs_plateforme = tarifs verrouillés v1.1 (USD). */
exports.TARIFS_SEED = Object.entries(abonnement_1.PRIX_PLANS).flatMap(([plan, parGrille]) => Object.entries(parGrille).map(([grille, prix]) => ({
    id: `seed-${grille}-${plan}`,
    grille,
    plan,
    prix_mensuel: prix,
    devise: "USD",
    updated_at: "2026-11-06T00:00:00.000Z",
    updated_by: null,
})));
/** Paramètres finance par défaut (= seed de parametres_finance). */
exports.PARAMETRES_FINANCE_DEFAUT = {
    remise_annuelle_pct: 20,
    jours_essai: 30,
    jours_grace: 5,
    penalites_retard_actives: false,
    pays_grille_afrique: [...grille_1.PAYS_GRILLE_AFRIQUE_SEED],
    delai_approbation_affiche: "24 h ouvrées",
};
/**
 * Construit la grille { plan: { grille: prix } } à partir des lignes de
 * la table. Base = PRIX_PLANS (repli), chaque ligne de la table écrase
 * la valeur : une table partielle ne casse jamais l'affichage.
 */
function construirePrixPlans(tarifs) {
    const prix = {
        starter: { ...abonnement_1.PRIX_PLANS.starter },
        pro: { ...abonnement_1.PRIX_PLANS.pro },
        agence: { ...abonnement_1.PRIX_PLANS.agence },
    };
    for (const t of tarifs) {
        if (t && prix[t.plan] && typeof t.prix_mensuel === "number" && t.prix_mensuel > 0) {
            prix[t.plan][t.grille] = t.prix_mensuel;
        }
    }
    return prix;
}
/** Prix mensuel d'un plan dans une grille, lu depuis les lignes de la table. */
function prixDepuisTarifs(tarifs, plan, grille) {
    return construirePrixPlans(tarifs)[plan][grille];
}
/**
 * Retard de paiement d'abonnement (console) :
 * - échec de paiement signalé (la grâce d'échec de 7 jours du §12 reste
 *   gérée par le statut lecture seule, pas par cet indicateur), OU
 * - période payée terminée depuis plus de jours_grace (paramètre base)
 *   sans renouvellement.
 */
function estEnRetardPaiement(abo, parametres, maintenant = new Date()) {
    if (!abo)
        return false;
    if (abo.statut === "suspendu" || abo.statut === "annule")
        return false;
    if (abo.echec_paiement)
        return true;
    if (abo.statut === "actif" && abo.fin_periode) {
        const limite = new Date(abo.fin_periode).getTime() +
            parametres.jours_grace * 24 * 60 * 60 * 1000;
        if (maintenant.getTime() > limite)
            return true;
    }
    return false;
}
// ---------------------------------------------------------------------------
// Affichage public multi-devises (mini-grille de l'accueil).
// Les prix de la table sont en USD ; la conversion utilise les taux
// stockés (automatiques ~1×/jour ou manuels datés) — la DATE du taux est
// toujours affichée à côté, jamais « en direct ».
// ---------------------------------------------------------------------------
/**
 * Pas d'arrondi « propre » par devise : les devises sans centimes utiles
 * sont arrondies AU-DESSUS au pas indiqué (lisibilité téléphone) ; les
 * autres gardent 2 décimales.
 */
exports.PAS_ARRONDI_AFFICHAGE = {
    BIF: 100,
    XAF: 100,
    XOF: 100,
    UGX: 100,
    KES: 10,
    TZS: 10,
    RWF: 10,
};
/** Arrondit un montant converti pour l'affichage public (jamais en dessous). */
function arrondirMontantAffiche(montant, devise) {
    const pas = exports.PAS_ARRONDI_AFFICHAGE[devise];
    if (pas && pas > 0)
        return Math.ceil(montant / pas) * pas;
    return Math.round(montant * 100) / 100;
}
/**
 * Convertit un prix USD vers la devise choisie pour l'affichage public.
 * Retourne null si aucun taux n'existe pour la paire (l'écran retombe
 * alors sur l'USD — un taux n'est jamais inventé).
 */
function convertirPrixAffichage(montantUsd, devise, taux) {
    if (devise === "USD")
        return { montant: montantUsd, devise, dateTaux: null };
    const conversion = (0, module4_1.convertirMontant)(montantUsd, "USD", devise, taux);
    if (!conversion)
        return null;
    return {
        montant: arrondirMontantAffiche(conversion.montant, devise),
        devise,
        dateTaux: conversion.taux.date_taux,
    };
}

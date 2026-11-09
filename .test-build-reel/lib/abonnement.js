"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INDIVISION_PAR_PLAN = exports.VITRINE_PAR_PLAN = exports.GESTIONNAIRES_MAX = exports.RANG_PLAN = exports.PRIX_PLANS = exports.MOBILE_MONEY_EXPIRATION_HEURES = exports.RETENTION_LECTURE_SEULE_JOURS = exports.GRACE_ECHEC_PAIEMENT_JOURS = exports.ESSAI_JOURS = void 0;
exports.prixPlan = prixPlan;
exports.grillePourPays = grillePourPays;
exports.ajouterJours = ajouterJours;
exports.ajouterMois = ajouterMois;
exports.estLectureSeule = estLectureSeule;
exports.appliquerTransitions = appliquerTransitions;
exports.prochainNumeroFactureAbo = prochainNumeroFactureAbo;
exports.genererReferenceMobileMoney = genererReferenceMobileMoney;
exports.telephoneMobileMoneyValide = telephoneMobileMoneyValide;
const countries_1 = require("./countries");
/** Durées verrouillées (spec §12). */
exports.ESSAI_JOURS = 30;
exports.GRACE_ECHEC_PAIEMENT_JOURS = 7;
exports.RETENTION_LECTURE_SEULE_JOURS = 90;
exports.MOBILE_MONEY_EXPIRATION_HEURES = 24;
/** Prix mensuels verrouillés (spec §12), en USD. */
exports.PRIX_PLANS = {
    starter: { afrique: 1.99, internationale: 4.99 },
    pro: { afrique: 5.99, internationale: 14.99 },
    agence: { afrique: 11.99, internationale: 29.99 },
};
function prixPlan(plan, grille) {
    return exports.PRIX_PLANS[plan][grille];
}
/** Rang d'un plan (pour décider montée / descente). */
exports.RANG_PLAN = {
    starter: 1,
    pro: 2,
    agence: 3,
};
/** Gestionnaires invités par plan (spec §12). */
exports.GESTIONNAIRES_MAX = {
    starter: 0,
    pro: 2,
    agence: Number.POSITIVE_INFINITY,
};
/** Vitrine « appartements à louer » par plan (spec §12). */
exports.VITRINE_PAR_PLAN = {
    starter: false,
    pro: true,
    agence: true,
};
/** Indivision familiale par plan (spec §12). */
exports.INDIVISION_PAR_PLAN = {
    starter: false,
    pro: true,
    agence: true,
};
/**
 * Grille applicable, déterminée par le pays du compte à l'inscription
 * (spec §12). Un changement de pays ne change pas la grille en cours
 * de période : la grille est figée sur l'abonnement, jamais recalculée
 * à la lecture.
 */
function grillePourPays(pays) {
    if (!pays)
        return "internationale";
    return countries_1.PAYS_AFRIQUE.includes(pays.trim()) ? "afrique" : "internationale";
}
function ajouterJours(iso, jours) {
    return new Date(new Date(iso).getTime() + jours * 24 * 60 * 60 * 1000).toISOString();
}
function ajouterMois(iso, mois = 1) {
    const d = new Date(iso);
    d.setMonth(d.getMonth() + mois);
    return d.toISOString();
}
/**
 * L'abonnement est-il en lecture seule à cet instant ?
 *  - statut lecture_seule / annule : oui ;
 *  - essai dont la fin est dépassée sans abonnement : oui ;
 *  - période de grâce d'un échec de paiement dépassée : oui.
 * Pendant la grâce (7 jours), le fonctionnement reste normal.
 */
function estLectureSeule(abo, maintenant = new Date()) {
    if (abo.statut === "lecture_seule" || abo.statut === "annule")
        return true;
    // Extension v1.2 : suspendu par la plateforme = bloqué ; en attente
    // d'approbation (ajout n°3) = aucune écriture tant que non approuvé.
    if (abo.statut === "suspendu" || abo.statut === "en_attente")
        return true;
    if (abo.statut === "essai" && abo.trial_ends_at) {
        if (maintenant.getTime() > new Date(abo.trial_ends_at).getTime())
            return true;
    }
    if (abo.statut === "actif" && abo.echec_paiement && abo.grace_ends_at) {
        if (maintenant.getTime() > new Date(abo.grace_ends_at).getTime())
            return true;
    }
    return false;
}
/**
 * Transitions paresseuses de l'abonnement (spec §12), appliquées à chaque
 * lecture de getAbonnement() dans les deux fournisseurs :
 *  - descente de plan programmée, date d'effet atteinte -> plan appliqué ;
 *  - résiliation programmée, fin de période atteinte -> statut annulé,
 *    données conservées 90 jours en lecture seule ;
 *  - essai terminé sans abonnement -> lecture seule, 90 jours ;
 *  - grâce d'échec de paiement dépassée -> lecture seule, 90 jours.
 * Retourne l'abonnement (éventuellement modifié) et si un changement a eu lieu.
 */
function appliquerTransitions(abo, maintenant = new Date()) {
    const now = maintenant.getTime();
    let change = false;
    const maj = { ...abo };
    // 1. Descente de plan effective à la fin de la période payée.
    if (maj.plan_en_attente &&
        maj.date_effet_plan &&
        now >= new Date(maj.date_effet_plan).getTime()) {
        maj.plan = maj.plan_en_attente;
        maj.plan_en_attente = null;
        maj.date_effet_plan = null;
        change = true;
    }
    // 2. Résiliation effective en fin de période.
    if (maj.resiliation_programmee &&
        maj.statut !== "annule" &&
        maj.fin_periode &&
        now >= new Date(maj.fin_periode).getTime()) {
        maj.statut = "annule";
        maj.resiliation_programmee = false;
        maj.lecture_seule_jusqu_au = ajouterJours(maj.fin_periode, exports.RETENTION_LECTURE_SEULE_JOURS);
        change = true;
    }
    // 3. Fin d'essai sans abonnement -> lecture seule, 90 jours.
    if (maj.statut === "essai" &&
        maj.trial_ends_at &&
        now > new Date(maj.trial_ends_at).getTime()) {
        maj.statut = "lecture_seule";
        maj.lecture_seule_jusqu_au = ajouterJours(maj.trial_ends_at, exports.RETENTION_LECTURE_SEULE_JOURS);
        change = true;
    }
    // 4. Grâce d'échec de paiement dépassée -> lecture seule, 90 jours.
    if (maj.statut === "actif" &&
        maj.echec_paiement &&
        maj.grace_ends_at &&
        now > new Date(maj.grace_ends_at).getTime()) {
        maj.statut = "lecture_seule";
        maj.lecture_seule_jusqu_au = ajouterJours(maj.grace_ends_at, exports.RETENTION_LECTURE_SEULE_JOURS);
        change = true;
    }
    return { abo: maj, change };
}
/** Numéro de facture d'abonnement : CIM-ABO-AAAA-0001 (séquentiel). */
function prochainNumeroFactureAbo(numerosExistants, annee) {
    const prefixe = `CIM-ABO-${annee}-`;
    let max = 0;
    for (const n of numerosExistants) {
        if (n && n.startsWith(prefixe)) {
            const seq = parseInt(n.slice(prefixe.length), 10);
            if (Number.isFinite(seq) && seq > max)
                max = seq;
        }
    }
    return `${prefixe}${String(max + 1).padStart(4, "0")}`;
}
/** Référence de paiement mobile money : MM-XXXXXXXX (8 caractères). */
function genererReferenceMobileMoney() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I
    let ref = "MM-";
    for (let i = 0; i < 8; i++) {
        ref += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return ref;
}
/** Un numéro de téléphone mobile money est-il plausible (8 à 15 chiffres) ? */
function telephoneMobileMoneyValide(telephone) {
    const chiffres = telephone.replace(/[^0-9]/g, "");
    return chiffres.length >= 8 && chiffres.length <= 15;
}

"use strict";
/**
 * CizaImmo — Finances de la plateforme : PAIE des employés + DÉPENSES
 * supervisées (2026-11-08, décision VALIDÉE par le fondateur).
 *
 * Modèle décidé :
 *  - la PAIE s'émet DEPUIS le dossier employé : le montant, la devise
 *    et les modalités sont tirés du contrat d'engagement stocké en
 *    base (colonnes contrat_employe_* du pack employé) — rien n'est
 *    saisi à la main au moment de l'émission, donc rien ne peut
 *    diverger du contrat. Si le dossier employé est INCOMPLET,
 *    l'émission est impossible et les manquants sont listés
 *    (l'administration paie sur dossier complet, comme décidé).
 *  - les DÉPENSES de fonctionnement sont saisies par l'Admin (ou le
 *    Super Admin) et VALIDÉES par le Super Admin : celui qui saisit
 *    ne valide jamais, pas même les siennes.
 *  - périmètre : CizaImmo seulement (la finance du groupe entier
 *    relève du futur fichier central, projet garé par le fondateur).
 *
 * Ce module porte les types et la logique PURE (catégories fermées,
 * coordonnées de paiement de l'employé, blocages d'émission, totaux
 * par devise — AUCUNE conversion inventée : chaque devise est
 * totalisée séparément).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIBELLES_MOYEN_PAIEMENT = exports.MOYENS_PAIEMENT_EMPLOYE = exports.CATEGORIES_DEPENSE_PLATEFORME = void 0;
exports.categorieDepenseValide = categorieDepenseValide;
exports.moisValide = moisValide;
exports.moisCourant = moisCourant;
exports.moyenPaiementEmployeValide = moyenPaiementEmployeValide;
exports.coordonneesPaiementDepuis = coordonneesPaiementDepuis;
exports.coordonneesPaiementPresentes = coordonneesPaiementPresentes;
exports.instantaneDestinationPaiement = instantaneDestinationPaiement;
exports.blocagesPaie = blocagesPaie;
exports.totauxParDevise = totauxParDevise;
exports.CATEGORIES_DEPENSE_PLATEFORME = [
    "hebergement_services",
    "communication",
    "marketing",
    "fournitures",
    "deplacements",
    "autre",
];
function categorieDepenseValide(valeur) {
    return (typeof valeur === "string" &&
        exports.CATEGORIES_DEPENSE_PLATEFORME.includes(valeur));
}
/** Un mois au format « AAAA-MM » (mois de paie / de dépense). */
function moisValide(mois) {
    return typeof mois === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(mois);
}
/** Le mois courant au format « AAAA-MM » (défaut des sélecteurs). */
function moisCourant(date = new Date()) {
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${date.getFullYear()}-${m}`;
}
exports.MOYENS_PAIEMENT_EMPLOYE = [
    "virement",
    "mobile_money",
    "especes",
];
function moyenPaiementEmployeValide(valeur) {
    return (typeof valeur === "string" &&
        exports.MOYENS_PAIEMENT_EMPLOYE.includes(valeur));
}
function texteNonVide(valeur) {
    return typeof valeur === "string" && valeur.trim() !== ""
        ? valeur.trim()
        : null;
}
/**
 * Normalise les champs bruts en coordonnées PRÉSENTES, ou null si
 * elles sont absentes/incomplètes pour le moyen choisi :
 *  - toujours : moyen valide + titulaire ;
 *  - virement : banque ET numéro de compte (IBAN, SWIFT et agence
 *    restent optionnels) ;
 *  - mobile money : opérateur ET numéro mobile ;
 *  - espèces : rien de plus.
 */
function coordonneesPaiementDepuis(champs) {
    const titulaire = texteNonVide(champs.titulaire);
    if (!moyenPaiementEmployeValide(champs.moyen) || !titulaire) {
        return null;
    }
    const base = {
        moyen: champs.moyen,
        titulaire,
        banque: null,
        agence: null,
        numero_compte: null,
        iban: null,
        swift: null,
        operateur: null,
        numero_mobile: null,
    };
    if (champs.moyen === "virement") {
        const banque = texteNonVide(champs.banque);
        const numeroCompte = texteNonVide(champs.numero_compte);
        if (!banque || !numeroCompte)
            return null;
        return {
            ...base,
            banque,
            agence: texteNonVide(champs.agence),
            numero_compte: numeroCompte,
            iban: texteNonVide(champs.iban),
            swift: texteNonVide(champs.swift),
        };
    }
    if (champs.moyen === "mobile_money") {
        const operateur = texteNonVide(champs.operateur);
        const numeroMobile = texteNonVide(champs.numero_mobile);
        if (!operateur || !numeroMobile)
            return null;
        return { ...base, operateur, numero_mobile: numeroMobile };
    }
    return base;
}
/** Vrai si les coordonnées brutes sont PRÉSENTES (complétude calculée). */
function coordonneesPaiementPresentes(champs) {
    return coordonneesPaiementDepuis(champs) !== null;
}
/** Libellé canonique d'un moyen — sert à l'instantané figé. */
exports.LIBELLES_MOYEN_PAIEMENT = {
    virement: "Virement",
    mobile_money: "Mobile money",
    especes: "Espèces",
};
/**
 * Instantané TEXTE de la destination utilisée, figé sur la paie au
 * moment de l'émission : un changement ultérieur des coordonnées du
 * profil ne réécrit jamais l'historique des paies. La chaîne est
 * composée des champs PERTINENTS du moyen, par ex. :
 *  - « Virement — Banque X, agence Y — compte 123…, IBAN …, SWIFT … — Titulaire »
 *  - « Mobile money — EcoCash +257 79 00 00 00 — Titulaire »
 *  - « Espèces — Titulaire »
 */
function instantaneDestinationPaiement(coordonnees) {
    const libelle = exports.LIBELLES_MOYEN_PAIEMENT[coordonnees.moyen];
    if (coordonnees.moyen === "virement") {
        let tete = `${libelle} — ${coordonnees.banque}`;
        if (coordonnees.agence)
            tete += `, agence ${coordonnees.agence}`;
        let compte = `compte ${coordonnees.numero_compte}`;
        if (coordonnees.iban)
            compte += `, IBAN ${coordonnees.iban}`;
        if (coordonnees.swift)
            compte += `, SWIFT ${coordonnees.swift}`;
        return `${tete} — ${compte} — ${coordonnees.titulaire}`;
    }
    if (coordonnees.moyen === "mobile_money") {
        return `${libelle} — ${coordonnees.operateur} ${coordonnees.numero_mobile} — ${coordonnees.titulaire}`;
    }
    return `${libelle} — ${coordonnees.titulaire}`;
}
/**
 * Blocages d'émission de la paie, dans l'ordre d'affichage (le même
 * ordre que les gardes d' emettrePaie dans les deux fournisseurs) :
 *  - « dossier » : le dossier employé est incomplet (la paie ne
 *    s'émet que sur dossier complet — décision du fondateur) ;
 *  - « contrat » : le contrat d'engagement n'est pas VALIDÉ
 *    (statut_contrat_employe ≠ « valide » : non préparé, à signer,
 *    signé déposé en attente, ou refusé) — correctif du fondateur
 *    2026-11-08 : « Comment émettre la paie sans contrat ? » Un
 *    contrat seulement préparé ne suffit plus, comme la carte
 *    employé exigeait déjà le contrat validé ;
 *  - « montant » : contrat validé mais sans montant (le salaire /
 *    les honoraires n'ont pas été fixés) ;
 *  - « coordonnees » : les coordonnées de paiement de l'employé
 *    (où il reçoit son salaire) ne sont pas renseignées — ajout
 *    2026-11-08, elles ne bloquent QUE la paie ;
 *  - « deja_emise » : une paie « emise » existe déjà pour ce mois
 *    (unicité employé + mois, doublée par la contrainte base).
 * Vide = l'émission est possible.
 */
function blocagesPaie(entrees) {
    const blocages = [];
    if (!entrees.dossierComplet)
        blocages.push("dossier");
    if (!entrees.contratValide)
        blocages.push("contrat");
    else if (entrees.montant === null || !(entrees.montant > 0)) {
        blocages.push("montant");
    }
    if (!entrees.coordonneesPresentes)
        blocages.push("coordonnees");
    if (entrees.dejaEmise)
        blocages.push("deja_emise");
    return blocages;
}
/**
 * Totalise un mois par devise : paies émises + dépenses validées,
 * dépenses en attente comptées à part. Les dépenses refusées ne
 * comptent nulle part. Tri par devise pour un affichage stable.
 */
function totauxParDevise(entrees) {
    const parDevise = new Map();
    const ligne = (devise) => {
        let t = parDevise.get(devise);
        if (!t) {
            t = {
                devise,
                paie_emise: 0,
                depenses_validees: 0,
                depenses_en_attente: 0,
            };
            parDevise.set(devise, t);
        }
        return t;
    };
    for (const p of entrees.paies) {
        ligne(p.devise).paie_emise += Number(p.montant) || 0;
    }
    for (const d of entrees.depenses) {
        if (d.statut === "validee") {
            ligne(d.devise).depenses_validees += Number(d.montant) || 0;
        }
        else if (d.statut === "en_attente") {
            ligne(d.devise).depenses_en_attente += Number(d.montant) || 0;
        }
    }
    return Array.from(parDevise.values()).sort((a, b) => a.devise.localeCompare(b.devise));
}

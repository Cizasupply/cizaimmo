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

/** Catégories fermées des dépenses de fonctionnement de la plateforme. */
export type CategorieDepensePlateforme =
  | "hebergement_services"
  | "communication"
  | "marketing"
  | "fournitures"
  | "deplacements"
  | "autre";

export const CATEGORIES_DEPENSE_PLATEFORME: CategorieDepensePlateforme[] = [
  "hebergement_services",
  "communication",
  "marketing",
  "fournitures",
  "deplacements",
  "autre",
];

export function categorieDepenseValide(
  valeur: unknown
): valeur is CategorieDepensePlateforme {
  return (
    typeof valeur === "string" &&
    (CATEGORIES_DEPENSE_PLATEFORME as string[]).includes(valeur)
  );
}

/** Cycle de vie d'une dépense : saisie -> validation Super Admin. */
export type StatutDepensePlateforme = "en_attente" | "validee" | "refusee";

/** Un mois au format « AAAA-MM » (mois de paie / de dépense). */
export function moisValide(mois: unknown): mois is string {
  return typeof mois === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(mois);
}

/** Le mois courant au format « AAAA-MM » (défaut des sélecteurs). */
export function moisCourant(date: Date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${m}`;
}

// ---------------------------------------------------------------------------
// Coordonnées de PAIEMENT de l'employé (2026-11-08, ajout VALIDÉ par le
// fondateur, modèle précisé par lui) : les coordonnées BANCAIRES
// COMPLÈTES où l'employé reçoit son salaire, STRUCTURÉES selon le
// moyen (virement : banque + n° de compte, IBAN/SWIFT/agence
// optionnels ; mobile money : opérateur + numéro ; espèces : le
// titulaire seul). Elles vivent sur la ligne `profils`
// (module-coordonnees-paiement.sql) et leur complétude est CALCULÉE
// ici, fonction pure partagée par les deux fournisseurs : moyen +
// titulaire + champs requis du moyen. Elles ne changent NI la
// complétude du dossier employé (4 éléments, lib/dossier-employe.ts)
// NI les règles de la carte : elles ne conditionnent QUE l'émission
// de la paie (porte « coordonnees » de blocagesPaie / emettrePaie).
// ---------------------------------------------------------------------------

/** Moyens de réception du salaire (liste fermée, miroir du CHECK SQL). */
export type MoyenPaiementEmploye = "virement" | "mobile_money" | "especes";

export const MOYENS_PAIEMENT_EMPLOYE: MoyenPaiementEmploye[] = [
  "virement",
  "mobile_money",
  "especes",
];

export function moyenPaiementEmployeValide(
  valeur: unknown
): valeur is MoyenPaiementEmploye {
  return (
    typeof valeur === "string" &&
    (MOYENS_PAIEMENT_EMPLOYE as string[]).includes(valeur)
  );
}

/**
 * Coordonnées de paiement NORMALISÉES d'un employé (présentes) :
 * seuls les champs PERTINENTS du moyen sont conservés (les autres
 * sont remis à null — un virement n'a pas d'opérateur mobile, un
 * mobile money n'a pas d'IBAN).
 */
export interface CoordonneesPaiement {
  moyen: MoyenPaiementEmploye;
  /** Nom du titulaire du compte ou du numéro — toujours requis. */
  titulaire: string;
  // --- Virement bancaire -------------------------------------------
  /** Nom de la banque (requis en virement). */
  banque: string | null;
  /** Agence (optionnel). */
  agence: string | null;
  /** Numéro de compte (requis en virement). */
  numero_compte: string | null;
  /** IBAN (optionnel — toutes les banques locales ne l'utilisent pas). */
  iban: string | null;
  /** Code SWIFT / BIC (optionnel). */
  swift: string | null;
  // --- Mobile money --------------------------------------------------
  /** Opérateur (requis en mobile money) : EcoCash, Lumicash, eNoti… */
  operateur: string | null;
  /** Numéro mobile money (requis en mobile money). */
  numero_mobile: string | null;
}

/** Champs bruts tels que stockés sur le profil (tous nullables). */
export interface ChampsCoordonneesPaiement {
  moyen: string | null;
  titulaire: string | null;
  banque?: string | null;
  agence?: string | null;
  numero_compte?: string | null;
  iban?: string | null;
  swift?: string | null;
  operateur?: string | null;
  numero_mobile?: string | null;
}

function texteNonVide(valeur: string | null | undefined): string | null {
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
export function coordonneesPaiementDepuis(
  champs: ChampsCoordonneesPaiement
): CoordonneesPaiement | null {
  const titulaire = texteNonVide(champs.titulaire);
  if (!moyenPaiementEmployeValide(champs.moyen) || !titulaire) {
    return null;
  }
  const base: CoordonneesPaiement = {
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
    if (!banque || !numeroCompte) return null;
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
    if (!operateur || !numeroMobile) return null;
    return { ...base, operateur, numero_mobile: numeroMobile };
  }
  return base;
}

/** Vrai si les coordonnées brutes sont PRÉSENTES (complétude calculée). */
export function coordonneesPaiementPresentes(
  champs: ChampsCoordonneesPaiement
): boolean {
  return coordonneesPaiementDepuis(champs) !== null;
}

/** Libellé canonique d'un moyen — sert à l'instantané figé. */
export const LIBELLES_MOYEN_PAIEMENT: Record<MoyenPaiementEmploye, string> = {
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
export function instantaneDestinationPaiement(
  coordonnees: CoordonneesPaiement
): string {
  const libelle = LIBELLES_MOYEN_PAIEMENT[coordonnees.moyen];
  if (coordonnees.moyen === "virement") {
    let tete = `${libelle} — ${coordonnees.banque}`;
    if (coordonnees.agence) tete += `, agence ${coordonnees.agence}`;
    let compte = `compte ${coordonnees.numero_compte}`;
    if (coordonnees.iban) compte += `, IBAN ${coordonnees.iban}`;
    if (coordonnees.swift) compte += `, SWIFT ${coordonnees.swift}`;
    return `${tete} — ${compte} — ${coordonnees.titulaire}`;
  }
  if (coordonnees.moyen === "mobile_money") {
    return `${libelle} — ${coordonnees.operateur} ${coordonnees.numero_mobile} — ${coordonnees.titulaire}`;
  }
  return `${libelle} — ${coordonnees.titulaire}`;
}

/** Ce qui empêche encore l'émission de la paie d'un employé. */
export type BlocagePaie =
  | "dossier"
  | "contrat"
  | "montant"
  | "coordonnees"
  | "deja_emise";

/**
 * Blocages d'émission de la paie, dans l'ordre d'affichage (le même
 * ordre que les gardes d' emettrePaie dans les deux fournisseurs) :
 *  - « dossier » : le dossier employé est incomplet (la paie ne
 *    s'émet que sur dossier complet — décision du fondateur) ;
 *  - « contrat » : aucun contrat d'engagement préparé en base ;
 *  - « montant » : contrat préparé mais sans montant (le salaire /
 *    les honoraires n'ont pas été fixés) ;
 *  - « coordonnees » : les coordonnées de paiement de l'employé
 *    (où il reçoit son salaire) ne sont pas renseignées — ajout
 *    2026-11-08, elles ne bloquent QUE la paie ;
 *  - « deja_emise » : une paie « emise » existe déjà pour ce mois
 *    (unicité employé + mois, doublée par la contrainte base).
 * Vide = l'émission est possible.
 */
export function blocagesPaie(entrees: {
  dossierComplet: boolean;
  contratPrepare: boolean;
  montant: number | null;
  coordonneesPresentes: boolean;
  dejaEmise: boolean;
}): BlocagePaie[] {
  const blocages: BlocagePaie[] = [];
  if (!entrees.dossierComplet) blocages.push("dossier");
  if (!entrees.contratPrepare) blocages.push("contrat");
  else if (entrees.montant === null || !(entrees.montant > 0)) {
    blocages.push("montant");
  }
  if (!entrees.coordonneesPresentes) blocages.push("coordonnees");
  if (entrees.dejaEmise) blocages.push("deja_emise");
  return blocages;
}

/** Totaux d'un mois, PAR DEVISE (jamais de conversion inventée). */
export interface TotauxDevise {
  devise: string;
  /** Somme des paies émises du mois. */
  paie_emise: number;
  /** Somme des dépenses VALIDÉES du mois. */
  depenses_validees: number;
  /** Somme des dépenses encore EN ATTENTE de validation (à part). */
  depenses_en_attente: number;
}

/**
 * Totalise un mois par devise : paies émises + dépenses validées,
 * dépenses en attente comptées à part. Les dépenses refusées ne
 * comptent nulle part. Tri par devise pour un affichage stable.
 */
export function totauxParDevise(entrees: {
  paies: { montant: number; devise: string }[];
  depenses: { montant: number; devise: string; statut: StatutDepensePlateforme }[];
}): TotauxDevise[] {
  const parDevise = new Map<string, TotauxDevise>();
  const ligne = (devise: string): TotauxDevise => {
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
    } else if (d.statut === "en_attente") {
      ligne(d.devise).depenses_en_attente += Number(d.montant) || 0;
    }
  }
  return Array.from(parDevise.values()).sort((a, b) =>
    a.devise.localeCompare(b.devise)
  );
}

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
 * blocages d'émission, totaux par devise — AUCUNE conversion
 * inventée : chaque devise est totalisée séparément).
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

/** Ce qui empêche encore l'émission de la paie d'un employé. */
export type BlocagePaie = "dossier" | "contrat" | "montant" | "deja_emise";

/**
 * Blocages d'émission de la paie, dans l'ordre d'affichage :
 *  - « dossier » : le dossier employé est incomplet (la paie ne
 *    s'émet que sur dossier complet — décision du fondateur) ;
 *  - « contrat » : aucun contrat d'engagement préparé en base ;
 *  - « montant » : contrat préparé mais sans montant (le salaire /
 *    les honoraires n'ont pas été fixés) ;
 *  - « deja_emise » : une paie « emise » existe déjà pour ce mois
 *    (unicité employé + mois, doublée par la contrainte base).
 * Vide = l'émission est possible.
 */
export function blocagesPaie(entrees: {
  dossierComplet: boolean;
  contratPrepare: boolean;
  montant: number | null;
  dejaEmise: boolean;
}): BlocagePaie[] {
  const blocages: BlocagePaie[] = [];
  if (!entrees.dossierComplet) blocages.push("dossier");
  if (!entrees.contratPrepare) blocages.push("contrat");
  else if (entrees.montant === null || !(entrees.montant > 0)) {
    blocages.push("montant");
  }
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

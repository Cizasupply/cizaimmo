/**
 * CizaImmo — attribution de la grille tarifaire ANTI-FRAUDE (v1.2).
 *
 * Problème : la grille Afrique est moins chère ; déclarer « Burundi »
 * depuis le Canada ne doit pas suffire à l'obtenir. Trois signaux sont
 * capturés : (a) le pays DÉCLARÉ à l'inscription (nom, formulaire) ;
 * (b) le pays de l'IP (en-tête x-vercel-ip-country — seul le CODE pays
 * est stocké, jamais l'adresse IP) ; (c) le pays du moyen de paiement
 * au premier paiement (préfixe mobile money ou pays de la carte).
 *
 * Matrice (voir docs/admin-finance-v1.2.md) :
 * - signaux concordants (même éligibilité) → grille correspondante, ok ;
 * - CONTRADICTION déclaré/IP → grille INTERNATIONALE + a_verifier ;
 * - IP indétectable → grille du pays déclaré, ok, revérification au
 *   premier paiement : contradiction paiement/grille → a_verifier.
 *
 * La liste des pays éligibles à la grille Afrique est DYNAMIQUE
 * (parametres_finance.pays_grille_afrique, éditable par le Super
 * Admin) — la constante ci-dessous n'est que le seed / repli.
 * La grille attribuée est VERROUILLÉE : seul un Admin / Super Admin la
 * réattribue depuis la console (action journalisée).
 *
 * Fonctions pures, testables, partagées démo / réel / webhooks.
 */

import type { Grille } from "./data/types";

/** Seed de la liste dynamique des pays éligibles (codes ISO) : pays
 * africains du formulaire d'inscription, cohérents avec les devises de
 * l'app (BIF, XAF, XOF, KES, TZS, RWF, UGX…). */
export const PAYS_GRILLE_AFRIQUE_SEED: string[] = [
  "BI", "RW", "CD", "CG", "KE", "TZ", "UG", "CM", "SN", "CI",
  "ML", "BF", "BJ", "TG", "GA", "TD", "NE", "GN", "MG", "ET",
  "GH", "NG", "AO", "ZM", "ZW", "MZ", "ZA", "MA", "DZ", "TN", "EG",
];

/** Nom du formulaire (français) → code ISO. Couvre toute la liste
 * d'inscription (lib/countries.ts) ; « Autre » n'a pas de code. */
export const CODE_ISO_PAYS: Record<string, string> = {
  "Burundi": "BI",
  "Rwanda": "RW",
  "République démocratique du Congo": "CD",
  "Congo": "CG",
  "Kenya": "KE",
  "Tanzanie": "TZ",
  "Ouganda": "UG",
  "Cameroun": "CM",
  "Sénégal": "SN",
  "Côte d'Ivoire": "CI",
  "Mali": "ML",
  "Burkina Faso": "BF",
  "Bénin": "BJ",
  "Togo": "TG",
  "Gabon": "GA",
  "Tchad": "TD",
  "Niger": "NE",
  "Guinée": "GN",
  "Madagascar": "MG",
  "Éthiopie": "ET",
  "Ghana": "GH",
  "Nigeria": "NG",
  "Angola": "AO",
  "Zambie": "ZM",
  "Zimbabwe": "ZW",
  "Mozambique": "MZ",
  "Afrique du Sud": "ZA",
  "Maroc": "MA",
  "Algérie": "DZ",
  "Tunisie": "TN",
  "Égypte": "EG",
  "Canada": "CA",
  "France": "FR",
  "Belgique": "BE",
  "Suisse": "CH",
  "Luxembourg": "LU",
  "États-Unis": "US",
  "Royaume-Uni": "GB",
};

const NOM_PAR_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(CODE_ISO_PAYS).map(([nom, code]) => [code, nom])
);

/** Normalise une saisie pays : nom du formulaire OU code ISO → code ISO (ou null). */
export function codePaysSaisi(valeur: string | null | undefined): string | null {
  if (!valeur) return null;
  const propre = valeur.trim();
  if (/^[A-Za-z]{2}$/.test(propre)) return propre.toUpperCase();
  return CODE_ISO_PAYS[propre] ?? null;
}

/** Nom affichable d'un code pays (nom du formulaire, sinon le code). */
export function nomPaysDepuisCode(code: string | null | undefined): string | null {
  if (!code) return null;
  return NOM_PAR_CODE[code.toUpperCase()] ?? code.toUpperCase();
}

/** Éligibilité grille Afrique selon la liste DYNAMIQUE (codes ISO). */
export function estEligibleAfrique(
  code: string | null | undefined,
  codesEligibles: string[]
): boolean {
  if (!code) return false;
  return codesEligibles.includes(code.toUpperCase());
}

export type StatutGrille = "ok" | "a_verifier";

export interface SignauxGrille {
  /** Pays déclaré à l'inscription (nom du formulaire ou code ISO). */
  paysDeclare: string | null;
  /** Code pays de l'IP (x-vercel-ip-country) ; null si indétectable. */
  paysIp: string | null;
}

export interface AttributionGrille {
  grille: Grille;
  statut: StatutGrille;
  paysDeclareCode: string | null;
}

/**
 * Matrice d'attribution à l'inscription. La concordance se juge sur
 * l'ÉLIGIBILITÉ (déclaré Burundi + IP Kenya = concordants, tous deux
 * grille Afrique), pas sur l'égalité stricte des pays.
 */
export function attribuerGrille(
  signaux: SignauxGrille,
  codesEligibles: string[]
): AttributionGrille {
  const paysDeclareCode = codePaysSaisi(signaux.paysDeclare);
  const eligibleDeclare = estEligibleAfrique(paysDeclareCode, codesEligibles);
  if (signaux.paysIp) {
    const eligibleIp = estEligibleAfrique(signaux.paysIp, codesEligibles);
    if (eligibleIp === eligibleDeclare) {
      return {
        grille: eligibleDeclare ? "afrique" : "internationale",
        statut: "ok",
        paysDeclareCode,
      };
    }
    // Contradiction : prudence — grille internationale + vérification.
    return { grille: "internationale", statut: "a_verifier", paysDeclareCode };
  }
  // IP indétectable : le déclaré décide, revérification au 1er paiement.
  return {
    grille: eligibleDeclare ? "afrique" : "internationale",
    statut: "ok",
    paysDeclareCode,
  };
}

/**
 * Revérification au premier paiement : si le pays du moyen de paiement
 * contredit l'éligibilité de la grille attribuée, le compte passe
 * « a_verifier » (la grille ne change pas automatiquement — la console
 * décide). Retourne le nouveau statut.
 */
export function evaluerPaysPaiement(
  grilleAttribuee: Grille,
  paysPaiement: string | null,
  codesEligibles: string[]
): StatutGrille {
  if (!paysPaiement) return "ok";
  const eligiblePaiement = estEligibleAfrique(paysPaiement, codesEligibles);
  return eligiblePaiement === (grilleAttribuee === "afrique") ? "ok" : "a_verifier";
}

/** Préfixes téléphoniques internationaux → code pays (plan de numérotation
 * public). Sert au signal (c) mobile money ; +1/+33… trop ambigus → null. */
const PREFIXES_PAYS: Record<string, string> = {
  "+257": "BI", "+243": "CD", "+250": "RW", "+254": "KE", "+255": "TZ",
  "+256": "UG", "+237": "CM", "+221": "SN", "+225": "CI", "+223": "ML",
  "+226": "BF", "+229": "BJ", "+228": "TG", "+241": "GA", "+235": "TD",
  "+227": "NE", "+224": "GN", "+261": "MG", "+251": "ET", "+233": "GH",
  "+234": "NG", "+244": "AO", "+260": "ZM", "+263": "ZW", "+258": "MZ",
  "+242": "CG", "+27": "ZA", "+212": "MA", "+213": "DZ", "+216": "TN",
  "+20": "EG",
};

/** Pays d'un numéro mobile money depuis son préfixe ; null si inconnu. */
export function paysDepuisTelephone(telephone: string | null | undefined): string | null {
  if (!telephone) return null;
  const propre = telephone.replace(/[\s()-]/g, "");
  const prefixes = Object.keys(PREFIXES_PAYS).sort((a, b) => b.length - a.length);
  for (const prefixe of prefixes) {
    if (propre.startsWith(prefixe)) return PREFIXES_PAYS[prefixe];
  }
  return null;
}

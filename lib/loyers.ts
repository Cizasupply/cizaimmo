/**
 * CizaImmo — logique métier des loyers & paiements (Module 3, spec §9, §11).
 *
 * Fonctions PURES, sans accès base ni DOM : elles sont partagées par les
 * deux fournisseurs (démo / Supabase), par les pages et par les tests.
 * Les statuts d'échéance sont CALCULÉS ici, jamais stockés à la main.
 */

import type { Bail, Devise, Paiement, StatutLoyer } from "./data/types";

/** Délai de grâce avant « en retard » : 5 jours après le jour d'exigibilité (spec §9). */
export const DELAI_GRACE_JOURS = 5;

/** Préfixe de numérotation des reçus : CIM-AAAA-000001, séquentiel par compte (spec §11). */
export const PREFIXE_RECU = "CIM";

export const MOYENS_PAIEMENT = [
  "especes",
  "virement",
  "mobile_money",
  "cheque",
  "autre",
] as const;
export type MoyenPaiement = (typeof MOYENS_PAIEMENT)[number];

/** Mois au format « AAAA-MM » (valeur d'un <input type="month">). */
export function moisActuel(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** « 2026-11 » → « 2026-11-01 » (1er du mois, format stocké des échéances). */
export function moisVersIso(mois: string): string {
  return /^\d{4}-\d{2}$/.test(mois) ? `${mois}-01` : mois;
}

/** « 2026-11-01 » → « 2026-11 ». */
export function isoVersMois(iso: string): string {
  return iso.slice(0, 7);
}

export function joursDansMois(annee: number, moisIndex0: number): number {
  return new Date(annee, moisIndex0 + 1, 0).getDate();
}

export function debutMoisIso(moisIso: string): string {
  return moisVersIso(isoVersMois(moisIso));
}

export function finMoisIso(moisIso: string): string {
  const [a, m] = isoVersMois(moisIso).split("-").map(Number);
  return `${a}-${String(m).padStart(2, "0")}-${String(joursDansMois(a, m - 1)).padStart(2, "0")}`;
}

/** Nombre de jours entre deux dates ISO incluses (ex. 2026-10-15 → 2026-10-31 = 17). */
export function joursInclus(debutIso: string, finIso: string): number {
  const d1 = new Date(`${debutIso.slice(0, 10)}T00:00:00`);
  const d2 = new Date(`${finIso.slice(0, 10)}T00:00:00`);
  return Math.round((d2.getTime() - d1.getTime()) / 86400000) + 1;
}

export interface CalculProrata {
  montantDu: number;
  prorata: boolean;
  /** Jours d'occupation dans le mois (null si mois plein). */
  joursOccupes: number | null;
  joursMois: number;
  /** Détail compact « 17/31 », affiché sur l'échéance (spec §9). */
  detail: string | null;
}

/**
 * Prorata entrée / sortie (spec §9) : premier et dernier mois au nombre de
 * jours réels d'occupation — loyer × (jours occupés ÷ jours du mois),
 * arrondi à l'unité de la devise.
 */
export function calculerProrata(bail: Bail, moisIso: string): CalculProrata {
  const mois = isoVersMois(moisIso);
  const [annee, moisNum] = mois.split("-").map(Number);
  const nbJoursMois = joursDansMois(annee, moisNum - 1);
  const debutMois = `${mois}-01`;
  const finMois = finMoisIso(moisIso);
  const debutBail = bail.debut.slice(0, 10);
  const finBail = bail.fin ? bail.fin.slice(0, 10) : null;

  const occupeDepuis = debutBail > debutMois ? debutBail : debutMois;
  const occupeJusqua = finBail && finBail < finMois ? finBail : finMois;
  const joursOccupes = joursInclus(occupeDepuis, occupeJusqua);
  if (joursOccupes >= nbJoursMois) {
    return { montantDu: bail.loyer_mensuel, prorata: false, joursOccupes: null, joursMois: nbJoursMois, detail: null };
  }
  const montantDu = Math.round((bail.loyer_mensuel * joursOccupes) / nbJoursMois);
  return {
    montantDu,
    prorata: true,
    joursOccupes,
    joursMois: nbJoursMois,
    detail: `${joursOccupes}/${nbJoursMois}`,
  };
}

/** Le bail couvre-t-il au moins un jour du mois (échéance à générer) ? */
export function bailCouvreMois(bail: Bail, moisIso: string): boolean {
  const debutMois = debutMoisIso(moisIso);
  const finMois = finMoisIso(moisIso);
  const finBail = bail.fin ? bail.fin.slice(0, 10) : "9999-12-31";
  return bail.debut.slice(0, 10) <= finMois && finBail >= debutMois;
}

/**
 * Total déclaré VALIDE sur une échéance (les paiements annulés ne comptent
 * pas). Quand la devise d'un paiement diffère de celle de l'échéance, c'est
 * son montant CONVERTI (explicite, daté) qui est imputé — jamais le montant
 * brut dans une autre devise.
 */
export function totalPayeValide(paiements: Paiement[], deviseEcheance?: string): number {
  return paiements
    .filter((p) => p.statut === "valide")
    .reduce((s, p) => {
      if (
        deviseEcheance &&
        p.devise !== deviseEcheance &&
        p.montant_converti !== null &&
        p.montant_converti !== undefined
      ) {
        return s + p.montant_converti;
      }
      return s + p.montant;
    }, 0);
}

/**
 * Statut calculé d'une échéance (spec §9), dans cet ordre :
 * payé (déclaré ≥ dû, trop-perçu signalé à part) → en retard (reste dû
 * après le délai de grâce de 5 jours) → partiel (déclaré < dû) → à venir
 * (jour d'exigibilité non atteint) → dû.
 */
export function calculerStatutEcheance(args: {
  montantDu: number;
  paye: number;
  jourExigibilite: number;
  moisIso: string;
  aujourdHui?: Date;
}): StatutLoyer {
  const { montantDu, paye, jourExigibilite, moisIso } = args;
  if (paye >= montantDu) return "paye";
  const [annee, moisNum] = isoVersMois(moisIso).split("-").map(Number);
  const dateExigibilite = new Date(annee, moisNum - 1, Math.min(jourExigibilite, joursDansMois(annee, moisNum - 1)));
  const grace = new Date(dateExigibilite);
  grace.setDate(grace.getDate() + DELAI_GRACE_JOURS);
  const aujourdHui = args.aujourdHui ?? new Date();
  const jour = new Date(aujourdHui.getFullYear(), aujourdHui.getMonth(), aujourdHui.getDate());
  if (jour > grace) return "en_retard";
  if (paye > 0) return "partiel";
  if (jour < dateExigibilite) return "a_venir";
  return "du";
}

/** Date d'exigibilité d'une échéance (jour du bail, dans le mois). */
export function dateExigibilite(moisIso: string, jourExigibilite: number): string {
  const [a, m] = isoVersMois(moisIso).split("-").map(Number);
  const jour = Math.min(jourExigibilite, joursDansMois(a, m - 1));
  return `${a}-${String(m).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Numérotation des reçus
// ---------------------------------------------------------------------------

/** Prochain numéro CIM-AAAA-000001 à partir des numéros déjà émis (sans trou réutilisable). */
export function prochainNumeroRecu(numerosExistants: (string | null)[], annee?: number): string {
  const a = annee ?? new Date().getFullYear();
  const prefixe = `${PREFIXE_RECU}-${a}-`;
  let max = 0;
  for (const n of numerosExistants) {
    if (!n || !n.startsWith(prefixe)) continue;
    const suffixe = Number(n.slice(prefixe.length));
    if (Number.isFinite(suffixe) && suffixe > max) max = suffixe;
  }
  return `${prefixe}${String(max + 1).padStart(6, "0")}`;
}

// ---------------------------------------------------------------------------
// Montant en lettres (reçu PDF, spec §11) — partie entière uniquement.
// ---------------------------------------------------------------------------

const FR_UNITES = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
const FR_DIZAINES = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

function frMoinsDeCent(n: number): string {
  if (n < 20) return FR_UNITES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  if (d === 7 || d === 9) {
    const base = FR_DIZAINES[d];
    const reste = 10 + u;
    if (d === 7 && u === 1) return `${base} et onze`;
    return `${base}-${FR_UNITES[reste]}`;
  }
  if (u === 0) return d === 8 ? "quatre-vingts" : FR_DIZAINES[d];
  if (u === 1 && d !== 8) return `${FR_DIZAINES[d]} et un`;
  return `${FR_DIZAINES[d]}-${FR_UNITES[u]}`;
}

function frMoinsDeMille(n: number): string {
  const c = Math.floor(n / 100);
  const reste = n % 100;
  let out = "";
  if (c > 0) {
    out = c === 1 ? "cent" : `${FR_UNITES[c]} cent${reste === 0 ? "s" : ""}`;
  }
  if (reste > 0) out += (out ? " " : "") + frMoinsDeCent(reste);
  return out;
}

function nombreEnLettresFr(n: number): string {
  if (n === 0) return "zéro";
  const milliards = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const milliers = Math.floor((n % 1_000_000) / 1000);
  const reste = n % 1000;
  const parties: string[] = [];
  if (milliards > 0) parties.push(`${milliards === 1 ? "un" : frMoinsDeMille(milliards)} milliard${milliards > 1 ? "s" : ""}`);
  if (millions > 0) parties.push(`${millions === 1 ? "un" : frMoinsDeMille(millions)} million${millions > 1 ? "s" : ""}`);
  if (milliers > 0) parties.push(milliers === 1 ? "mille" : `${frMoinsDeMille(milliers)} mille`);
  if (reste > 0) parties.push(frMoinsDeMille(reste));
  return parties.join(" ");
}

const EN_UNITES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN_DIZAINES = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function enMoinsDeCent(n: number): string {
  if (n < 20) return EN_UNITES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? EN_DIZAINES[d] : `${EN_DIZAINES[d]}-${EN_UNITES[u]}`;
}

function enMoinsDeMille(n: number): string {
  const c = Math.floor(n / 100);
  const reste = n % 100;
  let out = "";
  if (c > 0) out = `${EN_UNITES[c]} hundred`;
  if (reste > 0) out += (out ? " " : "") + enMoinsDeCent(reste);
  return out;
}

function nombreEnLettresEn(n: number): string {
  if (n === 0) return "zero";
  const milliards = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const milliers = Math.floor((n % 1_000_000) / 1000);
  const reste = n % 1000;
  const parties: string[] = [];
  if (milliards > 0) parties.push(`${enMoinsDeMille(milliards)} billion`);
  if (millions > 0) parties.push(`${enMoinsDeMille(millions)} million`);
  if (milliers > 0) parties.push(`${enMoinsDeMille(milliers)} thousand`);
  if (reste > 0) parties.push(enMoinsDeMille(reste));
  return parties.join(" ");
}

/**
 * Montant en lettres, partie entière + centimes éventuels.
 * Ex. FR : « quatre cent cinquante mille francs » — la devise en toutes
 * lettres est ajoutée par l'appelant si besoin ; ici on rend le nombre seul.
 */
export function nombreEnLettres(montant: number, langue: "fr" | "en"): string {
  const entier = Math.floor(Math.abs(montant));
  const texte = langue === "fr" ? nombreEnLettresFr(entier) : nombreEnLettresEn(entier);
  const centimes = Math.round((Math.abs(montant) - entier) * 100);
  if (centimes <= 0) return texte;
  const texteCentimes = langue === "fr" ? nombreEnLettresFr(centimes) : nombreEnLettresEn(centimes);
  return langue === "fr" ? `${texte} virgule ${texteCentimes}` : `${texte} point ${texteCentimes}`;
}

// ---------------------------------------------------------------------------
// Liens de relance — AUCUN envoi simulé : ce sont des liens qui ouvrent
// l'application de messagerie du gestionnaire (spec §6, module 6 = envoi auto).
// ---------------------------------------------------------------------------

export function lienMailto(email: string | null, sujet: string, corps: string): string | null {
  if (!email) return null;
  return `mailto:${email}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
}

export function lienWhatsApp(telephone: string | null, message: string): string | null {
  if (!telephone) return null;
  const chiffres = telephone.replace(/[^\d]/g, "");
  if (chiffres.length < 10) return null;
  return `https://wa.me/${chiffres}?text=${encodeURIComponent(message)}`;
}

/** Devise d'affichage d'un total : on ne mélange jamais deux devises dans une somme. */
export function grouperParDevise<T extends { devise: Devise }>(
  items: T[]
): Map<Devise, T[]> {
  const map = new Map<Devise, T[]>();
  for (const item of items) {
    const liste = map.get(item.devise) ?? [];
    liste.push(item);
    map.set(item.devise, liste);
  }
  return map;
}

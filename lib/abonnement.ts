/**
 * CizaImmo — logique pure des abonnements (Module 5, spec §12).
 *
 * Aucun appel réseau, aucune date « maintenant » cachée : l'instant courant
 * est passé en paramètre pour que les tests puissent simuler le temps.
 * Les deux fournisseurs (démo et réel) utilisent ces mêmes fonctions.
 */
import type { Abonnement, Grille, Plan } from "./data/types";
import { PAYS_AFRIQUE } from "./countries";

/** Durées verrouillées (spec §12). */
export const ESSAI_JOURS = 30;
export const GRACE_ECHEC_PAIEMENT_JOURS = 7;
export const RETENTION_LECTURE_SEULE_JOURS = 90;
export const MOBILE_MONEY_EXPIRATION_HEURES = 24;

/** Prix mensuels verrouillés (spec §12), en USD. */
export const PRIX_PLANS: Record<Plan, Record<Grille, number>> = {
  starter: { afrique: 1.99, internationale: 4.99 },
  pro: { afrique: 5.99, internationale: 14.99 },
  agence: { afrique: 11.99, internationale: 29.99 },
};

export function prixPlan(plan: Plan, grille: Grille): number {
  return PRIX_PLANS[plan][grille];
}

/** Rang d'un plan (pour décider montée / descente). */
export const RANG_PLAN: Record<Plan, number> = {
  starter: 1,
  pro: 2,
  agence: 3,
};

/** Gestionnaires invités par plan (spec §12). */
export const GESTIONNAIRES_MAX: Record<Plan, number> = {
  starter: 0,
  pro: 2,
  agence: Number.POSITIVE_INFINITY,
};

/** Vitrine « appartements à louer » par plan (spec §12). */
export const VITRINE_PAR_PLAN: Record<Plan, boolean> = {
  starter: false,
  pro: true,
  agence: true,
};

/** Indivision familiale par plan (spec §12). */
export const INDIVISION_PAR_PLAN: Record<Plan, boolean> = {
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
export function grillePourPays(pays: string | null | undefined): Grille {
  if (!pays) return "internationale";
  return PAYS_AFRIQUE.includes(pays.trim()) ? "afrique" : "internationale";
}

export function ajouterJours(iso: string, jours: number): string {
  return new Date(new Date(iso).getTime() + jours * 24 * 60 * 60 * 1000).toISOString();
}

export function ajouterMois(iso: string, mois = 1): string {
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
export function estLectureSeule(abo: Abonnement, maintenant: Date = new Date()): boolean {
  if (abo.statut === "lecture_seule" || abo.statut === "annule") return true;
  if (abo.statut === "essai" && abo.trial_ends_at) {
    if (maintenant.getTime() > new Date(abo.trial_ends_at).getTime()) return true;
  }
  if (abo.statut === "actif" && abo.echec_paiement && abo.grace_ends_at) {
    if (maintenant.getTime() > new Date(abo.grace_ends_at).getTime()) return true;
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
export function appliquerTransitions(
  abo: Abonnement,
  maintenant: Date = new Date()
): { abo: Abonnement; change: boolean } {
  const now = maintenant.getTime();
  let change = false;
  const maj: Abonnement = { ...abo };

  // 1. Descente de plan effective à la fin de la période payée.
  if (
    maj.plan_en_attente &&
    maj.date_effet_plan &&
    now >= new Date(maj.date_effet_plan).getTime()
  ) {
    maj.plan = maj.plan_en_attente;
    maj.plan_en_attente = null;
    maj.date_effet_plan = null;
    change = true;
  }

  // 2. Résiliation effective en fin de période.
  if (
    maj.resiliation_programmee &&
    maj.statut !== "annule" &&
    maj.fin_periode &&
    now >= new Date(maj.fin_periode).getTime()
  ) {
    maj.statut = "annule";
    maj.resiliation_programmee = false;
    maj.lecture_seule_jusqu_au = ajouterJours(
      maj.fin_periode,
      RETENTION_LECTURE_SEULE_JOURS
    );
    change = true;
  }

  // 3. Fin d'essai sans abonnement -> lecture seule, 90 jours.
  if (
    maj.statut === "essai" &&
    maj.trial_ends_at &&
    now > new Date(maj.trial_ends_at).getTime()
  ) {
    maj.statut = "lecture_seule";
    maj.lecture_seule_jusqu_au = ajouterJours(
      maj.trial_ends_at,
      RETENTION_LECTURE_SEULE_JOURS
    );
    change = true;
  }

  // 4. Grâce d'échec de paiement dépassée -> lecture seule, 90 jours.
  if (
    maj.statut === "actif" &&
    maj.echec_paiement &&
    maj.grace_ends_at &&
    now > new Date(maj.grace_ends_at).getTime()
  ) {
    maj.statut = "lecture_seule";
    maj.lecture_seule_jusqu_au = ajouterJours(
      maj.grace_ends_at,
      RETENTION_LECTURE_SEULE_JOURS
    );
    change = true;
  }

  return { abo: maj, change };
}

/** Numéro de facture d'abonnement : CIM-ABO-AAAA-0001 (séquentiel). */
export function prochainNumeroFactureAbo(numerosExistants: (string | null)[], annee: number): string {
  const prefixe = `CIM-ABO-${annee}-`;
  let max = 0;
  for (const n of numerosExistants) {
    if (n && n.startsWith(prefixe)) {
      const seq = parseInt(n.slice(prefixe.length), 10);
      if (Number.isFinite(seq) && seq > max) max = seq;
    }
  }
  return `${prefixe}${String(max + 1).padStart(4, "0")}`;
}

/** Référence de paiement mobile money : MM-XXXXXXXX (8 caractères). */
export function genererReferenceMobileMoney(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I
  let ref = "MM-";
  for (let i = 0; i < 8; i++) {
    ref += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return ref;
}

/** Un numéro de téléphone mobile money est-il plausible (8 à 15 chiffres) ? */
export function telephoneMobileMoneyValide(telephone: string): boolean {
  const chiffres = telephone.replace(/[^0-9]/g, "");
  return chiffres.length >= 8 && chiffres.length <= 15;
}

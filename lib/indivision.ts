/**
 * CizaImmo — indivision familiale (Module 6, spec §6 suite, §2, §13).
 *
 * Fonctions PURES, sans accès base ni DOM : partagées par les deux
 * fournisseurs (démo / Supabase), par les pages et par les tests.
 *
 * Règles verrouillées :
 * - un immeuble peut appartenir à plusieurs personnes (famille, diaspora) ;
 * - la somme des parts d'un immeuble fait toujours exactement 100 %
 *   (validée côté application avant enregistrement, refus sinon) ;
 * - une part par e-mail et par immeuble ;
 * - seul le propriétaire administre les parts ;
 * - le résultat net du bien (revenus déclarés − dépenses) est réparti
 *   au prorata des parts, dans la devise du bien et converti si besoin.
 *
 * RÈGLE DURE : CizaImmo calcule et affiche la répartition, mais
 * n'encaisse ni ne distribue AUCUN argent entre co-propriétaires.
 */

import type { Coproprietaire, Devise, TauxChange } from "./data/types";
import { convertirMontant } from "./module4";

/** Tolérance d'arrondi sur la somme des parts (0,01 point). */
export const TOLERANCE_PARTS = 0.01;

/** Somme des parts d'une liste (arrondie à 2 décimales). */
export function sommeParts(parts: { part: number }[]): number {
  const somme = parts.reduce((s, p) => s + p.part, 0);
  return Math.round(somme * 100) / 100;
}

export interface ValidationParts {
  valide: boolean;
  /** Code d'erreur métier (traduit via crud.errors.<CODE>), si invalide. */
  code?: "ERR_PARTS_TOTAL" | "ERR_PART_EMAIL_UNIQUE" | "ERR_PART_INVALIDE";
  somme?: number;
}

/**
 * Valide un ensemble complet de parts pour un immeuble :
 * chaque part > 0 et ≤ 100, un e-mail unique par immeuble, et la somme
 * fait exactement 100 %. Utilisée par definirParts (remplacement complet).
 */
export function validerParts(
  parts: { email: string; part: number }[]
): ValidationParts {
  for (const p of parts) {
    if (!Number.isFinite(p.part) || p.part <= 0 || p.part > 100) {
      return { valide: false, code: "ERR_PART_INVALIDE", somme: sommeParts(parts) };
    }
  }
  const emails = parts.map((p) => p.email.trim().toLowerCase());
  if (new Set(emails).size !== emails.length) {
    return { valide: false, code: "ERR_PART_EMAIL_UNIQUE", somme: sommeParts(parts) };
  }
  const somme = sommeParts(parts);
  if (Math.abs(somme - 100) > TOLERANCE_PARTS) {
    return { valide: false, code: "ERR_PARTS_TOTAL", somme };
  }
  return { valide: true, somme };
}

/** Ligne de répartition pour un co-propriétaire. */
export interface LigneRepartition {
  coproprietaire_id: string;
  nom: string;
  email: string;
  /** Part en pourcentage (0–100). */
  part: number;
  /** Montant qui revient au co-propriétaire, dans la devise du bien. */
  montant: number;
  devise: Devise;
  /**
   * Montant converti dans la devise d'affichage, ou null si la
   * conversion est impossible (aucun taux : « taux indisponible »,
   * jamais de chiffre inventé).
   */
  montant_converti: number | null;
  devise_convertie: Devise | null;
  date_taux: string | null;
  source_taux: "auto" | "manuel" | null;
}

export interface RepartitionResultat {
  /** Résultat net du bien (revenus déclarés − dépenses), devise du bien. */
  resultat_net: number;
  revenus: number;
  depenses: number;
  devise: Devise;
  /** Vrai quand la somme des parts fait exactement 100 %. */
  parts_completes: boolean;
  somme_parts: number;
  lignes: LigneRepartition[];
}

/**
 * Répartit le résultat net d'un bien au prorata des parts.
 * Si les parts ne totalisent pas 100 %, la répartition n'est pas
 * calculée (lignes vides) : l'écran invite à compléter les parts.
 * Un montant converti sans taux disponible reste null.
 */
export function repartirResultatNet(args: {
  revenus: number;
  depenses: number;
  devise: Devise;
  coproprietaires: Coproprietaire[];
  /** Devise d'affichage souhaitée pour la conversion (optionnel). */
  devise_cible?: Devise | null;
  taux?: TauxChange[];
}): RepartitionResultat {
  const { revenus, depenses, devise, coproprietaires } = args;
  const resultatNet = Math.round((revenus - depenses) * 100) / 100;
  const somme = sommeParts(coproprietaires);
  const completes = Math.abs(somme - 100) <= TOLERANCE_PARTS;
  if (!completes) {
    return {
      resultat_net: resultatNet,
      revenus,
      depenses,
      devise,
      parts_completes: false,
      somme_parts: somme,
      lignes: [],
    };
  }
  const lignes: LigneRepartition[] = coproprietaires.map((c) => {
    const montant = Math.round(resultatNet * (c.part / 100) * 100) / 100;
    let montantConverti: number | null = null;
    let dateTaux: string | null = null;
    let sourceTaux: "auto" | "manuel" | null = null;
    const cible = args.devise_cible;
    if (cible && cible !== devise && args.taux) {
      const conv = convertirMontant(montant, devise, cible, args.taux);
      if (conv) {
        montantConverti = Math.round(conv.montant * 100) / 100;
        dateTaux = conv.taux.date_taux;
        sourceTaux = conv.taux.source;
      }
    }
    return {
      coproprietaire_id: c.id,
      nom: c.nom,
      email: c.email,
      part: c.part,
      montant,
      devise,
      montant_converti: montantConverti,
      devise_convertie: montantConverti !== null ? cible! : null,
      date_taux: dateTaux,
      source_taux: sourceTaux,
    };
  });
  return {
    resultat_net: resultatNet,
    revenus,
    depenses,
    devise,
    parts_completes: true,
    somme_parts: somme,
    lignes,
  };
}

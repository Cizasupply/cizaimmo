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

/** Voie du contrat d'engagement, fixée par le Super Admin. */
export type VoieContratEmploye = "travail" | "prestation";

/** Cycle de vie du contrat d'engagement (suivi en base). */
export type StatutContratEmploye =
  | "sans_objet"
  | "a_signer"
  | "signe_depose"
  | "valide"
  | "refuse";

/**
 * Champs EMPLOYEUR du contrat, fixés par le Super Admin à la
 * préparation et stockés en base : le PDF est régénéré à la demande
 * à partir de ces valeurs (jamais codées en dur).
 * « periode_essai » ne vaut que pour la voie « travail ».
 */
export interface ParametresContratEmploye {
  voie: VoieContratEmploye;
  /** CDI / CDD (voie travail) — libellé libre (voie prestation). */
  type: string;
  /** Durée (CDD / mission) ; null si indéterminée. */
  duree: string | null;
  /** Salaire (travail) ou honoraires (prestation), montant brut mensuel. */
  montant: number | null;
  devise: string;
  modalites_paiement: string;
  lieu: string;
  horaires: string;
  /** Date de début (ISO « AAAA-MM-JJ »). */
  date_debut: string;
  /** Voie « travail » uniquement ; toujours null en « prestation ». */
  periode_essai: string | null;
}

/** Ce qui bloque encore l'émission de la carte employé. */
export type BlocageCarte = "dossier" | "contrat";

/**
 * La carte employé est ÉMISE si et seulement si le dossier employé
 * est COMPLET et le contrat d'engagement est VALIDÉ. Calculé —
 * jamais stocké : si l'employé est suspendu ensuite, la
 * vérification contre la base ne « passe » plus (voir
 * verificationEmployeValide).
 */
export function carteEmployeEmise(
  dossierComplet: boolean,
  statutContrat: StatutContratEmploye
): boolean {
  return dossierComplet && statutContrat === "valide";
}

/** Blocages restants avant émission de la carte (vide si émise). */
export function blocagesCarteEmploye(
  dossierComplet: boolean,
  statutContrat: StatutContratEmploye
): BlocageCarte[] {
  const blocages: BlocageCarte[] = [];
  if (!dossierComplet) blocages.push("dossier");
  if (statutContrat !== "valide") blocages.push("contrat");
  return blocages;
}

/** Les 4 étapes de la progression employé, dans l'ordre d'affichage. */
export type EtapePack = "dossier" | "charte" | "contrat" | "carte";
export type EtatEtape = "faite" | "en_cours" | "a_faire";

export interface ProgressionPack {
  etape: EtapePack;
  etat: EtatEtape;
}

/**
 * Progression en 4 étapes (Dossier → Charte → Contrat → Carte),
 * calculée : « faite » quand l'étape est accomplie, « en_cours »
 * pour la première étape non accomplie, « a_faire » ensuite.
 * Le contrat est « en cours » dès qu'il est préparé (à signer,
 * déposé ou refusé — un refus se corrige par un nouveau dépôt).
 */
export function progressionPackEmploye(entrees: {
  dossierComplet: boolean;
  charteAccepteeLe: string | null;
  statutContrat: StatutContratEmploye;
  carteEmise: boolean;
}): ProgressionPack[] {
  const accomplies: Record<EtapePack, boolean> = {
    dossier: entrees.dossierComplet,
    charte: !!entrees.charteAccepteeLe,
    contrat: entrees.statutContrat === "valide",
    carte: entrees.carteEmise,
  };
  const ordre: EtapePack[] = ["dossier", "charte", "contrat", "carte"];
  let premierNonFait = true;
  return ordre.map((etape) => {
    if (accomplies[etape]) return { etape, etat: "faite" as EtatEtape };
    if (premierNonFait) {
      premierNonFait = false;
      return { etape, etat: "en_cours" as EtatEtape };
    }
    return { etape, etat: "a_faire" as EtatEtape };
  });
}

/**
 * Résultat d'une VÉRIFICATION contre la base : la carte « passe »
 * si le compte est ACTIF (non suspendu, accès console ouvert).
 * Un compte suspendu ressort donc toujours NON VALIDE, même avec
 * un dossier complet et un contrat validé.
 */
export function verificationEmployeValide(entrees: {
  statutCompte: "actif" | "suspendu";
  accesConsoleActif: boolean;
}): boolean {
  return entrees.statutCompte === "actif" && entrees.accesConsoleActif;
}

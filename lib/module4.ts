/**
 * CizaImmo — logique métier du MODULE 4 (spec §6, §9, §10, §11).
 * Fonctions PURES, sans accès base ni DOM : partagées par les deux
 * fournisseurs (démo / Supabase), par les pages et par les tests.
 *
 * Règles verrouillées :
 * - ROI = (revenus − dépenses) ÷ valeur du bien ; sans valeur : null,
 *   l'écran affiche « valeur à renseigner », jamais un chiffre inventé.
 * - Marge nette = (revenus − dépenses) ÷ revenus : affichée séparément,
 *   jamais confondue avec le ROI.
 * - Chaque montant garde sa devise d'origine ; un total converti porte
 *   toujours la date (et la source) de son taux, jamais « taux du jour ».
 * - Alertes idempotentes : chaque événement porte une clé dedup_key.
 */

import type {
  Abonnement,
  Activite,
  Alerte,
  Appartement,
  Bail,
  Depense,
  Devise,
  EcheanceLoyer,
  Immeuble,
  Paiement,
  TauxChange,
  TauxResultat,
  TypeAlerte,
  UrgenceAlerte,
} from "./data/types";
import { calculerMargeNette, calculerRoi } from "./format";
import { DELAI_GRACE_JOURS, dateExigibilite, totalPayeValide } from "./loyers";

/** Seuil par défaut de vacance prolongée : 30 jours, réglable (spec §10). */
export const SEUIL_VACANCE_DEFAUT_JOURS = 30;
/** Taille maximale d'un fichier conservé en localStorage en mode démo. */
export const LIMITE_DEMO_CONTENU_OCTETS = 1_000_000;

// ---------------------------------------------------------------------------
// Taux de change
// ---------------------------------------------------------------------------

/**
 * Trouve un taux dans une liste : direct, inverse, ou via USD comme pivot.
 * Retourne null si aucun taux ne permet la conversion — jamais de taux inventé.
 */
export function trouverTaux(
  taux: TauxChange[],
  source: Devise,
  cible: Devise
): TauxResultat | null {
  if (source === cible) return null; // pas de conversion nécessaire
  const plusRecent = (liste: TauxChange[]): TauxChange | null => {
    if (liste.length === 0) return null;
    return liste.slice().sort((a, b) => b.date_taux.localeCompare(a.date_taux))[0];
  };
  const direct = plusRecent(taux.filter((t) => t.devise_source === source && t.devise_cible === cible));
  if (direct) return { taux: direct.taux, date_taux: direct.date_taux, source: direct.source };
  const inverse = plusRecent(taux.filter((t) => t.devise_source === cible && t.devise_cible === source));
  if (inverse && inverse.taux > 0) {
    return { taux: 1 / inverse.taux, date_taux: inverse.date_taux, source: inverse.source };
  }
  // Pivot USD : source -> USD puis USD -> cible.
  if (source !== "USD" && cible !== "USD") {
    const versUsd = trouverTaux(taux, source, "USD");
    const depuisUsd = trouverTaux(taux, "USD", cible);
    if (versUsd && depuisUsd) {
      const manuel = versUsd.source === "manuel" || depuisUsd.source === "manuel";
      return {
        taux: versUsd.taux * depuisUsd.taux,
        date_taux: versUsd.date_taux < depuisUsd.date_taux ? versUsd.date_taux : depuisUsd.date_taux,
        source: manuel ? "manuel" : "auto",
      };
    }
  }
  return null;
}

/** Convertit un montant avec un taux trouvé ; null si aucune conversion possible. */
export function convertirMontant(
  montant: number,
  deviseSource: Devise,
  deviseCible: Devise,
  taux: TauxChange[]
): { montant: number; taux: TauxResultat } | null {
  if (deviseSource === deviseCible) return null;
  const trouve = trouverTaux(taux, deviseSource, deviseCible);
  if (!trouve) return null;
  return { montant: montant * trouve.taux, taux: trouve };
}

/** Somme par devise : on ne mélange jamais deux devises dans une somme. */
export function sommerParDevise<T extends { montant: number; devise: Devise }>(
  items: T[]
): { devise: Devise; total: number }[] {
  const map = new Map<Devise, number>();
  for (const it of items) map.set(it.devise, (map.get(it.devise) ?? 0) + it.montant);
  return Array.from(map.entries())
    .map(([devise, total]) => ({ devise, total }))
    .sort((a, b) => a.devise.localeCompare(b.devise));
}

// ---------------------------------------------------------------------------
// Tableau de bord — les 4 indicateurs (spec §9)
// ---------------------------------------------------------------------------

export interface IndicateursParc {
  /** 0–1, null si aucun appartement louable. */
  occupation: number | null;
  nbLouables: number;
  nbOccupes: number;
  nbVacants: number;
  /** Loyers collectés (déclarés payés) du mois, par devise d'origine. */
  collectes: { devise: Devise; total: number }[];
  /** Loyers attendus (dus) du mois, par devise d'origine. */
  attendus: { devise: Devise; total: number }[];
  /** Taux de collecte par devise (0–1, null si rien attendu). */
  collecteParDevise: { devise: Devise; taux: number | null }[];
  /** Montant en retard (restants dus après le délai de grâce), par devise. */
  enRetard: { devise: Devise; total: number }[];
  /** Échéances en retard (enrichies par l'appelant avec bail/locataire). */
  retards: EcheanceLoyer[];
  /** Baux se terminant dans les 60 jours. */
  finsDeBail60j: Bail[];
  /** Dépenses du mois en cours. */
  depensesMois: Depense[];
  /** Collecte des 6 derniers mois : par mois ISO, collecté et attendu par devise. */
  collecte6Mois: { mois: string; collectes: { devise: Devise; total: number }[]; attendus: { devise: Devise; total: number }[] }[];
}

export function calculerIndicateurs(args: {
  immeubles: Immeuble[];
  appartements: Appartement[];
  baux: Bail[];
  echeances: EcheanceLoyer[];
  paiements: Paiement[];
  depenses: Depense[];
  moisIso: string; // 1er du mois en cours, ex. « 2026-11-01 »
  aujourdHui?: Date;
}): IndicateursParc {
  const { appartements, baux, echeances, paiements, depenses, moisIso } = args;
  const aujourdHui = args.aujourdHui ?? new Date();
  const actifs = appartements.filter((a) => !a.archive);
  const louables = actifs.filter((a) => a.statut !== "travaux");
  const nbOccupes = louables.filter((a) =>
    baux.some((b) => b.appartement_id === a.id && b.statut === "actif")
  ).length;
  const nbVacants = actifs.filter((a) => a.statut === "vacant").length;

  const echeancesMois = echeances.filter((e) => e.mois === moisIso);
  const attendus = sommerParDevise(
    echeancesMois.map((e) => ({ montant: e.montant_du, devise: e.devise }))
  );
  const payesMois = paiements.filter(
    (p) => p.statut === "valide" && echeancesMois.some((e) => e.id === p.echeance_id)
  );
  const collectes = sommerParDevise(
    payesMois.map((p) => {
      const ech = echeancesMois.find((e) => e.id === p.echeance_id);
      // Montant imputé dans la devise de l'échéance (converti si besoin).
      if (ech && p.devise !== ech.devise && p.montant_converti != null) {
        return { montant: p.montant_converti, devise: ech.devise };
      }
      return { montant: p.montant, devise: p.devise };
    })
  );
  const collecteParDevise = attendus.map(({ devise, total }) => {
    const collecte = collectes.find((c) => c.devise === devise)?.total ?? 0;
    return { devise, taux: total > 0 ? Math.min(1, collecte / total) : null };
  });

  // En retard : restant dû des échéances dont l'exigibilité + grâce est dépassée.
  const retards: EcheanceLoyer[] = [];
  const retardParDevise = new Map<Devise, number>();
  for (const e of echeances) {
    const bail = baux.find((b) => b.id === e.bail_id);
    if (!bail) continue;
    const paye = totalPayeValide(paiements.filter((p) => p.echeance_id === e.id), e.devise);
    if (paye >= e.montant_du) continue;
    const exigibilite = new Date(`${dateExigibilite(e.mois, bail.jour_exigibilite)}T00:00:00`);
    const grace = new Date(exigibilite);
    grace.setDate(grace.getDate() + DELAI_GRACE_JOURS);
    const jour = new Date(aujourdHui.getFullYear(), aujourdHui.getMonth(), aujourdHui.getDate());
    if (jour > grace) {
      retards.push(e);
      retardParDevise.set(e.devise, (retardParDevise.get(e.devise) ?? 0) + (e.montant_du - paye));
    }
  }
  retards.sort((a, b) => b.mois.localeCompare(a.mois));
  const enRetard = Array.from(retardParDevise.entries())
    .map(([devise, total]) => ({ devise, total }))
    .sort((a, b) => a.devise.localeCompare(b.devise));

  // Fins de bail à 60 jours.
  const limite60 = new Date(aujourdHui);
  limite60.setDate(limite60.getDate() + 60);
  const finsDeBail60j = baux
    .filter((b) => b.statut === "actif" && b.fin)
    .filter((b) => {
      const fin = new Date(`${b.fin!.slice(0, 10)}T00:00:00`);
      return fin >= new Date(aujourdHui.getFullYear(), aujourdHui.getMonth(), aujourdHui.getDate()) && fin <= limite60;
    })
    .sort((a, b) => (a.fin ?? "").localeCompare(b.fin ?? ""));

  const depensesMois = depenses
    .filter((d) => d.date.slice(0, 7) === moisIso.slice(0, 7))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Collecte des 6 derniers mois (mois du mois en cours, en arrière).
  const collecte6Mois: IndicateursParc["collecte6Mois"] = [];
  const [an, mo] = moisIso.slice(0, 7).split("-").map(Number);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(an, mo - 1 - i, 1);
    const mois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    const echMois = echeances.filter((e) => e.mois === mois);
    const payMois = paiements.filter(
      (p) => p.statut === "valide" && echMois.some((e) => e.id === p.echeance_id)
    );
    collecte6Mois.push({
      mois,
      collectes: sommerParDevise(payMois.map((p) => ({ montant: p.montant, devise: p.devise }))),
      attendus: sommerParDevise(echMois.map((e) => ({ montant: e.montant_du, devise: e.devise }))),
    });
  }

  return {
    occupation: louables.length > 0 ? nbOccupes / louables.length : null,
    nbLouables: louables.length,
    nbOccupes,
    nbVacants,
    collectes,
    attendus,
    collecteParDevise,
    enRetard,
    retards,
    finsDeBail60j,
    depensesMois,
    collecte6Mois,
  };
}

// ---------------------------------------------------------------------------
// Alertes — génération idempotente (spec §10)
// ---------------------------------------------------------------------------

export interface AlerteCandidate {
  type: TypeAlerte;
  entite_type: string | null;
  entite_id: string | null;
  message: string;
  dedup_key: string;
  urgence: UrgenceAlerte;
}

function joursEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Génère les alertes candidates à une date donnée, à partir des données du
 * parc. Ne crée rien : l'appelant insère celles dont la dedup_key n'existe
 * pas encore (ni active ni traitée) — pas de doublon pour le même événement.
 */
/**
 * Messages d'alerte dans les deux langues (Module 7, spec §14 : les
 * alertes existent en FR et en EN). Les messages déjà stockés restent
 * dans leur langue d'origine — les données ne sont jamais retraduites.
 */
const MESSAGES_ALERTE = {
  fr: {
    loyerEnRetard: (mois: string, restant: number, devise: string) =>
      `Loyer en retard — échéance ${mois}, restant ${restant} ${devise}`,
    finDeBail: (seuil: string, date: string) => `Fin de bail ${seuil} — ${date}`,
    vacance: (jours: number, numero: string) =>
      `Appartement vacant depuis ${jours} jours — ${numero}`,
    bailDemarrant: (date: string) => `Bail démarrant demain — ${date}`,
    finEssai: (seuil: string, date: string) => `Fin de l'essai ${seuil} — ${date}`,
    echecPaiement: (date: string) =>
      `Échec du paiement de l'abonnement — grâce jusqu'au ${date}`,
  },
  en: {
    loyerEnRetard: (mois: string, restant: number, devise: string) =>
      `Late rent — due ${mois}, remaining ${restant} ${devise}`,
    finDeBail: (seuil: string, date: string) => `Lease ending ${seuil} — ${date}`,
    vacance: (jours: number, numero: string) =>
      `Apartment vacant for ${jours} days — ${numero}`,
    bailDemarrant: (date: string) => `Lease starting tomorrow — ${date}`,
    finEssai: (seuil: string, date: string) => `Trial ending ${seuil} — ${date}`,
    echecPaiement: (date: string) =>
      `Subscription payment failed — grace period until ${date}`,
  },
} as const;

export function genererAlertesCandidates(args: {
  baux: Bail[];
  echeances: EcheanceLoyer[];
  paiements: Paiement[];
  appartements: Appartement[];
  abonnement: Abonnement | null;
  seuilVacanceJours?: number;
  aujourdHui?: Date;
  /** Langue du message généré ("fr" par défaut). */
  langue?: "fr" | "en";
}): AlerteCandidate[] {
  const { baux, echeances, paiements, appartements, abonnement } = args;
  const msg = MESSAGES_ALERTE[args.langue === "en" ? "en" : "fr"];
  const seuilVacance = args.seuilVacanceJours ?? SEUIL_VACANCE_DEFAUT_JOURS;
  const maintenant = args.aujourdHui ?? new Date();
  const jour = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  const candidates: AlerteCandidate[] = [];

  // 1. Loyer en retard : échéance non soldée après le délai de grâce,
  //    rappels à +7 et +15 jours après la grâce.
  for (const e of echeances) {
    const bail = baux.find((b) => b.id === e.bail_id);
    if (!bail) continue;
    const paye = totalPayeValide(paiements.filter((p) => p.echeance_id === e.id), e.devise);
    if (paye >= e.montant_du) continue;
    const exigibilite = new Date(`${dateExigibilite(e.mois, bail.jour_exigibilite)}T00:00:00`);
    const grace = new Date(exigibilite);
    grace.setDate(grace.getDate() + DELAI_GRACE_JOURS);
    const joursDepuisGrace = joursEntre(grace, jour);
    if (joursDepuisGrace < 1) continue;
    const rappel = joursDepuisGrace >= 15 ? "+15" : joursDepuisGrace >= 7 ? "+7" : "initial";
    candidates.push({
      type: "loyer_en_retard",
      entite_type: "loyer",
      entite_id: e.id,
      message: msg.loyerEnRetard(e.mois.slice(0, 7), e.montant_du - paye, e.devise),
      dedup_key: `loyer_en_retard:${e.id}:${rappel}`,
      urgence: joursDepuisGrace >= 15 ? "haute" : "moyenne",
    });
  }

  // 2. Fin de bail : J-60, J-30, J-7.
  for (const b of baux.filter((x) => x.statut === "actif" && x.fin)) {
    const fin = new Date(`${b.fin!.slice(0, 10)}T00:00:00`);
    const joursRestants = joursEntre(jour, fin);
    const seuil = joursRestants === 7 ? "J-7" : joursRestants === 30 ? "J-30" : joursRestants === 60 ? "J-60" : null;
    if (!seuil) continue;
    candidates.push({
      type: "fin_de_bail",
      entite_type: "bail",
      entite_id: b.id,
      message: msg.finDeBail(seuil, b.fin!.slice(0, 10)),
      dedup_key: `fin_de_bail:${b.id}:${seuil}`,
      urgence: seuil === "J-7" ? "haute" : seuil === "J-30" ? "moyenne" : "basse",
    });
  }

  // 3. Vacance prolongée : appartement vacant depuis plus du seuil.
  //    Début de vacance = fin du dernier bail terminé, sinon date de création.
  for (const a of appartements.filter((x) => !x.archive && x.statut === "vacant")) {
    const dernierBail = baux
      .filter((b) => b.appartement_id === a.id && b.statut === "termine" && b.fin)
      .sort((x, y) => (y.fin ?? "").localeCompare(x.fin ?? ""))[0];
    const depuis = dernierBail?.fin
      ? new Date(`${dernierBail.fin.slice(0, 10)}T00:00:00`)
      : new Date(a.created_at.slice(0, 10) + "T00:00:00");
    const joursVacant = joursEntre(depuis, jour);
    if (joursVacant < seuilVacance) continue;
    candidates.push({
      type: "vacance_prolongee",
      entite_type: "appartement",
      entite_id: a.id,
      message: msg.vacance(joursVacant, a.numero),
      dedup_key: `vacance_prolongee:${a.id}`,
      urgence: joursVacant >= seuilVacance * 2 ? "moyenne" : "basse",
    });
  }

  // 4. Bail démarrant : la veille du début d'un bail créé à l'avance.
  for (const b of baux.filter((x) => x.statut === "actif")) {
    const debut = new Date(`${b.debut.slice(0, 10)}T00:00:00`);
    if (joursEntre(jour, debut) === 1) {
      candidates.push({
        type: "bail_demarrant",
        entite_type: "bail",
        entite_id: b.id,
        message: msg.bailDemarrant(b.debut.slice(0, 10)),
        dedup_key: `bail_demarrant:${b.id}`,
        urgence: "basse",
      });
    }
  }

  // 5. Essai / abonnement : J-7 et J-1 avant la fin d'essai.
  if (abonnement?.statut === "essai" && abonnement.trial_ends_at) {
    const finEssai = new Date(abonnement.trial_ends_at.slice(0, 10) + "T00:00:00");
    const joursRestants = joursEntre(jour, finEssai);
    const seuil = joursRestants === 1 ? "J-1" : joursRestants === 7 ? "J-7" : null;
    if (seuil) {
      candidates.push({
        type: "essai_abonnement",
        entite_type: "abonnement",
        entite_id: abonnement.id,
        message: msg.finEssai(seuil, abonnement.trial_ends_at.slice(0, 10)),
        dedup_key: `essai_abonnement:${abonnement.id}:${seuil}`,
        urgence: seuil === "J-1" ? "haute" : "moyenne",
      });
    }
  }

  // 6. Échec de paiement d'abonnement : alerte immédiate, grâce de 7 jours
  // (spec §12). Une seule alerte par période de grâce (clé = fin de grâce).
  if (abonnement?.echec_paiement && abonnement.grace_ends_at) {
    candidates.push({
      type: "essai_abonnement",
      entite_type: "abonnement",
      entite_id: abonnement.id,
      message: msg.echecPaiement(abonnement.grace_ends_at.slice(0, 10)),
      dedup_key: `echec_paiement:${abonnement.id}:${abonnement.grace_ends_at.slice(0, 10)}`,
      urgence: "haute",
    });
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Rapports & ROI (spec §9, §11)
// ---------------------------------------------------------------------------

export interface LigneRapport {
  immeuble_id: string | null;
  immeuble_nom: string;
  devise: Devise;
  revenus: number;
  depenses: number;
  resultatNet: number;
  valeurBien: number | null;
  /** null = « valeur à renseigner », jamais un chiffre inventé. */
  roi: number | null;
  /** Marge nette, affichée séparément du ROI. */
  marge: number | null;
  occupation: number | null;
  nbAppartements: number;
}

export interface RapportParc {
  periodeDebut: string;
  periodeFin: string;
  lignes: LigneRapport[];
  /** Totaux du parc par devise d'origine (jamais mélangés). */
  revenusParDevise: { devise: Devise; total: number }[];
  depensesParDevise: { devise: Devise; total: number }[];
  /** ROI du parc : somme des résultats ÷ somme des valeurs (même devise). */
  roiParc: { devise: Devise; roi: number | null; valeurTotale: number | null }[];
  margeParc: { devise: Devise; marge: number | null }[];
}

/**
 * Rapport sur une période (dates ISO incluses). Revenus = paiements déclarés
 * valides dont la date de paiement est dans la période ; dépenses = dépenses
 * de la période. La caution n'entre jamais dans les revenus.
 */
export function calculerRapport(args: {
  immeubles: Immeuble[];
  appartements: Appartement[];
  baux: Bail[];
  echeances: EcheanceLoyer[];
  paiements: Paiement[];
  depenses: Depense[];
  periodeDebut: string;
  periodeFin: string;
  immeubleId?: string | null;
}): RapportParc {
  const { immeubles, appartements, baux, echeances, paiements, depenses, periodeDebut, periodeFin } = args;
  const dansPeriode = (dateIso: string) => {
    const d = dateIso.slice(0, 10);
    return d >= periodeDebut.slice(0, 10) && d <= periodeFin.slice(0, 10);
  };
  const immeublesCibles = immeubles.filter(
    (i) => i.statut === "actif" && (!args.immeubleId || i.id === args.immeubleId)
  );

  const lignes: LigneRapport[] = immeublesCibles.map((imm) => {
    const apts = appartements.filter((a) => a.immeuble_id === imm.id && !a.archive);
    const bauxImm = baux.filter((b) => apts.some((a) => a.id === b.appartement_id));
    const echIds = new Set(
      echeances.filter((e) => bauxImm.some((b) => b.id === e.bail_id)).map((e) => e.id)
    );
    const revenusImm = paiements.filter(
      (p) => p.statut === "valide" && echIds.has(p.echeance_id) && dansPeriode(p.date_paiement) && p.devise === imm.devise
    );
    const revenus = revenusImm.reduce((s, p) => s + p.montant, 0);
    const depImm = depenses.filter(
      (d) => d.immeuble_id === imm.id && dansPeriode(d.date) && d.devise === imm.devise
    );
    const depTotal = depImm.reduce((s, d) => s + d.montant, 0);
    const louables = apts.filter((a) => a.statut !== "travaux");
    const occupes = apts.filter((a) => baux.some((b) => b.appartement_id === a.id && b.statut === "actif")).length;
    return {
      immeuble_id: imm.id,
      immeuble_nom: imm.nom,
      devise: imm.devise,
      revenus,
      depenses: depTotal,
      resultatNet: revenus - depTotal,
      valeurBien: imm.valeur_bien,
      roi: calculerRoi(revenus, depTotal, imm.valeur_bien),
      marge: calculerMargeNette(revenus, depTotal),
      occupation: louables.length > 0 ? occupes / louables.length : null,
      nbAppartements: apts.length,
    };
  });

  const revenusParDevise = sommerParDevise(
    lignes.map((l) => ({ montant: l.revenus, devise: l.devise }))
  );
  const depensesParDevise = sommerParDevise(
    lignes.map((l) => ({ montant: l.depenses, devise: l.devise }))
  );
  const roiParc: RapportParc["roiParc"] = [];
  const margeParc: RapportParc["margeParc"] = [];
  for (const { devise } of revenusParDevise) {
    const lignesDevise = lignes.filter((l) => l.devise === devise);
    const valeurTotale = lignesDevise.reduce((s, l) => s + (l.valeurBien ?? 0), 0);
    const aUneValeur = lignesDevise.some((l) => l.valeurBien && l.valeurBien > 0);
    const resultatTotal = lignesDevise.reduce((s, l) => s + l.resultatNet, 0);
    const revenusTotal = lignesDevise.reduce((s, l) => s + l.revenus, 0);
    roiParc.push({
      devise,
      roi: aUneValeur ? calculerRoi(revenusTotal, lignesDevise.reduce((s, l) => s + l.depenses, 0), valeurTotale) : null,
      valeurTotale: aUneValeur ? valeurTotale : null,
    });
    margeParc.push({ devise, marge: calculerMargeNette(revenusTotal, lignesDevise.reduce((s, l) => s + l.depenses, 0)) });
    void resultatTotal;
  }

  return { periodeDebut, periodeFin, lignes, revenusParDevise, depensesParDevise, roiParc, margeParc };
}

/** ROI par appartement (si sa valeur est renseignée, sinon celle de l'immeuble). */
export function roiAppartement(args: {
  appartement: Appartement;
  immeuble: Immeuble | undefined;
  baux: Bail[];
  echeances: EcheanceLoyer[];
  paiements: Paiement[];
  depenses: Depense[];
  periodeDebut: string;
  periodeFin: string;
}): number | null {
  const { appartement, immeuble, baux, echeances, paiements, depenses, periodeDebut, periodeFin } = args;
  const valeur = appartement.valeur_bien ?? immeuble?.valeur_bien ?? null;
  if (!valeur || valeur <= 0) return null;
  const bauxApt = baux.filter((b) => b.appartement_id === appartement.id);
  const echIds = new Set(echeances.filter((e) => bauxApt.some((b) => b.id === e.bail_id)).map((e) => e.id));
  const devise = appartement.devise;
  const revenus = paiements
    .filter((p) => p.statut === "valide" && echIds.has(p.echeance_id) && p.devise === devise &&
      p.date_paiement.slice(0, 10) >= periodeDebut.slice(0, 10) && p.date_paiement.slice(0, 10) <= periodeFin.slice(0, 10))
    .reduce((s, p) => s + p.montant, 0);
  const depTotal = depenses
    .filter((d) => d.appartement_id === appartement.id && d.devise === devise &&
      d.date.slice(0, 10) >= periodeDebut.slice(0, 10) && d.date.slice(0, 10) <= periodeFin.slice(0, 10))
    .reduce((s, d) => s + d.montant, 0);
  return calculerRoi(revenus, depTotal, valeur);
}

// ---------------------------------------------------------------------------
// Fil d'actualité — tri chronologique, filtre par immeuble (spec §6 suite)
// ---------------------------------------------------------------------------

export function filtrerActivites(
  activites: Activite[],
  immeubleId?: string | null,
  appartements?: Appartement[]
): Activite[] {
  if (!immeubleId || !appartements) return activites.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
  const aptIds = new Set(appartements.filter((a) => a.immeuble_id === immeubleId).map((a) => a.id));
  return activites
    .filter((a) => {
      if (a.entite_type === "immeuble") return a.entite_id === immeubleId;
      if (a.entite_type === "appartement") return a.entite_id ? aptIds.has(a.entite_id) : false;
      return true; // événements sans immeuble précis (paiement via bail…) : gardés, l'écran affine si possible
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** URL de destination d'un événement du fil (ou null si aucun élément lié). */
export function urlActivite(a: Activite): string | null {
  switch (a.entite_type) {
    case "immeuble": return `/immeubles/${a.entite_id}`;
    case "appartement": return `/appartements/${a.entite_id}`;
    case "locataire": return `/locataires/${a.entite_id}`;
    case "bail": return "/loyers";
    case "loyer": return "/loyers";
    case "depense": return "/depenses";
    case "document": return "/documents";
    case "alerte": return "/alertes";
    default: return null;
  }
}

/** URL de destination d'une alerte (ou null). */
export function urlAlerte(a: Alerte): string | null {
  switch (a.entite_type) {
    case "immeuble": return `/immeubles/${a.entite_id}`;
    case "appartement": return `/appartements/${a.entite_id}`;
    case "locataire": return `/locataires/${a.entite_id}`;
    case "bail": return "/loyers";
    case "loyer": return "/loyers";
    case "abonnement": return "/parametres";
    default: return "/alertes";
  }
}

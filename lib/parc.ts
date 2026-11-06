/**
 * CizaImmo — calculs du parc (Module 2, spec §9).
 * Toutes les sommes sont faites dans UNE seule devise (celle du bien) :
 * les montants d'une autre devise ne sont jamais mélangés silencieusement.
 */
import type {
  Appartement,
  Bail,
  Depense,
  EcheanceLoyer,
  Immeuble,
  Paiement,
} from "./data";
import { calculerMargeNette, calculerRoi } from "./format";

export interface StatsImmeuble {
  nbAppartements: number;
  nbOccupes: number;
  nbLouables: number;
  /** 0–1, null si aucun appartement louable. */
  occupation: number | null;
  /** Loyers mensuels des baux actifs, dans la devise de l'immeuble. */
  loyersMois: number;
  revenus: number;
  depenses: number;
  roi: number | null;
  marge: number | null;
  deviseValeur: string | null;
}

export function bailActif(baux: Bail[], appartementId: string): Bail | undefined {
  return baux.find((b) => b.appartement_id === appartementId && b.statut === "actif");
}

export function statsImmeuble(
  immeuble: Immeuble,
  appartements: Appartement[],
  baux: Bail[],
  echeances: EcheanceLoyer[],
  paiements: Paiement[],
  depenses: Depense[]
): StatsImmeuble {
  const apts = appartements.filter(
    (a) => a.immeuble_id === immeuble.id && !a.archive
  );
  const louables = apts.filter((a) => a.statut !== "travaux");
  const bauxActifs = baux.filter(
    (b) => b.statut === "actif" && apts.some((a) => a.id === b.appartement_id)
  );
  const nbOccupes = apts.filter((a) => bailActif(baux, a.id)).length;
  const loyersMois = bauxActifs
    .filter((b) => b.devise === immeuble.devise)
    .reduce((s, b) => s + b.loyer_mensuel, 0);

  const deviseValeur = immeuble.devise_valeur ?? immeuble.devise;
  const echeanceIds = new Set(
    echeances
      .filter((e) => bauxActifs.some((b) => b.id === e.bail_id))
      .map((e) => e.id)
  );
  const revenus = paiements
    .filter((p) => p.statut === "valide" && echeanceIds.has(p.echeance_id) && p.devise === deviseValeur)
    .reduce((s, p) => s + p.montant, 0);
  const depensesTotal = depenses
    .filter((d) => d.immeuble_id === immeuble.id && d.devise === deviseValeur)
    .reduce((s, d) => s + d.montant, 0);

  return {
    nbAppartements: apts.length,
    nbOccupes,
    nbLouables: louables.length,
    occupation: louables.length > 0 ? nbOccupes / louables.length : null,
    loyersMois,
    revenus,
    depenses: depensesTotal,
    roi: calculerRoi(revenus, depensesTotal, immeuble.valeur_bien),
    marge: calculerMargeNette(revenus, depensesTotal),
    deviseValeur: immeuble.valeur_bien ? deviseValeur : null,
  };
}

/** Premier jour du mois en cours (AAAA-MM-01), pour le statut du mois. */
export function moisCourant(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

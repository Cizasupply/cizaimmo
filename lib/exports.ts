/**
 * CizaImmo — exports Excel (Module 4, spec §11).
 * Librairie : xlsx (SheetJS). Chaque export respecte les filtres actifs à
 * l'écran (les données filtrées sont passées en entrée) et mentionne en
 * première ligne la période, la date d'export et les devises concernées.
 * Aucun export n'est ajouté ailleurs que Loyers, Dépenses, Locataires,
 * Rapports.
 */
import * as XLSX from "xlsx";
import type {
  Appartement,
  Bail,
  Depense,
  Devise,
  EcheanceLoyer,
  Immeuble,
  Locataire,
  Paiement,
} from "./data/types";
import type { RapportParc } from "./module4";

export interface MetaExport {
  /** Période couverte, ex. « 2026-11 » ou « 2026-01-01 → 2026-11-30 ». */
  periode: string;
  /** Date d'export ISO (AAAA-MM-JJ). */
  dateExport: string;
  /** Devises concernées par les données exportées. */
  devises: string[];
}

function ligneMeta(meta: MetaExport): string[] {
  return [
    `Période : ${meta.periode} — Export du ${meta.dateExport} — Devises : ${meta.devises.join(", ") || "—"}`,
  ];
}

function feuilleAvecMeta(titre: string, entetes: string[], lignes: (string | number | null)[][], meta: MetaExport): XLSX.WorkSheet {
  const donnees: (string | number | null)[][] = [ligneMeta(meta), [], entetes, ...lignes];
  const ws = XLSX.utils.aoa_to_sheet(donnees);
  ws["!cols"] = entetes.map(() => ({ wch: 22 }));
  return ws;
}

export interface DonneesLoyers {
  echeances: { echeance: EcheanceLoyer; bail?: Bail; locataire?: Locataire; appartement?: Appartement; immeuble?: Immeuble; paye: number; restant: number }[];
  paiements: { paiement: Paiement; locataireNom: string; mois: string }[];
}

/** Excel Loyers : feuilles « Loyers », « Paiements », « Synthèse » (spec §11). */
export function buildLoyersWorkbook(donnees: DonneesLoyers, meta: MetaExport): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const lignesLoyers = donnees.echeances.map(({ echeance, bail, locataire, appartement, immeuble, paye, restant }) => [
    echeance.mois.slice(0, 7),
    locataire?.nom ?? "—",
    appartement?.numero ?? "—",
    immeuble?.nom ?? "—",
    echeance.montant_du,
    echeance.devise,
    paye,
    restant,
    echeance.statut,
    bail?.jour_exigibilite ?? "",
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    feuilleAvecMeta("Loyers", ["Mois", "Locataire", "Appartement", "Immeuble", "Loyer dû", "Devise", "Payé (déclaré)", "Restant", "Statut", "Jour d'exigibilité"], lignesLoyers, meta),
    "Loyers"
  );
  const lignesPaiements = donnees.paiements.map(({ paiement, locataireNom, mois }) => [
    mois.slice(0, 7),
    paiement.recu_numero ?? "—",
    locataireNom,
    paiement.date_paiement,
    paiement.montant,
    paiement.devise,
    paiement.moyen,
    paiement.reference ?? "",
    paiement.statut,
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    feuilleAvecMeta("Paiements", ["Mois", "N° reçu", "Locataire", "Date du paiement", "Montant", "Devise", "Moyen", "Référence", "Statut"], lignesPaiements, meta),
    "Paiements"
  );
  // Synthèse : totaux par mois et par immeuble (par devise, jamais mélangés).
  const cle = new Map<string, { mois: string; immeuble: string; devise: Devise; du: number; paye: number }>();
  for (const { echeance, immeuble, paye } of donnees.echeances) {
    const k = `${echeance.mois.slice(0, 7)}|${immeuble?.nom ?? "—"}|${echeance.devise}`;
    const ligne = cle.get(k) ?? { mois: echeance.mois.slice(0, 7), immeuble: immeuble?.nom ?? "—", devise: echeance.devise, du: 0, paye: 0 };
    ligne.du += echeance.montant_du;
    ligne.paye += paye;
    cle.set(k, ligne);
  }
  const lignesSynthese = Array.from(cle.values())
    .sort((a, b) => a.mois.localeCompare(b.mois) || a.immeuble.localeCompare(b.immeuble))
    .map((l) => [l.mois, l.immeuble, l.devise, l.du, l.paye, Math.max(0, l.du - l.paye)]);
  XLSX.utils.book_append_sheet(
    wb,
    feuilleAvecMeta("Synthèse", ["Mois", "Immeuble", "Devise", "Total dû", "Total payé (déclaré)", "Restant"], lignesSynthese, meta),
    "Synthèse"
  );
  return wb;
}

/** Excel Dépenses : une ligne par dépense (spec §11). */
export function buildDepensesWorkbook(depenses: Depense[], noms: { immeuble: (id: string) => string; appartement: (id: string | null) => string }, meta: MetaExport): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const lignes = depenses.map((d) => [
    d.date,
    noms.immeuble(d.immeuble_id),
    noms.appartement(d.appartement_id),
    d.categorie,
    d.libelle,
    d.montant,
    d.devise,
    d.fournisseur ?? "",
    d.justificatif_url ? "Oui" : "Non",
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    feuilleAvecMeta("Dépenses", ["Date", "Immeuble", "Appartement", "Catégorie", "Libellé", "Montant", "Devise", "Fournisseur", "Justificatif joint"], lignes, meta),
    "Dépenses"
  );
  return wb;
}

/** Excel Locataires : annuaire (spec §11). */
export function buildLocatairesWorkbook(
  locataires: { locataire: Locataire; appartement?: Appartement; immeuble?: Immeuble; bail?: Bail; statutMois: string }[],
  meta: MetaExport
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const lignes = locataires.map(({ locataire, appartement, immeuble, bail, statutMois }) => [
    locataire.nom,
    locataire.telephone,
    locataire.email ?? "",
    appartement?.numero ?? "—",
    immeuble?.nom ?? "—",
    bail ? `${bail.debut.slice(0, 10)} → ${bail.fin ? bail.fin.slice(0, 10) : "—"}` : "—",
    statutMois,
  ]);
  XLSX.utils.book_append_sheet(
    wb,
    feuilleAvecMeta("Locataires", ["Nom", "Téléphone", "E-mail", "Appartement", "Immeuble", "Bail en cours", "Statut du mois"], lignes, meta),
    "Locataires"
  );
  return wb;
}

/** Excel Rapport : données du rapport (revenus, dépenses, ROI, marge nette). */
export function buildRapportWorkbook(rapport: RapportParc, meta: MetaExport & { tauxUtilises: string[] }): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const lignes = rapport.lignes.map((l) => [
    l.immeuble_nom,
    l.devise,
    l.revenus,
    l.depenses,
    l.resultatNet,
    l.valeurBien ?? "valeur à renseigner",
    l.roi === null ? "valeur à renseigner" : Math.round(l.roi * 10000) / 100,
    l.marge === null ? "—" : Math.round(l.marge * 10000) / 100,
    l.occupation === null ? "—" : Math.round(l.occupation * 1000) / 10,
    l.nbAppartements,
  ]);
  const ws = feuilleAvecMeta(
    "Rapport",
    ["Immeuble", "Devise", "Revenus déclarés", "Dépenses", "Résultat net", "Valeur du bien", "ROI (%)", "Marge nette (%)", "Occupation (%)", "Appartements"],
    lignes,
    meta
  );
  XLSX.utils.book_append_sheet(wb, ws, "Rapport");
  const lignesTaux = meta.tauxUtilises.map((t) => [t]);
  XLSX.utils.book_append_sheet(
    wb,
    feuilleAvecMeta("Taux utilisés", ["Taux (source → cible, valeur, date, source)"], lignesTaux, meta),
    "Taux utilisés"
  );
  return wb;
}

/** Télécharge un classeur côté client (nom de fichier horodaté). */
export function telechargerWorkbook(wb: XLSX.WorkBook, nomFichier: string): void {
  XLSX.writeFile(wb, nomFichier);
}

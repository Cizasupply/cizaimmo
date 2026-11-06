/**
 * CizaImmo — export PDF du rapport (Module 4, spec §11).
 * Généré côté client avec jsPDF (déjà installé, réutilisé depuis les reçus) :
 * indicateurs, tableau par immeuble, taux de change utilisés. Bleu marine et
 * or, lisible sur téléphone (une page A4, texte ≥ 10 pt).
 */
import { jsPDF } from "jspdf";
import { formatDate, formatMoney, formatPct } from "./format";
import type { RapportParc } from "./module4";

const NAVY: [number, number, number] = [27, 42, 74];
const GOLD: [number, number, number] = [212, 175, 55];

export interface DonneesRapportPdf {
  rapport: RapportParc;
  /** Taux utilisés, en clair : « USD → BIF : 2900 (taux du 2026-11-05, auto) ». */
  tauxUtilises: string[];
  dateExport: string;
  langue: "fr" | "en";
}

export function telechargerRapportPdf(donnees: DonneesRapportPdf): void {
  const { rapport, tauxUtilises, dateExport, langue } = donnees;
  const fr = langue === "fr";
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const largeur = 210;
  let y = 18;

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, largeur, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("CIZAIMMO", 14, 11);
  doc.setTextColor(...GOLD);
  doc.setFontSize(10);
  doc.text(fr ? "Rapport & ROI — division de Ciza Group" : "Report & ROI — a Ciza Group division", 14, 19);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text(`${formatDate(rapport.periodeDebut, langue)} → ${formatDate(rapport.periodeFin, langue)}`, 196, 11, { align: "right" });
  doc.text(fr ? `Export du ${formatDate(dateExport, langue)}` : `Exported ${formatDate(dateExport, langue)}`, 196, 19, { align: "right" });

  y = 36;
  doc.setTextColor(...NAVY);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(fr ? "Revenus, dépenses et rentabilité" : "Income, expenses and profitability", 14, y);
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  for (const r of rapport.revenusParDevise) {
    const dep = rapport.depensesParDevise.find((d) => d.devise === r.devise)?.total ?? 0;
    doc.text(
      `${r.devise} — ${fr ? "revenus" : "income"} ${formatMoney(r.total, r.devise, langue)} · ${fr ? "dépenses" : "expenses"} ${formatMoney(dep, r.devise, langue)} · ${fr ? "résultat net" : "net result"} ${formatMoney(r.total - dep, r.devise, langue)}`,
      14, y
    );
    y += 6;
  }
  for (const r of rapport.roiParc) {
    doc.text(
      `${r.devise} — ROI ${r.roi === null ? (fr ? "valeur à renseigner" : "value to enter") : formatPct(r.roi, langue)} · ${fr ? "marge nette" : "net margin"} ${(() => { const m = rapport.margeParc.find((x) => x.devise === r.devise)?.marge ?? null; return m === null ? "—" : formatPct(m, langue); })()}`,
      14, y
    );
    y += 6;
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(fr ? "Par immeuble" : "Per building", 14, y);
  y += 7;
  doc.setFontSize(9);
  const entetes = [fr ? "Immeuble" : "Building", fr ? "Revenus" : "Income", fr ? "Dépenses" : "Expenses", fr ? "Net" : "Net", "ROI", fr ? "Marge" : "Margin"];
  const x = [14, 62, 100, 136, 164, 182];
  entetes.forEach((h, i) => doc.text(h, x[i], y));
  doc.setDrawColor(...GOLD);
  doc.line(14, y + 2, 196, y + 2);
  y += 8;
  doc.setFont("helvetica", "normal");
  for (const l of rapport.lignes) {
    if (y > 265) { doc.addPage(); y = 20; }
    doc.text(l.immeuble_nom.slice(0, 24), x[0], y);
    doc.text(formatMoney(l.revenus, l.devise, langue), x[1], y);
    doc.text(formatMoney(l.depenses, l.devise, langue), x[2], y);
    doc.text(formatMoney(l.resultatNet, l.devise, langue), x[3], y);
    doc.text(l.roi === null ? (fr ? "valeur à renseigner" : "value to enter") : formatPct(l.roi, langue), x[4], y);
    doc.text(l.marge === null ? "—" : formatPct(l.marge, langue), x[5], y);
    y += 6;
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(fr ? "Taux de change utilisés" : "Exchange rates used", 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (tauxUtilises.length === 0) {
    doc.text(fr ? "Aucune conversion : tous les montants sont dans leur devise d'origine." : "No conversion: all amounts are in their original currency.", 14, y);
  } else {
    for (const t of tauxUtilises) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.text(`• ${t}`, 14, y);
      y += 5;
    }
  }
  y += 6;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    fr ? "Paiements déclarés par le gestionnaire — CizaImmo n'encaisse pas les loyers." : "Payments declared by the manager — CizaImmo never collects rent.",
    14, y
  );
  doc.save(`cizaimmo-rapport-${rapport.periodeDebut.slice(0, 7)}-${rapport.periodeFin.slice(0, 7)}.pdf`);
}

/**
 * CizaImmo — formatage d'affichage (Module 2).
 * Les montants gardent toujours leur devise d'origine (spec §9).
 */

/** Montant + devise d'origine, formatés selon la langue de l'interface. */
export function formatMoney(
  montant: number,
  devise: string,
  locale: string
): string {
  try {
    return new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR", {
      style: "currency",
      currency: devise,
      maximumFractionDigits: devise === "BIF" ? 0 : 2,
    }).format(montant);
  } catch {
    return `${montant} ${devise}`;
  }
}

/** Date ISO (AAAA-MM-JJ) affichée dans la langue de l'interface. */
export function formatDate(dateStr: string | null | undefined, locale: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr.length <= 10 ? `${dateStr}T00:00:00` : dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Pourcentage avec une décimale (ex. 66,7 % / 66.7%). */
export function formatPct(valeur: number, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(valeur);
}

/**
 * ROI net (spec §9) : (revenus déclarés − dépenses) ÷ valeur du bien.
 * Retourne null si la valeur du bien n'est pas renseignée : le ROI n'est
 * jamais inventé, l'écran invite alors à saisir la valeur.
 */
export function calculerRoi(
  revenus: number,
  depenses: number,
  valeurBien: number | null | undefined
): number | null {
  if (!valeurBien || valeurBien <= 0) return null;
  return (revenus - depenses) / valeurBien;
}

/** Marge nette d'exploitation (spec §9) : affichée séparément du ROI. */
export function calculerMargeNette(revenus: number, depenses: number): number | null {
  if (!revenus || revenus <= 0) return null;
  return (revenus - depenses) / revenus;
}

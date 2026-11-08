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

/**
 * Date ET heure localisées (registre d'audit enrichi, 2026-11-07) :
 * FR « 7 nov. 2026 à 17 h 30 » / EN “Nov 7, 2026 at 5:30 PM”.
 * L'heure est celle de l'appareil de lecture (fuseau local).
 */
export function formatDateTime(dateStr: string | null | undefined, locale: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const en = locale === "en";
  const langue = en ? "en-US" : "fr-FR";
  const date = new Intl.DateTimeFormat(langue, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
  const heure = new Intl.DateTimeFormat(langue, {
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
  return en ? `${date} at ${heure}` : `${date} à ${heure.replace(":", " h ")}`;
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

/**
 * Rendu lisible des détails d'une entrée du journal d'audit (champ
 * jsonb `details`) pour une cellule de tableau — correctif
 * 2026-11-07 : l'ancien rendu (un `String(v)` par entrée de premier
 * niveau) affichait « [object Object] » dès qu'un détail était un
 * objet ou un tableau imbriqué — vécu en production sur « Tarifs
 * modifiés » (« tarifs: [object Object],[object Object],… ») et
 * « Paramètres finance modifiés » (« parametres: [object Object] »),
 * alors que les détails plats (« grille: afrique ») passaient.
 *
 * Règles : primitives telles quelles (booléen localisé oui/non) ;
 * objet imbriqué rendu en paires « clé : valeur » jointes par « · »
 * au premier niveau, puis entre parenthèses jointes par «, » aux
 * niveaux suivants (récursion bornée : au-delà, repli JSON compact) ;
 * tableau joint par «, », chaque élément formaté — un élément
 * « tarif » (grille + plan + prix_mensuel, la forme journalisée par
 * mettreAJourTarifs) se lit « afrique/starter : 1.99 » (+ devise si
 * elle est présente). « [object Object] » ne peut plus apparaître :
 * aucune valeur n'est convertie par String() à l'aveugle.
 */
const DETAILS_PROFONDEUR_MAX = 3;
const DETAILS_MAX_ELEMENTS = 20;

function jsonCompactAudit(valeur: unknown): string {
  try {
    return JSON.stringify(valeur) ?? "—";
  } catch {
    return "—";
  }
}

function formatValeurAudit(valeur: unknown, locale: string, profondeur: number): string {
  if (valeur === null || valeur === undefined) return "—";
  if (typeof valeur === "string") return valeur;
  if (typeof valeur === "number" || typeof valeur === "bigint") return String(valeur);
  if (typeof valeur === "boolean") {
    return locale === "en" ? (valeur ? "yes" : "no") : valeur ? "oui" : "non";
  }
  if (Array.isArray(valeur)) {
    if (valeur.length === 0) return "—";
    const morceaux = valeur
      .slice(0, DETAILS_MAX_ELEMENTS)
      .map((element) => formatValeurAudit(element, locale, profondeur + 1));
    if (valeur.length > DETAILS_MAX_ELEMENTS) {
      morceaux.push(`… +${valeur.length - DETAILS_MAX_ELEMENTS}`);
    }
    return morceaux.join(", ");
  }
  if (typeof valeur === "object") {
    const objet = valeur as Record<string, unknown>;
    // Forme « tarif » journalisée (mettreAJourTarifs) : lecture directe.
    if (
      typeof objet.grille === "string" &&
      typeof objet.plan === "string" &&
      typeof objet.prix_mensuel === "number"
    ) {
      const devise = typeof objet.devise === "string" ? ` ${objet.devise}` : "";
      return `${objet.grille}/${objet.plan} : ${objet.prix_mensuel}${devise}`;
    }
    const entrees = Object.entries(objet);
    if (entrees.length === 0) return "—";
    if (profondeur >= DETAILS_PROFONDEUR_MAX) return jsonCompactAudit(valeur);
    const paires = entrees.map(
      ([cle, v]) => `${cle} : ${formatValeurAudit(v, locale, profondeur + 1)}`
    );
    return profondeur === 0 ? paires.join(" · ") : `(${paires.join(", ")})`;
  }
  return jsonCompactAudit(valeur);
}

/**
 * Texte lisible des détails d'audit ; chaîne vide si aucun détail
 * (l'écran affiche alors son propre tiret). Sert à l'affichage ET au
 * texte de recherche du filtre intelligent du journal : on cherche
 * dans ce que l'Admin lit, pas dans le JSON brut.
 */
export function formatDetailsAudit(
  details: Record<string, unknown> | null | undefined,
  locale: string = "fr"
): string {
  if (!details || typeof details !== "object" || Object.keys(details).length === 0) {
    return "";
  }
  return formatValeurAudit(details, locale, 0);
}

/** Périodes du filtre intelligent du journal d'audit (page console). */
export type PeriodeJournal = "tout" | "aujourdhui" | "7j" | "30j";

/**
 * Une entrée datée `dateIso` tombe-t-elle dans la période demandée ?
 * « aujourdhui » = même jour calendaire local que `maintenant` ;
 * « 7j » / « 30j » = fenêtre glissante de 7 / 30 jours avant
 * `maintenant`. Fonction pure (le filtre du journal est côté client).
 */
export function periodeJournalContient(
  dateIso: string,
  periode: PeriodeJournal,
  maintenant: Date
): boolean {
  if (periode === "tout") return true;
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return false;
  if (periode === "aujourdhui") {
    return (
      d.getFullYear() === maintenant.getFullYear() &&
      d.getMonth() === maintenant.getMonth() &&
      d.getDate() === maintenant.getDate()
    );
  }
  const jours = periode === "7j" ? 7 : 30;
  const ecart = maintenant.getTime() - d.getTime();
  return ecart >= 0 && ecart <= jours * 24 * 3600 * 1000;
}

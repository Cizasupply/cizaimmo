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
    // Forme « dépense plateforme » journalisée (saisie / validation /
    // refus d'une dépense) : le libellé et le MONTANT FORMATÉ d'abord
    // (correctif 2026-11-08 : le montant brut « 400000 » ne doit plus
    // apparaître), le reste (catégorie, motif…) en paires ensuite.
    if (
      typeof objet.libelle === "string" &&
      typeof objet.montant === "number" &&
      typeof objet.devise === "string"
    ) {
      const tete = `${objet.libelle} — ${formatMoney(objet.montant, objet.devise, locale)}`;
      const reste = Object.entries(objet).filter(
        ([cle]) => cle !== "libelle" && cle !== "montant" && cle !== "devise"
      );
      if (reste.length === 0 || profondeur >= DETAILS_PROFONDEUR_MAX) {
        return tete;
      }
      const paires = reste.map(
        ([cle, v]) => `${cle} : ${formatValeurAudit(v, locale, profondeur + 1)}`
      );
      return profondeur === 0
        ? [tete, ...paires].join(" · ")
        : `${tete} (${paires.join(", ")})`;
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

/**
 * Inventaire des actions RÉELLEMENT journalisées dans le journal
 * d'audit (fournisseurs réel + démo + fonctions SQL des modules
 * v1.5/v1.6, finances et pack employé) — correctif 2026-11-08
 * (captures du fondateur) : 16 actions n'avaient AUCUN libellé i18n
 * (assignation, contrat_employe_valide, charte_acceptee, suppressions
 * demandée/annulée/exécutée, vitrine…) et l'interface affichait la
 * CLÉ BRUTE (« console.audit.assignation »). Chaque action d'ici a
 * son libellé FR + EN sous console.audit.* ; une action ABSENTE de
 * cette liste est rendue par le libellé générique
 * console.audit.actionInconnue — jamais la clé brute. Le test
 * scripts/test-correctifs-captures.cjs reverrouille l'inventaire
 * contre le code des fournisseurs et le SQL.
 */
export const ACTIONS_AUDIT: readonly string[] = [
  "acces_admin_modifie",
  "admin_cree",
  "admin_promu",
  "admin_reactive",
  "admin_retire",
  "admin_suspendu",
  "assignation",
  "avis_envoye",
  "charte_acceptee",
  "compte_approuve",
  "compte_reactive",
  "compte_refuse",
  "compte_supprime_definitivement",
  "compte_suspendu",
  "consultation_messages",
  "contrat_employe_prepare",
  "contrat_employe_refuse",
  "contrat_employe_signe_depose",
  "contrat_employe_valide",
  "contrat_proprietaire_refuse",
  "contrat_proprietaire_valide",
  "contrat_valide",
  "depense_plateforme_refusee",
  "depense_plateforme_saisie",
  "depense_plateforme_validee",
  "grille_reattribuee",
  "immeuble_gestion_refuse",
  "immeuble_gestion_valide",
  "paie_emise",
  "parametres_modifies",
  "rattachement_cree",
  "rattachement_refuse",
  "rattachement_retire",
  "rattachement_valide",
  "role_admin_retire",
  "supervision_ouverte",
  "suppression_annulee",
  "suppression_demandee",
  "suppression_executee",
  "tarifs_modifies",
  "vitrine_approuvee",
  "vitrine_publication_demandee",
  "vitrine_publication_retiree",
  "vitrine_refusee",
];

/** L'action a-t-elle un libellé humain (console.audit.<action>) ? */
export function actionAuditConnue(action: string): boolean {
  return ACTIONS_AUDIT.includes(action);
}

/**
 * Cible LISIBILE d'une entrée d'audit — JAMAIS l'identifiant technique
 * (correctif 2026-11-08 : les entrées « dépense plateforme »
 * affichaient l'UUID brut de la dépense). Priorité : l'e-mail de la
 * cible ; sinon, pour une dépense, son libellé journalisé (et le
 * montant formaté s'il est présent) ; sinon un tiret propre.
 */
export function formatCibleAudit(
  entree: {
    cible_email?: string | null;
    cible_id?: string | null;
    details?: Record<string, unknown> | null;
  },
  locale: string = "fr"
): string {
  if (entree.cible_email) return entree.cible_email;
  const details = entree.details;
  if (details && typeof details === "object") {
    const libelle =
      typeof details.libelle === "string" ? details.libelle : null;
    if (libelle) {
      if (
        typeof details.montant === "number" &&
        typeof details.devise === "string"
      ) {
        return `${libelle} — ${formatMoney(details.montant, details.devise, locale)}`;
      }
      return libelle;
    }
  }
  return "—";
}

/**
 * Référence libre d'une paie employé, prête à afficher : une
 * référence PUREMENT NUMÉRIQUE (cas réel du fondateur : « 400000 »
 * saisi comme référence) est groupée par milliers comme partout
 * dans l'app (« 400 000 ») ; toute autre référence (numéro de
 * virement alphanumérique, zéro initial…) passe inchangée.
 */
export function formatReferencePaie(
  reference: string | null | undefined,
  locale: string = "fr"
): string {
  if (!reference) return "";
  const texte = reference.trim();
  if (/^[1-9]\d{3,14}$/.test(texte)) {
    try {
      return new Intl.NumberFormat(locale === "en" ? "en-US" : "fr-FR", {
        maximumFractionDigits: 0,
      }).format(Number(texte));
    } catch {
      return reference;
    }
  }
  return reference;
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

/** Pagination de la page Journal (point 9, 2026-11-08) : 20 entrées par page. */
export const TAILLE_PAGE_JOURNAL = 20;

/**
 * Découpe PURE d'une liste déjà filtrée en pages (la page Journal
 * compose : filtres existants → vue principale/archivées → cette
 * découpe). La page demandée est ramenée dans les bornes [1,
 * totalPages] — une liste vide donne 1 page vide. Testée unitairement
 * (bornes + composition avec un filtre).
 */
export function paginerListe<T>(
  elements: readonly T[],
  pageDemandee: number,
  taille: number = TAILLE_PAGE_JOURNAL
): { page: number; totalPages: number; elements: T[] } {
  const parPage = Math.max(1, Math.floor(taille) || TAILLE_PAGE_JOURNAL);
  const totalPages = Math.max(1, Math.ceil(elements.length / parPage));
  const demandee = Math.floor(pageDemandee);
  const page = Math.min(
    Math.max(1, Number.isNaN(demandee) ? 1 : demandee),
    totalPages
  );
  return {
    page,
    totalPages,
    elements: elements.slice((page - 1) * parPage, page * parPage),
  };
}

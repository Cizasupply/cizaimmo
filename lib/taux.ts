/**
 * CizaImmo — taux de change automatiques (Module 6, spec §9).
 *
 * Source : API publique gratuite SANS clé (open.er-api.com, successeur
 * d'exchangerate-api.com) — l'URL est surchargeable via TAUX_API_URL
 * (variable d'environnement, jamais en clair). Aucun secret n'est
 * nécessaire ; si un jour une clé devenait requise, elle passerait par
 * une variable d'environnement.
 *
 * Règles verrouillées :
 * - actualisation paresseuse : on ne refait l'appel que si les taux
 *   automatiques stockés datent de plus de ~24 h (FRAICHEUR_TAUX_HEURES) ;
 * - chaque taux gardé porte sa date et sa source « auto » — un taux
 *   daté n'est jamais présenté comme un « taux du jour » ni comme un
 *   taux en direct ;
 * - le taux manuel de secours (module 4) prime quand il est renseigné :
 *   trouverTaux() choisit le plus récent par paire, et un manuel récent
 *   l'emporte sur un auto plus ancien ;
 * - aucun taux n'est jamais inventé : sans taux stocké, la conversion
 *   affiche « taux indisponible ».
 */

import type { Devise, TauxChange } from "./data/types";
import { DEVISES } from "./data/types";

/** Fraîcheur exigée pour les taux automatiques : ~24 h (spec §9). */
export const FRAICHEUR_TAUX_HEURES = 24;

/** API publique gratuite sans clé (base USD par défaut). */
export const TAUX_API_URL_DEFAUT = "https://open.er-api.com/v6/latest/USD";

/** URL effective du service de taux (surcharge par TAUX_API_URL). */
export function urlServiceTaux(): string {
  const url = process.env.TAUX_API_URL;
  return url && url.trim() ? url.trim() : TAUX_API_URL_DEFAUT;
}

export interface TauxExternes {
  /** Date du taux (AAAA-MM-JJ), telle que publiée par la source. */
  date_taux: string;
  /** Taux 1 USD = X devise, pour chaque devise connue. */
  parDevise: Partial<Record<Devise, number>>;
}

/**
 * Récupère les taux auprès du service externe gratuit.
 * Lève une Error en cas d'échec réseau, de réponse invalide ou de
 * taux manquants — l'appelant signale l'échec sans inventer de taux.
 * `recuperer` est injectable pour les tests (fetch par défaut).
 */
export async function recupererTauxExternes(
  recuperer: typeof fetch = fetch
): Promise<TauxExternes> {
  const reponse = await recuperer(urlServiceTaux());
  if (!reponse.ok) {
    throw new Error(`TAUX_HTTP_${reponse.status}`);
  }
  const corps = (await reponse.json()) as {
    result?: string;
    base_code?: string;
    rates?: Record<string, number>;
    time_last_update_utc?: string;
  };
  if (corps.result && corps.result !== "success") {
    throw new Error("TAUX_RESULTAT_INVALIDE");
  }
  if (!corps.rates || typeof corps.rates !== "object") {
    throw new Error("TAUX_REPONSE_INVALIDE");
  }
  const parDevise: Partial<Record<Devise, number>> = {};
  for (const devise of DEVISES) {
    if (devise === "USD") {
      parDevise.USD = 1;
      continue;
    }
    const taux = corps.rates[devise];
    if (typeof taux === "number" && taux > 0) parDevise[devise] = taux;
  }
  // Date du taux : celle publiée par la source, sinon aujourd'hui (UTC).
  let dateTaux = new Date().toISOString().slice(0, 10);
  if (corps.time_last_update_utc) {
    const d = new Date(corps.time_last_update_utc);
    if (!Number.isNaN(d.getTime())) dateTaux = d.toISOString().slice(0, 10);
  }
  return { date_taux: dateTaux, parDevise };
}

/**
 * Construit les lignes de taux à enregistrer (source « auto ») à partir
 * des taux externes : pour chaque devise, la paire USD → devise et la
 * paire inverse devise → USD (le pivot USD de trouverTaux s'en sert).
 */
export function construireTauxAuto(
  externes: TauxExternes
): Omit<TauxChange, "id" | "created_at">[] {
  const lignes: Omit<TauxChange, "id" | "created_at">[] = [];
  for (const devise of DEVISES) {
    if (devise === "USD") continue;
    const tauxUsdVersDevise = externes.parDevise[devise];
    if (!tauxUsdVersDevise || tauxUsdVersDevise <= 0) continue;
    lignes.push({
      devise_source: "USD",
      devise_cible: devise,
      taux: tauxUsdVersDevise,
      date_taux: externes.date_taux,
      source: "auto",
    });
    lignes.push({
      devise_source: devise,
      devise_cible: "USD",
      taux: 1 / tauxUsdVersDevise,
      date_taux: externes.date_taux,
      source: "auto",
    });
  }
  return lignes;
}

/**
 * Faut-il actualiser les taux ? Oui quand aucun taux « auto » n'est
 * frais (plus de ~24 h, ou aucun taux auto du tout). Un taux manuel
 * récent ne dispense pas l'actualisation auto : il prime seulement
 * quand il est renseigné (voir trouverTaux).
 */
export function doitActualiserTaux(
  taux: TauxChange[],
  maintenant: Date = new Date()
): boolean {
  const limite = maintenant.getTime() - FRAICHEUR_TAUX_HEURES * 60 * 60 * 1000;
  return !taux.some((t) => {
    if (t.source !== "auto") return false;
    const dateTaux = new Date(`${t.date_taux.slice(0, 10)}T00:00:00`).getTime();
    return dateTaux >= limite;
  });
}

/** Dernier taux automatique stocké (le plus récent), ou null. */
export function dernierTauxAuto(taux: TauxChange[]): TauxChange | null {
  const autos = taux
    .filter((t) => t.source === "auto")
    .sort((a, b) => b.date_taux.localeCompare(a.date_taux));
  return autos[0] ?? null;
}

// ---------------------------------------------------------------------------
// Convertisseur PUBLIC (mini-grille tarifaire de l'accueil, sans compte).
//
// Un visiteur anonyme n'a accès à AUCUN taux stocké (table taux_change
// protégée par RLS) : la mini-grille appelle donc la route publique
// /api/taux/publics, qui interroge deux services gratuits sans clé :
// - Frankfurter (api.frankfurter.dev, taux de référence BCE) — couvre
//   EUR, GBP, CAD, BRL… mais AUCUNE monnaie africaine de notre liste ;
// - ER-API (open.er-api.com, même source que l'actualisation stockée)
//   — couvre les 12 devises, dont BIF, XAF, XOF, KES, TZS, RWF, UGX.
// Fusion : Frankfurter prime (valeur ET date) quand il couvre la
// devise ; sinon repli ER-API (valeur + date convertie en AAAA-MM-JJ
// UTC). Chaque ligne garde la date de SA source — jamais de taux ni de
// date inventés : une devise absente des deux sources n'a pas de ligne.
// ---------------------------------------------------------------------------

/** URL Frankfurter par défaut (base USD, sans clé). */
export const TAUX_FRANKFURTER_URL_DEFAUT =
  "https://api.frankfurter.dev/v1/latest?base=USD";

/** URL effective de Frankfurter (surcharge par TAUX_FRANKFURTER_URL). */
export function urlFrankfurter(): string {
  const url = process.env.TAUX_FRANKFURTER_URL;
  return url && url.trim() ? url.trim() : TAUX_FRANKFURTER_URL_DEFAUT;
}

/** Réponse Frankfurter réduite aux champs utilisés par la fusion. */
export interface TauxFrankfurterBruts {
  /** Date des taux publiés (AAAA-MM-JJ). */
  date: string;
  rates: Record<string, number>;
}

/** Réponse ER-API réduite aux champs utilisés par la fusion. */
export interface TauxErApiBruts {
  time_last_update_utc?: string;
  rates: Record<string, number>;
}

function dateAAAMMJJValide(valeur: unknown): valeur is string {
  return typeof valeur === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valeur);
}

/** Convertit un horodatage source (ex. time_last_update_utc) en AAAA-MM-JJ UTC. */
function versDateUTC(horodatage: unknown): string | null {
  if (typeof horodatage !== "string" || !horodatage.trim()) return null;
  const d = new Date(horodatage);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function tauxPositif(rates: Record<string, number> | undefined, devise: Devise): number | null {
  const taux = rates?.[devise];
  return typeof taux === "number" && taux > 0 ? taux : null;
}

/**
 * Fusionne les taux Frankfurter et ER-API en lignes TauxChange
 * (USD → devise, source « auto », sans id ni created_at).
 * Fonction PURE : aucune ligne n'est produite pour une devise absente
 * des deux sources, et chaque ligne porte la date de sa propre source.
 */
export function fusionnerTauxConvertisseur(
  frank: TauxFrankfurterBruts | null,
  er: TauxErApiBruts | null
): Omit<TauxChange, "id" | "created_at">[] {
  const dateFrank = frank && dateAAAMMJJValide(frank.date) ? frank.date : null;
  const dateEr = er ? versDateUTC(er.time_last_update_utc) : null;
  const lignes: Omit<TauxChange, "id" | "created_at">[] = [];
  for (const devise of DEVISES) {
    if (devise === "USD") continue;
    const tauxFrank = dateFrank ? tauxPositif(frank?.rates, devise) : null;
    if (tauxFrank !== null && dateFrank) {
      lignes.push({
        devise_source: "USD",
        devise_cible: devise,
        taux: tauxFrank,
        date_taux: dateFrank,
        source: "auto",
      });
      continue;
    }
    const tauxEr = dateEr ? tauxPositif(er?.rates, devise) : null;
    if (tauxEr !== null && dateEr) {
      lignes.push({
        devise_source: "USD",
        devise_cible: devise,
        taux: tauxEr,
        date_taux: dateEr,
        source: "auto",
      });
    }
  }
  return lignes;
}

/**
 * Options des fetchs du convertisseur : cache de données Next d'1 h
 * (revalidate). L'option `next` est propre au fetch patché de Next —
 * double assertion pour rester compilable hors types Next (harnais de
 * test en tsc nu).
 */
const OPTIONS_FETCH_TAUX_PUBLICS = {
  next: { revalidate: 3600 },
} as unknown as RequestInit;

/** Récupère la réponse Frankfurter brute ; lève en cas d'échec. */
async function recupererFrankfurterBruts(
  recuperer: typeof fetch
): Promise<TauxFrankfurterBruts> {
  const reponse = await recuperer(urlFrankfurter(), OPTIONS_FETCH_TAUX_PUBLICS);
  if (!reponse.ok) {
    throw new Error(`FRANKFURTER_HTTP_${reponse.status}`);
  }
  const corps = (await reponse.json()) as {
    date?: string;
    rates?: Record<string, number>;
  };
  if (!corps.rates || typeof corps.rates !== "object" || !dateAAAMMJJValide(corps.date)) {
    throw new Error("FRANKFURTER_REPONSE_INVALIDE");
  }
  return { date: corps.date, rates: corps.rates };
}

/**
 * Récupère la réponse ER-API brute (même service que
 * recupererTauxExternes, via urlServiceTaux) ; lève en cas d'échec.
 */
async function recupererErApiBruts(
  recuperer: typeof fetch
): Promise<TauxErApiBruts> {
  const reponse = await recuperer(urlServiceTaux(), OPTIONS_FETCH_TAUX_PUBLICS);
  if (!reponse.ok) {
    throw new Error(`TAUX_HTTP_${reponse.status}`);
  }
  const corps = (await reponse.json()) as {
    result?: string;
    rates?: Record<string, number>;
    time_last_update_utc?: string;
  };
  if (corps.result && corps.result !== "success") {
    throw new Error("TAUX_RESULTAT_INVALIDE");
  }
  if (!corps.rates || typeof corps.rates !== "object") {
    throw new Error("TAUX_REPONSE_INVALIDE");
  }
  return { time_last_update_utc: corps.time_last_update_utc, rates: corps.rates };
}

/**
 * Taux du convertisseur public : interroge Frankfurter ET ER-API
 * (appels mis en cache 1 h côté Next), puis fusionne. Si une source
 * échoue, l'autre est utilisée seule ; si les deux échouent (ou ne
 * produisent aucune ligne), lève une erreur — jamais de taux inventé.
 * `recuperer` est injectable pour les tests (fetch par défaut).
 */
export async function recupererTauxConvertisseur(
  recuperer: typeof fetch = fetch
): Promise<Omit<TauxChange, "id" | "created_at">[]> {
  const [frank, er] = await Promise.all([
    recupererFrankfurterBruts(recuperer).catch(() => null),
    recupererErApiBruts(recuperer).catch(() => null),
  ]);
  const lignes = fusionnerTauxConvertisseur(frank, er);
  if (lignes.length === 0) {
    throw new Error("TAUX_CONVERTISSEUR_INDISPONIBLE");
  }
  return lignes;
}

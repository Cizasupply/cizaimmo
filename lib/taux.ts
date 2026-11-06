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

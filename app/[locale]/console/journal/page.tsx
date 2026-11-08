"use client";

/**
 * Console — Journal d'audit (extension v1.2) : lecture seule. Qui a
 * fait quoi, quand, sur quel compte : connexions plateforme impossibles
 * à effacer (la table est append-only côté base).
 *
 * Correctif 2026-11-07 (demande du fondateur) :
 *  1. DÉTAILS LISIBLES — les détails jsonb passent par le formateur
 *     partagé `formatDetailsAudit` (lib/format.ts) : l'ancien rendu
 *     naïf affichait « [object Object] » pour les objets/tableaux
 *     imbriqués (« Tarifs modifiés », « Paramètres modifiés »).
 *  2. FILTRE INTELLIGENT — recherche libre (acteur, action, compte
 *     concerné ET texte lisible des détails), filtres combinables
 *     Action / Acteur / Période, compteur et réinitialisation. Tout
 *     est côté client sur les entrées déjà chargées (échelle console).
 *  3. ORGANISATION — en-tête, barre de filtres en carte, tableau
 *     bureau soigné (détails sans débordement) et cartes sur mobile,
 *     selon les patrons des autres pages de la console / de l'app.
 *
 * Verrouillage 2026-11-08 (décision du fondateur) : la LECTURE du
 * journal passe SUPER ADMIN SEULE — entrée de menu superSeul,
 * garde ERR_SUPER_ADMIN_REQUIS chez les fournisseurs, refus propre
 * ci-dessous en accès direct par un Admin (même patron que la page
 * Suppressions). L'écriture au journal (tous rôles) est inchangée.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type { EntreeAudit, Profil } from "@/lib/data";
import { formatDateTime, formatDetailsAudit, periodeJournalContient } from "@/lib/format";
import type { PeriodeJournal } from "@/lib/format";

export default function ConsoleJournalPage() {
  const t = useTranslations("console");
  const t15 = useTranslations("v15");
  const locale = useLocale();
  const [profil, setProfil] = useState<Profil | null>(null);
  const [entrees, setEntrees] = useState<EntreeAudit[]>([]);
  const [charge, setCharge] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [filtreAction, setFiltreAction] = useState("");
  const [filtreActeur, setFiltreActeur] = useState("");
  const [periode, setPeriode] = useState<PeriodeJournal>("tout");

  useEffect(() => {
    let actif = true;
    const provider = getDataProvider();
    provider
      .getProfil()
      .then((moi) => {
        if (actif) setProfil(moi);
      })
      .catch(() => undefined);
    provider
      .listerJournalAudit()
      .then((liste) => {
        if (actif) setEntrees(liste);
      })
      .catch(() => undefined)
      .finally(() => {
        if (actif) setCharge(true);
      });
    return () => {
      actif = false;
    };
  }, []);

  // Libellé humain d'une action (même rendu que la colonne Action) :
  // la recherche libre le couvre en plus du code brut.
  const libelleAction = (e: EntreeAudit) => t(`audit.${e.action}` as "audit.compte_approuve");
  const nomActeur = (e: EntreeAudit) => e.acteur_nom ?? e.acteur_email;
  const roleActeur = (e: EntreeAudit) =>
    e.acteur_role === "super_admin"
      ? t("roleSuperAdmin")
      : e.acteur_role === "admin"
        ? t("roleAdmin")
        : e.acteur_role;

  // Listes déroulantes : valeurs DISTINCTES présentes dans les
  // entrées chargées (actions par code, acteurs par e-mail).
  const actionsDistinctes = useMemo(
    () => Array.from(new Set(entrees.map((e) => e.action))).sort(),
    [entrees]
  );
  const acteursDistincts = useMemo(() => {
    const parEmail = new Map<string, string>();
    for (const e of entrees) {
      if (!parEmail.has(e.acteur_email)) parEmail.set(e.acteur_email, nomActeur(e));
    }
    return Array.from(parEmail.entries())
      .map(([email, nom]) => ({ email, nom }))
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }, [entrees]);

  const visibles = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const maintenant = new Date();
    return entrees.filter((e) => {
      if (filtreAction && e.action !== filtreAction) return false;
      if (filtreActeur && e.acteur_email !== filtreActeur) return false;
      if (!periodeJournalContient(e.created_at, periode, maintenant)) return false;
      if (!q) return true;
      // Recherche sur le texte LISIBLE (celui affiché), détails
      // formatés compris — jamais sur le JSON brut.
      const foin = [
        nomActeur(e),
        e.acteur_email,
        e.action,
        libelleAction(e),
        e.cible_email ?? "",
        e.cible_id ?? "",
        formatDetailsAudit(e.details, locale),
      ]
        .join(" ")
        .toLowerCase();
      return foin.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrees, recherche, filtreAction, filtreActeur, periode, locale]);

  const filtresActifs =
    recherche.trim() !== "" || filtreAction !== "" || filtreActeur !== "" || periode !== "tout";
  const reinitialiser = () => {
    setRecherche("");
    setFiltreAction("");
    setFiltreActeur("");
    setPeriode("tout");
  };

  const champClasse =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-gold";
  const etiquetteClasse =
    "block text-xs font-semibold uppercase tracking-wide text-slate-500";

  // Verrouillage 2026-11-08 : accès direct par un Admin → refus
  // propre (même patron que la page Suppressions).
  if (charge && profil && profil.role !== "super_admin") {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-navy md:text-3xl">{t("journalTitle")}</h1>
        <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">
          {t15("superOnly")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy md:text-3xl">{t("journalTitle")}</h1>
      <p className="mt-1 text-sm text-slate-600">{t("journalSubtitle")}</p>

      {/* Barre de filtres — carte au patron console (recherche +
          Action / Acteur / Période + réinitialiser + compteur). */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-56 flex-1">
            <span className={etiquetteClasse}>{t("journalSearchLabel")}</span>
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder={t("journalSearchPlaceholder")}
              className={champClasse}
            />
          </label>
          <label>
            <span className={etiquetteClasse}>{t("journalFilterAction")}</span>
            <select
              value={filtreAction}
              onChange={(e) => setFiltreAction(e.target.value)}
              className={champClasse}
            >
              <option value="">{t("journalFilterAllActions")}</option>
              {actionsDistinctes.map((action) => (
                <option key={action} value={action}>
                  {t(`audit.${action}` as "audit.compte_approuve")}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={etiquetteClasse}>{t("journalFilterActor")}</span>
            <select
              value={filtreActeur}
              onChange={(e) => setFiltreActeur(e.target.value)}
              className={champClasse}
            >
              <option value="">{t("journalFilterAllActors")}</option>
              {acteursDistincts.map((a) => (
                <option key={a.email} value={a.email}>
                  {a.nom}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={etiquetteClasse}>{t("journalFilterPeriod")}</span>
            <select
              value={periode}
              onChange={(e) => setPeriode(e.target.value as PeriodeJournal)}
              className={champClasse}
            >
              <option value="tout">{t("journalPeriodAll")}</option>
              <option value="aujourdhui">{t("journalPeriodToday")}</option>
              <option value="7j">{t("journalPeriod7d")}</option>
              <option value="30j">{t("journalPeriod30d")}</option>
            </select>
          </label>
          {filtresActifs ? (
            <button
              type="button"
              onClick={reinitialiser}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-navy hover:border-gold"
            >
              {t("journalReset")}
            </button>
          ) : null}
        </div>
        {charge && entrees.length > 0 ? (
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("journalResultsCount", { count: visibles.length })}
          </p>
        ) : null}
      </section>

      {/* Résultats : cartes sur mobile, tableau sur ordinateur —
          patron d'affichage de l'app connectée. */}
      <div className="mt-4">
        {!charge ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            {t("loading")}
          </p>
        ) : entrees.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            {t("noActivity")}
          </p>
        ) : visibles.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            {t("journalNoResults")}
          </p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {visibles.map((e) => (
                <article key={e.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-bold text-navy">{libelleAction(e)}</span>
                    <span className="text-xs text-slate-400">
                      {formatDateTime(e.created_at, locale)}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-sm text-slate-600">
                    {nomActeur(e)} — {roleActeur(e)}
                    <span className="block text-xs text-slate-400">{e.acteur_email}</span>
                  </p>
                  <p className="mt-1 break-words text-sm text-slate-600">
                    {e.cible_email ?? e.cible_id ?? "—"}
                  </p>
                  {formatDetailsAudit(e.details, locale) ? (
                    <p className="mt-2 break-words text-xs leading-relaxed text-slate-500">
                      {formatDetailsAudit(e.details, locale)}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white md:block">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-cream text-xs font-semibold uppercase tracking-wide text-navy">
                    <th className="px-4 py-3">{t("colDate")}</th>
                    <th className="px-4 py-3">{t("colActor")}</th>
                    <th className="px-4 py-3">{t("colAction")}</th>
                    <th className="px-4 py-3">{t("colTarget")}</th>
                    <th className="px-4 py-3">{t("colDetails")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-3 align-top text-slate-500">
                        {formatDateTime(e.created_at, locale)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {/* Audit enrichi : nom de l'acteur en principal
                            (repli e-mail pour les entrées anciennes),
                            rôle + e-mail en secondaire. */}
                        <span className="block font-semibold text-navy">{nomActeur(e)}</span>
                        <span className="text-xs text-slate-400">
                          {roleActeur(e)}
                          {e.acteur_nom ? ` · ${e.acteur_email}` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top font-semibold text-navy">
                        {libelleAction(e)}
                      </td>
                      <td className="break-words px-4 py-3 align-top text-slate-600">
                        {e.cible_email ?? e.cible_id ?? "—"}
                      </td>
                      <td className="max-w-[320px] break-words px-4 py-3 align-top text-xs leading-relaxed text-slate-500">
                        {formatDetailsAudit(e.details, locale) || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

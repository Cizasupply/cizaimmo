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
 *
 * Point 9 (2026-11-08) : ÉTAT DE LECTURE + PAGINATION — pastille
 * « Nouveau » sur les non-lues, « Tout marquer comme lu », archivage
 * par entrée et en masse des lues, vue « Archivées » avec
 * désarchivage, pagination 20/page (paginerListe, lib/format.ts)
 * composée APRÈS les filtres existants et la vue. Les marqueurs
 * vivent dans la table latérale journal_lecture (via les
 * fournisseurs) : le journal reste append-only.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type { EntreeAudit, Profil } from "@/lib/data";
import { actionAuditConnue, formatCibleAudit, formatDateTime, formatDetailsAudit, paginerListe, periodeJournalContient } from "@/lib/format";
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
  // Point 9 : vue (principale / archivées), page courante, et
  // verrou d'action pendant un appel fournisseur.
  const [vueArchivees, setVueArchivees] = useState(false);
  const [page, setPage] = useState(1);
  const [occupe, setOccupe] = useState(false);

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
  // la recherche libre le couvre en plus du code brut. Correctif
  // 2026-11-08 : une action hors inventaire (ACTIONS_AUDIT,
  // lib/format.ts) retombe sur le libellé générique — JAMAIS la clé
  // brute « console.audit.… » qu'affichait next-intl pour les actions
  // sans traduction (assignation, contrat employé validé…).
  const libelleCodeAction = (action: string) =>
    actionAuditConnue(action)
      ? t(`audit.${action}` as "audit.compte_approuve")
      : t("audit.actionInconnue" as "audit.compte_approuve");
  const libelleAction = (e: EntreeAudit) => libelleCodeAction(e.action);
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
        formatCibleAudit(e, locale),
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
    setPage(1);
  };

  // Point 9 — composition : filtres existants (visibles) → vue
  // (principale = non archivées / archivées) → pagination 20/page.
  const selonVue = useMemo(
    () => visibles.filter((e) => (vueArchivees ? e.archive : !e.archive)),
    [visibles, vueArchivees]
  );
  const pagination = useMemo(
    () => paginerListe(selonVue, page),
    [selonVue, page]
  );
  const pageAffichee = pagination.elements;
  const nbNonLues = useMemo(
    () => entrees.filter((e) => !e.lu && !e.archive).length,
    [entrees]
  );
  const nbLuesNonArchivees = useMemo(
    () => entrees.filter((e) => e.lu && !e.archive).length,
    [entrees]
  );
  const nbArchivees = useMemo(
    () => entrees.filter((e) => e.archive).length,
    [entrees]
  );

  // Actions d'état de lecture : l'état local n'est mis à jour qu'après
  // le succès fournisseur (les marqueurs vivent côté fournisseur,
  // table latérale — le journal lui-même n'est jamais modifié).
  const majEntrees = (patch: (e: EntreeAudit) => EntreeAudit) =>
    setEntrees((prev) => prev.map(patch));
  async function executerAction(fn: () => Promise<void>) {
    if (occupe) return;
    setOccupe(true);
    try {
      await fn();
    } catch {
      /* échec silencieux : l'affichage reste sur l'état confirmé */
    } finally {
      setOccupe(false);
    }
  }
  const marquerLu = (e: EntreeAudit) =>
    executerAction(async () => {
      await getDataProvider().marquerEntreesAuditLues([e.id]);
      majEntrees((x) => (x.id === e.id ? { ...x, lu: true } : x));
    });
  const toutMarquerLu = () =>
    executerAction(async () => {
      await getDataProvider().marquerEntreesAuditLues();
      majEntrees((x) => ({ ...x, lu: true }));
    });
  const archiverEntree = (e: EntreeAudit) =>
    executerAction(async () => {
      await getDataProvider().archiverEntreeAudit(e.id);
      majEntrees((x) => (x.id === e.id ? { ...x, archive: true } : x));
    });
  const desarchiverEntree = (e: EntreeAudit) =>
    executerAction(async () => {
      await getDataProvider().desarchiverEntreeAudit(e.id);
      majEntrees((x) => (x.id === e.id ? { ...x, archive: false } : x));
    });
  const archiverLues = () =>
    executerAction(async () => {
      await getDataProvider().archiverEntreesAuditLues();
      majEntrees((x) => (x.lu && !x.archive ? { ...x, archive: true } : x));
    });

  const btnEntreeClasse =
    "rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-navy hover:border-gold disabled:opacity-50";
  const badgeNouveau = (e: EntreeAudit) =>
    !e.lu ? (
      <span className="ml-2 inline-block rounded-full bg-gold px-2 py-0.5 align-middle text-[11px] font-bold uppercase tracking-wide text-navy">
        {t("journalNewBadge")}
      </span>
    ) : null;
  const boutonsEntree = (e: EntreeAudit) => (
    <span className="mt-2 flex flex-wrap gap-2">
      {!e.lu ? (
        <button type="button" disabled={occupe} onClick={() => void marquerLu(e)} className={btnEntreeClasse}>
          {t("journalMarkRead")}
        </button>
      ) : null}
      {!e.archive ? (
        <button type="button" disabled={occupe} onClick={() => void archiverEntree(e)} className={btnEntreeClasse}>
          {t("journalArchive")}
        </button>
      ) : (
        <button type="button" disabled={occupe} onClick={() => void desarchiverEntree(e)} className={btnEntreeClasse}>
          {t("journalUnarchive")}
        </button>
      )}
    </span>
  );

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
              onChange={(e) => { setRecherche(e.target.value); setPage(1); }}
              placeholder={t("journalSearchPlaceholder")}
              className={champClasse}
            />
          </label>
          <label>
            <span className={etiquetteClasse}>{t("journalFilterAction")}</span>
            <select
              value={filtreAction}
              onChange={(e) => { setFiltreAction(e.target.value); setPage(1); }}
              className={champClasse}
            >
              <option value="">{t("journalFilterAllActions")}</option>
              {actionsDistinctes.map((action) => (
                <option key={action} value={action}>
                  {libelleCodeAction(action)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={etiquetteClasse}>{t("journalFilterActor")}</span>
            <select
              value={filtreActeur}
              onChange={(e) => { setFiltreActeur(e.target.value); setPage(1); }}
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
              onChange={(e) => { setPeriode(e.target.value as PeriodeJournal); setPage(1); }}
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
            {t("journalResultsCount", { count: selonVue.length })}
          </p>
        ) : null}
      </section>

      {/* Point 9 : vues (principale / archivées) + actions de masse
          sur l'état de lecture. */}
      {charge && entrees.length > 0 ? (
        <section className="mt-4 flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-300 bg-white p-1">
            <button
              type="button"
              onClick={() => { setVueArchivees(false); setPage(1); }}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${!vueArchivees ? "bg-navy text-white" : "text-navy"}`}
            >
              {t("journalTabMain")}
            </button>
            <button
              type="button"
              onClick={() => { setVueArchivees(true); setPage(1); }}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${vueArchivees ? "bg-navy text-white" : "text-navy"}`}
            >
              {t("journalTabArchived")} ({nbArchivees})
            </button>
          </div>
          {!vueArchivees ? (
            <>
              <button
                type="button"
                disabled={occupe || nbNonLues === 0}
                onClick={() => void toutMarquerLu()}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-navy hover:border-gold disabled:opacity-50"
              >
                {t("journalMarkAllRead")}
              </button>
              <button
                type="button"
                disabled={occupe || nbLuesNonArchivees === 0}
                onClick={() => void archiverLues()}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-navy hover:border-gold disabled:opacity-50"
              >
                {t("journalArchiveRead")}
              </button>
            </>
          ) : null}
        </section>
      ) : null}

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
        ) : selonVue.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            {t("journalNoResults")}
          </p>
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {pageAffichee.map((e) => (
                <article key={e.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-bold text-navy">
                      {libelleAction(e)}
                      {badgeNouveau(e)}
                    </span>
                    <span className="text-xs text-slate-400">
                      {formatDateTime(e.created_at, locale)}
                    </span>
                  </div>
                  <p className="mt-1 break-words text-sm text-slate-600">
                    {nomActeur(e)} — {roleActeur(e)}
                    <span className="block text-xs text-slate-400">{e.acteur_email}</span>
                  </p>
                  <p className="mt-1 break-words text-sm text-slate-600">
                    {formatCibleAudit(e, locale)}
                  </p>
                  {formatDetailsAudit(e.details, locale) ? (
                    <p className="mt-2 break-words text-xs leading-relaxed text-slate-500">
                      {formatDetailsAudit(e.details, locale)}
                    </p>
                  ) : null}
                  {boutonsEntree(e)}
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
                  {pageAffichee.map((e) => (
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
                        {badgeNouveau(e)}
                        {boutonsEntree(e)}
                      </td>
                      <td className="break-words px-4 py-3 align-top text-slate-600">
                        {formatCibleAudit(e, locale)}
                      </td>
                      <td className="max-w-[320px] break-words px-4 py-3 align-top text-xs leading-relaxed text-slate-500">
                        {formatDetailsAudit(e.details, locale) || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Point 9 : pagination 20/page, composée avec les
                filtres et la vue courante. */}
            {pagination.totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage(pagination.page - 1)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-navy hover:border-gold disabled:opacity-50"
                >
                  {t("journalPrev")}
                </button>
                <span className="text-sm font-semibold text-slate-600">
                  {t("journalPageLabel", { page: pagination.page, total: pagination.totalPages })}
                </span>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPage(pagination.page + 1)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-navy hover:border-gold disabled:opacity-50"
                >
                  {t("journalNext")}
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

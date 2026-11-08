"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import Pagination from "@/components/Pagination";
import { formatMoney, formatPct } from "@/lib/format";
import { statsImmeuble } from "@/lib/parc";
import { getDataProvider, limiteBlocs } from "@/lib/data";
import type {
  Abonnement,
  Appartement,
  Bail,
  Depense,
  EcheanceLoyer,
  Immeuble,
  Paiement,
} from "@/lib/data";
import { messageErreur } from "@/lib/translateError";

type Tri = "nom" | "ville" | "loyer" | "nouveau";

/** Couleur du taux d'occupation : vert ≥ 80 %, ambre 50–79 %, rouge < 50 %. */
function couleurOccupation(occupation: number | null | undefined): string {
  if (occupation === null || occupation === undefined) return "text-slate-500";
  if (occupation >= 0.8) return "text-green-700";
  if (occupation >= 0.5) return "text-amber-700";
  return "text-red-700";
}

/** ROI : vert si ≥ 0, rouge si négatif. */
function couleurRoi(roi: number | null | undefined): string {
  if (roi === null || roi === undefined) return "text-navy";
  return roi >= 0 ? "text-green-700" : "text-red-700";
}

export default function ImmeublesPage() {
  const t = useTranslations("crud");
  const tp = useTranslations("pages");
  const tn = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();

  const [immeubles, setImmeubles] = useState<Immeuble[]>([]);
  const [appartements, setAppartements] = useState<Appartement[]>([]);
  const [baux, setBaux] = useState<Bail[]>([]);
  const [echeances, setEcheances] = useState<EcheanceLoyer[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [abonnement, setAbonnement] = useState<Abonnement | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [recherche, setRecherche] = useState("");
  const [ville, setVille] = useState("");
  const [tri, setTri] = useState<Tri>("nom");
  const [afficherArchives, setAfficherArchives] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [aArchiver, setAArchiver] = useState<Immeuble | null>(null);
  const [aRestaurer, setARestaurer] = useState<Immeuble | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const p = getDataProvider();
      const session = await p.getSession();
      if (!session) {
        router.push(`/${locale}/connexion`);
        return;
      }
      const [ims, apts, bx, ech, pay, dep, abo] = await Promise.all([
        p.listerImmeubles(true),
        p.listerAppartements({ inclureArchives: true }),
        p.listerBaux(),
        p.listerEcheances(),
        p.listerPaiements(),
        p.listerDepenses(),
        p.getAbonnement(),
      ]);
      setImmeubles(ims);
      setAppartements(apts);
      setBaux(bx);
      setEcheances(ech);
      setPaiements(pay);
      setDepenses(dep);
      setAbonnement(abo);
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const villes = useMemo(
    () => Array.from(new Set(immeubles.map((i) => i.ville))).sort(),
    [immeubles]
  );

  const statsParImmeuble = useMemo(() => {
    const m = new Map<string, ReturnType<typeof statsImmeuble>>();
    for (const im of immeubles) {
      m.set(im.id, statsImmeuble(im, appartements, baux, echeances, paiements, depenses));
    }
    return m;
  }, [immeubles, appartements, baux, echeances, paiements, depenses]);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    let liste = immeubles.filter((im) => (afficherArchives ? true : im.statut === "actif"));
    if (ville) liste = liste.filter((im) => im.ville === ville);
    if (q) {
      liste = liste.filter((im) =>
        [im.nom, im.adresse, im.ville, im.pays].some((v) => v.toLowerCase().includes(q))
      );
    }
    const copie = [...liste];
    if (tri === "nom") copie.sort((a, b) => a.nom.localeCompare(b.nom));
    if (tri === "ville") copie.sort((a, b) => a.ville.localeCompare(b.ville) || a.nom.localeCompare(b.nom));
    if (tri === "loyer") {
      copie.sort(
        (a, b) =>
          (statsParImmeuble.get(b.id)?.loyersMois ?? 0) - (statsParImmeuble.get(a.id)?.loyersMois ?? 0)
      );
    }
    if (tri === "nouveau") copie.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return copie;
  }, [immeubles, recherche, ville, tri, afficherArchives, statsParImmeuble]);

  const totalPages = Math.max(1, Math.ceil(filtres.length / pageSize));
  const pageCourante = Math.min(page, totalPages);
  const visibles = filtres.slice((pageCourante - 1) * pageSize, pageCourante * pageSize);

  const nbActifs = immeubles.filter((i) => i.statut === "actif").length;
  const limite = abonnement ? limiteBlocs(abonnement.plan, abonnement.statut) : null;
  const limiteAtteinte = limite !== null && Number.isFinite(limite) && nbActifs >= limite;

  async function archiver(im: Immeuble) {
    try {
      await getDataProvider().archiverImmeuble(im.id);
      setAArchiver(null);
      setMessage(t("common.archivedDone"));
      charger();
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    }
  }

  async function restaurer(im: Immeuble) {
    try {
      await getDataProvider().desarchiverImmeuble(im.id);
      setARestaurer(null);
      setMessage(t("common.restoredDone"));
      charger();
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    }
  }

  return (
    <AppShell title={tp("buildings.title")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/${locale}/immeubles/nouveau`}
          className="rounded-full bg-gold px-5 py-2.5 text-base font-bold text-navy hover:bg-gold-light"
        >
          {t("buildings.add")}
        </Link>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={afficherArchives}
            onChange={(e) => {
              setAfficherArchives(e.target.checked);
              setPage(1);
            }}
            className="h-5 w-5 accent-[#1B2A4A]"
          />
          {t("common.showArchived")}
        </label>
      </div>

      {limiteAtteinte && abonnement ? (
        <p role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {t("buildings.limitText", {
            plan: abonnement.plan,
            limit: String(limite),
            used: String(nbActifs),
          })}{" "}
          <Link href={`/${locale}/abonnement`} className="font-bold underline">
            {tn("subscription")}
          </Link>
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {message}
        </p>
      ) : null}

      {chargement ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>
      ) : erreur ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p role="alert" className="text-red-700">{erreur}</p>
          <button type="button" onClick={charger} className="mt-4 rounded-full border border-navy bg-white px-5 py-2 text-sm font-semibold text-navy hover:bg-navy/5">
            {t("common.retry")}
          </button>
        </div>
      ) : immeubles.length === 0 ? (
        <EmptyState
          title={t("buildings.emptyTitle")}
          text={t("buildings.emptyText")}
          actionLabel={t("buildings.addFirst")}
          actionHref={`/${locale}/immeubles/nouveau`}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
            <input
              type="search"
              value={recherche}
              onChange={(e) => {
                setRecherche(e.target.value);
                setPage(1);
              }}
              placeholder={t("buildings.searchPlaceholder")}
              aria-label={t("common.search")}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-gold"
            />
            <select
              value={ville}
              onChange={(e) => {
                setVille(e.target.value);
                setPage(1);
              }}
              aria-label={t("buildings.filterCity")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"
            >
              <option value="">{t("common.all")} — {t("buildings.filterCity")}</option>
              {villes.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              {t("common.sortLabel")}
              <select
                value={tri}
                onChange={(e) => setTri(e.target.value as Tri)}
                className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"
              >
                <option value="nom">{t("common.sortName")}</option>
                <option value="ville">{t("common.sortCity")}</option>
                <option value="loyer">{t("common.sortRent")}</option>
                <option value="nouveau">{t("common.sortNewest")}</option>
              </select>
            </label>
          </div>

          {visibles.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">{t("common.noResults")}</p>
          ) : (
            <>
              {/* Cartes — téléphone */}
              <div className="space-y-3 md:hidden">
                {visibles.map((im) => {
                  const s = statsParImmeuble.get(im.id);
                  return (
                    <article key={im.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        {/* v1.7 : vignette — la photo du passeport du bien. */}
                        {(im.photos_urls[0] || im.photo_url) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={im.photos_urls[0] || im.photo_url || ""} alt="" className="h-16 w-20 shrink-0 rounded-lg object-cover" />
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <Link href={`/${locale}/immeubles/${im.id}`} className="break-words text-lg font-bold text-navy underline">
                            {im.nom}
                          </Link>
                          <p className="break-words text-sm text-slate-600">{im.adresse}, {im.ville}</p>
                        </div>
                        {im.statut === "archive" ? (
                          <span className="shrink-0 rounded-full bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700">
                            {t("common.archived")}
                          </span>
                        ) : null}
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div className="min-w-0"><dt className="text-slate-500">{t("buildings.statsApartments")}</dt><dd className="font-bold text-navy">{s?.nbAppartements ?? 0} (<span className="font-bold text-green-700">{s?.nbOccupes ?? 0}</span> {t("buildings.statsOccupied").toLowerCase()})</dd></div>
                        <div className="min-w-0"><dt className="text-slate-500">{t("buildings.statsOccupancy")}</dt><dd className={`font-bold ${couleurOccupation(s?.occupation)}`}>{s?.occupation !== null && s?.occupation !== undefined ? formatPct(s.occupation, locale) : "—"}</dd></div>
                        <div className="min-w-0"><dt className="text-slate-500">{t("buildings.statsMonthlyRent")}</dt><dd className="whitespace-nowrap font-bold text-navy">{formatMoney(s?.loyersMois ?? 0, im.devise, locale)}</dd></div>
                        <div className="min-w-0"><dt className="text-slate-500">{t("buildings.statsRoi")}</dt><dd className={`font-bold ${couleurRoi(s?.roi)}`}>{s?.roi !== null && s?.roi !== undefined ? formatPct(s.roi, locale) : t("buildings.roiMissing")}</dd></div>
                      </dl>
                      <div className="mt-3 flex gap-2">
                        <Link href={`/${locale}/immeubles/${im.id}/modifier`} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy">
                          {t("common.edit")}
                        </Link>
                        {im.statut === "actif" ? (
                          <button type="button" onClick={() => setAArchiver(im)} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy">
                            {t("common.archive")}
                          </button>
                        ) : (
                          <button type="button" onClick={() => setARestaurer(im)} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy">
                            {t("common.restore")}
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Tableau — ordinateur */}
              <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-cream font-semibold text-navy">
                      <th className="px-4 py-3">{t("buildings.fields.name")}</th>
                      <th className="px-4 py-3">{t("buildings.fields.city")}</th>
                      <th className="px-4 py-3">{t("buildings.statsApartments")}</th>
                      <th className="px-4 py-3">{t("buildings.statsOccupancy")}</th>
                      <th className="px-4 py-3">{t("buildings.statsMonthlyRent")}</th>
                      <th className="px-4 py-3">{t("buildings.statsValue")}</th>
                      <th className="px-4 py-3">{t("buildings.statsRoi")}</th>
                      <th className="px-4 py-3">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((im) => {
                      const s = statsParImmeuble.get(im.id);
                      return (
                        <tr key={im.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {/* v1.7 : vignette — la photo du passeport du bien. */}
                              {(im.photos_urls[0] || im.photo_url) ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={im.photos_urls[0] || im.photo_url || ""} alt="" className="h-11 w-14 shrink-0 rounded-md object-cover" />
                              ) : null}
                              <div className="min-w-0">
                                <Link href={`/${locale}/immeubles/${im.id}`} className="font-bold text-navy underline">
                                  {im.nom}
                                </Link>
                                <p className="text-xs text-slate-500">{im.adresse}</p>
                                {im.statut === "archive" ? (
                                  <span className="mt-1 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">
                                    {t("common.archived")}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">{im.ville}, {im.pays}</td>
                          <td className="px-4 py-3">{s?.nbAppartements ?? 0} (<span className="font-bold text-green-700">{s?.nbOccupes ?? 0}</span> {t("buildings.statsOccupied").toLowerCase()})</td>
                          <td className={`px-4 py-3 font-bold ${couleurOccupation(s?.occupation)}`}>{s?.occupation !== null && s?.occupation !== undefined ? formatPct(s.occupation, locale) : "—"}</td>
                          <td className="px-4 py-3">{formatMoney(s?.loyersMois ?? 0, im.devise, locale)}</td>
                          <td className="px-4 py-3">{im.valeur_bien ? formatMoney(im.valeur_bien, im.devise_valeur ?? im.devise, locale) : t("common.notProvided")}</td>
                          <td className={`px-4 py-3 font-bold ${couleurRoi(s?.roi)}`}>{s?.roi !== null && s?.roi !== undefined ? formatPct(s.roi, locale) : t("buildings.roiMissing")}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Link href={`/${locale}/immeubles/${im.id}/modifier`} className="font-semibold text-navy underline">
                                {t("common.edit")}
                              </Link>
                              {im.statut === "actif" ? (
                                <button type="button" onClick={() => setAArchiver(im)} className="font-semibold text-navy underline">
                                  {t("common.archive")}
                                </button>
                              ) : (
                                <button type="button" onClick={() => setARestaurer(im)} className="font-semibold text-navy underline">
                                  {t("common.restore")}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <Pagination
            page={pageCourante}
            pageSize={pageSize}
            total={filtres.length}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n);
              setPage(1);
            }}
            perPageLabel={t("common.perPage")}
            showingLabel={(from, to, total) => t("common.showing", { from, to, total })}
          />
        </>
      )}

      {aArchiver ? (
        <ConfirmDialog
          title={t("common.confirmArchive", { name: aArchiver.nom })}
          text={t("common.confirmArchiveText")}
          confirmLabel={t("common.archive")}
          cancelLabel={t("common.cancel")}
          danger={false}
          onConfirm={() => archiver(aArchiver)}
          onCancel={() => setAArchiver(null)}
        />
      ) : null}
      {aRestaurer ? (
        <ConfirmDialog
          title={t("common.confirmRestore", { name: aRestaurer.nom })}
          text={t("common.confirmRestoreText")}
          confirmLabel={t("common.restore")}
          cancelLabel={t("common.cancel")}
          danger={false}
          onConfirm={() => restaurer(aRestaurer)}
          onCancel={() => setARestaurer(null)}
        />
      ) : null}
    </AppShell>
  );
}

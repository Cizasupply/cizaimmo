"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import Pagination from "@/components/Pagination";
import { formatMoney } from "@/lib/format";
import { bailActif } from "@/lib/parc";
import { getDataProvider } from "@/lib/data";
import type {
  Appartement,
  Bail,
  Immeuble,
  Locataire,
  StatutAppartement,
} from "@/lib/data";
import { messageErreur } from "@/lib/translateError";

type Tri = "numero" | "loyer" | "nouveau";

const STATUTS: StatutAppartement[] = ["occupe", "vacant", "travaux", "reserve"];

/** Pastille statut appartement : occupé = vert, vacant / travaux / réservé = ambre (non loué, attention). */
function couleurStatutAppartement(s: StatutAppartement): string {
  return s === "occupe" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800";
}

/** Fond du sélecteur de statut, même code couleur que la pastille. */
function couleurSelectStatut(s: StatutAppartement): string {
  return s === "occupe"
    ? "border-green-300 bg-green-50 text-green-800"
    : "border-amber-300 bg-amber-50 text-amber-800";
}

export default function AppartementsPage() {
  const t = useTranslations("crud");
  const tp = useTranslations("pages");
  const locale = useLocale();
  const router = useRouter();

  const [appartements, setAppartements] = useState<Appartement[]>([]);
  const [immeubles, setImmeubles] = useState<Immeuble[]>([]);
  const [baux, setBaux] = useState<Bail[]>([]);
  const [locataires, setLocataires] = useState<Locataire[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [recherche, setRecherche] = useState("");
  const [immeubleId, setImmeubleId] = useState("");
  const [statut, setStatut] = useState("");
  const [tri, setTri] = useState<Tri>("numero");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [aArchiver, setAArchiver] = useState<Appartement | null>(null);

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
      const [apts, ims, bx, locs] = await Promise.all([
        p.listerAppartements(),
        p.listerImmeubles(),
        p.listerBaux(),
        p.listerLocataires(),
      ]);
      setAppartements(apts);
      setImmeubles(ims);
      setBaux(bx);
      setLocataires(locs);
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

  const nomImmeuble = (id: string) => immeubles.find((i) => i.id === id)?.nom ?? "";
  const nomLocataire = (aptId: string) => {
    const bail = bailActif(baux, aptId);
    if (!bail) return null;
    return locataires.find((l) => l.id === bail.locataire_id)?.nom ?? null;
  };
  const cleStatut = (s: StatutAppartement) =>
    s === "occupe" ? "statusOccupied" : s === "vacant" ? "statusVacant" : s === "travaux" ? "statusWorks" : "statusReserved";

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    let liste = appartements;
    if (immeubleId) liste = liste.filter((a) => a.immeuble_id === immeubleId);
    if (statut) liste = liste.filter((a) => a.statut === statut);
    if (q) {
      liste = liste.filter((a) =>
        [a.numero, a.type, nomImmeuble(a.immeuble_id)].some((v) => v.toLowerCase().includes(q))
      );
    }
    const copie = [...liste];
    if (tri === "numero") copie.sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
    if (tri === "loyer") copie.sort((a, b) => b.loyer_defaut - a.loyer_defaut);
    if (tri === "nouveau") copie.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return copie;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appartements, recherche, immeubleId, statut, tri, immeubles]);

  const totalPages = Math.max(1, Math.ceil(filtres.length / pageSize));
  const pageCourante = Math.min(page, totalPages);
  const visibles = filtres.slice((pageCourante - 1) * pageSize, pageCourante * pageSize);

  async function changerStatut(a: Appartement, nouveau: StatutAppartement) {
    if (nouveau === a.statut) return;
    try {
      await getDataProvider().changerStatutAppartement(a.id, nouveau);
      setMessage(t("common.updated"));
      charger();
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    }
  }

  async function basculerVitrine(a: Appartement) {
    try {
      await getDataProvider().basculerVitrine(a.id, !a.vitrine);
      setMessage(t("common.updated"));
      charger();
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    }
  }

  async function archiver(a: Appartement) {
    try {
      await getDataProvider().archiverAppartement(a.id);
      setAArchiver(null);
      setMessage(t("common.archivedDone"));
      charger();
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    }
  }

  return (
    <AppShell title={tp("apartments.title")}>
      <div className="mb-4">
        <Link href={`/${locale}/appartements/nouveau`} className="rounded-full bg-navy px-5 py-2.5 text-base font-bold text-white hover:bg-navy-light">
          {t("apartments.add")}
        </Link>
      </div>
      {message ? (
        <p role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">{message}</p>
      ) : null}
      {erreur ? (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erreur}</p>
      ) : null}

      {chargement ? (
        <p className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>
      ) : appartements.length === 0 ? (
        <EmptyState
          title={t("apartments.emptyTitle")}
          text={t("apartments.emptyText")}
          actionLabel={t("apartments.addFirst")}
          actionHref={`/${locale}/appartements/nouveau`}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:flex-wrap">
            <input
              type="search"
              value={recherche}
              onChange={(e) => { setRecherche(e.target.value); setPage(1); }}
              placeholder={t("apartments.searchPlaceholder")}
              aria-label={t("common.search")}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-gold"
            />
            <select
              value={immeubleId}
              onChange={(e) => { setImmeubleId(e.target.value); setPage(1); }}
              aria-label={t("apartments.filterBuilding")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"
            >
              <option value="">{t("common.all")} — {t("apartments.filterBuilding")}</option>
              {immeubles.map((im) => (
                <option key={im.id} value={im.id}>{im.nom}</option>
              ))}
            </select>
            <select
              value={statut}
              onChange={(e) => { setStatut(e.target.value); setPage(1); }}
              aria-label={t("apartments.filterStatus")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"
            >
              <option value="">{t("common.all")} — {t("apartments.filterStatus")}</option>
              {STATUTS.map((s) => (
                <option key={s} value={s}>{t(`apartments.${cleStatut(s)}`)}</option>
              ))}
            </select>
            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              {t("common.sortLabel")}
              <select
                value={tri}
                onChange={(e) => setTri(e.target.value as Tri)}
                className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"
              >
                <option value="numero">{t("apartments.fields.number")}</option>
                <option value="loyer">{t("common.sortRent")}</option>
                <option value="nouveau">{t("common.sortNewest")}</option>
              </select>
            </label>
          </div>

          {visibles.length === 0 ? (
            <p className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">{t("common.noResults")}</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {visibles.map((a) => (
                  <article key={a.id} className="rounded-2xl bg-white p-4 shadow-sm">
                    <Link href={`/${locale}/appartements/${a.id}`} className="break-words text-lg font-bold text-navy underline">
                      {a.numero} · {a.type}
                    </Link>
                    <p className="break-words text-sm text-slate-600">{nomImmeuble(a.immeuble_id)}</p>
                    <p className="mt-1 break-all text-base font-bold text-navy">{formatMoney(a.loyer_defaut, a.devise, locale)}</p>
                    <p className="mt-1 break-words text-sm text-slate-600">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${couleurStatutAppartement(a.statut)}`}>
                        {t(`apartments.${cleStatut(a.statut)}`)}
                      </span>
                      {nomLocataire(a.id) ? ` · ${nomLocataire(a.id)}` : ` · ${t("apartments.noTenant")}`}
                      {a.vitrine ? ` · ${t("apartments.vitrinePublished")}` : ""}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <select
                        value={a.statut}
                        onChange={(e) => changerStatut(a, e.target.value as StatutAppartement)}
                        aria-label={t("apartments.changeStatus")}
                        className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${couleurSelectStatut(a.statut)}`}
                      >
                        {STATUTS.map((s) => (
                          <option key={s} value={s}>{t(`apartments.${cleStatut(s)}`)}</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => basculerVitrine(a)} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy">
                        {a.vitrine ? t("apartments.removeVitrine") : t("apartments.publishVitrine")}
                      </button>
                      <Link href={`/${locale}/appartements/${a.id}/modifier`} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy">
                        {t("common.edit")}
                      </Link>
                      <button type="button" onClick={() => setAArchiver(a)} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy">
                        {t("common.archive")}
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto rounded-2xl bg-white shadow-sm md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="px-4 py-3">{t("apartments.fields.number")}</th>
                      <th className="px-4 py-3">{t("apartments.fields.building")}</th>
                      <th className="px-4 py-3">{t("apartments.fields.type")}</th>
                      <th className="px-4 py-3">{t("apartments.fields.surface")}</th>
                      <th className="px-4 py-3">{t("apartments.fields.defaultRent")}</th>
                      <th className="px-4 py-3">{t("apartments.fields.status")}</th>
                      <th className="px-4 py-3">{t("apartments.noTenant")}</th>
                      <th className="px-4 py-3">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((a) => (
                      <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <Link href={`/${locale}/appartements/${a.id}`} className="font-bold text-navy underline">
                            {a.numero}
                          </Link>
                          {a.vitrine ? (
                            <span className="ml-2 rounded-full bg-gold/20 px-2 py-0.5 text-xs font-bold text-gold-dark">
                              {t("apartments.vitrinePublished")}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3">{nomImmeuble(a.immeuble_id)}</td>
                        <td className="px-4 py-3">{a.type}</td>
                        <td className="px-4 py-3">{a.surface_m2 !== null ? `${a.surface_m2} m²` : "—"}</td>
                        <td className="px-4 py-3">{formatMoney(a.loyer_defaut, a.devise, locale)}</td>
                        <td className="px-4 py-3">
                          <select
                            value={a.statut}
                            onChange={(e) => changerStatut(a, e.target.value as StatutAppartement)}
                            aria-label={t("apartments.changeStatus")}
                            className={`rounded-lg border px-2 py-1.5 text-sm font-semibold ${couleurSelectStatut(a.statut)}`}
                          >
                            {STATUTS.map((s) => (
                              <option key={s} value={s}>{t(`apartments.${cleStatut(s)}`)}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">{nomLocataire(a.id) ?? t("apartments.noTenant")}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Link href={`/${locale}/appartements/${a.id}/modifier`} className="font-semibold text-navy underline">
                              {t("common.edit")}
                            </Link>
                            <button type="button" onClick={() => basculerVitrine(a)} className="font-semibold text-navy underline">
                              {a.vitrine ? t("apartments.removeVitrine") : t("apartments.publishVitrine")}
                            </button>
                            <button type="button" onClick={() => setAArchiver(a)} className="font-semibold text-navy underline">
                              {t("common.archive")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
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
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
            perPageLabel={t("common.perPage")}
            showingLabel={(from, to, total) => t("common.showing", { from, to, total })}
          />
        </>
      )}

      {aArchiver ? (
        <ConfirmDialog
          title={t("common.confirmArchive", { name: aArchiver.numero })}
          text={t("common.confirmArchiveText")}
          confirmLabel={t("common.archive")}
          cancelLabel={t("common.cancel")}
          danger={false}
          onConfirm={() => archiver(aArchiver)}
          onCancel={() => setAArchiver(null)}
        />
      ) : null}
    </AppShell>
  );
}

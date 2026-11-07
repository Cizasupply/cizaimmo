"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import ConfirmDialog from "@/components/ConfirmDialog";
import EmptyState from "@/components/EmptyState";
import Pagination from "@/components/Pagination";
import { formatDate, formatMoney } from "@/lib/format";
import { moisCourant } from "@/lib/parc";
import { getDataProvider } from "@/lib/data";
import type {
  Appartement,
  Bail,
  EcheanceLoyer,
  Immeuble,
  Locataire,
  StatutLoyer,
} from "@/lib/data";
import { messageErreur } from "@/lib/translateError";
import { buildLocatairesWorkbook, telechargerWorkbook } from "@/lib/exports";

type Tri = "nom" | "nouveau";
type StatutMois = "paye" | "du" | "sans_bail";

export default function LocatairesPage() {
  const t = useTranslations("crud");
  const tp = useTranslations("pages");
  const locale = useLocale();
  const router = useRouter();

  const [locataires, setLocataires] = useState<Locataire[]>([]);
  const [baux, setBaux] = useState<Bail[]>([]);
  const [appartements, setAppartements] = useState<Appartement[]>([]);
  const [immeubles, setImmeubles] = useState<Immeuble[]>([]);
  const [echeances, setEcheances] = useState<EcheanceLoyer[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [recherche, setRecherche] = useState("");
  const [immeubleId, setImmeubleId] = useState("");
  const [statutMois, setStatutMois] = useState("");
  const [tri, setTri] = useState<Tri>("nom");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [aSupprimer, setASupprimer] = useState<Locataire | null>(null);

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
      const [locs, bx, apts, ims, ech] = await Promise.all([
        p.listerLocataires(),
        p.listerBaux(),
        p.listerAppartements({ inclureArchives: true }),
        p.listerImmeubles(true),
        p.listerEcheances(),
      ]);
      setLocataires(locs);
      setBaux(bx);
      setAppartements(apts);
      setImmeubles(ims);
      setEcheances(ech);
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

  const bailActifDe = (locataireId: string) =>
    baux.find((b) => b.locataire_id === locataireId && b.statut === "actif");
  const appartementDe = (bail?: Bail) =>
    bail ? appartements.find((a) => a.id === bail.appartement_id) : undefined;
  const immeubleDe = (apt?: Appartement) =>
    apt ? immeubles.find((i) => i.id === apt.immeuble_id) : undefined;

  /** Statut du mois en cours (échéance du mois : payée ou non). */
  const statutDuMois = (locataireId: string): StatutMois => {
    const bail = bailActifDe(locataireId);
    if (!bail) return "sans_bail";
    const ech = echeances.find((e) => e.bail_id === bail.id && e.mois === moisCourant());
    if (!ech) return "du";
    return ech.statut === "paye" ? "paye" : "du";
  };
  const cleStatutMois = (s: StatutMois) =>
    s === "paye" ? "statusPaid" : s === "du" ? "statusDue" : "statusNoLease";

  /** Statut affiché du mois : reprend le vrai statut de l'échéance (payé / en retard / partiel / dû). */
  const statutAffiche = (locataireId: string): StatutLoyer | "sans_bail" => {
    const bail = bailActifDe(locataireId);
    if (!bail) return "sans_bail";
    const ech = echeances.find((e) => e.bail_id === bail.id && e.mois === moisCourant());
    if (!ech) return "du";
    return ech.statut;
  };
  /** Pastille statut du mois, même code couleur que la page Loyers. */
  function couleurStatutMois(s: StatutLoyer | "sans_bail"): string {
    return s === "paye"
      ? "bg-green-100 text-green-800"
      : s === "en_retard"
        ? "bg-red-100 text-red-800"
        : s === "partiel"
          ? "bg-orange-100 text-orange-800"
          : s === "du"
            ? "bg-amber-100 text-amber-800"
            : "bg-slate-100 text-slate-700";
  }
  const cleStatutAffiche = (s: StatutLoyer | "sans_bail") =>
    s === "paye"
      ? "tenants.statusPaid"
      : s === "en_retard"
        ? "rents.statusLate"
        : s === "partiel"
          ? "rents.statusPartial"
          : s === "du"
            ? "tenants.statusDue"
            : s === "a_venir"
              ? "rents.statusUpcoming"
              : "tenants.statusNoLease";
  /** Loyer du mois : rouge si en retard, ambre si dû/partiel, marine si payé. */
  function couleurMontantDu(s: StatutLoyer | "sans_bail"): string {
    return s === "en_retard" ? "text-red-700" : s === "du" || s === "partiel" ? "text-amber-700" : "text-navy";
  }
  /** Fin de bail : rouge si dépassée, ambre si dans les 60 jours. */
  function couleurFinBail(fin: string | null | undefined): string {
    if (!fin) return "";
    const finDate = new Date(`${fin.slice(0, 10)}T00:00:00`);
    const auj = new Date();
    auj.setHours(0, 0, 0, 0);
    const dans60j = new Date(auj);
    dans60j.setDate(auj.getDate() + 60);
    if (finDate < auj) return "font-bold text-red-700";
    if (finDate <= dans60j) return "font-bold text-amber-700";
    return "";
  }

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    let liste = locataires;
    if (immeubleId) {
      liste = liste.filter((l) => immeubleDe(appartementDe(bailActifDe(l.id)))?.id === immeubleId);
    }
    if (statutMois) liste = liste.filter((l) => statutDuMois(l.id) === statutMois);
    if (q) {
      liste = liste.filter((l) =>
        [l.nom, l.telephone, l.email ?? ""].some((v) => v.toLowerCase().includes(q))
      );
    }
    const copie = [...liste];
    if (tri === "nom") copie.sort((a, b) => a.nom.localeCompare(b.nom));
    if (tri === "nouveau") copie.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return copie;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locataires, recherche, immeubleId, statutMois, tri, baux, appartements, immeubles, echeances]);

  const totalPages = Math.max(1, Math.ceil(filtres.length / pageSize));
  const pageCourante = Math.min(page, totalPages);
  const visibles = filtres.slice((pageCourante - 1) * pageSize, pageCourante * pageSize);

  /** Export Excel de l'annuaire, sur les locataires filtrés à l'écran (spec §11). */
  function exporterExcel() {
    const wb = buildLocatairesWorkbook(
      filtres.map((l) => {
        const bail = bailActifDe(l.id);
        return {
          locataire: l,
          appartement: appartementDe(bail),
          immeuble: immeubleDe(appartementDe(bail)),
          bail,
          statutMois: t(`tenants.${cleStatutMois(statutDuMois(l.id))}`),
        };
      }),
      {
        periode: moisCourant().slice(0, 7),
        dateExport: new Date().toISOString().slice(0, 10),
        devises: [],
      }
    );
    telechargerWorkbook(wb, `cizaimmo-locataires-${moisCourant().slice(0, 7)}.xlsx`);
  }

  async function supprimer(loc: Locataire) {
    try {
      await getDataProvider().supprimerLocataire(loc.id);
      setASupprimer(null);
      setMessage(t("common.deletedDone"));
      charger();
    } catch (e) {
      setASupprimer(null);
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    }
  }

  return (
    <AppShell title={tp("tenants.title")}>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={`/${locale}/locataires/nouveau`} className="rounded-full bg-navy px-5 py-2.5 text-base font-bold text-white hover:bg-navy-light">
          {t("tenants.add")}
        </Link>
        <button
          type="button"
          onClick={exporterExcel}
          className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-navy hover:border-gold"
        >
          {t("tenants.exportExcel")}
        </button>
      </div>
      {message ? (
        <p role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">{message}</p>
      ) : null}
      {erreur ? (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erreur}</p>
      ) : null}

      {chargement ? (
        <p className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>
      ) : locataires.length === 0 ? (
        <EmptyState
          title={t("tenants.emptyTitle")}
          text={t("tenants.emptyText")}
          actionLabel={t("tenants.addFirst")}
          actionHref={`/${locale}/locataires/nouveau`}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:flex-wrap">
            <input
              type="search"
              value={recherche}
              onChange={(e) => { setRecherche(e.target.value); setPage(1); }}
              placeholder={t("tenants.searchPlaceholder")}
              aria-label={t("common.search")}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-gold"
            />
            <select
              value={immeubleId}
              onChange={(e) => { setImmeubleId(e.target.value); setPage(1); }}
              aria-label={t("tenants.filterBuilding")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"
            >
              <option value="">{t("common.all")} — {t("tenants.filterBuilding")}</option>
              {immeubles.map((im) => (
                <option key={im.id} value={im.id}>{im.nom}</option>
              ))}
            </select>
            <select
              value={statutMois}
              onChange={(e) => { setStatutMois(e.target.value); setPage(1); }}
              aria-label={t("tenants.filterStatus")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"
            >
              <option value="">{t("common.all")} — {t("tenants.filterStatus")}</option>
              <option value="paye">{t("tenants.statusPaid")}</option>
              <option value="du">{t("tenants.statusDue")}</option>
              <option value="sans_bail">{t("tenants.statusNoLease")}</option>
            </select>
            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              {t("common.sortLabel")}
              <select
                value={tri}
                onChange={(e) => setTri(e.target.value as Tri)}
                className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"
              >
                <option value="nom">{t("common.sortName")}</option>
                <option value="nouveau">{t("common.sortNewest")}</option>
              </select>
            </label>
          </div>

          {visibles.length === 0 ? (
            <p className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">{t("common.noResults")}</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {visibles.map((l) => {
                  const bail = bailActifDe(l.id);
                  const apt = appartementDe(bail);
                  const sa = statutAffiche(l.id);
                  return (
                    <article key={l.id} className="rounded-2xl bg-white p-4 shadow-sm">
                      <Link href={`/${locale}/locataires/${l.id}`} className="break-words text-lg font-bold text-navy underline">
                        {l.nom}
                      </Link>
                      <p className="break-all text-sm text-slate-600">{l.telephone}{l.email ? ` · ${l.email}` : ""}</p>
                      <p className="mt-1 break-words text-sm text-slate-700">
                        {apt ? `${apt.numero} — ${immeubleDe(apt)?.nom ?? ""}` : t("tenants.noActiveLease")}
                      </p>
                      <p className="break-words text-sm text-slate-700">
                        {bail ? (
                          <>
                            <span className={`font-bold ${couleurMontantDu(sa)}`}>{formatMoney(bail.loyer_mensuel, bail.devise, locale)}</span>
                            {" · "}
                            <span className={couleurFinBail(bail.fin)}>{t("tenants.leaseEnds", { date: bail.fin ? formatDate(bail.fin, locale) : "—" })}</span>
                          </>
                        ) : ""}
                      </p>
                      <p className="mt-1">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${couleurStatutMois(sa)}`}>{t(cleStatutAffiche(sa))}</span>
                      </p>
                      <div className="mt-3 flex gap-2">
                        <Link href={`/${locale}/locataires/${l.id}/modifier`} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy">
                          {t("common.edit")}
                        </Link>
                        {!bail ? (
                          <button type="button" onClick={() => setASupprimer(l)} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy">
                            {t("common.delete")}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto rounded-2xl bg-white shadow-sm md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="px-4 py-3">{t("tenants.fields.fullName")}</th>
                      <th className="px-4 py-3">{t("tenants.fields.phone")}</th>
                      <th className="px-4 py-3">{t("tenants.currentApartment")}</th>
                      <th className="px-4 py-3">{t("leases.fields.end")}</th>
                      <th className="px-4 py-3">{t("tenants.filterStatus")}</th>
                      <th className="px-4 py-3">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((l) => {
                      const bail = bailActifDe(l.id);
                      const apt = appartementDe(bail);
                      const sa = statutAffiche(l.id);
                      return (
                        <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <Link href={`/${locale}/locataires/${l.id}`} className="font-bold text-navy underline">
                              {l.nom}
                            </Link>
                            {l.email ? <p className="text-xs text-slate-500">{l.email}</p> : null}
                          </td>
                          <td className="px-4 py-3">{l.telephone}</td>
                          <td className="px-4 py-3">
                            {apt ? `${apt.numero} — ${immeubleDe(apt)?.nom ?? ""}` : "—"}
                          </td>
                          <td className="px-4 py-3"><span className={couleurFinBail(bail?.fin)}>{bail?.fin ? formatDate(bail.fin, locale) : "—"}</span></td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${couleurStatutMois(sa)}`}>{t(cleStatutAffiche(sa))}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Link href={`/${locale}/locataires/${l.id}/modifier`} className="font-semibold text-navy underline">
                                {t("common.edit")}
                              </Link>
                              {!bail ? (
                                <button type="button" onClick={() => setASupprimer(l)} className="font-semibold text-navy underline">
                                  {t("common.delete")}
                                </button>
                              ) : null}
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
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
            perPageLabel={t("common.perPage")}
            showingLabel={(from, to, total) => t("common.showing", { from, to, total })}
          />
        </>
      )}

      {aSupprimer ? (
        <ConfirmDialog
          title={t("common.confirmDelete", { name: aSupprimer.nom })}
          text={t("common.confirmDeleteText")}
          confirmLabel={t("common.delete")}
          cancelLabel={t("common.cancel")}
          danger
          onConfirm={() => supprimer(aSupprimer)}
          onCancel={() => setASupprimer(null)}
        />
      ) : null}
    </AppShell>
  );
}

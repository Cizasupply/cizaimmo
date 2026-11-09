"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LocatairesPage;
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const next_intl_1 = require("next-intl");
const navigation_1 = require("next/navigation");
const AppShell_1 = __importDefault(require("@/components/AppShell"));
const ConfirmDialog_1 = __importDefault(require("@/components/ConfirmDialog"));
const EmptyState_1 = __importDefault(require("@/components/EmptyState"));
const Pagination_1 = __importDefault(require("@/components/Pagination"));
const format_1 = require("@/lib/format");
const parc_1 = require("@/lib/parc");
const data_1 = require("@/lib/data");
const translateError_1 = require("@/lib/translateError");
const exports_1 = require("@/lib/exports");
function LocatairesPage() {
    const t = (0, next_intl_1.useTranslations)("crud");
    const tp = (0, next_intl_1.useTranslations)("pages");
    const locale = (0, next_intl_1.useLocale)();
    const router = (0, navigation_1.useRouter)();
    const [locataires, setLocataires] = (0, react_1.useState)([]);
    const [baux, setBaux] = (0, react_1.useState)([]);
    const [appartements, setAppartements] = (0, react_1.useState)([]);
    const [immeubles, setImmeubles] = (0, react_1.useState)([]);
    const [echeances, setEcheances] = (0, react_1.useState)([]);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const [message, setMessage] = (0, react_1.useState)(null);
    const [recherche, setRecherche] = (0, react_1.useState)("");
    const [immeubleId, setImmeubleId] = (0, react_1.useState)("");
    const [statutMois, setStatutMois] = (0, react_1.useState)("");
    const [tri, setTri] = (0, react_1.useState)("nom");
    const [page, setPage] = (0, react_1.useState)(1);
    const [pageSize, setPageSize] = (0, react_1.useState)(20);
    const [aSupprimer, setASupprimer] = (0, react_1.useState)(null);
    async function charger() {
        setChargement(true);
        setErreur(null);
        try {
            const p = (0, data_1.getDataProvider)();
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
        }
        catch (e) {
            setErreur((0, translateError_1.messageErreur)(t, e));
        }
        finally {
            setChargement(false);
        }
    }
    (0, react_1.useEffect)(() => {
        charger();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const bailActifDe = (locataireId) => baux.find((b) => b.locataire_id === locataireId && b.statut === "actif");
    const appartementDe = (bail) => bail ? appartements.find((a) => a.id === bail.appartement_id) : undefined;
    const immeubleDe = (apt) => apt ? immeubles.find((i) => i.id === apt.immeuble_id) : undefined;
    /** Statut du mois en cours (échéance du mois : payée ou non). */
    const statutDuMois = (locataireId) => {
        const bail = bailActifDe(locataireId);
        if (!bail)
            return "sans_bail";
        const ech = echeances.find((e) => e.bail_id === bail.id && e.mois === (0, parc_1.moisCourant)());
        if (!ech)
            return "du";
        return ech.statut === "paye" ? "paye" : "du";
    };
    const cleStatutMois = (s) => s === "paye" ? "statusPaid" : s === "du" ? "statusDue" : "statusNoLease";
    /** Statut affiché du mois : reprend le vrai statut de l'échéance (payé / en retard / partiel / dû). */
    const statutAffiche = (locataireId) => {
        const bail = bailActifDe(locataireId);
        if (!bail)
            return "sans_bail";
        const ech = echeances.find((e) => e.bail_id === bail.id && e.mois === (0, parc_1.moisCourant)());
        if (!ech)
            return "du";
        return ech.statut;
    };
    /** Pastille statut du mois, même code couleur que la page Loyers. */
    function couleurStatutMois(s) {
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
    const cleStatutAffiche = (s) => s === "paye"
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
    function couleurMontantDu(s) {
        return s === "en_retard" ? "text-red-700" : s === "du" || s === "partiel" ? "text-amber-700" : "text-navy";
    }
    /** Fin de bail : rouge si dépassée, ambre si dans les 60 jours. */
    function couleurFinBail(fin) {
        if (!fin)
            return "";
        const finDate = new Date(`${fin.slice(0, 10)}T00:00:00`);
        const auj = new Date();
        auj.setHours(0, 0, 0, 0);
        const dans60j = new Date(auj);
        dans60j.setDate(auj.getDate() + 60);
        if (finDate < auj)
            return "font-bold text-red-700";
        if (finDate <= dans60j)
            return "font-bold text-amber-700";
        return "";
    }
    const filtres = (0, react_1.useMemo)(() => {
        const q = recherche.trim().toLowerCase();
        let liste = locataires;
        if (immeubleId) {
            liste = liste.filter((l) => immeubleDe(appartementDe(bailActifDe(l.id)))?.id === immeubleId);
        }
        if (statutMois)
            liste = liste.filter((l) => statutDuMois(l.id) === statutMois);
        if (q) {
            liste = liste.filter((l) => [l.nom, l.telephone, l.email ?? ""].some((v) => v.toLowerCase().includes(q)));
        }
        const copie = [...liste];
        if (tri === "nom")
            copie.sort((a, b) => a.nom.localeCompare(b.nom));
        if (tri === "nouveau")
            copie.sort((a, b) => b.created_at.localeCompare(a.created_at));
        return copie;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [locataires, recherche, immeubleId, statutMois, tri, baux, appartements, immeubles, echeances]);
    const totalPages = Math.max(1, Math.ceil(filtres.length / pageSize));
    const pageCourante = Math.min(page, totalPages);
    const visibles = filtres.slice((pageCourante - 1) * pageSize, pageCourante * pageSize);
    /** Export Excel de l'annuaire, sur les locataires filtrés à l'écran (spec §11). */
    function exporterExcel() {
        const wb = (0, exports_1.buildLocatairesWorkbook)(filtres.map((l) => {
            const bail = bailActifDe(l.id);
            return {
                locataire: l,
                appartement: appartementDe(bail),
                immeuble: immeubleDe(appartementDe(bail)),
                bail,
                statutMois: t(`tenants.${cleStatutMois(statutDuMois(l.id))}`),
            };
        }), {
            periode: (0, parc_1.moisCourant)().slice(0, 7),
            dateExport: new Date().toISOString().slice(0, 10),
            devises: [],
        });
        (0, exports_1.telechargerWorkbook)(wb, `cizaimmo-locataires-${(0, parc_1.moisCourant)().slice(0, 7)}.xlsx`);
    }
    async function supprimer(loc) {
        try {
            await (0, data_1.getDataProvider)().supprimerLocataire(loc.id);
            setASupprimer(null);
            setMessage(t("common.deletedDone"));
            charger();
        }
        catch (e) {
            setASupprimer(null);
            setErreur((0, translateError_1.messageErreur)(t, e));
        }
    }
    return (<AppShell_1.default title={tp("tenants.title")}>
      <div className="mb-4 flex flex-wrap gap-2">
        <link_1.default href={`/${locale}/locataires/nouveau`} className="rounded-full bg-gold px-5 py-2.5 text-base font-bold text-navy hover:bg-gold-light">
          {t("tenants.add")}
        </link_1.default>
        <button type="button" onClick={exporterExcel} className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-navy hover:border-gold">
          {t("tenants.exportExcel")}
        </button>
      </div>
      {message ? (<p role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">{message}</p>) : null}
      {erreur ? (<p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erreur}</p>) : null}

      {chargement ? (<p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>) : locataires.length === 0 ? (<EmptyState_1.default title={t("tenants.emptyTitle")} text={t("tenants.emptyText")} actionLabel={t("tenants.addFirst")} actionHref={`/${locale}/locataires/nouveau`}/>) : (<>
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:flex-wrap">
            <input type="search" value={recherche} onChange={(e) => { setRecherche(e.target.value); setPage(1); }} placeholder={t("tenants.searchPlaceholder")} aria-label={t("common.search")} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-gold"/>
            <select value={immeubleId} onChange={(e) => { setImmeubleId(e.target.value); setPage(1); }} aria-label={t("tenants.filterBuilding")} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold">
              <option value="">{t("common.all")} — {t("tenants.filterBuilding")}</option>
              {immeubles.map((im) => (<option key={im.id} value={im.id}>{im.nom}</option>))}
            </select>
            <select value={statutMois} onChange={(e) => { setStatutMois(e.target.value); setPage(1); }} aria-label={t("tenants.filterStatus")} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold">
              <option value="">{t("common.all")} — {t("tenants.filterStatus")}</option>
              <option value="paye">{t("tenants.statusPaid")}</option>
              <option value="du">{t("tenants.statusDue")}</option>
              <option value="sans_bail">{t("tenants.statusNoLease")}</option>
            </select>
            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              {t("common.sortLabel")}
              <select value={tri} onChange={(e) => setTri(e.target.value)} className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold">
                <option value="nom">{t("common.sortName")}</option>
                <option value="nouveau">{t("common.sortNewest")}</option>
              </select>
            </label>
          </div>

          {visibles.length === 0 ? (<p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">{t("common.noResults")}</p>) : (<>
              <div className="space-y-3 md:hidden">
                {visibles.map((l) => {
                    const bail = bailActifDe(l.id);
                    const apt = appartementDe(bail);
                    const sa = statutAffiche(l.id);
                    return (<article key={l.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <link_1.default href={`/${locale}/locataires/${l.id}`} className="break-words text-lg font-bold text-navy underline">
                        {l.nom}
                      </link_1.default>
                      <p className="break-all text-sm text-slate-600">{l.telephone}{l.email ? ` · ${l.email}` : ""}</p>
                      <p className="mt-1 break-words text-sm text-slate-700">
                        {apt ? `${apt.numero} — ${immeubleDe(apt)?.nom ?? ""}` : t("tenants.noActiveLease")}
                      </p>
                      <p className="break-words text-sm text-slate-700">
                        {bail ? (<>
                            <span className={`font-bold ${couleurMontantDu(sa)}`}>{(0, format_1.formatMoney)(bail.loyer_mensuel, bail.devise, locale)}</span>
                            {" · "}
                            <span className={couleurFinBail(bail.fin)}>{t("tenants.leaseEnds", { date: bail.fin ? (0, format_1.formatDate)(bail.fin, locale) : "—" })}</span>
                          </>) : ""}
                      </p>
                      <p className="mt-1">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${couleurStatutMois(sa)}`}>{t(cleStatutAffiche(sa))}</span>
                      </p>
                      <div className="mt-3 flex gap-2">
                        <link_1.default href={`/${locale}/locataires/${l.id}/modifier`} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy">
                          {t("common.edit")}
                        </link_1.default>
                        {!bail ? (<button type="button" onClick={() => setASupprimer(l)} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy">
                            {t("common.delete")}
                          </button>) : null}
                      </div>
                    </article>);
                })}
              </div>

              <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-cream font-semibold text-navy">
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
                    return (<tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <link_1.default href={`/${locale}/locataires/${l.id}`} className="font-bold text-navy underline">
                              {l.nom}
                            </link_1.default>
                            {l.email ? <p className="text-xs text-slate-500">{l.email}</p> : null}
                          </td>
                          <td className="px-4 py-3">{l.telephone}</td>
                          <td className="px-4 py-3">
                            {apt ? `${apt.numero} — ${immeubleDe(apt)?.nom ?? ""}` : "—"}
                          </td>
                          <td className="px-4 py-3"><span className={couleurFinBail(bail?.fin)}>{bail?.fin ? (0, format_1.formatDate)(bail.fin, locale) : "—"}</span></td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${couleurStatutMois(sa)}`}>{t(cleStatutAffiche(sa))}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <link_1.default href={`/${locale}/locataires/${l.id}/modifier`} className="font-semibold text-navy underline">
                                {t("common.edit")}
                              </link_1.default>
                              {!bail ? (<button type="button" onClick={() => setASupprimer(l)} className="font-semibold text-navy underline">
                                  {t("common.delete")}
                                </button>) : null}
                            </div>
                          </td>
                        </tr>);
                })}
                  </tbody>
                </table>
              </div>
            </>)}

          <Pagination_1.default page={pageCourante} pageSize={pageSize} total={filtres.length} onPageChange={setPage} onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} perPageLabel={t("common.perPage")} showingLabel={(from, to, total) => t("common.showing", { from, to, total })}/>
        </>)}

      {aSupprimer ? (<ConfirmDialog_1.default title={t("common.confirmDelete", { name: aSupprimer.nom })} text={t("common.confirmDeleteText")} confirmLabel={t("common.delete")} cancelLabel={t("common.cancel")} danger onConfirm={() => supprimer(aSupprimer)} onCancel={() => setASupprimer(null)}/>) : null}
    </AppShell_1.default>);
}

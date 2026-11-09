"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ImmeublesPage;
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
/** Couleur du taux d'occupation : vert ≥ 80 %, ambre 50–79 %, rouge < 50 %. */
function couleurOccupation(occupation) {
    if (occupation === null || occupation === undefined)
        return "text-slate-500";
    if (occupation >= 0.8)
        return "text-green-700";
    if (occupation >= 0.5)
        return "text-amber-700";
    return "text-red-700";
}
/** ROI : vert si ≥ 0, rouge si négatif. */
function couleurRoi(roi) {
    if (roi === null || roi === undefined)
        return "text-navy";
    return roi >= 0 ? "text-green-700" : "text-red-700";
}
function ImmeublesPage() {
    const t = (0, next_intl_1.useTranslations)("crud");
    const tp = (0, next_intl_1.useTranslations)("pages");
    const tn = (0, next_intl_1.useTranslations)("nav");
    const locale = (0, next_intl_1.useLocale)();
    const router = (0, navigation_1.useRouter)();
    const [immeubles, setImmeubles] = (0, react_1.useState)([]);
    const [appartements, setAppartements] = (0, react_1.useState)([]);
    const [baux, setBaux] = (0, react_1.useState)([]);
    const [echeances, setEcheances] = (0, react_1.useState)([]);
    const [paiements, setPaiements] = (0, react_1.useState)([]);
    const [depenses, setDepenses] = (0, react_1.useState)([]);
    const [abonnement, setAbonnement] = (0, react_1.useState)(null);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const [recherche, setRecherche] = (0, react_1.useState)("");
    const [ville, setVille] = (0, react_1.useState)("");
    const [tri, setTri] = (0, react_1.useState)("nom");
    const [afficherArchives, setAfficherArchives] = (0, react_1.useState)(false);
    const [page, setPage] = (0, react_1.useState)(1);
    const [pageSize, setPageSize] = (0, react_1.useState)(20);
    const [aArchiver, setAArchiver] = (0, react_1.useState)(null);
    const [aRestaurer, setARestaurer] = (0, react_1.useState)(null);
    const [message, setMessage] = (0, react_1.useState)(null);
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
    const villes = (0, react_1.useMemo)(() => Array.from(new Set(immeubles.map((i) => i.ville))).sort(), [immeubles]);
    const statsParImmeuble = (0, react_1.useMemo)(() => {
        const m = new Map();
        for (const im of immeubles) {
            m.set(im.id, (0, parc_1.statsImmeuble)(im, appartements, baux, echeances, paiements, depenses));
        }
        return m;
    }, [immeubles, appartements, baux, echeances, paiements, depenses]);
    const filtres = (0, react_1.useMemo)(() => {
        const q = recherche.trim().toLowerCase();
        let liste = immeubles.filter((im) => (afficherArchives ? true : im.statut === "actif"));
        if (ville)
            liste = liste.filter((im) => im.ville === ville);
        if (q) {
            liste = liste.filter((im) => [im.nom, im.adresse, im.ville, im.pays].some((v) => v.toLowerCase().includes(q)));
        }
        const copie = [...liste];
        if (tri === "nom")
            copie.sort((a, b) => a.nom.localeCompare(b.nom));
        if (tri === "ville")
            copie.sort((a, b) => a.ville.localeCompare(b.ville) || a.nom.localeCompare(b.nom));
        if (tri === "loyer") {
            copie.sort((a, b) => (statsParImmeuble.get(b.id)?.loyersMois ?? 0) - (statsParImmeuble.get(a.id)?.loyersMois ?? 0));
        }
        if (tri === "nouveau")
            copie.sort((a, b) => b.created_at.localeCompare(a.created_at));
        return copie;
    }, [immeubles, recherche, ville, tri, afficherArchives, statsParImmeuble]);
    const totalPages = Math.max(1, Math.ceil(filtres.length / pageSize));
    const pageCourante = Math.min(page, totalPages);
    const visibles = filtres.slice((pageCourante - 1) * pageSize, pageCourante * pageSize);
    const nbActifs = immeubles.filter((i) => i.statut === "actif").length;
    const limite = abonnement ? (0, data_1.limiteBlocs)(abonnement.plan, abonnement.statut) : null;
    const limiteAtteinte = limite !== null && Number.isFinite(limite) && nbActifs >= limite;
    async function archiver(im) {
        try {
            await (0, data_1.getDataProvider)().archiverImmeuble(im.id);
            setAArchiver(null);
            setMessage(t("common.archivedDone"));
            charger();
        }
        catch (e) {
            setErreur((0, translateError_1.messageErreur)(t, e));
        }
    }
    async function restaurer(im) {
        try {
            await (0, data_1.getDataProvider)().desarchiverImmeuble(im.id);
            setARestaurer(null);
            setMessage(t("common.restoredDone"));
            charger();
        }
        catch (e) {
            setErreur((0, translateError_1.messageErreur)(t, e));
        }
    }
    return (<AppShell_1.default title={tp("buildings.title")}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <link_1.default href={`/${locale}/immeubles/nouveau`} className="rounded-full bg-gold px-5 py-2.5 text-base font-bold text-navy hover:bg-gold-light">
          {t("buildings.add")}
        </link_1.default>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={afficherArchives} onChange={(e) => {
            setAfficherArchives(e.target.checked);
            setPage(1);
        }} className="h-5 w-5 accent-[#1B2A4A]"/>
          {t("common.showArchived")}
        </label>
      </div>

      {limiteAtteinte && abonnement ? (<p role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {t("buildings.limitText", {
                plan: abonnement.plan,
                limit: String(limite),
                used: String(nbActifs),
            })}{" "}
          <link_1.default href={`/${locale}/abonnement`} className="font-bold underline">
            {tn("subscription")}
          </link_1.default>
        </p>) : null}
      {message ? (<p role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          {message}
        </p>) : null}

      {chargement ? (<p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>) : erreur ? (<div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p role="alert" className="text-red-700">{erreur}</p>
          <button type="button" onClick={charger} className="mt-4 rounded-full border border-navy bg-white px-5 py-2 text-sm font-semibold text-navy hover:bg-navy/5">
            {t("common.retry")}
          </button>
        </div>) : immeubles.length === 0 ? (<EmptyState_1.default title={t("buildings.emptyTitle")} text={t("buildings.emptyText")} actionLabel={t("buildings.addFirst")} actionHref={`/${locale}/immeubles/nouveau`}/>) : (<>
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
            <input type="search" value={recherche} onChange={(e) => {
                setRecherche(e.target.value);
                setPage(1);
            }} placeholder={t("buildings.searchPlaceholder")} aria-label={t("common.search")} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-gold"/>
            <select value={ville} onChange={(e) => {
                setVille(e.target.value);
                setPage(1);
            }} aria-label={t("buildings.filterCity")} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold">
              <option value="">{t("common.all")} — {t("buildings.filterCity")}</option>
              {villes.map((v) => (<option key={v} value={v}>{v}</option>))}
            </select>
            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
              {t("common.sortLabel")}
              <select value={tri} onChange={(e) => setTri(e.target.value)} className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold">
                <option value="nom">{t("common.sortName")}</option>
                <option value="ville">{t("common.sortCity")}</option>
                <option value="loyer">{t("common.sortRent")}</option>
                <option value="nouveau">{t("common.sortNewest")}</option>
              </select>
            </label>
          </div>

          {visibles.length === 0 ? (<p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">{t("common.noResults")}</p>) : (<>
              {/* Cartes — téléphone */}
              <div className="space-y-3 md:hidden">
                {visibles.map((im) => {
                    const s = statsParImmeuble.get(im.id);
                    return (<article key={im.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        {/* v1.7 : vignette — la photo du passeport du bien. */}
                        {(im.photos_urls[0] || im.photo_url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={im.photos_urls[0] || im.photo_url || ""} alt="" className="h-16 w-20 shrink-0 rounded-lg object-cover"/>) : null}
                        <div className="min-w-0 flex-1">
                          <link_1.default href={`/${locale}/immeubles/${im.id}`} className="break-words text-lg font-bold text-navy underline">
                            {im.nom}
                          </link_1.default>
                          <p className="break-words text-sm text-slate-600">{im.adresse}, {im.ville}</p>
                        </div>
                        {im.statut === "archive" ? (<span className="shrink-0 rounded-full bg-slate-200 px-2 py-1 text-xs font-bold text-slate-700">
                            {t("common.archived")}
                          </span>) : null}
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div className="min-w-0"><dt className="text-slate-500">{t("buildings.statsApartments")}</dt><dd className="font-bold text-navy">{s?.nbAppartements ?? 0} (<span className="font-bold text-green-700">{s?.nbOccupes ?? 0}</span> {t("buildings.statsOccupied").toLowerCase()})</dd></div>
                        <div className="min-w-0"><dt className="text-slate-500">{t("buildings.statsOccupancy")}</dt><dd className={`font-bold ${couleurOccupation(s?.occupation)}`}>{s?.occupation !== null && s?.occupation !== undefined ? (0, format_1.formatPct)(s.occupation, locale) : "—"}</dd></div>
                        <div className="min-w-0"><dt className="text-slate-500">{t("buildings.statsMonthlyRent")}</dt><dd className="whitespace-nowrap font-bold text-navy">{(0, format_1.formatMoney)(s?.loyersMois ?? 0, im.devise, locale)}</dd></div>
                        <div className="min-w-0"><dt className="text-slate-500">{t("buildings.statsRoi")}</dt><dd className={`font-bold ${couleurRoi(s?.roi)}`}>{s?.roi !== null && s?.roi !== undefined ? (0, format_1.formatPct)(s.roi, locale) : t("buildings.roiMissing")}</dd></div>
                      </dl>
                      <div className="mt-3 flex gap-2">
                        <link_1.default href={`/${locale}/immeubles/${im.id}/modifier`} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy">
                          {t("common.edit")}
                        </link_1.default>
                        {im.statut === "actif" ? (<button type="button" onClick={() => setAArchiver(im)} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy">
                            {t("common.archive")}
                          </button>) : (<button type="button" onClick={() => setARestaurer(im)} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy">
                            {t("common.restore")}
                          </button>)}
                      </div>
                    </article>);
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
                    return (<tr key={im.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {/* v1.7 : vignette — la photo du passeport du bien. */}
                              {(im.photos_urls[0] || im.photo_url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={im.photos_urls[0] || im.photo_url || ""} alt="" className="h-11 w-14 shrink-0 rounded-md object-cover"/>) : null}
                              <div className="min-w-0">
                                <link_1.default href={`/${locale}/immeubles/${im.id}`} className="font-bold text-navy underline">
                                  {im.nom}
                                </link_1.default>
                                <p className="text-xs text-slate-500">{im.adresse}</p>
                                {im.statut === "archive" ? (<span className="mt-1 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">
                                    {t("common.archived")}
                                  </span>) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">{im.ville}, {im.pays}</td>
                          <td className="px-4 py-3">{s?.nbAppartements ?? 0} (<span className="font-bold text-green-700">{s?.nbOccupes ?? 0}</span> {t("buildings.statsOccupied").toLowerCase()})</td>
                          <td className={`px-4 py-3 font-bold ${couleurOccupation(s?.occupation)}`}>{s?.occupation !== null && s?.occupation !== undefined ? (0, format_1.formatPct)(s.occupation, locale) : "—"}</td>
                          <td className="px-4 py-3">{(0, format_1.formatMoney)(s?.loyersMois ?? 0, im.devise, locale)}</td>
                          <td className="px-4 py-3">{im.valeur_bien ? (0, format_1.formatMoney)(im.valeur_bien, im.devise_valeur ?? im.devise, locale) : t("common.notProvided")}</td>
                          <td className={`px-4 py-3 font-bold ${couleurRoi(s?.roi)}`}>{s?.roi !== null && s?.roi !== undefined ? (0, format_1.formatPct)(s.roi, locale) : t("buildings.roiMissing")}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <link_1.default href={`/${locale}/immeubles/${im.id}/modifier`} className="font-semibold text-navy underline">
                                {t("common.edit")}
                              </link_1.default>
                              {im.statut === "actif" ? (<button type="button" onClick={() => setAArchiver(im)} className="font-semibold text-navy underline">
                                  {t("common.archive")}
                                </button>) : (<button type="button" onClick={() => setARestaurer(im)} className="font-semibold text-navy underline">
                                  {t("common.restore")}
                                </button>)}
                            </div>
                          </td>
                        </tr>);
                })}
                  </tbody>
                </table>
              </div>
            </>)}

          <Pagination_1.default page={pageCourante} pageSize={pageSize} total={filtres.length} onPageChange={setPage} onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
            }} perPageLabel={t("common.perPage")} showingLabel={(from, to, total) => t("common.showing", { from, to, total })}/>
        </>)}

      {aArchiver ? (<ConfirmDialog_1.default title={t("common.confirmArchive", { name: aArchiver.nom })} text={t("common.confirmArchiveText")} confirmLabel={t("common.archive")} cancelLabel={t("common.cancel")} danger={false} onConfirm={() => archiver(aArchiver)} onCancel={() => setAArchiver(null)}/>) : null}
      {aRestaurer ? (<ConfirmDialog_1.default title={t("common.confirmRestore", { name: aRestaurer.nom })} text={t("common.confirmRestoreText")} confirmLabel={t("common.restore")} cancelLabel={t("common.cancel")} danger={false} onConfirm={() => restaurer(aRestaurer)} onCancel={() => setARestaurer(null)}/>) : null}
    </AppShell_1.default>);
}

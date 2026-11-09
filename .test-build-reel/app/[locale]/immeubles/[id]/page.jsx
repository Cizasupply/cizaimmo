"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ImmeubleDetailPage;
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const next_intl_1 = require("next-intl");
const navigation_1 = require("next/navigation");
const AppShell_1 = __importDefault(require("@/components/AppShell"));
const ConfirmDialog_1 = __importDefault(require("@/components/ConfirmDialog"));
const DocumentList_1 = __importDefault(require("@/components/DocumentList"));
const IndivisionSection_1 = __importDefault(require("@/components/IndivisionSection"));
const format_1 = require("@/lib/format");
const parc_1 = require("@/lib/parc");
const data_1 = require("@/lib/data");
const translateError_1 = require("@/lib/translateError");
function ImmeubleDetailPage({ params }) {
    const t = (0, next_intl_1.useTranslations)("crud");
    const t17 = (0, next_intl_1.useTranslations)("v17");
    const locale = (0, next_intl_1.useLocale)();
    const router = (0, navigation_1.useRouter)();
    const [immeuble, setImmeuble] = (0, react_1.useState)(null);
    const [profil, setProfil] = (0, react_1.useState)(null);
    const [appartements, setAppartements] = (0, react_1.useState)([]);
    const [baux, setBaux] = (0, react_1.useState)([]);
    const [locataires, setLocataires] = (0, react_1.useState)([]);
    const [echeances, setEcheances] = (0, react_1.useState)([]);
    const [paiements, setPaiements] = (0, react_1.useState)([]);
    const [depenses, setDepenses] = (0, react_1.useState)([]);
    const [documents, setDocuments] = (0, react_1.useState)([]);
    const [activites, setActivites] = (0, react_1.useState)([]);
    const [alertes, setAlertes] = (0, react_1.useState)([]);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const [aArchiver, setAArchiver] = (0, react_1.useState)(false);
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
            const im = await p.getImmeuble(params.id);
            if (!im) {
                setErreur(t("errors.ERR_NOT_FOUND"));
                setChargement(false);
                return;
            }
            const [apts, bx, locs, ech, pay, dep, docs, prof, act, alr] = await Promise.all([
                p.listerAppartements({ immeubleId: im.id, inclureArchives: true }),
                p.listerBaux(),
                p.listerLocataires(),
                p.listerEcheances(),
                p.listerPaiements(),
                p.listerDepenses({ immeubleId: im.id }),
                p.listerDocuments({ entite_type: "immeuble", entite_id: im.id }),
                p.getProfil(),
                p.listerActivites(im.id),
                p.listerAlertes(),
            ]);
            setImmeuble(im);
            setAppartements(apts);
            setBaux(bx);
            setLocataires(locs);
            setEcheances(ech);
            setPaiements(pay);
            setDepenses(dep);
            setDocuments(docs);
            setProfil(prof);
            setActivites(act);
            setAlertes(alr);
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
    }, [params.id]);
    const stats = (0, react_1.useMemo)(() => immeuble
        ? (0, parc_1.statsImmeuble)(immeuble, appartements, baux, echeances, paiements, depenses)
        : null, [immeuble, appartements, baux, echeances, paiements, depenses]);
    const nomLocataire = (aptId) => {
        const bail = (0, parc_1.bailActif)(baux, aptId);
        if (!bail)
            return null;
        return locataires.find((l) => l.id === bail.locataire_id)?.nom ?? null;
    };
    const estCoproprietaire = profil?.role === "coproprietaire";
    const bauxImmeuble = (0, react_1.useMemo)(() => baux.filter((b) => appartements.some((a) => a.id === b.appartement_id)), [baux, appartements]);
    const echeanceIdsImmeuble = (0, react_1.useMemo)(() => new Set(echeances
        .filter((e) => bauxImmeuble.some((b) => b.id === e.bail_id))
        .map((e) => e.id)), [echeances, bauxImmeuble]);
    const paiementsImmeuble = (0, react_1.useMemo)(() => paiements.filter((p) => p.statut === "valide" && echeanceIdsImmeuble.has(p.echeance_id)), [paiements, echeanceIdsImmeuble]);
    const alertesImmeuble = (0, react_1.useMemo)(() => {
        const aptIds = new Set(appartements.map((a) => a.id));
        const bailIds = new Set(bauxImmeuble.map((b) => b.id));
        return alertes.filter((a) => {
            if (a.entite_type === "immeuble")
                return a.entite_id === immeuble?.id;
            if (a.entite_type === "appartement")
                return a.entite_id !== null && aptIds.has(a.entite_id);
            if (a.entite_type === "bail")
                return a.entite_id !== null && bailIds.has(a.entite_id);
            if (a.entite_type === "loyer")
                return a.entite_id !== null && echeanceIdsImmeuble.has(a.entite_id);
            return false;
        });
    }, [alertes, appartements, bauxImmeuble, echeanceIdsImmeuble, immeuble]);
    const libelleModeAcquisition = (mode) => {
        if (!mode)
            return t("common.notProvided");
        if (mode === "achat")
            return t("passport.modeAchat");
        if (mode === "heritage")
            return t("passport.modeHeritage");
        if (mode === "donation")
            return t("passport.modeDonation");
        return t("passport.modeAutre");
    };
    async function archiver() {
        if (!immeuble)
            return;
        try {
            await (0, data_1.getDataProvider)().archiverImmeuble(immeuble.id);
            setAArchiver(false);
            setMessage(t("common.archivedDone"));
            charger();
        }
        catch (e) {
            setErreur((0, translateError_1.messageErreur)(t, e));
        }
    }
    if (chargement) {
        return (<AppShell_1.default title={t("buildings.title")}>
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>
      </AppShell_1.default>);
    }
    if (!immeuble) {
        return (<AppShell_1.default title={t("buildings.title")}>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p role="alert" className="text-red-700">{erreur ?? t("errors.ERR_NOT_FOUND")}</p>
          <link_1.default href={`/${locale}/immeubles`} className="mt-4 inline-block font-semibold text-navy underline">
            {t("common.back")}
          </link_1.default>
        </div>
      </AppShell_1.default>);
    }
    return (<AppShell_1.default title={immeuble.nom}>
      <link_1.default href={`/${locale}/immeubles`} className="mb-4 inline-block font-semibold text-navy underline">
        ← {t("buildings.backToList")}
      </link_1.default>
      {message ? (<p role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">{message}</p>) : null}
      {erreur ? (<p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erreur}</p>) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* v1.7 : la photo principale du bien ouvre sa fiche — c'est la
            photo du passeport : tout le monde voit de quelle maison on parle. */}
        {(immeuble.photos_urls[0] || immeuble.photo_url) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={immeuble.photos_urls[0] || immeuble.photo_url || ""} alt={immeuble.nom} className="mb-5 h-52 w-full rounded-xl object-cover"/>) : null}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base text-slate-600">
              {immeuble.adresse}, {immeuble.ville} — {immeuble.pays}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {t("buildings.fields.type")} : {t(`buildings.fields.${immeuble.type === "immeuble" ? "typeImmeuble" : immeuble.type === "bloc" ? "typeBloc" : "typeMaison"}`)}
              {immeuble.etages !== null ? ` · ${immeuble.etages} ${t("buildings.fields.floors").toLowerCase()}` : ""}
              {immeuble.statut === "archive" ? ` · ${t("common.archived")}` : ""}
            </p>
            {immeuble.notes ? <p className="mt-2 text-base text-slate-700">{immeuble.notes}</p> : null}
            {/* v1.7 : bien créé par un gestionnaire — propriétaire
            déclaré et état de la revue plateforme, visibles ici. */}
            {immeuble.origine_creation === "gestionnaire" ? (<div className="mt-3 space-y-1 text-sm">
                <p className="text-slate-700">
                  {t17("declaredOwner")} : <strong>{immeuble.proprietaire_declare_nom ?? "—"}</strong>
                  {immeuble.proprietaire_declare_email ? ` · ${immeuble.proprietaire_declare_email}` : ""}
                </p>
                {immeuble.validation_statut === "en_attente" ? (<p className="inline-block rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">
                    {t17("validationPending")}
                  </p>) : immeuble.validation_statut === "refuse" ? (<p className="inline-block rounded-full bg-red-100 px-3 py-1 font-semibold text-red-800">
                    {t17("validationRefused")}
                    {immeuble.validation_motif ? ` — ${t17("reviewMotif")} : ${immeuble.validation_motif}` : ""}
                  </p>) : (<p className="inline-block rounded-full bg-green-100 px-3 py-1 font-semibold text-green-800">
                    {t17("validationOk")}
                  </p>)}
                {immeuble.proprietaire_concordance ? (<p className="text-slate-600">{t17("concordanceOk")}</p>) : null}
              </div>) : null}
          </div>
          <div className="flex gap-2">
            {!estCoproprietaire ? (<link_1.default href={`/${locale}/immeubles/${immeuble.id}/modifier`} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-navy">
                {t("common.edit")}
              </link_1.default>) : null}
            {!estCoproprietaire && immeuble.statut === "actif" ? (<button type="button" onClick={() => setAArchiver(true)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-navy">
                {t("common.archive")}
              </button>) : null}
          </div>
        </div>

        {/* Correctif 2026-11-08 (capture du fondateur, Kaneza Home) :
            les montants des tuiles débordaient (« 300 000 000 BIF »
            sortait de la tuile « Valeur du bien »). Un montant formaté
            est un jeton INSECABLE (séparateurs U+202F, espace U+00A0
            avant la devise) : à text-xl il mesure ~146 px pour ~107 px
            utiles dans une tuile mobile. Traitement : grille en
            minmax(0,1fr) (grid-cols-*), passage en 3 colonnes à lg
            seulement (à md, sidebar + 3 colonnes laissaient ~91 px
            utiles), tuiles p-3 sur mobile, montants en whitespace-nowrap
            avec taille par paliers (13 px mobile -> text-xl bureau).
            Format d'affichage inchangé : montant complet, jamais
            abrégé. Même patron que les KPI (correctif 2026-11-08
            précédent) et les autres tuiles statistiques de l'app. */}
        <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3 sm:p-4">
            <dt className="text-sm text-slate-500">{t("buildings.statsApartments")}</dt>
            <dd className="whitespace-nowrap text-[13px] font-bold text-navy min-[420px]:text-sm sm:text-base md:text-lg lg:text-xl">{stats?.nbAppartements ?? 0}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 sm:p-4">
            <dt className="text-sm text-slate-500">{t("buildings.statsOccupancy")}</dt>
            <dd className="whitespace-nowrap text-[13px] font-bold text-navy min-[420px]:text-sm sm:text-base md:text-lg lg:text-xl">
              {stats?.occupation !== null && stats?.occupation !== undefined ? (0, format_1.formatPct)(stats.occupation, locale) : "—"}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 sm:p-4">
            <dt className="text-sm text-slate-500">{t("buildings.statsMonthlyRent")}</dt>
            <dd className="whitespace-nowrap text-[13px] font-bold text-navy min-[420px]:text-sm sm:text-base md:text-lg lg:text-xl">{(0, format_1.formatMoney)(stats?.loyersMois ?? 0, immeuble.devise, locale)}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 sm:p-4">
            <dt className="text-sm text-slate-500">{t("buildings.statsValue")}</dt>
            <dd className="whitespace-nowrap text-[13px] font-bold text-navy min-[420px]:text-sm sm:text-base md:text-lg lg:text-xl">
              {immeuble.valeur_bien ? (0, format_1.formatMoney)(immeuble.valeur_bien, immeuble.devise_valeur ?? immeuble.devise, locale) : t("common.notProvided")}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 sm:p-4">
            <dt className="text-sm text-slate-500">{t("passport.roiLabel")}</dt>
            <dd className="whitespace-nowrap text-[13px] font-bold text-navy min-[420px]:text-sm sm:text-base md:text-lg lg:text-xl">
              {stats?.roi !== null && stats?.roi !== undefined ? (0, format_1.formatPct)(stats.roi, locale) : t("buildings.roiMissing")}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 sm:p-4">
            <dt className="text-sm text-slate-500">{t("passport.marginLabel")}</dt>
            <dd className="whitespace-nowrap text-[13px] font-bold text-navy min-[420px]:text-sm sm:text-base md:text-lg lg:text-xl">
              {stats?.marge !== null && stats?.marge !== undefined ? (0, format_1.formatPct)(stats.marge, locale) : "—"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Appartements */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-navy">{t("buildings.detailApartments")}</h2>
          {!estCoproprietaire ? (<div className="flex gap-2">
              <link_1.default href={`/${locale}/appartements/nouveau?immeuble=${immeuble.id}`} className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy hover:bg-gold-light">
                {t("apartments.add")}
              </link_1.default>
              <link_1.default href={`/${locale}/appartements/nouveau?immeuble=${immeuble.id}&lot=1`} className="rounded-full border border-navy px-4 py-2 text-sm font-bold text-navy">
                {t("apartments.addBulk")}
              </link_1.default>
            </div>) : null}
        </div>
        {appartements.length === 0 ? (<p className="mt-4 text-slate-600">
            {t("buildings.noApartments")} {t("buildings.noApartmentsHint")}
          </p>) : (<ul className="mt-4 space-y-2">
            {appartements.map((a) => (<li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <link_1.default href={`/${locale}/appartements/${a.id}`} className="font-bold text-navy underline">
                    {a.numero} · {a.type}
                  </link_1.default>
                  <p className="text-sm text-slate-600">
                    {(0, format_1.formatMoney)(a.loyer_defaut, a.devise, locale)} — {t(`apartments.${a.statut === "occupe" ? "statusOccupied" : a.statut === "vacant" ? "statusVacant" : a.statut === "travaux" ? "statusWorks" : "statusReserved"}`)}
                    {nomLocataire(a.id) ? ` · ${nomLocataire(a.id)}` : ""}
                    {a.archive ? ` · ${t("common.archived")}` : ""}
                  </p>
                </div>
                <link_1.default href={`/${locale}/appartements/${a.id}`} className="text-sm font-semibold text-navy underline">
                  {t("common.view")}
                </link_1.default>
              </li>))}
          </ul>)}
      </section>

      {/* Dépenses */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-navy">{t("buildings.detailExpenses")}</h2>
        {depenses.length === 0 ? (<p className="mt-2 text-slate-600">{t("expenses.empty")}</p>) : (<ul className="mt-4 space-y-2">
            {depenses.map((d) => (<li key={d.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                <span>{(0, format_1.formatDate)(d.date, locale)} — {d.libelle} ({d.categorie})</span>
                <span className="font-bold text-navy">{(0, format_1.formatMoney)(d.montant, d.devise, locale)}</span>
              </li>))}
          </ul>)}
      </section>

      {/* Documents (module 4 : vrais documents, stockage privé) */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-navy">{t("buildings.detailDocuments")}</h2>
        <DocumentList_1.default documents={documents} onChange={charger}/>
        <link_1.default href="/documents" className="mt-3 inline-block text-sm font-semibold text-navy underline">
          {t("buildings.detailDocumentsAll")}
        </link_1.default>
      </section>

      {/* Passeport du bien (spec §6 suite) — complet : identité, acquisition,
            valeur (+ date d'estimation, ROI), travaux (avec justificatifs),
            historique complet (baux, paiements, alertes, fil), documents. */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-navy">{t("passport.title")}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <h3 className="font-semibold text-navy">{t("passport.identity")}</h3>
            <p className="mt-1 text-sm text-slate-700">
              {immeuble.nom}<br />{immeuble.adresse}, {immeuble.ville} — {immeuble.pays}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {t("passport.statusLabel")} : {immeuble.statut === "actif" ? t("common.active") : t("common.archived")}
            </p>
            {/* v1.7 : galerie du passeport — toutes les photos du bien,
            la première porte le badge « Principale ». */}
            {(immeuble.photos_urls.filter(Boolean).length > 0 || immeuble.photo_url) ? (<div className="mt-2">
                <p className="text-sm font-semibold text-navy">{t("passport.photos")}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {(immeuble.photos_urls.filter(Boolean).length > 0
                ? immeuble.photos_urls.filter(Boolean)
                : [immeuble.photo_url]).map((url, idx) => (<li key={idx} className="relative">
                      <a href={url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-20 w-24 rounded-lg object-cover"/>
                      </a>
                      {idx === 0 ? (<span className="absolute left-1 top-1 rounded-full bg-navy px-2 py-0.5 text-[11px] font-bold text-white">
                          {t17("photoMain")}
                        </span>) : null}
                    </li>))}
                </ul>
              </div>) : (<p className="mt-1 text-sm text-slate-600">{t("passport.noPhotos")}</p>)}
            <p className="mt-2 text-sm font-semibold text-navy">{t("passport.attachedApartments")} : {appartements.length}</p>
            <ul className="mt-1 space-y-1 text-sm text-slate-700">
              {appartements.map((a) => (<li key={a.id}>
                  <link_1.default href={`/${locale}/appartements/${a.id}`} className="font-semibold text-navy underline">
                    {a.numero} · {a.type}
                  </link_1.default>
                  {" — "}{(0, format_1.formatMoney)(a.loyer_defaut, a.devise, locale)}
                </li>))}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-navy">{t("passport.acquisition")}</h3>
            <p className="mt-1 text-sm text-slate-700">
              {t("passport.acquisitionDate")} : {(0, format_1.formatDate)(immeuble.date_acquisition, locale)}<br />
              {t("passport.acquisitionPrice")} : {immeuble.prix_acquisition !== null ? (0, format_1.formatMoney)(immeuble.prix_acquisition, immeuble.devise_valeur ?? immeuble.devise, locale) : t("common.notProvided")}<br />
              {t("passport.acquisitionMode")} : {libelleModeAcquisition(immeuble.mode_acquisition)}
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-navy">{t("passport.value")}</h3>
            <p className="mt-1 text-sm text-slate-700">
              {t("passport.valueLabel")} : {immeuble.valeur_bien ? (0, format_1.formatMoney)(immeuble.valeur_bien, immeuble.devise_valeur ?? immeuble.devise, locale) : t("buildings.roiMissing")}<br />
              {t("passport.estimationDate")} : {(0, format_1.formatDate)(immeuble.date_estimation, locale)}<br />
              {t("passport.roiLabel")} : {stats?.roi !== null && stats?.roi !== undefined ? (0, format_1.formatPct)(stats.roi, locale) : "—"}
            </p>
          </div>
        </div>
        <h3 className="mt-6 font-semibold text-navy">{t("passport.works")}</h3>
        {depenses.filter((d) => d.categorie === "reparation" || d.categorie === "entretien").length === 0 ? (<p className="mt-1 text-sm text-slate-600">{t("passport.noWorks")}</p>) : (<ul className="mt-2 space-y-1 text-sm text-slate-700">
            {depenses.filter((d) => d.categorie === "reparation" || d.categorie === "entretien").map((d) => (<li key={d.id}>
                {(0, format_1.formatDate)(d.date, locale)} — {d.libelle} : {(0, format_1.formatMoney)(d.montant, d.devise, locale)}
                {d.justificatif_url ? (<>
                    {" · "}
                    <a href={d.justificatif_url} target="_blank" rel="noreferrer" className="font-semibold text-navy underline">{t("passport.worksReceipt")}</a>
                  </>) : null}
              </li>))}
          </ul>)}
        <h3 className="mt-6 font-semibold text-navy">{t("passport.history")}</h3>
        <h4 className="mt-3 text-sm font-bold text-navy">{t("passport.historyLeases")}</h4>
        {bauxImmeuble.length === 0 ? (<p className="mt-1 text-sm text-slate-600">{t("leases.noHistory")}</p>) : (<ul className="mt-2 space-y-1 text-sm text-slate-700">
            {bauxImmeuble.map((b) => {
                const loc = locataires.find((l) => l.id === b.locataire_id);
                const apt = appartements.find((a) => a.id === b.appartement_id);
                return (<li key={b.id}>
                  {apt?.numero ?? "—"} — {loc?.nom ?? "—"} : {(0, format_1.formatDate)(b.debut, locale)} → {b.fin ? (0, format_1.formatDate)(b.fin, locale) : "—"} · {(0, format_1.formatMoney)(b.loyer_mensuel, b.devise, locale)} · {b.statut === "actif" ? t("leases.active") : t("leases.ended")}
                </li>);
            })}
          </ul>)}
        <h4 className="mt-3 text-sm font-bold text-navy">{t("passport.historyPayments")}</h4>
        {paiementsImmeuble.length === 0 ? (<p className="mt-1 text-sm text-slate-600">{t("rents.empty")}</p>) : (<ul className="mt-2 space-y-1 text-sm text-slate-700">
            {paiementsImmeuble.slice(0, 20).map((p) => (<li key={p.id}>
                {(0, format_1.formatDate)(p.date_paiement, locale)} — {(0, format_1.formatMoney)(p.montant, p.devise, locale)} · {p.recu_numero ?? ""}
              </li>))}
          </ul>)}
        <h4 className="mt-3 text-sm font-bold text-navy">{t("passport.historyAlerts")}</h4>
        {alertesImmeuble.length === 0 && activites.length === 0 ? (<p className="mt-1 text-sm text-slate-600">{t("passport.noHistory")}</p>) : (<ul className="mt-2 space-y-1 text-sm text-slate-700">
            {alertesImmeuble.map((a) => (<li key={a.id}>{(0, format_1.formatDate)(a.created_at, locale)} — {a.message}</li>))}
            {activites.slice(0, 20).map((a) => (<li key={a.id}>{(0, format_1.formatDate)(a.created_at, locale)} — {a.description}</li>))}
          </ul>)}
        <h3 className="mt-6 font-semibold text-navy">{t("passport.documentsInPassport")}</h3>
        {documents.length === 0 ? (<p className="mt-1 text-sm text-slate-600">{t("passport.noDocuments")}</p>) : (<ul className="mt-2 space-y-1 text-sm text-slate-700">
            {documents.map((d) => (<li key={d.id}>{d.nom_fichier} ({d.type}) — {(0, format_1.formatDate)(d.created_at, locale)}</li>))}
          </ul>)}
      </section>

      {/* Indivision familiale (spec §6 suite) */}
      <IndivisionSection_1.default immeuble={immeuble}/>

      {aArchiver ? (<ConfirmDialog_1.default title={t("common.confirmArchive", { name: immeuble.nom })} text={t("common.confirmArchiveText")} confirmLabel={t("common.archive")} cancelLabel={t("common.cancel")} danger={false} onConfirm={archiver} onCancel={() => setAArchiver(false)}/>) : null}
    </AppShell_1.default>);
}

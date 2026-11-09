"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ParametresPage;
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const next_intl_1 = require("next-intl");
const navigation_1 = require("next/navigation");
const AppShell_1 = __importDefault(require("@/components/AppShell"));
const SuppressionCompteDialog_1 = __importDefault(require("@/components/SuppressionCompteDialog"));
const Field_1 = __importDefault(require("@/components/Field"));
const RattachementDisplayId_1 = __importDefault(require("@/components/RattachementDisplayId"));
const format_1 = require("@/lib/format");
const data_1 = require("@/lib/data");
const taux_1 = require("@/lib/taux");
const data_2 = require("@/lib/data");
const translateError_1 = require("@/lib/translateError");
const TYPES_ALERTE = [
    "loyer_en_retard",
    "fin_de_bail",
    "vacance_prolongee",
    "bail_demarrant",
    "essai_abonnement",
];
function ParametresPage() {
    const t = (0, next_intl_1.useTranslations)("crud");
    const ts = (0, next_intl_1.useTranslations)("settings");
    const tsub = (0, next_intl_1.useTranslations)("subscription");
    const tp = (0, next_intl_1.useTranslations)("pages");
    const tc = (0, next_intl_1.useTranslations)("crud.common");
    const td = (0, next_intl_1.useTranslations)("dossier");
    const t15 = (0, next_intl_1.useTranslations)("v15");
    const locale = (0, next_intl_1.useLocale)();
    const router = (0, navigation_1.useRouter)();
    const [profil, setProfil] = (0, react_1.useState)(null);
    const [grilleCompte, setGrilleCompte] = (0, react_1.useState)(null);
    const [immeubles, setImmeubles] = (0, react_1.useState)([]);
    const [taux, setTaux] = (0, react_1.useState)([]);
    const [prefs, setPrefs] = (0, react_1.useState)(null);
    const [gestionnaires, setGestionnaires] = (0, react_1.useState)([]);
    const [coproprietaires, setCoproprietaires] = (0, react_1.useState)([]);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const [message, setMessage] = (0, react_1.useState)(null);
    // Correctif 2026-11-07 : suppression de compte par le client (v1.5) —
    // point d'entrée standard ICI, dans les paramètres (elle n'existait
    // qu'en bas de la page Abonnement, introuvable pour le fondateur).
    const [aConfirmerSuppression, setAConfirmerSuppression] = (0, react_1.useState)(false);
    const [nom, setNom] = (0, react_1.useState)("");
    const [pays, setPays] = (0, react_1.useState)("");
    const [telephone, setTelephone] = (0, react_1.useState)("");
    const [langue, setLangue] = (0, react_1.useState)("fr");
    const [devise, setDevise] = (0, react_1.useState)("USD");
    const [tauxSource, setTauxSource] = (0, react_1.useState)("USD");
    const [tauxCible, setTauxCible] = (0, react_1.useState)("BIF");
    const [tauxValeur, setTauxValeur] = (0, react_1.useState)("");
    const [tauxDate, setTauxDate] = (0, react_1.useState)(new Date().toISOString().slice(0, 10));
    const [erreurTaux, setErreurTaux] = (0, react_1.useState)(null);
    const [emailInvite, setEmailInvite] = (0, react_1.useState)("");
    const [immeublesInvites, setImmeublesInvites] = (0, react_1.useState)([]);
    const [erreurInvite, setErreurInvite] = (0, react_1.useState)(null);
    const [seuilVacance, setSeuilVacance] = (0, react_1.useState)("30");
    const [actualisationTaux, setActualisationTaux] = (0, react_1.useState)(false);
    const [messageTaux, setMessageTaux] = (0, react_1.useState)(null);
    const [erreurActualisationTaux, setErreurActualisationTaux] = (0, react_1.useState)(null);
    /** v1.5 : codes du namespace dédié, sinon repli générique traduit. */
    function gererErreurSuppression(e) {
        const code = e instanceof Error ? e.message : "";
        if (code === "ERR_SUPPRESSION_DEJA_DEMANDEE" ||
            code === "ERR_AUCUNE_SUPPRESSION" ||
            code === "ERR_DELAI_NON_ECOULE" ||
            code === "ERR_SUPER_ADMIN_REQUIS" ||
            code === "ERR_ADMIN_INTROUVABLE" ||
            code === "ERR_MOT_DE_PASSE_INCORRECT") {
            setErreur(t15(`errors.${code}`));
        }
        else {
            setErreur((0, translateError_1.messageErreur)(t, e));
        }
    }
    /**
     * Succès du dialogue de suppression (mot de passe vérifié par le
     * provider AVANT la RPC — renfort fondateur 2026-11-07) : le
     * dialogue se ferme et la page reflète la demande posée.
     */
    function succesSuppression(maj) {
        setAConfirmerSuppression(false);
        setProfil(maj);
        setMessage(t15("deletionRequestedMsg"));
        setErreur(null);
    }
    /** Erreur non « mot de passe » du dialogue : fermé + message page. */
    function erreurSuppression(e) {
        setAConfirmerSuppression(false);
        gererErreurSuppression(e);
    }
    async function annulerSuppression() {
        try {
            const maj = await (0, data_1.getDataProvider)().annulerSuppressionCompte();
            setProfil(maj);
            setMessage(t15("deletionCancelledMsg"));
            setErreur(null);
        }
        catch (e) {
            gererErreurSuppression(e);
        }
    }
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
            const [prof, ims, tx, pr, gest] = await Promise.all([
                p.getProfil(),
                p.listerImmeubles(true),
                p.listerTaux(),
                p.getPreferencesNotifications(),
                p.listerGestionnaires(),
            ]);
            setProfil(prof);
            if (prof) {
                setNom(prof.nom);
                setPays(prof.pays ?? "");
                setTelephone(prof.telephone ?? "");
                setLangue(prof.langue);
                setDevise(prof.devise_principale);
            }
            setImmeubles(ims);
            setTaux(tx);
            // Grille tarifaire du compte (v1.2, lecture seule ici) : elle est
            // VERROUILLÉE à l'inscription — seul le support peut la corriger.
            p.getAbonnement()
                .then((abo) => setGrilleCompte(abo?.grille ?? prof?.grille_attribuee ?? null))
                .catch(() => setGrilleCompte(prof?.grille_attribuee ?? null));
            setPrefs(pr);
            setSeuilVacance(String(pr.seuil_vacance_jours));
            setGestionnaires(gest);
            // Co-propriétaires d'indivision (module 6) : tous immeubles confondus.
            const parImmeuble = await Promise.all(ims.map(async (im) => ({
                im,
                copros: await p.listerCoproprietaires(im.id),
            })));
            setCoproprietaires(parImmeuble.flatMap(({ im, copros }) => copros.map((cop) => ({ cop, immeubleNom: im.nom }))));
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
    async function sauverProfil(e) {
        e.preventDefault();
        setErreur(null);
        try {
            const p = (0, data_1.getDataProvider)();
            const maj = await p.modifierProfil({
                nom: nom.trim(),
                pays: pays.trim() || null,
                telephone: telephone.trim() || null,
                langue: langue,
                devise_principale: devise,
            });
            setProfil(maj);
            setMessage(ts("profileSaved"));
            // Langue : effet immédiat sur toute l'interface.
            if (langue !== locale) {
                router.push(`/${langue}/parametres`);
                router.refresh();
            }
        }
        catch (err) {
            setErreur((0, translateError_1.messageErreur)(t, err));
        }
    }
    async function ajouterTauxManuel(e) {
        e.preventDefault();
        setErreurTaux(null);
        try {
            const cree = await (0, data_1.getDataProvider)().saisirTauxManuel({
                devise_source: tauxSource,
                devise_cible: tauxCible,
                taux: Number(tauxValeur),
                date_taux: tauxDate,
            });
            setTaux((anciens) => [cree, ...anciens]);
            setTauxValeur("");
            setMessage(ts("rateSaved"));
        }
        catch (err) {
            setErreurTaux((0, translateError_1.messageErreur)(t, err));
        }
    }
    /**
     * Actualisation des taux automatiques (module 6, spec §9) : paresseuse —
     * l'appel externe n'est refait que si les taux auto stockés datent de
     * plus de ~24 h. En mode démo, la route retourne les taux et c'est le
     * fournisseur qui les enregistre (localStorage) ; en mode réel, la
     * route les enregistre elle-même dans taux_change.
     */
    async function actualiserTaux() {
        setMessageTaux(null);
        setErreurActualisationTaux(null);
        setActualisationTaux(true);
        try {
            const p = (0, data_1.getDataProvider)();
            const tauxActuels = await p.listerTaux();
            if (!(0, taux_1.doitActualiserTaux)(tauxActuels)) {
                const dernier = (0, taux_1.dernierTauxAuto)(tauxActuels);
                setMessageTaux(ts("ratesAlreadyFresh", {
                    date: dernier ? (0, format_1.formatDate)(dernier.date_taux.slice(0, 10), locale) : "—",
                }));
                return;
            }
            const reponse = await fetch("/api/taux/actualiser", { method: "POST" });
            const corps = (await reponse.json());
            if (!reponse.ok) {
                throw new Error(corps.detail ?? corps.error ?? "erreur");
            }
            if (corps.actualise === false) {
                setMessageTaux(ts("ratesAlreadyFresh", {
                    date: corps.date_taux ? (0, format_1.formatDate)(corps.date_taux.slice(0, 10), locale) : "—",
                }));
                return;
            }
            if (!corps.enregistres && Array.isArray(corps.taux)) {
                await p.enregistrerTauxAuto(corps.taux.map((l) => ({
                    devise_source: l.devise_source,
                    devise_cible: l.devise_cible,
                    taux: l.taux,
                    date_taux: l.date_taux,
                    source: l.source,
                })));
            }
            setTaux(await p.listerTaux());
            setMessageTaux(ts("ratesRefreshed", {
                date: corps.date_taux ? (0, format_1.formatDate)(corps.date_taux.slice(0, 10), locale) : "—",
            }));
        }
        catch (e) {
            setErreurActualisationTaux(ts("ratesRefreshFailed", {
                detail: e instanceof Error ? e.message : "erreur",
            }));
        }
        finally {
            setActualisationTaux(false);
        }
    }
    async function retirerCoproprietaire(id) {
        setErreur(null);
        try {
            await (0, data_1.getDataProvider)().retirerCoproprietaire(id);
            setCoproprietaires((anciens) => anciens.filter((x) => x.cop.id !== id));
            setMessage(ts("coOwnerRemoved"));
        }
        catch (err) {
            setErreur((0, translateError_1.messageErreur)(t, err));
        }
    }
    async function inviter(e) {
        e.preventDefault();
        setErreurInvite(null);
        try {
            const invite = await (0, data_1.getDataProvider)().inviterGestionnaire(emailInvite.trim(), immeublesInvites);
            setGestionnaires((anciens) => [...anciens, invite]);
            setEmailInvite("");
            setImmeublesInvites([]);
            setMessage(ts("managerInvited"));
        }
        catch (err) {
            setErreurInvite((0, translateError_1.messageErreur)(t, err));
        }
    }
    async function retirer(id) {
        try {
            await (0, data_1.getDataProvider)().retirerGestionnaire(id);
            setGestionnaires((anciens) => anciens.filter((g) => g.id !== id));
            setMessage(ts("managerRemoved"));
        }
        catch (err) {
            setErreur((0, translateError_1.messageErreur)(t, err));
        }
    }
    async function basculerTypeAlerte(type, coupe) {
        if (!prefs)
            return;
        const types = coupe
            ? Array.from(new Set([...prefs.types_coupes, type]))
            : prefs.types_coupes.filter((x) => x !== type);
        const maj = await (0, data_1.getDataProvider)().sauvegarderPreferencesNotifications({ types_coupes: types });
        setPrefs(maj);
    }
    async function basculerCanal(canal, valeur) {
        if (!prefs)
            return;
        const maj = await (0, data_1.getDataProvider)().sauvegarderPreferencesNotifications({ [canal]: valeur });
        setPrefs(maj);
    }
    async function sauverSeuil() {
        if (!prefs)
            return;
        const maj = await (0, data_1.getDataProvider)().sauvegarderPreferencesNotifications({
            seuil_vacance_jours: Number(seuilVacance),
        });
        setPrefs(maj);
        setMessage(ts("prefsSaved"));
    }
    const nomImmeuble = (id) => immeubles.find((i) => i.id === id)?.nom ?? id.slice(0, 8);
    return (<AppShell_1.default title={tp("settings.title")}>
      {message ? (<p role="status" className="mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-800">
          {message}
        </p>) : null}
      {erreur ? (<div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {erreur}
          <button type="button" onClick={charger} className="ml-3 font-bold underline">
            {tc("retry")}
          </button>
        </div>) : null}

      {chargement ? (<div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (<div key={i} className="h-24 animate-pulse rounded-2xl bg-white shadow-sm"/>))}
          <p className="text-sm text-slate-500">{tc("loading")}</p>
        </div>) : (<>
          {/* Profil */}
          <section aria-labelledby="profil-titre" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 id="profil-titre" className="text-lg font-semibold text-navy">{ts("profileTitle")}</h2>
            <form onSubmit={sauverProfil} noValidate className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field_1.default id="profil-nom" label={ts("name")} value={nom} onChange={setNom} required/>
                <Field_1.default id="profil-pays" label={ts("country")} value={pays} onChange={setPays}/>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field_1.default id="profil-tel" label={ts("phone")} value={telephone} onChange={setTelephone} placeholder="+257 79 12 34 56"/>
                <Field_1.default id="profil-email" label={ts("email")} value={profil?.email ?? ""} onChange={() => undefined}/>
              </div>
              <p className="text-sm text-slate-500">{ts("emailReadOnly")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field_1.default id="profil-langue" label={ts("language")} value={langue} onChange={setLangue}>
                  <option value="fr">Français</option>
                  <option value="en">English</option>
                </Field_1.default>
                <Field_1.default id="profil-devise" label={ts("mainCurrency")} value={devise} onChange={(v) => setDevise(v)}>
                  {data_2.DEVISES.map((d) => (<option key={d} value={d}>{d}</option>))}
                </Field_1.default>
              </div>
              <button type="submit" className="rounded-full bg-gold px-6 py-3 text-base font-bold text-navy hover:bg-gold-light">
                {tc("save")}
              </button>
            </form>
          </section>

          {/* Grille tarifaire du compte (v1.2 — anti-fraude, lecture seule) */}
          {grilleCompte ? (<section aria-labelledby="grille-titre" className="mt-6 rounded-2xl border border-gold/50 bg-gold/10 p-6 shadow-sm">
              <h2 id="grille-titre" className="text-lg font-semibold text-navy">{ts("pricingGridTitle")}</h2>
              <p className="mt-2 text-base font-semibold text-navy">
                {ts("pricingGridCurrent", {
                    grid: grilleCompte === "afrique" ? tsub("gridAfrique") : tsub("gridInternationale"),
                })}
              </p>
              <p className="mt-1 text-sm text-slate-600">{ts("pricingGridInfo")}</p>
            </section>) : null}

          {/* Taux de change manuels + automatiques (module 6, spec §9) */}
          <section aria-labelledby="taux-titre" className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 id="taux-titre" className="text-lg font-semibold text-navy">{ts("ratesTitle")}</h2>
            <p className="mt-2 text-sm text-slate-600">{ts("ratesText")}</p>
            {taux.length > 0 ? (<p className="mt-2 text-sm font-semibold text-navy">
                {ts("lastRate", { date: (0, format_1.formatDate)(taux[0].date_taux.slice(0, 10), locale), source: taux[0].source === "manuel" ? ts("manual") : ts("auto") })}
              </p>) : (<p className="mt-2 text-sm text-slate-600">{ts("noRate")}</p>)}
            <p className="mt-2 text-sm text-slate-600">
              {ts("ratesAutoDate", {
                date: (() => {
                    const dernier = (0, taux_1.dernierTauxAuto)(taux);
                    return dernier ? (0, format_1.formatDate)(dernier.date_taux.slice(0, 10), locale) : "—";
                })(),
            })}
            </p>
            <div className="mt-3">
              <button type="button" onClick={actualiserTaux} disabled={actualisationTaux} className="rounded-full border border-navy bg-white px-6 py-3 text-base font-semibold text-navy hover:bg-navy/5 disabled:opacity-50">
                {actualisationTaux ? ts("refreshingRates") : ts("refreshRates")}
              </button>
            </div>
            {messageTaux ? (<p role="status" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">{messageTaux}</p>) : null}
            {erreurActualisationTaux ? (<p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{erreurActualisationTaux}</p>) : null}
            <form onSubmit={ajouterTauxManuel} noValidate className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field_1.default id="taux-source" label={ts("rateFrom")} value={tauxSource} onChange={(v) => setTauxSource(v)}>
                {data_2.DEVISES.map((d) => (<option key={d} value={d}>{d}</option>))}
              </Field_1.default>
              <Field_1.default id="taux-cible" label={ts("rateTo")} value={tauxCible} onChange={(v) => setTauxCible(v)}>
                {data_2.DEVISES.map((d) => (<option key={d} value={d}>{d}</option>))}
              </Field_1.default>
              <Field_1.default id="taux-valeur" label={ts("rateValue")} type="number" value={tauxValeur} onChange={setTauxValeur} required/>
              <Field_1.default id="taux-date" label={ts("rateDate")} type="date" value={tauxDate} onChange={setTauxDate} required/>
              <div className="sm:col-span-2 lg:col-span-4">
                <button type="submit" className="rounded-full border border-navy bg-white px-6 py-3 text-base font-semibold text-navy hover:bg-navy/5">
                  {ts("addRate")}
                </button>
              </div>
            </form>
            {erreurTaux ? (<p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{erreurTaux}</p>) : null}
            {taux.length > 0 ? (<ul className="mt-4 divide-y divide-slate-100 text-sm">
                {taux.slice(0, 10).map((tx) => (<li key={tx.id} className="flex justify-between gap-2 py-2">
                    <span className="min-w-0 break-words">{tx.devise_source} → {tx.devise_cible} : <strong>{tx.taux}</strong></span>
                    <span className="shrink-0 text-right text-slate-600">
                      {(0, format_1.formatDate)(tx.date_taux.slice(0, 10), locale)} · {tx.source === "manuel" ? ts("manual") : ts("auto")}
                    </span>
                  </li>))}
              </ul>) : null}
          </section>

          {/* Gestionnaires */}
          <section aria-labelledby="gest-titre" className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 id="gest-titre" className="text-lg font-semibold text-navy">{ts("managersTitle")}</h2>
            <p className="mt-2 text-sm text-slate-600">{ts("managersText")}</p>
            {gestionnaires.length === 0 ? (<p className="mt-3 text-sm text-slate-600">{ts("noManager")}</p>) : (<ul className="mt-3 divide-y divide-slate-100">
                {gestionnaires.map((g) => (<li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <p className="break-all font-semibold text-navy">{g.email}</p>
                      <p className="break-words text-sm text-slate-600">{g.immeuble_ids.map(nomImmeuble).join(", ")}</p>
                    </div>
                    <button type="button" onClick={() => retirer(g.id)} className="shrink-0 rounded-full border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700">
                      {ts("removeManager")}
                    </button>
                  </li>))}
              </ul>)}
            <form onSubmit={inviter} noValidate className="mt-4 space-y-3">
              <Field_1.default id="invite-email" label={ts("inviteEmail")} type="email" value={emailInvite} onChange={setEmailInvite} required/>
              <fieldset>
                <legend className="text-sm font-semibold text-slate-900">{ts("inviteBuildings")}</legend>
                <div className="mt-2 flex flex-wrap gap-3">
                  {immeubles.filter((i) => i.statut === "actif").map((i) => (<label key={i.id} className="flex items-center gap-2 text-base text-slate-900">
                      <input type="checkbox" checked={immeublesInvites.includes(i.id)} onChange={(e) => setImmeublesInvites((anciens) => e.target.checked ? [...anciens, i.id] : anciens.filter((x) => x !== i.id))} className="h-5 w-5 shrink-0 accent-[#1B2A4A]"/>
                      {i.nom}
                    </label>))}
                </div>
              </fieldset>
              {erreurInvite ? (<p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{erreurInvite}</p>) : null}
              <button type="submit" className="rounded-full border border-navy bg-white px-6 py-3 text-base font-semibold text-navy hover:bg-navy/5">
                {ts("inviteManager")}
              </button>
            </form>
          </section>

          {/* Rattachement par Display ID (v1.3) : triple validation. */}
          <section aria-labelledby="rattach-titre" className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 id="rattach-titre" className="text-lg font-semibold text-navy">{td("linkTitle")}</h2>
            <p className="mt-2 text-sm text-slate-600">{td("linkText")}</p>
            <div className="mt-4">
              <RattachementDisplayId_1.default />
            </div>
          </section>

          {/* Co-propriétaires d'indivision (module 6, spec §6 suite) */}
          <section aria-labelledby="coprop-titre" className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 id="coprop-titre" className="text-lg font-semibold text-navy">{ts("coOwnersTitle")}</h2>
            <p className="mt-2 text-sm text-slate-600">{ts("coOwnersText")}</p>
            {coproprietaires.length === 0 ? (<p className="mt-2 text-sm text-slate-600">{ts("noCoOwner")}</p>) : (<ul className="mt-4 space-y-3">
                {coproprietaires.map(({ cop, immeubleNom }) => (<li key={cop.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3">
                    <div className="min-w-0">
                      <p className="break-words font-bold text-navy">{cop.nom} — {cop.part} %</p>
                      <p className="break-all text-sm text-slate-600">{cop.email} · {immeubleNom}</p>
                    </div>
                    <button type="button" onClick={() => retirerCoproprietaire(cop.id)} className="shrink-0 rounded-full border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700">
                      {ts("removeCoOwner")}
                    </button>
                  </li>))}
              </ul>)}
          </section>

          {/* Préférences de notifications */}
          <section aria-labelledby="notif-titre" className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 id="notif-titre" className="text-lg font-semibold text-navy">{ts("notificationsTitle")}</h2>
            <p className="mt-2 text-sm text-slate-600">{ts("notificationsText")}</p>
            {prefs ? (<div className="mt-4 space-y-3">
                {TYPES_ALERTE.map((type) => {
                    const coupe = prefs.types_coupes.includes(type);
                    const verrouille = type === "essai_abonnement";
                    return (<label key={type} className="flex items-center gap-2 text-base text-slate-900">
                      <input type="checkbox" checked={!coupe} disabled={verrouille} onChange={(e) => basculerTypeAlerte(type, !e.target.checked)} className="h-5 w-5 shrink-0 accent-[#1B2A4A] disabled:opacity-40"/>
                      {ts(`alertTypes.${type}`)}
                      {verrouille ? <span className="text-sm text-slate-500">({ts("cannotDisableSubscription")})</span> : null}
                    </label>);
                })}
                <div className="grid gap-3 pt-2 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-base text-slate-900">
                    <input type="checkbox" checked={prefs.canal_app} onChange={(e) => basculerCanal("canal_app", e.target.checked)} className="h-5 w-5 shrink-0 accent-[#1B2A4A]"/>
                    {ts("channelApp")}
                  </label>
                  <label className="flex items-center gap-2 text-base text-slate-900">
                    <input type="checkbox" checked={prefs.canal_email} onChange={(e) => basculerCanal("canal_email", e.target.checked)} className="h-5 w-5 shrink-0 accent-[#1B2A4A]"/>
                    {ts("channelEmail")}
                  </label>
                  <label className="flex items-center gap-2 text-base text-slate-900">
                    <input type="checkbox" checked={prefs.canal_whatsapp} onChange={(e) => basculerCanal("canal_whatsapp", e.target.checked)} className="h-5 w-5 shrink-0 accent-[#1B2A4A]"/>
                    {ts("channelWhatsApp")}
                  </label>
                </div>
                <div className="flex flex-wrap items-end gap-3 pt-2">
                  <Field_1.default id="seuil-vacance" label={ts("vacancyThreshold")} type="number" value={seuilVacance} onChange={setSeuilVacance}/>
                  <button type="button" onClick={sauverSeuil} className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-navy hover:border-gold">
                    {tc("save")}
                  </button>
                </div>
                <p className="text-sm text-slate-600">{ts("whatsappNote")}</p>
              </div>) : null}
          </section>

          {/* Sécurité */}
          <section id="securite" aria-labelledby="securite-titre" className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 id="securite-titre" className="text-lg font-semibold text-navy">{ts("securityTitle")}</h2>
            <p className="mt-2 text-base text-slate-600">{ts("securityText")}</p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-base text-slate-700">{ts("twoFaText")}</p>
              <span className="shrink-0 rounded-full bg-gold/20 px-3 py-1 text-sm font-bold text-navy-dark">{ts("twoFaSoon")}</span>
            </div>
            <link_1.default href="/mot-de-passe-oublie" className="mt-4 inline-block text-base font-semibold text-navy underline">
              {ts("changePassword")}
            </link_1.default>
          </section>

          {/* Suppression du compte (v1.5) — correctif 2026-11-07 :
                point d'entrée standard dans les paramètres, pour le
                propriétaire ET le gestionnaire. Même mécanique que la
                section de la page Abonnement : la RPC base pose la
                demande, le compte passe en lecture seule immédiate,
                rétractation possible pendant 30 jours, exécution par
                le Super Admin après le délai. */}
          <section aria-labelledby="suppression-titre" className="mt-6 rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
            <h2 id="suppression-titre" className="text-lg font-bold text-red-800">{t15("deletionTitle")}</h2>
            {profil?.suppression_demandee_le ? (<div className="mt-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3">
                <p className="text-base font-bold text-red-800">{t15("deletionPendingTitle")}</p>
                <p className="mt-1 text-sm text-red-700">
                  {t15("deletionScheduled", {
                    date: (0, format_1.formatDate)(new Date(new Date(profil.suppression_demandee_le).getTime() +
                        30 * 24 * 60 * 60 * 1000).toISOString(), locale),
                })}
                </p>
                <button type="button" onClick={annulerSuppression} className="mt-3 rounded-full border border-navy bg-white px-5 py-2.5 text-base font-semibold text-navy hover:bg-navy/5">
                  {t15("cancelDeletionButton")}
                </button>
              </div>) : (<>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {t15("deletionText")}
                </p>
                <button type="button" onClick={() => setAConfirmerSuppression(true)} className="mt-3 rounded-full bg-red-600 px-5 py-2.5 text-base font-bold text-white hover:bg-red-700">
                  {t15("deletionButton")}
                </button>
              </>)}
          </section>

          {aConfirmerSuppression ? (<SuppressionCompteDialog_1.default onSucces={succesSuppression} onErreur={erreurSuppression} onCancel={() => setAConfirmerSuppression(false)}/>) : null}
        </>)}
    </AppShell_1.default>);
}

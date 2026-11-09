"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = IndivisionSection;
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const format_1 = require("@/lib/format");
const data_1 = require("@/lib/data");
const indivision_1 = require("@/lib/indivision");
const translateError_1 = require("@/lib/translateError");
function moisCourantIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
/**
 * Section Indivision familiale (Module 6, spec §6 suite, §2, §13).
 * Affichée sur la fiche immeuble.
 *
 * - Propriétaire (plan Pro / Agence) : déclare les co-propriétaires et
 *   leurs parts — la somme doit faire exactement 100 % (validée avant
 *   enregistrement, refus sinon) ; chaque modification de part est
 *   tracée dans le fil d'actualité du bien.
 * - Co-propriétaire : lecture seule, sa part et sa répartition.
 * - Plan Starter : la section s'affiche avec l'indication du plan requis.
 *
 * RÈGLE DURE : CizaImmo calcule et affiche la répartition, mais
 * n'encaisse ni ne distribue AUCUN argent entre co-propriétaires.
 */
function IndivisionSection({ immeuble }) {
    const t = (0, next_intl_1.useTranslations)("indivision");
    const tc = (0, next_intl_1.useTranslations)("crud.common");
    const tErr = (0, next_intl_1.useTranslations)("crud");
    const locale = (0, next_intl_1.useLocale)();
    const [profil, setProfil] = (0, react_1.useState)(null);
    const [plan, setPlan] = (0, react_1.useState)(null);
    const [coproprietaires, setCoproprietaires] = (0, react_1.useState)([]);
    const [lignes, setLignes] = (0, react_1.useState)([]);
    const [taux, setTaux] = (0, react_1.useState)([]);
    const [revenus, setRevenus] = (0, react_1.useState)(0);
    const [depensesTotal, setDepensesTotal] = (0, react_1.useState)(0);
    const [mois, setMois] = (0, react_1.useState)(moisCourantIso());
    /**
     * Sélecteur mois/année LOCALISÉ (remplace <input type="month">, dont la
     * langue est choisie par le navigateur, pas par l'application). Les noms
     * de mois viennent de Intl.DateTimeFormat avec la locale de l'app ; les
     * deux listes produisent la même valeur « AAAA-MM » que le champ natif.
     */
    const [anneeSel, moisSel] = mois.split("-").map(Number);
    const nomsMois = (0, react_1.useMemo)(() => {
        const format = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fr-FR", {
            month: "long",
        });
        return Array.from({ length: 12 }, (_, i) => {
            const nom = format.format(new Date(2026, i, 1));
            return nom.charAt(0).toUpperCase() + nom.slice(1);
        });
    }, [locale]);
    const annees = (0, react_1.useMemo)(() => {
        const anneeCourante = new Date().getFullYear();
        return Array.from({ length: 11 }, (_, i) => anneeCourante - 5 + i);
    }, []);
    function changerMois(annee, moisNum) {
        setMois(`${annee}-${String(moisNum).padStart(2, "0")}`);
    }
    const [chargement, setChargement] = (0, react_1.useState)(true);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const [message, setMessage] = (0, react_1.useState)(null);
    const [enregistrement, setEnregistrement] = (0, react_1.useState)(false);
    const estProprietaire = profil?.role === "proprietaire";
    const estCoproprietaire = profil?.role === "coproprietaire";
    const planAutorise = plan === null ? false : data_1.INDIVISION_PAR_PLAN[(plan === "essai" ? "pro" : plan)];
    async function charger() {
        setChargement(true);
        setErreur(null);
        try {
            const p = (0, data_1.getDataProvider)();
            const [prof, abo, copros, tx] = await Promise.all([
                p.getProfil(),
                p.getAbonnement(),
                p.listerCoproprietaires(immeuble.id),
                p.listerTaux(),
            ]);
            setProfil(prof);
            setPlan(abo ? (abo.statut === "essai" ? "essai" : abo.plan) : null);
            setCoproprietaires(copros);
            setLignes(copros.map((c) => ({
                cle: c.id,
                id: c.id,
                nom: c.nom,
                email: c.email,
                telephone: c.telephone,
                part: c.part,
                statut: c.statut,
            })));
            setTaux(tx);
            await chargerPeriode(p, mois);
        }
        catch (e) {
            setErreur((0, translateError_1.messageErreur)(tErr, e));
        }
        finally {
            setChargement(false);
        }
    }
    async function chargerPeriode(p, moisChoisi) {
        const [apts, baux, echs, pays, deps] = await Promise.all([
            p.listerAppartements({ immeubleId: immeuble.id, inclureArchives: true }),
            p.listerBaux(),
            p.listerEcheances(),
            p.listerPaiements(),
            p.listerDepenses({ immeubleId: immeuble.id }),
        ]);
        const aptIds = new Set(apts.map((a) => a.id));
        const bauxImm = baux.filter((b) => aptIds.has(b.appartement_id));
        const echIds = new Set(echs.filter((e) => bauxImm.some((b) => b.id === e.bail_id)).map((e) => e.id));
        const revenusMois = pays
            .filter((pay) => pay.statut === "valide" &&
            echIds.has(pay.echeance_id) &&
            pay.date_paiement.slice(0, 7) === moisChoisi &&
            pay.devise === immeuble.devise)
            .reduce((s, pay) => s + pay.montant, 0);
        const depensesMois = deps
            .filter((d) => d.date.slice(0, 7) === moisChoisi && d.devise === immeuble.devise)
            .reduce((s, d) => s + d.montant, 0);
        setRevenus(revenusMois);
        setDepensesTotal(depensesMois);
    }
    (0, react_1.useEffect)(() => {
        charger();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [immeuble.id]);
    (0, react_1.useEffect)(() => {
        if (!chargement) {
            const p = (0, data_1.getDataProvider)();
            chargerPeriode(p, mois).catch(() => undefined);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mois]);
    const somme = (0, react_1.useMemo)(() => Math.round(lignes.reduce((s, l) => s + (Number.isFinite(l.part) ? l.part : 0), 0) * 100) / 100, [lignes]);
    const repartition = (0, react_1.useMemo)(() => (0, indivision_1.repartirResultatNet)({
        revenus,
        depenses: depensesTotal,
        devise: immeuble.devise,
        coproprietaires,
        devise_cible: profil?.devise_principale ?? null,
        taux,
    }), [revenus, depensesTotal, immeuble.devise, coproprietaires, profil, taux]);
    const maLigne = (0, react_1.useMemo)(() => estCoproprietaire && profil
        ? repartition.lignes.find((l) => l.email.trim().toLowerCase() === profil.email.trim().toLowerCase())
        : undefined, [estCoproprietaire, profil, repartition]);
    function majLigne(cle, patch) {
        setLignes((anciennes) => anciennes.map((l) => (l.cle === cle ? { ...l, ...patch } : l)));
    }
    function ajouterLigne() {
        setLignes((anciennes) => [
            ...anciennes,
            {
                cle: `nouveau-${Date.now()}`,
                nom: "",
                email: "",
                telephone: null,
                part: 0,
                statut: "invite",
            },
        ]);
    }
    function retirerLigne(cle) {
        setLignes((anciennes) => anciennes.filter((l) => l.cle !== cle));
    }
    async function enregistrer(e) {
        e.preventDefault();
        setErreur(null);
        setMessage(null);
        setEnregistrement(true);
        try {
            const maj = await (0, data_1.getDataProvider)().definirParts(immeuble.id, lignes.map((l) => ({
                nom: l.nom,
                email: l.email,
                telephone: l.telephone,
                part: Number(l.part),
            })));
            setCoproprietaires(maj);
            setLignes(maj.map((c) => ({
                cle: c.id,
                id: c.id,
                nom: c.nom,
                email: c.email,
                telephone: c.telephone,
                part: c.part,
                statut: c.statut,
            })));
            setMessage(t("partsSaved"));
        }
        catch (err) {
            setErreur((0, translateError_1.messageErreur)(tErr, err));
        }
        finally {
            setEnregistrement(false);
        }
    }
    async function retirer(id) {
        setErreur(null);
        try {
            await (0, data_1.getDataProvider)().retirerCoproprietaire(id);
            setCoproprietaires((anciens) => anciens.filter((c) => c.id !== id));
            setLignes((anciennes) => anciennes.filter((l) => l.id !== id));
            setMessage(t("removedDone"));
        }
        catch (err) {
            setErreur((0, translateError_1.messageErreur)(tErr, err));
        }
    }
    async function accepter(id) {
        setErreur(null);
        try {
            const maj = await (0, data_1.getDataProvider)().accepterInvitationCoproprietaire(id);
            setCoproprietaires((anciens) => anciens.map((c) => (c.id === id ? maj : c)));
            setLignes((anciennes) => anciennes.map((l) => (l.id === id ? { ...l, statut: "actif" } : l)));
            setMessage(t("acceptedDone"));
        }
        catch (err) {
            setErreur((0, translateError_1.messageErreur)(tErr, err));
        }
    }
    if (chargement) {
        return (<section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-navy">{t("title")}</h2>
        <p className="mt-2 text-slate-500">{tc("loading")}</p>
      </section>);
    }
    return (<section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-navy">{t("title")}</h2>
      <p className="mt-2 text-sm text-slate-600">{t("subtitle")}</p>
      <p role="note" className="mt-3 rounded-xl border border-gold/50 bg-amber-50 px-4 py-3 text-sm font-semibold text-navy">
        {t("hardRule")}
      </p>
      {estCoproprietaire ? (<p role="note" className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-navy">
          {t("readOnlyNote")}
        </p>) : null}
      {message ? (<p role="status" className="mt-3 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">{message}</p>) : null}
      {erreur ? (<p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erreur}</p>) : null}

      {!planAutorise && estProprietaire ? (<div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-bold text-navy">{t("planRequired")}</p>
          <p className="mt-1 text-sm text-slate-600">{t("planRequiredText")}</p>
        </div>) : null}

      {/* Répartition des revenus de la période */}
      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-semibold text-navy">{t("yourShareTitle")}</h3>
          <label className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
            {t("periodLabel")}
            <select value={moisSel} onChange={(e) => changerMois(anneeSel, Number(e.target.value))} aria-label={t("monthLabel")} className="min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-gold">
              {nomsMois.map((nom, i) => (<option key={i + 1} value={i + 1}>{nom}</option>))}
            </select>
            <select value={anneeSel} onChange={(e) => changerMois(Number(e.target.value), moisSel)} aria-label={t("yearLabel")} className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-gold">
              {annees.map((a) => (<option key={a} value={a}>{a}</option>))}
            </select>
          </label>
        </div>
        {/* Correctif tuiles statistiques 2026-11-08 (même patron que
            le passeport du bien) : en 3 colonnes dès le mobile, une
            tuile n'offrait que ~66 px utiles — tout montant débordait
            ou cassait. Tuiles empilées sur petit téléphone (pleine
            largeur), 3 colonnes dès 560 px, montants insécables en
            whitespace-nowrap avec taille par paliers. */}
        <dl className="mt-3 grid grid-cols-1 gap-3 text-center min-[560px]:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">{t("revenues")}</dt>
            <dd className="whitespace-nowrap text-base font-bold text-navy min-[560px]:text-xs min-[900px]:text-sm lg:text-base">{(0, format_1.formatMoney)(revenus, immeuble.devise, locale)}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">{t("expenses")}</dt>
            <dd className="whitespace-nowrap text-base font-bold text-navy min-[560px]:text-xs min-[900px]:text-sm lg:text-base">{(0, format_1.formatMoney)(depensesTotal, immeuble.devise, locale)}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">{t("netResult")}</dt>
            <dd className="whitespace-nowrap text-base font-bold text-navy min-[560px]:text-xs min-[900px]:text-sm lg:text-base">{(0, format_1.formatMoney)(repartition.resultat_net, immeuble.devise, locale)}</dd>
          </div>
        </dl>
        {coproprietaires.length === 0 ? (<p className="mt-3 text-sm text-slate-600">{t("noCoproprietaires")}</p>) : !repartition.parts_completes ? (<p role="alert" className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {t("incompleteWarning")} ({t("totalLabel")} : {repartition.somme_parts} %)
          </p>) : (<ul className="mt-3 space-y-2">
            {repartition.lignes.map((ligne) => {
                const estMoi = estCoproprietaire &&
                    profil?.email.trim().toLowerCase() === ligne.email.trim().toLowerCase();
                return (<li key={ligne.coproprietaire_id} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm ${estMoi ? "border-gold bg-amber-50" : "border-slate-200"}`}>
                  <span>
                    <strong className="text-navy">{ligne.nom}</strong>
                    {estMoi ? ` — ${t("yourShare")}` : ""} · {ligne.part} %
                  </span>
                  <span className="text-right">
                    <span className="font-bold text-navy">
                      {(0, format_1.formatMoney)(ligne.montant, ligne.devise, locale)}
                    </span>
                    {ligne.montant_converti !== null && ligne.devise_convertie ? (<span className="block text-xs text-slate-500">
                        ≈ {(0, format_1.formatMoney)(ligne.montant_converti, ligne.devise_convertie, locale)}
                        {" · "}
                        {t("convertedNote", {
                            date: (0, format_1.formatDate)(ligne.date_taux?.slice(0, 10) ?? null, locale),
                            manual: ligne.source_taux === "manuel" ? " (manuel)" : "",
                        })}
                      </span>) : ligne.devise_convertie === null && profil && profil.devise_principale !== immeuble.devise ? (<span className="block text-xs text-slate-500">{t("rateUnavailable")}</span>) : null}
                  </span>
                </li>);
            })}
          </ul>)}
        {estCoproprietaire && maLigne ? (<p className="mt-3 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
            {t("yourAmount")} : {(0, format_1.formatMoney)(maLigne.montant, maLigne.devise, locale)}
          </p>) : null}
      </div>

      {/* Gestion des parts (propriétaire, plan autorisé) */}
      {estProprietaire && planAutorise ? (<form onSubmit={enregistrer} noValidate className="mt-6 border-t border-slate-100 pt-4">
          <h3 className="font-semibold text-navy">{t("inviteTitle")}</h3>
          <p className="mt-1 text-sm text-slate-600">{t("shareHint")}</p>
          <div className="mt-3 space-y-4">
            {lignes.map((l) => (<div key={l.cle} className="rounded-xl border border-slate-200 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-900">
                    {t("formName")}
                    <input type="text" value={l.nom} onChange={(e) => majLigne(l.cle, { nom: e.target.value })} required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"/>
                  </label>
                  <label className="block text-sm font-semibold text-slate-900">
                    {t("formEmail")}
                    <input type="email" value={l.email} onChange={(e) => majLigne(l.cle, { email: e.target.value })} required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"/>
                  </label>
                  <label className="block text-sm font-semibold text-slate-900">
                    {t("formPhone")}
                    <input type="tel" value={l.telephone ?? ""} onChange={(e) => majLigne(l.cle, { telephone: e.target.value || null })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"/>
                  </label>
                  <label className="block text-sm font-semibold text-slate-900">
                    {t("formShare")}
                    <input type="number" min={0} max={100} step={0.5} value={Number.isFinite(l.part) ? String(l.part) : ""} onChange={(e) => majLigne(l.cle, { part: Number(e.target.value) })} required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"/>
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${l.statut === "actif" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                    {l.statut === "actif" ? t("statusActive") : t("statusInvited")}
                  </span>
                  {l.id && l.statut === "invite" ? (<button type="button" onClick={() => accepter(l.id)} className="text-sm font-semibold text-navy underline">
                      {t("accept")}
                    </button>) : null}
                  {l.id ? (<button type="button" onClick={() => retirer(l.id)} className="text-sm font-semibold text-red-700 underline">
                      {t("remove")}
                    </button>) : (<button type="button" onClick={() => retirerLigne(l.cle)} className="text-sm font-semibold text-red-700 underline">
                      {t("remove")}
                    </button>)}
                </div>
              </div>))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={ajouterLigne} className="rounded-full border border-navy px-4 py-2 text-sm font-bold text-navy">
              {t("addCoOwner")}
            </button>
            <button type="submit" disabled={enregistrement} className="rounded-full border border-navy bg-white px-6 py-2.5 text-sm font-semibold text-navy hover:bg-navy/5 disabled:opacity-50">
              {enregistrement ? tc("saving") : t("saveParts")}
            </button>
            <span className={`text-sm font-bold ${Math.abs(somme - 100) < 0.01 ? "text-green-700" : "text-red-700"}`}>
              {t("totalLabel")} : {somme} %
            </span>
          </div>
        </form>) : null}

      {/* Lecture seule (co-propriétaire) : liste des parts du bien */}
      {estCoproprietaire ? (<ul className="mt-4 space-y-2">
          {coproprietaires.map((c) => (<li key={c.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <span>{c.nom}</span>
              <span className="font-bold text-navy">{c.part} %</span>
            </li>))}
        </ul>) : null}
    </section>);
}

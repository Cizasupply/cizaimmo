"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AbonnementPage;
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const navigation_1 = require("next/navigation");
const AppShell_1 = __importDefault(require("@/components/AppShell"));
const ConfirmDialog_1 = __importDefault(require("@/components/ConfirmDialog"));
const SuppressionCompteDialog_1 = __importDefault(require("@/components/SuppressionCompteDialog"));
const Field_1 = __importDefault(require("@/components/Field"));
const format_1 = require("@/lib/format");
const facture_pdf_1 = require("@/lib/facture-pdf");
const data_1 = require("@/lib/data");
const tarifs_1 = require("@/lib/tarifs");
const translateError_1 = require("@/lib/translateError");
const PLANS = ["starter", "pro", "agence"];
function libelleGestionnaires(t, plan) {
    const max = data_1.GESTIONNAIRES_MAX[plan];
    if (max === 0)
        return t("features.managersNone");
    if (!Number.isFinite(max))
        return t("features.managersUnlimited");
    return t("features.managers", { count: String(max) });
}
function AbonnementPage() {
    const ts = (0, next_intl_1.useTranslations)("subscription");
    const t15 = (0, next_intl_1.useTranslations)("v15");
    const t = (0, next_intl_1.useTranslations)("crud");
    const tp = (0, next_intl_1.useTranslations)("pages");
    const tc = (0, next_intl_1.useTranslations)("common");
    const locale = (0, next_intl_1.useLocale)();
    const router = (0, navigation_1.useRouter)();
    const [profil, setProfil] = (0, react_1.useState)(null);
    const [abonnement, setAbonnement] = (0, react_1.useState)(null);
    const [limite, setLimite] = (0, react_1.useState)(null);
    const [factures, setFactures] = (0, react_1.useState)([]);
    const [paiementsMm, setPaiementsMm] = (0, react_1.useState)([]);
    const [stripeConfig, setStripeConfig] = (0, react_1.useState)(null);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const [message, setMessage] = (0, react_1.useState)(null);
    // Prix DYNAMIQUES (v1.2) : lus depuis la plateforme (base/seed),
    // jamais codés en dur — repli seed au premier rendu.
    const [prixPlans, setPrixPlans] = (0, react_1.useState)(() => (0, tarifs_1.construirePrixPlans)(tarifs_1.TARIFS_SEED));
    const [planChoisi, setPlanChoisi] = (0, react_1.useState)(null);
    // v1.4 : pack choisi pour la fin de l'essai (défaut Starter).
    const [packApresEssai, setPackApresEssai] = (0, react_1.useState)("starter");
    const [aConfirmerDescente, setAConfirmerDescente] = (0, react_1.useState)(null);
    const [aConfirmerAnnulation, setAConfirmerAnnulation] = (0, react_1.useState)(false);
    // v1.5 : suppression de compte par le client (demande + rétractation 30 j).
    const [aConfirmerSuppression, setAConfirmerSuppression] = (0, react_1.useState)(false);
    const [operateur, setOperateur] = (0, react_1.useState)("ecocash");
    const [telephone, setTelephone] = (0, react_1.useState)("");
    const [paiementEnCours, setPaiementEnCours] = (0, react_1.useState)(false);
    const demo = (0, data_1.isDemoMode)();
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
            const [pro, abo, lim, fac, mm, tarifs] = await Promise.all([
                p.getProfil(),
                p.getAbonnement(),
                p.getLimiteBlocs(),
                p.listerFactures(),
                p.listerPaiementsMobileMoney(),
                p.getTarifsPlateforme().catch(() => tarifs_1.TARIFS_SEED),
            ]);
            setProfil(pro);
            setAbonnement(abo);
            if (abo)
                setPackApresEssai(abo.plan_apres_essai ?? "starter");
            setLimite(lim);
            setFactures(fac);
            setPaiementsMm(mm);
            setPrixPlans((0, tarifs_1.construirePrixPlans)(tarifs));
            try {
                const res = await fetch("/api/stripe/checkout");
                if (res.ok)
                    setStripeConfig((await res.json()));
            }
            catch {
                // L'état Stripe reste inconnu : on affiche « non configuré ».
            }
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
    function gererErreur(e) {
        setErreur((0, translateError_1.messageErreur)(t, e));
    }
    /** Clic sur « Choisir ce plan » : descente -> confirmation, montée -> paiement. */
    function choisirPlan(plan) {
        setMessage(null);
        setErreur(null);
        if (!abonnement)
            return;
        if (plan === abonnement.plan && !abonnement.plan_en_attente && !abonnement.resiliation_programmee)
            return;
        if (data_1.RANG_PLAN[plan] < data_1.RANG_PLAN[abonnement.plan]) {
            setAConfirmerDescente(plan);
            return;
        }
        setPlanChoisi(plan);
    }
    /** v1.4 : enregistre le pack choisi pour la fin de l'essai. */
    async function enregistrerPackApresEssai() {
        try {
            const maj = await (0, data_1.getDataProvider)().definirPlanApresEssai(packApresEssai);
            setAbonnement(maj);
            setMessage(ts("trialPackSaved"));
            setErreur(null);
        }
        catch (e) {
            gererErreur(e);
        }
    }
    async function confirmerDescente() {
        if (!aConfirmerDescente)
            return;
        const plan = aConfirmerDescente;
        setAConfirmerDescente(null);
        try {
            await (0, data_1.getDataProvider)().changerPlan(plan);
            setMessage(ts("downgradeDone"));
            await charger();
        }
        catch (e) {
            gererErreur(e);
        }
    }
    /** Montée (ou reprise) en démo : changement simulé, étiqueté DÉMO. */
    async function payerDemo(plan) {
        try {
            await (0, data_1.getDataProvider)().changerPlan(plan);
            setPlanChoisi(null);
            setMessage(ts("changeDone"));
            await charger();
        }
        catch (e) {
            gererErreur(e);
        }
    }
    /** Montée en réel : redirection vers Stripe Checkout (mode test). */
    async function payerCarte(plan) {
        if (!stripeConfig?.configured) {
            setErreur(ts("stripeNotConfigured"));
            return;
        }
        try {
            const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan }),
            });
            const corps = (await res.json());
            if (!res.ok || !corps.url) {
                setErreur(corps.message ?? ts("stripeNotConfigured"));
                return;
            }
            window.location.href = corps.url;
        }
        catch {
            setErreur(ts("stripeNotConfigured"));
        }
    }
    async function demanderMobileMoney(plan) {
        setPaiementEnCours(true);
        setErreur(null);
        try {
            await (0, data_1.getDataProvider)().demanderPaiementMobileMoney(operateur, telephone, plan);
            setMessage(ts("paymentRequested"));
            await charger();
        }
        catch (e) {
            gererErreur(e);
        }
        finally {
            setPaiementEnCours(false);
        }
    }
    /** Démo uniquement : simule la confirmation reçue sur le téléphone. */
    async function simulerConfirmation(reference) {
        try {
            await (0, data_1.getDataProvider)().confirmerPaiementMobileMoney(reference);
            setPlanChoisi(null);
            setMessage(ts("paymentConfirmed"));
            await charger();
        }
        catch (e) {
            gererErreur(e);
        }
    }
    /** v1.5 : traduit un code v1.5 via le namespace dédié, sinon repli crud. */
    function gererErreurV15(e) {
        const code = e instanceof Error ? e.message : "";
        if (code === "ERR_SUPPRESSION_DEJA_DEMANDEE" ||
            code === "ERR_AUCUNE_SUPPRESSION" ||
            code === "ERR_DELAI_NON_ECOULE" ||
            code === "ERR_SUPER_ADMIN_REQUIS" ||
            code === "ERR_ADMIN_INTROUVABLE" ||
            code === "ERR_MESSAGE_VIDE" ||
            code === "ERR_CONVERSATION_INTROUVABLE" ||
            code === "ERR_SUPERVISION_LECTURE_SEULE" ||
            code === "ERR_MOT_DE_PASSE_INCORRECT") {
            setErreur(t15(`errors.${code}`));
        }
        else {
            gererErreur(e);
        }
    }
    /**
     * Succès du dialogue de suppression (mot de passe vérifié par le
     * provider AVANT la RPC — renfort fondateur 2026-11-07) : le
     * dialogue se ferme et la page reflète la demande posée.
     */
    async function succesSuppression(maj) {
        setAConfirmerSuppression(false);
        setProfil(maj);
        setMessage(t15("deletionRequestedMsg"));
        setErreur(null);
        await charger();
    }
    /** Erreur non « mot de passe » du dialogue : fermé + message page. */
    function erreurSuppression(e) {
        setAConfirmerSuppression(false);
        gererErreurV15(e);
    }
    async function annulerSuppression() {
        try {
            const maj = await (0, data_1.getDataProvider)().annulerSuppressionCompte();
            setProfil(maj);
            setMessage(t15("deletionCancelledMsg"));
            setErreur(null);
            await charger();
        }
        catch (e) {
            gererErreurV15(e);
        }
    }
    async function annuler() {
        setAConfirmerAnnulation(false);
        try {
            await (0, data_1.getDataProvider)().annulerAbonnement();
            setMessage(ts("cancelDone"));
            await charger();
        }
        catch (e) {
            gererErreur(e);
        }
    }
    function telechargerFacture(facture) {
        (0, facture_pdf_1.telechargerFactureAboPdf)({
            facture,
            emetteurNom: profil?.nom ?? "CizaImmo",
            langue: locale === "en" ? "en" : "fr",
            demo,
        });
    }
    const lectureSeule = abonnement ? (0, data_1.estLectureSeule)(abonnement) : false;
    const statutCle = abonnement?.statut === "essai"
        ? "statusTrial"
        : abonnement?.statut === "actif"
            ? "statusActive"
            : abonnement?.statut === "lecture_seule"
                ? "statusReadOnly"
                : abonnement?.statut === "en_attente"
                    ? "statusPendingApproval"
                    : abonnement?.statut === "suspendu"
                        ? "statusSuspended"
                        : "statusCancelled";
    return (<AppShell_1.default title={tp("subscription.title")}>
      {chargement ? (<p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{tc("loading")}</p>) : profil && profil.role !== "proprietaire" ? (<p role="alert" className="rounded-2xl border border-slate-200 bg-white p-8 text-red-700 shadow-sm">
          {ts("accessDenied")}
        </p>) : erreur ? (<div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p role="alert" className="text-red-700">{erreur}</p>
          <button type="button" onClick={charger} className="mt-4 rounded-full border border-navy bg-white px-5 py-2 text-sm font-semibold text-navy hover:bg-navy/5">
            {t("common.retry")}
          </button>
        </div>) : abonnement ? (<>
          {message ? (<p role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
              {message}
            </p>) : null}

          {demo ? (<p role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {ts("demoNote")}
            </p>) : null}

          {stripeConfig && !stripeConfig.configured && !demo ? (<p role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {ts("stripeNotConfigured")}
            </p>) : null}
          {stripeConfig?.configured ? (<p role="status" className="mb-4 rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
              {ts("stripeTestMode")}
            </p>) : null}

          {lectureSeule ? (<div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 shadow-sm">
              <p className="text-base font-bold text-red-800">{ts("readOnly")}</p>
              <p className="mt-1 text-sm text-red-700">{ts("readOnlyText")}</p>
              {abonnement.lecture_seule_jusqu_au ? (<p className="mt-1 text-sm text-red-700">
                  {ts("retentionUntil")} {(0, format_1.formatDate)(abonnement.lecture_seule_jusqu_au, locale)}
                </p>) : null}
            </div>) : null}

          {/* Plan actuel */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-navy">{ts("currentPlan")}</h2>
            <dl className="mt-3 space-y-2 text-base text-slate-700">
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 font-semibold">{ts("plan")}</dt>
                <dd className="min-w-0 break-words text-right">{ts(`plans.${abonnement.plan}`)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 font-semibold">{ts("status")}</dt>
                <dd className="min-w-0 break-words text-right">{ts(statutCle)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="shrink-0 font-semibold">{ts("grid")}</dt>
                <dd className="min-w-0 break-words text-right">{abonnement.grille === "afrique" ? ts("gridAfrique") : ts("gridInternationale")}</dd>
              </div>
              {abonnement.statut === "essai" && abonnement.trial_ends_at ? (<div className="flex justify-between gap-4">
                  <dt className="shrink-0 font-semibold">{ts("trialEnds")}</dt>
                  <dd className="min-w-0 break-words text-right">{(0, format_1.formatDate)(abonnement.trial_ends_at, locale)}</dd>
                </div>) : null}
              {abonnement.fin_periode ? (<div className="flex justify-between gap-4">
                  <dt className="shrink-0 font-semibold">{ts("periodEnds")}</dt>
                  <dd className="min-w-0 break-words text-right">{(0, format_1.formatDate)(abonnement.fin_periode, locale)}</dd>
                </div>) : null}
              {limite ? (<div className="flex justify-between gap-4">
                  <dt className="shrink-0 font-semibold">{ts("blocks")}</dt>
                  <dd className="min-w-0 break-words text-right">
                    {Number.isFinite(limite.autorises)
                    ? ts("blocksUsed", { used: String(limite.utilises), allowed: String(limite.autorises) })
                    : ts("blocksUnlimited", { used: String(limite.utilises) })}
                  </dd>
                </div>) : null}
            </dl>
            {abonnement.plan_en_attente && abonnement.date_effet_plan ? (<p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                {ts("pendingDowngrade")} —{" "}
                {ts("pendingDowngradeText", {
                    plan: ts(`plans.${abonnement.plan_en_attente}`),
                    date: (0, format_1.formatDate)(abonnement.date_effet_plan, locale),
                })}
              </p>) : null}
            {abonnement.resiliation_programmee && abonnement.fin_periode ? (<p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                {ts("cancellationScheduled")} —{" "}
                {ts("cancellationScheduledText", { date: (0, format_1.formatDate)(abonnement.fin_periode, locale) })}
              </p>) : null}
          </section>

          {/* v1.4 : pack à la fin de l'essai — pendant l'essai seulement.
                L'essai court sur Starter ; ce choix ne déclenche aucun
                paiement, il est seulement enregistré (plan_apres_essai). */}
          {abonnement.statut === "essai" ? (<section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-navy">{ts("trialPackTitle")}</h2>
              <p className="mt-1 text-sm text-slate-600">{ts("trialPackText")}</p>
              <div className="mt-4 space-y-2">
                {PLANS.map((plan) => (<label key={plan} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-base text-slate-900 ${packApresEssai === plan
                        ? "border-gold bg-gold/10 font-semibold"
                        : "border-slate-300 bg-white"}`}>
                    <span className="flex items-center gap-3">
                      <input type="radio" name="pack-apres-essai" value={plan} checked={packApresEssai === plan} onChange={() => setPackApresEssai(plan)} className="h-5 w-5 shrink-0 accent-[#1B2A4A]"/>
                      {ts(`plans.${plan}`)}
                    </span>
                    <span className="text-sm text-slate-600">
                      {(0, format_1.formatMoney)(prixPlans[plan][abonnement.grille], "USD", locale)} {ts("perMonth")}
                    </span>
                  </label>))}
              </div>
              <button type="button" onClick={enregistrerPackApresEssai} className="mt-4 rounded-full border border-navy bg-white px-5 py-2.5 text-base font-semibold text-navy hover:bg-navy/5">
                {ts("trialPackSave")}
              </button>
            </section>) : null}

          {/* Comparaison des plans */}
          <section className="mb-6">
            <h2 className="mb-3 text-lg font-semibold text-navy">{ts("compareTitle")}</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {PLANS.map((plan) => {
                const estActuel = plan === abonnement.plan && !abonnement.plan_en_attente;
                const estDescente = data_1.RANG_PLAN[plan] < data_1.RANG_PLAN[abonnement.plan];
                return (<article key={plan} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-semibold text-navy">{ts(`plans.${plan}`)}</h3>
                    <p className="mt-2 text-2xl font-bold text-navy">
                      {(0, format_1.formatMoney)(prixPlans[plan][abonnement.grille], "USD", locale)}
                      <span className="text-sm font-normal text-slate-500"> {ts("perMonth")}</span>
                    </p>
                    <p className="text-sm text-slate-500">
                      {abonnement.grille === "afrique" ? ts("gridAfrique") : ts("gridInternationale")}
                      {" · "}
                      {(0, format_1.formatMoney)(prixPlans[plan][abonnement.grille === "afrique" ? "internationale" : "afrique"], "USD", locale)}
                      {" "}
                      {abonnement.grille === "afrique" ? ts("gridInternationale") : ts("gridAfrique")}
                    </p>
                    <ul className="mt-3 space-y-1 text-sm text-slate-700">
                      <li>✓ {ts("features.fullManagement")}</li>
                      <li>✓ {ts("features.reports")}</li>
                      <li>✓ {libelleGestionnaires(ts, plan)}</li>
                      <li>
                        {data_1.VITRINE_PAR_PLAN[plan] ? "✓ " : "— "}
                        {data_1.VITRINE_PAR_PLAN[plan] ? ts("features.vitrineYes") : ts("features.vitrineNo")}
                      </li>
                      <li>
                        {data_1.INDIVISION_PAR_PLAN[plan] ? "✓ " : "— "}
                        {data_1.INDIVISION_PAR_PLAN[plan] ? ts("features.indivisionYes") : ts("features.indivisionNo")}
                      </li>
                    </ul>
                    <button type="button" disabled={estActuel} onClick={() => choisirPlan(plan)} className={"mt-4 w-full rounded-full px-4 py-2.5 text-base font-bold " +
                        (estActuel
                            ? "bg-slate-100 text-slate-400"
                            : "border border-navy bg-white font-bold text-navy hover:bg-navy/5")}>
                      {estActuel
                        ? ts("currentPlanButton")
                        : estDescente
                            ? `${ts("choosePlan")} (${ts("downgradeEffective")})`
                            : `${ts("choosePlan")} (${ts("upgradeNow")})`}
                    </button>
                  </article>);
            })}
            </div>
          </section>

          {/* Paiement du plan choisi */}
          {planChoisi ? (<section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-navy">
                {ts("payTitle", { plan: ts(`plans.${planChoisi}`) })}
              </h2>
              <p className="mt-1 text-base text-slate-700">
                {(0, format_1.formatMoney)(prixPlans[planChoisi][abonnement.grille], "USD", locale)} {ts("perMonth")} —{" "}
                {abonnement.grille === "afrique" ? ts("gridAfrique") : ts("gridInternationale")}
              </p>
              <div className="mt-4 flex flex-col gap-3">
                {demo ? (<button type="button" onClick={() => payerDemo(planChoisi)} className="rounded-full bg-gold px-5 py-2.5 text-base font-bold text-navy-dark hover:bg-gold-light">
                    {ts("simulateConfirm")} — {ts(`plans.${planChoisi}`)}
                  </button>) : (<button type="button" onClick={() => payerCarte(planChoisi)} className="rounded-full bg-gold px-5 py-2.5 text-base font-bold text-navy hover:bg-gold-light">
                    {ts("payByCard")}
                  </button>)}
              </div>
              <div className="mt-6 border-t border-slate-200 pt-4">
                <h3 className="font-semibold text-navy">{ts("payByMobileMoney")}</h3>
                <div className="mt-3 space-y-3">
                  <Field_1.default id="operateur" label={ts("operator")} value={operateur} onChange={(v) => setOperateur(v)}>
                    <option value="ecocash">EcoCash</option>
                    <option value="lumicash">Lumicash</option>
                    <option value="enoti">eNoti</option>
                  </Field_1.default>
                  <Field_1.default id="telephone-mm" label={ts("phone")} type="tel" value={telephone} onChange={setTelephone} placeholder={ts("phonePlaceholder")}/>
                  <button type="button" disabled={paiementEnCours || !telephone.trim()} onClick={() => demanderMobileMoney(planChoisi)} className="w-full rounded-full border border-navy bg-white px-5 py-2.5 text-base font-semibold text-navy hover:bg-navy/5 disabled:opacity-50">
                    {ts("requestPayment")}
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => setPlanChoisi(null)} className="mt-4 text-sm font-semibold text-slate-600 underline">
                {tc("cancel")}
              </button>
            </section>) : null}

          {/* Paiements mobile money */}
          {paiementsMm.length > 0 ? (<section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-navy">{ts("mmTitle")}</h2>
              <ul className="mt-3 space-y-3">
                {paiementsMm.map((p) => (<li key={p.id} className="rounded-xl border border-slate-200 p-4">
                    <p className="break-words text-base font-semibold text-slate-800">
                      {p.operateur} — {(0, format_1.formatMoney)(p.montant, "USD", locale)} — {ts(`plans.${p.plan}`)}
                    </p>
                    <p className="mt-1 break-words text-sm text-slate-600">
                      {ts("reference")} : {p.reference} ·{" "}
                      {p.statut === "en_attente"
                        ? ts("paymentPending")
                        : p.statut === "confirme"
                            ? ts("paymentConfirmed")
                            : p.statut === "expire"
                                ? ts("paymentExpired")
                                : ts("paymentCancelled")}
                    </p>
                    {p.statut === "en_attente" ? (<p className="text-sm text-slate-600">
                        {ts("expiresAt")} {(0, format_1.formatDate)(p.expire_le, locale)}
                      </p>) : null}
                    {p.statut === "en_attente" && demo ? (<div className="mt-3">
                        <button type="button" onClick={() => simulerConfirmation(p.reference)} className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy-dark hover:bg-gold-light">
                          {ts("simulateConfirm")}
                        </button>
                        <p className="mt-1 text-xs text-slate-500">{ts("simulateConfirmHint")}</p>
                      </div>) : null}
                  </li>))}
              </ul>
            </section>) : null}

          {/* Factures */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-navy">{ts("invoicesTitle")}</h2>
            {factures.length === 0 ? (<p className="mt-3 text-base text-slate-500">{ts("invoicesEmpty")}</p>) : (<ul className="mt-3 space-y-3">
                {factures.map((f) => (<li key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                    <div className="min-w-0">
                      <p className="break-words text-base font-semibold text-slate-800">
                        {f.numero} — {(0, format_1.formatMoney)(f.montant, "USD", locale)}
                      </p>
                      <p className="break-words text-sm text-slate-600">
                        {(0, format_1.formatDate)(f.date_emission, locale)} · {ts(`plans.${f.plan}`)} ·{" "}
                        {f.moyen === "stripe"
                        ? ts("methodStripe")
                        : f.moyen === "mobile_money"
                            ? ts("methodMobileMoney")
                            : ts("methodDemo")}{" "}
                        · {f.statut === "payee" ? ts("statusPaid") : f.statut === "en_attente" ? ts("statusPending") : ts("statusCancelled")}
                      </p>
                    </div>
                    <button type="button" onClick={() => telechargerFacture(f)} className="shrink-0 rounded-full border border-navy px-4 py-2 text-sm font-bold text-navy hover:bg-navy hover:text-white">
                      {ts("download")}
                    </button>
                  </li>))}
              </ul>)}
          </section>

          {/* Annulation */}
          <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-navy">{ts("cancelTitle")}</h2>
            {abonnement.resiliation_programmee ? (<p className="mt-2 text-base text-slate-700">
                {ts("cancellationScheduledText", { date: (0, format_1.formatDate)(abonnement.fin_periode, locale) })}
              </p>) : (<button type="button" onClick={() => setAConfirmerAnnulation(true)} className="mt-3 rounded-full border border-red-600 px-5 py-2.5 text-base font-bold text-red-700 hover:bg-red-50">
                {ts("cancelButton")}
              </button>)}
          </section>

          {/* v1.5 : suppression de compte par le client — la base pose la
                demande, le compte passe en lecture seule immédiate, délai
                de rétractation de 30 jours (annulation possible ici). */}
          <section className="mb-6 rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-red-800">{t15("deletionTitle")}</h2>
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
        </>) : (<p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{tc("loading")}</p>)}

      {aConfirmerDescente ? (<ConfirmDialog_1.default title={ts("compareTitle")} text={ts("pendingDowngradeText", {
                plan: ts(`plans.${aConfirmerDescente}`),
                date: (0, format_1.formatDate)(abonnement?.fin_periode ?? abonnement?.trial_ends_at, locale),
            })} confirmLabel={ts("choosePlan")} cancelLabel={tc("cancel")} danger={false} onConfirm={confirmerDescente} onCancel={() => setAConfirmerDescente(null)}/>) : null}

      {aConfirmerSuppression ? (<SuppressionCompteDialog_1.default onSucces={succesSuppression} onErreur={erreurSuppression} onCancel={() => setAConfirmerSuppression(false)}/>) : null}

      {aConfirmerAnnulation ? (<ConfirmDialog_1.default title={ts("cancelConfirmTitle")} text={ts("cancelConfirmText", { date: (0, format_1.formatDate)(abonnement?.fin_periode ?? abonnement?.trial_ends_at, locale) })} confirmLabel={ts("cancelConfirmButton")} cancelLabel={tc("cancel")} onConfirm={annuler} onCancel={() => setAConfirmerAnnulation(false)}/>) : null}
    </AppShell_1.default>);
}

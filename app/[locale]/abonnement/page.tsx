"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import ConfirmDialog from "@/components/ConfirmDialog";
import Field from "@/components/Field";
import { formatDate, formatMoney } from "@/lib/format";
import { telechargerFactureAboPdf } from "@/lib/facture-pdf";
import {
  getDataProvider,
  isDemoMode,
  estLectureSeule,
  PRIX_PLANS,
  RANG_PLAN,
  GESTIONNAIRES_MAX,
  VITRINE_PAR_PLAN,
  INDIVISION_PAR_PLAN,
} from "@/lib/data";
import type {
  Abonnement,
  FactureAbonnement,
  LimiteBlocs,
  OperateurMobileMoney,
  PaiementMobileMoney,
  Plan,
  Profil,
} from "@/lib/data";
import { messageErreur } from "@/lib/translateError";

const PLANS: Plan[] = ["starter", "pro", "agence"];

interface StripeConfig {
  configured: boolean;
  testMode: boolean;
  testCard: string;
}

function libelleGestionnaires(
  t: (k: string, v?: Record<string, string>) => string,
  plan: Plan
): string {
  const max = GESTIONNAIRES_MAX[plan];
  if (max === 0) return t("features.managersNone");
  if (!Number.isFinite(max)) return t("features.managersUnlimited");
  return t("features.managers", { count: String(max) });
}

export default function AbonnementPage() {
  const ts = useTranslations("subscription");
  const t = useTranslations("crud");
  const tp = useTranslations("pages");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [profil, setProfil] = useState<Profil | null>(null);
  const [abonnement, setAbonnement] = useState<Abonnement | null>(null);
  const [limite, setLimite] = useState<LimiteBlocs | null>(null);
  const [factures, setFactures] = useState<FactureAbonnement[]>([]);
  const [paiementsMm, setPaiementsMm] = useState<PaiementMobileMoney[]>([]);
  const [stripeConfig, setStripeConfig] = useState<StripeConfig | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [planChoisi, setPlanChoisi] = useState<Plan | null>(null);
  const [aConfirmerDescente, setAConfirmerDescente] = useState<Plan | null>(null);
  const [aConfirmerAnnulation, setAConfirmerAnnulation] = useState(false);
  const [operateur, setOperateur] = useState<OperateurMobileMoney>("ecocash");
  const [telephone, setTelephone] = useState("");
  const [paiementEnCours, setPaiementEnCours] = useState(false);

  const demo = isDemoMode();

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
      const [pro, abo, lim, fac, mm] = await Promise.all([
        p.getProfil(),
        p.getAbonnement(),
        p.getLimiteBlocs(),
        p.listerFactures(),
        p.listerPaiementsMobileMoney(),
      ]);
      setProfil(pro);
      setAbonnement(abo);
      setLimite(lim);
      setFactures(fac);
      setPaiementsMm(mm);
      try {
        const res = await fetch("/api/stripe/checkout");
        if (res.ok) setStripeConfig((await res.json()) as StripeConfig);
      } catch {
        // L'état Stripe reste inconnu : on affiche « non configuré ».
      }
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

  function gererErreur(e: unknown) {
    setErreur(messageErreur(t as unknown as (k: string) => string, e));
  }

  /** Clic sur « Choisir ce plan » : descente -> confirmation, montée -> paiement. */
  function choisirPlan(plan: Plan) {
    setMessage(null);
    setErreur(null);
    if (!abonnement) return;
    if (plan === abonnement.plan && !abonnement.plan_en_attente && !abonnement.resiliation_programmee) return;
    if (RANG_PLAN[plan] < RANG_PLAN[abonnement.plan]) {
      setAConfirmerDescente(plan);
      return;
    }
    setPlanChoisi(plan);
  }

  async function confirmerDescente() {
    if (!aConfirmerDescente) return;
    const plan = aConfirmerDescente;
    setAConfirmerDescente(null);
    try {
      await getDataProvider().changerPlan(plan);
      setMessage(ts("downgradeDone"));
      await charger();
    } catch (e) {
      gererErreur(e);
    }
  }

  /** Montée (ou reprise) en démo : changement simulé, étiqueté DÉMO. */
  async function payerDemo(plan: Plan) {
    try {
      await getDataProvider().changerPlan(plan);
      setPlanChoisi(null);
      setMessage(ts("changeDone"));
      await charger();
    } catch (e) {
      gererErreur(e);
    }
  }

  /** Montée en réel : redirection vers Stripe Checkout (mode test). */
  async function payerCarte(plan: Plan) {
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
      const corps = (await res.json()) as { url?: string; message?: string };
      if (!res.ok || !corps.url) {
        setErreur(corps.message ?? ts("stripeNotConfigured"));
        return;
      }
      window.location.href = corps.url;
    } catch {
      setErreur(ts("stripeNotConfigured"));
    }
  }

  async function demanderMobileMoney(plan: Plan) {
    setPaiementEnCours(true);
    setErreur(null);
    try {
      await getDataProvider().demanderPaiementMobileMoney(operateur, telephone, plan);
      setMessage(ts("paymentRequested"));
      await charger();
    } catch (e) {
      gererErreur(e);
    } finally {
      setPaiementEnCours(false);
    }
  }

  /** Démo uniquement : simule la confirmation reçue sur le téléphone. */
  async function simulerConfirmation(reference: string) {
    try {
      await getDataProvider().confirmerPaiementMobileMoney(reference);
      setPlanChoisi(null);
      setMessage(ts("paymentConfirmed"));
      await charger();
    } catch (e) {
      gererErreur(e);
    }
  }

  async function annuler() {
    setAConfirmerAnnulation(false);
    try {
      await getDataProvider().annulerAbonnement();
      setMessage(ts("cancelDone"));
      await charger();
    } catch (e) {
      gererErreur(e);
    }
  }

  function telechargerFacture(facture: FactureAbonnement) {
    telechargerFactureAboPdf({
      facture,
      emetteurNom: profil?.nom ?? "CizaImmo",
      langue: locale === "en" ? "en" : "fr",
      demo,
    });
  }

  const lectureSeule = abonnement ? estLectureSeule(abonnement) : false;
  const statutCle =
    abonnement?.statut === "essai"
      ? "statusTrial"
      : abonnement?.statut === "actif"
        ? "statusActive"
        : abonnement?.statut === "lecture_seule"
          ? "statusReadOnly"
          : "statusCancelled";

  return (
    <AppShell title={tp("subscription.title")}>
      {chargement ? (
        <p className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm">{tc("loading")}</p>
      ) : profil && profil.role !== "proprietaire" ? (
        <p role="alert" className="rounded-2xl bg-white p-8 text-red-700 shadow-sm">
          {ts("accessDenied")}
        </p>
      ) : erreur ? (
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p role="alert" className="text-red-700">{erreur}</p>
          <button type="button" onClick={charger} className="mt-4 rounded-full bg-navy px-5 py-2 text-sm font-bold text-white">
            {t("common.retry")}
          </button>
        </div>
      ) : abonnement ? (
        <>
          {message ? (
            <p role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
              {message}
            </p>
          ) : null}

          {demo ? (
            <p role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {ts("demoNote")}
            </p>
          ) : null}

          {stripeConfig && !stripeConfig.configured && !demo ? (
            <p role="status" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {ts("stripeNotConfigured")}
            </p>
          ) : null}
          {stripeConfig?.configured ? (
            <p role="status" className="mb-4 rounded-xl bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
              {ts("stripeTestMode")}
            </p>
          ) : null}

          {lectureSeule ? (
            <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 shadow-sm">
              <p className="text-base font-bold text-red-800">{ts("readOnly")}</p>
              <p className="mt-1 text-sm text-red-700">{ts("readOnlyText")}</p>
              {abonnement.lecture_seule_jusqu_au ? (
                <p className="mt-1 text-sm text-red-700">
                  {ts("retentionUntil")} {formatDate(abonnement.lecture_seule_jusqu_au, locale)}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Plan actuel */}
          <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-navy">{ts("currentPlan")}</h2>
            <dl className="mt-3 space-y-2 text-base text-slate-700">
              <div className="flex justify-between gap-4">
                <dt className="font-semibold">{ts("plan")}</dt>
                <dd>{ts(`plans.${abonnement.plan}`)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-semibold">{ts("status")}</dt>
                <dd>{ts(statutCle)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-semibold">{ts("grid")}</dt>
                <dd>{abonnement.grille === "afrique" ? ts("gridAfrique") : ts("gridInternationale")}</dd>
              </div>
              {abonnement.statut === "essai" && abonnement.trial_ends_at ? (
                <div className="flex justify-between gap-4">
                  <dt className="font-semibold">{ts("trialEnds")}</dt>
                  <dd>{formatDate(abonnement.trial_ends_at, locale)}</dd>
                </div>
              ) : null}
              {abonnement.fin_periode ? (
                <div className="flex justify-between gap-4">
                  <dt className="font-semibold">{ts("periodEnds")}</dt>
                  <dd>{formatDate(abonnement.fin_periode, locale)}</dd>
                </div>
              ) : null}
              {limite ? (
                <div className="flex justify-between gap-4">
                  <dt className="font-semibold">{ts("blocks")}</dt>
                  <dd>
                    {Number.isFinite(limite.autorises)
                      ? ts("blocksUsed", { used: String(limite.utilises), allowed: String(limite.autorises) })
                      : ts("blocksUnlimited", { used: String(limite.utilises) })}
                  </dd>
                </div>
              ) : null}
            </dl>
            {abonnement.plan_en_attente && abonnement.date_effet_plan ? (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                {ts("pendingDowngrade")} —{" "}
                {ts("pendingDowngradeText", {
                  plan: ts(`plans.${abonnement.plan_en_attente}`),
                  date: formatDate(abonnement.date_effet_plan, locale),
                })}
              </p>
            ) : null}
            {abonnement.resiliation_programmee && abonnement.fin_periode ? (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                {ts("cancellationScheduled")} —{" "}
                {ts("cancellationScheduledText", { date: formatDate(abonnement.fin_periode, locale) })}
              </p>
            ) : null}
          </section>

          {/* Comparaison des plans */}
          <section className="mb-6">
            <h2 className="mb-3 text-lg font-bold text-navy">{ts("compareTitle")}</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {PLANS.map((plan) => {
                const estActuel = plan === abonnement.plan && !abonnement.plan_en_attente;
                const estDescente = RANG_PLAN[plan] < RANG_PLAN[abonnement.plan];
                return (
                  <article key={plan} className="rounded-2xl bg-white p-5 shadow-sm">
                    <h3 className="text-lg font-bold text-navy">{ts(`plans.${plan}`)}</h3>
                    <p className="mt-2 text-2xl font-bold text-navy">
                      {formatMoney(PRIX_PLANS[plan][abonnement.grille], "USD", locale)}
                      <span className="text-sm font-normal text-slate-500"> {ts("perMonth")}</span>
                    </p>
                    <p className="text-sm text-slate-500">
                      {abonnement.grille === "afrique" ? ts("gridAfrique") : ts("gridInternationale")}
                      {" · "}
                      {formatMoney(PRIX_PLANS[plan][abonnement.grille === "afrique" ? "internationale" : "afrique"], "USD", locale)}
                      {" "}
                      {abonnement.grille === "afrique" ? ts("gridInternationale") : ts("gridAfrique")}
                    </p>
                    <ul className="mt-3 space-y-1 text-sm text-slate-700">
                      <li>✓ {ts("features.fullManagement")}</li>
                      <li>✓ {ts("features.reports")}</li>
                      <li>✓ {libelleGestionnaires(ts, plan)}</li>
                      <li>
                        {VITRINE_PAR_PLAN[plan] ? "✓ " : "— "}
                        {VITRINE_PAR_PLAN[plan] ? ts("features.vitrineYes") : ts("features.vitrineNo")}
                      </li>
                      <li>
                        {INDIVISION_PAR_PLAN[plan] ? "✓ " : "— "}
                        {INDIVISION_PAR_PLAN[plan] ? ts("features.indivisionYes") : ts("features.indivisionNo")}
                      </li>
                    </ul>
                    <button
                      type="button"
                      disabled={estActuel}
                      onClick={() => choisirPlan(plan)}
                      className={
                        "mt-4 w-full rounded-full px-4 py-2.5 text-base font-bold " +
                        (estActuel
                          ? "bg-slate-100 text-slate-400"
                          : "bg-navy text-white hover:bg-navy-light")
                      }
                    >
                      {estActuel
                        ? ts("currentPlanButton")
                        : estDescente
                          ? `${ts("choosePlan")} (${ts("downgradeEffective")})`
                          : `${ts("choosePlan")} (${ts("upgradeNow")})`}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Paiement du plan choisi */}
          {planChoisi ? (
            <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-navy">
                {ts("payTitle", { plan: ts(`plans.${planChoisi}`) })}
              </h2>
              <p className="mt-1 text-base text-slate-700">
                {formatMoney(PRIX_PLANS[planChoisi][abonnement.grille], "USD", locale)} {ts("perMonth")} —{" "}
                {abonnement.grille === "afrique" ? ts("gridAfrique") : ts("gridInternationale")}
              </p>
              <div className="mt-4 flex flex-col gap-3">
                {demo ? (
                  <button
                    type="button"
                    onClick={() => payerDemo(planChoisi)}
                    className="rounded-full bg-gold px-5 py-2.5 text-base font-bold text-navy-dark hover:bg-gold-light"
                  >
                    {ts("simulateConfirm")} — {ts(`plans.${planChoisi}`)}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => payerCarte(planChoisi)}
                    className="rounded-full bg-navy px-5 py-2.5 text-base font-bold text-white hover:bg-navy-light"
                  >
                    {ts("payByCard")}
                  </button>
                )}
              </div>
              <div className="mt-6 border-t border-slate-200 pt-4">
                <h3 className="font-bold text-navy">{ts("payByMobileMoney")}</h3>
                <div className="mt-3 space-y-3">
                  <Field id="operateur" label={ts("operator")} value={operateur} onChange={(v) => setOperateur(v as OperateurMobileMoney)}>
                    <option value="ecocash">EcoCash</option>
                    <option value="lumicash">Lumicash</option>
                    <option value="enoti">eNoti</option>
                  </Field>
                  <Field
                    id="telephone-mm"
                    label={ts("phone")}
                    type="tel"
                    value={telephone}
                    onChange={setTelephone}
                    placeholder={ts("phonePlaceholder")}
                  />
                  <button
                    type="button"
                    disabled={paiementEnCours || !telephone.trim()}
                    onClick={() => demanderMobileMoney(planChoisi)}
                    className="w-full rounded-full bg-navy px-5 py-2.5 text-base font-bold text-white hover:bg-navy-light disabled:opacity-50"
                  >
                    {ts("requestPayment")}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPlanChoisi(null)}
                className="mt-4 text-sm font-semibold text-slate-600 underline"
              >
                {tc("cancel")}
              </button>
            </section>
          ) : null}

          {/* Paiements mobile money */}
          {paiementsMm.length > 0 ? (
            <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-navy">{ts("mmTitle")}</h2>
              <ul className="mt-3 space-y-3">
                {paiementsMm.map((p) => (
                  <li key={p.id} className="rounded-xl border border-slate-200 p-4">
                    <p className="text-base font-semibold text-slate-800">
                      {p.operateur} — {formatMoney(p.montant, "USD", locale)} — {ts(`plans.${p.plan}`)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {ts("reference")} : {p.reference} ·{" "}
                      {p.statut === "en_attente"
                        ? ts("paymentPending")
                        : p.statut === "confirme"
                          ? ts("paymentConfirmed")
                          : p.statut === "expire"
                            ? ts("paymentExpired")
                            : ts("paymentCancelled")}
                    </p>
                    {p.statut === "en_attente" ? (
                      <p className="text-sm text-slate-600">
                        {ts("expiresAt")} {formatDate(p.expire_le, locale)}
                      </p>
                    ) : null}
                    {p.statut === "en_attente" && demo ? (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => simulerConfirmation(p.reference)}
                          className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy-dark hover:bg-gold-light"
                        >
                          {ts("simulateConfirm")}
                        </button>
                        <p className="mt-1 text-xs text-slate-500">{ts("simulateConfirmHint")}</p>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Factures */}
          <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-navy">{ts("invoicesTitle")}</h2>
            {factures.length === 0 ? (
              <p className="mt-3 text-base text-slate-500">{ts("invoicesEmpty")}</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {factures.map((f) => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                    <div>
                      <p className="text-base font-semibold text-slate-800">
                        {f.numero} — {formatMoney(f.montant, "USD", locale)}
                      </p>
                      <p className="text-sm text-slate-600">
                        {formatDate(f.date_emission, locale)} · {ts(`plans.${f.plan}`)} ·{" "}
                        {f.moyen === "stripe"
                          ? ts("methodStripe")
                          : f.moyen === "mobile_money"
                            ? ts("methodMobileMoney")
                            : ts("methodDemo")}{" "}
                        · {f.statut === "payee" ? ts("statusPaid") : f.statut === "en_attente" ? ts("statusPending") : ts("statusCancelled")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => telechargerFacture(f)}
                      className="rounded-full border border-navy px-4 py-2 text-sm font-bold text-navy hover:bg-navy hover:text-white"
                    >
                      {ts("download")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Annulation */}
          <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-navy">{ts("cancelTitle")}</h2>
            {abonnement.resiliation_programmee ? (
              <p className="mt-2 text-base text-slate-700">
                {ts("cancellationScheduledText", { date: formatDate(abonnement.fin_periode, locale) })}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setAConfirmerAnnulation(true)}
                className="mt-3 rounded-full border border-red-600 px-5 py-2.5 text-base font-bold text-red-700 hover:bg-red-50"
              >
                {ts("cancelButton")}
              </button>
            )}
          </section>
        </>
      ) : (
        <p className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm">{tc("loading")}</p>
      )}

      {aConfirmerDescente ? (
        <ConfirmDialog
          title={ts("compareTitle")}
          text={ts("pendingDowngradeText", {
            plan: ts(`plans.${aConfirmerDescente}`),
            date: formatDate(abonnement?.fin_periode ?? abonnement?.trial_ends_at, locale),
          })}
          confirmLabel={ts("choosePlan")}
          cancelLabel={tc("cancel")}
          danger={false}
          onConfirm={confirmerDescente}
          onCancel={() => setAConfirmerDescente(null)}
        />
      ) : null}

      {aConfirmerAnnulation ? (
        <ConfirmDialog
          title={ts("cancelConfirmTitle")}
          text={ts("cancelConfirmText", { date: formatDate(abonnement?.fin_periode ?? abonnement?.trial_ends_at, locale) })}
          confirmLabel={ts("cancelConfirmButton")}
          cancelLabel={tc("cancel")}
          onConfirm={annuler}
          onCancel={() => setAConfirmerAnnulation(false)}
        />
      ) : null}
    </AppShell>
  );
}

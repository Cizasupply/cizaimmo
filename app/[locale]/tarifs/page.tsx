import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import {
  PRIX_PLANS,
  GESTIONNAIRES_MAX,
  VITRINE_PAR_PLAN,
  INDIVISION_PAR_PLAN,
} from "@/lib/abonnement";
import { LIMITE_BLOCS } from "@/lib/data/types";
import type { Plan } from "@/lib/data/types";

const plans: Plan[] = ["starter", "pro", "agence"];

function libelleGestionnaires(
  t: (k: string, v?: Record<string, string>) => string,
  plan: Plan
): string {
  const max = GESTIONNAIRES_MAX[plan];
  if (max === 0) return t("managersNone");
  if (!Number.isFinite(max)) return t("managersUnlimited");
  return t("managers", { count: String(max) });
}

function libelleBlocs(
  t: (k: string, v?: Record<string, string>) => string,
  plan: Plan
): string {
  const max = LIMITE_BLOCS[plan];
  if (!Number.isFinite(max)) return t("blocksUnlimited");
  return t("blocks", { count: String(max) });
}

function CartePlan({
  plan,
  grille,
  t,
}: {
  plan: Plan;
  grille: "afrique" | "internationale";
  t: (k: string, v?: Record<string, string>) => string;
}) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h3 className="text-xl font-bold text-navy">
        {plan === "starter" ? "Starter" : plan === "pro" ? "Pro" : "Agence"}
      </h3>
      <p className="mt-1 text-sm font-semibold text-slate-600">{libelleBlocs(t, plan)}</p>
      <p className="mt-4 text-3xl font-bold text-navy">
        ${PRIX_PLANS[plan][grille].toFixed(2)}
        <span className="text-base font-normal text-slate-500"> {t("perMonth")}</span>
      </p>
      <ul className="mt-4 space-y-2 text-sm text-slate-700">
        <li>✓ {t("fullManagement")}</li>
        <li>✓ {t("reports")}</li>
        <li>✓ {libelleGestionnaires(t, plan)}</li>
        <li>
          {VITRINE_PAR_PLAN[plan] ? "✓ " : "— "}
          {VITRINE_PAR_PLAN[plan] ? t("vitrineYes") : t("vitrineNo")}
        </li>
        <li>
          {INDIVISION_PAR_PLAN[plan] ? "✓ " : "— "}
          {INDIVISION_PAR_PLAN[plan] ? t("indivisionYes") : t("indivisionNo")}
        </li>
      </ul>
      <Link
        href="/inscription"
        className="mt-6 flex min-h-11 items-center justify-center rounded-full bg-navy px-5 py-3 text-center text-base font-bold text-white hover:bg-navy-light"
      >
        {t("cta")}
      </Link>
    </div>
  );
}

/**
 * Page publique Tarifs (Module 7, spec §4) : les 3 plans avec le nombre
 * de blocs, les deux grilles Afrique / Internationale affichées
 * séparément et sans ambiguïté, l'essai de 30 jours, le paiement par
 * carte et par mobile money. Aucun témoignage client : il n'en existe
 * pas de réel, aucun n'est inventé.
 */
export default async function TarifsPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations("landing.pricing");
  const tp = await getTranslations("pricingPage");

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 md:py-12">
        <h1 className="text-3xl font-bold text-navy md:text-4xl">{tp("title")}</h1>
        <p className="mt-3 max-w-2xl text-base text-slate-600 md:text-lg">{tp("subtitle")}</p>

        <section aria-labelledby="grille-afrique" className="mt-10">
          <h2 id="grille-afrique" className="text-2xl font-bold text-navy">
            {tp("africaTitle")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{tp("africaNote")}</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <CartePlan key={plan} plan={plan} grille="afrique" t={t} />
            ))}
          </div>
        </section>

        <section aria-labelledby="grille-internationale" className="mt-10">
          <h2 id="grille-internationale" className="text-2xl font-bold text-navy">
            {tp("internationalTitle")}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{tp("internationalNote")}</p>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <CartePlan key={plan} plan={plan} grille="internationale" t={t} />
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-2xl bg-navy-dark p-6 text-white sm:p-8">
          <h2 className="text-xl font-bold text-gold">{tp("trialTitle")}</h2>
          <p className="mt-2 text-base text-slate-200">{tp("trialText")}</p>
          <Link
            href="/inscription"
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-gold px-6 py-3 text-base font-bold text-navy-dark hover:bg-gold-light"
          >
            {t("cta")}
          </Link>
        </section>

        <section className="mt-10 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold text-navy">{tp("paymentTitle")}</h2>
          <ul className="mt-3 space-y-2 text-base text-slate-700">
            <li>• {tp("paymentCard")}</li>
            <li>• {tp("paymentMobileMoney")}</li>
          </ul>
          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-navy">
            {tp("paymentNote")}
          </p>
          <p className="mt-3 text-sm text-slate-500">{tp("annualNote")}</p>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}

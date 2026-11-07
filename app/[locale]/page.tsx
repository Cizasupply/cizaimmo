import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { PRIX_PLANS, GESTIONNAIRES_MAX, VITRINE_PAR_PLAN, INDIVISION_PAR_PLAN } from "@/lib/abonnement";
import type { Plan } from "@/lib/data/types";

const features = ["buildings", "roi", "currency", "reports"] as const;
const plans: Plan[] = ["starter", "pro", "agence"];

function libelleGestionnaires(t: (k: string, v?: Record<string, string>) => string, plan: Plan): string {
  const max = GESTIONNAIRES_MAX[plan];
  if (max === 0) return t("pricing.managersNone");
  if (!Number.isFinite(max)) return t("pricing.managersUnlimited");
  return t("pricing.managers", { count: String(max) });
}

export default async function LandingPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const tb = await getTranslations("brand");

  return (
    <div className="min-h-screen bg-navy-dark text-white">
      <PublicHeader />

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-16 text-center md:px-12">
        <section>
          <h1 className="text-4xl font-bold leading-tight md:text-6xl">
            {t("headline")}
          </h1>
          <p className="mt-4 text-xl text-gold">{tb("slogan")}</p>
          <p className="mt-6 text-lg text-slate-300">{t("subheadline")}</p>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Link
              href="/inscription"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-gold px-8 py-3 font-semibold text-navy-dark hover:bg-gold-light"
            >
              {t("ctaTrial")}
            </Link>
            <Link
              href="#tarifs"
              className="rounded-full border border-gold px-8 py-3 font-semibold text-gold hover:bg-gold hover:text-navy-dark"
            >
              {t("ctaSecondary")}
            </Link>
          </div>
        </section>

        <section className="mt-20 text-left">
          <div className="grid gap-6 sm:grid-cols-2">
            {features.map((f) => (
              <div
                key={f}
                className="rounded-2xl bg-navy p-6 border border-navy-light"
              >
                <h3 className="text-lg font-semibold text-gold">
                  {t(`features.${f}.title`)}
                </h3>
                <p className="mt-2 text-slate-300">{t(`features.${f}.desc`)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 text-left">
          <h2 className="text-center text-3xl font-bold">{t("benefitsTitle")}</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {(
              [
                ["benefitOccupancy", "benefitOccupancyText"],
                ["benefitCollection", "benefitCollectionText"],
                ["benefitReceipts", "benefitReceiptsText"],
                ["benefitRoi", "benefitRoiText"],
              ] as const
            ).map(([titre, texte]) => (
              <div key={titre} className="rounded-2xl bg-navy p-6 border border-navy-light">
                <h3 className="text-lg font-semibold text-gold">{t(titre)}</h3>
                <p className="mt-2 text-slate-300">{t(texte)}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-20 text-left">
          <h2 className="text-center text-3xl font-bold">{t("howTitle")}</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {(
              [
                ["howStep1Title", "howStep1Text"],
                ["howStep2Title", "howStep2Text"],
                ["howStep3Title", "howStep3Text"],
              ] as const
            ).map(([titre, texte]) => (
              <li key={titre} className="rounded-2xl bg-navy p-6 border border-navy-light">
                <h3 className="text-lg font-semibold text-gold">{t(titre)}</h3>
                <p className="mt-2 text-slate-300">{t(texte)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-20 text-left">
          <h2 className="text-center text-3xl font-bold">{t("currenciesTitle")}</h2>
          <p className="mt-3 text-center text-slate-300">{t("currenciesText")}</p>
          <p className="mt-4 text-center text-sm font-semibold tracking-wide text-gold">
            {t("currenciesList")}
          </p>
          <div className="mx-auto mt-8 max-w-md rounded-2xl bg-white p-6 text-left text-navy shadow-lg">
            <p className="text-sm font-semibold text-slate-500">{t("previewCurrencyLabel")}</p>
            <ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-300">
              <li className="flex items-center justify-between px-4 py-3 font-bold">
                <span>$ USD</span>
                <span aria-hidden="true" className="text-gold">✓</span>
              </li>
              <li className="flex items-center justify-between px-4 py-3">
                <span>€ EUR</span>
              </li>
              <li className="flex items-center justify-between px-4 py-3">
                <span>BIF</span>
              </li>
            </ul>
            <p className="mt-3 text-sm text-slate-500">{t("previewNote")}</p>
          </div>
          <h3 className="mt-12 text-center text-2xl font-bold">{t("previewTitle")}</h3>
          <p className="mt-3 text-center text-slate-300">{t("previewText")}</p>
        </section>

        <section id="tarifs" className="mt-20 text-left">
          <p className="text-center font-semibold text-gold">{t("pricingTeaser")}</p>
          <h2 className="mt-3 text-center text-3xl font-bold">{t("pricing.title")}</h2>
          <p className="mt-3 text-center text-slate-300">{t("pricing.subtitle")}</p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan}
                className="rounded-2xl bg-navy p-6 border border-navy-light"
              >
                <h3 className="text-xl font-bold text-gold">
                  {plan === "starter" ? "Starter" : plan === "pro" ? "Pro" : "Agence"}
                </h3>
                <p className="mt-2 text-slate-300">
                  {plan === "agence"
                    ? t("pricing.blocksUnlimited")
                    : t("pricing.blocks", { count: String(plan === "starter" ? 1 : 5) })}
                </p>
                <p className="mt-4 text-2xl font-bold">
                  ${PRIX_PLANS[plan].afrique.toFixed(2)}
                  <span className="text-sm font-normal text-slate-300">
                    {" "}{t("pricing.perMonth")} · {t("pricing.gridAfrique")}
                  </span>
                </p>
                <p className="mt-1 text-2xl font-bold">
                  ${PRIX_PLANS[plan].internationale.toFixed(2)}
                  <span className="text-sm font-normal text-slate-300">
                    {" "}{t("pricing.perMonth")} · {t("pricing.gridInternationale")}
                  </span>
                </p>
                <ul className="mt-4 space-y-2 text-sm text-slate-300">
                  <li>✓ {t("pricing.fullManagement")}</li>
                  <li>✓ {t("pricing.reports")}</li>
                  <li>✓ {libelleGestionnaires(t, plan)}</li>
                  <li>
                    {VITRINE_PAR_PLAN[plan] ? "✓ " : "— "}
                    {VITRINE_PAR_PLAN[plan] ? t("pricing.vitrineYes") : t("pricing.vitrineNo")}
                  </li>
                  <li>
                    {INDIVISION_PAR_PLAN[plan] ? "✓ " : "— "}
                    {INDIVISION_PAR_PLAN[plan] ? t("pricing.indivisionYes") : t("pricing.indivisionNo")}
                  </li>
                </ul>
                <Link
                  href="/inscription"
                  className="mt-6 block rounded-full bg-gold px-5 py-2.5 text-center font-semibold text-navy-dark hover:bg-gold-light"
                >
                  {t("pricing.cta")}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-slate-300">{t("pricing.trial")}</p>
          <p className="mt-2 text-center text-slate-300">{t("pricing.mobileMoney")}</p>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

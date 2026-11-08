import Image from "next/image";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import MiniGrilleTarifs from "@/components/MiniGrilleTarifs";
import { FournisseurDevise, SelecteurDeviseHero } from "@/components/DeviseAffichage";

const features = ["buildings", "roi", "currency", "reports"] as const;

/**
 * Page d'accueil publique — design « Marine & Or premium »
 * (2026-11-08, dernière surface traitée après l'espace client et
 * la console, validation du fondateur sur le même patron) :
 * VRAI HÉROS pleine largeur marine (dégradé sobre marine ->
 * marine foncé) : logo v4 dans l'en-tête (masquerEssai — le
 * héros porte LE bouton d'essai unique de la page, libellé le
 * plus clair « Commencer l'essai gratuit de 30 jours », primaire
 * or ; secondaire = « Demander une démonstration » -> contact,
 * aucun doublon de CTA), sélecteur de devise visible (état
 * partagé avec la mini-grille), photo réelle d'une résidence
 * premium (Pexels, licence libre — voir doc) en carte encadrée
 * qui chevauche la section crème suivante. Puis sections
 * alternées crème #F7F5F0 / blanc, titres marine SemiBold avec
 * filet or, cartes blanches bordées (patron de l'espace
 * connecté). Contenu, sections et textes inchangés — seule
 * nouveauté de copie : l'alt de la photo (heroPhotoAlt FR/EN).
 */
export default async function LandingPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const tb = await getTranslations("brand");
  const tc = await getTranslations("contact");

  return (
    <div className="min-h-screen bg-cream text-navy">
      <PublicHeader masquerEssai />

      <FournisseurDevise>
        <main>
          {/* Héros — marine pleine largeur, photo en chevauchement */}
          <section className="bg-gradient-to-b from-navy to-navy-dark text-white">
            <div className="mx-auto max-w-4xl px-6 pt-14 text-center md:px-12 md:pt-20">
              <h1 className="text-4xl font-bold leading-tight md:text-6xl">
                {t("headline")}
              </h1>
              <p className="mt-4 text-xl font-semibold text-gold">{tb("slogan")}</p>
              <p className="mt-6 text-lg text-slate-300">{t("subheadline")}</p>
              <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
                <Link
                  href="/inscription"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-gold px-8 py-3 font-semibold text-navy hover:bg-gold-light"
                >
                  {t("ctaTrial")}
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/70 px-8 py-3 font-semibold text-white hover:bg-white hover:text-navy"
                >
                  {tc("demoTitle")}
                </Link>
              </div>
              <div className="mt-10">
                <SelecteurDeviseHero />
              </div>
            </div>
            <div className="relative z-10 mx-auto max-w-3xl px-6">
              <figure className="-mb-20 mt-12 md:-mb-28">
                <Image
                  src="/hero-residence.jpg"
                  alt={t("heroPhotoAlt")}
                  width={1440}
                  height={960}
                  priority
                  className="h-auto w-full rounded-2xl border border-white/40 object-cover shadow-2xl"
                />
              </figure>
            </div>
          </section>

          {/* Fonctionnalités — crème, cartes blanches (dégage le chevauchement) */}
          <section className="bg-cream">
            <div className="mx-auto max-w-4xl px-6 pb-16 pt-36 text-left md:px-12 md:pb-20 md:pt-48">
              <div className="grid gap-6 sm:grid-cols-2">
                {features.map((f) => (
                  <div
                    key={f}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <h3 className="text-lg font-semibold text-navy">
                      {t(`features.${f}.title`)}
                    </h3>
                    <p className="mt-2 text-slate-600">{t(`features.${f}.desc`)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Bénéfices — blanc */}
          <section className="bg-white">
            <div className="mx-auto max-w-4xl px-6 py-16 text-left md:px-12 md:py-20">
              <h2 className="text-center text-3xl font-semibold text-navy">
                {t("benefitsTitle")}
              </h2>
              <span className="mx-auto mt-4 block h-1 w-16 rounded-full bg-gold" />
              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                {(
                  [
                    ["benefitOccupancy", "benefitOccupancyText"],
                    ["benefitCollection", "benefitCollectionText"],
                    ["benefitReceipts", "benefitReceiptsText"],
                    ["benefitRoi", "benefitRoiText"],
                  ] as const
                ).map(([titre, texte]) => (
                  <div key={titre} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-navy">{t(titre)}</h3>
                    <p className="mt-2 text-slate-600">{t(texte)}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Fonctionnement — crème */}
          <section className="bg-cream">
            <div className="mx-auto max-w-4xl px-6 py-16 text-left md:px-12 md:py-20">
              <h2 className="text-center text-3xl font-semibold text-navy">{t("howTitle")}</h2>
              <span className="mx-auto mt-4 block h-1 w-16 rounded-full bg-gold" />
              <ol className="mt-8 grid gap-6 md:grid-cols-3">
                {(
                  [
                    ["howStep1Title", "howStep1Text"],
                    ["howStep2Title", "howStep2Text"],
                    ["howStep3Title", "howStep3Text"],
                  ] as const
                ).map(([titre, texte]) => (
                  <li key={titre} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-navy">{t(titre)}</h3>
                    <p className="mt-2 text-slate-600">{t(texte)}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* Devises — blanc */}
          <section className="bg-white">
            <div className="mx-auto max-w-4xl px-6 py-16 text-left md:px-12 md:py-20">
              <h2 className="text-center text-3xl font-semibold text-navy">{t("currenciesTitle")}</h2>
              <span className="mx-auto mt-4 block h-1 w-16 rounded-full bg-gold" />
              <p className="mt-4 text-center text-slate-600">{t("currenciesText")}</p>
              <p className="mt-4 text-center text-sm font-semibold tracking-wide text-gold-dark">
                {t("currenciesList")}
              </p>
              <h3 className="mt-12 text-center text-2xl font-semibold text-navy">{t("previewTitle")}</h3>
              <p className="mt-3 text-center text-slate-600">{t("previewText")}</p>
            </div>
          </section>

          {/* Tarifs — crème, mini-grille dynamique inchangée dans sa mécanique */}
          <section id="tarifs" className="bg-cream">
            <div className="mx-auto max-w-4xl px-6 py-16 text-left md:px-12 md:py-20">
              <p className="text-center font-semibold text-gold-dark">{t("pricingTeaser")}</p>
              <h2 className="mt-3 text-center text-3xl font-semibold text-navy">{t("pricing.title")}</h2>
              <span className="mx-auto mt-4 block h-1 w-16 rounded-full bg-gold" />
              <p className="mt-4 text-center text-slate-600">{t("pricing.subtitle")}</p>
              <MiniGrilleTarifs />
              <p className="mt-8 text-center text-slate-600">{t("pricing.trial")}</p>
              <p className="mt-2 text-center text-slate-600">{t("pricing.mobileMoney")}</p>
            </div>
          </section>
        </main>
      </FournisseurDevise>

      <PublicFooter />
    </div>
  );
}

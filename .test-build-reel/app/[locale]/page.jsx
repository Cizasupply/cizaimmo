"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LandingPage;
const image_1 = __importDefault(require("next/image"));
const link_1 = __importDefault(require("next/link"));
const server_1 = require("next-intl/server");
const PublicHeader_1 = __importDefault(require("@/components/PublicHeader"));
const PublicFooter_1 = __importDefault(require("@/components/PublicFooter"));
const MiniGrilleTarifs_1 = __importDefault(require("@/components/MiniGrilleTarifs"));
const DeviseAffichage_1 = require("@/components/DeviseAffichage");
const features = ["buildings", "roi", "currency", "reports"];
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
async function LandingPage({ params: { locale }, }) {
    (0, server_1.setRequestLocale)(locale);
    const t = await (0, server_1.getTranslations)("landing");
    const tb = await (0, server_1.getTranslations)("brand");
    const tc = await (0, server_1.getTranslations)("contact");
    return (<div className="min-h-screen bg-cream text-navy">
      <PublicHeader_1.default masquerEssai/>

      <DeviseAffichage_1.FournisseurDevise>
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
                <link_1.default href="/inscription" className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-full bg-gold px-4 py-3 text-center text-[13px] font-semibold tracking-tight text-navy hover:bg-gold-light sm:px-8 sm:text-base sm:tracking-normal">
                  {t("ctaTrial")}
                </link_1.default>
                <link_1.default href="/contact" className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-full border border-white/70 px-4 py-3 text-center text-[13px] font-semibold tracking-tight text-white hover:bg-white hover:text-navy sm:px-8 sm:text-base sm:tracking-normal">
                  {tc("demoTitle")}
                </link_1.default>
              </div>
              <div className="mt-10">
                <DeviseAffichage_1.SelecteurDeviseHero />
              </div>
            </div>
            <div className="relative z-10 mx-auto max-w-3xl px-6">
              <figure className="-mb-20 mt-12 md:-mb-28">
                <image_1.default src="/hero-residence.jpg" alt={t("heroPhotoAlt")} width={1440} height={960} priority className="h-auto w-full rounded-2xl border border-white/40 object-cover shadow-2xl"/>
              </figure>
            </div>
          </section>

          {/* Fonctionnalités — crème, cartes blanches (dégage le chevauchement) */}
          <section className="bg-cream">
            <div className="mx-auto max-w-4xl px-6 pb-16 pt-36 text-left md:px-12 md:pb-20 md:pt-48">
              <div className="grid gap-6 sm:grid-cols-2">
                {features.map((f) => (<div key={f} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-navy">
                      {t(`features.${f}.title`)}
                    </h3>
                    <p className="mt-2 text-slate-600">{t(`features.${f}.desc`)}</p>
                  </div>))}
              </div>
            </div>
          </section>

          {/* Bénéfices — blanc */}
          <section className="bg-white">
            <div className="mx-auto max-w-4xl px-6 py-16 text-left md:px-12 md:py-20">
              <h2 className="text-center text-3xl font-semibold text-navy">
                {t("benefitsTitle")}
              </h2>
              <span className="mx-auto mt-4 block h-1 w-16 rounded-full bg-gold"/>
              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                {[
            ["benefitOccupancy", "benefitOccupancyText"],
            ["benefitCollection", "benefitCollectionText"],
            ["benefitReceipts", "benefitReceiptsText"],
            ["benefitRoi", "benefitRoiText"],
        ].map(([titre, texte]) => (<div key={titre} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-navy">{t(titre)}</h3>
                    <p className="mt-2 text-slate-600">{t(texte)}</p>
                  </div>))}
              </div>
            </div>
          </section>

          {/* Fonctionnement — crème */}
          <section className="bg-cream">
            <div className="mx-auto max-w-4xl px-6 py-16 text-left md:px-12 md:py-20">
              <h2 className="text-center text-3xl font-semibold text-navy">{t("howTitle")}</h2>
              <span className="mx-auto mt-4 block h-1 w-16 rounded-full bg-gold"/>
              <ol className="mt-8 grid gap-6 md:grid-cols-3">
                {[
            ["howStep1Title", "howStep1Text"],
            ["howStep2Title", "howStep2Text"],
            ["howStep3Title", "howStep3Text"],
        ].map(([titre, texte]) => (<li key={titre} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-navy">{t(titre)}</h3>
                    <p className="mt-2 text-slate-600">{t(texte)}</p>
                  </li>))}
              </ol>
            </div>
          </section>

          {/* Devises — blanc */}
          <section className="bg-white">
            <div className="mx-auto max-w-4xl px-6 py-16 text-left md:px-12 md:py-20">
              <h2 className="text-center text-3xl font-semibold text-navy">{t("currenciesTitle")}</h2>
              <span className="mx-auto mt-4 block h-1 w-16 rounded-full bg-gold"/>
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
              <span className="mx-auto mt-4 block h-1 w-16 rounded-full bg-gold"/>
              <p className="mt-4 text-center text-slate-600">{t("pricing.subtitle")}</p>
              <MiniGrilleTarifs_1.default />
              <p className="mt-8 text-center text-slate-600">{t("pricing.trial")}</p>
              <p className="mt-2 text-center text-slate-600">{t("pricing.mobileMoney")}</p>
            </div>
          </section>
        </main>
      </DeviseAffichage_1.FournisseurDevise>

      <PublicFooter_1.default />
    </div>);
}

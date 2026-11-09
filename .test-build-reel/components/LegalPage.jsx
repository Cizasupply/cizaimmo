"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LegalPage;
const server_1 = require("next-intl/server");
const PublicHeader_1 = __importDefault(require("@/components/PublicHeader"));
const PublicFooter_1 = __importDefault(require("@/components/PublicFooter"));
/**
 * Gabarit des pages légales (Module 7, spec §4) : lecture seule,
 * langage clair, FR + EN. Chaque page rappelle noir sur blanc les
 * trois règles : CizaImmo n'encaisse pas les loyers et ne conserve
 * pas d'argent pour le compte de tiers ; les données du parc
 * appartiennent au propriétaire ; conservation 90 jours en lecture
 * seule après la fin de l'abonnement.
 */
async function LegalPage({ params, page, sections, }) {
    (0, server_1.setRequestLocale)(params.locale);
    const t = await (0, server_1.getTranslations)(`legal.${page}`);
    const tc = await (0, server_1.getTranslations)("legal.common");
    return (<div className="flex min-h-screen flex-col bg-slate-50">
      <PublicHeader_1.default />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 md:py-12">
        <h1 className="text-3xl font-bold text-navy md:text-4xl">{t("title")}</h1>
        <p className="mt-3 text-base text-slate-600 md:text-lg">{t("intro")}</p>

        <div className="mt-6 rounded-2xl border border-gold/50 bg-amber-50 p-5 sm:p-6">
          <p className="text-base font-semibold text-navy">{tc("noRentCollection")}</p>
          <p className="mt-3 text-base text-slate-700">{tc("dataOwnership")}</p>
          <p className="mt-3 text-base text-slate-700">{tc("retention90")}</p>
        </div>

        {Array.from({ length: sections }, (_, i) => i + 1).map((n) => (<section key={n} className="mt-8">
            <h2 className="text-xl font-bold text-navy">{t(`s${n}Title`)}</h2>
            <p className="mt-2 text-base leading-relaxed text-slate-700">{t(`s${n}Text`)}</p>
          </section>))}

        <p className="mt-10 rounded-2xl bg-white p-5 text-sm text-slate-600 shadow-sm">
          {tc("contactLine")}
        </p>
        <p className="mt-3 text-xs text-slate-500">{tc("updated")}</p>
      </main>
      <PublicFooter_1.default />
    </div>);
}

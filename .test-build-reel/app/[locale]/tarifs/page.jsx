"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = TarifsPage;
const link_1 = __importDefault(require("next/link"));
const server_1 = require("next-intl/server");
const PublicHeader_1 = __importDefault(require("@/components/PublicHeader"));
const PublicFooter_1 = __importDefault(require("@/components/PublicFooter"));
const GrilleTarifsPublique_1 = __importDefault(require("@/components/GrilleTarifsPublique"));
/**
 * Page publique Tarifs : les 3 plans, les deux grilles Afrique /
 * Internationale affichées séparément et sans ambiguïté, l'essai,
 * le paiement par carte et par mobile money. Les PRIX sont dynamiques
 * (extension v1.2 : lus depuis la base via le composant client
 * GrilleTarifsPublique — aucun prix codé en dur ici). Aucun témoignage
 * client : il n'en existe pas de réel, aucun n'est inventé.
 */
async function TarifsPage({ params: { locale }, }) {
    (0, server_1.setRequestLocale)(locale);
    const t = await (0, server_1.getTranslations)("landing.pricing");
    const tp = await (0, server_1.getTranslations)("pricingPage");
    return (<div className="flex min-h-screen flex-col bg-slate-50">
      <PublicHeader_1.default />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 md:py-12">
        <h1 className="text-3xl font-bold text-navy md:text-4xl">{tp("title")}</h1>
        <p className="mt-3 max-w-2xl text-base text-slate-600 md:text-lg">{tp("subtitle")}</p>

        <GrilleTarifsPublique_1.default africaTitle={tp("africaTitle")} africaNote={tp("africaNote")} internationalTitle={tp("internationalTitle")} internationalNote={tp("internationalNote")}/>

        <section className="mt-10 rounded-2xl bg-navy-dark p-6 text-white sm:p-8">
          <h2 className="text-xl font-bold text-gold">{tp("trialTitle")}</h2>
          <p className="mt-2 text-base text-slate-200">{tp("trialText")}</p>
          <link_1.default href="/inscription" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-gold px-6 py-3 text-base font-bold text-navy-dark hover:bg-gold-light">
            {t("cta")}
          </link_1.default>
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
      <PublicFooter_1.default />
    </div>);
}

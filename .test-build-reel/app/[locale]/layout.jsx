"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadata = void 0;
exports.generateStaticParams = generateStaticParams;
exports.default = LocaleLayout;
const next_intl_1 = require("next-intl");
const server_1 = require("next-intl/server");
const navigation_1 = require("next/navigation");
const DemoBanner_1 = __importDefault(require("@/components/DemoBanner"));
require("../globals.css");
const locales = ["fr", "en"];
exports.metadata = {
    title: "CizaImmo — Vos biens, gérés simplement.",
    description: "Plateforme de gestion immobilière : immeubles, locataires, loyers, dépenses et ROI. Division de Ciza Group.",
};
function generateStaticParams() {
    return locales.map((locale) => ({ locale }));
}
async function LocaleLayout({ children, params: { locale }, }) {
    if (!locales.includes(locale))
        (0, navigation_1.notFound)();
    (0, server_1.setRequestLocale)(locale);
    const messages = await (0, server_1.getMessages)();
    return (<html lang={locale}>
      <body>
        <next_intl_1.NextIntlClientProvider messages={messages}>
          <DemoBanner_1.default />
          {children}
        </next_intl_1.NextIntlClientProvider>
      </body>
    </html>);
}

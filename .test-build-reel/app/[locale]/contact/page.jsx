"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ContactPage;
const server_1 = require("next-intl/server");
const PublicHeader_1 = __importDefault(require("@/components/PublicHeader"));
const PublicFooter_1 = __importDefault(require("@/components/PublicFooter"));
const ContactForm_1 = __importDefault(require("@/components/ContactForm"));
/**
 * Page publique Contact / Démo (Module 7, spec §4) : nom, e-mail,
 * téléphone / WhatsApp, nombre de biens, message, demande de
 * démonstration, lien WhatsApp. Aucune donnée de parc n'est demandée.
 *
 * Envoi : Web3Forms via la variable d'environnement publique
 * NEXT_PUBLIC_WEB3FORMS_KEY (même alias que cizagroup.com et
 * cizasupply.com). Si la clé est absente, le formulaire ne prétend
 * pas envoyer : il bascule honnêtement sur un lien mailto vers
 * infos@cizagroup.com, avec le message déjà rédigé.
 */
async function ContactPage({ params: { locale }, }) {
    (0, server_1.setRequestLocale)(locale);
    const t = await (0, server_1.getTranslations)("contact");
    return (<div className="flex min-h-screen flex-col bg-slate-50">
      <PublicHeader_1.default />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 md:py-12">
        <h1 className="text-3xl font-bold text-navy md:text-4xl">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-base text-slate-600 md:text-lg">{t("subtitle")}</p>
        <ContactForm_1.default />
      </main>
      <PublicFooter_1.default />
    </div>);
}

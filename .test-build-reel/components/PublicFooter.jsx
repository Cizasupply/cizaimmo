"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = PublicFooter;
const link_1 = __importDefault(require("next/link"));
const next_intl_1 = require("next-intl");
const LanguageSwitcher_1 = __importDefault(require("@/components/LanguageSwitcher"));
/**
 * Pied de page commun des pages publiques (spec §4) : colonnes
 * Produit / Entreprise / Légal / Contact, lien bien visible vers le
 * site mère https://cizagroup.com (nouvel onglet), mention
 * « CizaImmo, division de Ciza Group », e-mail de contact,
 * bascule de langue visible en permanence, copyright.
 * Sur mobile, une seule colonne ordonnée, sans débordement à 390 px.
 * Copyright : ligne ENTIÈRE sur une seule ligne centrée en mobile
 * (whitespace-nowrap, text-[10px] ; correctif 2026-11-08 — avant,
 * « réservés. » tombait sur une 2e ligne) ; taille d'origine
 * (text-xs) restaurée dès md, bureau inchangé.
 *
 * Clés i18n nouvelles (namespace "footer", à ajouter dans
 * messages/fr.json et messages/en.json) : product, company, legal,
 * rentals, parentSite. Les autres clés existent déjà.
 */
function PublicFooter() {
    const tn = (0, next_intl_1.useTranslations)("nav");
    const tb = (0, next_intl_1.useTranslations)("brand");
    const tf = (0, next_intl_1.useTranslations)("footer");
    const tc = (0, next_intl_1.useTranslations)("common");
    return (<footer className="border-t border-navy-light bg-navy px-4 py-10 text-sm text-slate-300 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Marque */}
          <div>
            <p className="text-base font-bold text-white">
              <span className="text-white">CIZA</span>
              <span className="text-gold">IMMO</span>
            </p>
            <p className="mt-2 text-slate-400">{tf("tagline")}</p>
            <p className="mt-2 text-slate-400">
              CizaImmo — {tb("division")}
            </p>
            <p className="mt-2">
              <a href="mailto:infos@cizagroup.com" className="break-all text-gold hover:underline">
                {tf("contactEmail")}
              </a>
            </p>
          </div>

          {/* Produit */}
          <nav aria-label={tf("product")}>
            <p className="text-sm font-bold uppercase tracking-wide text-white">
              {tf("product")}
            </p>
            <ul className="mt-3 space-y-2 font-semibold">
              <li>
                <link_1.default href="/tarifs" className="rounded px-1 py-2 hover:text-gold">
                  {tn("pricing")}
                </link_1.default>
              </li>
              <li>
                <link_1.default href="/a-louer" className="rounded px-1 py-2 hover:text-gold">
                  {tf("rentals")}
                </link_1.default>
              </li>
              <li>
                <link_1.default href="/" className="rounded px-1 py-2 hover:text-gold">
                  {tn("home")}
                </link_1.default>
              </li>
            </ul>
          </nav>

          {/* Entreprise — lien vers le site mère */}
          <nav aria-label={tf("company")}>
            <p className="text-sm font-bold uppercase tracking-wide text-white">
              {tf("company")}
            </p>
            <ul className="mt-3 space-y-2 font-semibold">
              <li>
                <a href="https://cizagroup.com" target="_blank" rel="noopener noreferrer" className="rounded px-1 py-2 text-gold hover:underline">
                  {tf("parentSite")} ↗
                </a>
              </li>
              <li>
                <link_1.default href="/a-propos" className="rounded px-1 py-2 hover:text-gold">
                  {tn("about")}
                </link_1.default>
              </li>
              <li>
                <link_1.default href="/contact" className="rounded px-1 py-2 hover:text-gold">
                  {tn("contact")}
                </link_1.default>
              </li>
            </ul>
          </nav>

          {/* Légal */}
          <nav aria-label={tf("legal")}>
            <p className="text-sm font-bold uppercase tracking-wide text-white">
              {tf("legal")}
            </p>
            <ul className="mt-3 space-y-2 font-semibold">
              <li>
                <link_1.default href="/legal/confidentialite" className="rounded px-1 py-2 hover:text-gold">
                  {tn("privacy")}
                </link_1.default>
              </li>
              <li>
                <link_1.default href="/legal/cgu" className="rounded px-1 py-2 hover:text-gold">
                  {tn("terms")}
                </link_1.default>
              </li>
              <li>
                <link_1.default href="/legal/mentions-legales" className="rounded px-1 py-2 hover:text-gold">
                  {tn("legalNotice")}
                </link_1.default>
              </li>
              <li>
                <link_1.default href="/legal/cookies" className="rounded px-1 py-2 hover:text-gold">
                  {tn("cookies")}
                </link_1.default>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-slate-700 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="whitespace-nowrap text-center text-[10px] text-slate-500 sm:text-left md:text-xs">
            {tc("rights")}
          </p>
          <p className="flex items-center gap-3 text-xs text-slate-400">
            <span>{tf("languageLabel")}</span>
            <LanguageSwitcher_1.default className="border-slate-500 text-slate-200 hover:border-gold hover:text-gold"/>
          </p>
        </div>
      </div>
    </footer>);
}

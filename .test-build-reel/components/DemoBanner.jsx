"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DemoBanner;
const next_intl_1 = require("next-intl");
const supabase_1 = require("@/lib/supabase");
/**
 * Bandeau « MODE DÉMO — données fictives », visible partout en mode démo
 * (rendu dans le layout localisé). En mode réel : rien.
 * Les données démo ne sont JAMAIS présentées comme réelles.
 */
function DemoBanner() {
    const t = (0, next_intl_1.useTranslations)("demo");
    if (!(0, supabase_1.isDemoMode)())
        return null;
    return (<div role="status" className="bg-gold px-4 py-2 text-center text-sm font-bold text-navy-dark">
      {t("banner")}
      <span className="ml-2 hidden font-normal sm:inline">{t("bannerDetail")}</span>
    </div>);
}

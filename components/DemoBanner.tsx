"use client";

import { useTranslations } from "next-intl";
import { isDemoMode } from "@/lib/supabase";

/**
 * Bandeau « MODE DÉMO — données fictives », visible partout en mode démo
 * (rendu dans le layout localisé). En mode réel : rien.
 * Les données démo ne sont JAMAIS présentées comme réelles.
 */
export default function DemoBanner() {
  const t = useTranslations("demo");
  if (!isDemoMode()) return null;
  return (
    <div
      role="status"
      className="bg-gold px-4 py-2 text-center text-sm font-bold text-navy-dark"
    >
      {t("banner")}
      <span className="ml-2 hidden font-normal sm:inline">{t("bannerDetail")}</span>
    </div>
  );
}

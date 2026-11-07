"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";

/**
 * Bascule de langue FR / EN (spec §4, §14 : visible en permanence,
 * choix mémorisé). Le choix est conservé dans localStorage et dans le
 * cookie de locale de next-intl ; le lien pointe vers la même page
 * dans l'autre langue, pour ne jamais perdre le visiteur.
 */
export function switchPathForLocale(pathname: string, targetLocale: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "fr" || parts[0] === "en") parts.shift();
  const rest = parts.length > 0 ? `/${parts.join("/")}` : "";
  // Avec localePrefix "as-needed", "fr" n'a pas de préfixe dans l'URL.
  return targetLocale === "fr" ? rest || "/" : `/${targetLocale}${rest}`;
}

export default function LanguageSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("common");
  const otherLocale = locale === "fr" ? "en" : "fr";

  useEffect(() => {
    try {
      window.localStorage.setItem("cizaimmo-locale", locale);
    } catch {
      // Stockage indisponible : la bascule par lien reste fonctionnelle.
    }
  }, [locale]);

  /**
   * Le middleware next-intl (localePrefix "as-needed", defaultLocale "fr")
   * résout la locale de "/" d'abord via le cookie NEXT_LOCALE, puis via
   * Accept-Language. Sans ce cookie, un clic vers "/" depuis /en avec un
   * navigateur en anglais était redirigé vers /en : la bascule ne
   * fonctionnait pas. On pose donc le cookie (mêmes attributs que
   * next-intl : max-age 1 an, SameSite=Lax) avant la navigation, dans
   * les deux sens (FR→EN et EN→FR).
   */
  function handleClick() {
    try {
      document.cookie = `NEXT_LOCALE=${otherLocale}; path=/; max-age=31536000; SameSite=Lax`;
    } catch {
      // Cookie indisponible : la bascule par lien reste fonctionnelle.
    }
  }

  return (
    <Link
      href={switchPathForLocale(pathname ?? "/", otherLocale)}
      onClick={handleClick}
      aria-label={`${t("language")} : ${otherLocale === "fr" ? "Français" : "English"}`}
      className={`inline-flex min-h-11 items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold ${className}`}
    >
      {otherLocale === "fr" ? "Français" : "English"}
    </Link>
  );
}

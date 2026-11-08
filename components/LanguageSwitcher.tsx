"use client";

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

export default function LanguageSwitcher({
  className = "",
  compact = false,
}: {
  className?: string;
  /**
   * Variante « pastille compacte » (correctif mobile 2026-11-08) :
   * code langue court (« EN » / « FR ») et pastille réduite, pour les
   * barres supérieures mobiles où la pastille pleine (« English » /
   * « Français ») + logo + déconnexion débordaient hors écran. Le nom
   * complet reste annoncé par l'aria-label.
   */
  compact?: boolean;
}) {
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
   * Navigation PLEINE (rechargement complet), pas de navigation côté
   * client : vérifié en live le 2026-11-06, le <Link> de Next.js ne
   * bascule pas la locale dans le sens EN→FR (l'URL française n'a
   * pas de préfixe avec localePrefix "as-needed", le routeur client
   * reste sur /en et le middleware renvoie l'utilisateur sur la page
   * anglaise — c'est le « retour en arrière » signalé). Avec une
   * ancre <a> classique, le navigateur recharge la page entière et
   * le middleware voit le cookie NEXT_LOCALE fraîchement posé :
   * la bascule fonctionne dans les deux sens, sur la même page.
   */
  function handleClick() {
    try {
      document.cookie = `NEXT_LOCALE=${otherLocale}; path=/; max-age=31536000; SameSite=Lax`;
      window.localStorage.setItem("cizaimmo-locale", otherLocale);
    } catch {
      // Cookie indisponible : la bascule par lien reste fonctionnelle.
    }
  }

  return (
    <a
      href={switchPathForLocale(pathname ?? "/", otherLocale)}
      onClick={handleClick}
      aria-label={`${t("language")} : ${otherLocale === "fr" ? "Français" : "English"}`}
      className={`inline-flex items-center justify-center rounded-full border font-semibold ${
        compact ? "min-h-10 px-3 py-1.5 text-xs" : "min-h-11 px-4 py-2 text-sm"
      } ${className}`}
    >
      {compact
        ? otherLocale.toUpperCase()
        : otherLocale === "fr"
          ? "Français"
          : "English"}
    </a>
  );
}

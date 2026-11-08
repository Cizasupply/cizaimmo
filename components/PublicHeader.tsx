"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";

/**
 * En-tête commun des pages publiques (spec §4) : logo, navigation
 * (Tarifs, Appartements à louer, Contact), connexion / essai gratuit,
 * bascule de langue toujours visible. UN SEUL en-tête pour toutes les
 * pages publiques (accueil, tarifs, a-louer, contact, légales).
 *
 * Mise en page — mobile et tablette (< xl) : trois lignes ordonnées,
 * sans flex-wrap désordonné : (1) logo + langue, (2) navigation,
 * (3) Connexion + Essai gratuit côte à côte. Ordinateur large (xl+) :
 * une seule ligne logo | nav | Connexion | Essai | langue.
 * Le bouton « Connexion » est un bouton encadré doré, distinct du
 * bouton doré plein « Essai gratuit ».
 * Logo responsive : 180 px sur mobile, 260 px à partir de md.
 */
export default function PublicHeader({
  masquerEssai = false,
}: {
  /**
   * Page d'accueil uniquement (2026-11-08, règle du fondateur :
   * aucun doublon de CTA) : le bouton « Essai gratuit » de
   * l'en-tête y est masqué car le héros porte LE bouton d'essai
   * unique de la page (« Commencer l'essai gratuit de 30 jours »,
   * primaire or). Toutes les autres pages publiques gardent
   * l'en-tête complet, inchangé par défaut.
   */
  masquerEssai?: boolean;
} = {}) {
  const t = useTranslations("landing");
  const tn = useTranslations("nav");
  const ta = useTranslations("auth");
  return (
    <header className="bg-navy px-4 py-4 text-white sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 xl:flex-nowrap xl:justify-between">
        <Link href="/" aria-label="CizaImmo — Accueil" className="order-1 shrink-0">
          <Image
            src="/cizaimmo-logo-v4.png"
            alt="CizaImmo"
            width={260}
            height={115}
            priority
            className="h-auto w-[180px] md:w-[260px]"
          />
        </Link>
        <LanguageSwitcher className="order-2 ml-auto border-gold text-gold hover:bg-gold hover:text-navy-dark xl:order-5 xl:ml-0" />
        <nav className="order-3 flex w-full flex-wrap items-center gap-x-5 gap-y-1 text-sm font-semibold xl:order-2 xl:w-auto xl:flex-nowrap">
          <Link href="/tarifs" className="rounded px-1 py-2 hover:text-gold">
            {tn("pricing")}
          </Link>
          <Link href="/a-louer" className="rounded px-1 py-2 hover:text-gold">
            {t("navRent")}
          </Link>
          <Link href="/contact" className="rounded px-1 py-2 hover:text-gold">
            {tn("contact")}
          </Link>
        </nav>
        <div className="order-4 flex w-full items-center gap-3 xl:order-3 xl:w-auto xl:shrink-0">
          <Link
            href="/connexion"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-gold px-5 py-2.5 text-sm font-semibold text-gold hover:bg-gold hover:text-navy-dark xl:flex-none"
          >
            {ta("loginButton")}
          </Link>
          {masquerEssai ? null : (
            <Link
              href="/inscription"
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy-dark hover:bg-gold-light xl:flex-none"
            >
              {t("ctaTrialShort")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";

/**
 * En-tête commun des pages publiques (spec §4) : logo, navigation
 * (Tarifs, Appartements à louer, Contact), connexion / essai gratuit,
 * bascule de langue toujours visible. UN SEUL en-tête pour toutes les
 * pages publiques (accueil, tarifs, a-louer, a-propos, contact, légales).
 *
 * Mise en page — mobile et tablette (< xl) : trois lignes ordonnées,
 * sans flex-wrap désordonné : (1) logo + langue, (2) navigation —
 * les QUATRE liens sur UNE SEULE ligne, au même niveau (flex-nowrap,
 * taille et espacements réduits sur mobile ; correctif 2026-11-08 :
 * « Contact » tombait sur une deuxième ligne),
 * (3) Connexion + Essai gratuit côte à côte. Ordinateur large (xl+) :
 * une seule ligne logo | nav | Connexion | Essai | langue.
 * Durcissement captures 2026-11-08 : aucun débordement horizontal —
 * la navigation passe en 11 px espacements réduits sous 400 px (les
 * 4 liens restent sur UNE ligne) et les deux boutons sont flexibles
 * (min-w-0, libellé insécable, padding réduit sur petit écran).
 * Le bouton « Connexion » est un bouton encadré doré, distinct du
 * bouton doré plein « Essai gratuit ».
 * Logo responsive : 180 px sur mobile, 260 px à partir de md.
 */
export default function PublicHeader({
  masquerEssai = false,
}: {
  /**
   * Pages dont le héros / le corps porte déjà LE bouton d'essai
   * unique (2026-11-08, règle du fondateur : aucun doublon de
   * CTA) : l'accueil (bouton du héros) et la page À propos
   * (CTA final). Sur ces pages, le bouton « Essai gratuit » de
   * l'en-tête est masqué. Toutes les autres pages publiques
   * gardent l'en-tête complet, inchangé par défaut.
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
        <nav className="order-3 flex w-full min-w-0 flex-nowrap items-center gap-x-1 text-[11px] font-semibold min-[400px]:gap-x-2 min-[400px]:text-xs sm:gap-x-4 sm:text-sm xl:order-2 xl:w-auto xl:gap-x-5">
          <Link href="/tarifs" className="whitespace-nowrap rounded px-0.5 py-2 hover:text-gold sm:px-1">
            {tn("pricing")}
          </Link>
          <Link href="/a-louer" className="whitespace-nowrap rounded px-0.5 py-2 hover:text-gold sm:px-1">
            {t("navRent")}
          </Link>
          <Link href="/a-propos" className="whitespace-nowrap rounded px-0.5 py-2 hover:text-gold sm:px-1">
            {tn("about")}
          </Link>
          <Link href="/contact" className="whitespace-nowrap rounded px-0.5 py-2 hover:text-gold sm:px-1">
            {tn("contact")}
          </Link>
        </nav>
        <div className="order-4 flex w-full min-w-0 items-center gap-2 min-[400px]:gap-3 xl:order-3 xl:w-auto xl:shrink-0">
          <Link
            href="/connexion"
            className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-full border border-gold px-3 py-2.5 text-sm font-semibold text-gold hover:bg-gold hover:text-navy-dark min-[400px]:px-5 xl:flex-none"
          >
            {ta("loginButton")}
          </Link>
          {masquerEssai ? null : (
            <Link
              href="/inscription"
              className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-full bg-gold px-3 py-2.5 text-sm font-bold text-navy-dark hover:bg-gold-light min-[400px]:px-5 xl:flex-none"
            >
              {t("ctaTrialShort")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

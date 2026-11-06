"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";

/**
 * En-tête commun des pages publiques (spec §4) : logo, navigation
 * (Accueil, Tarifs, Appartements à louer, Contact), connexion /
 * essai gratuit, bascule de langue toujours visible.
 */
export default function PublicHeader() {
  const t = useTranslations("landing");
  const tn = useTranslations("nav");
  const ta = useTranslations("auth");
  return (
    <header className="bg-navy-dark px-4 py-4 text-white sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <Link href="/" aria-label="CizaImmo — Accueil">
          <Image src="/cizaimmo-logo-v4.png" alt="CizaImmo" width={180} height={80} priority />
        </Link>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
          <Link href="/tarifs" className="rounded px-1 py-2 hover:text-gold">
            {tn("pricing")}
          </Link>
          <Link href="/a-louer" className="rounded px-1 py-2 hover:text-gold">
            {t("navRent")}
          </Link>
          <Link href="/contact" className="rounded px-1 py-2 hover:text-gold">
            {tn("contact")}
          </Link>
          <Link href="/connexion" className="rounded px-1 py-2 hover:text-gold">
            {ta("loginButton")}
          </Link>
          <Link
            href="/inscription"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-gold px-5 py-2 font-bold text-navy-dark hover:bg-gold-light"
          >
            {t("ctaTrial")}
          </Link>
          <LanguageSwitcher className="border-gold text-gold hover:bg-gold hover:text-navy-dark" />
        </nav>
      </div>
    </header>
  );
}

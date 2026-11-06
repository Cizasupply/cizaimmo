"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/components/LanguageSwitcher";

/**
 * Pied de page commun des pages publiques (spec §4) : liens Tarifs,
 * Contact, pages légales, bascule de langue visible en permanence,
 * mention « CizaImmo, division de Ciza Group », contact e-mail.
 */
export default function PublicFooter() {
  const tn = useTranslations("nav");
  const tb = useTranslations("brand");
  const tf = useTranslations("footer");
  const tc = useTranslations("common");
  return (
    <footer className="border-t border-navy-light bg-navy-dark px-4 py-8 text-sm text-slate-300 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-base font-bold text-white">
          <span className="text-white">CIZA</span>
          <span className="text-gold">IMMO</span>
          <span className="ml-2 font-normal text-slate-400">— {tf("tagline")}</span>
        </p>
        <p className="mt-1 text-slate-400">
          CizaImmo — {tb("division")} ·{" "}
          <a href="mailto:infos@cizagroup.com" className="text-gold hover:underline">
            {tf("contactEmail")}
          </a>
        </p>
        <nav className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 font-semibold">
          <Link href="/tarifs" className="rounded px-1 py-2 hover:text-gold">
            {tn("pricing")}
          </Link>
          <Link href="/contact" className="rounded px-1 py-2 hover:text-gold">
            {tn("contact")}
          </Link>
          <Link href="/legal/confidentialite" className="rounded px-1 py-2 hover:text-gold">
            {tn("privacy")}
          </Link>
          <Link href="/legal/cgu" className="rounded px-1 py-2 hover:text-gold">
            {tn("terms")}
          </Link>
          <Link href="/legal/mentions-legales" className="rounded px-1 py-2 hover:text-gold">
            {tn("legalNotice")}
          </Link>
          <Link href="/legal/cookies" className="rounded px-1 py-2 hover:text-gold">
            {tn("cookies")}
          </Link>
          <LanguageSwitcher className="border-slate-500 text-slate-200 hover:border-gold hover:text-gold" />
        </nav>
        <p className="mt-5 text-xs text-slate-500">{tc("rights")}</p>
      </div>
    </footer>
  );
}

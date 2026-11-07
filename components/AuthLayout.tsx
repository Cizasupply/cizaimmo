import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import PublicFooter from "@/components/PublicFooter";

/**
 * Mise en page commune des pages d'authentification (Module 1) :
 * bandeau navy + logo v4, carte blanche centrée, mobile-first (390 px),
 * bascule de langue FR / EN toujours visible, pied de page public
 * partagé (PublicFooter, avec le lien vers le site mère).
 */
export default function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const locale = useLocale();
  const otherLocale = locale === "fr" ? "en" : "fr";
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="bg-navy-dark px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" aria-label="CizaImmo — Accueil">
            <Image
              src="/cizaimmo-logo-v4.png"
              alt="CizaImmo"
              width={180}
              height={80}
              priority
            />
          </Link>
          <Link
            href={`/${otherLocale}`}
            className="rounded-full border border-gold px-4 py-1.5 text-sm font-semibold text-gold hover:bg-gold hover:text-navy-dark"
          >
            {otherLocale === "fr" ? "Français" : "English"}
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-md sm:p-8">
          <h1 className="text-2xl font-bold text-navy-dark">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-base text-slate-600">{subtitle}</p>
          ) : null}
          <div className="mt-6">{children}</div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

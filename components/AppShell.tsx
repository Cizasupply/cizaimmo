"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";

const links = [
  { key: "dashboard", href: "/dashboard" },
  { key: "buildings", href: "/immeubles" },
  { key: "apartments", href: "/appartements" },
  { key: "tenants", href: "/locataires" },
  { key: "rents", href: "/loyers" },
  { key: "receipts", href: "/recus" },
  { key: "expenses", href: "/depenses" },
  { key: "documents", href: "/documents" },
  { key: "alerts", href: "/alertes" },
  { key: "reports", href: "/rapports" },
  { key: "settings", href: "/parametres" },
] as const;

/** Vitrine « à louer » : propriétaire et gestionnaires ; jamais le co-propriétaire (lecture seule). */
const vitrineLinks = [{ key: "vitrine", href: "/vitrine" }] as const;

/** L'abonnement n'est visible que par le propriétaire (spec §2, §12). */
const ownerLinks = [{ key: "subscription", href: "/abonnement" }] as const;

function AlertBell() {
  const t = useTranslations("alerts");
  const [count, setCount] = useState(0);
  useEffect(() => {
    let actif = true;
    getDataProvider()
      .listerAlertes()
      .then((liste) => {
        if (actif) setCount(liste.filter((a) => a.statut === "active").length);
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, []);
  return (
    <Link
      href="/alertes"
      aria-label={t("bellLabel", { count })}
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-xl hover:border-gold"
    >
      <span aria-hidden="true">🔔</span>
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

export default function AppShell({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  const t = useTranslations("nav");
  const tb = useTranslations("brand");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let actif = true;
    getDataProvider()
      .getProfil()
      .then((profil) => {
        if (actif && profil) setRole(profil.role);
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, []);

  const estProprietaire = role === "proprietaire";
  const estCoproprietaire = role === "coproprietaire";

  async function handleLogout() {
    await getDataProvider().signOut();
    router.push(`/${locale}/connexion`);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 w-60 bg-navy-dark text-white p-6 hidden md:block">
        <Link
          href={`/${locale}/dashboard`}
          className="mb-1 block"
          aria-label="CizaImmo"
        >
          <Image
            src="/cizaimmo-logo-compact.png"
            alt="CizaImmo"
            width={170}
            height={54}
            priority
          />
        </Link>
        <p className="text-xs text-slate-400 mb-8">{tb("division")}</p>
        <nav className="space-y-1">
          {links.map((l) => (
            <Link
              key={l.key}
              href={l.href}
              className="block rounded-lg px-3 py-2 text-sm hover:bg-navy-light hover:text-gold"
            >
              {t(l.key)}
            </Link>
          ))}
          {!estCoproprietaire
            ? vitrineLinks.map((l) => (
                <Link
                  key={l.key}
                  href={l.href}
                  className="block rounded-lg px-3 py-2 text-sm hover:bg-navy-light hover:text-gold"
                >
                  {t(l.key)}
                </Link>
              ))
            : null}
          {estProprietaire
            ? ownerLinks.map((l) => (
                <Link
                  key={l.key}
                  href={l.href}
                  className="block rounded-lg px-3 py-2 text-sm hover:bg-navy-light hover:text-gold"
                >
                  {t(l.key)}
                </Link>
              ))
            : null}
        </nav>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-8 w-full rounded-lg border border-slate-500 px-3 py-2 text-left text-sm text-slate-200 hover:border-gold hover:text-gold"
        >
          {tc("logout")}
        </button>
      </aside>
      <header className="flex items-center bg-navy-dark px-6 py-3 md:hidden">
        <Link href={`/${locale}/dashboard`} aria-label="CizaImmo">
          <Image
            src="/cizaimmo-logo-compact.png"
            alt="CizaImmo"
            width={120}
            height={38}
            priority
          />
        </Link>
      </header>
      <main className="md:ml-60 p-6 md:p-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="text-2xl md:text-3xl font-bold text-navy">{title}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <AlertBell />
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy hover:border-gold md:hidden"
            >
              {tc("logout")}
            </button>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

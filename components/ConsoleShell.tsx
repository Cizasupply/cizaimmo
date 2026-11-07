"use client";

/**
 * CizaImmo — Console plateforme (extension v1.2).
 *
 * Surface réservée aux rôles Admin / Super Admin (Ciza Group) : garde
 * d'accès par le profil (la RLS double la garde en mode réel), barre
 * latérale marine/or, navigation console. Les liens « Admins » et
 * « Finances » n'apparaissent que pour le Super Admin (décisions
 * verrouillées : création d'Admins et paramètres = fondateur seul).
 */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { getDataProvider, isDemoMode } from "@/lib/data";
import type { Profil } from "@/lib/data";

const LIENS = [
  { key: "overview", href: "/console" },
  { key: "accounts", href: "/console/comptes" },
  { key: "managers", href: "/console/gestionnaires" },
  { key: "myFiles", href: "/console/mes-dossiers", adminSeul: true },
  { key: "supervisedMessages", href: "/console/messages-supervises" },
  { key: "vitrine", href: "/console/vitrine" },
  { key: "journal", href: "/console/journal" },
  { key: "suppressions", href: "/console/suppressions", superSeul: true },
  { key: "admins", href: "/console/admins", superSeul: true },
  { key: "finances", href: "/console/finances", superSeul: true },
] as const;

export default function ConsoleShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("console");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [profil, setProfil] = useState<Profil | null>(null);
  const [refuse, setRefuse] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);

  useEffect(() => {
    let actif = true;
    getDataProvider()
      .getProfil()
      .then((p) => {
        if (!actif) return;
        if (!p || (p.role !== "admin" && p.role !== "super_admin")) {
          setRefuse(true);
          router.replace(`/${locale}/dashboard`);
          return;
        }
        setProfil(p);
      })
      .catch(() => {
        if (actif) setRefuse(true);
      });
    return () => {
      actif = false;
    };
  }, [locale, router]);

  async function handleLogout() {
    await getDataProvider().signOut();
    router.push(`/${locale}/connexion`);
    router.refresh();
  }

  const estSuper = profil?.role === "super_admin";
  const liensVisibles = LIENS.filter((l) => {
    if ("superSeul" in l && l.superSeul && !estSuper) return false;
    // v1.5 : « Mes dossiers » = espace de l'Admin employé (pas le Super Admin).
    if ("adminSeul" in l && l.adminSeul && estSuper) return false;
    return true;
  });

  function LiensNavigation({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <>
        {liensVisibles.map((l) => {
          const href = `/${locale}${l.href}`;
          const actif = pathname === href;
          return (
            <Link
              key={l.key}
              href={href}
              onClick={onNavigate}
              className={`block rounded-lg px-3 py-2 text-sm ${
                actif
                  ? "bg-gold font-bold text-navy-dark"
                  : "hover:bg-navy-light hover:text-gold"
              }`}
            >
              {t(l.key)}
            </Link>
          );
        })}
      </>
    );
  }

  if (refuse) {
    return <div className="min-h-screen bg-navy-dark" aria-hidden="true" />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 hidden w-60 bg-navy-dark p-6 text-white md:block">
        <Link href={`/${locale}/console`} className="mb-1 block" aria-label="CizaImmo Console">
          <Image src="/cizaimmo-logo-compact.png" alt="CizaImmo" width={170} height={54} priority />
        </Link>
        <p className="mb-8 text-xs font-semibold uppercase tracking-wide text-gold">
          {t("title")}
        </p>
        <nav className="space-y-1">
          <LiensNavigation />
        </nav>
        {profil ? (
          <div className="mt-8 flex min-w-0 items-center gap-3 rounded-xl border border-slate-600 px-3 py-2.5">
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-bold text-navy-dark">
              {(profil.nom.trim()[0] ?? "?").toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">{profil.nom}</span>
              <span className="block truncate text-xs text-slate-400">
                {estSuper ? t("roleSuperAdmin") : t("roleAdmin")} · {profil.email}
              </span>
            </span>
          </div>
        ) : null}
        <Link
          href={`/${locale}`}
          className="mt-3 block rounded-lg border border-slate-500 px-3 py-2 text-sm text-slate-200 hover:border-gold hover:text-gold"
        >
          {t("backToSite")}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 w-full rounded-lg border border-slate-500 px-3 py-2 text-left text-sm text-slate-200 hover:border-gold hover:text-gold"
        >
          {tc("logout")}
        </button>
        {isDemoMode() ? (
          <p className="mt-4 rounded-lg bg-gold/15 px-3 py-2 text-xs font-semibold text-gold">
            {t("demoBadge")}
          </p>
        ) : null}
      </aside>

      <header className="flex items-center gap-3 bg-navy-dark px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setMenuOuvert(true)}
          aria-label="Menu"
          aria-expanded={menuOuvert}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-500 text-xl text-white hover:border-gold hover:text-gold"
        >
          <span aria-hidden="true">☰</span>
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wide text-gold">
          {t("title")}
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-slate-500 px-4 py-2 text-sm font-semibold text-white"
        >
          {tc("logout")}
        </button>
      </header>
      {menuOuvert ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setMenuOuvert(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-navy-dark/60"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-navy-dark p-6 text-white shadow-xl">
            <div className="mb-8 flex items-start justify-between gap-2">
              <span className="text-sm font-bold uppercase tracking-wide text-gold">{t("title")}</span>
              <button
                type="button"
                onClick={() => setMenuOuvert(false)}
                aria-label="Menu"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-500 text-lg text-white"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <nav className="space-y-1">
              <LiensNavigation onNavigate={() => setMenuOuvert(false)} />
            </nav>
            <Link
              href={`/${locale}`}
              onClick={() => setMenuOuvert(false)}
              className="mt-6 block rounded-lg border border-slate-500 px-3 py-2 text-sm text-slate-200"
            >
              {t("backToSite")}
            </Link>
          </div>
        </div>
      ) : null}

      <main className="p-6 md:ml-60 md:p-10">{children}</main>
    </div>
  );
}

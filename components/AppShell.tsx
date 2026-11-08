"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type { Abonnement, Profil, RattachementGestionnaire } from "@/lib/data";
import { prenomDe } from "@/lib/nom";
import DossierBloc from "@/components/DossierBloc";
import LanguageSwitcher from "@/components/LanguageSwitcher";

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
  { key: "messages", href: "/messages" },
  { key: "reports", href: "/rapports" },
  { key: "settings", href: "/parametres" },
] as const;

/** Vitrine « à louer » : propriétaire et gestionnaires ; jamais le co-propriétaire (lecture seule). */
const vitrineLinks = [{ key: "vitrine", href: "/vitrine" }] as const;

/** L'abonnement n'est visible que par le propriétaire (spec §2, §12). */
const ownerLinks = [{ key: "subscription", href: "/abonnement" }] as const;

/**
 * Barre de navigation inférieure mobile (design « Marine & Or »,
 * 2026-11-07, demande du fondateur : menu premium, ultra mobile-first) :
 * 4 destinations fréquentes + « Plus » qui ouvre le menu complet.
 * Mêmes routes et mêmes libellés (nav.*) que la barre latérale.
 */
const barreMobile = [
  { key: "dashboard", href: "/dashboard" },
  { key: "buildings", href: "/immeubles" },
  { key: "rents", href: "/loyers" },
  { key: "tenants", href: "/locataires" },
] as const;

/**
 * Jeu d'icônes de navigation — SVG inline uniformes (aucune librairie
 * d'icônes dans l'app) : tracé 24×24, stroke currentColor, style
 * « outline » cohérent pour toutes les entrées du menu.
 */
const ICONES: Record<string, string[]> = {
  dashboard: ["M3 10.5 12 3l9 7.5", "M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"],
  buildings: ["M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16", "M16 9h3a1 1 0 0 1 1 1v11", "M2.5 21h19", "M8 7h2", "M8 11h2", "M8 15h2"],
  apartments: ["M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z"],
  tenants: ["M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z", "M5 20.5c.8-3.4 3.6-5.5 7-5.5s6.2 2.1 7 5.5"],
  rents: ["M3 7h18v10H3z", "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"],
  receipts: ["M6 3h12v18l-2-1.4-2 1.4-2-1.4L10 21l-2-1.4L6 21z", "M9 8h6", "M9 12h6"],
  expenses: ["M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z", "M3 10h18"],
  documents: ["M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z", "M14 3v4h4"],
  alerts: ["M6 9.8a6 6 0 0 1 12 0c0 3.8 1.4 5.2 1.4 5.2H4.6S6 13.6 6 9.8Z", "M10 19a2.2 2.2 0 0 0 4 0"],
  messages: ["M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H12l-4.6 4.2v-4.2H5.5A1.5 1.5 0 0 1 4 14.5z"],
  reports: ["M4 3v17a1 1 0 0 0 1 1h16", "M8.5 16v-5", "M12.5 16V8", "M16.5 16v-8"],
  settings: ["M4 8h9.5", "M18.5 8H20", "M16 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z", "M4 16h3.5", "M12.5 16H20", "M10 18.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"],
  vitrine: ["M5 4h14l1.2 5.2H3.8z", "M5.5 12.5V20h13v-7.5", "M10 20v-5h4v5"],
  subscription: ["M3.5 8 7 11.5 12 5l5 6.5L20.5 8 19 17.5H5z", "M5 20.5h14"],
  contract: ["M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z", "M14 3v4h4", "m9.2 14.6 2 2 4-4.6"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
};

function IconeNav({ nom, className = "h-5 w-5" }: { nom: string; className?: string }) {
  if (nom === "more") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="5" cy="12" r="1.8" fill="currentColor" />
        <circle cx="12" cy="12" r="1.8" fill="currentColor" />
        <circle cx="19" cy="12" r="1.8" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {(ICONES[nom] ?? []).map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/**
 * Chemin courant sans préfixe de locale (localePrefix « as-needed » :
 * FR sans préfixe, EN préfixé /en) — sert à marquer l'entrée active
 * du menu (barre latérale, tiroir et barre inférieure mobile).
 */
function cheminSansLocale(p: string | null): string {
  if (!p) return "";
  const parties = p.split("/").filter(Boolean);
  if (parties[0] === "fr" || parties[0] === "en") parties.shift();
  return `/${parties.join("/")}`;
}

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

/** Bloc utilisateur : initiale + nom complet + e-mail, tronqués (noms longs). */
function BlocUtilisateur({ profil }: { profil: Profil }) {
  const initiale = (profil.nom.trim()[0] ?? "?").toUpperCase();
  return (
    <div className="mt-8 flex min-w-0 items-center gap-3 rounded-xl border border-slate-600 px-3 py-2.5">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-bold text-navy-dark">
        {initiale}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-white">{profil.nom}</span>
        <span className="block truncate text-xs text-slate-400">{profil.email}</span>
      </span>
    </div>
  );
}

/**
 * Sélecteur de contexte du gestionnaire MULTI-RATTACHÉ (extension v1.2) :
 * visible seulement s'il a plus d'un rattachement actif. Les contextes
 * sont strictement séparés — changer de contexte recharge l'application
 * sur le parc du contexte choisi, aucune donnée croisée.
 */
function SelecteurContexte({
  rattachements,
  actifId,
}: {
  rattachements: RattachementGestionnaire[];
  actifId: string | null;
}) {
  const t = useTranslations("shell");
  const [enCours, setEnCours] = useState(false);
  async function changer(id: string) {
    setEnCours(true);
    try {
      await getDataProvider().definirContexteActif(id);
      window.location.reload();
    } catch {
      setEnCours(false);
    }
  }
  return (
    <label className="mt-8 block rounded-xl border border-slate-600 px-3 py-2.5">
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
        {t("contextLabel")}
      </span>
      <select
        value={actifId ?? ""}
        disabled={enCours}
        onChange={(e) => changer(e.target.value)}
        className="mt-1 w-full rounded-lg bg-navy-light px-2 py-1.5 text-sm font-semibold text-white"
      >
        {rattachements.map((r) => (
          <option key={r.id} value={r.id}>
            {r.contexte === "cizagroup"
              ? t("contextCizaGroup")
              : (r.proprietaire_nom ?? r.proprietaire_id ?? "")}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Écran de blocage plein écran (compte suspendu / en attente d'approbation). */
function EcranBlocage({
  titre,
  corps,
  accent,
  onLogout,
  logoutLabel,
  children,
}: {
  titre: string;
  corps: string;
  accent: "red" | "amber";
  onLogout: () => void;
  logoutLabel: string;
  /** Contenu additionnel (v1.3 : Display ID + bloc dossier sur l'attente). */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-dark px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        {/* Correctif bilingue 2026-11-07 : le sélecteur de langue doit
            rester accessible même sur les écrans de blocage (attente
            d'approbation / suspension), partie de l'espace client. */}
        <div className="mb-4 flex justify-end">
          <LanguageSwitcher className="border-slate-300 text-navy hover:border-gold" />
        </div>
        <div
          aria-hidden="true"
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full text-2xl ${
            accent === "red" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"
          }`}
        >
          {accent === "red" ? "⛔" : "⏳"}
        </div>
        <h1 className="text-xl font-bold text-navy">{titre}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{corps}</p>
        {children}
        <button
          type="button"
          onClick={onLogout}
          className="mt-6 w-full rounded-full bg-navy px-6 py-3 text-base font-bold text-white hover:bg-navy-light"
        >
          {logoutLabel}
        </button>
      </div>
    </div>
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
  const ts = useTranslations("shell");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [profil, setProfil] = useState<Profil | null>(null);
  const [abonnement, setAbonnement] = useState<Abonnement | null>(null);
  const [delaiApprobation, setDelaiApprobation] = useState<string>("");
  const [rattachements, setRattachements] = useState<RattachementGestionnaire[]>([]);
  const [contexteActifId, setContexteActifId] = useState<string | null>(null);
  const [menuOuvert, setMenuOuvert] = useState(false);

  useEffect(() => {
    let actif = true;
    getDataProvider()
      .getProfil()
      .then((p) => {
        if (actif && p) setProfil(p);
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, []);

  const role = profil?.role ?? null;

  // Extension v1.2 — connexion prioritaire : Admin / Super Admin vers
  // la console plateforme, jamais vers le parc client.
  useEffect(() => {
    if (role === "admin" || role === "super_admin") {
      router.replace(`/${locale}/console`);
    }
  }, [role, locale, router]);

  // Abonnement du propriétaire (écran d'attente d'approbation, ajout n°3).
  useEffect(() => {
    if (role !== "proprietaire") return;
    let actif = true;
    getDataProvider()
      .getAbonnement()
      .then(async (a) => {
        if (!actif) return;
        setAbonnement(a);
        if (a?.statut === "en_attente") {
          const params = await getDataProvider().getParametresFinance();
          if (actif) setDelaiApprobation(params.delai_approbation_affiche);
        }
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [role]);

  // Rattachements du gestionnaire (sélecteur de contexte si multi-rattaché).
  useEffect(() => {
    if (role !== "gestionnaire") return;
    let actif = true;
    Promise.all([
      getDataProvider().listerMesRattachements(),
      getDataProvider().getContexteActif(),
    ])
      .then(([liste, contexte]) => {
        if (!actif) return;
        setRattachements(liste.filter((r) => r.statut === "actif"));
        setContexteActifId(contexte?.id ?? null);
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [role]);

  const estProprietaire = role === "proprietaire";
  const estCoproprietaire = role === "coproprietaire";

  // Tiroir mobile : Échap le ferme et la page ne défile pas derrière.
  useEffect(() => {
    if (!menuOuvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOuvert(false);
    };
    document.addEventListener("keydown", surTouche);
    const precedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = precedent;
    };
  }, [menuOuvert]);

  async function handleLogout() {
    setMenuOuvert(false);
    await getDataProvider().signOut();
    router.push(`/${locale}/connexion`);
    router.refresh();
  }

  /**
   * Liens de navigation — UNE seule définition, partagée par la barre
   * latérale (ordinateur) et le tiroir (téléphone) : même ordre, même
   * visibilité par rôle. Vitrine : jamais le co-propriétaire.
   * Abonnement : propriétaire seulement.
   */
  const chemin = cheminSansLocale(pathname);
  const estActif = (href: string) => chemin === href || chemin.startsWith(`${href}/`);

  function LiensNavigation({ onNavigate }: { onNavigate?: () => void }) {
    const lien = (l: { key: string; href: string }) => {
      const actif = estActif(l.href);
      return (
        <Link
          key={l.key}
          href={l.href}
          onClick={onNavigate}
          aria-current={actif ? "page" : undefined}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
            actif
              ? "bg-navy-light font-semibold text-gold shadow-[inset_4px_0_0_0_#D4AF37]"
              : "text-slate-200 hover:bg-navy-light hover:text-gold"
          }`}
        >
          <IconeNav nom={l.key} />
          <span className="min-w-0 truncate">{t(l.key)}</span>
        </Link>
      );
    };
    // Regroupement visuel sobre (design « Marine & Or ») : mêmes routes
    // et mêmes libellés qu'avant, aucune entrée supprimée — les
    // Paramètres rejoignent le groupe « Compte » avec l'Abonnement et
    // le Contrat ; la Vitrine reste dans « Gestion ».
    const gestion: { key: string; href: string }[] = [
      ...links.filter((l) => l.key !== "settings"),
      ...(estCoproprietaire ? [] : vitrineLinks),
    ];
    const compte: { key: string; href: string }[] = [
      ...(estProprietaire ? ownerLinks : []),
      // v1.3 : espace gestionnaire (contrat + demandes) — comptes à
      // intention gestionnaire et gestionnaires rattachés.
      ...(profil?.type_intention === "gestionnaire" || role === "gestionnaire"
        ? [{ key: "contract", href: "/contrat" }]
        : []),
      { key: "settings", href: "/parametres" },
    ];
    return (
      <>
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          {t("groupManagement")}
        </p>
        <div className="space-y-1">{gestion.map(lien)}</div>
        <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          {t("groupAccount")}
        </p>
        <div className="space-y-1">{compte.map(lien)}</div>
      </>
    );
  }

  // Extension v1.2 — gardes d'accès AVANT tout module :
  // plateforme → redirection console (effet ci-dessus) ; suspendu →
  // écran de blocage ; en attente d'approbation → écran d'attente
  // (aucun accès aux modules, aucune donnée créée).
  if (role === "admin" || role === "super_admin") {
    return <div className="min-h-screen bg-navy-dark" aria-hidden="true" />;
  }
  if (profil?.suspendu) {
    return (
      <EcranBlocage
        titre={ts("suspendedTitle")}
        corps={ts("suspendedBody")}
        accent="red"
        onLogout={handleLogout}
        logoutLabel={tc("logout")}
      />
    );
  }
  if (estProprietaire && abonnement?.statut === "en_attente") {
    return (
      <EcranBlocage
        titre={ts("pendingTitle")}
        corps={ts("pendingBody", { delai: delaiApprobation || "24 h ouvrées" })}
        accent="amber"
        onLogout={handleLogout}
        logoutLabel={tc("logout")}
      >
        {/* v1.3 : le numéro de dossier (Display ID) + le bloc de
            complétion du dossier, directement sur l'écran d'attente. */}
        {profil?.display_id ? (
          <p className="mt-4 rounded-xl bg-gold/15 px-4 py-3 text-sm text-slate-700">
            {ts("displayIdLabel")} :{" "}
            <strong className="text-base font-bold tracking-wide text-navy">
              {profil.display_id}
            </strong>
            <span className="mt-0.5 block text-xs text-slate-500">
              {ts("displayIdKeep")}
            </span>
          </p>
        ) : null}
        {profil ? (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <DossierBloc profil={profil} />
          </div>
        ) : null}
      </EcranBlocage>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-navy p-6 text-white md:flex">
        <Link
          href={`/${locale}/dashboard`}
          className="mb-1 block shrink-0"
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
        <p className="mb-6 shrink-0 text-xs text-slate-400">{tb("division")}</p>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          <LiensNavigation />
        </nav>
        <div className="shrink-0">
          {role === "gestionnaire" && rattachements.length > 1 ? (
            <SelecteurContexte rattachements={rattachements} actifId={contexteActifId} />
          ) : null}
          {profil ? <BlocUtilisateur profil={profil} /> : null}
          <div className="mt-3">
            <LanguageSwitcher className="w-full border-slate-500 text-slate-200 hover:border-gold hover:text-gold" />
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-3 flex w-full items-center gap-3 rounded-lg border border-slate-500 px-3 py-2 text-left text-sm text-slate-200 hover:border-gold hover:text-gold"
          >
            <IconeNav nom="logout" />
            {tc("logout")}
          </button>
        </div>
      </aside>
      {/* Barre supérieure mobile (design « Marine & Or ») : logo, langue,
          cloche et avatar — le menu complet s'ouvre par « Plus » dans la
          barre inférieure, il n'y a plus de bouton hamburger. */}
      <header className="flex items-center gap-2 bg-navy px-4 py-3 md:hidden">
        <Link href={`/${locale}/dashboard`} aria-label="CizaImmo" className="min-w-0 shrink-0">
          <Image
            src="/cizaimmo-logo-compact.png"
            alt="CizaImmo"
            width={120}
            height={38}
            priority
          />
        </Link>
        {profil?.nom && prenomDe(profil.nom) ? (
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
            {prenomDe(profil.nom)}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <LanguageSwitcher className="border-slate-500 text-slate-200 hover:border-gold hover:text-gold" />
        <AlertBell />
        {profil ? (
          <Link
            href="/parametres"
            aria-label={t("settings")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-bold text-navy-dark"
          >
            {(profil.nom.trim()[0] ?? "?").toUpperCase()}
          </Link>
        ) : null}
      </header>
      {/* Menu complet mobile — panneau PLEIN ÉCRAN marine, ouvert par
          « Plus » (barre inférieure) : TOUTES les entrées de navigation
          + compte et déconnexion. Téléphone seulement. */}
      {menuOuvert ? (
        <div id="menu-mobile" className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex h-full flex-col overflow-y-auto bg-navy p-6 text-white">
            <div className="mb-1 flex shrink-0 items-start justify-between gap-2">
              <Link
                href={`/${locale}/dashboard`}
                onClick={() => setMenuOuvert(false)}
                aria-label="CizaImmo"
                className="min-w-0"
              >
                <Image
                  src="/cizaimmo-logo-compact.png"
                  alt="CizaImmo"
                  width={170}
                  height={54}
                  priority
                />
              </Link>
              <button
                type="button"
                onClick={() => setMenuOuvert(false)}
                aria-label="Menu"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-500 text-lg text-white hover:border-gold hover:text-gold"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            <p className="mb-6 shrink-0 text-xs text-slate-400">{tb("division")}</p>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              <LiensNavigation onNavigate={() => setMenuOuvert(false)} />
            </nav>
            <div className="shrink-0">
              {role === "gestionnaire" && rattachements.length > 1 ? (
                <SelecteurContexte rattachements={rattachements} actifId={contexteActifId} />
              ) : null}
              {profil ? <BlocUtilisateur profil={profil} /> : null}
              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 flex w-full items-center gap-3 rounded-lg border border-slate-500 px-3 py-2 text-left text-sm text-slate-200 hover:border-gold hover:text-gold"
              >
                <IconeNav nom="logout" />
                {tc("logout")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <main className="px-6 pb-28 pt-6 md:ml-60 md:p-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="min-w-0 break-words text-2xl md:text-3xl font-bold text-navy">{title}</h1>
          <div className="flex shrink-0 items-center gap-2">
            {/* Sur mobile, langue et cloche vivent dans la barre
                supérieure marine — pas de doublon dans le titre. */}
            <span className="hidden md:inline-flex">
              <LanguageSwitcher className="border-slate-300 bg-white text-navy hover:border-gold" />
            </span>
            <span className="hidden md:inline-flex">
              <AlertBell />
            </span>
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
      {/* Barre de navigation inférieure mobile — style application :
          4 destinations fréquentes + « Plus » (menu complet plein
          écran). Zones tactiles ≥ 44 px, safe-area iPhone respectée,
          état actif en or avec indicateur. */}
      <nav
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-navy pb-[env(safe-area-inset-bottom)] text-white md:hidden"
      >
        <div className="grid grid-cols-5">
          {barreMobile.map((l) => {
            const actif = estActif(l.href);
            return (
              <Link
                key={l.key}
                href={l.href}
                aria-current={actif ? "page" : undefined}
                className={`relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium leading-tight ${
                  actif ? "text-gold" : "text-slate-300 hover:text-white"
                }`}
              >
                {actif ? (
                  <span aria-hidden="true" className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-gold" />
                ) : null}
                <IconeNav nom={l.key} className="h-6 w-6" />
                <span className="max-w-full truncate">{t(l.key)}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOuvert(true)}
            aria-label={t("more")}
            aria-expanded={menuOuvert}
            aria-controls="menu-mobile"
            className={`relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium leading-tight ${
              menuOuvert ? "text-gold" : "text-slate-300 hover:text-white"
            }`}
          >
            <IconeNav nom="more" className="h-6 w-6" />
            <span className="max-w-full truncate">{t("more")}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type { Abonnement, Profil, RattachementGestionnaire } from "@/lib/data";
import { prenomDe } from "@/lib/nom";
import DossierBloc from "@/components/DossierBloc";

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
        className="mt-1 w-full rounded-lg bg-navy px-2 py-1.5 text-sm font-semibold text-white"
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
  function LiensNavigation({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <>
        {links.map((l) => (
          <Link
            key={l.key}
            href={l.href}
            onClick={onNavigate}
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
                onClick={onNavigate}
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
                onClick={onNavigate}
                className="block rounded-lg px-3 py-2 text-sm hover:bg-navy-light hover:text-gold"
              >
                {t(l.key)}
              </Link>
            ))
          : null}
        {/* v1.3 : espace gestionnaire (contrat + demandes) — comptes à
            intention gestionnaire et gestionnaires rattachés. */}
        {profil?.type_intention === "gestionnaire" || role === "gestionnaire" ? (
          <Link
            href="/contrat"
            onClick={onNavigate}
            className="block rounded-lg px-3 py-2 text-sm hover:bg-navy-light hover:text-gold"
          >
            {t("contract")}
          </Link>
        ) : null}
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
          <LiensNavigation />
        </nav>
        {role === "gestionnaire" && rattachements.length > 1 ? (
          <SelecteurContexte rattachements={rattachements} actifId={contexteActifId} />
        ) : null}
        {profil ? <BlocUtilisateur profil={profil} /> : null}
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 w-full rounded-lg border border-slate-500 px-3 py-2 text-left text-sm text-slate-200 hover:border-gold hover:text-gold"
        >
          {tc("logout")}
        </button>
      </aside>
      <header className="flex items-center gap-3 bg-navy-dark px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setMenuOuvert(true)}
          aria-label="Menu"
          aria-expanded={menuOuvert}
          aria-controls="menu-mobile"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-500 text-xl text-white hover:border-gold hover:text-gold"
        >
          <span aria-hidden="true">☰</span>
        </button>
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
        ) : null}
      </header>
      {/* Tiroir mobile — téléphone seulement, jamais sur ordinateur. */}
      {menuOuvert ? (
        <div id="menu-mobile" className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Menu"
            onClick={() => setMenuOuvert(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-navy-dark/60"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto bg-navy-dark p-6 text-white shadow-xl">
            <div className="mb-1 flex items-start justify-between gap-2">
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
            <p className="text-xs text-slate-400 mb-8">{tb("division")}</p>
            <nav className="space-y-1">
              <LiensNavigation onNavigate={() => setMenuOuvert(false)} />
            </nav>
            {role === "gestionnaire" && rattachements.length > 1 ? (
              <SelecteurContexte rattachements={rattachements} actifId={contexteActifId} />
            ) : null}
            {profil ? <BlocUtilisateur profil={profil} /> : null}
            <button
              type="button"
              onClick={handleLogout}
              className="mt-3 w-full rounded-lg border border-slate-500 px-3 py-2 text-left text-sm text-slate-200 hover:border-gold hover:text-gold"
            >
              {tc("logout")}
            </button>
          </div>
        </div>
      ) : null}
      <main className="md:ml-60 p-6 md:p-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h1 className="min-w-0 break-words text-2xl md:text-3xl font-bold text-navy">{title}</h1>
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

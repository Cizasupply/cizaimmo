"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type { Abonnement, Profil, RattachementGestionnaire } from "@/lib/data";
import { prenomDe } from "@/lib/nom";
import DossierBloc from "@/components/DossierBloc";
import IconeNav from "@/components/IconeNav";
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
 * Jeu d'icônes de navigation : composant partagé `IconeNav`
 * (components/IconeNav.tsx) — extrait d'ici lors du traitement
 * « Marine & Or » de la console (2026-11-07) pour que l'espace
 * client et la console utilisent EXACTEMENT le même jeu, étendu
 * aux entrées console.
 */

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
  // Zone défilante interne mobile (correctif structurel 2026-11-08) :
  // verrouillée quand le panneau « Plus » est ouvert.
  const zoneDefilanteRef = useRef<HTMLDivElement | null>(null);

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
  // Correctif structurel 2026-11-08 : sur mobile, le défilement vit
  // dans la zone interne (plus dans la fenêtre) — on verrouille donc
  // AUSSI la zone, sinon le contenu continuerait sous le panneau.
  useEffect(() => {
    if (!menuOuvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOuvert(false);
    };
    document.addEventListener("keydown", surTouche);
    const precedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const zone = zoneDefilanteRef.current;
    const precedentZone = zone?.style.overflowY ?? "";
    if (zone) zone.style.overflowY = "hidden";
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = precedent;
      if (zone) zone.style.overflowY = precedentZone;
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
    <div className="flex h-dvh flex-col bg-cream md:block md:h-auto md:min-h-screen">
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
      {/* Correctif structurel « bande au scroll » (2026-11-08,
          passe 2 — la passe 1, couche de composition translateZ(0),
          n'a PAS suffi sur l'iPhone du fondateur) : la coque mobile
          devient une colonne flex de hauteur h-dvh — [zone défilante
          flex-1 overflow-y-auto, qui contient la barre supérieure et
          le contenu] puis [barre inférieure DANS LE FLUX, flex-none].
          Plus RIEN ne flotte au-dessus du contenu pendant le scroll :
          seule la zone du milieu défile, comme une application
          native. Sur bureau, md:contents dissout les deux enveloppes
          et la disposition d'origine (sidebar fixe + main décalé,
          défilement de la fenêtre) est strictement inchangée. */}
      <div className="flex min-h-0 flex-1 flex-col md:contents">
        <div ref={zoneDefilanteRef} className="min-h-0 flex-1 overflow-y-auto md:contents">
      {/* Barre supérieure mobile (design « Marine & Or ») : logo, langue,
          cloche et avatar — le menu complet s'ouvre par « Plus » dans la
          barre inférieure, il n'y a plus de bouton hamburger.
          Correctif mobile 2026-11-08 : même discipline que la console —
          logo réduit et langue en pastille compacte, pour que logo +
          langue + cloche + avatar tiennent dans la largeur des petits
          téléphones sans rien tronquer. */}
      <header className="flex items-center gap-2 bg-navy px-4 py-3 md:hidden">
        <Link href={`/${locale}/dashboard`} aria-label="CizaImmo" className="min-w-0 shrink-0">
          <Image
            src="/cizaimmo-logo-compact.png"
            alt="CizaImmo"
            width={96}
            height={30}
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
        <LanguageSwitcher compact className="border-slate-500 text-slate-200 hover:border-gold hover:text-gold" />
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
      <main className="px-6 py-6 md:ml-60 md:p-10">
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
        </div>
      {/* Barre de navigation inférieure mobile — style application :
          4 destinations fréquentes + « Plus » (menu complet plein
          écran). Zones tactiles ≥ 44 px, safe-area iPhone respectée,
          état actif en or avec indicateur.
          Correctif structurel 2026-11-08 (passe 2) : barre DANS
          LE FLUX (voir l'enveloppe plus haut) — plus aucun
          position: fixed au-dessus du contenu qui défile, donc plus
          de fantôme repeint par WebKit. Fond marine plein, hauteur
          et safe-area (portée par la barre) inchangés. */}
      <nav
        aria-label="Navigation principale"
        className="shrink-0 border-t border-white/10 bg-navy pb-[env(safe-area-inset-bottom)] text-white md:hidden"
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

    </div>
  );
}

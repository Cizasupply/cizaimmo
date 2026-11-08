"use client";

/**
 * CizaImmo — Console plateforme (extension v1.2).
 *
 * Surface réservée aux rôles Admin / Super Admin (Ciza Group) : garde
 * d'accès par le profil (la RLS double la garde en mode réel), barre
 * latérale marine/or, navigation console. Les liens « Admins » et
 * « Finances » n'apparaissent que pour le Super Admin (décisions
 * verrouillées : création d'Admins et paramètres = fondateur seul).
 *
 * Design « Marine & Or premium » (2026-11-07, ordre du fondateur :
 * « Même chose pour Admin ») : la console reçoit le MÊME traitement
 * que l'espace client validé le même soir —
 *  - bureau : barre latérale marine, icônes SVG uniformes (jeu
 *    partagé `IconeNav`), libellés, actif en or (fond marine clair +
 *    liseré or), regroupements Gestion / Supervision / Plateforme,
 *    bloc utilisateur + déconnexion en pied ;
 *  - mobile : barre supérieure marine (logo, titre, langue,
 *    déconnexion) + barre inférieure style application —
 *    Vue d'ensemble, Comptes, Messages (pastille or des non-lus
 *    plateforme), Journal, « Plus » qui ouvre le menu complet en
 *    panneau plein écran marine (un seul mécanisme : l'ancien tiroir
 *    hamburger disparaît). Zones tactiles ≥ 44 px, safe-area iPhone.
 *    Correctif structurel « bande au scroll » (2026-11-08, passe 2) :
 *    colonne h-dvh, zone défilante interne, barre inférieure DANS LE
 *    FLUX (plus de barre fixe au-dessus du contenu qui défile).
 * La LOGIQUE du badge Messages (compteur plateforme recalculé à
 * chaque navigation) est strictement inchangée : seule sa
 * présentation s'étend à la barre inférieure mobile.
 */

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { getDataProvider, isDemoMode } from "@/lib/data";
import type { Profil } from "@/lib/data";
import IconeNav from "@/components/IconeNav";
import CharteConfidentialite from "@/components/CharteConfidentialite";
import LanguageSwitcher from "@/components/LanguageSwitcher";

const LIENS = [
  { key: "overview", href: "/console" },
  { key: "accounts", href: "/console/comptes" },
  { key: "managers", href: "/console/gestionnaires" },
  { key: "myFiles", href: "/console/mes-dossiers", adminSeul: true },
  // Dossier employé (2026-11-08) : visible par les DEUX rôles
  // plateforme (admin ET super_admin remplissent leur dossier).
  { key: "myEmployeeFile", href: "/console/mon-dossier" },
  { key: "verifyEmployee", href: "/console/verifier-employe" },
  { key: "messages", href: "/console/messages" },
  { key: "supervisedMessages", href: "/console/messages-supervises" },
  { key: "vitrine", href: "/console/vitrine" },
  { key: "journal", href: "/console/journal" },
  { key: "suppressions", href: "/console/suppressions", superSeul: true },
  { key: "admins", href: "/console/admins", superSeul: true },
  { key: "finances", href: "/console/finances", superSeul: true },
] as const;

type CleLien = (typeof LIENS)[number]["key"];

/**
 * Regroupement visuel sobre de la barre latérale et du panneau
 * mobile (même patron que l'espace client) : mêmes routes et mêmes
 * libellés, aucune entrée supprimée. Le groupe « Plateforme » est
 * réservé au Super Admin (ses trois entrées sont superSeul) ; un
 * groupe sans entrée visible n'est pas rendu.
 */
const GROUPES: { cle: "groupManagement" | "groupSupervision" | "groupPlatform"; cles: CleLien[] }[] = [
  { cle: "groupManagement", cles: ["overview", "accounts", "managers", "myFiles", "myEmployeeFile", "verifyEmployee"] },
  { cle: "groupSupervision", cles: ["messages", "supervisedMessages", "vitrine", "journal"] },
  { cle: "groupPlatform", cles: ["suppressions", "admins", "finances"] },
];

/**
 * Barre de navigation inférieure mobile (menu premium, ultra
 * mobile-first) : 4 destinations fréquentes + « Plus » qui ouvre le
 * menu complet. Mêmes routes et mêmes libellés (console.*) que la
 * barre latérale ; l'entrée Messages porte la pastille des non-lus.
 */
const barreMobile = [
  { key: "overview", href: "/console" },
  { key: "accounts", href: "/console/comptes" },
  { key: "messages", href: "/console/messages" },
  { key: "journal", href: "/console/journal" },
] as const;

/**
 * Chemin courant sans préfixe de locale (localePrefix « as-needed » :
 * FR sans préfixe, EN préfixé /en) — sert à marquer l'entrée active
 * du menu (barre latérale, panneau et barre inférieure mobile).
 * Même helper que l'AppShell client.
 */
function cheminSansLocale(p: string | null): string {
  if (!p) return "";
  const parties = p.split("/").filter(Boolean);
  if (parties[0] === "fr" || parties[0] === "en") parties.shift();
  return `/${parties.join("/")}`;
}

/** Bloc utilisateur : initiale + nom complet + rôle · e-mail, tronqués. */
function BlocUtilisateur({
  profil,
  roleLabel,
}: {
  profil: Profil;
  roleLabel: string;
}) {
  return (
    <div className="mt-8 flex min-w-0 items-center gap-3 rounded-xl border border-slate-600 px-3 py-2.5">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-bold text-navy-dark">
        {(profil.nom.trim()[0] ?? "?").toUpperCase()}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-white">{profil.nom}</span>
        <span className="block truncate text-xs text-slate-400">
          {roleLabel} · {profil.email}
        </span>
      </span>
    </div>
  );
}

export default function ConsoleShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("console");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [profil, setProfil] = useState<Profil | null>(null);
  const [refuse, setRefuse] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);
  // Zone défilante interne mobile (correctif structurel 2026-11-08,
  // même patron que l'AppShell) : verrouillée panneau ouvert.
  const zoneDefilanteRef = useRef<HTMLDivElement | null>(null);
  // Badge « Messages » (2026-11-07) : messages clients non lus par
  // la plateforme, TOUS fils plateforme confondus (assignés ou non).
  const [nonLusMessages, setNonLusMessages] = useState(0);

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

  // Le compteur se recalcule à chaque navigation : après la lecture
  // d'un fil dans un Dossier, la pastille retombe dès le retour.
  useEffect(() => {
    if (!profil) return;
    let actif = true;
    getDataProvider()
      .compterMessagesPlateformeNonLus()
      .then((n) => {
        if (actif) setNonLusMessages(n);
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, [profil, pathname]);

  // Panneau mobile plein écran : Échap le ferme et la page ne
  // défile pas derrière (même patron que l'AppShell client).
  // Correctif structurel 2026-11-08 : sur mobile, le défilement vit
  // dans la zone interne — on la verrouille AUSSI quand le panneau
  // est ouvert, sinon le contenu continuerait de défiler dessous.
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

  const estSuper = profil?.role === "super_admin";
  const liensVisibles = LIENS.filter((l) => {
    if ("superSeul" in l && l.superSeul && !estSuper) return false;
    // v1.5 : « Mes dossiers » = espace de l'Admin employé (pas le Super Admin).
    if ("adminSeul" in l && l.adminSeul && estSuper) return false;
    return true;
  });

  const chemin = cheminSansLocale(pathname);
  const estActif = (href: string) =>
    chemin === href || (href !== "/console" && chemin.startsWith(`${href}/`));

  function LiensNavigation({ onNavigate }: { onNavigate?: () => void }) {
    const lien = (l: (typeof LIENS)[number]) => {
      const actif = estActif(l.href);
      const pastille =
        l.key === "messages" && nonLusMessages > 0 ? nonLusMessages : null;
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
          <span className="min-w-0 flex-1 truncate">{t(l.key)}</span>
          {pastille !== null ? (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                actif ? "bg-navy-dark text-gold" : "bg-gold text-navy-dark"
              }`}
            >
              {pastille}
            </span>
          ) : null}
        </Link>
      );
    };
    return (
      <>
        {GROUPES.map((g) => {
          const membres = liensVisibles.filter((l) => g.cles.includes(l.key));
          if (membres.length === 0) return null;
          return (
            <div key={g.cle}>
              <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-widest text-slate-400 first:pt-0">
                {t(g.cle)}
              </p>
              <div className="space-y-1">{membres.map(lien)}</div>
            </div>
          );
        })}
      </>
    );
  }

  if (refuse) {
    return <div className="min-h-screen bg-navy-dark" aria-hidden="true" />;
  }

  return (
    <div className="flex h-dvh flex-col bg-cream md:block md:h-auto md:min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-navy p-6 text-white md:flex">
        <Link href={`/${locale}/console`} className="mb-1 block shrink-0" aria-label="CizaImmo Console">
          <Image src="/cizaimmo-logo-compact.png" alt="CizaImmo" width={170} height={54} priority />
        </Link>
        <p className="mb-6 shrink-0 text-xs text-slate-400">{t("title")}</p>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          <LiensNavigation />
        </nav>
        <div className="shrink-0">
          {profil ? (
            <BlocUtilisateur profil={profil} roleLabel={estSuper ? t("roleSuperAdmin") : t("roleAdmin")} />
          ) : null}
          <Link
            href={`/${locale}`}
            className="mt-3 block rounded-lg border border-slate-500 px-3 py-2 text-sm text-slate-200 hover:border-gold hover:text-gold"
          >
            {t("backToSite")}
          </Link>
          {/* Correctif bilingue 2026-11-07 : sélecteur de langue dans la
              console (il n'existait que sur les pages publiques). */}
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
          {isDemoMode() ? (
            <p className="mt-4 rounded-lg bg-gold/15 px-3 py-2 text-xs font-semibold text-gold">
              {t("demoBadge")}
            </p>
          ) : null}
        </div>
      </aside>

      {/* Correctif structurel « bande au scroll » (2026-11-08,
          passe 2, même patron que l'AppShell client) : colonne flex
          h-dvh — [zone défilante flex-1 overflow-y-auto : barre
          supérieure + contenu] puis [barre inférieure DANS LE FLUX].
          Sur bureau, md:contents dissout les enveloppes : disposition
          d'origine strictement inchangée. */}
      <div className="flex min-h-0 flex-1 flex-col md:contents">
        <div ref={zoneDefilanteRef} className="min-h-0 flex-1 overflow-y-auto md:contents">
      {/* Barre supérieure mobile (design « Marine & Or ») : logo,
          titre console, langue et déconnexion — le menu complet
          s'ouvre par « Plus » dans la barre inférieure, il n'y a
          plus de bouton hamburger.
          Correctif mobile 2026-11-08 (capture annotée du fondateur) :
          la pastille texte « Se déconnecter » débordait hors écran à
          droite. La barre tient maintenant dans la largeur : logo
          réduit, langue en pastille compacte (« EN » / « FR ») et
          déconnexion en BOUTON ICÔNE SEUL ici — la déconnexion en
          texte reste dans le panneau « Plus » et le pied de la barre
          latérale bureau. Aucun élément ne dépasse ni n'est tronqué. */}
      <header className="flex items-center gap-2 bg-navy px-4 py-3 md:hidden">
        <Link href={`/${locale}/console`} aria-label="CizaImmo Console" className="min-w-0 shrink-0">
          <Image src="/cizaimmo-logo-compact.png" alt="CizaImmo" width={96} height={30} priority />
        </Link>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
          {t("title")}
        </span>
        <LanguageSwitcher compact className="shrink-0 border-slate-500 text-slate-200 hover:border-gold hover:text-gold" />
        <button
          type="button"
          onClick={handleLogout}
          aria-label={tc("logout")}
          title={tc("logout")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-500 text-white hover:border-gold hover:text-gold"
        >
          <IconeNav nom="logout" className="h-5 w-5" />
        </button>
      </header>

      <main className="px-6 py-6 md:ml-60 md:p-10">{children}</main>
        </div>

      {/* Barre de navigation inférieure mobile — style application :
          Vue d'ensemble, Comptes, Messages (pastille or des non-lus
          plateforme, même compteur que la barre latérale), Journal,
          « Plus » (menu complet plein écran). Zones tactiles ≥ 44 px,
          safe-area iPhone respectée, état actif en or.
          Correctif structurel 2026-11-08 (passe 2) : barre DANS
          LE FLUX (voir l'enveloppe plus haut), même patron que
          l'AppShell — plus aucun position: fixed au-dessus du
          contenu qui défile, donc plus de fantôme au scroll. */}
      <nav
        aria-label="Navigation console"
        className="shrink-0 border-t border-white/10 bg-navy pb-[env(safe-area-inset-bottom)] text-white md:hidden"
      >
        <div className="grid grid-cols-5">
          {barreMobile.map((l) => {
            const actif = estActif(l.href);
            const pastille =
              l.key === "messages" && nonLusMessages > 0 ? nonLusMessages : null;
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
                <span className="relative">
                  <IconeNav nom={l.key} className="h-6 w-6" />
                  {pastille !== null ? (
                    <span className="absolute -right-3 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy-dark">
                      {pastille > 99 ? "99+" : pastille}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full truncate">{t(l.key)}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMenuOuvert(true)}
            aria-label={tn("more")}
            aria-expanded={menuOuvert}
            aria-controls="menu-console-mobile"
            className={`relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium leading-tight ${
              menuOuvert ? "text-gold" : "text-slate-300 hover:text-white"
            }`}
          >
            <IconeNav nom="more" className="h-6 w-6" />
            <span className="max-w-full truncate">{tn("more")}</span>
          </button>
        </div>
      </nav>
      </div>
      {/* Menu complet mobile — panneau PLEIN ÉCRAN marine, ouvert par
          « Plus » (barre inférieure) : TOUTES les entrées console
          groupées + retour site, langue, utilisateur et déconnexion.
          Téléphone seulement ; un seul mécanisme de menu complet. */}
      {profil ? <CharteConfidentialite /> : null}
      {menuOuvert ? (
        <div id="menu-console-mobile" className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="flex h-full flex-col overflow-y-auto bg-navy p-6 text-white">
            <div className="mb-1 flex shrink-0 items-start justify-between gap-2">
              <Link
                href={`/${locale}/console`}
                onClick={() => setMenuOuvert(false)}
                aria-label="CizaImmo Console"
                className="min-w-0"
              >
                <Image src="/cizaimmo-logo-compact.png" alt="CizaImmo" width={170} height={54} priority />
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
            <p className="mb-6 shrink-0 text-xs text-slate-400">{t("title")}</p>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              <LiensNavigation onNavigate={() => setMenuOuvert(false)} />
            </nav>
            <div className="shrink-0">
              {profil ? (
                <BlocUtilisateur profil={profil} roleLabel={estSuper ? t("roleSuperAdmin") : t("roleAdmin")} />
              ) : null}
              <Link
                href={`/${locale}`}
                onClick={() => setMenuOuvert(false)}
                className="mt-3 block rounded-lg border border-slate-500 px-3 py-2 text-sm text-slate-200 hover:border-gold hover:text-gold"
              >
                {t("backToSite")}
              </Link>
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
              {isDemoMode() ? (
                <p className="mt-4 rounded-lg bg-gold/15 px-3 py-2 text-xs font-semibold text-gold">
                  {t("demoBadge")}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}


    </div>
  );
}

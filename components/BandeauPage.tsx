import type { ReactNode } from "react";

/**
 * Bandeau de titre des pages console ET de l'espace client
 * (2026-11-08, demandes du fondateur : « Donne le fond d'écran au
 * titre », puis « bandeau marine aussi dans l'espace client ») —
 * la zone d'en-tête d'une page (lien retour éventuel, titre H1,
 * ligne méta / sous-titre, pastilles d'état) repose sur un fond
 * MARINE « Marine & Or » assorti aux cartes (coins arrondis,
 * bordure or/40), au lieu de reposer directement sur le fond crème.
 * À l'intérieur : titre en blanc, méta et sous-titre en slate-300,
 * accents or (lien retour, Display ID). Patron PARTAGÉ ; la
 * structure et le contenu de chaque en-tête restent propres à la
 * page (children) — seuls les tons changent. Côté client, c'est
 * l'AppShell qui l'applique à la zone de titre de toutes les pages.
 */
export default function BandeauPage({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={`rounded-2xl border border-gold/40 bg-navy p-4 text-white shadow-sm md:p-5 ${className}`}
    >
      {children}
    </header>
  );
}

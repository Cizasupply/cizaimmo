import type { ReactNode } from "react";

/**
 * État vide centré — système d'organisation des pages « Marine &
 * Or premium » (2026-11-08, règle anti-vide de la maquette validée :
 * « Tout état vide est centré, avec icône et phrase, au milieu de
 * sa colonne »).
 *
 * Anneau or pâle en CSS pur (aucune image, aucune icône nouvelle)
 * au-dessus du contenu existant (le texte de l'état vide, inchangé),
 * le tout centré horizontalement et verticalement dans le bloc qui
 * le contient. À utiliser pour les états vides INLINE des listes
 * (les écrans vides pleine page passent par `EmptyState`, qui
 * porte le même anneau).
 */
export default function EtatVideCentre({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-6 text-center ${className}`}
    >
      <span
        aria-hidden="true"
        className="mb-3 block h-10 w-10 flex-none rounded-full border-[3px] border-gold/50 bg-gold/10"
      />
      {children}
    </div>
  );
}

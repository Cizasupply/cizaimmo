import IconeNav from "./IconeNav";

/**
 * Tuile or d'en-tête de section — système d'organisation des pages
 * « Marine & Or premium » (2026-11-08, maquette validée par le
 * fondateur : `cizaimmo-systeme-organisation-visuel.html`).
 *
 * Anatomie de la carte premium : chaque en-tête de section porte
 * une petite tuile arrondie OR affichant l'icône de la section,
 * prise dans le jeu EXISTANT `IconeNav` (navigation client +
 * console) — aucune icône nouvelle n'est dessinée. Quand aucune
 * icône existante ne correspond à une section, l'en-tête reste
 * texte seul (pas de tuile inventée).
 *
 * La tuile s'insère EN LIGNE dans le titre existant
 * (`inline-flex`, alignée sur le texte) : ni la structure ni les
 * classes du titre ne changent, et le titre peut toujours
 * s'enrouler (`break-words`) sans jamais élargir la page sur
 * mobile — la tuile est `flex-none` et le texte reste libre.
 */
export default function TuileIcone({
  nom,
  className = "",
}: {
  nom: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`mr-2.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-gold align-[-9px] text-navy ${className}`}
    >
      <IconeNav nom={nom} className="h-[18px] w-[18px]" />
    </span>
  );
}

/**
 * Prénom affiché d'un utilisateur : premier mot de son nom complet
 * (le profil ne stocke qu'un seul champ `nom`, prénom + nom ensemble).
 *
 * Cas particuliers :
 * - nom vide ou absent → null (l'appelant n'affiche rien) ;
 * - nom synthétique = e-mail (co-propriétaire invité sans nom enregistré)
 *   → partie avant « @ », pour ne jamais saluer avec une adresse e-mail.
 */
export function prenomDe(nom: string | null | undefined): string | null {
  const propre = (nom ?? "").trim();
  if (!propre) return null;
  const base = propre.includes("@") ? propre.split("@")[0] : propre;
  const premier = base.trim().split(/\s+/)[0] ?? "";
  return premier || null;
}

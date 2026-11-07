/**
 * v1.6 « Vitrine vérifiée » — contact ATTENDU du dossier pour un
 * immeuble, côté client (miroir allégé de la règle de la base) : le
 * gestionnaire rattaché actif de l'immeuble s'il existe, sinon le
 * propriétaire. Sert à PRÉ-REMPLIR et à contrôler le formulaire
 * d'annonce (justification obligatoire si le contact saisi diffère).
 * Le contrôle qui fait foi reste celui de la base / du fournisseur
 * (demander_publication_vitrine) au moment de la demande.
 *
 * Limite connue : la liste des gestionnaires invités expose l'e-mail
 * mais pas le téléphone — pour un immeuble géré, le téléphone du
 * dossier est donc « inconnu » (null) et le formulaire ne juge que
 * l'e-mail ; la base, elle, compare les deux champs.
 */
import type { DataProvider } from "./data/provider";

export interface ContactDossier {
  telephone: string | null;
  email: string | null;
}

export async function contactDossierPourImmeuble(
  provider: DataProvider,
  immeubleId: string | null
): Promise<ContactDossier | null> {
  const profil = await provider.getProfil().catch(() => null);
  if (!profil) return null;
  // Un gestionnaire connecté EST le contact attendu de ses immeubles.
  if (profil.role === "gestionnaire") {
    return { telephone: profil.telephone ?? null, email: profil.email };
  }
  if (immeubleId) {
    const invites = await provider.listerGestionnaires().catch(() => []);
    const gestionnaire = invites.find(
      (g) => g.statut === "actif" && g.immeuble_ids.includes(immeubleId)
    );
    if (gestionnaire) {
      return { telephone: null, email: gestionnaire.email };
    }
  }
  return { telephone: profil.telephone ?? null, email: profil.email };
}

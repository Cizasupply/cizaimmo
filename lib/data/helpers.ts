/**
 * CizaImmo — helpers partagés par les deux fournisseurs (Module 2).
 * Règles métier pures, sans accès base : mêmes contrôles en démo et en réel.
 */

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Jeton opaque du lien locataire (32 caractères hexadécimaux). */
export function genererToken(): string {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

/** Téléphone international : 10 à 15 chiffres (spec §8). */
export function telephoneValide(telephone: string): boolean {
  const chiffres = telephone.replace(/[\s\-().]/g, "");
  return /^\+?\d{10,15}$/.test(chiffres);
}

export function emailValide(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

/**
 * Deux baux se chevauchent si leurs périodes se croisent.
 * Une fin null = bail sans date de fin (ouvert).
 */
export function bauxSeChevauchent(
  aDebut: string,
  aFin: string | null,
  bDebut: string,
  bFin: string | null
): boolean {
  const finA = aFin ?? "9999-12-31";
  const finB = bFin ?? "9999-12-31";
  return aDebut <= finB && bDebut <= finA;
}

/** Erreur métier portant un code traduit par les pages (crud.errors.<code>). */
export function err(code: string): Error {
  return new Error(code);
}

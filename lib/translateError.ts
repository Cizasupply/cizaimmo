/**
 * Traduit un code d'erreur métier (levé par la couche données, voir
 * provider.ts) en message clair dans la langue de l'utilisateur.
 * Code inconnu -> message générique, jamais un code technique affiché.
 */
const CODES = new Set([
  "ERR_NOT_FOUND",
  "ERR_LIMITE_BLOCS",
  "ERR_IMMEUBLE_NOM_UNIQUE",
  "ERR_VALEUR_NON_POSITIVE",
  "ERR_APPARTEMENT_NUMERO_UNIQUE",
  "ERR_LOYER_NON_POSITIF",
  "ERR_BAIL_CHEVAUCHEMENT",
  "ERR_BAIL_FIN_AVANT_DEBUT",
  "ERR_JOUR_EXIGIBILITE",
  "ERR_APPARTEMENT_OCCUPE",
  "ERR_BAIL_EXISTANT",
  "ERR_SANS_BAIL",
  "ERR_VITRINE_STATUT",
  "ERR_LOCATAIRE_BAIL_ACTIF",
  "ERR_MONTANT_NON_POSITIF",
  "ERR_ECHEANCE_INTROUVABLE",
  "ERR_PAIEMENT_INTROUVABLE",
  "ERR_PAIEMENT_DEJA_ANNULE",
  "ERR_CATEGORIE_MANQUANTE",
  "ERR_DOCUMENT_FORMAT",
  "ERR_DOCUMENT_TROP_GROS",
  "ERR_DOCUMENT_DOUBLON",
  "ERR_DOCUMENT_CONTENU_ABSENT",
  "ERR_BUCKET_MANQUANT",
  "ERR_TAUX_MEME_DEVISE",
  "ERR_EMAIL_INVALIDE",
  "ERR_GESTIONNAIRE_DEJA_INVITE",
  "ERR_GESTIONNAIRE_SANS_IMMEUBLE",
  "ERR_ABONNEMENT_REQUIS",
  "ERR_DESCENTE_BLOQUEE",
  "ERR_PLAN_INVALIDE",
  "ERR_MM_TELEPHONE_INVALIDE",
  "ERR_MM_INTROUVABLE",
  "ERR_MM_EXPIRE",
  "ERR_MM_DEJA_TRAITE",
  "ERR_MM_CONFIRMATION_WEBHOOK",
  "ERR_PARTS_TOTAL",
  "ERR_PART_EMAIL_UNIQUE",
  "ERR_PART_INVALIDE",
  "ERR_ROLE_LECTURE_SEULE",
  "ERR_INDIVISION_PLAN",
  "ERR_COPROPRIETAIRE_INTROUVABLE",
]);

export function messageErreur(
  t: (key: string) => string,
  erreur: unknown
): string {
  const code = erreur instanceof Error ? erreur.message : "";
  if (CODES.has(code)) return t(`errors.${code}`);
  return t("errors.ERR_GENERIC");
}

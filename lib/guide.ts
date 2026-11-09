/**
 * CizaImmo — guides PDF validés par le fondateur le 2026-11-08.
 *
 * GUIDE D'UTILISATION (clients, v3 enrichie FR + traduction EN
 * fidèle) : joint à l'e-mail de bienvenue (propriétaire, avec son
 * contrat de service — option C) et à l'e-mail de décision
 * (gestionnaire, avec son contrat de collaboration — v1.3), dans la
 * langue du compte. Aussi téléchargeable depuis la page
 * « Mon contrat » (lien servi par public/guides/).
 *
 * GUIDE EMPLOYÉ (branchement validé par le fondateur le 2026-11-08,
 * « Les deux » emplacements) : joint à l'e-mail de mise à
 * disposition du contrat employé préparé par le Super Admin, avec
 * le PDF du contrat, dans la langue du compte de l'employé. Aussi
 * téléchargeable depuis la page console « Mon dossier employé ».
 *
 * Fichiers statiques : public/guides/cizaimmo-guide-utilisation-<langue>.pdf
 * et public/guides/cizaimmo-guide-employe-<langue>.pdf.
 *
 * REPLI NON BLOQUANT (patron des pièces jointes de l'approbation) :
 * si la lecture du fichier échoue (réseau, harnais de test sans
 * serveur…), l'e-mail part SANS le guide plutôt que de ne pas
 * partir — l'approbation et l'essai n'en dépendent jamais.
 */

export type LangueGuide = "fr" | "en";

/** Nom de fichier stable du guide, par langue. */
export function nomFichierGuide(langue: LangueGuide): string {
  return langue === "en"
    ? "cizaimmo-guide-utilisation-en.pdf"
    : "cizaimmo-guide-utilisation-fr.pdf";
}

/** Chemin public du guide (téléchargement depuis l'espace client). */
export function cheminGuide(langue: LangueGuide): string {
  return `/guides/${nomFichierGuide(langue)}`;
}

/** Nom de fichier stable du guide employé, par langue. */
export function nomFichierGuideEmploye(langue: LangueGuide): string {
  return langue === "en"
    ? "cizaimmo-guide-employe-en.pdf"
    : "cizaimmo-guide-employe-fr.pdf";
}

/** Chemin public du guide employé (téléchargement depuis la console). */
export function cheminGuideEmploye(langue: LangueGuide): string {
  return `/guides/${nomFichierGuideEmploye(langue)}`;
}

/** Conversion ArrayBuffer -> base64 par tranches (navigateur + Node). */
function versBase64(buffer: ArrayBuffer): string {
  const octets = new Uint8Array(buffer);
  let binaire = "";
  const TRANCHE = 0x8000;
  for (let i = 0; i < octets.length; i += TRANCHE) {
    binaire += String.fromCharCode.apply(
      null,
      Array.from(octets.subarray(i, i + TRANCHE))
    );
  }
  return btoa(binaire);
}

type PieceJointe = { nom: string; contenuBase64: string };

/**
 * Charge un PDF statique de public/guides/ (même origine) et le
 * retourne comme pièce jointe e-mail. Retourne null en cas d'échec —
 * l'appelant envoie alors l'e-mail sans le fichier.
 */
async function chargerPdfPublic(
  chemin: string,
  nom: string
): Promise<PieceJointe | null> {
  try {
    const reponse = await fetch(chemin);
    if (!reponse.ok) return null;
    const tampon = await reponse.arrayBuffer();
    if (!tampon || tampon.byteLength === 0) return null;
    return { nom, contenuBase64: versBase64(tampon) };
  } catch {
    return null;
  }
}

/**
 * Charge le guide d'utilisation PDF (même origine, fichier statique
 * de public/) et le retourne comme pièce jointe e-mail. Retourne
 * null en cas d'échec — l'appelant envoie alors l'e-mail sans le
 * guide.
 */
export async function chargerGuidePdf(
  langue: LangueGuide
): Promise<PieceJointe | null> {
  return chargerPdfPublic(cheminGuide(langue), nomFichierGuide(langue));
}

/**
 * Charge le guide employé PDF (même origine, fichier statique de
 * public/) et le retourne comme pièce jointe e-mail. Retourne null
 * en cas d'échec — l'appelant envoie alors l'e-mail sans le guide.
 */
export async function chargerGuideEmployePdf(
  langue: LangueGuide
): Promise<PieceJointe | null> {
  return chargerPdfPublic(
    cheminGuideEmploye(langue),
    nomFichierGuideEmploye(langue)
  );
}

/**
 * Ajoute une pièce chargée (ou null) à une liste de pièces jointes
 * existante. Ne lève jamais : si le fichier est illisible, la liste
 * d'origine est retournée telle quelle. Retourne undefined si, au
 * final, il n'y a aucune pièce jointe.
 */
async function ajouterAuxPieces(
  pieces: PieceJointe[] | undefined,
  charge: Promise<PieceJointe | null>
): Promise<PieceJointe[] | undefined> {
  const liste = pieces ? [...pieces] : [];
  const fichier = await charge;
  if (fichier) liste.push(fichier);
  return liste.length > 0 ? liste : undefined;
}

/**
 * Ajoute le guide d'utilisation (langue du compte) à une liste de
 * pièces jointes existante (le contrat, en premier). Repli non
 * bloquant intégré : voir ajouterAuxPieces.
 */
export async function piecesJointesAvecGuide(
  pieces: PieceJointe[] | undefined,
  langue: LangueGuide
): Promise<PieceJointe[] | undefined> {
  return ajouterAuxPieces(pieces, chargerGuidePdf(langue));
}

/**
 * Ajoute le guide employé (langue du compte de l'employé) à une
 * liste de pièces jointes existante (le contrat employé, en
 * premier). Repli non bloquant intégré : si le guide est illisible,
 * l'e-mail de mise à disposition part avec le contrat seul.
 */
export async function piecesJointesAvecGuideEmploye(
  pieces: PieceJointe[] | undefined,
  langue: LangueGuide
): Promise<PieceJointe[] | undefined> {
  return ajouterAuxPieces(pieces, chargerGuideEmployePdf(langue));
}

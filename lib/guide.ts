/**
 * CizaImmo — guide d'utilisation (PDF validé par le fondateur le
 * 2026-11-08, v3 enrichie FR + traduction EN fidèle).
 *
 * Le guide est joint à l'e-mail de bienvenue (propriétaire, avec son
 * contrat de service — option C) et à l'e-mail de décision
 * (gestionnaire, avec son contrat de collaboration — v1.3), dans la
 * langue du compte. Il est aussi téléchargeable depuis la page
 * « Mon contrat » (lien servi par public/guides/).
 *
 * Fichiers statiques : public/guides/cizaimmo-guide-utilisation-<langue>.pdf
 * — le PDF FR est la v3 validée mot pour mot ; le PDF EN en est la
 * traduction fidèle (même structure, même mise en page).
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

/**
 * Charge le guide PDF (même origine, fichier statique de public/) et
 * le retourne comme pièce jointe e-mail. Retourne null en cas
 * d'échec — l'appelant envoie alors l'e-mail sans le guide.
 */
export async function chargerGuidePdf(
  langue: LangueGuide
): Promise<{ nom: string; contenuBase64: string } | null> {
  try {
    const reponse = await fetch(cheminGuide(langue));
    if (!reponse.ok) return null;
    const tampon = await reponse.arrayBuffer();
    if (!tampon || tampon.byteLength === 0) return null;
    return { nom: nomFichierGuide(langue), contenuBase64: versBase64(tampon) };
  } catch {
    return null;
  }
}

/**
 * Ajoute le guide (langue du compte) à une liste de pièces jointes
 * existante (le contrat, en premier). Ne lève jamais : si le guide
 * est illisible, la liste d'origine est retournée telle quelle.
 * Retourne undefined si, au final, il n'y a aucune pièce jointe.
 */
export async function piecesJointesAvecGuide(
  pieces: { nom: string; contenuBase64: string }[] | undefined,
  langue: LangueGuide
): Promise<{ nom: string; contenuBase64: string }[] | undefined> {
  const liste = pieces ? [...pieces] : [];
  const guide = await chargerGuidePdf(langue);
  if (guide) liste.push(guide);
  return liste.length > 0 ? liste : undefined;
}

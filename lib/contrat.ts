/**
 * CizaImmo — contrat de collaboration GESTIONNAIRE (v1.3).
 *
 * Généré par l'application (jsPDF, client ou serveur — aucune donnée
 * ne transite par un tiers) à l'approbation d'un compte à intention
 * « gestionnaire » : il est joint à l'e-mail de décision, le
 * gestionnaire le signe et le téléverse ; un Admin valide le contrat
 * signé, ce qui débloque ses fonctions (rattachements, immeubles des
 * propriétaires).
 *
 * RÈGLE DURABLE : le contrat ne crée AUCUN flux d'argent — CizaImmo
 * n'encaisse jamais les loyers, aucun fonds ne transite par la
 * plateforme (clause écrite noir sur blanc dans le document).
 * Le document est le contrat officiel CizaImmo, livré propre et
 * final. Langue du document = langue du compte (profils.langue).
 */

// jsPDF est importé DYNAMIQUEMENT dans la fonction de génération :
// son chargement au niveau module casse les environnements sans DOM
// complet (harnais de tests Node) et alourdit le chargement initial
// des fournisseurs de données qui n'en ont besoin qu'à l'approbation.
import { CACHET_CIZAGROUP_JPEG_BASE64 } from "./cachet";
import { SIGNATURE_PRESIDENT_DATA_URL } from "./signature";

/**
 * Normalise une image de signature chargée depuis le fichier public :
 * largeur max 480 px, aplatie sur fond blanc, ré-encodée en JPEG —
 * la signature s'appose sur la page blanche du contrat (aplatissement
 * invisible) et le PDF reste léger, quelle que soit la taille du
 * fichier d'origine. En cas d'échec, l'image d'origine est conservée.
 */
async function normaliserSignature(dataUrl: string): Promise<string> {
  try {
    if (typeof document === "undefined" || typeof Image === "undefined") {
      return dataUrl;
    }
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image illisible"));
      img.src = dataUrl;
    });
    if (!img.naturalWidth || !img.naturalHeight) return dataUrl;
    const echelle = Math.min(1, 480 / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * echelle));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * echelle));
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return dataUrl;
  }
}

/**
 * Charge l'image de la signature du Président Directeur, si elle est
 * disponible : d'abord le fichier public de l'application
 * (/signature-president.png — apposé automatiquement dès qu'il est
 * déployé, puis normalisé), sinon la constante embarquée
 * (lib/signature.ts, déjà normalisée par scripts/sync-signature.py).
 * Retourne null si aucune signature n'a encore été fournie : le
 * contrat se génère alors sans l'image, avec le cachet.
 */
async function chargerSignaturePresident(): Promise<string | null> {
  try {
    if (typeof window !== "undefined" && typeof fetch === "function") {
      const reponse = await fetch("/signature-president.png");
      if (reponse.ok) {
        const blob = await reponse.blob();
        const dataUrl = await new Promise<string | null>((resolve) => {
          const lecteur = new FileReader();
          lecteur.onload = () =>
            resolve(typeof lecteur.result === "string" ? lecteur.result : null);
          lecteur.onerror = () => resolve(null);
          lecteur.readAsDataURL(blob);
        });
        if (dataUrl) return await normaliserSignature(dataUrl);
      }
    }
  } catch {
    // Fichier absent ou illisible : on continue sans l'image.
  }
  return SIGNATURE_PRESIDENT_DATA_URL;
}

const NAVY: [number, number, number] = [27, 42, 74];
const GOLD: [number, number, number] = [212, 175, 55];
const GRIS: [number, number, number] = [100, 116, 139];
const NOIR: [number, number, number] = [30, 41, 59];

export interface DonneesContratGestionnaire {
  nom: string;
  displayId: string;
  email: string;
  telephone: string | null;
  pays: string | null;
  langue: "fr" | "en";
  /** Date d'émission (ISO, ex. « 2026-11-07 »). */
  date: string;
}

/** Nom de fichier stable du contrat d'un gestionnaire. */
export function nomFichierContrat(displayId: string): string {
  return `contrat-gestionnaire-${displayId}.pdf`;
}

const TEXTES = {
  fr: {
    titre: "Contrat de collaboration — Gestionnaire CizaImmo",
    division: "CizaImmo — division de Ciza Group",
    entre: "Entre les soussignés :",
    partiePlateforme:
      "CizaImmo, division de CIZA GROUP SURL, société enregistrée au Burundi sous le numéro RC 0082870/26, NIF 4003446905, dont le siège est situé au 6ème Avenue N° 47, Quartier Buhomba, Zone Mutimbuzi, Commune Ntahangwa, Bujumbura — Burundi, représentée par Ciza Misigaro, son Président Directeur (« CizaImmo »),",
    et: "et :",
    gestionnaire: "Le gestionnaire",
    nom: "Nom",
    dossier: "Display ID",
    email: "E-mail",
    telephone: "Téléphone",
    pays: "Pays",
    date: "Date",
    nonRenseigne: "Non renseigné",
    clauses: [
      {
        titre: "1. Objet",
        texte:
          "Le gestionnaire utilise la plateforme CizaImmo pour assurer la gestion locative (immeubles, appartements, locataires, loyers déclarés, dépenses et documents) pour le compte de propriétaires qui se sont rattachés à son dossier au moyen de son numéro de dossier (Display ID). Le gestionnaire n'accède qu'aux immeubles que chaque propriétaire lui a expressément assignés.",
      },
      {
        titre: "2. Indépendance des parties",
        texte:
          "Le gestionnaire agit en qualité de prestataire indépendant. Le présent contrat ne crée ni relation de travail, ni mandat de représentation de Ciza Group ou de CizaImmo, ni société de fait entre les parties.",
      },
      {
        titre: "3. Aucun encaissement par CizaImmo",
        texte:
          "CizaImmo n'encaisse jamais les loyers et ne reçoit aucun fonds pour le compte des propriétaires, des gestionnaires ou des locataires. Les paiements de loyer sont déclarés dans la plateforme par le gestionnaire ou le propriétaire ; aucun fonds ne transite par CizaImmo. Les sommes éventuellement dues entre le propriétaire et le gestionnaire sont réglées directement entre eux, hors plateforme.",
      },
      {
        titre: "4. Confidentialité",
        texte:
          "Le gestionnaire s'engage à garder confidentielles les données des propriétaires et des locataires auxquelles il accède via la plateforme, à ne les utiliser que pour la gestion confiée, et à ne jamais les céder à des tiers. Cet engagement survit à la fin du présent contrat.",
      },
      {
        titre: "5. Données et exactitude",
        texte:
          "Le gestionnaire est responsable de l'exactitude des informations qu'il saisit ou déclare dans la plateforme (paiements, dépenses, documents). Toute fausse déclaration peut entraîner la suspension immédiate du compte.",
      },
      {
        titre: "6. Durée et résiliation",
        texte:
          "Le présent contrat est conclu pour une durée indéterminée. Chaque partie peut y mettre fin moyennant un préavis écrit de trente (30) jours. En cas de manquement grave, CizaImmo peut suspendre l'accès sans préavis. La fin du contrat met fin aux rattachements actifs, sans effacer l'historique des dossiers.",
      },
    ],
    signatures: "Signatures",
    pourPlateforme: "Pour CizaImmo — Ciza Misigaro, Président Directeur, Ciza Group",
    pourGestionnaire: "Le gestionnaire",
    signatureMention: "Nom, date et signature :",
    pied:
      "Document généré et émis par CizaImmo — division de Ciza Group.",
    contacts: "infos@cizagroup.com · WhatsApp +1 514 502 9503",
  },
  en: {
    titre: "Collaboration agreement — CizaImmo property manager",
    division: "CizaImmo — a division of Ciza Group",
    entre: "Between the undersigned:",
    partiePlateforme:
      "CizaImmo, a division of CIZA GROUP SURL, a company registered in Burundi under number RC 0082870/26, Tax ID (NIF) 4003446905, whose head office is located at 6ème Avenue N° 47, Quartier Buhomba, Zone Mutimbuzi, Commune Ntahangwa, Bujumbura — Burundi, represented by Ciza Misigaro, its President and Chief Executive Officer (“CizaImmo”),",
    et: "and:",
    gestionnaire: "The property manager",
    nom: "Name",
    dossier: "Display ID",
    email: "Email",
    telephone: "Phone",
    pays: "Country",
    date: "Date",
    nonRenseigne: "Not provided",
    clauses: [
      {
        titre: "1. Purpose",
        texte:
          "The property manager uses the CizaImmo platform to provide rental management (buildings, units, tenants, declared rent payments, expenses and documents) on behalf of owners who connected their file to the manager's file using the manager's file number (Display ID). The manager only accesses the buildings each owner has expressly assigned to them.",
      },
      {
        titre: "2. Independence of the parties",
        texte:
          "The property manager acts as an independent contractor. This agreement creates neither an employment relationship, nor a mandate to represent Ciza Group or CizaImmo, nor any partnership between the parties.",
      },
      {
        titre: "3. No rent collection by CizaImmo",
        texte:
          "CizaImmo never collects rent and never receives funds on behalf of owners, managers or tenants. Rent payments are declared in the platform by the manager or the owner; no funds transit through CizaImmo. Any amounts owed between an owner and the manager are settled directly between them, off-platform.",
      },
      {
        titre: "4. Confidentiality",
        texte:
          "The property manager undertakes to keep confidential all owner and tenant data accessed through the platform, to use it solely for the entrusted management, and never to disclose it to third parties. This undertaking survives the end of this agreement.",
      },
      {
        titre: "5. Data and accuracy",
        texte:
          "The property manager is responsible for the accuracy of the information they enter or declare in the platform (payments, expenses, documents). Any false declaration may lead to immediate suspension of the account.",
      },
      {
        titre: "6. Term and termination",
        texte:
          "This agreement is entered into for an indefinite term. Either party may terminate it with thirty (30) days' written notice. In the event of a serious breach, CizaImmo may suspend access without notice. Termination ends active connections, without erasing file history.",
      },
    ],
    signatures: "Signatures",
    pourPlateforme: "For CizaImmo — Ciza Misigaro, President and Chief Executive Officer, Ciza Group",
    pourGestionnaire: "The property manager",
    signatureMention: "Name, date and signature:",
    pied:
      "Document generated and issued by CizaImmo — a division of Ciza Group.",
    contacts: "infos@cizagroup.com · WhatsApp +1 514 502 9503",
  },
} as const;

/**
 * Génère le PDF du contrat et le retourne en base64 (sans préfixe
 * data:) — prêt pour une pièce jointe Resend ou un téléchargement.
 * Fonction déterministe à données égales (hors métadonnées PDF).
 */
export async function genererContratGestionnairePdf(donnees: DonneesContratGestionnaire): Promise<{
  nomFichier: string;
  contenuBase64: string;
}> {
  const { jsPDF } = await import("jspdf");
  const t = TEXTES[donnees.langue === "en" ? "en" : "fr"];
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const largeur = 210;
  const marge = 18;
  const largeurTexte = largeur - marge * 2;
  let y = 0;

  // En-tête marine + filet or.
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, largeur, 30, "F");
  doc.setFillColor(...GOLD);
  doc.rect(0, 30, largeur, 1.6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.text("CizaImmo", marge, 13);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(201, 210, 224);
  doc.text(t.division, marge, 19.5);
  doc.setFontSize(11);
  doc.setTextColor(...GOLD);
  const dossierLigne = `${t.dossier} : ${donnees.displayId}`;
  doc.text(dossierLigne, largeur - marge - doc.getTextWidth(dossierLigne), 13);

  // Titre.
  y = 42;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14.5);
  const titreLignes = doc.splitTextToSize(t.titre, largeurTexte);
  doc.text(titreLignes, marge, y);
  y += titreLignes.length * 6.5 + 3;

  const paragraphe = (texte: string, gras = false, taille = 10.5) => {
    doc.setFont("helvetica", gras ? "bold" : "normal");
    doc.setFontSize(taille);
    doc.setTextColor(...NOIR);
    const lignes = doc.splitTextToSize(texte, largeurTexte);
    for (const ligne of lignes) {
      if (y > 272) {
        doc.addPage();
        y = 20;
      }
      doc.text(ligne, marge, y);
      y += 5.4;
    }
    y += 1.6;
  };

  const champ = (libelle: string, valeur: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    doc.text(`${libelle} :`, marge + 4, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...NOIR);
    doc.text(valeur || t.nonRenseigne, marge + 40, y);
    y += 6;
  };

  // Parties.
  paragraphe(t.entre, true, 11);
  paragraphe(t.partiePlateforme);
  paragraphe(t.et, true, 11);
  paragraphe(t.gestionnaire, true, 11);
  champ(t.nom, donnees.nom);
  champ(t.dossier, donnees.displayId);
  champ(t.email, donnees.email);
  champ(t.telephone, donnees.telephone ?? "");
  champ(t.pays, donnees.pays ?? "");
  champ(t.date, donnees.date);
  y += 3;

  // Clauses.
  for (const clause of t.clauses) {
    paragraphe(clause.titre, true, 11.5);
    paragraphe(clause.texte);
  }

  // Signatures. Bloc ENTREPRISE d'abord : la signature électronique
  // du Président Directeur et le cachet rond officiel de Ciza Group
  // SURL sont APPOSÉS ÉLECTRONIQUEMENT — le gestionnaire reçoit donc
  // un contrat déjà signé et cacheté côté entreprise. Son propre
  // bloc, en dessous, reste VIERGE pour sa signature manuscrite
  // avant le téléversement du contrat signé.
  //
  // La mise en page est DYNAMIQUE : l'image de signature fournie est
  // presque carrée (≈ 38 mm de large → ≈ 37 mm de haut) ; la ligne de
  // signature descend donc sous l'image, et le bloc gestionnaire
  // suit. Sans image, on retrouve exactement l'espacement d'origine.
  const signatureDataUrl = await chargerSignaturePresident();
  const largeurSignature = 38;
  let hauteurSignature = 0;
  if (signatureDataUrl) {
    hauteurSignature = largeurSignature * 0.35;
    try {
      const props = doc.getImageProperties(signatureDataUrl);
      if (props.width > 0 && props.height > 0) {
        hauteurSignature = (largeurSignature * props.height) / props.width;
      }
    } catch {
      // Proportions inconnues : repli sur le ratio par défaut.
    }
  }
  y += 4;
  if (y > 168) {
    doc.addPage();
    y = 20;
  }
  paragraphe(t.signatures, true, 12);
  const yEntreprise = y + 2;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(t.pourPlateforme, marge, yEntreprise);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRIS);
  doc.setFontSize(9.5);
  doc.text(t.signatureMention, marge, yEntreprise + 7);
  // Signature électronique du Président Directeur : ≈ 38 mm de large,
  // proportions conservées, juste au-dessus de la ligne de signature
  // et au-dessus du nom « Ciza Misigaro, Président Directeur » porté
  // par le libellé. Source : public/signature-president.png (chargé
  // automatiquement) ou constante embarquée — voir lib/signature.ts.
  const yLigneEntreprise =
    yEntreprise + (hauteurSignature > 0 ? 11 + hauteurSignature + 2 : 30);
  if (signatureDataUrl) {
    try {
      doc.addImage(
        signatureDataUrl,
        signatureDataUrl.startsWith("data:image/jpeg") ? "JPEG" : "PNG",
        marge,
        yLigneEntreprise - 1 - hauteurSignature,
        largeurSignature,
        hauteurSignature
      );
    } catch {
      // Image illisible : le contrat part sans elle (cachet présent).
    }
  }
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.5);
  doc.line(marge, yLigneEntreprise, marge + 80, yLigneEntreprise);
  doc.addImage(
    `data:image/jpeg;base64,${CACHET_CIZAGROUP_JPEG_BASE64}`,
    "JPEG",
    largeur - marge - 44,
    yEntreprise - 3,
    44,
    44
  );
  // Bloc GESTIONNAIRE (vierge).
  const yGestionnaire = yLigneEntreprise + 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...NAVY);
  doc.text(`${t.pourGestionnaire} : ${donnees.nom}`, marge, yGestionnaire);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRIS);
  doc.setFontSize(9.5);
  doc.text(t.signatureMention, marge, yGestionnaire + 7);
  doc.setDrawColor(...GOLD);
  doc.line(marge, yGestionnaire + 30, marge + 80, yGestionnaire + 30);
  y = yGestionnaire + 36;

  // Pied de page sur la dernière page : émetteur du document.
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRIS);
  doc.text(t.pied, largeur / 2, 290, { align: "center" });
  doc.setFontSize(8);
  doc.text(t.contacts, largeur / 2, 295, { align: "center" });

  const dataUri = doc.output("datauristring");
  const contenuBase64 = dataUri.split("base64,")[1] ?? "";
  return { nomFichier: nomFichierContrat(donnees.displayId), contenuBase64 };
}

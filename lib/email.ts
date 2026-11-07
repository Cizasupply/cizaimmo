/**
 * CizaImmo — e-mail d'alerte (Module 4, spec §10).
 *
 * RÈGLE DURE : aucun envoi n'est jamais SIMULÉ. Deux états seulement :
 * - configuré : EMAIL_API_URL + EMAIL_API_KEY sont définis (fournisseur
 *   HTTP générique : POST {to, subject, text, html}) — l'envoi réel est
 *   tenté et son résultat (succès / échec) est retourné ;
 * - non configuré : la fonction retourne { envoye: false, raison:
 *   "non_configuré" } et l'interface affiche « e-mail non configuré »
 *   sur l'alerte, au lieu de prétendre l'envoi.
 *
 * Le branchement d'un vrai fournisseur (Resend, SendGrid, Mailgun…)
 * se fait en renseignant les variables d'environnement — aucun secret
 * en clair dans le code, jamais.
 */

export interface ResultatEnvoiEmail {
  envoye: boolean;
  /** "non_configuré" | "ok" | "echec" */
  raison: "non_configuré" | "ok" | "echec";
  detail?: string;
}

export type LangueEmail = "fr" | "en";

export interface EmailAlerte {
  destinataire: string;
  sujet: string;
  texte: string;
  html?: string;
  /**
   * Langue du destinataire, quand l'appelant la connaît (avis et
   * bienvenue de la console, alertes du propriétaire) : le bloc d'aide
   * et l'avis de confidentialité du gabarit sont alors rendus dans
   * cette langue seule. Absente : gabarit bilingue FR/EN.
   */
  langue?: LangueEmail;
  /**
   * Pièces jointes (v1.3 — contrat gestionnaire) : contenu en base64,
   * transmises au fournisseur au format Resend « attachments »
   * ({ filename, content }). Optionnel : l'existant n'est pas affecté.
   */
  piecesJointes?: PieceJointeEmail[];
}

/** Pièce jointe d'un e-mail (v1.3) : nom de fichier + contenu base64. */
export interface PieceJointeEmail {
  nom: string;
  contenuBase64: string;
  typeMime?: string;
}

/* ------------------------------------------------------------------ */
/* Gabarit « ultra premium » (demande du fondateur, 2026-11-07)        */
/*                                                                     */
/* TOUS les e-mails sortants de l'application (alertes, avis de la     */
/* console, bienvenue, refus) sont enveloppés dans CE shell unique,    */
/* appliqué au point d'envoi central (envoyerEmailAlerte) : bandeau    */
/* marine + filet or, bloc d'aide avec les contacts, avis de           */
/* confidentialité et signature Ciza Group au pied. Les contenus       */
/* métier (sujet, corps) ne changent pas. HTML e-mail-safe : tables    */
/* et styles en ligne uniquement.                                      */
/* ------------------------------------------------------------------ */

const MARINE = "#1B2A4A";
const OR = "#D4AF37";
const SLOGAN = "Vos biens, gérés simplement.";
const EMAIL_CONTACT = "infos@cizagroup.com";
const WHATSAPP_CONTACT = "+1 514 502 9503";

const AIDE_EMAIL: Record<LangueEmail, string> = {
  fr: `Un problème de connexion ou une question ? Écrivez-nous : ${EMAIL_CONTACT} · WhatsApp : ${WHATSAPP_CONTACT}`,
  en: `Having trouble signing in, or a question? Write to us: ${EMAIL_CONTACT} · WhatsApp: ${WHATSAPP_CONTACT}`,
};

const AVIS_CONFIDENTIALITE: Record<LangueEmail, string> = {
  fr: "Avis de confidentialité : ce courriel est confidentiel et destiné uniquement à la personne à laquelle il est adressé. Si vous l'avez reçu par erreur, veuillez le supprimer et nous en aviser à infos@cizagroup.com.",
  en: "Confidentiality notice: this email is confidential and intended solely for the addressee. If you received it in error, please delete it and notify us at infos@cizagroup.com.",
};

const LIGNE_COPYRIGHT: Record<LangueEmail, string> = {
  fr: "© 2026 CizaImmo — une division de Ciza Group · cizaimmo.com",
  en: "© 2026 CizaImmo — a division of Ciza Group · cizaimmo.com",
};

/** Langues du gabarit : celle de l'e-mail si connue, sinon FR + EN. */
function languesGabarit(langue?: LangueEmail): LangueEmail[] {
  return langue ? [langue] : ["fr", "en"];
}

/**
 * Enveloppe un corps HTML dans le gabarit premium CizaImmo.
 * Fonction pure (testée par scripts/test-email-gabarit.cjs).
 */
export function gabaritEmailHtml(corpsHtml: string, langue?: LangueEmail): string {
  const langues = languesGabarit(langue);
  const aide = langues
    .map(
      (l) =>
        `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.55;color:#3D4B63;">${AIDE_EMAIL[l]}</div>`
    )
    .join("\n");
  const avis = langues
    .map(
      (l) =>
        `<p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.55;color:#AEB9CC;">${AVIS_CONFIDENTIALITE[l]}</p>`
    )
    .join("\n");
  const copyright = LIGNE_COPYRIGHT[langues[0]];
  return `<!DOCTYPE html>
<html lang="${langues[0]}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#EEF1F6;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EEF1F6;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background-color:#FFFFFF;border-radius:12px;overflow:hidden;">
<tr><td style="background-color:${MARINE};padding:26px 32px 20px;">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;color:#FFFFFF;letter-spacing:0.4px;">CizaImmo</div>
<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#C9D2E0;margin-top:4px;">${SLOGAN}</div>
</td></tr>
<tr><td style="background-color:${OR};height:3px;line-height:3px;font-size:0;">&nbsp;</td></tr>
<tr><td style="padding:28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:${MARINE};">
${corpsHtml}
</td></tr>
<tr><td style="padding:0 32px 26px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="background-color:#F2F5F9;border-left:3px solid ${OR};border-radius:6px;padding:14px 18px;">
${aide}
</td></tr></table>
</td></tr>
<tr><td style="background-color:${MARINE};padding:20px 32px;">
${avis}
<p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.55;color:#FFFFFF;">${copyright}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/**
 * Version texte cohérente du gabarit : le texte métier, puis le bloc
 * d'aide, l'avis de confidentialité et la signature, en texte brut.
 * Fonction pure (testée par scripts/test-email-gabarit.cjs).
 */
export function gabaritEmailTexte(texte: string, langue?: LangueEmail): string {
  const langues = languesGabarit(langue);
  const parties = [texte, ""];
  for (const l of langues) parties.push(AIDE_EMAIL[l]);
  parties.push("");
  for (const l of langues) parties.push(AVIS_CONFIDENTIALITE[l]);
  parties.push("", LIGNE_COPYRIGHT[langues[0]]);
  return parties.join("\n");
}

/** Vrai si un fournisseur d'e-mail est configuré (variables d'environnement). */
export function emailConfigure(): boolean {
  return Boolean(
    process.env.EMAIL_API_URL && process.env.EMAIL_API_KEY
  );
}

/**
 * Convertit le résultat d'un envoi en statut stockable sur une alerte
 * (miroir de statutDepuisResultat côté WhatsApp, lib/whatsapp.ts).
 * « desactive » ne vient jamais d'ici : c'est le canal coupé dans les
 * Paramètres qui le pose, avant toute tentative d'envoi.
 */
export function statutEmailDepuisResultat(
  resultat: ResultatEnvoiEmail
): "non_configuré" | "envoye" | "echec" {
  if (resultat.raison === "ok") return "envoye";
  if (resultat.raison === "non_configuré") return "non_configuré";
  return "echec";
}

/**
 * Envoi e-mail via la route API serveur (/api/email/envoyer).
 * CÔTÉ CLIENT uniquement : le fournisseur (URL + clé) ne quitte jamais
 * le serveur — cette fonction ne lit aucune variable d'environnement.
 * Sans fournisseur configuré, la route répond « non_configuré » et rien
 * n'est envoyé. Une erreur réseau répond « echec » (signalée, non bloquante).
 */
export async function envoyerEmailViaApi(
  email: EmailAlerte
): Promise<ResultatEnvoiEmail> {
  try {
    const reponse = await fetch("/api/email/envoyer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: email.destinataire,
        subject: email.sujet,
        text: email.texte,
        html: email.html,
        langue: email.langue,
        piecesJointes: email.piecesJointes,
      }),
    });
    if (!reponse.ok) {
      return { envoye: false, raison: "echec", detail: `HTTP ${reponse.status}` };
    }
    const corps = (await reponse.json()) as ResultatEnvoiEmail;
    if (
      corps.raison === "ok" ||
      corps.raison === "non_configuré" ||
      corps.raison === "echec"
    ) {
      return corps;
    }
    return { envoye: false, raison: "echec", detail: "réponse inattendue" };
  } catch (e) {
    return {
      envoye: false,
      raison: "echec",
      detail: e instanceof Error ? e.message : "erreur réseau",
    };
  }
}

/**
 * Envoie un e-mail d'alerte via le fournisseur configuré.
 * Côté serveur uniquement (fetch Node). En mode démo / sans configuration,
 * retourne immédiatement « non_configuré » sans rien envoyer.
 */
export async function envoyerEmailAlerte(email: EmailAlerte): Promise<ResultatEnvoiEmail> {
  const url = process.env.EMAIL_API_URL;
  const cle = process.env.EMAIL_API_KEY;
  if (!url || !cle) {
    return { envoye: false, raison: "non_configuré" };
  }
  // Gabarit premium centralisé : TOUS les e-mails de l'app passent par
  // ce point d'envoi unique — le corps métier est enveloppé tel quel,
  // en HTML comme en texte (voir gabaritEmailHtml / gabaritEmailTexte).
  const corpsHtml =
    email.html ?? `<p>${email.texte.replace(/\n/g, "<br>")}</p>`;
  try {
    const reponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cle}`,
      },
      body: JSON.stringify({
        // Expéditeur exigé par Resend (domaine vérifié) ; surchargeable
        // par la variable EMAIL_FROM.
        from: process.env.EMAIL_FROM ?? "CizaImmo <noreply@cizagroup.com>",
        to: email.destinataire,
        subject: email.sujet,
        text: gabaritEmailTexte(email.texte, email.langue),
        html: gabaritEmailHtml(corpsHtml, email.langue),
        // Pièces jointes au format Resend : contenu base64 (v1.3).
        ...(email.piecesJointes && email.piecesJointes.length > 0
          ? {
              attachments: email.piecesJointes.map((p) => ({
                filename: p.nom,
                content: p.contenuBase64,
              })),
            }
          : {}),
      }),
    });
    if (!reponse.ok) {
      return { envoye: false, raison: "echec", detail: `HTTP ${reponse.status}` };
    }
    return { envoye: true, raison: "ok" };
  } catch (e) {
    return {
      envoye: false,
      raison: "echec",
      detail: e instanceof Error ? e.message : "erreur réseau",
    };
  }
}

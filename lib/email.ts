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

export interface EmailAlerte {
  destinataire: string;
  sujet: string;
  texte: string;
  html?: string;
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
  try {
    const reponse = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cle}`,
      },
      body: JSON.stringify({
        to: email.destinataire,
        subject: email.sujet,
        text: email.texte,
        html: email.html ?? `<p>${email.texte.replace(/\n/g, "<br>")}</p>`,
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

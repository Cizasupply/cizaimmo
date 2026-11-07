/**
 * CizaImmo — avis plateforme par MODÈLES PRÉDÉFINIS (extension v1.2).
 *
 * Décision verrouillée du fondateur : aucun texte libre. L'Admin ou le
 * Super Admin choisit un modèle, les variables {nom, plan, date} sont
 * remplies depuis le compte, et chaque envoi est journalisé (table avis
 * + journal d'audit). Fonctions pures : le rendu est identique en démo,
 * en réel et dans les tests.
 */

import type { ModeleAvis, MotifRefus, VariablesAvis } from "./data/types";

export const MODELES_AVIS: ModeleAvis[] = [
  "retard_paiement",
  "fin_essai",
  "compte_suspendu",
  "compte_reactive",
  "inscription_refusee",
];

/** Motifs de refus d'inscription prédéfinis (ajout n°3). */
export const MOTIFS_REFUS: MotifRefus[] = [
  "informations_insuffisantes",
  "pays_non_desservi",
  "doublon",
  "autre",
];

const LIBELLES_MOTIFS: Record<MotifRefus, Record<"fr" | "en", string>> = {
  informations_insuffisantes: {
    fr: "Informations insuffisantes",
    en: "Insufficient information",
  },
  pays_non_desservi: { fr: "Pays non desservi", en: "Country not served" },
  doublon: { fr: "Compte en double", en: "Duplicate account" },
  autre: { fr: "Autre motif", en: "Other reason" },
};

/** Libellé affichable d'un motif de refus, dans la langue du destinataire. */
export function libellerMotif(motif: MotifRefus, langue: "fr" | "en"): string {
  return LIBELLES_MOTIFS[motif][langue === "en" ? "en" : "fr"];
}

interface Gabarit {
  sujet: string;
  corps: string;
}

const GABARITS: Record<"fr" | "en", Record<ModeleAvis, Gabarit>> = {
  fr: {
    retard_paiement: {
      sujet: "CizaImmo — retard de paiement de votre abonnement",
      corps:
        "Bonjour {nom},\n\n" +
        "Nous n'avons pas encore reçu le paiement de votre abonnement CizaImmo (plan {plan}). " +
        "Pour éviter toute interruption de service, merci de régulariser votre abonnement avant le {date} " +
        "depuis la page Abonnement de votre espace.\n\n" +
        "Si vous avez déjà payé, ignorez simplement ce message.\n\n" +
        "L'équipe CizaImmo — Ciza Group",
    },
    fin_essai: {
      sujet: "CizaImmo — votre essai gratuit se termine bientôt",
      corps:
        "Bonjour {nom},\n\n" +
        "Votre essai gratuit CizaImmo (plan {plan}) se termine le {date}. " +
        "Choisissez votre abonnement dès maintenant pour continuer sans interruption : " +
        "vos immeubles, locataires et documents restent en place.\n\n" +
        "L'équipe CizaImmo — Ciza Group",
    },
    compte_suspendu: {
      sujet: "CizaImmo — votre compte a été suspendu",
      corps:
        "Bonjour {nom},\n\n" +
        "Votre compte CizaImmo (plan {plan}) a été suspendu le {date}. " +
        "Vos données sont conservées et n'ont pas été effacées. " +
        "Contactez notre équipe pour régulariser votre situation et réactiver votre accès.\n\n" +
        "L'équipe CizaImmo — Ciza Group",
    },
    compte_reactive: {
      sujet: "CizaImmo — votre compte est réactivé",
      corps:
        "Bonjour {nom},\n\n" +
        "Bonne nouvelle : votre compte CizaImmo (plan {plan}) est réactivé depuis le {date}. " +
        "Vous pouvez vous reconnecter, toutes vos données vous y attendent.\n\n" +
        "L'équipe CizaImmo — Ciza Group",
    },
    inscription_refusee: {
      sujet: "CizaImmo — votre demande d'inscription",
      corps:
        "Bonjour {nom},\n\n" +
        "Merci pour votre inscription à CizaImmo. Après examen, nous ne pouvons pas " +
        "activer votre compte pour le moment.\n\n" +
        "Motif : {motif}.\n\n" +
        "Si vous pensez qu'il s'agit d'une erreur, contactez notre équipe en répondant " +
        "à ce message.\n\n" +
        "L'équipe CizaImmo — Ciza Group",
    },
  },
  en: {
    retard_paiement: {
      sujet: "CizaImmo — late payment on your subscription",
      corps:
        "Hello {nom},\n\n" +
        "We have not yet received payment for your CizaImmo subscription ({plan} plan). " +
        "To avoid any service interruption, please settle your subscription before {date} " +
        "from the Subscription page of your account.\n\n" +
        "If you have already paid, please disregard this message.\n\n" +
        "The CizaImmo team — Ciza Group",
    },
    fin_essai: {
      sujet: "CizaImmo — your free trial ends soon",
      corps:
        "Hello {nom},\n\n" +
        "Your CizaImmo free trial ({plan} plan) ends on {date}. " +
        "Choose your subscription now to continue without interruption: " +
        "your buildings, tenants and documents stay in place.\n\n" +
        "The CizaImmo team — Ciza Group",
    },
    compte_suspendu: {
      sujet: "CizaImmo — your account has been suspended",
      corps:
        "Hello {nom},\n\n" +
        "Your CizaImmo account ({plan} plan) was suspended on {date}. " +
        "Your data is kept safe and has not been deleted. " +
        "Please contact our team to settle your situation and restore your access.\n\n" +
        "The CizaImmo team — Ciza Group",
    },
    compte_reactive: {
      sujet: "CizaImmo — your account is reactivated",
      corps:
        "Hello {nom},\n\n" +
        "Good news: your CizaImmo account ({plan} plan) has been reactivated as of {date}. " +
        "You can sign in again — all your data is waiting for you.\n\n" +
        "The CizaImmo team — Ciza Group",
    },
    inscription_refusee: {
      sujet: "CizaImmo — your registration request",
      corps:
        "Hello {nom},\n\n" +
        "Thank you for registering with CizaImmo. After review, we cannot " +
        "activate your account at this time.\n\n" +
        "Reason: {motif}.\n\n" +
        "If you believe this is a mistake, please contact our team by replying " +
        "to this message.\n\n" +
        "The CizaImmo team — Ciza Group",
    },
  },
};

/** Remplit un gabarit : {nom}, {plan}, {date} (+ {motif} si fourni). */
export function rendreAvis(
  modele: ModeleAvis,
  variables: VariablesAvis,
  langue: "fr" | "en"
): { sujet: string; corps: string } {
  const gabarit = GABARITS[langue === "en" ? "en" : "fr"][modele];
  const remplir = (texte: string) =>
    texte
      .split("{nom}").join(variables.nom)
      .split("{plan}").join(variables.plan)
      .split("{date}").join(variables.date)
      .split("{motif}").join(variables.motif ?? "");
  return { sujet: remplir(gabarit.sujet), corps: remplir(gabarit.corps) };
}

/**
 * E-mail de bienvenue après APPROBATION du compte (ajout n°3) : envoyé
 * via la chaîne e-mail existante, journalisé dans le journal d'audit
 * (action compte_approuve) — ce n'est pas un « avis » à modèle libre.
 */
export function rendreBienvenue(
  nom: string,
  langue: "fr" | "en"
): { sujet: string; corps: string } {
  if (langue === "en") {
    return {
      sujet: "Welcome to CizaImmo — your account is approved",
      corps:
        `Hello ${nom},\n\n` +
        "Good news: your CizaImmo account has been approved. Your free trial " +
        "starts today — sign in to create your first building and add your tenants.\n\n" +
        "The CizaImmo team — Ciza Group",
    };
  }
  return {
    sujet: "Bienvenue sur CizaImmo — votre compte est approuvé",
    corps:
      `Bonjour ${nom},\n\n` +
      "Bonne nouvelle : votre compte CizaImmo est approuvé. Votre essai gratuit " +
      "démarre aujourd'hui — connectez-vous pour créer votre premier immeuble et " +
      "ajouter vos locataires.\n\n" +
      "L'équipe CizaImmo — Ciza Group",
  };
}

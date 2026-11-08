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

/**
 * E-mail de DÉCISION « gestionnaire approuvé » (v1.3) : envoyé à
 * l'approbation d'un compte à intention GESTIONNAIRE, avec le contrat de
 * collaboration en PIÈCE JOINTE (PDF personnalisé avec le Display ID).
 * Le gestionnaire le signe et le téléverse dans son espace ; ses
 * fonctions restent verrouillées jusqu'à la validation du contrat
 * signé par un Admin.
 */
export function rendreDecisionGestionnaire(
  nom: string,
  displayId: string,
  langue: "fr" | "en"
): { sujet: string; corps: string } {
  if (langue === "en") {
    return {
      sujet: "CizaImmo — your property manager account is approved: please sign your agreement",
      corps:
        `Hello ${nom},\n\n` +
        "Good news: your CizaImmo property manager account has been approved and your free trial starts today.\n\n" +
        `Your file number (Display ID): ${displayId} — keep it: owners will use it to connect their file to yours.\n\n` +
        "Attached is your CizaImmo collaboration agreement (PDF). Please print it, sign it, " +
        "then upload the signed copy from your “My agreement” page in CizaImmo. Your manager " +
        "features (owner connections and access to their buildings) are unlocked once an " +
        "administrator validates your signed agreement.\n\n" +
        "The CizaImmo team — Ciza Group",
    };
  }
  return {
    sujet: "CizaImmo — votre compte gestionnaire est approuvé : signez votre contrat",
    corps:
      `Bonjour ${nom},\n\n` +
      "Bonne nouvelle : votre compte gestionnaire CizaImmo est approuvé et votre essai gratuit démarre aujourd'hui.\n\n" +
      `Votre numéro de dossier (Display ID) : ${displayId} — conservez-le : les propriétaires l'utiliseront pour rattacher leur dossier au vôtre.\n\n` +
      "Vous trouverez en pièce jointe votre contrat de collaboration CizaImmo (PDF). Imprimez-le, signez-le, " +
      "puis téléversez le contrat signé depuis la page « Mon contrat » de votre espace CizaImmo. Vos fonctions " +
      "gestionnaire (rattachements de propriétaires et accès à leurs immeubles) seront débloquées dès qu'un " +
      "administrateur aura validé votre contrat signé.\n\n" +
      "L'équipe CizaImmo — Ciza Group",
  };
}

/**
 * E-mail de bienvenue PROPRIÉTAIRE (option C, 2026-11-08) : envoyé à
 * l'approbation d'un compte à intention PROPRIÉTAIRE, avec le contrat
 * de service en PIÈCE JOINTE (PDF personnalisé avec le Display ID).
 * NON BLOQUANT : l'accès et l'essai sont déjà actifs — la signature
 * est une invitation, jamais une condition d'accès.
 */
export function rendreBienvenueProprietaire(
  nom: string,
  displayId: string,
  langue: "fr" | "en"
): { sujet: string; corps: string } {
  if (langue === "en") {
    return {
      sujet: "Welcome to CizaImmo — your account is approved (your agreement is attached)",
      corps:
        `Hello ${nom},\n\n` +
        "Good news: your CizaImmo account has been approved. Your free trial " +
        "starts today — sign in to create your first building and add your tenants.\n\n" +
        `Your file number (Display ID): ${displayId}.\n\n` +
        "Attached is your CizaImmo service agreement (PDF), already signed and stamped " +
        "by Ciza Group. Please sign it at your convenience and upload the signed copy " +
        "from the “My agreement” page in your CizaImmo space. Your access is already " +
        "active: nothing is blocked while your signature is pending.\n\n" +
        "The CizaImmo team — Ciza Group",
    };
  }
  return {
    sujet: "Bienvenue sur CizaImmo — votre compte est approuvé (votre contrat est joint)",
    corps:
      `Bonjour ${nom},\n\n` +
      "Bonne nouvelle : votre compte CizaImmo est approuvé. Votre essai gratuit " +
      "démarre aujourd'hui — connectez-vous pour créer votre premier immeuble et " +
      "ajouter vos locataires.\n\n" +
      `Votre numéro de dossier (Display ID) : ${displayId}.\n\n` +
      "Vous trouverez en pièce jointe votre contrat de service CizaImmo (PDF), déjà " +
      "signé et cacheté par Ciza Group. Signez-le à votre convenance, puis téléversez " +
      "le contrat signé depuis la page « Mon contrat » de votre espace CizaImmo. Votre " +
      "accès est déjà actif : rien n'est bloqué en attendant votre signature.\n\n" +
      "L'équipe CizaImmo — Ciza Group",
  };
}

/**
 * E-mail de VALIDATION du contrat propriétaire signé (option C) :
 * un Admin a validé le contrat redéposé — simple confirmation, aucun
 * déblocage (l'accès n'a jamais été bloqué).
 */
export function rendreValidationContratProprietaire(
  nom: string,
  langue: "fr" | "en"
): { sujet: string; corps: string } {
  if (langue === "en") {
    return {
      sujet: "CizaImmo — your signed service agreement is validated",
      corps:
        `Hello ${nom},\n\n` +
        "Your signed CizaImmo service agreement has been validated by our team. " +
        "It is now on file in your account — thank you.\n\n" +
        "The CizaImmo team — Ciza Group",
    };
  }
  return {
    sujet: "CizaImmo — votre contrat de service signé est validé",
    corps:
      `Bonjour ${nom},\n\n` +
      "Votre contrat de service CizaImmo signé a été validé par notre équipe. " +
      "Il est maintenant versé à votre dossier — merci.\n\n" +
      "L'équipe CizaImmo — Ciza Group",
  };
}

/**
 * E-mail de REFUS du contrat propriétaire signé (option C) : un Admin
 * a refusé le contrat redéposé, avec un motif — le propriétaire peut
 * redéposer une copie corrigée depuis son espace. Son accès reste
 * actif (contrat non bloquant).
 */
export function rendreRefusContratProprietaire(
  nom: string,
  motif: string,
  langue: "fr" | "en"
): { sujet: string; corps: string } {
  if (langue === "en") {
    return {
      sujet: "CizaImmo — your signed agreement could not be validated",
      corps:
        `Hello ${nom},\n\n` +
        "We could not validate the signed agreement you uploaded.\n" +
        `Reason: ${motif}\n\n` +
        "Please upload a corrected signed copy from the “My agreement” page in " +
        "your CizaImmo space. Your access remains fully active in the meantime.\n\n" +
        "The CizaImmo team — Ciza Group",
    };
  }
  return {
    sujet: "CizaImmo — votre contrat signé n'a pas pu être validé",
    corps:
      `Bonjour ${nom},\n\n` +
      "Nous n'avons pas pu valider le contrat signé que vous avez téléversé.\n" +
      `Motif : ${motif}\n\n` +
      "Vous pouvez téléverser une copie signée corrigée depuis la page « Mon " +
      "contrat » de votre espace CizaImmo. Votre accès reste entièrement actif " +
      "en attendant.\n\n" +
      "L'équipe CizaImmo — Ciza Group",
  };
}

/**
 * E-mail d'ACTIVATION gestionnaire (v1.3) : le contrat signé a été
 * validé par un Admin — les fonctions gestionnaire sont débloquées.
 */
export function rendreActivationGestionnaire(
  nom: string,
  displayId: string,
  langue: "fr" | "en"
): { sujet: string; corps: string } {
  if (langue === "en") {
    return {
      sujet: "CizaImmo — your signed agreement is validated: manager features unlocked",
      corps:
        `Hello ${nom},\n\n` +
        "Your signed collaboration agreement has been validated. Your manager features are now " +
        "unlocked: owners can connect to you with your Display ID " +
        `${displayId}, and once a connection is validated and buildings are assigned, you can manage them in CizaImmo.\n\n` +
        "The CizaImmo team — Ciza Group",
    };
  }
  return {
    sujet: "CizaImmo — votre contrat signé est validé : fonctions gestionnaire débloquées",
    corps:
      `Bonjour ${nom},\n\n` +
      "Votre contrat de collaboration signé a été validé. Vos fonctions gestionnaire sont maintenant " +
      "débloquées : les propriétaires peuvent se rattacher à vous avec votre Display ID " +
      `${displayId}, et dès qu'un rattachement est validé et que des immeubles vous sont assignés, vous pouvez les gérer dans CizaImmo.\n\n` +
      "L'équipe CizaImmo — Ciza Group",
  };
}

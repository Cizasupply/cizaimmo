/**
 * CizaImmo — contrat d'engagement de l'Admin plateforme (pack
 * employé, 2026-11-08, textes VALIDÉS par le fondateur).
 *
 * Deux voies, fixées par le Super Admin à la préparation :
 *  - voie « travail » : CONTRAT DE TRAVAIL — employé au Burundi.
 *    Texte = le brouillon validé, à l'égalité (articles numérotés),
 *    les champs [À COMPLÉTER PAR L'EMPLOYEUR] remplacés par les
 *    valeurs stockées en base. Aucune affiliation sociale nommée
 *    (retirée par le fondateur), aucune mention de relecture externe.
 *  - voie « prestation » : CONTRAT DE PRESTATION DE SERVICES —
 *    collaborateur indépendant hors du Burundi, rédigé en miroir :
 *    différences STRICTEMENT limitées à la nature du lien, au lieu
 *    et au droit applicable, à la rémunération et au paiement
 *    international, et à la fin de mission. Tâches, confidentialité
 *    et traçabilité IDENTIQUES. (Texte consigné pour relecture dans
 *    pack-employe-contrat-prestation-BROUILLON.md.)
 *
 * Données de l'employé PRÉ-REMPLIES depuis son dossier employé en
 * base (nom, Display ID, adresse, téléphone, pièce d'identité
 * déposée) — la base fait foi. Génération jsPDF via le même patron
 * que lib/contrat.ts (en-tête marine/or, entreprise pré-signée +
 * cachet apposés, bloc employé vierge « Lu et approuvé »).
 */

import { CACHET_CIZAGROUP_JPEG_BASE64 } from "./cachet";
import { SIGNATURE_PRESIDENT_DATA_URL } from "./signature";
import type {
  ParametresContratEmploye,
  VoieContratEmploye,
} from "./pack-employe";

export interface DonneesContratEmploye {
  nom: string;
  displayId: string | null;
  email: string;
  telephone: string | null;
  /** Adresse postale complète du dossier employé (une ligne). */
  adresse: string | null;
  /** Nom du fichier de la pièce d'identité déposée au dossier. */
  pieceIdentite: string | null;
  langue: "fr" | "en";
  /** Date d'émission (ISO, ex. « 2026-11-08 »). */
  date: string;
  parametres: ParametresContratEmploye;
}

/** Nom de fichier stable du contrat d'engagement d'un employé. */
export function nomFichierContratEmploye(displayId: string | null): string {
  return `contrat-employe-${displayId ?? "sans-id"}.pdf`;
}

const MOIS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin", "juillet",
  "août", "septembre", "octobre", "novembre", "décembre",
];
const MOIS_EN = [
  "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December",
];

/** « 2026-11-08 » -> « 8 novembre 2026 » / « November 8, 2026 ». */
export function formaterDateContrat(iso: string, langue: "fr" | "en"): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return iso;
  const annee = m[1];
  const mois = Number(m[2]);
  const jour = Number(m[3]);
  if (mois < 1 || mois > 12) return iso;
  return langue === "en"
    ? `${MOIS_EN[mois - 1]} ${jour}, ${annee}`
    : `${jour} ${MOIS_FR[mois - 1]} ${annee}`;
}

/** 500000 -> « 500 000 » (groupes de trois, espace simple). */
export function formaterMontantContrat(montant: number): string {
  const entier = Math.round(montant);
  return String(entier).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// ============================================================================
// TÂCHES DE L'ADMIN — IDENTIQUES dans les deux voies (article des
// fonctions). Texte repris du brouillon validé, puces numérotées.
// ============================================================================

const TACHES_FR: readonly string[] = [
  "Revue des dossiers clients : examiner chaque dossier d'inscription selon la checklist d'approbation (photo, pièce d'identité, informations du compte, signal anti-fraude lorsque le compte est marqué « à vérifier ») et consigner le résultat de la revue dans la plateforme ;",
  "Approbations et refus : approuver les comptes dont le dossier est complet et conforme, ou les refuser en indiquant obligatoirement un motif prédéfini ; aucune approbation ne peut être donnée sur un dossier incomplet ;",
  "Validation des contrats clients : examiner les contrats signés redéposés par les propriétaires et les gestionnaires, les valider ou les refuser avec un motif ;",
  "Validation des immeubles et des autorisations : vérifier les preuves de propriété (titre, certificat foncier ou acte d'achat) et les autorisations de gestion déposées par les gestionnaires, et décider de la validation de chaque immeuble ;",
  "Messages clients : répondre aux messages des clients dans la messagerie de la plateforme, avec courtoisie et dans un délai raisonnable, et traiter les demandes qui relèvent de son niveau ; il ne prend aucun engagement financier au nom de CizaImmo ;",
  "Suivi des abonnements : suivre les dossiers qui lui sont assignés et les abonnements clients en retard de paiement, et effectuer les relances prévues par les procédures internes ;",
  "Supervision des rattachements : consulter, en lecture seule, les échanges entre propriétaires et gestionnaires rattachés, dans le seul but de supervision, chaque consultation étant journalisée ;",
  "Signalement des anomalies : signaler immédiatement au Super Admin toute anomalie, tentative de fraude, document suspect ou incident de sécurité dont il a connaissance — un document n'est jamais tenu pour authentique sans vérification ;",
  "De manière générale, exécuter avec diligence, loyauté et professionnalisme toute tâche connexe confiée par le Super Admin dans le cadre du Poste.",
];

const TACHES_EN: readonly string[] = [
  "Client file review: examine each registration file against the approval checklist (photo, ID document, account information, anti-fraud flag when the account is marked “to verify”) and record the outcome of the review in the platform;",
  "Approvals and refusals: approve accounts whose file is complete and compliant, or refuse them, always stating a predefined reason; no approval may be given on an incomplete file;",
  "Client agreement validation: examine the signed agreements uploaded by owners and property managers, and validate them or refuse them with a reason;",
  "Building and authorization validation: verify proofs of ownership (title, land certificate or deed of purchase) and the management authorizations filed by property managers, and decide on the validation of each building;",
  "Client messages: reply to client messages in the platform messaging, courteously and within a reasonable time, and handle the requests that fall within their remit; they never make any financial commitment on behalf of CizaImmo;",
  "Subscription follow-up: follow the files assigned to them and client subscriptions in late payment, and carry out the reminders provided for by the internal procedures;",
  "Connection supervision: consult, in read-only mode, the exchanges between connected owners and property managers, for supervision purposes only, each consultation being logged;",
  "Reporting anomalies: immediately report to the Super Admin any anomaly, attempted fraud, suspicious document or security incident they become aware of — a document is never taken as genuine without verification;",
  "In general, carry out with diligence, loyalty and professionalism any related task entrusted by the Super Admin within the scope of the Position.",
];

// ============================================================================
// ARTICLES — fonction PURE (testée) : le PDF ne fait que les rendre.
// ============================================================================

export interface ArticleContrat {
  titre: string;
  paragraphes: string[];
}

export interface TextesContratEmploye {
  titre: string;
  division: string;
  entre: string;
  partieEntreprise: string;
  et: string;
  partieEmploye: string;
  champs: { libelle: string; valeur: string }[];
  introArticles: string;
  articles: ArticleContrat[];
  cloture: string;
  signatures: string;
  pourEntreprise: string;
  pourEmploye: string;
  signatureMentionEntreprise: string;
  signatureMentionEmploye: string;
  pied: string;
  contacts: string;
}

const ENTREPRISE_FR =
  "CIZA GROUP SURL, société de droit burundais, RC n° 0082870/26, NIF n° 4003446905, dont le siège est situé au 6ème Avenue N° 47, Quartier Buhomba, Zone Mutimbuzi, Commune Ntahangwa, Province Bujumbura — Burundi, représentée par Ciza Misigaro, Président Directeur";
const ENTREPRISE_EN =
  "CIZA GROUP SURL, a company incorporated under Burundian law, RC no. 0082870/26, Tax ID (NIF) 4003446905, whose head office is located at 6ème Avenue N° 47, Quartier Buhomba, Zone Mutimbuzi, Commune Ntahangwa, Bujumbura Province — Burundi, represented by Ciza Misigaro, President and Chief Executive Officer";

/**
 * Libellé de durée selon la langue du document : le champ « type »
 * stocké peut être un CODE canonique posé par le formulaire de
 * préparation (CDI / CDD / PRESTA_INDET / PRESTA_DET) — traduit ici —
 * ou un libellé libre, alors repris tel quel. La durée libre
 * éventuelle (CDD / mission déterminée) suit entre parenthèses.
 */
function dureeTexte(p: ParametresContratEmploye, en: boolean): string {
  const codes: Record<string, [string, string]> = {
    CDI: ["indéterminée (CDI)", "indefinite term (CDI)"],
    CDD: ["déterminée (CDD)", "fixed term (CDD)"],
    PRESTA_INDET: ["indéterminée", "indefinite term"],
    PRESTA_DET: ["déterminée", "fixed term"],
  };
  const base = codes[p.type]
    ? codes[p.type][en ? 1 : 0]
    : p.type;
  return p.duree ? `${base} (${p.duree})` : base;
}

function montantTexte(
  p: ParametresContratEmploye,
  nonRenseigne: string
): string {
  return p.montant !== null && p.montant !== undefined
    ? `${formaterMontantContrat(p.montant)} ${p.devise}`
    : nonRenseigne;
}

// ---------- Voie A : contrat de travail (texte validé, FR) ----------

function articlesTravailFr(d: DonneesContratEmploye): ArticleContrat[] {
  const p = d.parametres;
  const dateDebut = formaterDateContrat(p.date_debut, "fr");
  return [
    {
      titre: "Article 1 — Engagement et fonction",
      paragraphes: [
        "L'Employeur engage l'Employé en qualité d'Admin plateforme CizaImmo (ci-après « le Poste »). L'Employé exerce ses fonctions au sein de la plateforme de gestion immobilière CizaImmo, division de Ciza Group, sous l'autorité directe du Super Admin (le fondateur ou la personne qu'il désigne). Le rôle d'Admin est un rôle de confiance : il donne accès aux dossiers des clients de la plateforme, à leurs documents et à leurs messages.",
      ],
    },
    {
      titre: "Article 2 — Durée du contrat et date de début",
      paragraphes: [
        `Le présent contrat est conclu pour une durée ${dureeTexte(p, false)}.`,
        `Il prend effet le ${dateDebut}.`,
      ],
    },
    {
      titre: "Article 3 — Période d'essai",
      paragraphes: [
        p.periode_essai
          ? `L'engagement est soumis à une période d'essai de ${p.periode_essai}, pendant laquelle chaque partie peut rompre le contrat dans les conditions prévues par le Code du travail. La période d'essai n'est pas renouvelable, sauf stipulation contraire écrite de l'Employeur dans la limite légale.`
          : "L'engagement n'est soumis à aucune période d'essai.",
      ],
    },
    {
      titre: "Article 4 — Lieu et organisation du travail",
      paragraphes: [
        `L'Employé exerce principalement ses fonctions ${p.lieu}, au moyen de la console d'administration de la plateforme, accessible en ligne avec son compte personnel. Les horaires de travail sont les suivants : ${p.horaires}. L'Employé reste joignable pendant ses heures de service pour les dossiers qui lui sont assignés.`,
      ],
    },
    {
      titre: "Article 5 — Fonctions et tâches",
      paragraphes: [
        "L'Employé assure, dans la console d'administration, les tâches suivantes :",
        ...TACHES_FR.map((t, i) => `${i + 1}. ${t}`),
        "L'Employé ne peut ni modifier les tarifs et paramètres de la plateforme, ni supprimer définitivement un compte, ni créer d'autres comptes Admin : ces pouvoirs sont réservés au Super Admin.",
      ],
    },
    {
      titre: "Article 6 — Rémunération",
      paragraphes: [
        `En contrepartie de son travail, l'Employé perçoit un salaire brut mensuel de ${montantTexte(p, "Non renseigné")}, versé ${p.modalites_paiement}, accompagné d'un bulletin de paie.`,
      ],
    },
    {
      titre: "Article 7 — Compte d'accès personnel et traçabilité",
      paragraphes: [
        "L'accès de l'Employé à la console s'effectue au moyen d'un compte strictement personnel, protégé par un mot de passe qu'il ne doit communiquer à personne. L'Employé est responsable de toutes les actions effectuées depuis son compte.",
        "L'Employé reconnaît et accepte que l'ensemble de ses actions dans la plateforme est journalisé dans le journal d'audit de la plateforme (qui a fait quoi, à quel moment), et que ce journal peut être consulté par le Super Admin à tout moment.",
        "L'Employeur peut suspendre l'accès de l'Employé à la console à tout moment, notamment en cas de manquement au présent contrat ou à la charte de confidentialité, sans que cette suspension mette par elle-même fin au contrat de travail.",
      ],
    },
    {
      titre: "Article 8 — Confidentialité renforcée",
      paragraphes: [
        "Dans le cadre du Poste, l'Employé accède à des informations strictement confidentielles : identité et documents des clients (pièces d'identité, preuves de propriété, contrats), coordonnées et messages des clients, données des immeubles et des locataires, tarifs, conditions commerciales et méthodes de travail internes de l'entreprise.",
        "L'Employé s'engage à :",
        "• ne divulguer aucune de ces informations à un tiers, directement ou indirectement, sous quelque forme que ce soit ;",
        "• ne les utiliser que dans le cadre strict de ses fonctions, et jamais à des fins personnelles, pour son compte ou pour le compte d'autrui ;",
        "• ne pas copier, photographier, télécharger ni conserver ces informations hors de la plateforme, sauf besoin strict du service et accord du Super Admin ;",
        "• protéger son accès et signaler sans délai toute suspicion d'accès non autorisé.",
        "Le présent engagement de confidentialité s'applique pendant toute la durée du contrat et se poursuit après la fin du contrat, quel qu'en soit le motif. Tout manquement expose l'Employé à des sanctions disciplinaires ainsi qu'à des poursuites civiles et pénales, conformément aux lois en vigueur.",
        "À la première connexion à la console, l'Employé accepte en outre la charte de confidentialité de la plateforme, dont l'acceptation datée est conservée dans la base et fait partie intégrante du présent contrat.",
      ],
    },
    {
      titre: "Article 9 — Exactitude et intégrité des décisions",
      paragraphes: [
        "L'Employé est responsable de l'exactitude des informations qu'il saisit, vérifie ou valide dans la plateforme. Il s'interdit toute manipulation de dossier, toute approbation de complaisance et tout traitement de faveur. Toute fausse déclaration ou validation irrégulière peut entraîner la suspension immédiate de l'accès et des sanctions disciplinaires, sans préjudice de poursuites.",
      ],
    },
    {
      titre: "Article 10 — Obligations de l'Employeur",
      paragraphes: [
        "L'Employeur s'engage à : fournir à l'Employé le travail convenu et les moyens nécessaires à son exécution, dont l'accès à la console ; verser régulièrement le salaire convenu ; assurer des conditions de travail conformes aux normes d'hygiène et de sécurité ; respecter les dispositions du Code du travail.",
        "L'Employé bénéficie des congés et absences prévus par le Code du travail et par le règlement intérieur de l'entreprise, qui lui est remis et fait partie des annexes du présent contrat.",
      ],
    },
    {
      titre: "Article 11 — Discipline",
      paragraphes: [
        "Tout manquement aux obligations du présent contrat, à la charte de confidentialité ou au règlement intérieur expose l'Employé aux sanctions disciplinaires prévues audit règlement, dans le respect de la procédure légale et des droits de la défense.",
      ],
    },
    {
      titre: "Article 12 — Fin du contrat et restitution",
      paragraphes: [
        "Chaque partie peut mettre fin au présent contrat dans les conditions et préavis prévus par le Code du travail.",
        "À la fin du contrat, quel qu'en soit le motif, l'Employé :",
        "• perd immédiatement son accès à la console, que l'Employeur désactive ;",
        "• restitue l'ensemble des documents, supports, équipements et copies en sa possession appartenant à l'entreprise ou contenant des informations confidentielles, et n'en conserve aucune copie ;",
        "• restitue sa carte employé, le cas échéant.",
        "À la fin du contrat, l'Employeur remet à l'Employé un certificat de travail et son solde de tout compte, conformément à la loi.",
      ],
    },
    {
      titre: "Article 13 — Droit applicable et litiges",
      paragraphes: [
        "Le présent contrat est soumis au droit burundais, notamment au Code du travail (loi n° 1/11 du 24 novembre 2020). En cas de différend, les parties recherchent d'abord un règlement amiable ; à défaut, le tribunal du travail de Bujumbura est compétent.",
      ],
    },
    {
      titre: "Article 14 — Annexes",
      paragraphes: [
        "Sont annexés au présent contrat et en font partie intégrante : la charte de confidentialité de la plateforme (acceptée en ligne, acceptation datée conservée) et le règlement intérieur de l'entreprise, remis à l'Employé.",
      ],
    },
  ];
}

// ---------- Voie A : employment contract (EN, faithful) ----------

function articlesTravailEn(d: DonneesContratEmploye): ArticleContrat[] {
  const p = d.parametres;
  const dateDebut = formaterDateContrat(p.date_debut, "en");
  return [
    {
      titre: "Article 1 — Engagement and position",
      paragraphes: [
        "The Employer engages the Employee as a CizaImmo Platform Admin (hereinafter “the Position”). The Employee performs their duties within the CizaImmo property management platform, a division of Ciza Group, under the direct authority of the Super Admin (the founder or the person they designate). The Admin role is a position of trust: it gives access to the platform's client files, their documents and their messages.",
      ],
    },
    {
      titre: "Article 2 — Term of the contract and start date",
      paragraphes: [
        `This contract is entered into for a term of ${dureeTexte(p, true)}.`,
        `It takes effect on ${dateDebut}.`,
      ],
    },
    {
      titre: "Article 3 — Probationary period",
      paragraphes: [
        p.periode_essai
          ? `The engagement is subject to a probationary period of ${p.periode_essai}, during which either party may terminate the contract under the conditions provided for by the Labour Code. The probationary period is not renewable, unless otherwise stipulated in writing by the Employer within the legal limit.`
          : "The engagement is not subject to any probationary period.",
      ],
    },
    {
      titre: "Article 4 — Place and organization of work",
      paragraphes: [
        `The Employee primarily performs their duties ${p.lieu}, by means of the platform's administration console, accessible online with their personal account. Working hours are as follows: ${p.horaires}. The Employee remains reachable during their service hours for the files assigned to them.`,
      ],
    },
    {
      titre: "Article 5 — Duties and tasks",
      paragraphes: [
        "The Employee carries out, in the administration console, the following tasks:",
        ...TACHES_EN.map((t, i) => `${i + 1}. ${t}`),
        "The Employee may neither change the platform's rates and settings, nor permanently delete an account, nor create other Admin accounts: these powers are reserved to the Super Admin.",
      ],
    },
    {
      titre: "Article 6 — Remuneration",
      paragraphes: [
        `In return for their work, the Employee receives a gross monthly salary of ${montantTexte(p, "Not provided")}, paid ${p.modalites_paiement}, together with a pay slip.`,
      ],
    },
    {
      titre: "Article 7 — Personal access account and traceability",
      paragraphes: [
        "The Employee's access to the console is through a strictly personal account, protected by a password that must not be shared with anyone. The Employee is responsible for all actions carried out from their account.",
        "The Employee acknowledges and accepts that all of their actions in the platform are logged in the platform's audit log (who did what, and when), and that this log may be consulted by the Super Admin at any time.",
        "The Employer may suspend the Employee's access to the console at any time, in particular in the event of a breach of this contract or of the confidentiality charter, without such suspension by itself terminating the employment contract.",
      ],
    },
    {
      titre: "Article 8 — Enhanced confidentiality",
      paragraphes: [
        "In the course of the Position, the Employee accesses strictly confidential information: client identities and documents (ID documents, proofs of ownership, agreements), client contact details and messages, building and tenant data, rates, commercial terms and the company's internal working methods.",
        "The Employee undertakes to:",
        "• never disclose any of this information to a third party, directly or indirectly, in any form whatsoever;",
        "• use it only within the strict scope of their duties, and never for personal purposes, for their own account or for the account of another;",
        "• not copy, photograph, download or keep this information outside the platform, except where strictly required for the service and with the Super Admin's agreement;",
        "• protect their access and report without delay any suspected unauthorized access.",
        "This confidentiality undertaking applies throughout the term of the contract and continues after the end of the contract, whatever the reason. Any breach exposes the Employee to disciplinary sanctions as well as civil and criminal proceedings, in accordance with the laws in force.",
        "On first signing in to the console, the Employee also accepts the platform's confidentiality charter, whose dated acceptance is kept in the database and forms an integral part of this contract.",
      ],
    },
    {
      titre: "Article 9 — Accuracy and integrity of decisions",
      paragraphes: [
        "The Employee is responsible for the accuracy of the information they enter, check or validate in the platform. They shall refrain from any manipulation of files, any approval as a favour and any preferential treatment. Any false declaration or irregular validation may lead to immediate suspension of access and disciplinary sanctions, without prejudice to legal proceedings.",
      ],
    },
    {
      titre: "Article 10 — Obligations of the Employer",
      paragraphes: [
        "The Employer undertakes to: provide the Employee with the agreed work and the means necessary to perform it, including access to the console; pay the agreed salary regularly; ensure working conditions that comply with health and safety standards; and comply with the provisions of the Labour Code.",
        "The Employee benefits from the leave and absences provided for by the Labour Code and by the company's internal regulations, which are given to them and form part of the annexes to this contract.",
      ],
    },
    {
      titre: "Article 11 — Discipline",
      paragraphes: [
        "Any breach of the obligations of this contract, of the confidentiality charter or of the internal regulations exposes the Employee to the disciplinary sanctions provided for by those regulations, in compliance with the legal procedure and the rights of the defence.",
      ],
    },
    {
      titre: "Article 12 — End of the contract and restitution",
      paragraphes: [
        "Either party may terminate this contract under the conditions and notice periods provided for by the Labour Code.",
        "At the end of the contract, whatever the reason, the Employee:",
        "• immediately loses their access to the console, which the Employer deactivates;",
        "• returns all documents, media, equipment and copies in their possession belonging to the company or containing confidential information, and keeps no copy of them;",
        "• returns their employee card, where applicable.",
        "At the end of the contract, the Employer gives the Employee a work certificate and their final settlement of all accounts, in accordance with the law.",
      ],
    },
    {
      titre: "Article 13 — Applicable law and disputes",
      paragraphes: [
        "This contract is governed by Burundian law, in particular the Labour Code (Law no. 1/11 of 24 November 2020). In the event of a dispute, the parties shall first seek an amicable settlement; failing that, the Bujumbura Labour Court has jurisdiction.",
      ],
    },
    {
      titre: "Article 14 — Annexes",
      paragraphes: [
        "The following are annexed to this contract and form an integral part of it: the platform's confidentiality charter (accepted online, dated acceptance kept) and the company's internal regulations, given to the Employee.",
      ],
    },
  ];
}

// ---------- Voie B : prestation de services (miroir, FR) ----------

function articlesPrestationFr(d: DonneesContratEmploye): ArticleContrat[] {
  const p = d.parametres;
  const dateDebut = formaterDateContrat(p.date_debut, "fr");
  return [
    {
      titre: "Article 1 — Objet et nature de la collaboration",
      paragraphes: [
        "Le Client confie au Prestataire, qui l'accepte, une mission d'administration de la plateforme CizaImmo, division de Ciza Group, décrite à l'article 4 du présent contrat. Le Prestataire exerce sa mission en qualité de collaborateur indépendant : le présent contrat est un contrat de prestation de services — il ne crée ni contrat de travail, ni lien de subordination, ni mandat de représentation du Client. Le Prestataire organise librement l'exécution de sa mission, dans le respect des procédures de la plateforme et sous la coordination du Super Admin (le fondateur ou la personne qu'il désigne). Le rôle d'Admin plateforme est un rôle de confiance : il donne accès aux dossiers des clients de la plateforme, à leurs documents et à leurs messages.",
      ],
    },
    {
      titre: "Article 2 — Durée de la mission et date de début",
      paragraphes: [
        `La présente mission est conclue pour une durée ${dureeTexte(p, false)}.`,
        `Elle prend effet le ${dateDebut}.`,
      ],
    },
    {
      titre: "Article 3 — Lieu d'exécution et obligations propres du Prestataire",
      paragraphes: [
        `Le Prestataire exécute sa mission depuis ${p.lieu}, hors du territoire du Burundi, au moyen de la console d'administration de la plateforme, accessible en ligne avec son compte personnel. Ses plages de disponibilité sont les suivantes : ${p.horaires}. Le Prestataire reste joignable pendant ces plages pour les dossiers qui lui sont assignés.`,
        "Le Prestataire est seul responsable du respect de ses obligations fiscales, sociales et administratives dans son pays de résidence ; aucune affiliation ni retenue sociale n'est opérée au Burundi au titre de la présente mission.",
      ],
    },
    {
      titre: "Article 4 — Fonctions et tâches",
      paragraphes: [
        "Le Prestataire assure, dans la console d'administration, les tâches suivantes :",
        ...TACHES_FR.map((t, i) => `${i + 1}. ${t}`),
        "Le Prestataire ne peut ni modifier les tarifs et paramètres de la plateforme, ni supprimer définitivement un compte, ni créer d'autres comptes Admin : ces pouvoirs sont réservés au Super Admin.",
      ],
    },
    {
      titre: "Article 5 — Honoraires et paiement international",
      paragraphes: [
        `En contrepartie de sa mission, le Prestataire perçoit des honoraires mensuels de ${montantTexte(p, "Non renseigné")}, payés par virement international selon les modalités suivantes : ${p.modalites_paiement}. Ces honoraires s'entendent bruts de toutes charges fiscales et sociales incombant au Prestataire dans son pays de résidence.`,
      ],
    },
    {
      titre: "Article 6 — Compte d'accès personnel et traçabilité",
      paragraphes: [
        "L'accès du Prestataire à la console s'effectue au moyen d'un compte strictement personnel, protégé par un mot de passe qu'il ne doit communiquer à personne. Le Prestataire est responsable de toutes les actions effectuées depuis son compte.",
        "Le Prestataire reconnaît et accepte que l'ensemble de ses actions dans la plateforme est journalisé dans le journal d'audit de la plateforme (qui a fait quoi, à quel moment), et que ce journal peut être consulté par le Super Admin à tout moment.",
        "Le Client peut suspendre l'accès du Prestataire à la console à tout moment, notamment en cas de manquement au présent contrat ou à la charte de confidentialité, sans que cette suspension mette par elle-même fin au présent contrat.",
      ],
    },
    {
      titre: "Article 7 — Confidentialité renforcée",
      paragraphes: [
        "Dans le cadre de sa mission, le Prestataire accède à des informations strictement confidentielles : identité et documents des clients (pièces d'identité, preuves de propriété, contrats), coordonnées et messages des clients, données des immeubles et des locataires, tarifs, conditions commerciales et méthodes de travail internes de l'entreprise.",
        "Le Prestataire s'engage à :",
        "• ne divulguer aucune de ces informations à un tiers, directement ou indirectement, sous quelque forme que ce soit ;",
        "• ne les utiliser que dans le cadre strict de sa mission, et jamais à des fins personnelles, pour son compte ou pour le compte d'autrui ;",
        "• ne pas copier, photographier, télécharger ni conserver ces informations hors de la plateforme, sauf besoin strict du service et accord du Super Admin ;",
        "• protéger son accès et signaler sans délai toute suspicion d'accès non autorisé.",
        "Le présent engagement de confidentialité s'applique pendant toute la durée du contrat et se poursuit après la fin du contrat, quel qu'en soit le motif. Tout manquement expose le Prestataire à la fin immédiate de la mission ainsi qu'à des poursuites civiles et pénales, conformément aux lois en vigueur.",
        "À la première connexion à la console, le Prestataire accepte en outre la charte de confidentialité de la plateforme, dont l'acceptation datée est conservée dans la base et fait partie intégrante du présent contrat.",
      ],
    },
    {
      titre: "Article 8 — Exactitude et intégrité des décisions",
      paragraphes: [
        "Le Prestataire est responsable de l'exactitude des informations qu'il saisit, vérifie ou valide dans la plateforme. Il s'interdit toute manipulation de dossier, toute approbation de complaisance et tout traitement de faveur. Toute fausse déclaration ou validation irrégulière peut entraîner la suspension immédiate de l'accès et la fin de la mission, sans préjudice de poursuites.",
      ],
    },
    {
      titre: "Article 9 — Fin de la mission et restitution",
      paragraphes: [
        "Chaque partie peut mettre fin au présent contrat moyennant un préavis écrit de trente (30) jours. En cas de manquement grave, le Client peut y mettre fin sans préavis et suspendre l'accès immédiatement.",
        "À la fin de la mission, quel qu'en soit le motif, le Prestataire :",
        "• perd immédiatement son accès à la console, que le Client désactive ;",
        "• restitue l'ensemble des documents, supports, équipements et copies en sa possession appartenant à l'entreprise ou contenant des informations confidentielles, et n'en conserve aucune copie ;",
        "• restitue sa carte employé, le cas échéant.",
        "La fin de la mission ne donne lieu ni à un certificat de travail, ni à un solde de tout compte : la présente collaboration n'est pas un contrat de travail.",
      ],
    },
    {
      titre: "Article 10 — Droit applicable et litiges",
      paragraphes: [
        "Le présent contrat est soumis au droit burundais. En cas de différend, les parties recherchent d'abord un règlement amiable ; à défaut, les tribunaux compétents de Bujumbura sont compétents.",
      ],
    },
    {
      titre: "Article 11 — Annexes",
      paragraphes: [
        "Sont annexés au présent contrat et en font partie intégrante : la charte de confidentialité de la plateforme (acceptée en ligne, acceptation datée conservée) et les procédures internes de la plateforme communiquées au Prestataire.",
      ],
    },
  ];
}

// ---------- Voie B : services agreement (EN, mirror) ----------

function articlesPrestationEn(d: DonneesContratEmploye): ArticleContrat[] {
  const p = d.parametres;
  const dateDebut = formaterDateContrat(p.date_debut, "en");
  return [
    {
      titre: "Article 1 — Purpose and nature of the collaboration",
      paragraphes: [
        "The Client entrusts to the Contractor, who accepts, a mission to administer the CizaImmo platform, a division of Ciza Group, as described in Article 4 of this contract. The Contractor performs the mission as an independent contractor: this contract is a services agreement — it creates neither an employment contract, nor a relationship of subordination, nor a mandate to represent the Client. The Contractor freely organizes the performance of the mission, in compliance with the platform's procedures and under the coordination of the Super Admin (the founder or the person they designate). The Platform Admin role is a position of trust: it gives access to the platform's client files, their documents and their messages.",
      ],
    },
    {
      titre: "Article 2 — Term of the mission and start date",
      paragraphes: [
        `This mission is entered into for a term of ${dureeTexte(p, true)}.`,
        `It takes effect on ${dateDebut}.`,
      ],
    },
    {
      titre: "Article 3 — Place of performance and the Contractor's own obligations",
      paragraphes: [
        `The Contractor performs the mission from ${p.lieu}, outside the territory of Burundi, by means of the platform's administration console, accessible online with their personal account. Their availability windows are as follows: ${p.horaires}. The Contractor remains reachable during these windows for the files assigned to them.`,
        "The Contractor is solely responsible for complying with their tax, social and administrative obligations in their country of residence; no social affiliation or withholding is made in Burundi in respect of this mission.",
      ],
    },
    {
      titre: "Article 4 — Duties and tasks",
      paragraphes: [
        "The Contractor carries out, in the administration console, the following tasks:",
        ...TACHES_EN.map((t, i) => `${i + 1}. ${t}`),
        "The Contractor may neither change the platform's rates and settings, nor permanently delete an account, nor create other Admin accounts: these powers are reserved to the Super Admin.",
      ],
    },
    {
      titre: "Article 5 — Fees and international payment",
      paragraphes: [
        `In return for the mission, the Contractor receives monthly fees of ${montantTexte(p, "Not provided")}, paid by international transfer under the following terms: ${p.modalites_paiement}. These fees are gross of all tax and social charges incumbent on the Contractor in their country of residence.`,
      ],
    },
    {
      titre: "Article 6 — Personal access account and traceability",
      paragraphes: [
        "The Contractor's access to the console is through a strictly personal account, protected by a password that must not be shared with anyone. The Contractor is responsible for all actions carried out from their account.",
        "The Contractor acknowledges and accepts that all of their actions in the platform are logged in the platform's audit log (who did what, and when), and that this log may be consulted by the Super Admin at any time.",
        "The Client may suspend the Contractor's access to the console at any time, in particular in the event of a breach of this contract or of the confidentiality charter, without such suspension by itself terminating this contract.",
      ],
    },
    {
      titre: "Article 7 — Enhanced confidentiality",
      paragraphes: [
        "In the course of the mission, the Contractor accesses strictly confidential information: client identities and documents (ID documents, proofs of ownership, agreements), client contact details and messages, building and tenant data, rates, commercial terms and the company's internal working methods.",
        "The Contractor undertakes to:",
        "• never disclose any of this information to a third party, directly or indirectly, in any form whatsoever;",
        "• use it only within the strict scope of the mission, and never for personal purposes, for their own account or for the account of another;",
        "• not copy, photograph, download or keep this information outside the platform, except where strictly required for the service and with the Super Admin's agreement;",
        "• protect their access and report without delay any suspected unauthorized access.",
        "This confidentiality undertaking applies throughout the term of the contract and continues after the end of the contract, whatever the reason. Any breach exposes the Contractor to immediate termination of the mission as well as civil and criminal proceedings, in accordance with the laws in force.",
        "On first signing in to the console, the Contractor also accepts the platform's confidentiality charter, whose dated acceptance is kept in the database and forms an integral part of this contract.",
      ],
    },
    {
      titre: "Article 8 — Accuracy and integrity of decisions",
      paragraphes: [
        "The Contractor is responsible for the accuracy of the information they enter, check or validate in the platform. They shall refrain from any manipulation of files, any approval as a favour and any preferential treatment. Any false declaration or irregular validation may lead to immediate suspension of access and termination of the mission, without prejudice to legal proceedings.",
      ],
    },
    {
      titre: "Article 9 — End of the mission and restitution",
      paragraphes: [
        "Either party may terminate this contract with thirty (30) days' written notice. In the event of a serious breach, the Client may terminate it without notice and suspend access immediately.",
        "At the end of the mission, whatever the reason, the Contractor:",
        "• immediately loses their access to the console, which the Client deactivates;",
        "• returns all documents, media, equipment and copies in their possession belonging to the company or containing confidential information, and keeps no copy of them;",
        "• returns their employee card, where applicable.",
        "The end of the mission gives rise neither to a work certificate nor to a final settlement of all accounts: this collaboration is not an employment contract.",
      ],
    },
    {
      titre: "Article 10 — Applicable law and disputes",
      paragraphes: [
        "This contract is governed by Burundian law. In the event of a dispute, the parties shall first seek an amicable settlement; failing that, the competent courts of Bujumbura have jurisdiction.",
      ],
    },
    {
      titre: "Article 11 — Annexes",
      paragraphes: [
        "The following are annexed to this contract and form an integral part of it: the platform's confidentiality charter (accepted online, dated acceptance kept) and the platform's internal procedures provided to the Contractor.",
      ],
    },
  ];
}

// ---------- Assemblage des textes complets (fonction pure) ----------

/**
 * Textes complets du contrat d'engagement selon la voie et la
 * langue du compte — utilisés par le rendu PDF et verrouillés par
 * les tests (différences d'articles entre voies, aucune affiliation
 * sociale nommée dans les textes générés).
 */
export function textesContratEmploye(
  d: DonneesContratEmploye
): TextesContratEmploye {
  const en = d.langue === "en";
  const voie: VoieContratEmploye =
    d.parametres.voie === "prestation" ? "prestation" : "travail";
  const nonRenseigne = en ? "Not provided" : "Non renseigné";
  const champs: { libelle: string; valeur: string }[] = en
    ? [
        { libelle: "Name", valeur: d.nom },
        { libelle: "Display ID", valeur: d.displayId ?? nonRenseigne },
        { libelle: "ID document", valeur: d.pieceIdentite ?? nonRenseigne },
        { libelle: "Address", valeur: d.adresse ?? nonRenseigne },
        { libelle: "Phone", valeur: d.telephone ?? nonRenseigne },
        { libelle: "Email", valeur: d.email },
        { libelle: "Date", valeur: formaterDateContrat(d.date, "en") },
      ]
    : [
        { libelle: "Nom et prénom", valeur: d.nom },
        { libelle: "Display ID CizaImmo", valeur: d.displayId ?? nonRenseigne },
        { libelle: "Pièce d'identité", valeur: d.pieceIdentite ?? nonRenseigne },
        { libelle: "Adresse", valeur: d.adresse ?? nonRenseigne },
        { libelle: "Téléphone", valeur: d.telephone ?? nonRenseigne },
        { libelle: "E-mail du compte", valeur: d.email },
        { libelle: "Date", valeur: formaterDateContrat(d.date, "fr") },
      ];

  if (voie === "travail") {
    return {
      titre: en
        ? "Employment contract — CizaImmo Platform Admin"
        : "Contrat de travail — Admin plateforme CizaImmo",
      division: en
        ? "CizaImmo — a division of Ciza Group"
        : "CizaImmo — division de Ciza Group",
      entre: en ? "Between the undersigned:" : "Entre les soussignés :",
      partieEntreprise: en
        ? `${ENTREPRISE_EN}, hereinafter “the Employer”,`
        : `${ENTREPRISE_FR}, ci-après « l'Employeur » ;`,
      et: en ? "and:" : "et :",
      partieEmploye: en ? "The Employee" : "L'Employé",
      champs,
      introArticles: en
        ? "It has been agreed as follows:"
        : "Il a été convenu ce qui suit :",
      articles: en ? articlesTravailEn(d) : articlesTravailFr(d),
      cloture: en
        ? `Done in two original copies in Bujumbura, on ${formaterDateContrat(d.date, "en")}.`
        : `Fait en deux exemplaires originaux à Bujumbura, le ${formaterDateContrat(d.date, "fr")}.`,
      signatures: en ? "Signatures" : "Signatures",
      pourEntreprise: en
        ? "For the Employer — Ciza Misigaro, President and Chief Executive Officer, Ciza Group"
        : "Pour l'Employeur — Ciza Misigaro, Président Directeur, Ciza Group",
      pourEmploye: en ? "The Employee" : "L'Employé",
      signatureMentionEntreprise: en
        ? "(electronic signature and official CIZA GROUP SURL stamp applied by the platform)"
        : "(signature électronique et cachet officiel CIZA GROUP SURL apposés par la plateforme)",
      signatureMentionEmploye: en
        ? "Handwritten words “Read and approved”, name, date and signature — the signed document is uploaded back into the platform from “My employee file”."
        : "Mention manuscrite « Lu et approuvé », nom, date et signature — le document signé est redéposé dans la plateforme depuis « Mon dossier employé ».",
      pied: en
        ? "Document generated and issued by CizaImmo — a division of Ciza Group."
        : "Document généré et émis par CizaImmo — division de Ciza Group.",
      contacts: "infos@cizagroup.com · WhatsApp +1 514 502 9503",
    };
  }
  return {
    titre: en
      ? "Services agreement — CizaImmo Platform Contractor"
      : "Contrat de prestation de services — Collaborateur plateforme CizaImmo",
    division: en
      ? "CizaImmo — a division of Ciza Group"
      : "CizaImmo — division de Ciza Group",
    entre: en ? "Between the undersigned:" : "Entre les soussignés :",
    partieEntreprise: en
      ? `${ENTREPRISE_EN}, hereinafter “the Client”,`
      : `${ENTREPRISE_FR}, ci-après « le Client » ;`,
    et: en ? "and:" : "et :",
    partieEmploye: en ? "The Contractor" : "Le Prestataire",
    champs,
    introArticles: en
      ? "It has been agreed as follows:"
      : "Il a été convenu ce qui suit :",
    articles: en ? articlesPrestationEn(d) : articlesPrestationFr(d),
    cloture: en
      ? `Done in two original copies, on ${formaterDateContrat(d.date, "en")}.`
      : `Fait en deux exemplaires originaux, le ${formaterDateContrat(d.date, "fr")}.`,
    signatures: en ? "Signatures" : "Signatures",
    pourEntreprise: en
      ? "For the Client — Ciza Misigaro, President and Chief Executive Officer, Ciza Group"
      : "Pour le Client — Ciza Misigaro, Président Directeur, Ciza Group",
    pourEmploye: en ? "The Contractor" : "Le Prestataire",
    signatureMentionEntreprise: en
      ? "(electronic signature and official CIZA GROUP SURL stamp applied by the platform)"
      : "(signature électronique et cachet officiel CIZA GROUP SURL apposés par la plateforme)",
    signatureMentionEmploye: en
      ? "Handwritten words “Read and approved”, name, date and signature — the signed document is uploaded back into the platform from “My employee file”."
      : "Mention manuscrite « Lu et approuvé », nom, date et signature — le document signé est redéposé dans la plateforme depuis « Mon dossier employé ».",
    pied: en
      ? "Document generated and issued by CizaImmo — a division of Ciza Group."
      : "Document généré et émis par CizaImmo — division de Ciza Group.",
    contacts: "infos@cizagroup.com · WhatsApp +1 514 502 9503",
  };
}

// ============================================================================
// RENDU PDF — même patron que lib/contrat.ts : en-tête marine/or,
// parties, articles multi-paragraphes, bloc entreprise pré-signé +
// cachet, bloc employé vierge « Lu et approuvé ».
// ============================================================================

const NAVY: [number, number, number] = [27, 42, 74];
const GOLD: [number, number, number] = [212, 175, 55];
const GRIS: [number, number, number] = [100, 116, 139];
const NOIR: [number, number, number] = [30, 41, 59];

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

/**
 * Génère le PDF du contrat d'engagement (voie selon les paramètres)
 * et le retourne en base64 — pièce jointe d'e-mail ou téléchargement.
 */
export async function genererContratEmployePdf(
  donnees: DonneesContratEmploye
): Promise<{ nomFichier: string; contenuBase64: string }> {
  const t = textesContratEmploye(donnees);
  const nomFichier = nomFichierContratEmploye(donnees.displayId);
  const { jsPDF } = await import("jspdf");
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
  const dossierLigne = donnees.displayId
    ? `Display ID : ${donnees.displayId}`
    : "";
  if (dossierLigne) {
    doc.text(dossierLigne, largeur - marge - doc.getTextWidth(dossierLigne), 13);
  }

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
    if (y > 272) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    doc.text(`${libelle} :`, marge + 4, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...NOIR);
    const lignes = doc.splitTextToSize(valeur || "", largeurTexte - 62);
    doc.text(lignes, marge + 58, y);
    y += Math.max(1, lignes.length) * 5.4 + 0.6;
  };

  // Parties.
  paragraphe(t.entre, true, 11);
  paragraphe(t.partieEntreprise);
  paragraphe(t.et, true, 11);
  paragraphe(t.partieEmploye, true, 11);
  for (const c of t.champs) champ(c.libelle, c.valeur);
  y += 3;

  // Articles.
  paragraphe(t.introArticles, true, 11);
  for (const article of t.articles) {
    paragraphe(article.titre, true, 11.5);
    for (const p of article.paragraphes) paragraphe(p);
  }

  // Clôture.
  y += 2;
  paragraphe(t.cloture);

  // Signatures : entreprise pré-signée + cachet (patron contrats
  // clients), bloc employé vierge pour la signature manuscrite.
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
  const pourEntLignes = doc.splitTextToSize(t.pourEntreprise, 118);
  doc.text(pourEntLignes, marge, yEntreprise);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRIS);
  doc.setFontSize(9.5);
  const mentionEntLignes = doc.splitTextToSize(
    t.signatureMentionEntreprise,
    118
  );
  doc.text(mentionEntLignes, marge, yEntreprise + 7);
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
  // Bloc employé (vierge).
  const yEmploye = yLigneEntreprise + 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...NAVY);
  doc.text(`${t.pourEmploye} : ${donnees.nom}`, marge, yEmploye);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GRIS);
  doc.setFontSize(9.5);
  const mentionEmpLignes = doc.splitTextToSize(
    t.signatureMentionEmploye,
    largeurTexte
  );
  doc.text(mentionEmpLignes, marge, yEmploye + 7);
  doc.setDrawColor(...GOLD);
  doc.line(marge, yEmploye + 30, marge + 80, yEmploye + 30);
  y = yEmploye + 36;

  // Pied de page sur la dernière page.
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRIS);
  doc.text(t.pied, largeur / 2, 290, { align: "center" });
  doc.setFontSize(8);
  doc.text(t.contacts, largeur / 2, 295, { align: "center" });

  const dataUri = doc.output("datauristring");
  const contenuBase64 = dataUri.split("base64,")[1] ?? "";
  return { nomFichier, contenuBase64 };
}

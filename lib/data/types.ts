/**
 * CizaImmo — types de la couche données (Module 1).
 * Noms de tables et de champs en snake_case, alignés sur supabase/schema.sql.
 * Le module 1 ne couvre que l'authentification et le profil ; les types des
 * autres entités sont posés ici pour que les modules suivants réutilisent
 * exactement les mêmes formes.
 */

export type Langue = "fr" | "en";
export type Role =
  | "proprietaire"
  | "gestionnaire"
  | "coproprietaire"
  // Extension v1.2 — Console plateforme (Ciza Group) : voir
  // docs/admin-finance-v1.2.md. admin = employé Ciza Group ;
  // super_admin = fondateur, compte unique.
  | "admin"
  | "super_admin";
export type Devise =
  | "USD" | "EUR" | "GBP" | "CAD" | "BIF"
  | "XAF" | "XOF" | "KES" | "TZS" | "RWF" | "UGX" | "BRL";

export const DEVISES: Devise[] = [
  "USD", "EUR", "GBP", "CAD", "BIF", "XAF", "XOF", "KES", "TZS", "RWF", "UGX", "BRL",
];

export interface Profil {
  id: string;
  nom: string;
  email: string;
  pays: string | null;
  langue: Langue;
  devise_principale: Devise;
  role: Role;
  /** Téléphone / WhatsApp du propriétaire (alertes WhatsApp, vitrine). */
  telephone: string | null;
  /** Extension v1.2 : compte suspendu par la plateforme (accès bloqué, données conservées). */
  suspendu: boolean;
  // --- Anti-fraude tarifaire (v1.2) : signaux d'attribution de la grille.
  /** Pays déclaré au formulaire d'inscription (nom, tel que saisi). */
  pays_declare?: string | null;
  /** Code pays de l'IP à l'inscription (x-vercel-ip-country) — jamais l'IP brute. */
  pays_ip?: string | null;
  /** Code pays du premier moyen de paiement (préfixe mobile money / carte). */
  pays_paiement?: string | null;
  /** Grille attribuée à l'inscription (miroir de abonnements.grille, verrouillée). */
  grille_attribuee?: Grille | null;
  /** « ok » ou « a_verifier » (contradiction de signaux → console). */
  grille_statut?: "ok" | "a_verifier" | null;
  /** Ajout n°3 : motif prédéfini si l'inscription a été REFUSÉE (sinon null). */
  motif_refus?: MotifRefus | null;
  // --- Parcours d'inscription v1.3 : dossier vérifié (voir
  // docs/parcours-inscription-v1.3.md).
  /**
   * Numéro de dossier PUBLIC et unique, généré par le système au format
   * « CIM-000001 » (séquentiel). Jamais modifiable : c'est la clé du
   * dossier, du contrat gestionnaire et du rattachement par le
   * propriétaire. null pour les comptes antérieurs non migrés.
   */
  display_id?: string | null;
  /**
   * INTENTION déclarée à l'inscription (« Je suis propriétaire » / « Je
   * suis gestionnaire immobilier »). Ce n'est PAS un rôle : le rôle
   * technique ne change pas à l'inscription ; l'intention est validée
   * par un Admin à l'approbation.
   */
  type_intention?: TypeIntention;
  /** Chemin Storage (bucket privé) de la photo de profil du dossier. */
  photo_profil_path?: string | null;
  /**
   * État du contrat de collaboration — comptes à intention
   * « gestionnaire » uniquement : sans_objet (propriétaires et
   * gestionnaires pas encore approuvés), a_signer (approuvé, contrat
   * envoyé), signe_recu (contrat signé téléversé, en attente de
   * validation Admin), valide (fonctions gestionnaire débloquées).
   */
  statut_contrat?: StatutContrat;
  /**
   * Option C (2026-11-08) : état du contrat de service PROPRIÉTAIRE
   * (comptes à intention « proprietaire » uniquement) — voir
   * StatutContratProprietaire. Non bloquant.
   */
  statut_contrat_proprietaire?: StatutContratProprietaire;
  /** Motif du refus du contrat propriétaire signé (si statut « refuse »). */
  motif_contrat_proprietaire?: string | null;
  // --- Extension v1.5 : suppression de compte, assignation, accès admin.
  /** Demande de suppression par le client (base) : date de la demande, null sinon. Échéance = demande + 30 jours. */
  suppression_demandee_le?: string | null;
  /** Admin (employé Ciza Group) responsable du dossier — assigné par le Super Admin. */
  admin_responsable_id?: string | null;
  /** Accès console de l'employé Admin : false = accès coupé par le Super Admin (est_admin_plateforme() exige true). */
  acces_admin_actif?: boolean;
  /** Rôle client d'origine, conservé à la promotion Admin pour un retrait fidèle. */
  role_avant_admin?: Role | null;
  created_at: string;
}

/** Intention déclarée à l'inscription (v1.3) — validée par l'Admin. */
export type TypeIntention = "proprietaire" | "gestionnaire";

/** Cycle de vie du contrat gestionnaire (v1.3). */
export type StatutContrat = "sans_objet" | "a_signer" | "signe_recu" | "valide";

/**
 * Cycle de vie du contrat PROPRIÉTAIRE (option C, 2026-11-08) —
 * NON BLOQUANT : aucun de ces états ne conditionne l'accès ni
 * l'essai. sans_objet (pas encore approuvé, ou compte gestionnaire),
 * a_signer (approuvé, contrat joint à l'e-mail de bienvenue — ou
 * rattrapage pour les comptes déjà approuvés), signe_depose (contrat
 * signé redéposé, en attente de revue Admin), valide (validé par un
 * Admin), refuse (refusé par un Admin, motif conservé — le
 * propriétaire peut redéposer une copie corrigée).
 */
export type StatutContratProprietaire =
  | "sans_objet"
  | "a_signer"
  | "signe_depose"
  | "valide"
  | "refuse";

export type Plan = "starter" | "pro" | "agence";
export type Grille = "afrique" | "internationale";
/** Grille de prix complète : prix mensuel USD par plan et par grille. */
export type PrixPlans = Record<Plan, Record<Grille, number>>;
export type StatutAbonnement =
  /** Extension v1.2 (ajout n°3) : inscrit, en attente d'approbation humaine — aucun essai démarré. */
  | "en_attente"
  | "essai"
  | "actif"
  | "lecture_seule"
  | "annule"
  /** Extension v1.2 : suspendu par la plateforme (reprise = statut_pre_suspension). */
  | "suspendu";

export interface Abonnement {
  id: string;
  owner_id: string;
  plan: Plan;
  grille: Grille;
  statut: StatutAbonnement;
  debut_periode: string;
  fin_periode: string | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  mobile_money_ref: string | null;
  created_at: string;
  // --- MODULE 5 : fins de période (spec §12) -------------------------------
  /** Descente de plan programmée, effective à date_effet_plan. */
  plan_en_attente: Plan | null;
  date_effet_plan: string | null;
  /** Résiliation demandée, effective en fin de période payée. */
  resiliation_programmee: boolean;
  /** Échec de paiement : grâce de 7 jours en fonctionnement normal. */
  echec_paiement: boolean;
  grace_ends_at: string | null;
  /** Données consultables/exportables jusqu'à cette date (90 jours). */
  lecture_seule_jusqu_au: string | null;
  /** Extension v1.2 : statut à restaurer à la réactivation après suspension. */
  statut_pre_suspension?: StatutAbonnement | null;
  /**
   * v1.4 : pack choisi PENDANT l'essai pour la fin de l'essai
   * (défaut « starter »). L'essai lui-même est toujours Starter ;
   * ce choix ne change rien tant que l'essai court.
   */
  plan_apres_essai: Plan;
  /**
   * v1.5 : instantané COMPLET de l'abonnement pris à la demande de
   * suppression par le client (miroir de la colonne jsonb
   * abonnements.instantane_avant_suppression) — restauré tel quel à
   * l'annulation. null quand aucune suppression n'est en cours.
   */
  instantane_avant_suppression?: Record<string, unknown> | null;
}

// --- MODULE 5 : factures d'abonnement + paiements mobile money (spec §12) ---
export type MoyenFactureAbo = "stripe" | "mobile_money" | "demo";
export type StatutFactureAbo = "payee" | "en_attente" | "annulee";

export interface FactureAbonnement {
  id: string;
  owner_id: string;
  numero: string; // CIM-ABO-AAAA-0001
  plan: Plan;
  grille: Grille;
  montant: number; // USD, prix mensuel du plan (§12)
  devise: "USD";
  date_emission: string;
  date_debut: string;
  date_fin: string;
  moyen: MoyenFactureAbo;
  statut: StatutFactureAbo;
  stripe_invoice_id: string | null;
  reference_mobile_money: string | null;
  /** v1.5 : true après anonymisation comptable (suppression de compte exécutée) — montants/dates/moyens conservés, références remplacées par « ANONYMISE ». */
  anonymise?: boolean;
}

export type OperateurMobileMoney = "ecocash" | "lumicash" | "enoti";
export const OPERATEURS_MOBILE_MONEY: OperateurMobileMoney[] = [
  "ecocash",
  "lumicash",
  "enoti",
];

export type StatutPaiementMobileMoney =
  | "en_attente"
  | "confirme"
  | "annule"
  | "expire";

/**
 * Demande de paiement mobile money (spec §12) : la demande est envoyée
 * sur le numéro du propriétaire, qui la confirme sur son téléphone ;
 * l'abonnement ne s'active qu'APRÈS confirmation. Non confirmée sous
 * 24 h : annulée (expirée), sans frais.
 */
export interface PaiementMobileMoney {
  id: string;
  owner_id: string;
  operateur: OperateurMobileMoney;
  telephone: string;
  montant: number; // USD, prix mensuel du plan demandé
  plan: Plan;
  reference: string; // MM-XXXXXXXX
  statut: StatutPaiementMobileMoney;
  cree_le: string;
  expire_le: string; // cree_le + 24 h
  confirme_le: string | null;
}

/** Blocs utilisés / autorisés par le plan en cours. */
export interface LimiteBlocs {
  utilises: number;
  autorises: number; // Infinity = illimité (Agence)
  plan: Plan;
  statut: StatutAbonnement;
}

export interface SessionUser {
  id: string;
  email: string;
  nom: string | null;
}

export interface SignUpInput {
  nom: string;
  email: string;
  motDePasse: string;
  pays: string;
  devisePrincipale: Devise;
  langue: Langue;
  /**
   * Anti-fraude tarifaire : code pays de l'IP détecté côté serveur
   * (route /api/inscription/contexte, en-tête x-vercel-ip-country).
   * Seul le code est transmis/stocké — jamais l'adresse IP.
   */
  paysIp?: string | null;
  /** v1.3 : téléphone (obligatoire) — pièce du dossier vérifié. */
  telephone: string;
  /** v1.3 : intention déclarée (propriétaire / gestionnaire) — pas un rôle. */
  intention: TypeIntention;
}

export type TypeImmeuble = "immeuble" | "bloc" | "maison";
export type StatutImmeuble = "actif" | "archive";
export type TypeAppartement =
  | "studio" | "T1" | "T2" | "T3" | "T4" | "T5+" | "autre";
export const TYPES_APPARTEMENT: TypeAppartement[] = [
  "studio", "T1", "T2", "T3", "T4", "T5+", "autre",
];
export type StatutAppartement = "occupe" | "vacant" | "travaux" | "reserve";
/** v1.6 : statut de modération d'une annonce vitrine (décidé dans la base). */
export type StatutVitrine = "non_publie" | "en_attente" | "approuve" | "refuse";
export type StatutBail = "actif" | "termine";
export type CautionStatut =
  | "en_attente" | "recue" | "restituee" | "retenue_partielle";

/** Limite de blocs par plan (spec §12). */
export const LIMITE_BLOCS: Record<Plan, number> = {
  starter: 1,
  pro: 5,
  agence: Number.POSITIVE_INFINITY,
};

export function limiteBlocs(plan: Plan, statut: StatutAbonnement): number {
  // Extension v1.2 : en attente d'approbation ou suspendu = aucun bloc.
  if (statut === "en_attente" || statut === "suspendu") return 0;
  // v1.4 : l'essai EST le pack Starter — le plan de l'abonnement vaut
  // « starter » pendant tout l'essai (forcé à l'approbation, dans la
  // base), donc plus aucune fonction Pro offerte pendant l'essai :
  // la limite suit simplement le plan en cours.
  return LIMITE_BLOCS[plan];
}

export interface ImmeubleInput {
  nom: string;
  adresse: string;
  ville: string;
  pays: string;
  devise: Devise;
  type: TypeImmeuble;
  etages: number | null;
  photo_url: string | null;
  notes: string | null;
  valeur_bien: number | null;
  devise_valeur: Devise | null;
  date_acquisition: string | null;
  prix_acquisition: number | null;
  /** Date de la dernière estimation de la valeur (passeport, spec §6 suite). */
  date_estimation: string | null;
  /** Mode d'acquisition si renseigné (achat, héritage, donation, autre). */
  mode_acquisition: string | null;
  /** v1.6 : quartier (affiché sur les annonces publiques vérifiées). */
  quartier?: string | null;
  /**
   * v1.7 : propriétaire DÉCLARÉ par un créateur GESTIONNAIRE (nom +
   * e-mail obligatoires dans ce cas — le fournisseur refuse la
   * création sans eux). Ignorés pour un créateur propriétaire.
   */
  proprietaire_declare_nom?: string | null;
  proprietaire_declare_email?: string | null;
}

export type ImmeublePatch = Partial<ImmeubleInput> & {
  statut?: StatutImmeuble;
};

export interface AppartementInput {
  immeuble_id: string;
  numero: string;
  type: TypeAppartement;
  surface_m2: number | null;
  loyer_defaut: number;
  devise: Devise;
  charges: number;
  etage: number | null;
  description: string | null;
  photos: string[];
  statut: StatutAppartement;
  vitrine: boolean;
  valeur_bien: number | null;
  devise_valeur: Devise | null;
  // --- v1.6 « Vitrine vérifiée » : champs d'annonce publique (optionnels
  // à la saisie ; le statut de modération n'est JAMAIS saisi ici — il est
  // géré par les fonctions demander/valider/retirer la publication).
  pieces?: number | null;
  meuble?: boolean;
  disponible_le?: string | null;
  visite_jours?: string[];
  visite_heures?: string | null;
  contact_nom?: string | null;
  contact_telephone?: string | null;
  contact_email?: string | null;
  contact_justification?: string | null;
}

export type AppartementPatch = Partial<
  Omit<AppartementInput, "immeuble_id">
>;

export interface LocataireInput {
  nom: string;
  telephone: string;
  email: string | null;
  piece_type: string | null;
  piece_numero: string | null;
  adresse_precedente: string | null;
  contact_urgence: string | null;
  notes: string | null;
}

export type LocatairePatch = Partial<LocataireInput>;

export interface BailInput {
  appartement_id: string;
  locataire_id: string;
  debut: string;
  fin: string | null;
  loyer_mensuel: number;
  devise: Devise;
  caution: number | null;
  devise_caution: Devise | null;
  caution_recue_le: string | null;
  caution_statut: CautionStatut;
  jour_exigibilite: number;
  charges_incluses: boolean;
  doc_url: string | null;
}

/** Lien lecture seule d'un locataire (spec §14 : jeton unique, révocable, 30 jours). */
export interface LienLocataire {
  token: string;
  expireLe: string;
  url: string;
}

/**
 * Accès lecture seule d'un locataire par son lien sécurisé (spec §2, §14).
 * Contient UNIQUEMENT les données de ce locataire : son bail en cours,
 * ses échéances (statuts recalculés), ses paiements et ses reçus.
 * Aucun autre locataire, aucun autre bien, aucun montant global.
 */
export interface AccesLocataire {
  locataire: Locataire;
  /** Bail en cours (actif) ; null si aucun bail actif. */
  bail: Bail | null;
  /** Numéro de l'appartement du bail en cours ; null si aucun bail. */
  appartementNumero: string | null;
  /** Nom de l'immeuble du bail en cours ; null si aucun bail. */
  immeubleNom: string | null;
  /** Nom de l'émetteur des reçus (propriétaire du compte). */
  emetteurNom: string;
  /** Échéances du bail en cours, du plus récent au plus ancien. */
  echeances: EcheanceLoyer[];
  /** Paiements des échéances ci-dessus (sert au restant dû des reçus). */
  paiements: Paiement[];
  /** Reçus du locataire (valides et annulés), du plus récent au plus ancien. */
  recus: Recu[];
}

export interface FiltreDepenses {
  immeubleId?: string;
  appartementId?: string;
}

export interface FiltreBaux {
  appartementId?: string;
  locataireId?: string;
  statut?: StatutBail;
}

export interface FiltreAppartements {
  immeubleId?: string;
  statut?: StatutAppartement;
}

/**
 * v1.7 : statut de revue plateforme d'un immeuble créé par un
 * gestionnaire (autorisation de gestion à valider). Les immeubles
 * créés par leur propriétaire sont « valide » d'office.
 */
/** v1.7 : qui a créé l'immeuble — décide du justificatif exigé. */
export type OrigineCreationImmeuble = "proprietaire" | "gestionnaire";
export type StatutValidationImmeuble = "valide" | "en_attente" | "refuse";

/** v1.7 : photo du bien à téléverser (contenu = data URL, comme les documents). */
export interface PhotoImmeubleInput {
  nom_fichier: string;
  /** Contenu du fichier (base64 data URL). */
  contenu: string;
  taille_octets?: number | null;
  mime_type?: string | null;
}

/** Entités dont le CRUD arrive au Module 2 (formes minimales, à compléter). */
export interface Immeuble {
  id: string;
  owner_id: string;
  nom: string;
  adresse: string;
  ville: string;
  pays: string;
  devise: Devise;
  type: "immeuble" | "bloc" | "maison";
  etages: number | null;
  photo_url: string | null;
  notes: string | null;
  valeur_bien: number | null;
  devise_valeur: Devise | null;
  date_acquisition: string | null;
  prix_acquisition: number | null;
  /** Date de la dernière estimation de la valeur (passeport, spec §6 suite). */
  date_estimation: string | null;
  /** Mode d'acquisition si renseigné (achat, héritage, donation, autre). */
  mode_acquisition: string | null;
  /** v1.6 : quartier (annonces publiques vérifiées). */
  quartier: string | null;
  statut: "actif" | "archive";
  created_at: string;
  // --- v1.7 « Passeport photo + autorisation de gestion » ----------------
  /**
   * Photos du bien téléversées (bucket privé « documents-prives ») :
   * chemins Storage en réel ; en démo, les data URLs elles-mêmes.
   * La PREMIÈRE est la photo principale = photo du passeport du bien.
   */
  photos: string[];
  /**
   * URLs d'affichage des photos : liens signés (1 h) résolus par le
   * fournisseur réel ; en démo, identiques à `photos`.
   */
  photos_urls: string[];
  /** Qui a créé l'immeuble : son propriétaire, ou un gestionnaire. */
  origine_creation: OrigineCreationImmeuble;
  /** Propriétaire déclaré par le gestionnaire créateur (sinon null). */
  proprietaire_declare_nom: string | null;
  proprietaire_declare_email: string | null;
  /**
   * Contrôle allégé : true si le propriétaire déclaré correspond à un
   * propriétaire déjà rattaché au gestionnaire et validé (e-mail du
   * rattachement actif) — la concordance est alors automatique.
   */
  proprietaire_concordance: boolean;
  /** Revue plateforme (immeubles créés par un gestionnaire). */
  validation_statut: StatutValidationImmeuble;
  /** Motif du refus de validation (montré au gestionnaire). */
  validation_motif: string | null;
}

export interface Appartement {
  id: string;
  immeuble_id: string;
  numero: string;
  type: string;
  surface_m2: number | null;
  loyer_defaut: number;
  devise: Devise;
  charges: number;
  etage: number | null;
  description: string | null;
  photos: string[];
  statut: "occupe" | "vacant" | "travaux" | "reserve";
  vitrine: boolean;
  valeur_bien: number | null;
  devise_valeur: Devise | null;
  /** Archivé après la fin du bail (un appartement occupé ne se supprime pas). */
  archive: boolean;
  created_at: string;
  // --- v1.6 « Vitrine vérifiée » : modération des annonces publiques.
  // Aucune annonce ne s'affiche sans approbation Admin (statut
  // 'approuve', décidé dans la base) ; toute annonce affichée porte
  // le badge « ✓ Vérifié ».
  vitrine_statut: StatutVitrine;
  vitrine_motif_refus: string | null;
  vitrine_valide_par: string | null;
  vitrine_valide_le: string | null;
  /** Nombre de pièces (affichage public). */
  pieces: number | null;
  meuble: boolean;
  /** Date de disponibilité (null = immédiate). */
  disponible_le: string | null;
  /** Jours de visite possibles ('lun'…'dim'). */
  visite_jours: string[];
  visite_heures: string | null;
  /** Contact AFFICHÉ de l'annonce (repli : contact du dossier). */
  contact_nom: string | null;
  contact_telephone: string | null;
  contact_email: string | null;
  /** Obligatoire si le contact annoncé diffère du contact du dossier. */
  contact_justification: string | null;
}

export interface Locataire {
  id: string;
  owner_id: string;
  nom: string;
  telephone: string;
  email: string | null;
  piece_type: string | null;
  piece_numero: string | null;
  adresse_precedente: string | null;
  contact_urgence: string | null;
  notes: string | null;
  lien_token: string | null;
  lien_expire_le: string | null;
  created_at: string;
}

export interface Bail {
  id: string;
  appartement_id: string;
  locataire_id: string;
  debut: string;
  fin: string | null;
  loyer_mensuel: number;
  devise: Devise;
  caution: number | null;
  devise_caution: Devise | null;
  caution_recue_le: string | null;
  caution_statut: CautionStatut;
  jour_exigibilite: number;
  charges_incluses: boolean;
  statut: "actif" | "termine";
  doc_url: string | null;
  created_at: string;
}

export type StatutLoyer = "a_venir" | "du" | "partiel" | "paye" | "en_retard";

export interface EcheanceLoyer {
  id: string;
  bail_id: string;
  mois: string; // 1er du mois (ISO)
  montant_du: number;
  devise: Devise;
  statut: StatutLoyer;
  prorata: boolean;
  prorata_detail: string | null;
  created_at: string;
}

export interface Paiement {
  id: string;
  echeance_id: string;
  montant: number;
  devise: Devise;
  date_paiement: string;
  moyen: "especes" | "virement" | "mobile_money" | "cheque" | "autre";
  reference: string | null;
  declare_par: string | null;
  recu_numero: string | null;
  statut: "valide" | "annule";
  created_at: string;
  /**
   * Conversion explicite quand la devise du paiement diffère de celle du
   * bail (spec §8) : taux DATÉ, jamais présenté comme taux du jour.
   * montant_converti = équivalent dans la devise de l'échéance.
   */
  taux_conversion?: number | null;
  date_taux?: string | null;
  montant_converti?: number | null;
  /** Trace d'annulation / correction (spec §14 : auteur, date, ancienne valeur). */
  annule_par?: string | null;
  annule_le?: string | null;
  motif_annulation?: string | null;
  /** Id du paiement annulé que celui-ci remplace (correction). */
  remplace_paiement_id?: string | null;
}

/** Saisie d'une déclaration de paiement (formulaire §8). */
export interface DeclarerPaiementInput {
  echeance_id: string;
  montant: number;
  devise: Devise;
  date_paiement: string;
  moyen: "especes" | "virement" | "mobile_money" | "cheque" | "autre";
  reference?: string | null;
  /** Conversion explicite (devise différente de celle du bail). */
  taux_conversion?: number | null;
  date_taux?: string | null;
  montant_converti?: number | null;
}

export interface FiltreEcheances {
  bailId?: string;
  /** 1er du mois, ex. « 2026-11-01 ». */
  mois?: string;
  immeubleId?: string;
  statut?: StatutLoyer;
}

export interface FiltreRecus {
  recherche?: string;
  statut?: "valide" | "annule";
  mois?: string;
}

/** Un reçu = un paiement déclaré (1 paiement → 1 reçu, spec §13), enrichi pour l'affichage. */
export interface Recu {
  numero: string;
  paiement_id: string;
  echeance_id: string;
  bail_id: string;
  locataire_id: string | null;
  locataire_nom: string;
  locataire_telephone: string | null;
  locataire_email: string | null;
  immeuble_nom: string;
  appartement_numero: string;
  mois: string;
  montant: number;
  devise: Devise;
  moyen: Paiement["moyen"];
  date_paiement: string;
  date_emission: string;
  reference: string | null;
  statut: "valide" | "annule";
}

export interface Depense {
  id: string;
  owner_id: string;
  immeuble_id: string;
  appartement_id: string | null;
  date: string;
  categorie: "entretien" | "reparation" | "taxe" | "assurance" | "salaire" | "autre";
  libelle: string;
  montant: number;
  devise: Devise;
  fournisseur: string | null;
  justificatif_url: string | null;
  created_at: string;
}

export type CategorieDepense = Depense["categorie"];
export const CATEGORIES_DEPENSES: CategorieDepense[] = [
  "entretien", "reparation", "taxe", "assurance", "salaire", "autre",
];

export interface DepenseInput {
  immeuble_id: string;
  appartement_id: string | null;
  date: string;
  categorie: CategorieDepense;
  libelle: string;
  montant: number;
  devise: Devise;
  fournisseur: string | null;
  justificatif_url?: string | null;
}
export type DepensePatch = Partial<DepenseInput>;

// --- MODULE 4 : documents ---------------------------------------------------
export type TypeDocument =
  | "bail"
  | "piece_identite"
  | "justificatif"
  | "facture"
  /** v1.3 : contrat de collaboration gestionnaire (à signer ou signé). */
  | "contrat"
  /** v1.7 : autorisation de gestion signée par le propriétaire,
   * déposée par un gestionnaire créateur d'immeuble (à la place du
   * titre de propriété) — revue plateforme. */
  | "autorisation"
  | "autre";
export const TYPES_DOCUMENT: TypeDocument[] = [
  "bail",
  "piece_identite",
  "justificatif",
  "facture",
  "contrat",
  "autorisation",
  "autre",
];
/** v1.3 : « compte » = document du DOSSIER d'inscription (pièce d'identité, contrat). */
export type EntiteType = "immeuble" | "appartement" | "locataire" | "bail" | "depense" | "compte";
export const TAILLE_MAX_DOCUMENT_OCTETS = 10 * 1024 * 1024; // 10 Mo (spec §6)
export const FORMATS_DOCUMENT_ACCEPTES = ["application/pdf", "image/jpeg", "image/png"];

export interface Document {
  id: string;
  owner_id: string;
  type: TypeDocument;
  entite_type: EntiteType;
  entite_id: string;
  nom_fichier: string;
  storage_path: string;
  taille_octets: number | null;
  mime_type: string | null;
  ajoute_par: string | null;
  created_at: string;
  /** Mode démo uniquement : contenu conservé quand il tient en localStorage. */
  contenu?: string | null;
  /** Mode démo : vrai quand le fichier était trop gros pour être conservé. */
  contenu_non_conserve?: boolean;
}

export interface DocumentInput {
  type: TypeDocument;
  entite_type: EntiteType;
  entite_id: string;
  nom_fichier: string;
  /** Contenu du fichier (base64 data URL en démo ; File côté page en réel). */
  contenu?: string | null;
  taille_octets?: number | null;
  mime_type?: string | null;
}

export interface FiltreDocuments {
  type?: TypeDocument;
  entite_type?: EntiteType;
  entite_id?: string;
  recherche?: string;
}

// --- MODULE 4 : fil d'actualité (activites, lecture seule) ------------------
export type TypeActivite = "paiement" | "depense" | "bail" | "alerte" | "document" | "coproprietaire" | "immeuble" | "appartement" | "locataire";
export interface Activite {
  id: string;
  owner_id: string;
  type: TypeActivite;
  entite_type: string | null;
  entite_id: string | null;
  auteur: string | null;
  description: string;
  created_at: string;
}

// --- MODULE 4 : alertes ------------------------------------------------------
export type TypeAlerte = "loyer_en_retard" | "fin_de_bail" | "vacance_prolongee" | "bail_demarrant" | "essai_abonnement" | "autre";
export type UrgenceAlerte = "haute" | "moyenne" | "basse";
/** Statut d'envoi WhatsApp d'une alerte (spec §10) : jamais de faux envoi. */
export type StatutWhatsApp = "non_configuré" | "envoye" | "echec" | "desactive";
export interface Alerte {
  id: string;
  owner_id: string;
  type: TypeAlerte;
  entite_type: string | null;
  entite_id: string | null;
  message: string;
  statut: "active" | "traitee";
  canal: "app" | "email" | "whatsapp";
  /** Clé d'idempotence : même événement = une seule alerte. */
  dedup_key: string | null;
  urgence: UrgenceAlerte;
  /** Statut e-mail : jamais de faux envoi (spec §10). */
  email_statut: "non_configuré" | "envoye" | "echec" | "desactive";
  /** Statut WhatsApp : jamais de faux envoi (spec §10, module 6). */
  whatsapp_statut: StatutWhatsApp;
  traitee_le: string | null;
  created_at: string;
}

// --- MODULE 4 : taux de change ----------------------------------------------
export interface TauxChange {
  id: string;
  devise_source: Devise;
  devise_cible: Devise;
  taux: number;
  date_taux: string;
  source: "auto" | "manuel";
  created_at: string;
}
export interface TauxResultat {
  taux: number;
  date_taux: string;
  source: "auto" | "manuel";
}
export interface TauxManuelInput {
  devise_source: Devise;
  devise_cible: Devise;
  taux: number;
  date_taux: string; // AAAA-MM-JJ
}

// --- MODULE 4 : gestionnaires invités + préférences --------------------------
export interface GestionnaireInvite {
  id: string;
  owner_id: string;
  email: string;
  nom: string | null;
  immeuble_ids: string[];
  statut: "invite" | "actif";
  created_at: string;
}

export interface PreferencesNotifications {
  owner_id: string;
  /** Types d'alerte coupés par l'utilisateur (essai_abonnement jamais coupable par le propriétaire). */
  types_coupes: TypeAlerte[];
  canal_app: boolean;
  canal_email: boolean;
  /** Canal WhatsApp (module 6, spec §10) : envois via l'API Meta. */
  canal_whatsapp: boolean;
  /** Seuil de vacance prolongée en jours (défaut 30, réglable — spec §10). */
  seuil_vacance_jours: number;
  updated_at: string;
}

export interface ProfilPatch {
  nom?: string;
  pays?: string | null;
  telephone?: string | null;
  langue?: Langue;
  devise_principale?: Devise;
}

// --- MODULE 6 : indivision familiale (spec §6 suite, §2, §13) --------------
export type StatutCoproprietaire = "invite" | "actif";

/**
 * Co-propriétaire d'un immeuble en indivision. La somme des parts d'un
 * immeuble fait toujours exactement 100 % (validée côté application).
 * RÈGLE DURE : CizaImmo calcule et affiche la répartition, mais
 * n'encaisse ni ne distribue AUCUN argent entre co-propriétaires.
 */
export interface Coproprietaire {
  id: string;
  immeuble_id: string;
  nom: string;
  email: string;
  telephone: string | null;
  /** Part en pourcentage (0–100). Somme des parts de l'immeuble = 100. */
  part: number;
  /** "invite" : invitation envoyée, compte non rattaché ; "actif" : accès lecture seule effectif. */
  statut: StatutCoproprietaire;
  created_at: string;
}

export interface CoproprietaireInput {
  nom: string;
  email: string;
  telephone: string | null;
  part: number;
}

// --- MODULE 6 : vitrine publique « à louer » (spec §4, §6) -----------------
/** Contact public du propriétaire / gestionnaire (jamais de locataire). */
export interface ContactPublic {
  nom: string;
  email: string | null;
  telephone: string | null;
}

/** Une annonce publique : appartement publié + immeuble + contact. Aucune donnée locataire. */
export interface AnnoncePublique {
  appartement: Appartement;
  immeuble_id: string;
  immeuble_nom: string;
  ville: string;
  pays: string;
  /** v1.6 : adresse + quartier de l'immeuble (affichage public). */
  adresse: string;
  quartier: string | null;
  /**
   * v1.6 : contact AFFICHÉ — celui de l'annonce s'il est renseigné,
   * sinon le contact du dossier (gestionnaire rattaché actif de
   * l'immeuble, sinon le propriétaire).
   */
  contact: ContactPublic;
}

/**
 * v1.6 : une annonce en attente de validation (file console). Le
 * contact annoncé est comparé au contact ATTENDU du dossier : le
 * gestionnaire rattaché actif de l'immeuble s'il existe, sinon le
 * propriétaire. `divergent` = téléphone ou e-mail annoncé différent
 * du dossier (la justification est alors obligatoire à la demande).
 */
export interface AnnonceAValider {
  appartement: Appartement;
  immeuble_id: string;
  immeuble_nom: string;
  immeuble_adresse: string;
  immeuble_quartier: string | null;
  immeuble_ville: string;
  proprietaire_id: string;
  proprietaire_nom: string;
  proprietaire_display_id: string | null;
  contact_annonce: ContactPublic;
  contact_dossier: ContactPublic;
  contact_dossier_role: "gestionnaire" | "proprietaire";
  justification: string | null;
  divergent: boolean;
}

// =============================================================================
// EXTENSION v1.2 — Console Admin / Super Admin + finances dynamiques.
// Voir docs/admin-finance-v1.2.md. Règles verrouillées :
// - super_admin (fondateur, unique) : tout, y compris créer/retirer les
//   Admins, supprimer définitivement un compte et régler les paramètres ;
// - admin (employé Ciza Group) : comptes clients, suspension, avis,
//   retards de paiement — jamais la création d'Admin, la suppression
//   définitive ni les paramètres ;
// - avis = modèles prédéfinis uniquement, journalisés ;
// - gestionnaire multi-rattaché : contextes strictement séparés ;
// - tarifs et paramètres finance vivent dans la BASE, jamais en dur.
// =============================================================================

/** Rattachement d'un gestionnaire : contexte Ciza Group OU un propriétaire. */
export type ContexteRattachement = "cizagroup" | "proprietaire";
export type StatutRattachement = "actif" | "suspendu";

export interface RattachementGestionnaire {
  id: string;
  /** Compte du gestionnaire (profils.id en réel ; e-mail en démo). */
  gestionnaire_id: string;
  gestionnaire_email: string;
  gestionnaire_nom: string | null;
  /** Téléphone du gestionnaire (affiché au dossier, v1.5.1). */
  gestionnaire_telephone: string | null;
  contexte: ContexteRattachement;
  /** Propriétaire servi (contexte « proprietaire ») ; null pour Ciza Group. */
  proprietaire_id: string | null;
  proprietaire_nom: string | null;
  /** E-mail et téléphone du propriétaire (affichés au dossier, v1.5.1). */
  proprietaire_email: string | null;
  proprietaire_telephone: string | null;
  /** Immeubles du contexte accessibles au gestionnaire. */
  immeuble_ids: string[];
  statut: StatutRattachement;
  created_at: string;
}

/** Entrée du journal d'audit plateforme (append-only). */
export type CibleAudit =
  | "compte"
  | "admin"
  | "tarif"
  | "parametre"
  | "gestionnaire"
  | "plateforme"
  | "appartement"
  /** v1.7 : décisions de revue des immeubles créés par un gestionnaire. */
  | "immeuble";

export interface EntreeAudit {
  id: string;
  acteur_id: string | null;
  acteur_email: string;
  /**
   * Audit enrichi (2026-11-07) : nom complet de l'acteur, figé à
   * l'écriture (snapshot du profil). Null pour les entrées anciennes
   * (antérieures à la colonne) — l'affichage retombe sur l'e-mail.
   */
  acteur_nom: string | null;
  acteur_role: "admin" | "super_admin";
  action: string;
  cible_type: CibleAudit;
  cible_id: string | null;
  cible_email: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

/** Avis plateforme : modèles prédéfinis UNIQUEMENT (pas de texte libre). */
export type ModeleAvis =
  | "retard_paiement"
  | "fin_essai"
  | "compte_suspendu"
  | "compte_reactive"
  /** Ajout n°3 : refus d'inscription, avec motif prédéfini. */
  | "inscription_refusee";

/** Motifs de refus d'inscription PRÉDÉFINIS (ajout n°3 — aucun texte libre). */
export type MotifRefus =
  | "informations_insuffisantes"
  | "pays_non_desservi"
  | "doublon"
  | "autre";

export interface VariablesAvis {
  nom: string;
  plan: string;
  date: string;
  /** Motif prédéfini (modèle inscription_refusee uniquement). */
  motif?: string | null;
}

export type StatutEnvoiAvis = "envoye" | "non_configuré" | "echec";

export interface Avis {
  id: string;
  modele: ModeleAvis;
  destinataire_id: string | null;
  destinataire_email: string;
  variables: VariablesAvis;
  sujet: string;
  corps: string;
  envoye_par: string | null;
  envoye_par_role: "admin" | "super_admin";
  statut_envoi: StatutEnvoiAvis;
  created_at: string;
}

/** Ligne de la table tarifs_plateforme (source dynamique des prix). */
export interface TarifPlateforme {
  id: string;
  grille: Grille;
  plan: Plan;
  prix_mensuel: number;
  devise: string;
  updated_at: string;
  updated_by: string | null;
}

/** Ligne unique de la table parametres_finance. */
export interface ParametresFinance {
  remise_annuelle_pct: number;
  jours_essai: number;
  jours_grace: number;
  penalites_retard_actives: boolean;
  /**
   * Anti-fraude tarifaire : codes ISO des pays éligibles à la grille
   * Afrique. Liste DYNAMIQUE, éditable par le Super Admin (console) —
   * jamais codée en dur dans la logique d'attribution (lib/grille.ts).
   */
  pays_grille_afrique: string[];
  /**
   * Approbation manuelle (ajout n°3) : délai affiché sur l'écran
   * « Compte en attente d'approbation » (texte libre, ex. « 24 h
   * ouvrées »). DYNAMIQUE, éditable par le Super Admin.
   */
  delai_approbation_affiche: string;
}

/** Vue console d'un compte client (profil + abonnement + retard calculé). */
export interface ComptePlateforme {
  id: string;
  email: string;
  nom: string;
  role: Role;
  pays: string | null;
  langue: Langue;
  suspendu: boolean;
  created_at: string;
  /** Anti-fraude tarifaire : signaux du compte (console « à vérifier »). */
  pays_declare: string | null;
  pays_ip: string | null;
  pays_paiement: string | null;
  grille_statut: "ok" | "a_verifier";
  /** Ajout n°3 : motif prédéfini si l'inscription a été refusée. */
  motif_refus: MotifRefus | null;
  abonnement: {
    plan: Plan;
    grille: Grille;
    statut: StatutAbonnement;
    debut_periode: string;
    fin_periode: string | null;
    trial_ends_at: string | null;
    echec_paiement: boolean;
    grace_ends_at: string | null;
    statut_pre_suspension?: StatutAbonnement | null;
    /** v1.4 : pack choisi pour la fin de l'essai (défaut Starter). */
    plan_apres_essai?: Plan;
  } | null;
  /** Retard de paiement d'abonnement (échec ou grâce des paramètres dépassée). */
  en_retard: boolean;
  // --- v1.3 : dossier vérifié.
  /** Numéro de dossier public « CIM-000001 » (null si non migré). */
  display_id: string | null;
  telephone: string | null;
  type_intention: TypeIntention;
  statut_contrat: StatutContrat;
  /** Option C : contrat propriétaire (non bloquant) + motif de refus. */
  statut_contrat_proprietaire: StatutContratProprietaire;
  motif_contrat_proprietaire: string | null;
  /** Dossier complet = photo de profil + pièce d'identité reçues. */
  dossier_complet: boolean;
  // --- v1.5 : assignation + suppression.
  /** Admin responsable du dossier (assignation Super Admin), null si non assigné. */
  admin_responsable_id: string | null;
  admin_responsable_nom: string | null;
  /** Demande de suppression par le client en cours (date), null sinon. */
  suppression_demandee_le: string | null;
}

/**
 * Demande de rattachement par Display ID (v1.3) — TRIPLE validation :
 * le propriétaire demande → le gestionnaire accepte → un Admin valide
 * systématiquement → seulement ensuite le propriétaire assigne ses
 * immeubles (mécanisme existant des rattachements, immeuble_ids).
 */
export type StatutDemandeRattachement =
  | "en_attente_gestionnaire"
  | "en_attente_admin"
  | "actif"
  | "refuse";

export interface DemandeRattachement {
  id: string;
  proprietaire_id: string;
  proprietaire_email: string;
  proprietaire_nom: string;
  gestionnaire_id: string;
  gestionnaire_email: string;
  gestionnaire_nom: string;
  /** Display ID saisi par le propriétaire (trace de la demande). */
  gestionnaire_display_id: string;
  statut: StatutDemandeRattachement;
  created_at: string;
  /** Réponse du gestionnaire (acceptation/refus). */
  repondu_le: string | null;
  /** Validation Admin (acteur plateforme + date). */
  valide_par: string | null;
  valide_le: string | null;
  /** Rattachement créé à la validation Admin (null avant). */
  rattachement_id: string | null;
  /**
   * Immeubles actuellement assignés sur le rattachement lié (rempli
   * par listerDemandesRattachement quand la demande est « actif ») —
   * sert l'écran d'assignation du propriétaire.
   */
  rattachement_immeuble_ids?: string[];
}

/**
 * Page DOSSIER console (v1.3) : tout ce que l'Admin voit d'un compte —
 * identité, documents du dossier, preuves de propriété, rattachements
 * des deux côtés, immeubles, annonces vitrine, abonnement, audit.
 */
/** Coches de la checklist de vérification d'un dossier (saisie). */
export interface ChecklistDossierSaisie {
  photo_verifiee: boolean;
  piece_coherente: boolean;
  infos_verifiees: boolean;
  antifraude_examinee: boolean;
}

/**
 * État courant de la checklist d'un dossier : dernière consignation
 * (Admin / Super Admin + horodatage). L'approbation exige l'état
 * complet — photo, pièce, infos toujours ; anti-fraude en plus si
 * le compte est signalé « a_verifier » (garde base, approuver_compte).
 */
export interface ChecklistDossier extends ChecklistDossierSaisie {
  acteur_nom: string | null;
  acteur_email: string | null;
  /** Horodatage ISO de la dernière consignation. */
  updated_at: string | null;
}

/**
 * v1.7 : un immeuble créé par un gestionnaire, vu dans son Dossier
 * console pour la revue plateforme : propriétaire déclaré, signal de
 * concordance (rattachement déjà validé), statut de revue et
 * autorisation de gestion déposée (document, si reçue).
 */
export interface RevueImmeubleGestion {
  id: string;
  nom: string;
  ville: string;
  adresse: string;
  /** Vignette : URL signée de la photo principale du bien (ou photo_url historique). */
  photo_url: string | null;
  proprietaire_declare_nom: string | null;
  proprietaire_declare_email: string | null;
  proprietaire_concordance: boolean;
  validation_statut: StatutValidationImmeuble;
  validation_motif: string | null;
  /** Autorisation de gestion déposée (document « autorisation »), si reçue. */
  autorisation: Document | null;
}

/** Résumé d'immeuble dans le Dossier console (vignette v1.7 incluse). */
export interface ImmeubleResumeDossier {
  id: string;
  nom: string;
  ville: string;
  adresse: string;
  /** Vignette : photo principale du bien (URL signée en réel), sinon null. */
  photo_url: string | null;
}

export interface DossierCompte {
  compte: ComptePlateforme;
  /** Checklist de vérification (dernière consignation), si présente. */
  checklist: ChecklistDossier | null;
  /** Chemin Storage de la photo de profil (bucket privé), si reçue. */
  photo_profil_path: string | null;
  /**
   * Lien signé temporaire (1 h) vers la photo de profil, pour
   * l'afficher dans le dossier (réel uniquement ; null en démo
   * et si la signature échoue — le dossier reste lisible).
   */
  photo_profil_url: string | null;
  /** Documents du dossier (entite_type « compte » : pièce d'identité, contrat). */
  documents_compte: Document[];
  /** Preuves de propriété : documents « justificatif » des immeubles possédés. */
  preuves_propriete: Document[];
  rattachements_comme_proprietaire: RattachementGestionnaire[];
  rattachements_comme_gestionnaire: RattachementGestionnaire[];
  demandes: DemandeRattachement[];
  immeubles_possedes: ImmeubleResumeDossier[];
  immeubles_geres: ImmeubleResumeDossier[];
  /** v1.7 : immeubles créés par CE gestionnaire — revue plateforme. */
  immeubles_en_revue: RevueImmeubleGestion[];
  /** Annonces vitrine : appartements publiés des immeubles possédés. */
  annonces: { id: string; immeuble_nom: string; numero: string }[];
  audit: EntreeAudit[];
}

/** Vue console d'un compte Admin / Super Admin. */
export interface CompteAdmin {
  id: string;
  email: string;
  nom: string;
  role: "admin" | "super_admin";
  statut: "actif" | "suspendu";
  created_at: string;
  /** v1.5 : accès console employé (false = coupé par le Super Admin). */
  acces_admin_actif?: boolean;
  /** v1.5 : nombre de dossiers clients assignés à cet Admin. */
  dossiers_assignes?: number;
}

// ============================================================================
// EXTENSION v1.5 — Suppression de compte par le client, messagerie directe
// supervisée, assignation des dossiers, page Équipe et espace « Mes
// dossiers ». Voir docs/messagerie-suppression-v15.md. Principe inchangé :
// la BASE décide (RPC + RLS), le frontend ne fait qu'afficher.
// ============================================================================

/**
 * Suppression de compte demandée par le client, en attente d'exécution
 * (file console Super Admin). L'échéance est demande + 30 jours ;
 * « executable » n'est qu'un affichage — le refus avant échéance vient
 * de la RPC base executer_suppression_compte.
 */
export interface SuppressionEnAttente {
  compte_id: string;
  email: string;
  nom: string;
  display_id: string | null;
  suppression_demandee_le: string;
  /** suppression_demandee_le + 30 jours. */
  echeance_le: string;
  executable: boolean;
}

/** Type de fil de discussion (messagerie directe v1.5). */
export type TypeConversation = "plateforme" | "rattachement";

/**
 * Fil de discussion. « plateforme » : client ↔ plateforme (routé vers
 * l'Admin responsable du dossier). « rattachement » : propriétaire ↔
 * gestionnaire d'un rattachement ACTIF ; la plateforme ne fait que
 * superviser, en lecture seule (interdit par la RLS, pas par le front).
 */
export interface Conversation {
  id: string;
  type: TypeConversation;
  /** Le client sujet du fil (plateforme) / le propriétaire (rattachement). */
  proprietaire_id: string;
  gestionnaire_id: string | null;
  rattachement_id: string | null;
  /** Routage plateforme : Admin responsable du client au moment de la création. */
  admin_responsable_id: string | null;
  created_at: string;
  // --- Champs d'affichage (jointures faites par le fournisseur) ---------
  proprietaire_nom?: string;
  proprietaire_email?: string;
  proprietaire_display_id?: string | null;
  gestionnaire_nom?: string | null;
  gestionnaire_display_id?: string | null;
  admin_responsable_nom?: string | null;
  dernier_message?: string | null;
  dernier_message_le?: string | null;
  /** Messages non lus POUR L'ACTEUR COURANT. */
  non_lus?: number;
}

/** Message d'un fil direct. Corps en texte libre (canal direct v1.5). */
export interface MessageDirect {
  id: string;
  conversation_id: string;
  expediteur_id: string;
  /** Nom de l'expéditeur (jointure d'affichage). */
  expediteur_nom?: string;
  corps: string;
  created_at: string;
  /** Lu par le côté client (propriétaire/gestionnaire) du fil. */
  lu_par_client: boolean;
  /** Lu par le côté plateforme (fils plateforme ; supervision). */
  lu_par_plateforme: boolean;
}

/** Ligne de la page Équipe (console Super Admin, v1.5). */
export interface MembreEquipe {
  id: string;
  email: string;
  nom: string;
  role: "admin" | "super_admin";
  /** Suspension de compte plateforme (profils.suspendu). */
  statut: "actif" | "suspendu";
  /** Accès console employé (profils.acces_admin_actif). */
  acces_admin_actif: boolean;
  /** Charge : nombre de dossiers clients dont il est responsable. */
  dossiers_assignes: number;
  /** Dernière entrée du journal d'audit signée par cet acteur. */
  derniere_activite: string | null;
  created_at: string;
}

/** Résumé de supervision d'un gestionnaire rattaché (lecture, journalisée). */
export interface SupervisionGestionnaire {
  rattachement: RattachementGestionnaire;
  immeubles: {
    id: string;
    nom: string;
    ville: string;
    devise_principale: Devise;
    nb_appartements: number;
    nb_locataires_actifs: number;
  }[];
}

/**
 * CizaImmo — types de la couche données (Module 1).
 * Noms de tables et de champs en snake_case, alignés sur supabase/schema.sql.
 * Le module 1 ne couvre que l'authentification et le profil ; les types des
 * autres entités sont posés ici pour que les modules suivants réutilisent
 * exactement les mêmes formes.
 */

export type Langue = "fr" | "en";
export type Role = "proprietaire" | "gestionnaire" | "coproprietaire";
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
  created_at: string;
}

export type Plan = "starter" | "pro" | "agence";
export type Grille = "afrique" | "internationale";
export type StatutAbonnement = "essai" | "actif" | "lecture_seule" | "annule";

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
}

export type TypeImmeuble = "immeuble" | "bloc" | "maison";
export type StatutImmeuble = "actif" | "archive";
export type TypeAppartement =
  | "studio" | "T1" | "T2" | "T3" | "T4" | "T5+" | "autre";
export const TYPES_APPARTEMENT: TypeAppartement[] = [
  "studio", "T1", "T2", "T3", "T4", "T5+", "autre",
];
export type StatutAppartement = "occupe" | "vacant" | "travaux" | "reserve";
export type StatutBail = "actif" | "termine";
export type CautionStatut =
  | "en_attente" | "recue" | "restituee" | "retenue_partielle";

/** Limite de blocs par plan (spec §12). L'essai = fonctions Pro (5 blocs). */
export const LIMITE_BLOCS: Record<Plan, number> = {
  starter: 1,
  pro: 5,
  agence: Number.POSITIVE_INFINITY,
};

export function limiteBlocs(plan: Plan, statut: StatutAbonnement): number {
  return statut === "essai" ? LIMITE_BLOCS.pro : LIMITE_BLOCS[plan];
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
  statut: "actif" | "archive";
  created_at: string;
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
export type TypeDocument = "bail" | "piece_identite" | "justificatif" | "facture" | "autre";
export const TYPES_DOCUMENT: TypeDocument[] = ["bail", "piece_identite", "justificatif", "facture", "autre"];
export type EntiteType = "immeuble" | "appartement" | "locataire" | "bail" | "depense";
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
  contact: ContactPublic;
}

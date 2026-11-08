import type {
  Abonnement,
  Activite,
  Alerte,
  Appartement,
  Avis,
  Bail,
  CompteAdmin,
  Conversation,
  Coproprietaire,
  DemandeRattachement,
  Depense,
  Document,
  EcheanceLoyer,
  ChecklistDossier,
  EntreeAudit,
  FactureAbonnement,
  GestionnaireInvite,
  Grille,
  Immeuble,
  Langue,
  Locataire,
  MessageDirect,
  MotifRefus,
  Paiement,
  PaiementMobileMoney,
  ParametresFinance,
  Plan,
  PreferencesNotifications,
  Profil,
  RattachementGestionnaire,
  Role,
  StatutAbonnement,
  StatutContrat,
  StatutContratProprietaire,
  TarifPlateforme,
  TauxChange,
  TypeIntention,
} from "./types";
import { PARAMETRES_FINANCE_DEFAUT, TARIFS_SEED } from "../tarifs";

/**
 * CizaImmo — données de DÉMONSTRATION (Module 1).
 *
 * DONNÉES FICTIVES, étiquetées DÉMO partout dans l'interface. Elles ne
 * doivent JAMAIS être présentées comme réelles. Le mode démo permet de
 * parcourir l'application avant la création du projet Supabase.
 *
 * Parc de démo : 1 propriétaire, 1 gestionnaire (rattaché au Bloc
 * Saint-Laurent, Montréal — il ne voit que ce bien, jamais l'abonnement
 * ni les autres immeubles), 3 immeubles (Bujumbura en BIF, Montréal
 * en CAD, 1 archivé), 7 appartements (dont 1 vacant depuis sept. 2026),
 * 5 locataires, 5 baux, échéances d'octobre et novembre 2026, paiements
 * déclarés et dépenses.
 *
 * Les montants sont fictifs mais réalistes et cohérents entre eux
 * (loyers = montants dus des échéances ; paiements ≤ montants dus).
 * Les échéances couvrent les 5 statuts (spec §9) : à venir, dû, partiel,
 * payé, en retard — dont un paiement annulé (reçu conservé, marqué ANNULÉ).
 */

/**
 * Collections d'UN parc immobilier (extension v1.2) : le parc du
 * propriétaire démo OU le parc interne Ciza Group. Les contextes d'un
 * gestionnaire multi-rattaché sont STRICTEMENT séparés : chaque
 * contexte lit/écrit dans son propre parc, jamais dans l'autre.
 */
export interface ParcDemo {
  profil: Profil;
  immeubles: Immeuble[];
  appartements: Appartement[];
  locataires: Locataire[];
  baux: Bail[];
  echeances: EcheanceLoyer[];
  paiements: Paiement[];
  depenses: Depense[];
  documents: Document[];
  activites: Activite[];
  alertes: Alerte[];
  coproprietaires: Coproprietaire[];
}

/** Compte client FICTIF du registre plateforme démo (vue console). */
export interface CompteClientDemo {
  id: string;
  email: string;
  nom: string;
  role: Role;
  pays: string | null;
  langue: Langue;
  created_at: string;
  /** Anti-fraude tarifaire : signaux simulés pour tester la matrice. */
  pays_declare: string | null;
  pays_ip: string | null;
  pays_paiement: string | null;
  grille_statut: "ok" | "a_verifier";
  /** Ajout n°3 : motif de refus prédéfini si le compte a été refusé. */
  motif_refus?: MotifRefus | null;
  // --- v1.3 : dossier vérifié (Display ID fixe, cohérent dans la démo).
  display_id: string;
  telephone: string | null;
  type_intention: TypeIntention;
  statut_contrat: StatutContrat;
  /** Option C : contrat propriétaire non bloquant (défaut « sans_objet »). */
  statut_contrat_proprietaire?: StatutContratProprietaire;
  motif_contrat_proprietaire?: string | null;
  /** Photo de profil reçue + pièce d'identité reçue. */
  dossier_complet: boolean;
  // --- v1.5 : suppression demandée, assignation, accès admin (miroir
  // des colonnes de profils — absents/null tant qu'ils ne s'appliquent pas).
  suppression_demandee_le?: string | null;
  admin_responsable_id?: string | null;
  acces_admin_actif?: boolean;
  role_avant_admin?: Role | null;
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
    /** v1.5 : instantané restauré à l'annulation d'une suppression. */
    instantane_avant_suppression?: Record<string, unknown> | null;
  };
}

/** Registre plateforme démo (extension v1.2) : admins, clients, audit, avis. */
export interface PlateformeDemo {
  comptesAdmins: CompteAdmin[];
  comptesClients: CompteClientDemo[];
  rattachements: RattachementGestionnaire[];
  journal: EntreeAudit[];
  avis: Avis[];
  /**
   * Checklists de vérification des dossiers (2026-11-07) : dernier
   * état consigné par compte « en_attente » (miroir de la table
   * dossier_checklists réelle — ici seul l'état courant est gardé).
   */
  checklistsDossiers: Record<string, ChecklistDossier>;
  /** v1.3 : demandes de rattachement par Display ID (triple validation). */
  demandesRattachement: DemandeRattachement[];
  /**
   * v1.3 : documents « compte » des personas du REGISTRE et du
   * gestionnaire démo (pièces d'identité, contrats) — le compte
   * principal range les siens dans db.documents comme les autres.
   */
  documentsComptes: Document[];
  /**
   * Pack employé (2026-11-08) : état du pack par id de membre
   * (charte datée, cycle du contrat d'engagement, champs employeur
   * stockés) — miroir des colonnes profils du module SQL réel.
   * Absent pour un membre = pack par défaut (rien d'accepté, contrat
   * « sans_objet ») : la rétroactivité est donc naturelle.
   */
  packsEmployes: Record<string, PackEmployeStocke>;
  /**
   * Finances de la plateforme (2026-11-08) : paies émises aux
   * employés — miroir de la table réelle paies_employes. Vide au
   * départ : aucune paie n'est inventée.
   */
  paiesEmployes: import("./types").PaieEmploye[];
  /**
   * Finances de la plateforme (2026-11-08) : dépenses de
   * fonctionnement supervisées — miroir de depenses_plateforme.
   */
  depensesPlateforme: import("./types").DepensePlateforme[];
}

/**
 * État STOCKÉ du pack employé d'un membre (démo) : charte +
 * contrat d'engagement. La carte et la progression restent
 * CALCULÉES (lib/pack-employe.ts), comme en réel.
 */
export interface PackEmployeStocke {
  charte_acceptee_le: string | null;
  statut: import("../pack-employe").StatutContratEmploye;
  motif: string | null;
  parametres: import("../pack-employe").ParametresContratEmploye | null;
  prepare_le: string | null;
}

/** Finances dynamiques démo (extension v1.2) : seed identique à la base réelle. */
export interface FinanceDemo {
  tarifs: TarifPlateforme[];
  parametres: ParametresFinance;
}

export interface DemoDb {
  profil: Profil;
  abonnement: Abonnement;
  immeubles: Immeuble[];
  appartements: Appartement[];
  locataires: Locataire[];
  baux: Bail[];
  echeances: EcheanceLoyer[];
  paiements: Paiement[];
  depenses: Depense[];
  documents: Document[];
  alertes: Alerte[];
  activites: Activite[];
  taux: TauxChange[];
  gestionnaires: GestionnaireInvite[];
  preferences: PreferencesNotifications;
  /** Module 5 : factures d'abonnement + paiements mobile money. */
  factures: FactureAbonnement[];
  paiementsMobileMoney: PaiementMobileMoney[];
  /** Module 6 : indivision familiale (parts en %, somme = 100 %). */
  coproprietaires: Coproprietaire[];
  /** Extension v1.2 : parc interne Ciza Group (contexte gestionnaire séparé). */
  parcCizaGroup: ParcDemo;
  /** Extension v1.2 : registre de la console plateforme. */
  plateforme: PlateformeDemo;
  /** Extension v1.2 : tarifs + paramètres lus dynamiquement. */
  finance: FinanceDemo;
  /**
   * v1.3 : prochain numéro de la séquence Display ID démo (les personas
   * seedés occupent CIM-000001 à CIM-000011 — voir buildDemoDb).
   */
  compteurDisplayId: number;
  /** v1.5 : messagerie directe (fils + messages, tous types de fils). */
  conversations: Conversation[];
  messages: MessageDirect[];
  /**
   * v1.5 : true quand la suppression du compte principal a été EXÉCUTÉE
   * (données du parc vidées, compte retiré des listes console) — la
   * démo mono-compte ne peut pas supprimer physiquement db.profil.
   */
  principalSupprime?: boolean;
}

const OWNER_ID = "00000000-0000-4000-8000-000000000001";

/** Propriétaire du parc interne Ciza Group (données fictives de démo). */
export const CIZAGROUP_OWNER_ID = "00000000-0000-4000-8000-000000000e01";

/** E-mail de connexion du compte démo gestionnaire (bouton « Essayer comme Gestionnaire »). */
export const GESTIONNAIRE_DEMO_EMAIL = "gestion.demo@cizaimmo.com";

/** E-mails de connexion des comptes plateforme démo (boutons page connexion). */
export const SUPER_ADMIN_DEMO_EMAIL = "superadmin.demo@cizaimmo.com";
export const ADMIN_DEMO_EMAIL = "admin.demo@cizaimmo.com";

export function buildDemoDb(): DemoDb {
  const now = new Date().toISOString();
  const trialEnds = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const profil: Profil = {
    id: OWNER_ID,
    nom: "Amina Niyonzima",
    email: "demo@cizaimmo.com",
    pays: "Burundi",
    langue: "fr",
    devise_principale: "BIF",
    role: "proprietaire",
    telephone: "+257 79 00 00 01",
    suspendu: false,
    // Signaux anti-fraude concordants : déclaré Burundi, IP BI,
    // premier paiement mobile money +257 → grille Afrique, statut ok.
    pays_declare: "Burundi",
    pays_ip: "BI",
    pays_paiement: "BI",
    grille_attribuee: "afrique",
    grille_statut: "ok",
    // v1.3 : premier Display ID de la démo ; dossier complet (photo +
    // pièce d'identité seedées plus bas).
    display_id: "CIM-000001",
    type_intention: "proprietaire",
    photo_profil_path: "demo:photo-profil-amina",
    statut_contrat: "sans_objet",
    // Option C — RÉTROACTIVITÉ (miroir du backfill SQL) : compte
    // propriétaire DÉJÀ approuvé → son contrat de service est
    // disponible dans son espace, statut « a_signer », AUCUN e-mail
    // de rattrapage (cas Kaneza CIM-000002 en réel).
    statut_contrat_proprietaire: "a_signer",
    motif_contrat_proprietaire: null,
    // v1.5 : aucune suppression en cours, aucun Admin responsable.
    suppression_demandee_le: null,
    admin_responsable_id: null,
    created_at: now,
  };

  const abonnement: Abonnement = {
    id: "00000000-0000-4000-8000-000000000101",
    owner_id: OWNER_ID,
    plan: "pro",
    grille: "afrique",
    statut: "essai",
    debut_periode: now,
    fin_periode: trialEnds,
    trial_ends_at: trialEnds,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    mobile_money_ref: null,
    created_at: now,
    plan_en_attente: null,
    date_effet_plan: null,
    resiliation_programmee: false,
    echec_paiement: false,
    grace_ends_at: null,
    lecture_seule_jusqu_au: null,
    // v1.4 : compte démo existant — son pack de fin d'essai suit son
    // plan en cours (Pro) ; les NOUVEAUX comptes partent sur Starter.
    plan_apres_essai: "pro",
  };

  const immeubles: Immeuble[] = [
    {
      id: "00000000-0000-4000-8000-000000000201",
      owner_id: OWNER_ID,
      nom: "Immeuble Buhomba",
      adresse: "6ème Avenue N° 47, Quartier Buhomba",
      ville: "Bujumbura",
      pays: "Burundi",
      devise: "BIF",
      type: "immeuble",
      etages: 3,
      photo_url: null,
      notes: "Immeuble de démonstration — données fictives.",
      valeur_bien: 180000000,
      devise_valeur: "BIF",
      date_acquisition: "2022-03-15",
      prix_acquisition: 150000000,
      date_estimation: "2026-10-01",
      mode_acquisition: "achat",
      quartier: "Buhomba",
      statut: "actif",
      created_at: now,
      // v1.7 : photo du passeport (URL fictive, comme les photos
      // d'appartements de la démo) — créée par la propriétaire.
      photos: ["https://exemple.cizaimmo.com/photos/buhomba-1.jpg"],
      photos_urls: ["https://exemple.cizaimmo.com/photos/buhomba-1.jpg"],
      origine_creation: "proprietaire",
      proprietaire_declare_nom: null,
      proprietaire_declare_email: null,
      proprietaire_concordance: false,
      validation_statut: "valide",
      validation_motif: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000202",
      owner_id: OWNER_ID,
      nom: "Bloc Saint-Laurent",
      adresse: "4820 boul. Saint-Laurent",
      ville: "Montréal",
      pays: "Canada",
      devise: "CAD",
      type: "bloc",
      etages: 2,
      photo_url: null,
      notes: "Bloc de démonstration — données fictives.",
      valeur_bien: 850000,
      devise_valeur: "CAD",
      date_acquisition: "2021-06-01",
      prix_acquisition: 790000,
      date_estimation: null,
      mode_acquisition: "achat",
      quartier: "Le Plateau-Mont-Royal",
      statut: "actif",
      created_at: now,
      photos: [],
      photos_urls: [],
      origine_creation: "proprietaire",
      proprietaire_declare_nom: null,
      proprietaire_declare_email: null,
      proprietaire_concordance: false,
      validation_statut: "valide",
      validation_motif: null,
    },
    {
      id: "00000000-0000-4000-8000-000000000203",
      owner_id: OWNER_ID,
      nom: "Maison Kigobe",
      adresse: "Avenue Kigobe N° 12",
      ville: "Bujumbura",
      pays: "Burundi",
      devise: "BIF",
      type: "maison",
      etages: 1,
      photo_url: null,
      notes: "Maison archivée — exemple d'historique consultable.",
      valeur_bien: 95000000,
      devise_valeur: "BIF",
      date_acquisition: "2019-05-20",
      prix_acquisition: 80000000,
      date_estimation: null,
      mode_acquisition: "heritage",
      quartier: "Kigobe",
      statut: "archive",
      created_at: now,
      photos: [],
      photos_urls: [],
      origine_creation: "proprietaire",
      proprietaire_declare_nom: null,
      proprietaire_declare_email: null,
      proprietaire_concordance: false,
      validation_statut: "valide",
      validation_motif: null,
    },
  ];

  const appartements: Appartement[] = [
    { id: "00000000-0000-4000-8000-000000000301", immeuble_id: immeubles[0].id, numero: "A1", type: "T2", surface_m2: 58, loyer_defaut: 450000, devise: "BIF", charges: 50000, etage: 0, description: null, photos: [], statut: "occupe", vitrine: false, archive: false, valeur_bien: null, devise_valeur: null, vitrine_statut: "non_publie", vitrine_motif_refus: null, vitrine_valide_par: null, vitrine_valide_le: null, pieces: null, meuble: false, disponible_le: null, visite_jours: [], visite_heures: null, contact_nom: null, contact_telephone: null, contact_email: null, contact_justification: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000302", immeuble_id: immeubles[0].id, numero: "A2", type: "T3", surface_m2: 82, loyer_defaut: 650000, devise: "BIF", charges: 50000, etage: 1, description: null, photos: [], statut: "occupe", vitrine: false, archive: false, valeur_bien: null, devise_valeur: null, vitrine_statut: "non_publie", vitrine_motif_refus: null, vitrine_valide_par: null, vitrine_valide_le: null, pieces: null, meuble: false, disponible_le: null, visite_jours: [], visite_heures: null, contact_nom: null, contact_telephone: null, contact_email: null, contact_justification: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000303", immeuble_id: immeubles[0].id, numero: "A3", type: "studio", surface_m2: 32, loyer_defaut: 280000, devise: "BIF", charges: 30000, etage: 2, description: null, photos: [], statut: "occupe", vitrine: false, archive: false, valeur_bien: null, devise_valeur: null, vitrine_statut: "non_publie", vitrine_motif_refus: null, vitrine_valide_par: null, vitrine_valide_le: null, pieces: null, meuble: false, disponible_le: null, visite_jours: [], visite_heures: null, contact_nom: null, contact_telephone: null, contact_email: null, contact_justification: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000304", immeuble_id: immeubles[1].id, numero: "101", type: "T2", surface_m2: 64, loyer_defaut: 1250, devise: "CAD", charges: 0, etage: 1, description: null, photos: [], statut: "occupe", vitrine: false, archive: false, valeur_bien: null, devise_valeur: null, vitrine_statut: "non_publie", vitrine_motif_refus: null, vitrine_valide_par: null, vitrine_valide_le: null, pieces: null, meuble: false, disponible_le: null, visite_jours: [], visite_heures: null, contact_nom: null, contact_telephone: null, contact_email: null, contact_justification: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000305", immeuble_id: immeubles[1].id, numero: "102", type: "T1", surface_m2: 45, loyer_defaut: 980, devise: "CAD", charges: 0, etage: 1, description: null, photos: [], statut: "occupe", vitrine: false, archive: false, valeur_bien: null, devise_valeur: null, vitrine_statut: "non_publie", vitrine_motif_refus: null, vitrine_valide_par: null, vitrine_valide_le: null, pieces: null, meuble: false, disponible_le: null, visite_jours: [], visite_heures: null, contact_nom: null, contact_telephone: null, contact_email: null, contact_justification: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000306", immeuble_id: immeubles[2].id, numero: "RDC", type: "T3", surface_m2: 75, loyer_defaut: 500000, devise: "BIF", charges: 0, etage: 0, description: null, photos: [], statut: "vacant", vitrine: false, archive: true, valeur_bien: null, devise_valeur: null, vitrine_statut: "non_publie", vitrine_motif_refus: null, vitrine_valide_par: null, vitrine_valide_le: null, pieces: null, meuble: false, disponible_le: null, visite_jours: [], visite_heures: null, contact_nom: null, contact_telephone: null, contact_email: null, contact_justification: null, created_at: now },
    // Vacant depuis le 20 sept. 2026 : vacance prolongée (> 30 jours) au 6 nov.
    { id: "00000000-0000-4000-8000-000000000307", immeuble_id: immeubles[0].id, numero: "A4", type: "T1", surface_m2: 41, loyer_defaut: 350000, devise: "BIF", charges: 30000, etage: 2, description: "Appartement lumineux avec balcon, proche de toutes commodités, disponible immédiatement.", photos: ["https://exemple.cizaimmo.com/photos/a4-1.jpg", "https://exemple.cizaimmo.com/photos/a4-2.jpg"], statut: "vacant", vitrine: true, archive: false, valeur_bien: null, devise_valeur: null, vitrine_statut: "approuve", vitrine_motif_refus: null, vitrine_valide_par: "plateforme-super-admin", vitrine_valide_le: "2026-11-05T10:00:00.000Z", pieces: 2, meuble: true, disponible_le: null, visite_jours: ["sam"], visite_heures: "10h - 16h", contact_nom: null, contact_telephone: null, contact_email: null, contact_justification: null, created_at: "2026-09-20T00:00:00.000Z" },
    // v1.6 : annonce EN ATTENTE de validation Admin — le contact annoncé
    // (une agence locale) diverge du contact du dossier (Marc Dubois,
    // gestionnaire rattaché actif du Bloc Saint-Laurent), AVEC
    // justification : la file console démo montre divergent = true.
    { id: "00000000-0000-4000-8000-000000000308", immeuble_id: immeubles[1].id, numero: "201", type: "T2", surface_m2: 55, loyer_defaut: 1100, devise: "CAD", charges: 0, etage: 2, description: "Bel appartement ensoleillé au 2e étage, cuisine ouverte et rangement intégré.", photos: ["https://exemple.cizaimmo.com/photos/201-1.jpg", "https://exemple.cizaimmo.com/photos/201-2.jpg"], statut: "vacant", vitrine: true, archive: false, valeur_bien: null, devise_valeur: null, vitrine_statut: "en_attente", vitrine_motif_refus: null, vitrine_valide_par: null, vitrine_valide_le: null, pieces: 3, meuble: false, disponible_le: "2026-12-01", visite_jours: ["mer", "sam"], visite_heures: "17h - 19h", contact_nom: "Agence Relais Montréal", contact_telephone: "+1 514 555 0199", contact_email: "relais@exemple.ca", contact_justification: "Le gestionnaire a confié les visites à une agence locale pendant son absence.", created_at: now },
  ];

  const locataires: Locataire[] = [
    { id: "00000000-0000-4000-8000-000000000401", owner_id: OWNER_ID, nom: "Jean-Claude Hakizimana", telephone: "+25779123456", email: "jc.hakizimana@exemple.bi", piece_type: "cni", piece_numero: "1234567890123", adresse_precedente: "Rohero, Bujumbura", contact_urgence: "+25779998877", notes: null, lien_token: null, lien_expire_le: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000402", owner_id: OWNER_ID, nom: "Sandrine Nkurunziza", telephone: "+25779555666", email: "s.nkurunziza@exemple.bi", piece_type: "cni", piece_numero: "1234567890456", adresse_precedente: "Kinindo, Bujumbura", contact_urgence: "+25779444333", notes: null, lien_token: null, lien_expire_le: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000403", owner_id: OWNER_ID, nom: "Marie Tremblay", telephone: "+15145550101", email: "marie.tremblay@exemple.ca", piece_type: "passeport", piece_numero: "CA1234567", adresse_precedente: "Montréal, QC", contact_urgence: "+15145550102", notes: null, lien_token: null, lien_expire_le: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000404", owner_id: OWNER_ID, nom: "Éric Ndayishimiye", telephone: "+25779666777", email: null, piece_type: "cni", piece_numero: "1234567890789", adresse_precedente: "Mutanga, Bujumbura", contact_urgence: "+25779333222", notes: null, lien_token: null, lien_expire_le: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000405", owner_id: OWNER_ID, nom: "Sophie Gagnon", telephone: "+15145550103", email: "sophie.gagnon@exemple.ca", piece_type: "passeport", piece_numero: "CA7654321", adresse_precedente: "Laval, QC", contact_urgence: "+15145550104", notes: null, lien_token: null, lien_expire_le: null, created_at: now },
  ];

  const baux: Bail[] = [
    { id: "00000000-0000-4000-8000-000000000501", appartement_id: appartements[0].id, locataire_id: locataires[0].id, debut: "2026-01-01", fin: "2026-12-31", loyer_mensuel: 450000, devise: "BIF", caution: 450000, devise_caution: "BIF", caution_recue_le: "2025-12-28", caution_statut: "recue", jour_exigibilite: 5, charges_incluses: false, statut: "actif", doc_url: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000502", appartement_id: appartements[1].id, locataire_id: locataires[1].id, debut: "2026-03-01", fin: "2027-02-28", loyer_mensuel: 650000, devise: "BIF", caution: 650000, devise_caution: "BIF", caution_recue_le: "2026-02-25", caution_statut: "recue", jour_exigibilite: 5, charges_incluses: false, statut: "actif", doc_url: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000503", appartement_id: appartements[3].id, locataire_id: locataires[2].id, debut: "2026-09-01", fin: "2027-08-31", loyer_mensuel: 1250, devise: "CAD", caution: 1250, devise_caution: "CAD", caution_recue_le: "2026-08-28", caution_statut: "recue", jour_exigibilite: 1, charges_incluses: true, statut: "actif", doc_url: null, created_at: now },
    // Entrée en cours de mois (15 oct.) : premier mois au prorata (17/31 jours).
    { id: "00000000-0000-4000-8000-000000000504", appartement_id: appartements[2].id, locataire_id: locataires[3].id, debut: "2026-10-15", fin: "2027-10-14", loyer_mensuel: 280000, devise: "BIF", caution: 280000, devise_caution: "BIF", caution_recue_le: "2026-10-14", caution_statut: "recue", jour_exigibilite: 20, charges_incluses: false, statut: "actif", doc_url: null, created_at: now },
    // Bail démarrant le 1er nov., jour d'exigibilité 3 : échéance « due » début nov.
    { id: "00000000-0000-4000-8000-000000000505", appartement_id: appartements[4].id, locataire_id: locataires[4].id, debut: "2026-11-01", fin: "2027-10-31", loyer_mensuel: 980, devise: "CAD", caution: 980, devise_caution: "CAD", caution_recue_le: "2026-10-30", caution_statut: "recue", jour_exigibilite: 3, charges_incluses: false, statut: "actif", doc_url: null, created_at: now },
  ];

  // Échéances d'octobre et novembre 2026 (mois = 1er du mois).
  // Statuts stockés = ceux calculés au 6 nov. 2026 ; la lecture recalcule toujours.
  const echeances: EcheanceLoyer[] = [
    // Octobre 2026
    { id: "00000000-0000-4000-8000-000000000611", bail_id: baux[0].id, mois: "2026-10-01", montant_du: 450000, devise: "BIF", statut: "paye", prorata: false, prorata_detail: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000612", bail_id: baux[1].id, mois: "2026-10-01", montant_du: 650000, devise: "BIF", statut: "en_retard", prorata: false, prorata_detail: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000613", bail_id: baux[2].id, mois: "2026-10-01", montant_du: 1250, devise: "CAD", statut: "paye", prorata: false, prorata_detail: null, created_at: now },
    // Prorata : 280 000 × 17/31 = 153 548 BIF (entrée le 15 oct., 17 jours sur 31).
    { id: "00000000-0000-4000-8000-000000000614", bail_id: baux[3].id, mois: "2026-10-01", montant_du: 153548, devise: "BIF", statut: "en_retard", prorata: true, prorata_detail: "17/31", created_at: now },
    // Novembre 2026
    { id: "00000000-0000-4000-8000-000000000601", bail_id: baux[0].id, mois: "2026-11-01", montant_du: 450000, devise: "BIF", statut: "paye", prorata: false, prorata_detail: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000602", bail_id: baux[1].id, mois: "2026-11-01", montant_du: 650000, devise: "BIF", statut: "partiel", prorata: false, prorata_detail: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000603", bail_id: baux[2].id, mois: "2026-11-01", montant_du: 1250, devise: "CAD", statut: "paye", prorata: false, prorata_detail: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000604", bail_id: baux[3].id, mois: "2026-11-01", montant_du: 280000, devise: "BIF", statut: "a_venir", prorata: false, prorata_detail: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000605", bail_id: baux[4].id, mois: "2026-11-01", montant_du: 980, devise: "CAD", statut: "du", prorata: false, prorata_detail: null, created_at: now },
  ];

  const paiements: Paiement[] = [
    // Octobre 2026
    { id: "00000000-0000-4000-8000-000000000711", echeance_id: echeances[2].id, montant: 1250, devise: "CAD", date_paiement: "2026-10-01", moyen: "virement", reference: "Virement démo", declare_par: OWNER_ID, recu_numero: "CIM-2026-000001", statut: "valide", created_at: now },
    { id: "00000000-0000-4000-8000-000000000712", echeance_id: echeances[0].id, montant: 450000, devise: "BIF", date_paiement: "2026-10-04", moyen: "mobile_money", reference: "EcoCash démo", declare_par: OWNER_ID, recu_numero: "CIM-2026-000002", statut: "valide", created_at: now },
    // Déclaration annulée (erreur de montant) : le reçu reste visible, marqué ANNULÉ.
    { id: "00000000-0000-4000-8000-000000000713", echeance_id: echeances[1].id, montant: 200000, devise: "BIF", date_paiement: "2026-10-06", moyen: "especes", reference: null, declare_par: OWNER_ID, recu_numero: "CIM-2026-000003", statut: "annule", annule_par: OWNER_ID, annule_le: "2026-10-07T09:00:00.000Z", motif_annulation: "Erreur de montant déclaré", created_at: now },
    // Novembre 2026
    { id: "00000000-0000-4000-8000-000000000703", echeance_id: echeances[6].id, montant: 1250, devise: "CAD", date_paiement: "2026-11-01", moyen: "virement", reference: "Virement démo", declare_par: OWNER_ID, recu_numero: "CIM-2026-000004", statut: "valide", created_at: now },
    { id: "00000000-0000-4000-8000-000000000701", echeance_id: echeances[4].id, montant: 450000, devise: "BIF", date_paiement: "2026-11-04", moyen: "mobile_money", reference: "EcoCash démo", declare_par: OWNER_ID, recu_numero: "CIM-2026-000005", statut: "valide", created_at: now },
    { id: "00000000-0000-4000-8000-000000000702", echeance_id: echeances[5].id, montant: 400000, devise: "BIF", date_paiement: "2026-11-05", moyen: "especes", reference: null, declare_par: OWNER_ID, recu_numero: "CIM-2026-000006", statut: "valide", created_at: now },
  ];

  const depenses: Depense[] = [
    { id: "00000000-0000-4000-8000-000000000801", owner_id: OWNER_ID, immeuble_id: immeubles[0].id, appartement_id: null, date: "2026-11-02", categorie: "reparation", libelle: "Réparation plomberie — A2", montant: 120000, devise: "BIF", fournisseur: "Plombier démo", justificatif_url: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000802", owner_id: OWNER_ID, immeuble_id: immeubles[1].id, appartement_id: appartements[3].id, date: "2026-10-28", categorie: "entretien", libelle: "Nettoyage commun — Bloc Saint-Laurent", montant: 85, devise: "CAD", fournisseur: "Nettoyage démo", justificatif_url: null, created_at: now },
  ];

  // Taux de change datés (spec §9) : jamais présentés comme « taux du jour ».
  // Source « auto » = taux stockés ; un taux manuel de secours peut primer.
  const taux: TauxChange[] = [
    { id: "00000000-0000-4000-8000-000000000901", devise_source: "USD", devise_cible: "BIF", taux: 2900, date_taux: "2026-11-05", source: "auto", created_at: now },
    { id: "00000000-0000-4000-8000-000000000902", devise_source: "EUR", devise_cible: "BIF", taux: 3350, date_taux: "2026-11-05", source: "auto", created_at: now },
    { id: "00000000-0000-4000-8000-000000000903", devise_source: "CAD", devise_cible: "BIF", taux: 2080, date_taux: "2026-11-05", source: "auto", created_at: now },
    { id: "00000000-0000-4000-8000-000000000904", devise_source: "USD", devise_cible: "CAD", taux: 1.39, date_taux: "2026-11-05", source: "auto", created_at: now },
    { id: "00000000-0000-4000-8000-000000000905", devise_source: "USD", devise_cible: "EUR", taux: 0.86, date_taux: "2026-11-05", source: "auto", created_at: now },
  ];

  const documents: Document[] = [
    {
      id: "00000000-0000-4000-8000-000000000a01",
      owner_id: OWNER_ID,
      type: "bail",
      entite_type: "bail",
      entite_id: baux[0].id,
      nom_fichier: "bail-signe-hakizimana-a1.pdf",
      storage_path: "demo:00000000-0000-4000-8000-000000000a01",
      taille_octets: 184320,
      mime_type: "application/pdf",
      ajoute_par: OWNER_ID,
      created_at: "2026-01-02T09:00:00.000Z",
      contenu: null,
      contenu_non_conserve: true,
    },
    {
      // v1.3 : pièce d'identité du DOSSIER d'Amina (entite « compte ») —
      // avec sa photo de profil seedée, son dossier est COMPLET.
      id: "00000000-0000-4000-8000-000000000a02",
      owner_id: OWNER_ID,
      type: "piece_identite",
      entite_type: "compte",
      entite_id: OWNER_ID,
      nom_fichier: "piece-identite-amina.jpg",
      storage_path: "demo:piece-identite-amina",
      taille_octets: 96400,
      mime_type: "image/jpeg",
      ajoute_par: OWNER_ID,
      created_at: now,
      contenu: null,
      contenu_non_conserve: true,
    },
  ];

  // Fil d'actualité de départ : il se nourrit des événements déjà enregistrés.
  const activites: Activite[] = [
    { id: "00000000-0000-4000-8000-000000000b01", owner_id: OWNER_ID, type: "paiement", entite_type: "loyer", entite_id: echeances[4].id, auteur: OWNER_ID, description: "Paiement déclaré : 450 000 BIF — Jean-Claude Hakizimana (A1, nov. 2026)", created_at: "2026-11-04T10:15:00.000Z" },
    { id: "00000000-0000-4000-8000-000000000b02", owner_id: OWNER_ID, type: "paiement", entite_type: "loyer", entite_id: echeances[5].id, auteur: OWNER_ID, description: "Paiement déclaré : 400 000 BIF — Sandrine Nkurunziza (A2, nov. 2026)", created_at: "2026-11-05T16:40:00.000Z" },
    { id: "00000000-0000-4000-8000-000000000b03", owner_id: OWNER_ID, type: "depense", entite_type: "depense", entite_id: depenses[0].id, auteur: OWNER_ID, description: "Dépense ajoutée : Réparation plomberie — A2 (120 000 BIF)", created_at: "2026-11-02T11:00:00.000Z" },
    { id: "00000000-0000-4000-8000-000000000b04", owner_id: OWNER_ID, type: "bail", entite_type: "bail", entite_id: baux[4].id, auteur: OWNER_ID, description: "Bail créé : Sophie Gagnon — appartement 102 (dès le 2026-11-01)", created_at: "2026-10-30T14:20:00.000Z" },
    { id: "00000000-0000-4000-8000-000000000b05", owner_id: OWNER_ID, type: "document", entite_type: "document", entite_id: documents[0].id, auteur: OWNER_ID, description: "Document ajouté : bail-signe-hakizimana-a1.pdf (bail signé)", created_at: "2026-01-02T09:00:00.000Z" },
  ];

  const preferences: PreferencesNotifications = {
    owner_id: OWNER_ID,
    types_coupes: [],
    canal_app: true,
    canal_email: true,
    canal_whatsapp: true,
    seuil_vacance_jours: 30,
    updated_at: now,
  };

  // Indivision familiale (module 6) : Immeuble Buhomba partagé en famille,
  // 60 % / 40 % = 100 %. La diaspora (Diane, à Montréal) a un accès
  // lecture seule sur ce bien uniquement.
  const coproprietaires: Coproprietaire[] = [
    {
      id: "00000000-0000-4000-8000-000000000c01",
      immeuble_id: immeubles[0].id,
      nom: "Jean-Marie Niyonzima",
      email: "jean-marie@exemple.bi",
      telephone: "+257 79 22 22 22",
      part: 60,
      statut: "actif",
      created_at: now,
    },
    {
      id: "00000000-0000-4000-8000-000000000c02",
      immeuble_id: immeubles[0].id,
      nom: "Diane Niyonzima",
      email: "diane@exemple.ca",
      telephone: "+1 514 555 0104",
      part: 40,
      statut: "actif",
      created_at: now,
    },
  ];

  // Gestionnaire de démonstration (spec §2) : rattaché au Bloc
  // Saint-Laurent uniquement — il ne voit que ce bien, jamais
  // l'abonnement ni les autres immeubles. Ses données visibles :
  // appartements 101 et 102, locataires Marie Tremblay et Sophie Gagnon,
  // leurs baux et échéances (oct. et nov. 2026, CAD), les paiements
  // CIM-2026-000001 et CIM-2026-000004, et la dépense de nettoyage de
  // 85 CAD. Connexion avec GESTIONNAIRE_DEMO_EMAIL (bouton « Essayer
  // comme Gestionnaire » sur la page de connexion).
  const gestionnaires: GestionnaireInvite[] = [
    {
      id: "00000000-0000-4000-8000-000000000d01",
      owner_id: OWNER_ID,
      email: GESTIONNAIRE_DEMO_EMAIL,
      nom: "Marc Dubois",
      immeuble_ids: [immeubles[1].id],
      statut: "actif",
      created_at: now,
    },
  ];

  // ==========================================================================
  // Extension v1.2 — parc interne CIZA GROUP (contexte séparé du
  // gestionnaire multi-rattaché), registre plateforme et finances.
  // Toutes ces données restent FICTIVES et étiquetées DÉMO.
  // ==========================================================================
  const dans = (jours: number) =>
    new Date(Date.now() + jours * 24 * 60 * 60 * 1000).toISOString();
  const moisCourant = new Date().toISOString().slice(0, 7) + "-01";

  const cgImmeubles: Immeuble[] = [
    {
      id: "00000000-0000-4000-8000-000000000e02",
      owner_id: CIZAGROUP_OWNER_ID,
      nom: "Résidence Ciza — Rohero",
      adresse: "Avenue de la Mission N° 8, Rohero",
      ville: "Bujumbura",
      pays: "Burundi",
      devise: "BIF",
      type: "immeuble",
      etages: 2,
      photo_url: null,
      notes: "Parc interne Ciza Group — démonstration, données fictives.",
      valeur_bien: 380000000,
      devise_valeur: "BIF",
      date_acquisition: "2023-05-10",
      prix_acquisition: 320000000,
      date_estimation: "2026-09-15",
      mode_acquisition: "achat",
      quartier: "Rohero",
      statut: "actif",
      created_at: now,
      photos: [],
      photos_urls: [],
      origine_creation: "proprietaire",
      proprietaire_declare_nom: null,
      proprietaire_declare_email: null,
      proprietaire_concordance: false,
      validation_statut: "valide",
      validation_motif: null,
    },
  ];
  const cgAppartements: Appartement[] = [
    { id: "00000000-0000-4000-8000-000000000e11", immeuble_id: cgImmeubles[0].id, numero: "R1", type: "T2", surface_m2: 62, loyer_defaut: 520000, devise: "BIF", charges: 40000, etage: 0, description: null, photos: [], statut: "occupe", vitrine: false, archive: false, valeur_bien: null, devise_valeur: null, vitrine_statut: "non_publie", vitrine_motif_refus: null, vitrine_valide_par: null, vitrine_valide_le: null, pieces: null, meuble: false, disponible_le: null, visite_jours: [], visite_heures: null, contact_nom: null, contact_telephone: null, contact_email: null, contact_justification: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000e12", immeuble_id: cgImmeubles[0].id, numero: "R2", type: "T3", surface_m2: 88, loyer_defaut: 740000, devise: "BIF", charges: 40000, etage: 1, description: null, photos: [], statut: "occupe", vitrine: false, archive: false, valeur_bien: null, devise_valeur: null, vitrine_statut: "non_publie", vitrine_motif_refus: null, vitrine_valide_par: null, vitrine_valide_le: null, pieces: null, meuble: false, disponible_le: null, visite_jours: [], visite_heures: null, contact_nom: null, contact_telephone: null, contact_email: null, contact_justification: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000e13", immeuble_id: cgImmeubles[0].id, numero: "R3", type: "T1", surface_m2: 44, loyer_defaut: 390000, devise: "BIF", charges: 30000, etage: 1, description: null, photos: [], statut: "vacant", vitrine: false, archive: false, valeur_bien: null, devise_valeur: null, vitrine_statut: "non_publie", vitrine_motif_refus: null, vitrine_valide_par: null, vitrine_valide_le: null, pieces: null, meuble: false, disponible_le: null, visite_jours: [], visite_heures: null, contact_nom: null, contact_telephone: null, contact_email: null, contact_justification: null, created_at: now },
  ];
  const cgLocataires: Locataire[] = [
    { id: "00000000-0000-4000-8000-000000000e21", owner_id: CIZAGROUP_OWNER_ID, nom: "Espoir Manirakiza", telephone: "+25779001122", email: "espoir.m@exemple.bi", piece_type: "cni", piece_numero: "1234567890999", adresse_precedente: "Ngagara, Bujumbura", contact_urgence: "+25779001123", notes: null, lien_token: null, lien_expire_le: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000e22", owner_id: CIZAGROUP_OWNER_ID, nom: "Grâce Irakoze", telephone: "+25779003344", email: "grace.i@exemple.bi", piece_type: "cni", piece_numero: "1234567890888", adresse_precedente: "Kinindo, Bujumbura", contact_urgence: "+25779003345", notes: null, lien_token: null, lien_expire_le: null, created_at: now },
  ];
  const cgBaux: Bail[] = [
    { id: "00000000-0000-4000-8000-000000000e31", appartement_id: cgAppartements[0].id, locataire_id: cgLocataires[0].id, debut: "2026-02-01", fin: "2027-01-31", loyer_mensuel: 520000, devise: "BIF", caution: 520000, devise_caution: "BIF", caution_recue_le: "2026-01-27", caution_statut: "recue", jour_exigibilite: 5, charges_incluses: false, statut: "actif", doc_url: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000e32", appartement_id: cgAppartements[1].id, locataire_id: cgLocataires[1].id, debut: "2026-06-01", fin: "2027-05-31", loyer_mensuel: 740000, devise: "BIF", caution: 740000, devise_caution: "BIF", caution_recue_le: "2026-05-28", caution_statut: "recue", jour_exigibilite: 5, charges_incluses: false, statut: "actif", doc_url: null, created_at: now },
  ];
  const cgEcheances: EcheanceLoyer[] = [
    { id: "00000000-0000-4000-8000-000000000e41", bail_id: cgBaux[0].id, mois: moisCourant, montant_du: 520000, devise: "BIF", statut: "paye", prorata: false, prorata_detail: null, created_at: now },
    { id: "00000000-0000-4000-8000-000000000e42", bail_id: cgBaux[1].id, mois: moisCourant, montant_du: 740000, devise: "BIF", statut: "du", prorata: false, prorata_detail: null, created_at: now },
  ];
  const parcCizaGroup: ParcDemo = {
    profil: {
      id: CIZAGROUP_OWNER_ID,
      nom: "Ciza Group — Parc interne",
      email: "parc@cizagroup.com",
      pays: "Burundi",
      langue: "fr",
      devise_principale: "BIF",
      role: "proprietaire",
      telephone: "+257 79 94 50 07",
      suspendu: false,
      created_at: now,
    },
    immeubles: cgImmeubles,
    appartements: cgAppartements,
    locataires: cgLocataires,
    baux: cgBaux,
    echeances: cgEcheances,
    paiements: [
      { id: "00000000-0000-4000-8000-000000000e51", echeance_id: cgEcheances[0].id, montant: 520000, devise: "BIF", date_paiement: new Date().toISOString().slice(0, 10), moyen: "mobile_money", reference: "EcoCash démo", declare_par: CIZAGROUP_OWNER_ID, recu_numero: "CIM-2026-000101", statut: "valide", created_at: now },
    ],
    depenses: [
      { id: "00000000-0000-4000-8000-000000000e61", owner_id: CIZAGROUP_OWNER_ID, immeuble_id: cgImmeubles[0].id, appartement_id: null, date: "2026-10-20", categorie: "entretien", libelle: "Entretien jardin — Résidence Ciza", montant: 85000, devise: "BIF", fournisseur: "Entretien démo", justificatif_url: null, created_at: now },
    ],
    documents: [],
    activites: [
      { id: "00000000-0000-4000-8000-000000000e71", owner_id: CIZAGROUP_OWNER_ID, type: "paiement", entite_type: "loyer", entite_id: cgEcheances[0].id, auteur: CIZAGROUP_OWNER_ID, description: "Paiement déclaré : 520 000 BIF — Espoir Manirakiza (R1)", created_at: now },
    ],
    alertes: [],
    coproprietaires: [],
  };

  // Registre plateforme démo : 1 Super Admin (fondateur), 1 Admin
  // (employée), 5 comptes clients fictifs aux statuts variés — dont un
  // essai qui finit dans 3 jours, un échec de paiement, un retard au-delà
  // de la grâce et un compte suspendu.
  const plateforme: PlateformeDemo = {
    comptesAdmins: [
      { id: "plateforme-super-admin", email: SUPER_ADMIN_DEMO_EMAIL, nom: "Ciza Misigaro", role: "super_admin", statut: "actif", created_at: now, acces_admin_actif: true },
      { id: "plateforme-admin-1", email: ADMIN_DEMO_EMAIL, nom: "Aline Uwase", role: "admin", statut: "actif", created_at: now, acces_admin_actif: true },
    ],
    comptesClients: [
      {
        id: "client-demo-1", email: "jean.bosco.demo@exemple.bi", nom: "Jean Bosco Ndayisenga", role: "proprietaire", pays: "Burundi", langue: "fr", created_at: dans(-95),
        pays_declare: "Burundi", pays_ip: "BI", pays_paiement: "BI", grille_statut: "ok",
        display_id: "CIM-000003", telephone: "+257 79 11 22 33", type_intention: "proprietaire", statut_contrat: "sans_objet", statut_contrat_proprietaire: "a_signer", dossier_complet: true,
        abonnement: { plan: "pro", grille: "afrique", statut: "actif", debut_periode: dans(-10), fin_periode: dans(20), trial_ends_at: null, echec_paiement: false, grace_ends_at: null },
      },
      {
        id: "client-demo-2", email: "marie.dubois.demo@exemple.ca", nom: "Marie-Claire Dubois", role: "proprietaire", pays: "Canada", langue: "fr", created_at: dans(-27),
        pays_declare: "Canada", pays_ip: "CA", pays_paiement: null, grille_statut: "ok",
        display_id: "CIM-000004", telephone: "+1 514 555 0142", type_intention: "proprietaire", statut_contrat: "sans_objet", statut_contrat_proprietaire: "a_signer", dossier_complet: true,
        abonnement: { plan: "starter", grille: "internationale", statut: "essai", debut_periode: dans(-27), fin_periode: dans(3), trial_ends_at: dans(3), echec_paiement: false, grace_ends_at: null },
      },
      {
        id: "client-demo-3", email: "patrick.m.demo@exemple.rw", nom: "Patrick Mugisha", role: "proprietaire", pays: "Rwanda", langue: "en", created_at: dans(-140),
        pays_declare: "Rwanda", pays_ip: "RW", pays_paiement: "RW", grille_statut: "ok",
        display_id: "CIM-000005", telephone: "+250 788 000 111", type_intention: "proprietaire", statut_contrat: "sans_objet", statut_contrat_proprietaire: "a_signer", dossier_complet: false,
        abonnement: { plan: "agence", grille: "afrique", statut: "actif", debut_periode: dans(-28), fin_periode: dans(2), trial_ends_at: null, echec_paiement: true, grace_ends_at: dans(2) },
      },
      {
        id: "client-demo-4", email: "sarah.t.demo@exemple.com", nom: "Sarah Thompson", role: "proprietaire", pays: "États-Unis", langue: "en", created_at: dans(-200),
        pays_declare: "États-Unis", pays_ip: "US", pays_paiement: "US", grille_statut: "ok",
        display_id: "CIM-000006", telephone: "+1 212 555 0187", type_intention: "proprietaire", statut_contrat: "sans_objet", statut_contrat_proprietaire: "a_signer", dossier_complet: true,
        abonnement: { plan: "pro", grille: "internationale", statut: "actif", debut_periode: dans(-40), fin_periode: dans(-10), trial_ends_at: null, echec_paiement: false, grace_ends_at: null },
      },
      {
        // CONTRADICTION simulée : déclaré Burundi mais IP Canada →
        // grille INTERNATIONALE attribuée par défaut + « a_verifier »
        // (le compte a ensuite été suspendu pour impayé).
        id: "client-demo-5", email: "divine.i.demo@exemple.bi", nom: "Divine Irakoze", role: "proprietaire", pays: "Burundi", langue: "fr", created_at: dans(-60),
        pays_declare: "Burundi", pays_ip: "CA", pays_paiement: null, grille_statut: "a_verifier",
        display_id: "CIM-000007", telephone: "+257 79 44 55 66", type_intention: "proprietaire", statut_contrat: "sans_objet", statut_contrat_proprietaire: "a_signer", dossier_complet: false,
        abonnement: { plan: "starter", grille: "internationale", statut: "suspendu", debut_periode: dans(-45), fin_periode: dans(-15), trial_ends_at: null, echec_paiement: false, grace_ends_at: null, statut_pre_suspension: "actif" },
      },
      {
        // EN ATTENTE d'approbation (ajout n°3) : signaux concordants
        // (déclaré Burundi, IP BI) → grille Afrique proposée.
        id: "client-demo-6", email: "nadine.k.demo@exemple.bi", nom: "Nadine Kamariza", role: "proprietaire", pays: "Burundi", langue: "fr", created_at: dans(-1),
        pays_declare: "Burundi", pays_ip: "BI", pays_paiement: null, grille_statut: "ok",
        // v1.3 : dossier INCOMPLET (ni photo ni pièce d'identité) — la
        // console le signale, l'approbation reste possible.
        display_id: "CIM-000008", telephone: "+257 79 77 88 99", type_intention: "proprietaire", statut_contrat: "sans_objet", dossier_complet: false,
        abonnement: { plan: "pro", grille: "afrique", statut: "en_attente", debut_periode: dans(-1), fin_periode: null, trial_ends_at: null, echec_paiement: false, grace_ends_at: null },
      },
      {
        // EN ATTENTE + CONTRADICTION : déclaré Rwanda, IP France →
        // grille Internationale proposée + badge « à vérifier ».
        id: "client-demo-7", email: "olivier.h.demo@exemple.rw", nom: "Olivier Habimana", role: "proprietaire", pays: "Rwanda", langue: "fr", created_at: dans(0),
        pays_declare: "Rwanda", pays_ip: "FR", pays_paiement: null, grille_statut: "a_verifier",
        display_id: "CIM-000009", telephone: "+250 788 222 333", type_intention: "proprietaire", statut_contrat: "sans_objet", dossier_complet: true,
        abonnement: { plan: "pro", grille: "internationale", statut: "en_attente", debut_periode: dans(0), fin_periode: null, trial_ends_at: null, echec_paiement: false, grace_ends_at: null },
      },
      {
        // REFUSÉ (ajout n°3) : motif prédéfini « doublon » — connexion impossible.
        id: "client-demo-8", email: "doublon.demo@exemple.bi", nom: "Compte Doublon", role: "proprietaire", pays: "Burundi", langue: "fr", created_at: dans(-20),
        pays_declare: "Burundi", pays_ip: "BI", pays_paiement: null, grille_statut: "ok", motif_refus: "doublon",
        display_id: "CIM-000010", telephone: null, type_intention: "proprietaire", statut_contrat: "sans_objet", dossier_complet: false,
        abonnement: { plan: "pro", grille: "afrique", statut: "annule", debut_periode: dans(-20), fin_periode: null, trial_ends_at: null, echec_paiement: false, grace_ends_at: null },
      },
      {
        // v1.3 : GESTIONNAIRE approuvée (essai en cours) dont le contrat
        // SIGNÉ attend la validation d'un Admin — alimente le KPI
        // « contrats en attente » et l'action « valider le contrat » de
        // sa page Dossier.
        id: "client-demo-9", email: "sira.diallo.demo@exemple.sn", nom: "Sira Diallo", role: "proprietaire", pays: "Sénégal", langue: "fr", created_at: dans(-12),
        pays_declare: "Sénégal", pays_ip: "SN", pays_paiement: null, grille_statut: "ok",
        display_id: "CIM-000011", telephone: "+221 77 123 45 67", type_intention: "gestionnaire", statut_contrat: "signe_recu", dossier_complet: true,
        abonnement: { plan: "pro", grille: "afrique", statut: "essai", debut_periode: dans(-2), fin_periode: dans(28), trial_ends_at: dans(28), echec_paiement: false, grace_ends_at: null },
      },
    ],
    rattachements: [
      {
        // Contexte PAR DÉFAUT du gestionnaire (premier actif) : le
        // propriétaire client — comportement historique du compte démo.
        id: "rattachement-demo-proprietaire",
        gestionnaire_id: GESTIONNAIRE_DEMO_EMAIL,
        gestionnaire_email: GESTIONNAIRE_DEMO_EMAIL,
        gestionnaire_nom: "Marc Dubois",
        gestionnaire_telephone: null,
        contexte: "proprietaire",
        proprietaire_id: OWNER_ID,
        proprietaire_nom: "Amina Niyonzima",
        proprietaire_email: "demo@cizaimmo.com",
        proprietaire_telephone: "+257 79 00 00 01",
        immeuble_ids: [immeubles[1].id],
        statut: "actif",
        created_at: now,
      },
      {
        id: "rattachement-demo-cizagroup",
        gestionnaire_id: GESTIONNAIRE_DEMO_EMAIL,
        gestionnaire_email: GESTIONNAIRE_DEMO_EMAIL,
        gestionnaire_nom: "Marc Dubois",
        gestionnaire_telephone: null,
        contexte: "cizagroup",
        proprietaire_id: null,
        proprietaire_nom: null,
        proprietaire_email: null,
        proprietaire_telephone: null,
        immeuble_ids: [cgImmeubles[0].id],
        statut: "actif",
        created_at: now,
      },
    ],
    journal: [],
    avis: [],
    checklistsDossiers: {},
    // Pack employé (2026-11-08) : aucun pack pré-rempli — chaque
    // membre démarre « sans_objet » / charte en attente (défaut lu
    // par le fournisseur), rétroactivité incluse.
    packsEmployes: {},
    // Finances de la plateforme (2026-11-08) : aucune paie ni
    // dépense pré-remplie — les registres naissent vides, comme les
    // tables réelles du module SQL.
    paiesEmployes: [],
    depensesPlateforme: [],
    // v1.3 : demandes de rattachement par Display ID. Marc Dubois
    // (CIM-000002, contrat « valide ») est le gestionnaire démo ; son
    // identifiant de compte = celui de son invitation.
    demandesRattachement: [
      {
        // Acceptée par Marc, EN ATTENTE de la validation Admin (KPI
        // console + action dans le Dossier de Jean Bosco).
        id: "demande-demo-1",
        proprietaire_id: "client-demo-1",
        proprietaire_email: "jean.bosco.demo@exemple.bi",
        proprietaire_nom: "Jean Bosco Ndayisenga",
        gestionnaire_id: "00000000-0000-4000-8000-000000000d01",
        gestionnaire_email: GESTIONNAIRE_DEMO_EMAIL,
        gestionnaire_nom: "Marc Dubois",
        gestionnaire_display_id: "CIM-000002",
        statut: "en_attente_admin",
        created_at: dans(-2),
        repondu_le: dans(-1),
        valide_par: null,
        valide_le: null,
        rattachement_id: null,
      },
      {
        // Adressée à Marc par le compte principal (Amina) : il peut
        // l'accepter ou la refuser dans son espace gestionnaire.
        id: "demande-demo-2",
        proprietaire_id: OWNER_ID,
        proprietaire_email: "demo@cizaimmo.com",
        proprietaire_nom: "Amina Niyonzima",
        gestionnaire_id: "00000000-0000-4000-8000-000000000d01",
        gestionnaire_email: GESTIONNAIRE_DEMO_EMAIL,
        gestionnaire_nom: "Marc Dubois",
        gestionnaire_display_id: "CIM-000002",
        statut: "en_attente_gestionnaire",
        created_at: dans(-1),
        repondu_le: null,
        valide_par: null,
        valide_le: null,
        rattachement_id: null,
      },
    ],
    // v1.3 : documents « compte » des personas hors compte principal.
    documentsComptes: [
      {
        id: "doc-compte-marc-id",
        owner_id: "00000000-0000-4000-8000-000000000d01",
        type: "piece_identite",
        entite_type: "compte",
        entite_id: "00000000-0000-4000-8000-000000000d01",
        nom_fichier: "piece-identite-marc-dubois.jpg",
        storage_path: "demo:piece-identite-marc",
        taille_octets: 88200,
        mime_type: "image/jpeg",
        ajoute_par: "00000000-0000-4000-8000-000000000d01",
        created_at: dans(-30),
        contenu: null,
        contenu_non_conserve: true,
      },
      {
        id: "doc-compte-marc-contrat",
        owner_id: "00000000-0000-4000-8000-000000000d01",
        type: "contrat",
        entite_type: "compte",
        entite_id: "00000000-0000-4000-8000-000000000d01",
        nom_fichier: "contrat-gestionnaire-CIM-000002-signe.pdf",
        storage_path: "demo:contrat-marc-signe",
        taille_octets: 121400,
        mime_type: "application/pdf",
        ajoute_par: "00000000-0000-4000-8000-000000000d01",
        created_at: dans(-28),
        contenu: null,
        contenu_non_conserve: true,
      },
      {
        id: "doc-compte-sira-id",
        owner_id: "client-demo-9",
        type: "piece_identite",
        entite_type: "compte",
        entite_id: "client-demo-9",
        nom_fichier: "piece-identite-sira-diallo.jpg",
        storage_path: "demo:piece-identite-sira",
        taille_octets: 91000,
        mime_type: "image/jpeg",
        ajoute_par: "client-demo-9",
        created_at: dans(-12),
        contenu: null,
        contenu_non_conserve: true,
      },
      {
        // Le contrat SIGNÉ de Sira — en attente de validation Admin.
        id: "doc-compte-sira-contrat",
        owner_id: "client-demo-9",
        type: "contrat",
        entite_type: "compte",
        entite_id: "client-demo-9",
        nom_fichier: "contrat-gestionnaire-CIM-000011-signe.pdf",
        storage_path: "demo:contrat-sira-signe",
        taille_octets: 118900,
        mime_type: "application/pdf",
        ajoute_par: "client-demo-9",
        created_at: dans(-1),
        contenu: null,
        contenu_non_conserve: true,
      },
    ],
  };

  const finance: FinanceDemo = {
    tarifs: TARIFS_SEED.map((t) => ({ ...t })),
    parametres: { ...PARAMETRES_FINANCE_DEFAUT },
  };

  return { profil, abonnement, immeubles, appartements, locataires, baux, echeances, paiements, depenses, documents, alertes: [], activites, taux, gestionnaires, preferences, factures: [], paiementsMobileMoney: [], coproprietaires, parcCizaGroup, plateforme, finance, compteurDisplayId: 12, conversations: [], messages: [], principalSupprime: false };
}

import type {
  Abonnement,
  AccesLocataire,
  Activite,
  Alerte,
  AnnonceAValider,
  AnnoncePublique,
  Appartement,
  AppartementInput,
  AppartementPatch,
  Avis,
  Bail,
  BailInput,
  CautionStatut,
  CompteAdmin,
  ComptePlateforme,
  ContexteRattachement,
  Coproprietaire,
  CoproprietaireInput,
  DeclarerPaiementInput,
  DemandeRattachement,
  Depense,
  DepenseInput,
  DepensePatch,
  DepensePlateforme,
  DepensePlateformeInput,
  Document,
  DocumentInput,
  DossierCompte,
  DossierEmploye,
  DossierEmployePatch,
  EcheanceLoyer,
  EntreeAudit,
  FactureAbonnement,
  ChecklistDossierSaisie,
  Conversation,
  MembreEquipe,
  MessageDirect,
  SuppressionEnAttente,
  FiltreAppartements,
  FiltreBaux,
  FiltreDepenses,
  FiltreDocuments,
  FiltreEcheances,
  FiltreRecus,
  GestionnaireInvite,
  Grille,
  Immeuble,
  ImmeubleInput,
  ImmeublePatch,
  LienLocataire,
  LimiteBlocs,
  Locataire,
  LocataireInput,
  LocatairePatch,
  ModeleAvis,
  MotifRefus,
  OperateurMobileMoney,
  PackEmploye,
  PaieEmploye,
  Paiement,
  PaiementMobileMoney,
  ParametresFinance,
  PhotoImmeubleInput,
  Plan,
  PreferencesNotifications,
  Profil,
  ProfilPatch,
  RattachementGestionnaire,
  Recu,
  SessionUser,
  SignUpInput,
  StatutAppartement,
  StatutWhatsApp,
  SupervisionGestionnaire,
  TarifPlateforme,
  TauxChange,
  TauxManuelInput,
  TauxResultat,
  TypeAlerte,
  Devise,
  VerificationEmploye,
  VueFinancesPlateforme,
} from "./types";
import type { ParametresContratEmploye } from "../pack-employe";

/**
 * CizaImmo — interface UNIQUE du fournisseur de données (Module 1).
 *
 * Toute lecture/écriture de données passe par cette interface, jamais
 * directement par le client Supabase dans les pages. Les modules suivants
 * ajoutent leurs méthodes ICI (même objet, même import) au lieu de créer
 * une seconde couche.
 *
 * Implémentations :
 *  - DemoProvider (lib/data/demo.ts) : localStorage, données fictives
 *    étiquetées DÉMO, utilisée quand Supabase n'est pas configuré.
 *  - RealProvider (lib/data/real.ts) : Supabase Auth + tables RLS.
 *
 * ---------------------------------------------------------------------------
 * MODULE 1 — couvert : authentification + profil + abonnement (lecture).
 * ---------------------------------------------------------------------------
 *  mode, getSession, signUp, signIn, signOut, resetPassword, updatePassword,
 *  getProfil, getAbonnement.
 *
 * ---------------------------------------------------------------------------
 * MODULE 2 — CRUD des entités (spec §6, §7, §8, §12).
 * ---------------------------------------------------------------------------
 * Les méthodes lèvent une Error dont le message est un CODE (pas un texte
 * affiché tel quel) ; les pages traduisent le code via crud.errors.<CODE>.
 * Codes possibles :
 *  ERR_NOT_FOUND — élément introuvable (ou d'un autre compte).
 *  ERR_LIMITE_BLOCS — plan dépassé : création/restauration bloquée AVANT
 *    l'enregistrement (spec §12) ; les blocs existants ne sont jamais touchés.
 *  ERR_IMMEUBLE_NOM_UNIQUE — nom d'immeuble déjà utilisé dans le compte.
 *  ERR_VALEUR_NON_POSITIVE — valeur du bien renseignée mais ≤ 0.
 *  ERR_APPARTEMENT_NUMERO_UNIQUE — numéro déjà utilisé dans l'immeuble.
 *  ERR_LOYER_NON_POSITIF — loyer par défaut ou loyer du bail ≤ 0.
 *  ERR_BAIL_CHEVAUCHEMENT — un bail actif chevauche les dates sur le même
 *    appartement (spec §8).
 *  ERR_BAIL_FIN_AVANT_DEBUT — date de fin antérieure ou égale au début.
 *  ERR_JOUR_EXIGIBILITE — jour d'exigibilité hors 1–28.
 *  ERR_APPARTEMENT_OCCUPE — appartement occupé (bail actif) : suppression
 *    ou changement de statut incohérent refusé ; archiver après la fin du bail.
 *  ERR_BAIL_EXISTANT — suppression refusée : des baux (même terminés)
 *    existent pour cet appartement ; archiver à la place.
 *  ERR_SANS_BAIL — passage à « occupé » sans bail actif.
 *  ERR_VITRINE_STATUT — seuls les appartements vacants ou réservés peuvent
 *    être publiés sur la vitrine.
 *  ERR_LOCATAIRE_BAIL_ACTIF — locataire avec un bail actif : suppression refusée.
 */
export interface DataProvider {
  /** "demo" si Supabase n'est pas configuré, "reel" sinon. */
  readonly mode: "demo" | "reel";

  /** Session courante (null si non connecté). */
  getSession(): Promise<SessionUser | null>;

  /**
   * Inscription. Crée le compte + le profil + l'abonnement d'essai
   * (plan Pro, 30 jours, sans carte — spec §12).
   * Retourne needsEmailConfirmation=true quand l'utilisateur doit valider
   * son e-mail avant de pouvoir se connecter (mode réel, confirmation
   * activée dans Supabase Auth). L'essai démarre à la validation de l'e-mail.
   */
  signUp(input: SignUpInput): Promise<{ needsEmailConfirmation: boolean }>;

  /** Connexion e-mail + mot de passe. Lève une erreur claire si échec. */
  signIn(email: string, motDePasse: string): Promise<void>;

  /** Déconnexion (session Supabase ou session démo). */
  signOut(): Promise<void>;

  /** Envoie l'e-mail de réinitialisation du mot de passe. */
  resetPassword(email: string): Promise<void>;

  /** Définit un nouveau mot de passe (après clic sur le lien de l'e-mail). */
  updatePassword(nouveauMotDePasse: string): Promise<void>;

  /** Profil de l'utilisateur connecté (null si non connecté). */
  getProfil(): Promise<Profil | null>;

  /** Abonnement (essai ou actif) de l'utilisateur connecté. */
  getAbonnement(): Promise<Abonnement | null>;

  // --- MODULE 2 : immeubles -------------------------------------------------
  /** Liste des immeubles du compte (actifs ; archives incluses si demandé). */
  listerImmeubles(inclureArchives?: boolean): Promise<Immeuble[]>;
  getImmeuble(id: string): Promise<Immeuble | null>;
  /** Vérifie la limite de blocs du plan AVANT l'enregistrement (spec §12). */
  creerImmeuble(input: ImmeubleInput): Promise<Immeuble>;
  modifierImmeuble(id: string, patch: ImmeublePatch): Promise<Immeuble>;
  /** Archivé = hors listes actives, historique consultable. */
  archiverImmeuble(id: string): Promise<Immeuble>;
  /** Restauration (bloquée si la limite de blocs du plan est atteinte). */
  desarchiverImmeuble(id: string): Promise<Immeuble>;

  // --- v1.7 : photos du bien + revue des immeubles de gestionnaire --------
  /**
   * Ajoute une photo au bien (bucket privé ; la première photo devient
   * la photo principale = photo du passeport). Garde d'écriture v1.4.
   */
  ajouterPhotoImmeuble(immeubleId: string, photo: PhotoImmeubleInput): Promise<Immeuble>;
  /** Retire la photo à l'index donné (la suivante devient principale). */
  retirerPhotoImmeuble(immeubleId: string, index: number): Promise<Immeuble>;
  /**
   * Décision plateforme sur un immeuble créé par un gestionnaire
   * (revue de l'autorisation de gestion) : valide, ou refuse avec un
   * motif obligatoire. Réservé Admin / Super Admin (RPC en réel).
   */
  deciderValidationImmeuble(
    immeubleId: string,
    accepter: boolean,
    motif?: string | null
  ): Promise<void>;

  // --- MODULE 2 : appartements ----------------------------------------------
  listerAppartements(
    filtre?: FiltreAppartements & { inclureArchives?: boolean }
  ): Promise<Appartement[]>;
  getAppartement(id: string): Promise<Appartement | null>;
  creerAppartement(input: AppartementInput): Promise<Appartement>;
  /** Création en lot (depuis la fiche immeuble) : tout ou rien. */
  creerAppartementsEnLot(
    immeubleId: string,
    items: Omit<AppartementInput, "immeuble_id">[]
  ): Promise<Appartement[]>;
  modifierAppartement(id: string, patch: AppartementPatch): Promise<Appartement>;
  changerStatutAppartement(
    id: string,
    statut: StatutAppartement
  ): Promise<Appartement>;
  /** Publier / retirer de la vitrine « à louer » (page publique : module 6). */
  basculerVitrine(id: string, vitrine: boolean): Promise<Appartement>;
  /** Archive après la fin du bail (un appartement occupé ne se supprime pas). */
  archiverAppartement(id: string): Promise<Appartement>;
  desarchiverAppartement(id: string): Promise<Appartement>;
  /** Suppression refusée si un bail (actif ou terminé) existe : archiver. */
  supprimerAppartement(id: string): Promise<void>;

  // --- MODULE 2 : locataires ------------------------------------------------
  listerLocataires(): Promise<Locataire[]>;
  getLocataire(id: string): Promise<Locataire | null>;
  creerLocataire(input: LocataireInput): Promise<Locataire>;
  modifierLocataire(id: string, patch: LocatairePatch): Promise<Locataire>;
  /** Suppression refusée si le locataire a un bail actif (spec §6). */
  supprimerLocataire(id: string): Promise<void>;
  /** Lien lecture seule : jeton unique, 30 jours, révocable (spec §14). */
  genererLienLocataire(id: string): Promise<LienLocataire>;
  revoquerLienLocataire(id: string): Promise<Locataire>;
  /**
   * Accès lecture seule par lien sécurisé (spec §2, §14 — correctif 1).
   * Sans connexion : retrouve le locataire par son jeton, vérifie que le
   * jeton n'est ni expiré ni révoqué, et retourne UNIQUEMENT ses données
   * (bail en cours, échéances, paiements, reçus). Jeton expiré, révoqué
   * ou inconnu -> null, sans aucune donnée.
   */
  getLocataireParToken(token: string): Promise<AccesLocataire | null>;

  // --- MODULE 2 : baux -------------------------------------------------------
  listerBaux(filtre?: FiltreBaux): Promise<Bail[]>;
  getBail(id: string): Promise<Bail | null>;
  /** Crée le bail et passe l'appartement en « occupé ». */
  creerBail(input: BailInput): Promise<Bail>;
  /** Clôture le bail ; l'appartement repasse « vacant » (spec §3 étape 9). */
  cloturerBail(id: string, cautionStatut?: CautionStatut): Promise<Bail>;

  // --- Lectures utiles aux fiches détail (modules 3/4 : écriture plus tard) --
  listerDepenses(filtre?: FiltreDepenses): Promise<Depense[]>;
  /**
   * Échéances. Accepte l'ancien appel listerEcheances(bailId) ou le filtre
   * objet { bailId, mois, immeubleId, statut } (module 3). Le statut
   * retourné est toujours RECALCULÉ (spec §9), jamais lu tel quel.
   */
  listerEcheances(
    bailIdOuFiltre?: string | FiltreEcheances
  ): Promise<EcheanceLoyer[]>;
  listerPaiements(echeanceId?: string): Promise<Paiement[]>;

  // --- MODULE 3 : loyers & paiements + reçus (spec §6, §9, §11) -----------
  // Nouveaux codes d'erreur (traduits via crud.errors.<CODE>) :
  //  ERR_MONTANT_NON_POSITIF — montant de paiement ≤ 0 (strictement positif).
  //  ERR_ECHEANCE_INTROUVABLE — échéance inconnue (ou d'un autre compte).
  //  ERR_PAIEMENT_INTROUVABLE — paiement inconnu (ou d'un autre compte).
  //  ERR_PAIEMENT_DEJA_ANNULE — annulation / correction d'un paiement déjà annulé.
  /**
   * Génère l'échéance du mois pour chaque bail actif couvrant ce mois.
   * IDEMPOTENTE : une échéance par bail et par mois, jamais de doublon,
   * même appelée deux fois (contrainte UNIQUE(bail_id, mois) en base).
   * Prorata premier / dernier mois au nombre de jours réels (spec §9).
   * Retourne TOUTES les échéances du mois (créées + déjà existantes).
   */
  genererEcheances(mois: string): Promise<EcheanceLoyer[]>;
  /**
   * Déclare un paiement (total ou partiel) sur une échéance et génère le
   * reçu numéroté (CIM-AAAA-000001, séquentiel, sans trou réutilisable).
   * Montant strictement positif ; la caution ne passe JAMAIS par ici.
   */
  declarerPaiement(
    input: DeclarerPaiementInput
  ): Promise<{ paiement: Paiement; recuNumero: string }>;
  /**
   * Annule un paiement : le paiement ET son reçu passent à « annulé »
   * (le numéro est conservé, marqué ANNULÉ). Trace : auteur, date, motif.
   */
  annulerPaiement(id: string, motif?: string): Promise<Paiement>;
  /**
   * Corrige une déclaration : annule l'ancien paiement (avec trace) puis
   * déclare le nouveau, qui produit un NOUVEAU numéro de reçu. Un reçu
   * émis ne se modifie jamais (spec §6, §11).
   */
  corrigerPaiement(
    id: string,
    input: Omit<DeclarerPaiementInput, "echeance_id">
  ): Promise<{ paiement: Paiement; recuNumero: string }>;
  /** Reçus émis, du plus récent au plus ancien (recherche par numéro / nom). */
  listerRecus(filtre?: FiltreRecus): Promise<Recu[]>;
  /** Prochain numéro de reçu disponible (CIM-AAAA-000001, année en cours). */
  prochainNumeroRecu(): Promise<string>;

  // --- MODULE 4 : dépenses (CRUD complet, spec §6) -------------------------
  // Nouveaux codes : ERR_MONTANT_NON_POSITIF (montant ≤ 0),
  // ERR_CATEGORIE_MANQUANTE (catégorie obligatoire pour un ROI fiable).
  creerDepense(input: DepenseInput): Promise<Depense>;
  modifierDepense(id: string, patch: DepensePatch): Promise<Depense>;
  supprimerDepense(id: string): Promise<void>;

  // --- MODULE 4 : documents (spec §6, §14 : stockage privé) ---------------
  // Nouveaux codes : ERR_DOCUMENT_FORMAT (PDF/JPG/PNG uniquement),
  // ERR_DOCUMENT_TROP_GROS (> 10 Mo), ERR_DOCUMENT_DOUBLON (même nom +
  // même entité), ERR_BUCKET_MANQUANT (bucket Storage non créé — réel).
  listerDocuments(filtre?: FiltreDocuments): Promise<Document[]>;
  televerserDocument(input: DocumentInput): Promise<Document>;
  renommerDocument(id: string, nomFichier: string): Promise<Document>;
  supprimerDocument(id: string): Promise<void>;
  /** Lien de téléchargement : signé temporaire (réel) ou contenu démo. */
  telechargerDocument(id: string): Promise<{ url: string; nomFichier: string }>;

  // --- MODULE 4 : fil d'actualité (lecture seule, spec §6 suite) -----------
  listerActivites(immeubleId?: string | null): Promise<Activite[]>;

  // --- MODULE 4 : taux de change (spec §9) ----------------------------------
  // getTaux : null si aucun taux ne permet la conversion — jamais inventé.
  getTaux(deviseSource: Devise, deviseCible: Devise): Promise<TauxResultat | null>;
  listerTaux(): Promise<TauxChange[]>;
  /** Taux manuel de secours, daté et signalé comme manuel partout. */
  saisirTauxManuel(input: TauxManuelInput): Promise<TauxChange>;

  // --- MODULE 4 : alertes (spec §10, idempotentes) --------------------------
  /** Génère les alertes du moment (idempotent) puis retourne les actives. */
  genererAlertes(): Promise<Alerte[]>;
  listerAlertes(): Promise<Alerte[]>;
  /** Une alerte ne se supprime pas : elle se clôture. */
  marquerAlerteTraitee(id: string): Promise<Alerte>;

  // --- MODULE 4 : paramètres (spec §6) --------------------------------------
  modifierProfil(patch: ProfilPatch): Promise<Profil>;
  getPreferencesNotifications(): Promise<PreferencesNotifications>;
  sauvegarderPreferencesNotifications(
    prefs: Partial<Omit<PreferencesNotifications, "owner_id" | "updated_at">>
  ): Promise<PreferencesNotifications>;
  /** Gestionnaires invités ; retirer = perte d'accès immédiate (spec §14). */
  listerGestionnaires(): Promise<GestionnaireInvite[]>;
  inviterGestionnaire(email: string, immeubleIds: string[]): Promise<GestionnaireInvite>;
  retirerGestionnaire(id: string): Promise<void>;

  // --- MODULE 6 : indivision familiale (spec §6 suite, §2, §13) -----------
  // Nouveaux codes d'erreur (traduits via crud.errors.<CODE>) :
  //  ERR_PARTS_TOTAL — la somme des parts ne fait pas exactement 100 %.
  //  ERR_PART_EMAIL_UNIQUE — une part existe déjà pour cet e-mail et cet immeuble.
  //  ERR_PART_INVALIDE — part absente, ≤ 0 ou > 100.
  //  ERR_ROLE_LECTURE_SEULE — un compte co-propriétaire (lecture seule)
  //    a tenté une mutation : refusée, sans rien modifier.
  //  ERR_INDIVISION_PLAN — l'indivision exige le plan Pro ou Agence
  //    (Starter : lecture de la page avec l'indication du plan requis).
  //  ERR_COPROPRIETAIRE_INTROUVABLE — co-propriétaire inconnu (ou d'un autre compte).
  //
  // RÈGLE DURE : CizaImmo calcule et affiche la répartition, mais
  // n'encaisse ni ne distribue AUCUN argent entre co-propriétaires.
  /** Co-propriétaires d'un immeuble (parts en %, somme = 100 %). */
  listerCoproprietaires(immeubleId: string): Promise<Coproprietaire[]>;
  /**
   * Invite un co-propriétaire (un par un). La somme des parts après ajout
   * ne doit pas dépasser 100 % (ERR_PARTS_TOTAL) ; une part par e-mail
   * et par immeuble (ERR_PART_EMAIL_UNIQUE). La répartition n'est
   * affichée que quand la somme fait exactement 100 %.
   */
  inviterCoproprietaire(
    immeubleId: string,
    input: CoproprietaireInput
  ): Promise<Coproprietaire>;
  /**
   * Définit l'ensemble complet des parts d'un immeuble (remplacement) :
   * la somme doit faire exactement 100 % (ERR_PARTS_TOTAL sinon).
   * Chaque modification de part est tracée (auteur, date, ancienne et
   * nouvelle valeur) et visible dans le fil d'actualité du bien.
   */
  definirParts(
    immeubleId: string,
    parts: CoproprietaireInput[]
  ): Promise<Coproprietaire[]>;
  /** Retire un co-propriétaire (révoque son accès immédiatement). */
  retirerCoproprietaire(id: string): Promise<void>;
  /**
   * Acceptation de l'invitation : le compte du co-propriétaire (existant
   * ou créé avec cet e-mail) est rattaché aux biens partagés, en lecture
   * seule. Appelée par le propriétaire ou par le co-propriétaire lui-même.
   */
  accepterInvitationCoproprietaire(id: string): Promise<Coproprietaire>;

  // --- MODULE 6 : vitrine publique « à louer » (spec §4, §6) ---------------
  /**
   * Annonces publiques (sans connexion) : appartements publiés, vacants
   * ou réservés uniquement. AUCUNE coordonnée de locataire n'est jamais
   * exposée — seul le contact du propriétaire / gestionnaire.
   */
  listerAnnoncesPubliques(): Promise<AnnoncePublique[]>;
  getAnnoncePublique(appartementId: string): Promise<AnnoncePublique | null>;
  // --- v1.6 « Vitrine vérifiée » : modération des annonces publiques ----
  // RÈGLE : aucune annonce ne devient publique sans approbation d'un
  // Admin — la demande fait passer l'appartement en « en_attente » et
  // seule la validation Admin (validerPublicationVitrine) le fait
  // passer en « approuve », seul statut affiché par
  // listerAnnoncesPubliques. Toute annonce affichée porte le badge
  // « ✓ Vérifié ». Les transitions sont décidées DANS LA BASE (RPC) :
  // le fournisseur ne fait que les appeler et relire l'appartement.
  /**
   * Demande la publication d'un appartement sur la vitrine : passe
   * vitrine_statut en « en_attente » (file de validation Admin).
   * Si le contact annoncé (contact_telephone / contact_email) diffère
   * du contact du dossier, une justification (contact_justification)
   * est obligatoire — exigée par la base à la demande.
   */
  demanderPublicationVitrine(appartementId: string): Promise<Appartement>;
  /**
   * Retire un appartement de la vitrine (ou annule sa demande en
   * attente) : vitrine_statut repasse en « non_publie ».
   */
  retirerPublicationVitrine(appartementId: string): Promise<Appartement>;
  /**
   * File de validation console : annonces « en_attente », avec le
   * contact annoncé comparé au contact ATTENDU du dossier (gestionnaire
   * rattaché actif de l'immeuble, sinon propriétaire) — `divergent`
   * signale un téléphone ou un e-mail annoncé différent du dossier.
   * Plateforme uniquement.
   */
  listerVitrineAValider(): Promise<AnnonceAValider[]>;
  /**
   * Décision Admin sur une annonce en attente : accepter → « approuve »
   * (l'annonce devient publique, avec le badge « ✓ Vérifié ») ;
   * refuser → « refuse », avec un motif (vitrine_motif_refus).
   * Plateforme uniquement.
   */
  validerPublicationVitrine(
    appartementId: string,
    accepter: boolean,
    motif?: string | null
  ): Promise<Appartement>;

  // --- MODULE 6 : taux automatiques (spec §9) -------------------------------
  /**
   * Enregistre des taux automatiques récupérés (source « auto », datés).
   * Les lignes déjà présentes pour la même paire et la même date ne sont
   * pas dupliquées. Le taux manuel de secours (module 4) prime quand il
   * est renseigné : voir trouverTaux().
   */
  enregistrerTauxAuto(
    taux: Omit<TauxChange, "id" | "created_at">[]
  ): Promise<TauxChange[]>;

  // --- MODULE 6 : WhatsApp (spec §10) ----------------------------------------
  /** Met à jour le statut WhatsApp d'une alerte (envoyé / échec / non configuré). */
  marquerAlerteWhatsApp(id: string, statut: StatutWhatsApp): Promise<Alerte>;

  // --- MODULE 5 : abonnement & facturation (spec §12) -----------------------
  // Nouveaux codes d'erreur (traduits via crud.errors.<CODE>) :
  //  ERR_ABONNEMENT_REQUIS — compte en lecture seule (fin d'essai, grâce
  //    dépassée, abonnement annulé) : toute NOUVELLE saisie est refusée,
  //    la lecture et les exports restent possibles.
  //  ERR_DESCENTE_BLOQUEE — descente refusée : le parc dépasse la limite
  //    de blocs du plan inférieur (réduire le parc d'abord).
  //  ERR_PLAN_INVALIDE — plan inconnu.
  //  ERR_MM_TELEPHONE_INVALIDE — numéro mobile money non plausible.
  //  ERR_MM_INTROUVABLE — référence de paiement mobile money inconnue.
  //  ERR_MM_EXPIRE — paiement mobile money non confirmé sous 24 h :
  //    annulé, sans frais.
  //  ERR_MM_DEJA_TRAITE — paiement déjà confirmé / annulé / expiré.
  //  ERR_MM_CONFIRMATION_WEBHOOK — en mode réel, seul le webhook du
  //    fournisseur / agrégateur peut confirmer un paiement mobile money.
  //
  // Garde-fou lecture seule : en mode lecture seule, TOUTES les mutations
  // du parc (immeubles, appartements, locataires, baux, loyers, dépenses,
  // documents, taux, gestionnaires) lèvent ERR_ABONNEMENT_REQUIS dans les
  // deux fournisseurs — le blocage est dans la couche données, pas
  // seulement dans l'interface. Restent autorisés : la lecture, les
  // exports, le profil, les préférences, la clôture d'alertes et les
  // actions d'abonnement elles-mêmes (changer de plan, payer, annuler).
  /** Blocs utilisés / autorisés par le plan en cours. */
  getLimiteBlocs(): Promise<LimiteBlocs>;
  /**
   * Changement de plan. Montée immédiate (nouvelle période d'1 mois,
   * facture émise) ; descente effective à la fin de la période payée,
   * avec contrôle préalable de la limite de blocs (ERR_DESCENTE_BLOQUEE
   * si le parc dépasse la limite du plan inférieur). Même plan =
   * renouvellement / reprise après résiliation programmée.
   */
  changerPlan(plan: Plan): Promise<Abonnement>;
  /**
   * v1.4 : pack choisi PENDANT l'essai pour la fin de l'essai
   * (abonnements.plan_apres_essai ; défaut Starter). Simple préférence
   * enregistrée — aucun paiement à ce stade ; l'essai reste Starter.
   * Hors essai, le choix est sans effet (utiliser changerPlan).
   */
  definirPlanApresEssai(plan: Plan): Promise<Abonnement>;
  /**
   * Annulation possible à tout moment, effective en fin de période ;
   * données conservées 90 jours en lecture seule ensuite (spec §12).
   */
  annulerAbonnement(): Promise<Abonnement>;
  /** Historique des factures d'abonnement, de la plus récente à la plus ancienne. */
  listerFactures(): Promise<FactureAbonnement[]>;
  /**
   * Échec de paiement (appelé par le webhook Stripe en réel, ou simulé
   * en démo) : alerte immédiate, période de grâce de 7 jours en
   * fonctionnement normal, puis lecture seule (spec §12).
   */
  signalerEchecPaiement(): Promise<Abonnement>;
  // --- MODULE 5 : mobile money (EcoCash, Lumicash, eNoti — spec §12) -------
  /**
   * Envoie la demande de paiement sur le numéro du propriétaire (montant
   * = prix mensuel du plan demandé, ou du plan en cours). L'abonnement
   * ne s'active qu'APRÈS confirmation reçue. `plan` optionnel : plan
   * visé (défaut : plan en cours).
   */
  demanderPaiementMobileMoney(
    operateur: OperateurMobileMoney,
    telephone: string,
    plan?: Plan
  ): Promise<PaiementMobileMoney>;
  /**
   * Confirmation reçue (démo : bouton « Simuler la confirmation » ;
   * réel : UNIQUEMENT via le webhook /api/mobile-money/webhook).
   * Active l'abonnement (plan, période d'1 mois) et émet la facture.
   */
  confirmerPaiementMobileMoney(reference: string): Promise<PaiementMobileMoney>;
  /** Paiements mobile money, expirations de 24 h appliquées à la lecture. */
  listerPaiementsMobileMoney(): Promise<PaiementMobileMoney[]>;

  // ==========================================================================
  // EXTENSION v1.2 — Console plateforme, approbation, finances dynamiques.
  // Voir docs/admin-finance-v1.2.md. Les méthodes « plateforme » exigent
  // une session Admin / Super Admin (garde dans chaque fournisseur) ;
  // les lectures tarifs/paramètres sont PUBLIQUES (front public).
  // ==========================================================================

  /** Tous les comptes clients (vue console, retards calculés). */
  listerComptesPlateforme(): Promise<ComptePlateforme[]>;
  /** Suspend un compte (accès bloqué, données conservées) — journalisé. */
  suspendreCompte(compteId: string): Promise<void>;
  /** Réactive un compte suspendu (statut antérieur restauré) — journalisé. */
  reactiverCompte(compteId: string): Promise<void>;
  /** Suppression DÉFINITIVE — Super Admin uniquement, journalisée. */
  supprimerCompteDefinitivement(compteId: string): Promise<void>;
  /**
   * Approuve un compte « en_attente » : la grille affichée est confirmée,
   * l'essai démarre à l'approbation (jours_essai dynamiques), e-mail de
   * bienvenue, journalisé.
   */
  approuverCompte(compteId: string): Promise<void>;
  /** Refuse un compte « en_attente » (motif prédéfini) : e-mail + journal. */
  refuserCompte(compteId: string, motif: MotifRefus): Promise<void>;
  /**
   * Consigne l'état de la checklist de vérification d'un dossier
   * « en_attente » (photo, pièce d'identité, informations, alerte
   * anti-fraude) — Admin / Super Admin. L'approbation exige la
   * checklist complète : garde dans la base (approuver_compte) et
   * bouton grisé dans la console tant qu'elle est incomplète.
   */
  enregistrerChecklistDossier(
    compteId: string,
    saisie: ChecklistDossierSaisie
  ): Promise<void>;
  /** Réattribue la grille d'un compte (Admin / Super Admin) — journalisé. */
  reattribuerGrille(compteId: string, grille: Grille): Promise<void>;
  /** Envoie un avis par MODÈLE prédéfini (jamais de texte libre) — journalisé. */
  envoyerAvis(compteId: string, modele: ModeleAvis): Promise<Avis>;

  /** Comptes Admin / Super Admin (gestion : Super Admin uniquement). */
  listerAdmins(): Promise<CompteAdmin[]>;
  /**
   * Crée un compte Admin. En réel : les comptes Auth ne se créent pas
   * côté client — lève ERR_PROMOTION_REQUISE (l'employé s'inscrit puis
   * est promu). En démo : crée l'entrée du registre.
   */
  creerAdmin(email: string, nom: string): Promise<CompteAdmin>;
  /** Promeut un compte existant (inscrit) au rôle Admin — Super Admin. */
  promouvoirAdmin(email: string): Promise<CompteAdmin>;
  suspendreAdmin(adminId: string): Promise<void>;
  reactiverAdmin(adminId: string): Promise<void>;
  /** Retire le rôle Admin (le compte redevient un compte ordinaire). */
  retirerAdmin(adminId: string): Promise<void>;

  /** Journal d'audit plateforme (lecture, Admin / Super Admin). */
  listerJournalAudit(): Promise<EntreeAudit[]>;

  /** Rattachements gestionnaires (console). */
  listerRattachements(): Promise<RattachementGestionnaire[]>;
  creerRattachement(input: {
    gestionnaire_email: string;
    gestionnaire_nom?: string | null;
    contexte: ContexteRattachement;
    proprietaire_id?: string | null;
    immeuble_ids: string[];
  }): Promise<RattachementGestionnaire>;
  retirerRattachement(id: string): Promise<void>;
  /** Rattachements du gestionnaire connecté (sélecteur de contexte). */
  listerMesRattachements(): Promise<RattachementGestionnaire[]>;
  getContexteActif(): Promise<RattachementGestionnaire | null>;
  definirContexteActif(rattachementId: string): Promise<RattachementGestionnaire>;
  /** Ouvre la supervision d'un gestionnaire rattaché — JOURNALISÉ. */
  ouvrirSupervision(rattachementId: string): Promise<SupervisionGestionnaire>;

  /** Tarifs DYNAMIQUES (lecture publique) : source = table/base, jamais en dur. */
  getTarifsPlateforme(): Promise<TarifPlateforme[]>;
  /** Paramètres finance (lecture publique ; écriture Super Admin). */
  getParametresFinance(): Promise<ParametresFinance>;
  /** Met à jour tarifs + paramètres — Super Admin uniquement, journalisé. */
  mettreAJourTarifs(
    tarifs: TarifPlateforme[],
    parametres: ParametresFinance
  ): Promise<void>;

  // ==========================================================================
  // EXTENSION v1.3 — Parcours d'inscription et dossiers vérifiés.
  // Voir docs/parcours-inscription-v1.3.md. Display ID « CIM-000001 »,
  // dossier (photo + pièce d'identité), contrat gestionnaire, et
  // rattachement par Display ID à TRIPLE validation (propriétaire →
  // gestionnaire → Admin).
  // ==========================================================================

  /**
   * Soumet un document du DOSSIER du compte connecté (entite_type
   * « compte ») : pièce d'identité ou contrat signé. N'exige pas un
   * abonnement actif — le dossier se complète pendant l'attente
   * d'approbation. Le titulaire seul (et la plateforme) peut le lire.
   */
  soumettreDocumentCompte(
    type: "piece_identite" | "contrat",
    input: DocumentInput
  ): Promise<Document>;
  /**
   * Téléverse la photo de profil du dossier (bucket privé) et pose
   * profils.photo_profil_path. Retourne le chemin Storage.
   */
  televerserPhotoProfil(input: DocumentInput): Promise<string>;
  /** Page DOSSIER console d'un compte (plateforme uniquement). */
  listerDossier(compteId: string): Promise<DossierCompte>;

  // ==========================================================================
  // DOSSIER EMPLOYÉ DES ADMINS (2026-11-08, décision du fondateur) :
  // identité + ADRESSE, comme le dossier d'un client, en plus complet.
  // Voir docs/dossier-employe-admin-2026-11-08.md. Accès réservé aux
  // rôles admin / super_admin (un client : ERR_ACCES_PLATEFORME).
  // Exigence suivie, NON bloquante : aucune méthode console n'est
  // conditionnée à la complétude du dossier.
  // ==========================================================================

  /**
   * Le dossier employé du compte plateforme CONNECTÉ (admin ou
   * super_admin) : éléments présents + complétude calculée.
   */
  getMonDossierEmploye(): Promise<DossierEmploye>;
  /**
   * Met à jour les champs texte de SON dossier employé (téléphone +
   * adresse postale). Retourne le dossier réévalué.
   */
  mettreAJourDossierEmploye(patch: DossierEmployePatch): Promise<DossierEmploye>;
  /**
   * Téléverse SA photo de profil (bucket privé, patron du dossier
   * client) dans le cadre du dossier employé. Retourne le dossier
   * réévalué.
   */
  televerserPhotoDossierEmploye(input: DocumentInput): Promise<DossierEmploye>;
  /**
   * Dépose SA pièce d'identité (bucket privé, entite « compte », type
   * « piece_identite » — même patron que le dossier client). Retourne
   * le dossier réévalué.
   */
  televerserPieceDossierEmploye(input: DocumentInput): Promise<DossierEmploye>;
  /**
   * SUPER ADMIN : le dossier employé DÉTAILLÉ d'un membre de l'équipe
   * (documents avec liens signés, adresse) — page Équipe.
   */
  listerDossierEmploye(adminId: string): Promise<DossierEmploye>;

  // ==========================================================================
  // PACK EMPLOYÉ DES ADMINS (2026-11-08, pack VALIDÉ par le fondateur) :
  // contrat d'engagement à deux voies + charte de confidentialité
  // datée + carte employé à code-barres vérifiée contre la base.
  // Voir docs/pack-employe-2026-11-08.md et
  // supabase/module-pack-employe.sql. NON BLOQUANT : aucun état ne
  // conditionne l'accès console. Nouveaux codes d'erreur :
  //  ERR_PARAMETRES_CONTRAT — champs employeur incomplets/invalides.
  //  ERR_STATUT_INVALIDE — transition impossible dans l'état courant
  //    (patron des contrats clients).
  // ==========================================================================

  /**
   * Le pack employé du compte plateforme CONNECTÉ (dossier + charte
   * + contrat + carte + progression calculée).
   */
  getMonPackEmploye(): Promise<PackEmploye>;
  /**
   * SUPER ADMIN : le pack employé complet d'un membre de l'équipe
   * (page Équipe : préparation, revue du contrat signé).
   */
  getPackEmploye(adminId: string): Promise<PackEmploye>;
  /**
   * Accepte la charte de confidentialité (première connexion
   * console) : l'acceptation est DATÉE et conservée en base —
   * idempotente, la première date posée n'est jamais réécrite.
   * Journalisé.
   */
  accepterCharteEmploye(): Promise<PackEmploye>;
  /**
   * SUPER ADMIN : prépare (ou re-prépare) le contrat d'engagement
   * d'un membre — fixe la voie et les champs employeur EN BASE,
   * génère le PDF personnalisé (données pré-remplies depuis le
   * dossier employé) et l'envoie par e-mail à l'employé → statut
   * « a_signer ». Refusé si un contrat signé est en revue ou déjà
   * validé (ERR_STATUT_INVALIDE). Journalisé.
   */
  preparerContratEmploye(
    adminId: string,
    parametres: ParametresContratEmploye
  ): Promise<PackEmploye>;
  /**
   * Génère le PDF du contrat d'engagement d'un membre à partir des
   * paramètres stockés en base — le membre lui-même ou le Super
   * Admin. ERR_STATUT_INVALIDE si le contrat n'est pas préparé.
   */
  genererContratEmploye(
    adminId: string
  ): Promise<{ nomFichier: string; contenuBase64: string }>;
  /**
   * TALON DE PAIE (2026-11-08) : génère le PDF du talon d'une paie
   * émise, à la demande, depuis les instantanés de la paie (montant,
   * destination…) — rien n'est stocké. Accès : le Super Admin
   * (toutes les paies) ou l'employé pour SES PROPRES paies ; la paie
   * d'un autre employé (ou une paie inexistante) répond
   * ERR_TALON_INTROUVABLE, sans fuite d'existence. Langue : celle du
   * compte de l'EMPLOYÉ (patron du contrat employé).
   */
  genererTalonPaie(
    paieId: string
  ): Promise<{ nomFichier: string; contenuBase64: string }>;
  /**
   * L'employé téléverse son contrat d'engagement SIGNÉ (PDF ou
   * photo) → statut « signe_depose », en attente de revue Super
   * Admin. Redépôt possible après un refus (le motif est effacé).
   */
  televerserContratEmployeSigne(input: DocumentInput): Promise<Document>;
  /**
   * SUPER ADMIN : valide le contrat d'engagement signé → « valide »,
   * e-mail de confirmation à l'employé. Journalisé.
   */
  validerContratEmploye(adminId: string): Promise<void>;
  /**
   * SUPER ADMIN : refuse le contrat d'engagement signé → « refuse »
   * + motif (obligatoire, ERR_MOTIF_REQUIS), e-mail à l'employé.
   * Journalisé.
   */
  refuserContratEmploye(adminId: string, motif: string): Promise<void>;
  /**
   * Vérification d'un employé CONTRE LA BASE par son Display ID
   * (celui du code-barres de la carte) — plateforme uniquement.
   * Retourne null si aucun compte plateforme ne porte ce Display ID.
   */
  verifierEmploye(displayId: string): Promise<VerificationEmploye | null>;

  // ==========================================================================
  // FINANCES DE LA PLATEFORME (2026-11-08, décision VALIDÉE par le
  // fondateur) : paie des employés émise DEPUIS le dossier employé +
  // dépenses de fonctionnement SUPERVISÉES. Voir
  // docs/finances-paie-depenses-2026-11-08.md,
  // supabase/module-finances-plateforme.sql et
  // lib/finances-plateforme.ts. Nouveaux codes d'erreur :
  //  ERR_DOSSIER_INCOMPLET — paie refusée, dossier employé incomplet.
  //  ERR_PAIE_SANS_CONTRAT — aucun contrat préparé / sans montant.
  //  ERR_COORDONNEES_PAIEMENT_MANQUANTES — paie refusée, l'employé
  //    n'a pas renseigné ses coordonnées de paiement (ajout 2026-11-08,
  //    supabase/module-coordonnees-paiement.sql).
  //  ERR_PAIE_DEJA_EMISE — une paie existe déjà pour ce mois.
  //  ERR_DEPENSE_INVALIDE — saisie de dépense incomplète/invalide.
  // ==========================================================================

  /**
   * Vue Finances d'un mois (« AAAA-MM ») : lignes de paie des membres
   * plateforme, dépenses du mois, historique des paies et totaux par
   * devise. Super Admin : tout. Admin : SA ligne, SES dépenses, SON
   * historique (la validation lui est refusée partout).
   */
  getVueFinancesPlateforme(mois: string): Promise<VueFinancesPlateforme>;
  /**
   * SUPER ADMIN : émet la paie d'un employé pour un mois — montant,
   * devise et modalités COPIÉS de son contrat d'engagement en base.
   * Gardes, DANS CET ORDRE : dossier employé incomplet
   * (ERR_DOSSIER_INCOMPLET), aucun contrat avec montant préparé
   * (ERR_PAIE_SANS_CONTRAT), coordonnées de paiement de l'employé
   * absentes (ERR_COORDONNEES_PAIEMENT_MANQUANTES, ajout 2026-11-08),
   * paie déjà émise ce mois (ERR_PAIE_DEJA_EMISE, doublé par la
   * contrainte base). À l'émission, la paie FIGE le moyen + la
   * destination des coordonnées de l'employé (instantané).
   * Journalisé.
   */
  emettrePaieEmploye(
    profilId: string,
    mois: string,
    reference?: string | null
  ): Promise<PaieEmploye>;
  /**
   * PLATEFORME (Admin ou Super Admin) : saisit une dépense de
   * fonctionnement — statut « en_attente », justificatif optionnel
   * dans le bucket privé. Journalisé.
   */
  saisirDepensePlateforme(
    input: DepensePlateformeInput
  ): Promise<DepensePlateforme>;
  /**
   * SUPER ADMIN : valide une dépense en attente -> « validee ».
   * Un Admin est refusé même pour ses propres dépenses
   * (ERR_SUPER_ADMIN_REQUIS ; la RLS réserve aussi la mise à jour au
   * Super Admin en réel). Journalisé.
   */
  validerDepensePlateforme(depenseId: string): Promise<DepensePlateforme>;
  /**
   * SUPER ADMIN : refuse une dépense en attente -> « refusee »,
   * motif OBLIGATOIRE (ERR_MOTIF_REQUIS). Journalisé.
   */
  refuserDepensePlateforme(
    depenseId: string,
    motif: string
  ): Promise<DepensePlateforme>;
  /**
   * Les paies émises du compte plateforme CONNECTÉ (section « Ma
   * paie » de son dossier employé) — lecture seule, ses données
   * uniquement. Un client : ERR_ACCES_PLATEFORME.
   */
  listerMesPaies(): Promise<PaieEmploye[]>;
  /**
   * Recherche publique minimale par Display ID (propriétaire) : retourne
   * UNIQUEMENT le nom + le Display ID du compte gestionnaire trouvé —
   * jamais d'e-mail, de téléphone ou d'autre donnée.
   */
  rechercherCompteParDisplayId(
    displayId: string
  ): Promise<{ nom: string; display_id: string } | null>;
  /**
   * Le propriétaire demande le rattachement au gestionnaire désigné par
   * son Display ID → demande « en_attente_gestionnaire ».
   */
  demanderRattachementParDisplayId(displayId: string): Promise<DemandeRattachement>;
  /**
   * Demandes de rattachement visibles par l'acteur : le propriétaire
   * voit les siennes, le gestionnaire celles qui lui sont adressées,
   * la plateforme toutes (file de validation Admin incluse).
   */
  listerDemandesRattachement(): Promise<DemandeRattachement[]>;
  /**
   * Le gestionnaire accepte (exige statut_contrat « valide », sinon
   * ERR_CONTRAT_NON_VALIDE) → « en_attente_admin » ; ou refuse.
   */
  repondreDemandeRattachement(demandeId: string, accepter: boolean): Promise<DemandeRattachement>;
  /**
   * L'Admin valide une demande acceptée : crée le rattachement
   * (contexte « proprietaire », immeuble_ids VIDE — l'assignation reste
   * le geste du propriétaire) ; ou refuse la demande. Journalisé.
   */
  validerRattachementAdmin(demandeId: string, accepter: boolean): Promise<DemandeRattachement>;
  /**
   * Le propriétaire assigne ses immeubles à un rattachement ACTIF
   * (mécanisme existant : immeuble_ids du rattachement).
   */
  assignerImmeublesRattachement(
    rattachementId: string,
    immeubleIds: string[]
  ): Promise<RattachementGestionnaire>;
  /**
   * Génère le contrat de collaboration d'un compte gestionnaire (PDF,
   * langue du compte) — plateforme, ou le gestionnaire pour SON propre
   * contrat. Retourne le nom de fichier + le contenu base64.
   */
  genererContratGestionnaire(
    compteId: string
  ): Promise<{ nomFichier: string; contenuBase64: string }>;
  /** État du contrat du compte CONNECTÉ (page « Mon contrat »). */
  getMonContrat(): Promise<{
    statut: import("./types").StatutContrat;
    display_id: string | null;
    nomFichier: string;
    contenuBase64: string | null;
  }>;
  /**
   * Le gestionnaire téléverse son contrat SIGNÉ (PDF ou photo) →
   * statut_contrat « signe_recu », en attente de validation Admin.
   */
  televerserContratSigne(input: DocumentInput): Promise<Document>;
  /**
   * L'Admin valide le contrat signé d'un gestionnaire → statut_contrat
   * « valide », fonctions débloquées, e-mail d'activation. Journalisé.
   */
  validerContrat(compteId: string): Promise<void>;

  // ==========================================================================
  // OPTION C (2026-11-08) — Contrat de service PROPRIÉTAIRE non
  // bloquant. Déclinaison du flux gestionnaire ci-dessus : le contrat
  // est joint à l'e-mail de bienvenue à l'approbation, l'accès et
  // l'essai démarrent immédiatement, le propriétaire redépose le
  // signé depuis son espace, l'Admin valide ou refuse (avec motif).
  // AUCUN état de ce cycle ne conditionne une écriture.
  // ==========================================================================

  /**
   * Génère le contrat de service d'un compte PROPRIÉTAIRE (PDF,
   * langue du compte) — plateforme, ou le propriétaire pour SON
   * propre contrat. Retourne le nom de fichier + le contenu base64.
   */
  genererContratProprietaire(
    compteId: string
  ): Promise<{ nomFichier: string; contenuBase64: string }>;
  /** État du contrat propriétaire du compte CONNECTÉ (page « Mon contrat »). */
  getMonContratProprietaire(): Promise<{
    statut: import("./types").StatutContratProprietaire;
    motif: string | null;
    display_id: string | null;
    nomFichier: string;
    contenuBase64: string | null;
  }>;
  /**
   * Le propriétaire téléverse son contrat SIGNÉ (PDF ou photo) →
   * statut_contrat_proprietaire « signe_depose », en attente de revue
   * Admin. Redépôt possible après un refus (le motif est effacé).
   */
  televerserContratProprietaireSigne(input: DocumentInput): Promise<Document>;
  /**
   * L'Admin valide le contrat propriétaire signé → « valide »,
   * e-mail de confirmation. Journalisé.
   */
  validerContratProprietaire(compteId: string): Promise<void>;
  /**
   * L'Admin refuse le contrat propriétaire signé → « refuse » +
   * motif (obligatoire), e-mail au propriétaire. Journalisé.
   */
  refuserContratProprietaire(compteId: string, motif: string): Promise<void>;

  // ==========================================================================
  // EXTENSION v1.5 — Suppression de compte par le client, messagerie
  // directe supervisée, assignation des dossiers, page Équipe, espace
  // « Mes dossiers ». Voir docs/messagerie-suppression-v15.md.
  // Nouveaux codes d'erreur :
  //  ERR_SUPPRESSION_DEJA_DEMANDEE — une demande est déjà en cours.
  //  ERR_AUCUNE_SUPPRESSION — annulation sans demande en cours.
  //  ERR_DELAI_NON_ECOULE — exécution avant les 30 jours (refus BASE).
  //  ERR_SUPER_ADMIN_REQUIS — action réservée au Super Admin.
  //  ERR_ADMIN_INTROUVABLE — assignation vers un compte non Admin.
  //  ERR_MESSAGE_VIDE — corps de message vide.
  //  ERR_CONVERSATION_INTROUVABLE — fil inconnu ou non visible par l'acteur.
  //  ERR_SUPERVISION_LECTURE_SEULE — la plateforme ne peut PAS écrire
  //    dans un fil propriétaire ↔ gestionnaire (refus base en réel).
  //  ERR_MOT_DE_PASSE_INCORRECT — renfort fondateur (2026-11-07) :
  //    la demande de suppression exige la confirmation du mot de
  //    passe du compte, vérifié AVANT l'appel à la RPC ; un mot de
  //    passe faux ne change RIEN (aucune demande posée).
  // ==========================================================================

  // --- Suppression de compte par le client (la base pilote) ---------------
  /**
   * Le client demande la suppression de SON compte : la base pose la
   * demande, conserve un instantané complet de l'abonnement et passe
   * le compte en LECTURE SEULE immédiate (garde v1.4). Délai de
   * rétractation : 30 jours. Retourne le profil mis à jour.
   *
   * Renfort fondateur (2026-11-07) : le mot de passe du compte est
   * exigé et VÉRIFIÉ (ré-authentification Supabase Auth en réel)
   * AVANT l'appel à la RPC — s'il est faux, ERR_MOT_DE_PASSE_INCORRECT
   * est levée et AUCUNE demande n'est enregistrée.
   */
  demanderSuppressionCompte(motDePasse: string): Promise<Profil>;
  /**
   * Annule la demande avant l'échéance : l'abonnement est restauré À
   * L'IDENTIQUE depuis l'instantané (statut, plan, dates, grâce…).
   */
  annulerSuppressionCompte(): Promise<Profil>;
  /** File console : demandes en cours, échéance et caractère exécutable. */
  listerSuppressionsEnAttente(): Promise<SuppressionEnAttente[]>;
  /**
   * Super Admin : exécute une suppression ÉCHUE (la base refuse avant
   * 30 jours) — factures anonymisées (comptabilité conservée), puis
   * compte supprimé. Le Display ID n'est jamais réattribué.
   */
  executerSuppressionCompte(compteId: string): Promise<void>;

  // --- Messagerie directe ---------------------------------------------------
  /**
   * Fils visibles par l'acteur courant : pour un client, son fil
   * plateforme + les fils rattachement où il participe ; pour la
   * plateforme, les fils plateforme (routage : admin_responsable_id).
   */
  listerConversations(): Promise<Conversation[]>;
  /**
   * Fil plateforme d'un client (le sien pour un client ; celui du
   * client désigné pour la plateforme) — créé au premier accès, avec
   * admin_responsable_id = l'Admin responsable du client s'il existe.
   */
  getConversationPlateforme(compteId?: string): Promise<Conversation>;
  /**
   * Fil rattachement d'une demande/rattachement ACTIF entre le
   * propriétaire connecté (ou désigné) et son gestionnaire — créé au
   * premier accès. Participants seuls (+ supervision plateforme).
   */
  getConversationRattachement(rattachementId: string): Promise<Conversation>;
  /** Messages d'un fil, du plus ancien au plus récent. */
  listerMessages(conversationId: string): Promise<MessageDirect[]>;
  /**
   * Envoie un message dans un fil. La plateforme ne peut PAS envoyer
   * dans un fil « rattachement » (ERR_SUPERVISION_LECTURE_SEULE — en
   * réel, la RLS refuse l'insertion elle-même).
   */
  envoyerMessage(conversationId: string, corps: string): Promise<MessageDirect>;
  /** Marque les messages du fil comme lus pour le côté de l'acteur. */
  marquerLu(conversationId: string): Promise<void>;
  /** Supervision : tous les fils « rattachement » (plateforme, lecture seule). */
  listerConversationsSupervisees(): Promise<Conversation[]>;
  /**
   * Boîte de réception plateforme (2026-11-07) : TOUS les fils
   * « plateforme », assignés ou NON — l'assignation est une
   * responsabilité, pas une restriction d'accès. Tri : dernier
   * message décroissant. non_lus = messages DU CLIENT non lus par la
   * plateforme. Réservé plateforme (Admin / Super Admin).
   */
  listerConversationsPlateforme(): Promise<Conversation[]>;
  /**
   * Badge console : total des messages clients non lus par la
   * plateforme, tous fils « plateforme » confondus — égal à la somme
   * des non_lus de listerConversationsPlateforme(). Réservé
   * plateforme.
   */
  compterMessagesPlateformeNonLus(): Promise<number>;
  /**
   * Journalise (journal_audit, action « consultation_messages »)
   * l'ouverture d'un fil supervisé par la plateforme.
   */
  journaliserConsultationMessages(conversationId: string): Promise<void>;

  // --- Assignation des dossiers + équipe ------------------------------------
  /**
   * Super Admin : assigne un dossier client à un Admin (ou null =
   * désassigner). Assignation = responsabilité (routage des messages,
   * vue « Mes dossiers »), PAS une restriction d'accès. Journalisé.
   */
  assignerDossier(compteId: string, adminId: string | null): Promise<void>;
  /** Page Équipe : Admins, charge, accès, dernière activité (audit). */
  listerEquipeAdmins(): Promise<MembreEquipe[]>;
  /** Super Admin : coupe ou rétablit l'accès console d'un employé Admin. */
  basculerAccesAdmin(adminId: string, actif: boolean): Promise<void>;
  /**
   * Super Admin : retire le rôle Admin — le compte redevient client
   * avec son rôle d'origine (profils.role_avant_admin, sinon intention).
   */
  retirerRoleAdmin(adminId: string): Promise<void>;
  /**
   * Espace Admin « Mes dossiers » : comptes clients dont l'Admin
   * connecté est le responsable (dossiers complets via listerDossier).
   */
  listerMesDossiers(): Promise<ComptePlateforme[]>;
}

import type {
  Abonnement,
  AccesLocataire,
  Activite,
  Alerte,
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
  Depense,
  DepenseInput,
  DepensePatch,
  Document,
  DocumentInput,
  EcheanceLoyer,
  EntreeAudit,
  FactureAbonnement,
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
  Paiement,
  PaiementMobileMoney,
  ParametresFinance,
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
} from "./types";

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
}

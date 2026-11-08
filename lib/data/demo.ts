import type { DataProvider } from "./provider";
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
  CibleAudit,
  CompteAdmin,
  ComptePlateforme,
  ContactPublic,
  Conversation,
  Coproprietaire,
  CoproprietaireInput,
  DeclarerPaiementInput,
  Depense,
  DepenseInput,
  DepensePatch,
  Devise,
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
  DemandeRattachement,
  ChecklistDossierSaisie,
  DossierCompte,
  DossierEmploye,
  DossierEmployePatch,
  GestionnaireInvite,
  Grille,
  Immeuble,
  ImmeubleInput,
  PhotoImmeubleInput,
  ImmeublePatch,
  LienLocataire,
  LimiteBlocs,
  Locataire,
  LocataireInput,
  LocatairePatch,
  MembreEquipe,
  MessageDirect,
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
  Role,
  SessionUser,
  SignUpInput,
  StatutAppartement,
  StatutContrat,
  StatutContratProprietaire,
  StatutWhatsApp,
  SupervisionGestionnaire,
  SuppressionEnAttente,
  TarifPlateforme,
  TauxChange,
  TauxManuelInput,
  TauxResultat,
  TypeAlerte,
  TypeActivite,
  TypeIntention,
} from "./types";
import { limiteBlocs, LIMITE_BLOCS } from "./types";
import {
  ajouterJours,
  ajouterMois,
  appliquerTransitions,
  estLectureSeule,
  genererReferenceMobileMoney,
  GRACE_ECHEC_PAIEMENT_JOURS,
  grillePourPays,
  INDIVISION_PAR_PLAN,
  MOBILE_MONEY_EXPIRATION_HEURES,
  prixPlan,
  prochainNumeroFactureAbo,
  RANG_PLAN,
  telephoneMobileMoneyValide,
} from "../abonnement";
import { bauxSeChevauchent, emailValide, err, genererToken, uid } from "./helpers";
import {
  bailCouvreMois,
  calculerProrata,
  calculerStatutEcheance,
  moisVersIso,
  prochainNumeroRecu as calculerProchainNumero,
  totalPayeValide,
} from "../loyers";
import {
  filtrerActivites,
  genererAlertesCandidates,
  trouverTaux,
  LIMITE_DEMO_CONTENU_OCTETS,
} from "../module4";
import { sommeParts, validerParts } from "../indivision";
import {
  buildDemoDb,
  CIZAGROUP_OWNER_ID,
  GESTIONNAIRE_DEMO_EMAIL,
  SUPER_ADMIN_DEMO_EMAIL,
  ADMIN_DEMO_EMAIL,
  type CompteClientDemo,
  type DemoDb,
  type ParcDemo,
} from "./demo-seed";
import {
  libellerMotif,
  rendreActivationGestionnaire,
  rendreAvis,
  rendreBienvenue,
  rendreBienvenueProprietaire,
  rendreDecisionGestionnaire,
  rendreRefusContratProprietaire,
  rendreValidationContratProprietaire,
} from "../avis";
import {
  genererContratGestionnairePdf,
  genererContratProprietairePdf,
} from "../contrat";
import { piecesJointesAvecGuide } from "../guide";
import { evaluerDossierEmploye } from "../dossier-employe";
import {
  construirePrixPlans,
  estEnRetardPaiement,
} from "../tarifs";
import {
  attribuerGrille,
  evaluerPaysPaiement,
  paysDepuisTelephone,
} from "../grille";
import { FORMATS_DOCUMENT_ACCEPTES, TAILLE_MAX_DOCUMENT_OCTETS } from "./types";
import {
  envoyerEmailViaApi,
  statutEmailDepuisResultat,
  type EmailAlerte,
  type ResultatEnvoiEmail,
} from "../email";

/**
 * CizaImmo — fournisseur DÉMO (Module 1).
 *
 * Stockage local (localStorage) uniquement. Aucun appel réseau.
 * La session démo est aussi posée en cookie (`cizaimmo-demo-session=1`)
 * pour que le middleware laisse passer les routes protégées en mode démo.
 *
 * Les données sont celles de lib/data/demo-seed.ts : fictives, étiquetées
 * DÉMO dans toute l'interface. L'inscription en mode démo crée un profil
 * local et démarre un essai Pro de 30 jours, comme en mode réel.
 */

// La constante vit dans lib/supabase.ts (module léger) pour que le
// middleware Edge ne tire pas ce fournisseur — ré-exportée ici pour
// les imports historiques depuis « @/lib/data/demo ».
export { DEMO_SESSION_COOKIE } from "../supabase";
import { DEMO_SESSION_COOKIE } from "../supabase";
const DEMO_DB_KEY = "cizaimmo-demo-db-v1";
const DEMO_SESSION_KEY = "cizaimmo-demo-session-v1";
/** Extension v1.2 : contexte actif du gestionnaire multi-rattaché. */
const DEMO_CONTEXTE_KEY = "cizaimmo-demo-contexte-v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function loadDb(): DemoDb {
  if (!isBrowser()) return buildDemoDb();
  const raw = window.localStorage.getItem(DEMO_DB_KEY);
  if (!raw) {
    const db = buildDemoDb();
    window.localStorage.setItem(DEMO_DB_KEY, JSON.stringify(db));
    return db;
  }
  try {
    const db = JSON.parse(raw) as DemoDb;
    // Migration douce : les bases enregistrées avant le module 4 n'ont pas
    // les nouvelles collections — on les remplit depuis la seed sans
    // écraser les données existantes.
    const frais = buildDemoDb();
    let migre = false;
    for (const cle of ["documents", "alertes", "activites", "taux", "gestionnaires", "factures", "paiementsMobileMoney", "coproprietaires"] as const) {
      if (!Array.isArray(db[cle])) {
        db[cle] = frais[cle] as never;
        migre = true;
      }
    }
    // Migration douce (extension v1.2) : parc Ciza Group, registre
    // plateforme et finances dynamiques — remplis depuis la seed sans
    // écraser les données existantes.
    if (!db.parcCizaGroup) {
      db.parcCizaGroup = frais.parcCizaGroup;
      migre = true;
    }
    if (!db.plateforme) {
      db.plateforme = frais.plateforme;
      migre = true;
    }
    if (!db.finance) {
      db.finance = frais.finance;
      migre = true;
    } else if (
      db.finance.parametres &&
      !Array.isArray(db.finance.parametres.pays_grille_afrique)
    ) {
      db.finance.parametres.pays_grille_afrique =
        frais.finance.parametres.pays_grille_afrique;
      migre = true;
    }
    if (db.profil && (db.profil as unknown as Record<string, unknown>).suspendu === undefined) {
      (db.profil as unknown as Record<string, unknown>).suspendu = false;
      migre = true;
    }
    // Migration douce (module 6) : nouveaux champs.
    if (db.profil && (db.profil as unknown as Record<string, unknown>).telephone === undefined) {
      (db.profil as unknown as Record<string, unknown>).telephone = null;
      migre = true;
    }
    for (const imm of db.immeubles) {
      const rec = imm as unknown as Record<string, unknown>;
      if (rec.date_estimation === undefined) { rec.date_estimation = null; migre = true; }
      if (rec.mode_acquisition === undefined) { rec.mode_acquisition = null; migre = true; }
    }
    // Migration douce (v1.7) : photos du bien + revue gestionnaire —
    // les immeubles des bases antérieures partent sans photo, créés
    // par leur propriétaire et déjà « valide ».
    for (const imm of [...db.immeubles, ...(db.parcCizaGroup?.immeubles ?? [])]) {
      const rec = imm as unknown as Record<string, unknown>;
      if (!Array.isArray(rec.photos)) { rec.photos = []; migre = true; }
      if (!Array.isArray(rec.photos_urls)) { rec.photos_urls = rec.photos; migre = true; }
      if (rec.origine_creation === undefined) { rec.origine_creation = "proprietaire"; migre = true; }
      if (rec.proprietaire_declare_nom === undefined) { rec.proprietaire_declare_nom = null; migre = true; }
      if (rec.proprietaire_declare_email === undefined) { rec.proprietaire_declare_email = null; migre = true; }
      if (rec.proprietaire_concordance === undefined) { rec.proprietaire_concordance = false; migre = true; }
      if (rec.validation_statut === undefined) { rec.validation_statut = "valide"; migre = true; }
      if (rec.validation_motif === undefined) { rec.validation_motif = null; migre = true; }
    }
    if (db.preferences && (db.preferences as unknown as Record<string, unknown>).canal_whatsapp === undefined) {
      (db.preferences as unknown as Record<string, unknown>).canal_whatsapp = true;
      migre = true;
    }
    for (const alerte of db.alertes) {
      const rec = alerte as unknown as Record<string, unknown>;
      if (rec.whatsapp_statut === undefined) { rec.whatsapp_statut = "non_configuré"; migre = true; }
    }
    // Migration douce (module 5) : nouveaux champs de l'abonnement.
    // v1.4 : « plan_apres_essai » rejoint la liste (défaut repris de la
    // seed fraîche pour les bases enregistrées avant la v1.4).
    const aboFrais = frais.abonnement;
    for (const cle of ["plan_en_attente", "date_effet_plan", "resiliation_programmee", "echec_paiement", "grace_ends_at", "lecture_seule_jusqu_au", "plan_apres_essai"] as const) {
      if ((db.abonnement as unknown as Record<string, unknown>)[cle] === undefined) {
        (db.abonnement as unknown as Record<string, unknown>)[cle] =
          (aboFrais as unknown as Record<string, unknown>)[cle];
        migre = true;
      }
    }
    // Migration douce : compte démo gestionnaire (rattaché au Bloc
    // Saint-Laurent) — les bases enregistrées avant son ajout ont un
    // tableau gestionnaires vide ; on y ajoute l'invitation de la seed
    // sans écraser les invitations créées depuis par le propriétaire.
    const gestionnaireFrais = frais.gestionnaires.find(
      (g) => g.email.toLowerCase() === GESTIONNAIRE_DEMO_EMAIL
    );
    if (
      gestionnaireFrais &&
      !db.gestionnaires.some(
        (g) => g.email.toLowerCase() === GESTIONNAIRE_DEMO_EMAIL
      )
    ) {
      db.gestionnaires.push(gestionnaireFrais);
      migre = true;
    }
    if (!db.preferences) {
      db.preferences = frais.preferences;
      migre = true;
    }
    // Migration douce : le préfixe technique « Démo — » a été retiré
    // des noms de la seed (profil propriétaire et gestionnaire démo).
    // Les bases déjà enregistrées sur le téléphone de l'utilisateur
    // gardent l'ancien nom — on nettoie le préfixe au chargement pour
    // que la salutation (« Bonjour, Amina ») et le nom affiché soient
    // corrects sans effacer les données du site.
    const nettoyerNom = (nom: string | null | undefined): string | null => {
      if (!nom) return nom ?? null;
      const propre = nom.replace(/^\s*D[ée]mo\s*[—–-]\s*/i, "").trim();
      return propre || nom;
    };
    if (db.profil?.nom) {
      const propre = nettoyerNom(db.profil.nom);
      if (propre && propre !== db.profil.nom) {
        db.profil.nom = propre;
        migre = true;
      }
    }
    for (const g of db.gestionnaires ?? []) {
      if (g.nom) {
        const propre = nettoyerNom(g.nom);
        if (propre && propre !== g.nom) {
          g.nom = propre;
          migre = true;
        }
      }
    }
    // Migration douce (v1.5) : messagerie directe + suppression de
    // compte — collections absentes des bases enregistrées avant la
    // v1.5, remplies depuis la seed (vides) sans rien écraser.
    if (!Array.isArray(db.conversations)) {
      db.conversations = frais.conversations;
      migre = true;
    }
    if (!Array.isArray(db.messages)) {
      db.messages = frais.messages;
      migre = true;
    }
    for (const f of db.factures ?? []) {
      const rec = f as unknown as Record<string, unknown>;
      if (rec.anonymise === undefined) { rec.anonymise = false; migre = true; }
    }
    if (db.abonnement && (db.abonnement as unknown as Record<string, unknown>).instantane_avant_suppression === undefined) {
      (db.abonnement as unknown as Record<string, unknown>).instantane_avant_suppression = null;
      migre = true;
    }
    // Migration douce (v1.3) : Display ID, intention, statut du contrat,
    // demandes de rattachement et documents de dossier.
    if (typeof db.compteurDisplayId !== "number") {
      db.compteurDisplayId = frais.compteurDisplayId;
      migre = true;
    }
    if (db.profil) {
      const rec = db.profil as unknown as Record<string, unknown>;
      if (!rec.display_id) { rec.display_id = frais.profil.display_id ?? null; migre = true; }
      if (!rec.type_intention) { rec.type_intention = "proprietaire"; migre = true; }
      if (rec.photo_profil_path === undefined) { rec.photo_profil_path = null; migre = true; }
      if (!rec.statut_contrat) { rec.statut_contrat = "sans_objet"; migre = true; }
      // Option C : contrat propriétaire — défaut repris de la graine
      // (compte déjà approuvé -> « a_signer », rétroactivité).
      if (!rec.statut_contrat_proprietaire) {
        rec.statut_contrat_proprietaire = frais.profil.statut_contrat_proprietaire ?? "sans_objet";
        migre = true;
      }
      if (rec.motif_contrat_proprietaire === undefined) { rec.motif_contrat_proprietaire = null; migre = true; }
    }
    if (db.plateforme) {
      if (!Array.isArray(db.plateforme.demandesRattachement)) {
        db.plateforme.demandesRattachement = frais.plateforme.demandesRattachement;
        migre = true;
      }
      if (!Array.isArray(db.plateforme.documentsComptes)) {
        db.plateforme.documentsComptes = frais.plateforme.documentsComptes;
        migre = true;
      }
      for (const c of db.plateforme.comptesClients) {
        const rec = c as unknown as Record<string, unknown>;
        const fraisC = frais.plateforme.comptesClients.find((f) => f.id === c.id);
        if (!rec.display_id && fraisC) {
          rec.display_id = fraisC.display_id;
          rec.telephone = fraisC.telephone;
          rec.type_intention = fraisC.type_intention;
          rec.statut_contrat = fraisC.statut_contrat;
          rec.dossier_complet = fraisC.dossier_complet;
          migre = true;
        }
      }
      // Persona v1.3 ajoutée par la seed (Sira Diallo, contrat en
      // attente de validation) : ajoutée si absente.
      const sira = frais.plateforme.comptesClients.find((c) => c.id === "client-demo-9");
      if (sira && !db.plateforme.comptesClients.some((c) => c.id === "client-demo-9")) {
        db.plateforme.comptesClients.push(sira);
        migre = true;
      }
    }
    if (migre) window.localStorage.setItem(DEMO_DB_KEY, JSON.stringify(db));
    return db;
  } catch {
    const db = buildDemoDb();
    window.localStorage.setItem(DEMO_DB_KEY, JSON.stringify(db));
    return db;
  }
}

function saveDb(db: DemoDb): void {
  if (isBrowser()) window.localStorage.setItem(DEMO_DB_KEY, JSON.stringify(db));
}

function setSessionCookie(): void {
  if (typeof document !== "undefined") {
    document.cookie = `${DEMO_SESSION_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
  }
}

function clearSessionCookie(): void {
  if (typeof document !== "undefined") {
    document.cookie = `${DEMO_SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}

function trialDates(): { debut: string; fin: string } {
  const debut = new Date();
  const fin = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return { debut: debut.toISOString(), fin: fin.toISOString() };
}

export class DemoProvider implements DataProvider {
  readonly mode = "demo" as const;

  /**
   * Envoi e-mail des alertes (Correctif 2, spec §10) — injectable pour
   * les tests. Par défaut : route API serveur (/api/email/envoyer), qui
   * répond « non_configuré » tant qu'aucun fournisseur n'est branché —
   * jamais de faux envoi. Les tests remplacent cette fonction par un
   * stub qui enregistre les e-mails « envoyés ».
   */
  envoyerEmailAlerteFn: (
    email: EmailAlerte
  ) => Promise<ResultatEnvoiEmail> = envoyerEmailViaApi;

  async getSession(): Promise<SessionUser | null> {
    if (!isBrowser()) return null;
    const raw = window.localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw) as SessionUser;
      return s?.id && s?.email ? s : null;
    } catch {
      return null;
    }
  }

  /** Connexion démo : toute adresse e-mail + mot de passe (≥ 8 car.) ouvre la session démo. */
  async signIn(email: string, _motDePasse: string): Promise<void> {
    const db = loadDb();
    const adresse = email.trim().toLowerCase();
    // Extension v1.2 : comptes PLATEFORME (Admin / Super Admin démo) —
    // vérifiés en premier : leur session ouvre la console, jamais le parc.
    const compteAdmin = db.plateforme.comptesAdmins.find(
      (a) => a.email.toLowerCase() === adresse
    );
    if (compteAdmin) {
      if (compteAdmin.statut === "suspendu") throw err("ERR_COMPTE_SUSPENDU");
      const session: SessionUser = {
        id: `plateforme:${adresse}`,
        email: adresse,
        nom: compteAdmin.nom,
      };
      window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
      setSessionCookie();
      return;
    }
    // Module 6 : un co-propriétaire invité se connecte avec l'e-mail de
    // son invitation : sa session est limitée à ses biens partagés,
    // en lecture seule (voir getProfil / filtrage ci-dessous).
    const invitation = db.coproprietaires.find(
      (c) => c.email.trim().toLowerCase() === adresse
    );
    if (invitation) {
      const session: SessionUser = {
        id: `coprop:${adresse}`,
        email: adresse,
        nom: invitation.nom,
      };
      window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
      setSessionCookie();
      return;
    }
    // Un gestionnaire invité se connecte avec l'e-mail de son
    // invitation : sa session est limitée à ses immeubles (voir
    // getProfil / filtrage ci-dessous). Même mécanisme que le
    // co-propriétaire, avec le rôle « gestionnaire » (spec §2) et une
    // session en lecture/écriture opérationnelle sur ses biens.
    const invitationGestionnaire = db.gestionnaires.find(
      (g) => g.email.trim().toLowerCase() === adresse
    );
    if (invitationGestionnaire) {
      const session: SessionUser = {
        id: `gestionnaire:${adresse}`,
        email: adresse,
        nom: invitationGestionnaire.nom,
      };
      window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
      setSessionCookie();
      return;
    }
    // Extension v1.2 : un compte REFUSÉ (ajout n°3) ou SUSPENDU par la
    // plateforme ne peut plus se connecter — message propre côté écran
    // de connexion, données conservées.
    if (db.profil.motif_refus) throw err("ERR_COMPTE_REFUSE");
    if (db.profil.suspendu) throw err("ERR_COMPTE_SUSPENDU");
    // La session démo utilise le profil de démonstration ; l'e-mail saisi
    // est conservé comme identifiant d'affichage si différent.
    const session: SessionUser = {
      id: db.profil.id,
      email: adresse,
      nom: db.profil.nom,
    };
    window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
    setSessionCookie();
  }

  async signUp(input: SignUpInput): Promise<{ needsEmailConfirmation: boolean }> {
    const db = loadDb();
    const { debut } = trialDates();
    // Anti-fraude tarifaire (v1.2) : attribution de la grille par la
    // matrice (pays déclaré + code pays IP, liste d'éligibilité
    // DYNAMIQUE des paramètres finance) — jamais le seul pays déclaré.
    const attribution = attribuerGrille(
      { paysDeclare: input.pays, paysIp: input.paysIp ?? null },
      db.finance.parametres.pays_grille_afrique
    );
    db.profil = {
      id: db.profil.id,
      nom: input.nom,
      email: input.email.trim().toLowerCase(),
      pays: input.pays,
      langue: input.langue,
      devise_principale: input.devisePrincipale,
      role: "proprietaire",
      telephone: input.telephone?.trim() || null,
      suspendu: false,
      pays_declare: input.pays,
      pays_ip: input.paysIp ?? null,
      pays_paiement: null,
      grille_attribuee: attribution.grille,
      grille_statut: attribution.statut,
      motif_refus: null,
      // v1.3 : Display ID séquentiel généré par le système (jamais
      // modifiable) ; l'INTENTION est stockée telle quelle — le rôle
      // technique reste « proprietaire » à l'inscription.
      display_id: `CIM-${String(db.compteurDisplayId).padStart(6, "0")}`,
      type_intention: input.intention,
      photo_profil_path: null,
      statut_contrat: "sans_objet",
      // v1.5 : un compte neuf n'a ni suppression en cours ni responsable.
      suppression_demandee_le: null,
      admin_responsable_id: null,
      created_at: debut,
    };
    db.principalSupprime = false;
    db.compteurDisplayId += 1;
    db.abonnement = {
      ...db.abonnement,
      owner_id: db.profil.id,
      // v1.4 : l'essai est le pack STARTER ; le pack de fin d'essai
      // démarre lui aussi à Starter (le client choisira ensuite).
      plan: "starter",
      plan_apres_essai: "starter",
      grille: attribution.grille,
      // Approbation manuelle (ajout n°3) : en_attente, SANS dates
      // d'essai — l'essai démarrera à l'approbation par la console.
      statut: "en_attente",
      debut_periode: debut,
      fin_periode: null,
      trial_ends_at: null,
      plan_en_attente: null,
      date_effet_plan: null,
      resiliation_programmee: false,
      echec_paiement: false,
      grace_ends_at: null,
      lecture_seule_jusqu_au: null,
      statut_pre_suspension: null,
      instantane_avant_suppression: null,
    };
    saveDb(db);
    const session: SessionUser = { id: db.profil.id, email: db.profil.email, nom: db.profil.nom };
    window.localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(session));
    setSessionCookie();
    // En démo, pas d'e-mail de confirmation : l'essai démarre immédiatement.
    return { needsEmailConfirmation: false };
  }

  async signOut(): Promise<void> {
    if (isBrowser()) window.localStorage.removeItem(DEMO_SESSION_KEY);
    clearSessionCookie();
  }

  async resetPassword(_email: string): Promise<void> {
    // En démo, pas d'envoi d'e-mail : l'opération est acceptée sans effet.
    return;
  }

  async updatePassword(_nouveauMotDePasse: string): Promise<void> {
    // En démo, le mot de passe n'est pas persisté.
    return;
  }

  async getProfil(): Promise<Profil | null> {
    const session = await this.getSession();
    if (!session) return null;
    const db = loadDb();
    // Extension v1.2 : session PLATEFORME — profil synthétique depuis le
    // registre des Admins (rôle admin / super_admin) ; la console est sa
    // seule surface, il n'a ni parc ni abonnement.
    if (session.id.startsWith("plateforme:")) {
      const entree = db.plateforme.comptesAdmins.find(
        (a) => a.email.toLowerCase() === session.email.toLowerCase()
      );
      if (!entree) return null;
      return {
        id: session.id,
        nom: entree.nom,
        email: entree.email,
        pays: "Canada",
        langue: "fr",
        devise_principale: "USD",
        role: entree.role,
        telephone: null,
        suspendu: entree.statut === "suspendu",
        // v1.5 : accès console de l'employé (coupé par le Super Admin).
        acces_admin_actif: entree.acces_admin_actif ?? true,
        created_at: entree.created_at,
      };
    }
    // Module 6 : session co-propriétaire — profil synthétique, rôle
    // coproprietaire, limité aux biens partagés (lecture seule).
    if (session.id.startsWith("coprop:")) {
      const email = session.id.slice("coprop:".length);
      const partages = db.coproprietaires.filter(
        (c) => c.email.trim().toLowerCase() === email
      );
      const premierImmeuble = partages.length > 0
        ? db.immeubles.find((i) => i.id === partages[0].immeuble_id)
        : undefined;
      return {
        id: session.id,
        nom: session.nom ?? partages[0]?.nom ?? email,
        email,
        pays: premierImmeuble?.pays ?? null,
        langue: "fr",
        devise_principale: premierImmeuble?.devise ?? "USD",
        role: "coproprietaire",
        telephone: partages[0]?.telephone ?? null,
        suspendu: false,
        created_at: partages[0]?.created_at ?? new Date().toISOString(),
      };
    }
    // Session gestionnaire — profil synthétique, rôle gestionnaire,
    // limité aux immeubles de son invitation (spec §2). Lecture et
    // écriture opérationnelles sur ses biens uniquement ; jamais
    // l'abonnement (voir getAbonnement / getLimiteBlocs).
    if (session.id.startsWith("gestionnaire:")) {
      const email = session.id.slice("gestionnaire:".length);
      const invitation = db.gestionnaires.find(
        (g) => g.email.trim().toLowerCase() === email
      );
      const immeubleIds = invitation?.immeuble_ids ?? [];
      const premierImmeuble =
        immeubleIds.length > 0
          ? db.immeubles.find((i) => i.id === immeubleIds[0])
          : undefined;
      return {
        id: session.id,
        nom: session.nom ?? invitation?.nom ?? email,
        email,
        pays: premierImmeuble?.pays ?? null,
        langue: "fr",
        devise_principale: premierImmeuble?.devise ?? "CAD",
        role: "gestionnaire",
        telephone: null,
        suspendu: false,
        // v1.3 : le gestionnaire démo est un dossier ÉTABLI — Display ID
        // fixe CIM-000002 et contrat déjà validé (fonctions débloquées).
        display_id: "CIM-000002",
        type_intention: "gestionnaire",
        photo_profil_path: "demo:photo-profil-marc",
        statut_contrat: "valide",
        created_at: invitation?.created_at ?? new Date().toISOString(),
      };
    }
    return db.profil;
  }

  async getAbonnement(): Promise<Abonnement | null> {
    const session = await this.getSession();
    if (!session) return null;
    // Module 6 : un co-propriétaire n'a AUCUN accès à l'abonnement.
    // Gestionnaire : idem (spec §2, §12 — l'abonnement est réservé au
    // propriétaire ; la RLS réelle le refuse aussi).
    // Extension v1.2 : une session plateforme n'a pas d'abonnement.
    if (
      session.id.startsWith("coprop:") ||
      session.id.startsWith("gestionnaire:") ||
      session.id.startsWith("plateforme:")
    ) return null;
    const db = loadDb();
    return this.chargerAbonnement(db);
  }

  /**
   * Applique les transitions paresseuses de l'abonnement (spec §12 :
   * fin d'essai, descente effective, résiliation effective, grâce
   * dépassée) et persiste si quelque chose a changé.
   */
  private chargerAbonnement(db: DemoDb): Abonnement {
    // v1.5 — POINT CRITIQUE : tant qu'une suppression de compte est en
    // cours (suppression_demandee_le posé), l'abonnement reste en
    // LECTURE SEULE : les transitions paresseuses par dates ne doivent
    // JAMAIS l'écraser (une résiliation programmée le passerait par
    // exemple à « annule », et toute transition future pourrait
    // restaurer un statut antérieur). L'instantané reste la référence,
    // restauré tel quel par annulerSuppressionCompte().
    if (db.profil?.suppression_demandee_le && !db.principalSupprime) {
      if (db.abonnement.statut !== "lecture_seule") {
        db.abonnement = { ...db.abonnement, statut: "lecture_seule" };
        saveDb(db);
      }
      return db.abonnement;
    }
    const { abo, change } = appliquerTransitions(db.abonnement);
    if (change) {
      db.abonnement = abo;
      saveDb(db);
    }
    return db.abonnement;
  }

  /**
   * Garde-fou lecture seule (Module 5, spec §12) : en lecture seule,
   * toute NOUVELLE saisie est refusée (code traduit en « abonnement
   * requis »). La lecture et les exports ne passent jamais par ici.
   * Module 6 : un co-propriétaire (lecture seule) ne peut rien saisir
   * du tout — ERR_ROLE_LECTURE_SEULE, avant tout autre contrôle.
   */
  private verifierEcriture(db: DemoDb): void {
    if (this.sessionEstCoproprietaire()) throw err("ERR_ROLE_LECTURE_SEULE");
    const abo = this.chargerAbonnement(db);
    if (estLectureSeule(abo)) throw err("ERR_ABONNEMENT_REQUIS");
  }

  /** Accès lecture aux données de démo (utilisé par les modules suivants). */
  getDemoDb(): DemoDb {
    return loadDb();
  }

  // ==========================================================================
  // MODULE 6 — Indivision + gestionnaires : sessions restreintes et
  // filtrage par immeuble visible (spec §6 suite, §2, §14). Le filtrage
  // est appliqué dans la couche données, pas seulement à l'écran : un
  // co-propriétaire ne voit QUE ses biens partagés (et jamais les
  // coordonnées des locataires) ; un gestionnaire ne voit QUE les
  // immeubles de son invitation, jamais l'abonnement.
  // ==========================================================================

  /** E-mail de la session co-propriétaire en cours, ou null (synchrone). */
  private sessionCoproprietaireEmail(): string | null {
    if (!isBrowser()) return null;
    try {
      const raw = window.localStorage.getItem(DEMO_SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as SessionUser;
      return s?.id?.startsWith("coprop:") ? s.id.slice("coprop:".length) : null;
    } catch {
      return null;
    }
  }

  private sessionEstCoproprietaire(): boolean {
    return this.sessionCoproprietaireEmail() !== null;
  }

  /** E-mail de la session gestionnaire en cours, ou null (synchrone). */
  private sessionGestionnaireEmail(): string | null {
    if (!isBrowser()) return null;
    try {
      const raw = window.localStorage.getItem(DEMO_SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as SessionUser;
      return s?.id?.startsWith("gestionnaire:") ? s.id.slice("gestionnaire:".length) : null;
    } catch {
      return null;
    }
  }

  private sessionEstGestionnaire(): boolean {
    return this.sessionGestionnaireEmail() !== null;
  }

  /** E-mail de la session PLATEFORME en cours, ou null (synchrone). */
  private sessionPlateformeEmail(): string | null {
    if (!isBrowser()) return null;
    try {
      const raw = window.localStorage.getItem(DEMO_SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as SessionUser;
      return s?.id?.startsWith("plateforme:") ? s.email.toLowerCase() : null;
    } catch {
      return null;
    }
  }

  // ==========================================================================
  // EXTENSION v1.2 — contextes du gestionnaire multi-rattaché : le parc
  // ACTIF dépend du rattachement choisi (sélecteur de contexte). Les
  // contextes sont STRICTEMENT séparés : contexte « proprietaire » =
  // collections principales de la base démo ; contexte « cizagroup » =
  // parc interne Ciza Group. Aucune donnée ne traverse.
  // ==========================================================================

  /** Rattachements ACTIFS du gestionnaire de la session (ou d'un e-mail). */
  private rattachementsActifsDe(db: DemoDb, email: string): RattachementGestionnaire[] {
    return db.plateforme.rattachements.filter(
      (r) => r.gestionnaire_email.toLowerCase() === email.toLowerCase() && r.statut === "actif"
    );
  }

  /** Rattachement actif courant : celui stocké (sélecteur), sinon le premier actif. */
  private rattachementActif(db: DemoDb): RattachementGestionnaire | null {
    const email = this.sessionGestionnaireEmail();
    if (!email) return null;
    const liste = this.rattachementsActifsDe(db, email);
    if (liste.length === 0) return null;
    let choisi: string | null = null;
    if (isBrowser()) {
      try {
        choisi = window.localStorage.getItem(DEMO_CONTEXTE_KEY);
      } catch {
        choisi = null;
      }
    }
    return liste.find((r) => r.id === choisi) ?? liste[0];
  }

  /**
   * Parc actif de la session : parc Ciza Group si le gestionnaire est
   * dans son contexte Ciza Group, parc principal sinon. `collections`
   * pointe vers les VRAIES collections (mutations persistées par saveDb).
   */
  private parcActif(db: DemoDb): {
    estPrincipal: boolean;
    collections: ParcDemo;
    ownerId: string;
  } {
    const rattachement = this.rattachementActif(db);
    if (rattachement && rattachement.contexte === "cizagroup") {
      return {
        estPrincipal: false,
        collections: db.parcCizaGroup,
        ownerId: db.parcCizaGroup.profil.id,
      };
    }
    return {
      estPrincipal: true,
      collections: {
        profil: db.profil,
        immeubles: db.immeubles,
        appartements: db.appartements,
        locataires: db.locataires,
        baux: db.baux,
        echeances: db.echeances,
        paiements: db.paiements,
        depenses: db.depenses,
        documents: db.documents,
        activites: db.activites,
        alertes: db.alertes,
        coproprietaires: db.coproprietaires,
      },
      ownerId: db.profil.id,
    };
  }

  /**
   * Collections du parc actif, avec RÉAFFECTATION synchronisée : les
   * méthodes CRUD filtrent parfois par réassignation
   * (db.appartements = db.appartements.filter(...)) — le setter répercute
   * l'affectation dans la vraie collection du parc actif.
   */
  private cols(db: DemoDb): ParcDemo {
    const parc = this.parcActif(db);
    if (parc.estPrincipal) {
      // Le parc principal EST la base : un proxy qui lit/écrit db.*.
      const vue = {} as ParcDemo;
      const cles = [
        "profil", "immeubles", "appartements", "locataires", "baux",
        "echeances", "paiements", "depenses", "documents", "activites",
        "alertes", "coproprietaires",
      ] as const;
      for (const cle of cles) {
        Object.defineProperty(vue, cle, {
          get: () => db[cle],
          set: (v: unknown) => {
            (db as unknown as Record<string, unknown>)[cle] = v;
          },
          enumerable: true,
          configurable: true,
        });
      }
      return vue;
    }
    return parc.collections;
  }

  /**
   * Immeubles visibles par la session courante (null = tout voir).
   * Co-propriétaire : ses biens partagés. Gestionnaire : les immeubles
   * de son invitation (gestionnaires_immeubles, spec §2, §14). Le
   * filtrage est appliqué dans la couche données, pas seulement à
   * l'écran : un rôle restreint ne voit QUE ses biens.
   */
  private immeublesVisibles(db: DemoDb): Set<string> | null {
    const emailCoprop = this.sessionCoproprietaireEmail();
    if (emailCoprop) {
      return new Set(
        db.coproprietaires
          .filter((c) => c.email.trim().toLowerCase() === emailCoprop)
          .map((c) => c.immeuble_id)
      );
    }
    const emailGestionnaire = this.sessionGestionnaireEmail();
    if (emailGestionnaire) {
      // Extension v1.2 : les immeubles visibles sont ceux du
      // RATTACHEMENT actif (contexte choisi) — séparation stricte des
      // contextes. Repli : l'invitation historique (bases sans
      // rattachements) garde le comportement d'origine.
      const rattachement = this.rattachementActif(db);
      if (rattachement) return new Set(rattachement.immeuble_ids);
      const invitation = db.gestionnaires.find(
        (g) => g.email.trim().toLowerCase() === emailGestionnaire
      );
      return new Set(invitation?.immeuble_ids ?? []);
    }
    return null;
  }

  /** Immeuble d'un appartement (résolution pour le filtrage coproprietaire). */
  private immeubleDeAppartement(db: DemoDb, appartementId: string): string | null {
    return this.cols(db).appartements.find((a) => a.id === appartementId)?.immeuble_id ?? null;
  }

  private immeubleDeBail(db: DemoDb, bailId: string): string | null {
    const bail = this.cols(db).baux.find((b) => b.id === bailId);
    return bail ? this.immeubleDeAppartement(db, bail.appartement_id) : null;
  }

  private immeubleDeEcheance(db: DemoDb, echeanceId: string): string | null {
    const ech = this.cols(db).echeances.find((e) => e.id === echeanceId);
    return ech ? this.immeubleDeBail(db, ech.bail_id) : null;
  }

  /** Un locataire est visible pour une session restreinte s'il a au
   * moins un bail (actif ou terminé) sur un immeuble visible. */
  private locataireVisible(db: DemoDb, locataireId: string, visibles: Set<string>): boolean {
    return this.cols(db).baux.some((b) => {
      if (b.locataire_id !== locataireId) return false;
      const imm = this.immeubleDeAppartement(db, b.appartement_id);
      return imm !== null && visibles.has(imm);
    });
  }

  /** Un co-propriétaire ne voit jamais les coordonnées des locataires. */
  private masquerCoordonneesLocataire(l: Locataire): Locataire {
    if (!this.sessionEstCoproprietaire()) return l;
    return {
      ...l,
      telephone: "",
      email: null,
      piece_type: null,
      piece_numero: null,
      adresse_precedente: null,
      contact_urgence: null,
    };
  }

  /** Seul le propriétaire administre le compte : parts d'indivision et
   * invitations de gestionnaires (spec §2, §6 suite). Une session
   * restreinte (co-propriétaire, gestionnaire) est refusée ici. */
  private verifierProprietaire(): void {
    if (this.sessionEstCoproprietaire() || this.sessionEstGestionnaire()) {
      throw err("ERR_ROLE_LECTURE_SEULE");
    }
  }

  /** L'indivision exige le plan Pro ou Agence (v1.4 : l'essai est
   * Starter, donc sans indivision — le plan en cours fait foi). */
  private verifierPlanIndivision(db: DemoDb): void {
    const abo = this.chargerAbonnement(db);
    if (!INDIVISION_PAR_PLAN[abo.plan]) throw err("ERR_INDIVISION_PLAN");
  }

  // ==========================================================================
  // MODULE 2 — CRUD (localStorage). Mêmes règles que le fournisseur réel.
  // ==========================================================================

  private async requireOwnerId(): Promise<string> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    // Extension v1.2 : dans le contexte Ciza Group, le propriétaire des
    // données créées est le parc interne Ciza Group (contexte séparé).
    if (session.id.startsWith("gestionnaire:")) {
      const db = loadDb();
      const parc = this.parcActif(db);
      if (!parc.estPrincipal) return parc.ownerId;
    }
    return session.id;
  }

  /**
   * Journalise un événement dans le fil d'actualité (table activites).
   * Lecture seule, aucune double saisie : le fil se nourrit des événements
   * déjà enregistrés (spec §6 suite). L'auteur est la session courante.
   */
  private journaliser(
    db: DemoDb,
    type: TypeActivite,
    entiteType: string | null,
    entiteId: string | null,
    description: string,
    auteurId?: string | null
  ): void {
    // Extension v1.2 : le fil suit le parc ACTIF (contexte gestionnaire).
    const parc = this.parcActif(db);
    this.cols(db).activites.push({
      id: uid(),
      owner_id: parc.ownerId,
      type,
      entite_type: entiteType,
      entite_id: entiteId,
      auteur: auteurId ?? null,
      description,
      created_at: new Date().toISOString(),
    });
  }

  private nomLocataire(db: DemoDb, locataireId: string): string {
    return this.cols(db).locataires.find((l) => l.id === locataireId)?.nom ?? "—";
  }

  private async verifierLimiteBlocs(db: DemoDb, nbActifs: number): Promise<void> {
    const abo = db.abonnement;
    const limite = limiteBlocs(abo.plan, abo.statut);
    if (nbActifs >= limite) throw err("ERR_LIMITE_BLOCS");
  }

  async listerImmeubles(inclureArchives = false): Promise<Immeuble[]> {
    const db = loadDb();
    const parc = this.cols(db);
    const visibles = this.immeublesVisibles(db);
    return parc.immeubles
      .filter((i) => inclureArchives || i.statut === "actif")
      .filter((i) => !visibles || visibles.has(i.id))
      .slice()
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }

  async getImmeuble(id: string): Promise<Immeuble | null> {
    const db = loadDb();
    const parc = this.cols(db);
    const visibles = this.immeublesVisibles(db);
    if (visibles && !visibles.has(id)) return null;
    return parc.immeubles.find((i) => i.id === id) ?? null;
  }

  async creerImmeuble(input: ImmeubleInput): Promise<Immeuble> {
    const ownerId = await this.requireOwnerId();
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    if (input.valeur_bien !== null && input.valeur_bien <= 0) throw err("ERR_VALEUR_NON_POSITIVE");
    if (input.prix_acquisition !== null && input.prix_acquisition < 0) throw err("ERR_VALEUR_NON_POSITIVE");
    if (
      parc.immeubles.some(
        (i) => i.owner_id === ownerId && i.nom.trim().toLowerCase() === input.nom.trim().toLowerCase()
      )
    ) {
      throw err("ERR_IMMEUBLE_NOM_UNIQUE");
    }
    const nbActifs = parc.immeubles.filter(
      (i) => i.owner_id === ownerId && i.statut === "actif"
    ).length;
    await this.verifierLimiteBlocs(db, nbActifs);
    // v1.7 : un créateur GESTIONNAIRE (contexte propriétaire) déclare
    // le propriétaire du bien (nom + e-mail OBLIGATOIRES) et l'immeuble
    // part en revue plateforme ; la concordance est automatique si ce
    // propriétaire est déjà rattaché (actif) à ce gestionnaire.
    const session = await this.getSession();
    const estGestionnaire =
      Boolean(session?.id.startsWith("gestionnaire:")) &&
      this.parcActif(db).estPrincipal;
    let declareNom: string | null = null;
    let declareEmail: string | null = null;
    let concordance = false;
    if (estGestionnaire) {
      declareNom = input.proprietaire_declare_nom?.trim() || null;
      declareEmail =
        input.proprietaire_declare_email?.trim().toLowerCase() || null;
      if (!declareNom || !declareEmail) {
        throw err("ERR_PROPRIETAIRE_DECLARE_REQUIS");
      }
      concordance = db.plateforme.rattachements.some(
        (r) =>
          r.gestionnaire_email.toLowerCase() ===
            (session?.email ?? "").toLowerCase() &&
          r.contexte === "proprietaire" &&
          r.statut === "actif" &&
          (r.proprietaire_email ?? "").toLowerCase() === declareEmail
      );
    }
    const immeuble: Immeuble = {
      id: uid(),
      owner_id: ownerId,
      ...input,
      quartier: input.quartier ?? null,
      // v1.7 : les champs de revue sont posés par le fournisseur,
      // jamais par l'appelant (miroir de la base).
      proprietaire_declare_nom: declareNom,
      proprietaire_declare_email: declareEmail,
      photos: [],
      photos_urls: [],
      origine_creation: estGestionnaire ? "gestionnaire" : "proprietaire",
      proprietaire_concordance: concordance,
      validation_statut: estGestionnaire ? "en_attente" : "valide",
      validation_motif: null,
      nom: input.nom.trim(),
      statut: "actif",
      created_at: new Date().toISOString(),
    };
    parc.immeubles.push(immeuble);
    saveDb(db);
    return immeuble;
  }

  async modifierImmeuble(id: string, patch: ImmeublePatch): Promise<Immeuble> {
    const ownerId = await this.requireOwnerId();
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const idx = parc.immeubles.findIndex((i) => i.id === id && i.owner_id === ownerId);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    if (patch.valeur_bien !== undefined && patch.valeur_bien !== null && patch.valeur_bien <= 0) {
      throw err("ERR_VALEUR_NON_POSITIVE");
    }
    if (patch.nom) {
      const nom = patch.nom.trim().toLowerCase();
      if (parc.immeubles.some((i) => i.id !== id && i.owner_id === ownerId && i.nom.trim().toLowerCase() === nom)) {
        throw err("ERR_IMMEUBLE_NOM_UNIQUE");
      }
    }
    const maj: Immeuble = {
      ...parc.immeubles[idx],
      ...patch,
      nom: patch.nom ? patch.nom.trim() : parc.immeubles[idx].nom,
    };
    // v1.7 : immeuble de gestionnaire — le propriétaire déclaré reste
    // obligatoire ; le modifier recalcule la concordance et, si la
    // plateforme avait refusé la validation, resoumet le bien en revue.
    if (maj.origine_creation === "gestionnaire") {
      maj.proprietaire_declare_nom = maj.proprietaire_declare_nom?.trim() || null;
      maj.proprietaire_declare_email =
        maj.proprietaire_declare_email?.trim().toLowerCase() || null;
      if (!maj.proprietaire_declare_nom || !maj.proprietaire_declare_email) {
        throw err("ERR_PROPRIETAIRE_DECLARE_REQUIS");
      }
      if (
        patch.proprietaire_declare_nom !== undefined ||
        patch.proprietaire_declare_email !== undefined
      ) {
        const session = await this.getSession();
        maj.proprietaire_concordance = db.plateforme.rattachements.some(
          (r) =>
            r.gestionnaire_email.toLowerCase() ===
              (session?.email ?? "").toLowerCase() &&
            r.contexte === "proprietaire" &&
            r.statut === "actif" &&
            (r.proprietaire_email ?? "").toLowerCase() ===
              maj.proprietaire_declare_email
        );
        if (maj.validation_statut === "refuse") {
          maj.validation_statut = "en_attente";
          maj.validation_motif = null;
        }
      }
    }
    parc.immeubles[idx] = maj;
    saveDb(db);
    return maj;
  }

  async archiverImmeuble(id: string): Promise<Immeuble> {
    return this.modifierImmeuble(id, { statut: "archive" });
  }

  async desarchiverImmeuble(id: string): Promise<Immeuble> {
    const ownerId = await this.requireOwnerId();
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const nbActifs = parc.immeubles.filter(
      (i) => i.owner_id === ownerId && i.statut === "actif"
    ).length;
    await this.verifierLimiteBlocs(db, nbActifs);
    return this.modifierImmeuble(id, { statut: "actif" });
  }

  // --- v1.7 : photos du bien (démo : la data URL EST la photo) --------------
  async ajouterPhotoImmeuble(
    immeubleId: string,
    photo: PhotoImmeubleInput
  ): Promise<Immeuble> {
    const ownerId = await this.requireOwnerId();
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const idx = parc.immeubles.findIndex(
      (i) => i.id === immeubleId && i.owner_id === ownerId
    );
    if (idx < 0) throw err("ERR_NOT_FOUND");
    const nom = photo.nom_fichier.trim();
    const extension = nom.split(".").pop()?.toLowerCase() ?? "";
    if (!["jpg", "jpeg", "png"].includes(extension) || !photo.contenu) {
      throw err("ERR_DOCUMENT_FORMAT");
    }
    if (
      photo.taille_octets !== undefined &&
      photo.taille_octets !== null &&
      photo.taille_octets > TAILLE_MAX_DOCUMENT_OCTETS
    ) {
      throw err("ERR_DOCUMENT_TROP_GROS");
    }
    const actuel = parc.immeubles[idx];
    const maj: Immeuble = {
      ...actuel,
      photos: [...(actuel.photos ?? []), photo.contenu],
      photos_urls: [...(actuel.photos_urls ?? []), photo.contenu],
    };
    parc.immeubles[idx] = maj;
    saveDb(db);
    return maj;
  }

  async retirerPhotoImmeuble(
    immeubleId: string,
    index: number
  ): Promise<Immeuble> {
    const ownerId = await this.requireOwnerId();
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const idx = parc.immeubles.findIndex(
      (i) => i.id === immeubleId && i.owner_id === ownerId
    );
    if (idx < 0) throw err("ERR_NOT_FOUND");
    const actuel = parc.immeubles[idx];
    if (index < 0 || index >= (actuel.photos ?? []).length) {
      throw err("ERR_NOT_FOUND");
    }
    const photos = [...(actuel.photos ?? [])];
    const urls = [...(actuel.photos_urls ?? [])];
    photos.splice(index, 1);
    urls.splice(index, 1);
    const maj: Immeuble = { ...actuel, photos, photos_urls: urls };
    parc.immeubles[idx] = maj;
    saveDb(db);
    return maj;
  }

  // --- v1.7 : décision plateforme sur un immeuble de gestionnaire ----------
  async deciderValidationImmeuble(
    immeubleId: string,
    accepter: boolean,
    motif?: string | null
  ): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurPlateforme(db);
    let cible: Immeuble | undefined;
    for (const parc of [db.immeubles, db.parcCizaGroup.immeubles]) {
      cible = parc.find((i) => i.id === immeubleId);
      if (cible) break;
    }
    if (!cible || cible.origine_creation !== "gestionnaire") {
      throw err("ERR_NOT_FOUND");
    }
    if (cible.validation_statut !== "en_attente") {
      throw err("ERR_VALIDATION_PAS_EN_ATTENTE");
    }
    if (!accepter && !(motif && motif.trim())) {
      throw err("ERR_VALIDATION_MOTIF_REQUIS");
    }
    cible.validation_statut = accepter ? "valide" : "refuse";
    cible.validation_motif = accepter ? null : motif!.trim();
    const emailGestionnaire = cible.owner_id.startsWith("gestionnaire:")
      ? cible.owner_id.slice("gestionnaire:".length)
      : null;
    this.journaliserAudit(
      db,
      acteur,
      accepter ? "immeuble_gestion_valide" : "immeuble_gestion_refuse",
      "immeuble",
      cible.id,
      emailGestionnaire,
      { immeuble_nom: cible.nom, motif: accepter ? null : motif!.trim() }
    );
    saveDb(db);
  }

  async listerAppartements(
    filtre?: FiltreAppartements & { inclureArchives?: boolean }
  ): Promise<Appartement[]> {
    const db = loadDb();
    const parc = this.cols(db);
    const visibles = this.immeublesVisibles(db);
    return parc.appartements
      .filter((a) => (filtre?.inclureArchives ? true : !a.archive))
      .filter((a) => !filtre?.immeubleId || a.immeuble_id === filtre.immeubleId)
      .filter((a) => !filtre?.statut || a.statut === filtre.statut)
      .filter((a) => !visibles || visibles.has(a.immeuble_id))
      .slice()
      .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
  }

  async getAppartement(id: string): Promise<Appartement | null> {
    const db = loadDb();
    const parc = this.cols(db);
    const apt = parc.appartements.find((a) => a.id === id) ?? null;
    if (!apt) return null;
    const visibles = this.immeublesVisibles(db);
    if (visibles && !visibles.has(apt.immeuble_id)) return null;
    return apt;
  }

  private verifierAppartementInput(
    db: DemoDb,
    immeubleId: string,
    input: Omit<AppartementInput, "immeuble_id">,
    exclureId?: string
  ): void {
    if (input.loyer_defaut <= 0) throw err("ERR_LOYER_NON_POSITIF");
    if (input.valeur_bien !== null && input.valeur_bien !== undefined && input.valeur_bien <= 0) {
      throw err("ERR_VALEUR_NON_POSITIVE");
    }
    if (input.charges < 0) throw err("ERR_VALEUR_NON_POSITIVE");
    if (
      this.cols(db).appartements.some(
        (a) =>
          a.immeuble_id === immeubleId &&
          a.id !== exclureId &&
          a.numero.trim().toLowerCase() === input.numero.trim().toLowerCase()
      )
    ) {
      throw err("ERR_APPARTEMENT_NUMERO_UNIQUE");
    }
  }

  async creerAppartement(input: AppartementInput): Promise<Appartement> {
    await this.requireOwnerId();
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    if (!parc.immeubles.some((i) => i.id === input.immeuble_id)) throw err("ERR_NOT_FOUND");
    if (input.statut === "occupe") throw err("ERR_SANS_BAIL");
    this.verifierAppartementInput(db, input.immeuble_id, input);
    const appartement: Appartement = {
      id: uid(),
      ...input,
      numero: input.numero.trim(),
      archive: false,
      created_at: new Date().toISOString(),
      // v1.6 : défauts « Vitrine vérifiée » — la modération démarre
      // toujours à « non_publie », jamais validée à la création.
      vitrine_statut: "non_publie",
      vitrine_motif_refus: null,
      vitrine_valide_par: null,
      vitrine_valide_le: null,
      pieces: input.pieces ?? null,
      meuble: input.meuble ?? false,
      disponible_le: input.disponible_le ?? null,
      visite_jours: input.visite_jours ?? [],
      visite_heures: input.visite_heures ?? null,
      contact_nom: input.contact_nom ?? null,
      contact_telephone: input.contact_telephone ?? null,
      contact_email: input.contact_email ?? null,
      contact_justification: input.contact_justification ?? null,
    };
    parc.appartements.push(appartement);
    saveDb(db);
    return appartement;
  }

  async creerAppartementsEnLot(
    immeubleId: string,
    items: Omit<AppartementInput, "immeuble_id">[]
  ): Promise<Appartement[]> {
    await this.requireOwnerId();
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    if (!parc.immeubles.some((i) => i.id === immeubleId)) throw err("ERR_NOT_FOUND");
    // Tout ou rien : on valide tout le lot avant d'insérer quoi que ce soit.
    const numeros = new Set<string>();
    for (const item of items) {
      const cle = item.numero.trim().toLowerCase();
      if (numeros.has(cle)) throw err("ERR_APPARTEMENT_NUMERO_UNIQUE");
      numeros.add(cle);
      this.verifierAppartementInput(db, immeubleId, item);
    }
    const crees: Appartement[] = items.map((item) => ({
      id: uid(),
      immeuble_id: immeubleId,
      ...item,
      numero: item.numero.trim(),
      archive: false,
      created_at: new Date().toISOString(),
      // v1.6 : mêmes défauts « Vitrine vérifiée » que creerAppartement.
      vitrine_statut: "non_publie" as const,
      vitrine_motif_refus: null,
      vitrine_valide_par: null,
      vitrine_valide_le: null,
      pieces: item.pieces ?? null,
      meuble: item.meuble ?? false,
      disponible_le: item.disponible_le ?? null,
      visite_jours: item.visite_jours ?? [],
      visite_heures: item.visite_heures ?? null,
      contact_nom: item.contact_nom ?? null,
      contact_telephone: item.contact_telephone ?? null,
      contact_email: item.contact_email ?? null,
      contact_justification: item.contact_justification ?? null,
    }));
    parc.appartements.push(...crees);
    saveDb(db);
    return crees;
  }

  async modifierAppartement(id: string, patch: AppartementPatch): Promise<Appartement> {
    await this.requireOwnerId();
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const idx = parc.appartements.findIndex((a) => a.id === id);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    const courant = parc.appartements[idx];
    const candidat: Omit<AppartementInput, "immeuble_id"> = {
      numero: patch.numero ?? courant.numero,
      type: patch.type ?? (courant.type as AppartementInput["type"]),
      surface_m2: patch.surface_m2 ?? courant.surface_m2,
      loyer_defaut: patch.loyer_defaut ?? courant.loyer_defaut,
      devise: patch.devise ?? courant.devise,
      charges: patch.charges ?? courant.charges,
      etage: patch.etage ?? courant.etage,
      description: patch.description ?? courant.description,
      photos: patch.photos ?? courant.photos,
      statut: patch.statut ?? courant.statut,
      vitrine: patch.vitrine ?? courant.vitrine,
      valeur_bien: patch.valeur_bien ?? courant.valeur_bien,
      devise_valeur: patch.devise_valeur ?? courant.devise_valeur,
      // v1.6 : champs d'annonce publique (le statut de modération
      // n'est JAMAIS dans le patch — géré par demander/valider/retirer).
      pieces: patch.pieces ?? courant.pieces,
      meuble: patch.meuble ?? courant.meuble,
      disponible_le: patch.disponible_le ?? courant.disponible_le,
      visite_jours: patch.visite_jours ?? courant.visite_jours,
      visite_heures: patch.visite_heures ?? courant.visite_heures,
      contact_nom: patch.contact_nom ?? courant.contact_nom,
      contact_telephone: patch.contact_telephone ?? courant.contact_telephone,
      contact_email: patch.contact_email ?? courant.contact_email,
      contact_justification: patch.contact_justification ?? courant.contact_justification,
    };
    this.verifierAppartementInput(db, courant.immeuble_id, candidat, id);
    // Cohérence statut / bail : « occupé » exige un bail actif, et un
    // appartement avec un bail actif ne peut pas quitter « occupé ».
    const bailActif = parc.baux.some(
      (b) => b.appartement_id === id && b.statut === "actif"
    );
    if (candidat.statut === "occupe" && !bailActif) throw err("ERR_SANS_BAIL");
    if (candidat.statut !== "occupe" && bailActif && courant.statut === "occupe") {
      throw err("ERR_APPARTEMENT_OCCUPE");
    }
    let maj: Appartement = { ...courant, ...patch, numero: candidat.numero.trim() };
    // v1.6 — règle anti-fraude (miroir du trigger SQL) : modifier un
    // champ CRITIQUE d'une annonce APPROUVÉE la renvoie en validation
    // (« en_attente », validation effacée) — l'annonce publique ne
    // peut pas changer sous le badge « ✓ Vérifié » sans re-contrôle.
    if (courant.vitrine_statut === "approuve") {
      const champsCritiques = [
        "loyer_defaut", "devise", "charges", "photos", "description",
        "visite_jours", "visite_heures", "contact_nom",
        "contact_telephone", "contact_email",
      ] as const;
      const modifie = champsCritiques.some((champ) => {
        const avant = courant[champ];
        const apres = maj[champ];
        if (Array.isArray(avant) || Array.isArray(apres)) {
          return JSON.stringify(avant ?? null) !== JSON.stringify(apres ?? null);
        }
        return avant !== apres;
      });
      if (modifie) {
        maj = {
          ...maj,
          vitrine_statut: "en_attente",
          vitrine_valide_par: null,
          vitrine_valide_le: null,
        };
      }
    }
    parc.appartements[idx] = maj;
    saveDb(db);
    return maj;
  }

  private bailActifDe(db: DemoDb, appartementId: string): Bail | undefined {
    return this.cols(db).baux.find((b) => b.appartement_id === appartementId && b.statut === "actif");
  }

  async changerStatutAppartement(
    id: string,
    statut: StatutAppartement
  ): Promise<Appartement> {
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const apt = parc.appartements.find((a) => a.id === id);
    if (!apt) throw err("ERR_NOT_FOUND");
    const bailActif = this.bailActifDe(db, id);
    if (statut === "occupe" && !bailActif) throw err("ERR_SANS_BAIL");
    if (statut !== "occupe" && bailActif) throw err("ERR_APPARTEMENT_OCCUPE");
    return this.modifierAppartement(id, { statut });
  }

  async basculerVitrine(id: string, vitrine: boolean): Promise<Appartement> {
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const apt = parc.appartements.find((a) => a.id === id);
    if (!apt) throw err("ERR_NOT_FOUND");
    // Spec §6 (vitrine) : seuls les vacants ou bientôt libres sont publiés.
    if (vitrine && apt.statut !== "vacant" && apt.statut !== "reserve") {
      throw err("ERR_VITRINE_STATUT");
    }
    return this.modifierAppartement(id, { vitrine });
  }

  async archiverAppartement(id: string): Promise<Appartement> {
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const apt = parc.appartements.find((a) => a.id === id);
    if (!apt) throw err("ERR_NOT_FOUND");
    if (this.bailActifDe(db, id)) throw err("ERR_APPARTEMENT_OCCUPE");
    apt.archive = true;
    saveDb(db);
    return apt;
  }

  async desarchiverAppartement(id: string): Promise<Appartement> {
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const apt = parc.appartements.find((a) => a.id === id);
    if (!apt) throw err("ERR_NOT_FOUND");
    apt.archive = false;
    saveDb(db);
    return apt;
  }

  async supprimerAppartement(id: string): Promise<void> {
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const apt = parc.appartements.find((a) => a.id === id);
    if (!apt) throw err("ERR_NOT_FOUND");
    if (this.bailActifDe(db, id)) throw err("ERR_APPARTEMENT_OCCUPE");
    if (parc.baux.some((b) => b.appartement_id === id)) throw err("ERR_BAIL_EXISTANT");
    parc.appartements = parc.appartements.filter((a) => a.id !== id);
    saveDb(db);
  }

  async listerLocataires(): Promise<Locataire[]> {
    const db = loadDb();
    const parc = this.cols(db);
    const visibles = this.immeublesVisibles(db);
    return parc.locataires
      .filter((l) => {
        // Gestionnaire : locataires de ses immeubles uniquement (via
        // leurs baux). Co-propriétaire : tous, coordonnées masquées
        // (comportement existant, module 6).
        if (!visibles || !this.sessionEstGestionnaire()) return true;
        return this.locataireVisible(db, l.id, visibles);
      })
      .slice()
      .sort((a, b) => a.nom.localeCompare(b.nom))
      .map((l) => this.masquerCoordonneesLocataire(l));
  }

  async getLocataire(id: string): Promise<Locataire | null> {
    const db = loadDb();
    const parc = this.cols(db);
    const loc = parc.locataires.find((l) => l.id === id) ?? null;
    if (!loc) return null;
    if (this.sessionEstGestionnaire()) {
      const visibles = this.immeublesVisibles(db);
      if (!visibles || !this.locataireVisible(db, id, visibles)) return null;
    }
    return this.masquerCoordonneesLocataire(loc);
  }

  async creerLocataire(input: LocataireInput): Promise<Locataire> {
    const ownerId = await this.requireOwnerId();
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const locataire: Locataire = {
      id: uid(),
      owner_id: ownerId,
      ...input,
      nom: input.nom.trim(),
      telephone: input.telephone.trim(),
      lien_token: null,
      lien_expire_le: null,
      created_at: new Date().toISOString(),
    };
    parc.locataires.push(locataire);
    saveDb(db);
    return locataire;
  }

  async modifierLocataire(id: string, patch: LocatairePatch): Promise<Locataire> {
    const ownerId = await this.requireOwnerId();
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const idx = parc.locataires.findIndex((l) => l.id === id && l.owner_id === ownerId);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    const maj: Locataire = {
      ...parc.locataires[idx],
      ...patch,
      nom: patch.nom ? patch.nom.trim() : parc.locataires[idx].nom,
    };
    parc.locataires[idx] = maj;
    saveDb(db);
    return maj;
  }

  async supprimerLocataire(id: string): Promise<void> {
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const loc = parc.locataires.find((l) => l.id === id);
    if (!loc) throw err("ERR_NOT_FOUND");
    if (parc.baux.some((b) => b.locataire_id === id && b.statut === "actif")) {
      throw err("ERR_LOCATAIRE_BAIL_ACTIF");
    }
    parc.locataires = parc.locataires.filter((l) => l.id !== id);
    saveDb(db);
  }

  async genererLienLocataire(id: string): Promise<LienLocataire> {
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const idx = parc.locataires.findIndex((l) => l.id === id);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    const token = genererToken();
    const expireLe = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    parc.locataires[idx].lien_token = token;
    parc.locataires[idx].lien_expire_le = expireLe;
    saveDb(db);
    const origine =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "";
    return { token, expireLe, url: `${origine}/locataire/${token}` };
  }

  async revoquerLienLocataire(id: string): Promise<Locataire> {
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const idx = parc.locataires.findIndex((l) => l.id === id);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    parc.locataires[idx].lien_token = null;
    parc.locataires[idx].lien_expire_le = null;
    saveDb(db);
    return parc.locataires[idx];
  }

  /**
   * Accès lecture seule par lien sécurisé (Correctif 1, spec §2, §14).
   * Sans connexion : le jeton suffit. Jeton expiré, révoqué ou inconnu
   * -> null, sans aucune donnée. Ne retourne QUE les données de ce
   * locataire : son bail en cours, ses échéances (statuts recalculés),
   * ses paiements et ses reçus.
   */
  async getLocataireParToken(token: string): Promise<AccesLocataire | null> {
    const db = loadDb();
    if (!token) return null;
    const locataire = db.locataires.find((l) => l.lien_token === token);
    if (!locataire || !locataire.lien_token) return null;
    if (
      !locataire.lien_expire_le ||
      new Date(locataire.lien_expire_le).getTime() <= Date.now()
    ) {
      return null;
    }
    const bail =
      db.baux
        .filter((b) => b.locataire_id === locataire.id && b.statut === "actif")
        .sort((a, b) => b.debut.localeCompare(a.debut))[0] ?? null;
    const appartement = bail
      ? db.appartements.find((a) => a.id === bail.appartement_id) ?? null
      : null;
    const immeuble = appartement
      ? db.immeubles.find((i) => i.id === appartement.immeuble_id) ?? null
      : null;
    const echeances = bail
      ? db.echeances
          .filter((e) => e.bail_id === bail.id)
          .map((e) => this.avecStatutCalcule(db, e))
          .sort((a, b) => b.mois.localeCompare(a.mois))
      : [];
    const paiements = echeances.length
      ? db.paiements.filter((p) =>
          echeances.some((e) => e.id === p.echeance_id)
        )
      : [];
    // Reçus construits directement depuis la base (pas de filtrage par
    // session ici : l'accès est régi par le jeton, pas par la connexion).
    const recus = db.paiements
      .filter((p) => p.echeance_id && echeances.some((e) => e.id === p.echeance_id))
      .map((p) => this.construireRecu(db, p))
      .filter((r): r is Recu => r !== null && r.locataire_id === locataire.id)
      .sort(
        (a, b) =>
          b.date_paiement.localeCompare(a.date_paiement) ||
          b.numero.localeCompare(a.numero)
      );
    return {
      locataire,
      bail,
      appartementNumero: appartement?.numero ?? null,
      immeubleNom: immeuble?.nom ?? null,
      emetteurNom: db.profil.nom,
      echeances,
      paiements,
      recus,
    };
  }

  async listerBaux(filtre?: FiltreBaux): Promise<Bail[]> {
    const db = loadDb();
    const parc = this.cols(db);
    const visibles = this.immeublesVisibles(db);
    return parc.baux
      .filter((b) => !filtre?.appartementId || b.appartement_id === filtre.appartementId)
      .filter((b) => !filtre?.locataireId || b.locataire_id === filtre.locataireId)
      .filter((b) => !filtre?.statut || b.statut === filtre.statut)
      .filter((b) => {
        if (!visibles) return true;
        const imm = this.immeubleDeAppartement(db, b.appartement_id);
        return imm !== null && visibles.has(imm);
      })
      .slice()
      .sort((a, b) => b.debut.localeCompare(a.debut));
  }

  async getBail(id: string): Promise<Bail | null> {
    const db = loadDb();
    const parc = this.cols(db);
    const bail = parc.baux.find((b) => b.id === id) ?? null;
    if (!bail) return null;
    // Session restreinte (co-propriétaire, gestionnaire) : le bail doit
    // appartenir à un immeuble visible — même garde-fou que les listes.
    const visibles = this.immeublesVisibles(db);
    if (visibles) {
      const imm = this.immeubleDeAppartement(db, bail.appartement_id);
      if (imm === null || !visibles.has(imm)) return null;
    }
    return bail;
  }

  async creerBail(input: BailInput): Promise<Bail> {
    await this.requireOwnerId();
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const appartement = parc.appartements.find((a) => a.id === input.appartement_id);
    const locataire = parc.locataires.find((l) => l.id === input.locataire_id);
    if (!appartement || !locataire) throw err("ERR_NOT_FOUND");
    if (input.loyer_mensuel <= 0) throw err("ERR_LOYER_NON_POSITIF");
    if (input.jour_exigibilite < 1 || input.jour_exigibilite > 28) throw err("ERR_JOUR_EXIGIBILITE");
    if (input.fin && input.fin <= input.debut) throw err("ERR_BAIL_FIN_AVANT_DEBUT");
    if (input.caution !== null && input.caution < 0) throw err("ERR_VALEUR_NON_POSITIVE");
    const chevauchement = parc.baux.some(
      (b) =>
        b.appartement_id === input.appartement_id &&
        b.statut === "actif" &&
        bauxSeChevauchent(b.debut, b.fin, input.debut, input.fin)
    );
    if (chevauchement) throw err("ERR_BAIL_CHEVAUCHEMENT");
    const bail: Bail = {
      id: uid(),
      ...input,
      statut: "actif",
      created_at: new Date().toISOString(),
    };
    parc.baux.push(bail);
    // L'appartement passe en « occupé » dès la création du bail.
    appartement.statut = "occupe";
    appartement.archive = false;
    const sessionBail = await this.getSession();
    this.journaliser(
      db,
      "bail",
      "bail",
      bail.id,
      `Bail créé : ${this.nomLocataire(db, input.locataire_id)} — appartement ${appartement.numero} (dès le ${input.debut})`,
      sessionBail?.id
    );
    saveDb(db);
    return bail;
  }

  async cloturerBail(id: string, cautionStatut?: CautionStatut): Promise<Bail> {
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const idx = parc.baux.findIndex((b) => b.id === id);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    const bail = parc.baux[idx];
    bail.statut = "termine";
    if (cautionStatut) bail.caution_statut = cautionStatut;
    parc.baux[idx] = bail;
    const session = await this.getSession();
    this.journaliser(
      db,
      "bail",
      "bail",
      bail.id,
      `Bail clôturé : ${this.nomLocataire(db, bail.locataire_id)} — appartement ${parc.appartements.find((a) => a.id === bail.appartement_id)?.numero ?? "—"}`,
      session?.id
    );
    // L'appartement repasse « vacant » s'il n'a plus aucun bail actif.
    const autreActif = parc.baux.some(
      (b) => b.appartement_id === bail.appartement_id && b.statut === "actif"
    );
    if (!autreActif) {
      const apt = parc.appartements.find((a) => a.id === bail.appartement_id);
      if (apt) apt.statut = "vacant";
    }
    saveDb(db);
    return bail;
  }

  async listerDepenses(filtre?: FiltreDepenses): Promise<Depense[]> {
    const db = loadDb();
    const parc = this.cols(db);
    const visibles = this.immeublesVisibles(db);
    return parc.depenses
      .filter((d) => !filtre?.immeubleId || d.immeuble_id === filtre.immeubleId)
      .filter((d) => !filtre?.appartementId || d.appartement_id === filtre.appartementId)
      .filter((d) => !visibles || visibles.has(d.immeuble_id))
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async listerEcheances(
    bailIdOuFiltre?: string | FiltreEcheances
  ): Promise<EcheanceLoyer[]> {
    const db = loadDb();
    const parc = this.cols(db);
    const filtre: FiltreEcheances =
      typeof bailIdOuFiltre === "string"
        ? { bailId: bailIdOuFiltre }
        : bailIdOuFiltre ?? {};
    const visibles = this.immeublesVisibles(db);
    let liste = parc.echeances
      .filter((e) => !filtre.bailId || e.bail_id === filtre.bailId)
      .filter((e) => !filtre.mois || e.mois === moisVersIso(filtre.mois))
      .filter((e) => {
        if (!visibles) return true;
        const imm = this.immeubleDeBail(db, e.bail_id);
        return imm !== null && visibles.has(imm);
      });
    if (filtre.immeubleId) {
      const bauxImmeuble = new Set(
        parc.baux
          .filter((b) =>
            parc.appartements.some(
              (a) => a.id === b.appartement_id && a.immeuble_id === filtre.immeubleId
            )
          )
          .map((b) => b.id)
      );
      liste = liste.filter((e) => bauxImmeuble.has(e.bail_id));
    }
    let recalculees = liste.map((e) => this.avecStatutCalcule(db, e));
    if (filtre.statut) recalculees = recalculees.filter((e) => e.statut === filtre.statut);
    return recalculees.slice().sort((a, b) => b.mois.localeCompare(a.mois));
  }

  async listerPaiements(echeanceId?: string): Promise<Paiement[]> {
    const db = loadDb();
    const parc = this.cols(db);
    const visibles = this.immeublesVisibles(db);
    return parc.paiements
      .filter((p) => !echeanceId || p.echeance_id === echeanceId)
      .filter((p) => {
        if (!visibles) return true;
        const imm = this.immeubleDeEcheance(db, p.echeance_id);
        return imm !== null && visibles.has(imm);
      })
      .slice()
      .sort((a, b) => b.date_paiement.localeCompare(a.date_paiement));
  }

  // ==========================================================================
  // MODULE 3 — Loyers & paiements + reçus (localStorage).
  // ==========================================================================

  /**
   * Statut RECALCULÉ à chaque lecture (spec §9) : le statut stocké n'est
   * qu'un cache, la vérité vient des paiements valides et de la date.
   */
  private avecStatutCalcule(db: DemoDb, echeance: EcheanceLoyer): EcheanceLoyer {
    const bail = this.cols(db).baux.find((b) => b.id === echeance.bail_id);
    const paye = totalPayeValide(
      this.cols(db).paiements.filter((p) => p.echeance_id === echeance.id),
      echeance.devise
    );
    const statut = calculerStatutEcheance({
      montantDu: echeance.montant_du,
      paye,
      jourExigibilite: bail?.jour_exigibilite ?? 1,
      moisIso: echeance.mois,
    });
    return { ...echeance, statut };
  }

  /** Après chaque écriture, on resynchronise le statut stocké (cache). */
  private resynchroniserStatut(db: DemoDb, echeanceId: string): void {
    const idx = this.cols(db).echeances.findIndex((e) => e.id === echeanceId);
    if (idx >= 0) this.cols(db).echeances[idx] = this.avecStatutCalcule(db, this.cols(db).echeances[idx]);
  }

  async genererEcheances(mois: string): Promise<EcheanceLoyer[]> {
    const moisIso = moisVersIso(mois);
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    // Session restreinte : on ne génère des échéances que pour ses
    // immeubles — sinon la visite d'un mois créerait des échéances
    // pour les biens des autres.
    const visibles = this.immeublesVisibles(db);
    const bauxActifs = parc.baux.filter((b) => {
      if (b.statut !== "actif" || !bailCouvreMois(b, moisIso)) return false;
      if (!visibles) return true;
      const imm = this.immeubleDeAppartement(db, b.appartement_id);
      return imm !== null && visibles.has(imm);
    });
    for (const bail of bauxActifs) {
      const existe = parc.echeances.some(
        (e) => e.bail_id === bail.id && e.mois === moisIso
      );
      if (existe) continue; // idempotence : une échéance par bail et par mois.
      const prorata = calculerProrata(bail, moisIso);
      const echeance: EcheanceLoyer = {
        id: uid(),
        bail_id: bail.id,
        mois: moisIso,
        montant_du: prorata.montantDu,
        devise: bail.devise,
        statut: "a_venir",
        prorata: prorata.prorata,
        prorata_detail: prorata.detail,
        created_at: new Date().toISOString(),
      };
      parc.echeances.push(echeance);
    }
    // Resynchroniser les statuts du mois avant de retourner.
    for (const e of parc.echeances.filter((x) => x.mois === moisIso)) {
      this.resynchroniserStatut(db, e.id);
    }
    saveDb(db);
    return this.listerEcheances({ mois: moisIso });
  }

  async prochainNumeroRecu(): Promise<string> {
    const db = loadDb();
    const parc = this.cols(db);
    return calculerProchainNumero(
      parc.paiements.map((p) => p.recu_numero),
      new Date().getFullYear()
    );
  }

  async declarerPaiement(
    input: DeclarerPaiementInput
  ): Promise<{ paiement: Paiement; recuNumero: string }> {
    if (!input.montant || input.montant <= 0) throw err("ERR_MONTANT_NON_POSITIF");
    const session = await this.getSession();
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const echeance = parc.echeances.find((e) => e.id === input.echeance_id);
    if (!echeance) throw err("ERR_ECHEANCE_INTROUVABLE");
    const annee = new Date(input.date_paiement).getFullYear();
    const recuNumero = calculerProchainNumero(
      parc.paiements.map((p) => p.recu_numero),
      Number.isFinite(annee) ? annee : new Date().getFullYear()
    );
    const paiement: Paiement = {
      id: uid(),
      echeance_id: input.echeance_id,
      montant: input.montant,
      devise: input.devise,
      date_paiement: input.date_paiement,
      moyen: input.moyen,
      reference: input.reference?.trim() ? input.reference.trim() : null,
      declare_par: session?.id ?? null,
      recu_numero: recuNumero,
      statut: "valide",
      taux_conversion: input.taux_conversion ?? null,
      date_taux: input.date_taux ?? null,
      montant_converti: input.montant_converti ?? null,
      created_at: new Date().toISOString(),
    };
    parc.paiements.push(paiement);
    this.resynchroniserStatut(db, input.echeance_id);
    const echeanceLue = parc.echeances.find((e) => e.id === input.echeance_id);
    const bailPaiement = echeanceLue ? parc.baux.find((b) => b.id === echeanceLue.bail_id) : undefined;
    const aptPaiement = bailPaiement ? parc.appartements.find((a) => a.id === bailPaiement.appartement_id) : undefined;
    this.journaliser(
      db,
      "paiement",
      "loyer",
      input.echeance_id,
      `Paiement déclaré : ${input.montant} ${input.devise}${bailPaiement ? ` — ${this.nomLocataire(db, bailPaiement.locataire_id)} (${aptPaiement?.numero ?? "—"}, ${echeanceLue?.mois.slice(0, 7) ?? ""})` : ""}`,
      session?.id
    );
    saveDb(db);
    return { paiement, recuNumero };
  }

  async annulerPaiement(id: string, motif?: string): Promise<Paiement> {
    const session = await this.getSession();
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const idx = parc.paiements.findIndex((p) => p.id === id);
    if (idx < 0) throw err("ERR_PAIEMENT_INTROUVABLE");
    const paiement = parc.paiements[idx];
    if (paiement.statut === "annule") throw err("ERR_PAIEMENT_DEJA_ANNULE");
    const maj: Paiement = {
      ...paiement,
      statut: "annule",
      annule_par: session?.id ?? null,
      annule_le: new Date().toISOString(),
      motif_annulation: motif?.trim() ? motif.trim() : null,
    };
    parc.paiements[idx] = maj;
    // Le reçu est annulé avec le paiement ; le statut de l'échéance est recalculé.
    this.resynchroniserStatut(db, paiement.echeance_id);
    saveDb(db);
    return maj;
  }

  async corrigerPaiement(
    id: string,
    input: Omit<DeclarerPaiementInput, "echeance_id">
  ): Promise<{ paiement: Paiement; recuNumero: string }> {
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const ancien = parc.paiements.find((p) => p.id === id);
    if (!ancien) throw err("ERR_PAIEMENT_INTROUVABLE");
    if (ancien.statut === "annule") throw err("ERR_PAIEMENT_DEJA_ANNULE");
    // Un reçu émis ne se modifie pas : annulation + nouvelle déclaration.
    await this.annulerPaiement(id, "correction");
    const { paiement, recuNumero } = await this.declarerPaiement({
      ...input,
      echeance_id: ancien.echeance_id,
    });
    const db2 = loadDb();
    const parc2 = this.cols(db2);
    const idx = parc2.paiements.findIndex((p) => p.id === paiement.id);
    if (idx >= 0) {
      parc2.paiements[idx] = { ...parc2.paiements[idx], remplace_paiement_id: id };
      saveDb(db2);
    }
    return { paiement: { ...paiement, remplace_paiement_id: id }, recuNumero };
  }

  /** Construit la vue « reçu » à partir d'un paiement et de ses entités liées. */
  private construireRecu(db: DemoDb, paiement: Paiement): Recu | null {
    if (!paiement.recu_numero) return null;
    const echeance = this.cols(db).echeances.find((e) => e.id === paiement.echeance_id);
    if (!echeance) return null;
    const bail = this.cols(db).baux.find((b) => b.id === echeance.bail_id);
    const locataire = bail ? this.cols(db).locataires.find((l) => l.id === bail.locataire_id) : undefined;
    const appartement = bail ? this.cols(db).appartements.find((a) => a.id === bail.appartement_id) : undefined;
    const immeuble = appartement ? this.cols(db).immeubles.find((i) => i.id === appartement.immeuble_id) : undefined;
    return {
      numero: paiement.recu_numero,
      paiement_id: paiement.id,
      echeance_id: paiement.echeance_id,
      bail_id: echeance.bail_id,
      locataire_id: locataire?.id ?? null,
      locataire_nom: locataire?.nom ?? "—",
      locataire_telephone: locataire?.telephone ?? null,
      locataire_email: locataire?.email ?? null,
      immeuble_nom: immeuble?.nom ?? "—",
      appartement_numero: appartement?.numero ?? "—",
      mois: echeance.mois,
      montant: paiement.montant,
      devise: paiement.devise,
      moyen: paiement.moyen,
      date_paiement: paiement.date_paiement,
      date_emission: paiement.created_at,
      reference: paiement.reference,
      statut: paiement.statut,
    };
  }

  async listerRecus(filtre?: FiltreRecus): Promise<Recu[]> {
    const db = loadDb();
    const parc = this.cols(db);
    const visibles = this.immeublesVisibles(db);
    let recus = parc.paiements
      .filter((p) => {
        if (!visibles) return true;
        const imm = this.immeubleDeEcheance(db, p.echeance_id);
        return imm !== null && visibles.has(imm);
      })
      .map((p) => this.construireRecu(db, p))
      .filter((r): r is Recu => r !== null);
    if (filtre?.statut) recus = recus.filter((r) => r.statut === filtre.statut);
    const moisFiltre = filtre?.mois ? moisVersIso(filtre.mois) : null;
    if (moisFiltre) recus = recus.filter((r) => r.mois === moisFiltre);
    if (filtre?.recherche) {
      const q = filtre.recherche.trim().toLowerCase();
      if (q) {
        recus = recus.filter(
          (r) =>
            r.numero.toLowerCase().includes(q) ||
            r.locataire_nom.toLowerCase().includes(q)
        );
      }
    }
    return recus
      .slice()
      .sort((a, b) =>
        b.date_paiement.localeCompare(a.date_paiement) ||
        b.numero.localeCompare(a.numero)
      );
  }

  // ==========================================================================
  // MODULE 4 — Dépenses (CRUD), documents, fil, taux, alertes, paramètres.
  // ==========================================================================

  async creerDepense(input: DepenseInput): Promise<Depense> {
    const ownerId = await this.requireOwnerId();
    if (!input.categorie) throw err("ERR_CATEGORIE_MANQUANTE");
    if (!input.montant || input.montant <= 0) throw err("ERR_MONTANT_NON_POSITIF");
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    if (!parc.immeubles.some((i) => i.id === input.immeuble_id)) throw err("ERR_NOT_FOUND");
    if (input.appartement_id && !parc.appartements.some((a) => a.id === input.appartement_id)) {
      throw err("ERR_NOT_FOUND");
    }
    const session = await this.getSession();
    const depense: Depense = {
      id: uid(),
      owner_id: ownerId,
      immeuble_id: input.immeuble_id,
      appartement_id: input.appartement_id,
      date: input.date,
      categorie: input.categorie,
      libelle: input.libelle.trim(),
      montant: input.montant,
      devise: input.devise,
      fournisseur: input.fournisseur?.trim() ? input.fournisseur.trim() : null,
      justificatif_url: input.justificatif_url ?? null,
      created_at: new Date().toISOString(),
    };
    parc.depenses.push(depense);
    this.journaliser(
      db,
      "depense",
      "depense",
      depense.id,
      `Dépense ajoutée : ${depense.libelle} (${depense.montant} ${depense.devise})`,
      session?.id
    );
    saveDb(db);
    return depense;
  }

  async modifierDepense(id: string, patch: DepensePatch): Promise<Depense> {
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const idx = parc.depenses.findIndex((d) => d.id === id);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    if (patch.montant !== undefined && patch.montant !== null && patch.montant <= 0) {
      throw err("ERR_MONTANT_NON_POSITIF");
    }
    if (patch.categorie !== undefined && !patch.categorie) throw err("ERR_CATEGORIE_MANQUANTE");
    const maj: Depense = {
      ...parc.depenses[idx],
      ...patch,
      libelle: patch.libelle ? patch.libelle.trim() : parc.depenses[idx].libelle,
    };
    parc.depenses[idx] = maj;
    saveDb(db);
    return maj;
  }

  async supprimerDepense(id: string): Promise<void> {
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    if (!parc.depenses.some((d) => d.id === id)) throw err("ERR_NOT_FOUND");
    parc.depenses = parc.depenses.filter((d) => d.id !== id);
    saveDb(db);
  }

  async listerDocuments(filtre?: FiltreDocuments): Promise<Document[]> {
    const db = loadDb();
    const parc = this.cols(db);
    const visibles = this.immeublesVisibles(db);
    let liste = parc.documents.slice();
    if (visibles) {
      // Co-propriétaire : documents des biens partagés uniquement ;
      // jamais les documents liés à un locataire.
      liste = liste.filter((d) => {
        if (d.entite_type === "immeuble") return visibles.has(d.entite_id);
        if (d.entite_type === "appartement") {
          const imm = this.immeubleDeAppartement(db, d.entite_id);
          return imm !== null && visibles.has(imm);
        }
        if (d.entite_type === "bail") {
          const imm = this.immeubleDeBail(db, d.entite_id);
          return imm !== null && visibles.has(imm);
        }
        if (d.entite_type === "depense") {
          const dep = parc.depenses.find((x) => x.id === d.entite_id);
          return dep !== undefined && visibles.has(dep.immeuble_id);
        }
        return false; // locataire : jamais visible pour un co-propriétaire.
      });
    }
    if (filtre?.type) liste = liste.filter((d) => d.type === filtre.type);
    if (filtre?.entite_type) liste = liste.filter((d) => d.entite_type === filtre.entite_type);
    if (filtre?.entite_id) liste = liste.filter((d) => d.entite_id === filtre.entite_id);
    if (filtre?.recherche) {
      const q = filtre.recherche.trim().toLowerCase();
      if (q) liste = liste.filter((d) => d.nom_fichier.toLowerCase().includes(q));
    }
    return liste.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async televerserDocument(input: DocumentInput): Promise<Document> {
    const ownerId = await this.requireOwnerId();
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const nom = input.nom_fichier.trim();
    if (!nom) throw err("ERR_NOT_FOUND");
    // Format : PDF, JPG, PNG uniquement (extension + MIME quand connu).
    const extension = nom.split(".").pop()?.toLowerCase() ?? "";
    const mimeOk = !input.mime_type || FORMATS_DOCUMENT_ACCEPTES.includes(input.mime_type);
    if (!["pdf", "jpg", "jpeg", "png"].includes(extension) || !mimeOk) {
      throw err("ERR_DOCUMENT_FORMAT");
    }
    if (input.taille_octets !== undefined && input.taille_octets !== null && input.taille_octets > TAILLE_MAX_DOCUMENT_OCTETS) {
      throw err("ERR_DOCUMENT_TROP_GROS");
    }
    // Doublon : même nom + même entité.
    if (
      parc.documents.some(
        (d) =>
          d.entite_type === input.entite_type &&
          d.entite_id === input.entite_id &&
          d.nom_fichier.trim().toLowerCase() === nom.toLowerCase()
      )
    ) {
      throw err("ERR_DOCUMENT_DOUBLON");
    }
    const session = await this.getSession();
    const taille = input.taille_octets ?? null;
    // En démo, le contenu n'est conservé que s'il tient en localStorage.
    const contenuConserve =
      input.contenu && taille !== null && taille <= LIMITE_DEMO_CONTENU_OCTETS
        ? input.contenu
        : null;
    const document: Document = {
      id: uid(),
      owner_id: ownerId,
      type: input.type,
      entite_type: input.entite_type,
      entite_id: input.entite_id,
      nom_fichier: nom,
      storage_path: `demo:${uid()}`,
      taille_octets: taille,
      mime_type: input.mime_type ?? null,
      ajoute_par: session?.id ?? null,
      created_at: new Date().toISOString(),
      contenu: contenuConserve,
      contenu_non_conserve: Boolean(input.contenu) && !contenuConserve,
    };
    parc.documents.push(document);
    this.journaliser(
      db,
      "document",
      "document",
      document.id,
      `Document ajouté : ${nom}`,
      session?.id
    );
    saveDb(db);
    return document;
  }

  async renommerDocument(id: string, nomFichier: string): Promise<Document> {
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const idx = parc.documents.findIndex((d) => d.id === id);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    const nom = nomFichier.trim();
    if (
      parc.documents.some(
        (d) =>
          d.id !== id &&
          d.entite_type === parc.documents[idx].entite_type &&
          d.entite_id === parc.documents[idx].entite_id &&
          d.nom_fichier.trim().toLowerCase() === nom.toLowerCase()
      )
    ) {
      throw err("ERR_DOCUMENT_DOUBLON");
    }
    parc.documents[idx] = { ...parc.documents[idx], nom_fichier: nom };
    saveDb(db);
    return parc.documents[idx];
  }

  async supprimerDocument(id: string): Promise<void> {
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    if (!parc.documents.some((d) => d.id === id)) throw err("ERR_NOT_FOUND");
    parc.documents = parc.documents.filter((d) => d.id !== id);
    saveDb(db);
  }

  async telechargerDocument(id: string): Promise<{ url: string; nomFichier: string }> {
    const db = loadDb();
    const parc = this.cols(db);
    const doc = parc.documents.find((d) => d.id === id);
    if (!doc) throw err("ERR_NOT_FOUND");
    if (!doc.contenu) throw err("ERR_DOCUMENT_CONTENU_ABSENT");
    return { url: doc.contenu, nomFichier: doc.nom_fichier };
  }

  async listerActivites(immeubleId?: string | null): Promise<Activite[]> {
    const db = loadDb();
    const parc = this.cols(db);
    let liste = filtrerActivites(parc.activites, immeubleId ?? null, parc.appartements);
    const visibles = this.immeublesVisibles(db);
    if (visibles) {
      // Co-propriétaire : événements de ses biens partagés uniquement.
      liste = liste.filter((a) => {
        if (a.entite_type === "immeuble") return a.entite_id !== null && visibles.has(a.entite_id);
        if (a.entite_type === "appartement") {
          const imm = a.entite_id ? this.immeubleDeAppartement(db, a.entite_id) : null;
          return imm !== null && visibles.has(imm);
        }
        if (a.entite_type === "coproprietaire") {
          const cop = parc.coproprietaires.find((c) => c.id === a.entite_id);
          return cop !== undefined && visibles.has(cop.immeuble_id);
        }
        if (a.entite_type === "loyer") {
          const imm = a.entite_id ? this.immeubleDeEcheance(db, a.entite_id) : null;
          return imm !== null && visibles.has(imm);
        }
        if (a.entite_type === "depense") {
          const dep = parc.depenses.find((x) => x.id === a.entite_id);
          return dep !== undefined && visibles.has(dep.immeuble_id);
        }
        if (a.entite_type === "bail") {
          const imm = a.entite_id ? this.immeubleDeBail(db, a.entite_id) : null;
          return imm !== null && visibles.has(imm);
        }
        if (a.entite_type === "document") {
          const doc = parc.documents.find((x) => x.id === a.entite_id);
          if (!doc) return false;
          if (doc.entite_type === "immeuble") return visibles.has(doc.entite_id);
          const imm = doc.entite_type === "appartement"
            ? this.immeubleDeAppartement(db, doc.entite_id)
            : doc.entite_type === "bail"
              ? this.immeubleDeBail(db, doc.entite_id)
              : null;
          return imm !== null && visibles.has(imm);
        }
        return false; // alerte, locataire, immeuble inconnu : hors périmètre.
      });
    }
    return liste;
  }

  async getTaux(deviseSource: Devise, deviseCible: Devise): Promise<TauxResultat | null> {
    if (deviseSource === deviseCible) return null;
    return trouverTaux(loadDb().taux, deviseSource, deviseCible);
  }

  async listerTaux(): Promise<TauxChange[]> {
    return loadDb().taux.slice().sort((a, b) => b.date_taux.localeCompare(a.date_taux));
  }

  async saisirTauxManuel(input: TauxManuelInput): Promise<TauxChange> {
    await this.requireOwnerId();
    if (!input.taux || input.taux <= 0) throw err("ERR_MONTANT_NON_POSITIF");
    if (input.devise_source === input.devise_cible) throw err("ERR_TAUX_MEME_DEVISE");
    const db = loadDb();
    this.verifierEcriture(db);
    const taux: TauxChange = {
      id: uid(),
      devise_source: input.devise_source,
      devise_cible: input.devise_cible,
      taux: input.taux,
      date_taux: input.date_taux,
      source: "manuel",
      created_at: new Date().toISOString(),
    };
    db.taux.push(taux);
    saveDb(db);
    return taux;
  }

  async genererAlertes(): Promise<Alerte[]> {
    const ownerId = await this.requireOwnerId();
    const db = loadDb();
    const parc = this.cols(db);
    const session = await this.getSession();
    const echeances = await this.listerEcheances();
    const visibles = this.immeublesVisibles(db);
    // Session restreinte : les alertes ne se génèrent que sur ses biens
    // (la lecture est déjà filtrée, mais on ne crée pas d'alertes pour
    // les autres immeubles — ni d'e-mails au propriétaire à leur sujet).
    const bauxVisibles = visibles
      ? parc.baux.filter((b) => {
          const imm = this.immeubleDeAppartement(db, b.appartement_id);
          return imm !== null && visibles.has(imm);
        })
      : parc.baux;
    const appartementsVisibles = visibles
      ? parc.appartements.filter((a) => visibles.has(a.immeuble_id))
      : parc.appartements;
    const paiementsVisibles = visibles
      ? parc.paiements.filter((p) => {
          const imm = this.immeubleDeEcheance(db, p.echeance_id);
          return imm !== null && visibles.has(imm);
        })
      : parc.paiements;
    const candidates = genererAlertesCandidates({
      baux: bauxVisibles,
      echeances,
      paiements: paiementsVisibles,
      appartements: appartementsVisibles,
      abonnement: db.abonnement,
      seuilVacanceJours: db.preferences.seuil_vacance_jours,
      langue: db.profil.langue,
    });
    const existantes = new Set(parc.alertes.map((a) => a.dedup_key));
    const coupe = new Set<TypeAlerte>(db.preferences.types_coupes);
    for (const c of candidates) {
      if (existantes.has(c.dedup_key)) continue; // idempotence : pas de doublon.
      if (coupe.has(c.type)) continue; // type coupé dans les Paramètres.
      // E-mail (Correctif 2, spec §10) : envoyé au propriétaire à la
      // création de l'alerte, sauf canal coupé (« desactive ») — jamais
      // de faux envoi : sans fournisseur configuré, le statut reste
      // « non_configuré ». Un échec est signalé sans bloquer les autres
      // canaux ni la génération de l'alerte.
      let emailStatut: Alerte["email_statut"] = "non_configuré";
      if (!db.preferences.canal_email) {
        emailStatut = "desactive";
      } else if (!db.profil.email) {
        emailStatut = "echec";
      } else {
        try {
          const resultat = await this.envoyerEmailAlerteFn({
            destinataire: db.profil.email,
            sujet: `CizaImmo — ${c.message}`,
            texte: c.message,
            langue: db.profil.langue,
          });
          emailStatut = statutEmailDepuisResultat(resultat);
        } catch {
          emailStatut = "echec";
        }
      }
      const alerte: Alerte = {
        id: uid(),
        owner_id: ownerId,
        type: c.type,
        entite_type: c.entite_type,
        entite_id: c.entite_id,
        message: c.message,
        statut: "active",
        canal: "app",
        dedup_key: c.dedup_key,
        urgence: c.urgence,
        email_statut: emailStatut,
        // WhatsApp (module 6) : « desactive » si le canal est coupé dans
        // les Paramètres, sinon « non_configuré » tant qu'aucun envoi réel
        // n'a eu lieu — jamais de faux envoi.
        whatsapp_statut: db.preferences.canal_whatsapp ? "non_configuré" : "desactive",
        traitee_le: null,
        created_at: new Date().toISOString(),
      };
      parc.alertes.push(alerte);
      this.journaliser(db, "alerte", "alerte", alerte.id, `Alerte déclenchée : ${c.message}`, session?.id);
    }
    saveDb(db);
    return this.listerAlertes();
  }

  async listerAlertes(): Promise<Alerte[]> {
    const db = loadDb();
    const parc = this.cols(db);
    const visibles = this.immeublesVisibles(db);
    let liste = parc.alertes.slice();
    if (visibles) {
      // Co-propriétaire : alertes de ses biens partagés uniquement
      // (les alertes d'abonnement ne le concernent jamais).
      liste = liste.filter((a) => {
        if (a.entite_type === "immeuble") return a.entite_id !== null && visibles.has(a.entite_id);
        if (a.entite_type === "appartement") {
          const imm = a.entite_id ? this.immeubleDeAppartement(db, a.entite_id) : null;
          return imm !== null && visibles.has(imm);
        }
        if (a.entite_type === "bail") {
          const imm = a.entite_id ? this.immeubleDeBail(db, a.entite_id) : null;
          return imm !== null && visibles.has(imm);
        }
        if (a.entite_type === "loyer") {
          const imm = a.entite_id ? this.immeubleDeEcheance(db, a.entite_id) : null;
          return imm !== null && visibles.has(imm);
        }
        return false;
      });
    }
    const ordreUrgence = { haute: 0, moyenne: 1, basse: 2 } as const;
    return liste.sort((a, b) => {
      if (a.statut !== b.statut) return a.statut === "active" ? -1 : 1;
      return ordreUrgence[a.urgence] - ordreUrgence[b.urgence] || b.created_at.localeCompare(a.created_at);
    });
  }

  async marquerAlerteTraitee(id: string): Promise<Alerte> {
    const db = loadDb();
    const parc = this.cols(db);
    const idx = parc.alertes.findIndex((a) => a.id === id);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    const session = await this.getSession();
    parc.alertes[idx] = { ...parc.alertes[idx], statut: "traitee", traitee_le: new Date().toISOString() };
    this.journaliser(db, "alerte", "alerte", id, `Alerte traitée : ${parc.alertes[idx].message}`, session?.id);
    saveDb(db);
    return parc.alertes[idx];
  }

  async modifierProfil(patch: ProfilPatch): Promise<Profil> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    // Co-propriétaire et gestionnaire : le profil du compte appartient
    // au propriétaire — une session restreinte ne le modifie pas
    // (sinon le gestionnaire réécrirait le profil du propriétaire).
    // Session plateforme : idem (la console ne touche pas au profil client).
    if (
      session.id.startsWith("coprop:") ||
      session.id.startsWith("gestionnaire:") ||
      session.id.startsWith("plateforme:")
    ) {
      throw err("ERR_ROLE_LECTURE_SEULE");
    }
    const db = loadDb();
    db.profil = {
      ...db.profil,
      nom: patch.nom !== undefined ? patch.nom.trim() : db.profil.nom,
      pays: patch.pays !== undefined ? patch.pays : db.profil.pays,
      telephone: patch.telephone !== undefined ? patch.telephone : db.profil.telephone ?? null,
      langue: patch.langue ?? db.profil.langue,
      devise_principale: patch.devise_principale ?? db.profil.devise_principale,
      // Dossier employé (2026-11-08) : adresse postale de l'employé.
      adresse: patch.adresse !== undefined ? patch.adresse : db.profil.adresse ?? null,
      adresse_ville:
        patch.adresse_ville !== undefined ? patch.adresse_ville : db.profil.adresse_ville ?? null,
      adresse_code_postal:
        patch.adresse_code_postal !== undefined
          ? patch.adresse_code_postal
          : db.profil.adresse_code_postal ?? null,
      adresse_pays:
        patch.adresse_pays !== undefined ? patch.adresse_pays : db.profil.adresse_pays ?? null,
    };
    saveDb(db);
    return db.profil;
  }

  async getPreferencesNotifications(): Promise<PreferencesNotifications> {
    return loadDb().preferences;
  }

  async sauvegarderPreferencesNotifications(
    prefs: Partial<Omit<PreferencesNotifications, "owner_id" | "updated_at">>
  ): Promise<PreferencesNotifications> {
    const db = loadDb();
    // Le propriétaire ne peut pas couper les alertes d'abonnement (spec §10).
    const typesCoupes = (prefs.types_coupes ?? db.preferences.types_coupes).filter(
      (t) => t !== "essai_abonnement"
    );
    db.preferences = {
      ...db.preferences,
      ...prefs,
      types_coupes: typesCoupes,
      canal_whatsapp:
        prefs.canal_whatsapp !== undefined
          ? prefs.canal_whatsapp
          : db.preferences.canal_whatsapp ?? true,
      seuil_vacance_jours:
        prefs.seuil_vacance_jours !== undefined && prefs.seuil_vacance_jours >= 7
          ? prefs.seuil_vacance_jours
          : db.preferences.seuil_vacance_jours,
      updated_at: new Date().toISOString(),
    };
    saveDb(db);
    return db.preferences;
  }

  async listerGestionnaires(): Promise<GestionnaireInvite[]> {
    // Seul le propriétaire gère les invitations (spec §2) : une session
    // restreinte ne voit pas la liste des gestionnaires.
    if (this.sessionEstCoproprietaire() || this.sessionEstGestionnaire()) return [];
    return loadDb().gestionnaires.slice().sort((a, b) => a.email.localeCompare(b.email));
  }

  async inviterGestionnaire(email: string, immeubleIds: string[]): Promise<GestionnaireInvite> {
    const ownerId = await this.requireOwnerId();
    this.verifierProprietaire();
    const adresse = email.trim().toLowerCase();
    if (!emailValide(adresse)) throw err("ERR_EMAIL_INVALIDE");
    if (immeubleIds.length === 0) throw err("ERR_GESTIONNAIRE_SANS_IMMEUBLE");
    const db = loadDb();
    if (db.gestionnaires.some((g) => g.email.toLowerCase() === adresse)) {
      throw err("ERR_GESTIONNAIRE_DEJA_INVITE");
    }
    const invite: GestionnaireInvite = {
      id: uid(),
      owner_id: ownerId,
      email: adresse,
      nom: null,
      immeuble_ids: immeubleIds,
      statut: "invite",
      created_at: new Date().toISOString(),
    };
    db.gestionnaires.push(invite);
    saveDb(db);
    return invite;
  }

  async retirerGestionnaire(id: string): Promise<void> {
    this.verifierProprietaire();
    const db = loadDb();
    if (!db.gestionnaires.some((g) => g.id === id)) throw err("ERR_NOT_FOUND");
    // Retrait = perte d'accès immédiate (spec §14).
    db.gestionnaires = db.gestionnaires.filter((g) => g.id !== id);
    saveDb(db);
  }

  // ==========================================================================
  // MODULE 6 — Indivision familiale, vitrine publique, taux automatiques,
  // WhatsApp (spec §6 suite, §4, §9, §10). RÈGLE DURE : CizaImmo calcule
  // et affiche la répartition, mais n'encaisse ni ne distribue AUCUN
  // argent entre co-propriétaires ; WhatsApp n'est jamais simulé.
  // ==========================================================================

  async listerCoproprietaires(immeubleId: string): Promise<Coproprietaire[]> {
    const db = loadDb();
    const parc = this.cols(db);
    const visibles = this.immeublesVisibles(db);
    if (visibles && !visibles.has(immeubleId)) return [];
    return parc.coproprietaires
      .filter((c) => c.immeuble_id === immeubleId)
      .slice()
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }

  async inviterCoproprietaire(
    immeubleId: string,
    input: CoproprietaireInput
  ): Promise<Coproprietaire> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    this.verifierProprietaire();
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    this.verifierPlanIndivision(db);
    const immeuble = parc.immeubles.find((i) => i.id === immeubleId);
    if (!immeuble) throw err("ERR_NOT_FOUND");
    const adresse = input.email.trim().toLowerCase();
    if (!emailValide(adresse)) throw err("ERR_EMAIL_INVALIDE");
    if (!Number.isFinite(input.part) || input.part <= 0 || input.part > 100) {
      throw err("ERR_PART_INVALIDE");
    }
    if (
      parc.coproprietaires.some(
        (c) => c.immeuble_id === immeubleId && c.email.trim().toLowerCase() === adresse
      )
    ) {
      throw err("ERR_PART_EMAIL_UNIQUE");
    }
    const sommeApres =
      sommeParts(parc.coproprietaires.filter((c) => c.immeuble_id === immeubleId)) +
      input.part;
    if (sommeApres > 100 + 0.01) throw err("ERR_PARTS_TOTAL");
    const coproprietaire: Coproprietaire = {
      id: uid(),
      immeuble_id: immeubleId,
      nom: input.nom.trim(),
      email: adresse,
      telephone: input.telephone?.trim() ? input.telephone.trim() : null,
      part: input.part,
      statut: "invite",
      created_at: new Date().toISOString(),
    };
    parc.coproprietaires.push(coproprietaire);
    this.journaliser(
      db,
      "coproprietaire",
      "coproprietaire",
      coproprietaire.id,
      `Co-propriétaire invité : ${coproprietaire.nom} (${coproprietaire.email}, part ${coproprietaire.part} %) — ${immeuble.nom}`,
      session.id
    );
    saveDb(db);
    return coproprietaire;
  }

  async definirParts(
    immeubleId: string,
    parts: CoproprietaireInput[]
  ): Promise<Coproprietaire[]> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    this.verifierProprietaire();
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    this.verifierPlanIndivision(db);
    const immeuble = parc.immeubles.find((i) => i.id === immeubleId);
    if (!immeuble) throw err("ERR_NOT_FOUND");
    // Validation complète AVANT tout enregistrement : somme = 100 %,
    // e-mails uniques, parts valides.
    const normalisees = parts.map((p) => ({
      nom: p.nom.trim(),
      email: p.email.trim().toLowerCase(),
      telephone: p.telephone?.trim() ? p.telephone.trim() : null,
      part: p.part,
    }));
    for (const p of normalisees) {
      if (!p.nom) throw err("ERR_PART_INVALIDE");
      if (!emailValide(p.email)) throw err("ERR_EMAIL_INVALIDE");
    }
    const validation = validerParts(normalisees);
    if (!validation.valide) throw err(validation.code ?? "ERR_PARTS_TOTAL");
    const anciens = parc.coproprietaires.filter((c) => c.immeuble_id === immeubleId);
    const parEmail = new Map(anciens.map((c) => [c.email.trim().toLowerCase(), c]));
    const gardes = new Set<string>();
    const resultat: Coproprietaire[] = [];
    for (const p of normalisees) {
      const ancien = parEmail.get(p.email);
      if (ancien) {
        gardes.add(ancien.id);
        // Traçabilité : toute modification de part est journalisée
        // (auteur, date, ancienne et nouvelle valeur).
        if (ancien.part !== p.part) {
          this.journaliser(
            db,
            "coproprietaire",
            "coproprietaire",
            ancien.id,
            `Part modifiée : ${ancien.nom} (${ancien.email}) — ${ancien.part} % → ${p.part} % — ${immeuble.nom}`,
            session.id
          );
        }
        const maj: Coproprietaire = {
          ...ancien,
          nom: p.nom,
          telephone: p.telephone,
          part: p.part,
        };
        const idx = parc.coproprietaires.findIndex((c) => c.id === ancien.id);
        parc.coproprietaires[idx] = maj;
        resultat.push(maj);
      } else {
        const cree: Coproprietaire = {
          id: uid(),
          immeuble_id: immeubleId,
          nom: p.nom,
          email: p.email,
          telephone: p.telephone,
          part: p.part,
          statut: "invite",
          created_at: new Date().toISOString(),
        };
        parc.coproprietaires.push(cree);
        this.journaliser(
          db,
          "coproprietaire",
          "coproprietaire",
          cree.id,
          `Co-propriétaire invité : ${cree.nom} (${cree.email}, part ${cree.part} %) — ${immeuble.nom}`,
          session.id
        );
        resultat.push(cree);
      }
    }
    for (const ancien of anciens) {
      if (!gardes.has(ancien.id)) {
        parc.coproprietaires = parc.coproprietaires.filter((c) => c.id !== ancien.id);
        this.journaliser(
          db,
          "coproprietaire",
          "coproprietaire",
          ancien.id,
          `Co-propriétaire retiré : ${ancien.nom} (${ancien.email}, part ${ancien.part} %) — ${immeuble.nom}`,
          session.id
        );
      }
    }
    saveDb(db);
    return resultat.sort((a, b) => a.nom.localeCompare(b.nom));
  }

  async retirerCoproprietaire(id: string): Promise<void> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    this.verifierProprietaire();
    const db = loadDb();
    const parc = this.cols(db);
    this.verifierEcriture(db);
    const cop = parc.coproprietaires.find((c) => c.id === id);
    if (!cop) throw err("ERR_COPROPRIETAIRE_INTROUVABLE");
    const immeuble = parc.immeubles.find((i) => i.id === cop.immeuble_id);
    parc.coproprietaires = parc.coproprietaires.filter((c) => c.id !== id);
    this.journaliser(
      db,
      "coproprietaire",
      "coproprietaire",
      id,
      `Co-propriétaire retiré : ${cop.nom} (${cop.email}, part ${cop.part} %) — ${immeuble?.nom ?? "—"}`,
      session.id
    );
    saveDb(db);
  }

  async accepterInvitationCoproprietaire(id: string): Promise<Coproprietaire> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    const db = loadDb();
    const parc = this.cols(db);
    const idx = parc.coproprietaires.findIndex((c) => c.id === id);
    if (idx < 0) throw err("ERR_COPROPRIETAIRE_INTROUVABLE");
    const cop = parc.coproprietaires[idx];
    const estProprietaire = !this.sessionEstCoproprietaire();
    const estConcerne =
      session.email.trim().toLowerCase() === cop.email.trim().toLowerCase();
    if (!estProprietaire && !estConcerne) throw err("ERR_ROLE_LECTURE_SEULE");
    if (cop.statut === "actif") return cop;
    const maj: Coproprietaire = { ...cop, statut: "actif" };
    parc.coproprietaires[idx] = maj;
    const immeuble = parc.immeubles.find((i) => i.id === cop.immeuble_id);
    this.journaliser(
      db,
      "coproprietaire",
      "coproprietaire",
      id,
      `Invitation acceptée : ${cop.nom} (${cop.email}) — accès lecture seule sur ${immeuble?.nom ?? "—"}`,
      session.id
    );
    saveDb(db);
    return maj;
  }

  // ==========================================================================
  // v1.6 « Vitrine vérifiée » — helpers contact du dossier / divergence.
  // Le contact ATTENDU d'une annonce est celui du DOSSIER : le
  // gestionnaire rattaché ACTIF (contexte « proprietaire ») de
  // l'immeuble s'il existe, sinon le propriétaire du parc.
  // ==========================================================================

  private contactDossierAttendu(
    db: DemoDb,
    parc: { profil: Profil },
    immeuble: Immeuble
  ): { contact: ContactPublic; role: "gestionnaire" | "proprietaire" } {
    const rattachement = db.plateforme.rattachements.find(
      (r) =>
        r.contexte === "proprietaire" &&
        r.proprietaire_id === parc.profil.id &&
        r.statut === "actif" &&
        r.immeuble_ids.includes(immeuble.id)
    );
    if (rattachement) {
      const entree = db.plateforme.comptesClients.find(
        (c) =>
          c.id === rattachement.gestionnaire_id ||
          c.email.toLowerCase() === rattachement.gestionnaire_id.toLowerCase() ||
          c.email.toLowerCase() === rattachement.gestionnaire_email.toLowerCase()
      );
      if (entree) {
        return {
          contact: { nom: entree.nom, email: entree.email, telephone: entree.telephone ?? null },
          role: "gestionnaire",
        };
      }
      return {
        contact: {
          nom: rattachement.gestionnaire_nom ?? rattachement.gestionnaire_email,
          email: rattachement.gestionnaire_email,
          telephone: rattachement.gestionnaire_telephone ?? null,
        },
        role: "gestionnaire",
      };
    }
    return {
      contact: {
        nom: parc.profil.nom,
        email: parc.profil.email,
        telephone: parc.profil.telephone ?? null,
      },
      role: "proprietaire",
    };
  }

  /** Divergence annonce/dossier : champ annoncé NON VIDE et différent
   * du dossier (e-mail normalisé trim/minuscules ; téléphone réduit
   * aux chiffres et au « + »). */
  private contactsDivergent(
    annonce: { contact_telephone: string | null; contact_email: string | null },
    dossier: ContactPublic
  ): boolean {
    const normEmail = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
    const normTel = (v: string | null | undefined) => (v ?? "").replace(/[^0-9+]/g, "");
    const emailAnnonce = normEmail(annonce.contact_email);
    if (emailAnnonce && emailAnnonce !== normEmail(dossier.email)) return true;
    const telAnnonce = normTel(annonce.contact_telephone);
    if (telAnnonce && telAnnonce !== normTel(dossier.telephone)) return true;
    return false;
  }

  /** Parc principal sous forme ParcDemo (références directes à db.*). */
  private parcPrincipal(db: DemoDb): ParcDemo {
    return {
      profil: db.profil,
      immeubles: db.immeubles,
      appartements: db.appartements,
      locataires: db.locataires,
      baux: db.baux,
      echeances: db.echeances,
      paiements: db.paiements,
      depenses: db.depenses,
      documents: db.documents,
      activites: db.activites,
      alertes: db.alertes,
      coproprietaires: db.coproprietaires,
    };
  }

  async listerAnnoncesPubliques(): Promise<AnnoncePublique[]> {
    // Page publique : aucune session requise. Seuls les appartements
    // publiés, vacants ou réservés — jamais de coordonnée de locataire.
    // v1.6 : seules les annonces APPROUVÉES par un Admin s'affichent.
    const db = loadDb();
    return db.appartements
      .filter((a) => a.vitrine && a.vitrine_statut === "approuve" && !a.archive && (a.statut === "vacant" || a.statut === "reserve"))
      .map((a) => this.construireAnnonce(db, a))
      .filter((x): x is AnnoncePublique => x !== null)
      .sort((a, b) =>
        a.ville.localeCompare(b.ville) ||
        a.appartement.numero.localeCompare(b.appartement.numero, undefined, { numeric: true })
      );
  }

  async getAnnoncePublique(appartementId: string): Promise<AnnoncePublique | null> {
    const db = loadDb();
    const apt = db.appartements.find((a) => a.id === appartementId);
    if (!apt || !apt.vitrine || apt.vitrine_statut !== "approuve" || apt.archive || (apt.statut !== "vacant" && apt.statut !== "reserve")) {
      return null;
    }
    return this.construireAnnonce(db, apt);
  }

  private construireAnnonce(db: DemoDb, appartement: Appartement): AnnoncePublique | null {
    const immeuble = db.immeubles.find((i) => i.id === appartement.immeuble_id);
    if (!immeuble) return null;
    // v1.6 : contact AFFICHÉ = celui de l'annonce s'il est renseigné,
    // sinon le contact du dossier (parc principal uniquement — les
    // annonces publiques démo ne lisent que db.appartements).
    const dossier = this.contactDossierAttendu(db, { profil: db.profil }, immeuble);
    const contact: ContactPublic =
      appartement.contact_telephone !== null || appartement.contact_email !== null
        ? {
            nom: appartement.contact_nom ?? dossier.contact.nom,
            email: appartement.contact_email,
            telephone: appartement.contact_telephone,
          }
        : dossier.contact;
    return {
      appartement,
      immeuble_id: immeuble.id,
      immeuble_nom: immeuble.nom,
      ville: immeuble.ville,
      pays: immeuble.pays,
      adresse: immeuble.adresse,
      quartier: immeuble.quartier ?? null,
      contact,
    };
  }

  // ==========================================================================
  // v1.6 « Vitrine vérifiée » — demande / retrait / validation Admin.
  // Miroir démo des RPC base : mêmes codes d'erreur, mêmes transitions.
  // ==========================================================================

  async demanderPublicationVitrine(appartementId: string): Promise<Appartement> {
    const db = loadDb();
    const parc = this.cols(db);
    const apt = parc.appartements.find((a) => a.id === appartementId);
    if (!apt) throw err("ERR_NOT_FOUND");
    if (this.sessionGestionnaireEmail()) {
      const visibles = this.immeublesVisibles(db);
      if (visibles && !visibles.has(apt.immeuble_id)) throw err("ERR_VITRINE_ACCES");
    }
    if (this.sessionEstCoproprietaire()) throw err("ERR_VITRINE_ACCES");
    this.verifierEcriture(db);
    // Plan : la vitrine vérifiée exige Pro ou Agence — parc principal
    // uniquement (le parc Ciza Group est un compte interne, sans plan).
    if (this.parcActif(db).estPrincipal) {
      const plan = db.abonnement.plan;
      if (plan !== "pro" && plan !== "agence") throw err("ERR_VITRINE_PLAN");
    }
    if (apt.statut !== "vacant" && apt.statut !== "reserve") throw err("ERR_VITRINE_STATUT");
    if (!apt.photos || apt.photos.length < 1 || apt.photos.length > 10) {
      throw err("ERR_VITRINE_PHOTOS");
    }
    if (!apt.contact_telephone?.trim() && !apt.contact_email?.trim()) {
      throw err("ERR_VITRINE_CONTACT_MANQUANT");
    }
    const immeuble = parc.immeubles.find((i) => i.id === apt.immeuble_id);
    if (immeuble) {
      const dossier = this.contactDossierAttendu(db, parc, immeuble);
      if (
        this.contactsDivergent(apt, dossier.contact) &&
        !apt.contact_justification?.trim()
      ) {
        throw err("ERR_JUSTIFICATION_CONTACT");
      }
    }
    apt.vitrine = true;
    apt.vitrine_statut = "en_attente";
    apt.vitrine_motif_refus = null;
    apt.vitrine_valide_par = null;
    apt.vitrine_valide_le = null;
    saveDb(db);
    return apt;
  }

  async retirerPublicationVitrine(appartementId: string): Promise<Appartement> {
    const db = loadDb();
    const parc = this.cols(db);
    const apt = parc.appartements.find((a) => a.id === appartementId);
    if (!apt) throw err("ERR_NOT_FOUND");
    if (this.sessionGestionnaireEmail()) {
      const visibles = this.immeublesVisibles(db);
      if (visibles && !visibles.has(apt.immeuble_id)) throw err("ERR_VITRINE_ACCES");
    }
    if (this.sessionEstCoproprietaire()) throw err("ERR_VITRINE_ACCES");
    this.verifierEcriture(db);
    apt.vitrine = false;
    apt.vitrine_statut = "non_publie";
    apt.vitrine_motif_refus = null;
    apt.vitrine_valide_par = null;
    apt.vitrine_valide_le = null;
    saveDb(db);
    return apt;
  }

  async listerVitrineAValider(): Promise<AnnonceAValider[]> {
    const db = loadDb();
    this.acteurPlateforme(db);
    const parcs: ParcDemo[] = [this.parcPrincipal(db), db.parcCizaGroup];
    const resultat: AnnonceAValider[] = [];
    for (const parc of parcs) {
      for (const apt of parc.appartements) {
        if (apt.vitrine_statut !== "en_attente") continue;
        const immeuble = parc.immeubles.find((i) => i.id === apt.immeuble_id);
        if (!immeuble) continue;
        const entree = db.plateforme.comptesClients.find(
          (c) =>
            c.id === parc.profil.id ||
            c.email.toLowerCase() === parc.profil.email.toLowerCase()
        );
        const dossier = this.contactDossierAttendu(db, parc, immeuble);
        resultat.push({
          appartement: apt,
          immeuble_id: immeuble.id,
          immeuble_nom: immeuble.nom,
          immeuble_adresse: immeuble.adresse,
          immeuble_quartier: immeuble.quartier ?? null,
          immeuble_ville: immeuble.ville,
          proprietaire_id: parc.profil.id,
          proprietaire_nom: parc.profil.nom,
          proprietaire_display_id: entree?.display_id ?? parc.profil.display_id ?? null,
          contact_annonce: {
            nom: apt.contact_nom ?? "—",
            email: apt.contact_email,
            telephone: apt.contact_telephone,
          },
          contact_dossier: dossier.contact,
          contact_dossier_role: dossier.role,
          justification: apt.contact_justification,
          divergent: this.contactsDivergent(apt, dossier.contact),
        });
      }
    }
    return resultat;
  }

  async validerPublicationVitrine(
    appartementId: string,
    accepter: boolean,
    motif?: string | null
  ): Promise<Appartement> {
    const db = loadDb();
    const acteur = this.acteurPlateforme(db);
    const parcs: ParcDemo[] = [this.parcPrincipal(db), db.parcCizaGroup];
    let trouve: { parc: ParcDemo; apt: Appartement } | null = null;
    for (const parc of parcs) {
      const apt = parc.appartements.find((a) => a.id === appartementId);
      if (apt) {
        trouve = { parc, apt };
        break;
      }
    }
    if (!trouve) throw err("ERR_NOT_FOUND");
    const { parc, apt } = trouve;
    if (apt.vitrine_statut !== "en_attente") throw err("ERR_VITRINE_PAS_EN_ATTENTE");
    if (accepter) {
      apt.vitrine_statut = "approuve";
      apt.vitrine_valide_par = acteur.id;
      apt.vitrine_valide_le = new Date().toISOString();
      apt.vitrine_motif_refus = null;
    } else {
      if (!motif?.trim()) throw err("ERR_VITRINE_MOTIF_REQUIS");
      apt.vitrine_statut = "refuse";
      apt.vitrine_motif_refus = motif.trim();
      apt.vitrine_valide_par = acteur.id;
      apt.vitrine_valide_le = new Date().toISOString();
    }
    this.journaliserAudit(
      db,
      acteur,
      accepter ? "vitrine_approuvee" : "vitrine_refusee",
      "appartement",
      apt.id,
      parc.profil.email,
      { motif: motif ?? null }
    );
    saveDb(db);
    return apt;
  }

  async enregistrerTauxAuto(
    taux: Omit<TauxChange, "id" | "created_at">[]
  ): Promise<TauxChange[]> {
    await this.requireOwnerId();
    const db = loadDb();
    this.verifierEcriture(db);
    const crees: TauxChange[] = [];
    for (const ligne of taux) {
      if (!ligne.taux || ligne.taux <= 0) continue;
      if (ligne.devise_source === ligne.devise_cible) continue;
      // Pas de doublon : même paire, même date, même source.
      const existe = db.taux.some(
        (t) =>
          t.devise_source === ligne.devise_source &&
          t.devise_cible === ligne.devise_cible &&
          t.date_taux.slice(0, 10) === ligne.date_taux.slice(0, 10) &&
          t.source === ligne.source
      );
      if (existe) continue;
      const cree: TauxChange = {
        id: uid(),
        ...ligne,
        date_taux: ligne.date_taux.slice(0, 10),
        created_at: new Date().toISOString(),
      };
      db.taux.push(cree);
      crees.push(cree);
    }
    saveDb(db);
    return crees;
  }

  async marquerAlerteWhatsApp(id: string, statut: StatutWhatsApp): Promise<Alerte> {
    const db = loadDb();
    const parc = this.cols(db);
    const idx = parc.alertes.findIndex((a) => a.id === id);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    parc.alertes[idx] = { ...parc.alertes[idx], whatsapp_statut: statut };
    saveDb(db);
    return parc.alertes[idx];
  }

  // ==========================================================================
  // MODULE 5 — Abonnement & facturation (spec §12).
  // En démo, les changements de plan et les confirmations mobile money
  // sont SIMULÉS et étiquetés DÉMO dans l'interface : aucun vrai paiement,
  // aucun encaissement.
  // ==========================================================================

  async getLimiteBlocs(): Promise<LimiteBlocs> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    // Abonnement réservé au propriétaire (spec §2, §12) : une session
    // restreinte n'y a pas accès — même refus que pour le co-propriétaire.
    if (
      session.id.startsWith("coprop:") ||
      session.id.startsWith("gestionnaire:") ||
      session.id.startsWith("plateforme:")
    ) {
      throw err("ERR_ROLE_LECTURE_SEULE");
    }
    const db = loadDb();
    const abo = this.chargerAbonnement(db);
    const utilises = db.immeubles.filter(
      (i) => i.owner_id === session.id && i.statut === "actif"
    ).length;
    return {
      utilises,
      autorises: limiteBlocs(abo.plan, abo.statut),
      plan: abo.plan,
      statut: abo.statut,
    };
  }

  /**
   * Prix DYNAMIQUE (extension v1.2) : lu dans la source tarifs
   * (db.finance en démo, tarifs_plateforme en réel) — jamais le
   * littéral codé en dur. Repli interne de construirePrixPlans si la
   * source est incomplète.
   */
  private prixDynamique(db: DemoDb, plan: Plan, grille: Grille): number {
    return construirePrixPlans(db.finance.tarifs)[plan][grille];
  }

  /** Émet une facture d'abonnement locale (enregistrement, pas un encaissement). */
  private emettreFacture(
    db: DemoDb,
    plan: Plan,
    moyen: FactureAbonnement["moyen"],
    referenceMobileMoney: string | null,
    debut: string
  ): FactureAbonnement {
    const facture: FactureAbonnement = {
      id: uid(),
      owner_id: db.abonnement.owner_id,
      numero: prochainNumeroFactureAbo(
        db.factures.map((f) => f.numero),
        new Date(debut).getFullYear()
      ),
      plan,
      grille: db.abonnement.grille,
      montant: this.prixDynamique(db, plan, db.abonnement.grille),
      devise: "USD",
      date_emission: debut,
      date_debut: debut,
      date_fin: ajouterMois(debut, 1),
      moyen,
      statut: "payee",
      stripe_invoice_id: null,
      reference_mobile_money: referenceMobileMoney,
      // v1.5 : anonymisée seulement à l'exécution d'une suppression.
      anonymise: false,
    };
    db.factures.push(facture);
    return facture;
  }

  async changerPlan(plan: Plan): Promise<Abonnement> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    if (!["starter", "pro", "agence"].includes(plan)) throw err("ERR_PLAN_INVALIDE");
    const db = loadDb();
    const abo = this.chargerAbonnement(db);
    const maintenant = new Date().toISOString();

    // Même plan : reprise après descente / résiliation programmée, ou
    // renouvellement. Pendant l'essai, le même plan ne change rien.
    if (plan === abo.plan) {
      if (abo.plan_en_attente || abo.resiliation_programmee) {
        abo.plan_en_attente = null;
        abo.date_effet_plan = null;
        abo.resiliation_programmee = false;
        saveDb(db);
        return abo;
      }
      if (abo.statut === "essai") return abo;
      abo.statut = "actif";
      abo.trial_ends_at = null;
      abo.echec_paiement = false;
      abo.grace_ends_at = null;
      abo.debut_periode = maintenant;
      abo.fin_periode = ajouterMois(maintenant, 1);
      this.emettreFacture(db, plan, "demo", null, maintenant);
      saveDb(db);
      return abo;
    }

    // Descente : effective à la fin de la période payée, avec contrôle
    // préalable de la limite de blocs (spec §12).
    if (RANG_PLAN[plan] < RANG_PLAN[abo.plan]) {
      const nbActifs = db.immeubles.filter(
        (i) => i.owner_id === session.id && i.statut === "actif"
      ).length;
      if (nbActifs > LIMITE_BLOCS[plan]) throw err("ERR_DESCENTE_BLOQUEE");
      abo.plan_en_attente = plan;
      abo.date_effet_plan =
        abo.fin_periode ?? abo.trial_ends_at ?? ajouterMois(maintenant, 1);
      saveDb(db);
      return abo;
    }

    // Montée immédiate (ou reprise depuis la lecture seule) : nouvelle
    // période d'1 mois, facture simulée (DÉMO).
    abo.plan = plan;
    abo.plan_en_attente = null;
    abo.date_effet_plan = null;
    abo.resiliation_programmee = false;
    abo.echec_paiement = false;
    abo.grace_ends_at = null;
    abo.statut = "actif";
    abo.trial_ends_at = null;
    abo.debut_periode = maintenant;
    abo.fin_periode = ajouterMois(maintenant, 1);
    this.emettreFacture(db, plan, "demo", null, maintenant);
    saveDb(db);
    return abo;
  }

  /** v1.4 : pack choisi pendant l'essai pour la fin de l'essai. */
  async definirPlanApresEssai(plan: Plan): Promise<Abonnement> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    if (!["starter", "pro", "agence"].includes(plan)) throw err("ERR_PLAN_INVALIDE");
    const db = loadDb();
    const abo = this.chargerAbonnement(db);
    if (abo.statut !== "essai") return abo;
    abo.plan_apres_essai = plan;
    saveDb(db);
    return abo;
  }

  async annulerAbonnement(): Promise<Abonnement> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    const db = loadDb();
    const abo = this.chargerAbonnement(db);
    // Effective en fin de période ; données conservées 90 jours en
    // lecture seule ensuite (transition paresseuse, spec §12).
    if (abo.statut === "essai" || abo.statut === "actif") {
      abo.resiliation_programmee = true;
      saveDb(db);
    }
    return abo;
  }

  async listerFactures(): Promise<FactureAbonnement[]> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    return loadDb()
      .factures.slice()
      .sort((a, b) => b.date_emission.localeCompare(a.date_emission))
      // v1.5 : relire le drapeau d'anonymisation (défaut false pour les
      // factures stockées avant la v1.5).
      .map((f) => ({ ...f, anonymise: f.anonymise ?? false }));
  }

  async signalerEchecPaiement(): Promise<Abonnement> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    const db = loadDb();
    const abo = this.chargerAbonnement(db);
    if (abo.statut === "actif") {
      abo.echec_paiement = true;
      abo.grace_ends_at = ajouterJours(
        new Date().toISOString(),
        GRACE_ECHEC_PAIEMENT_JOURS
      );
      saveDb(db);
    }
    return abo;
  }

  /** Expiration paresseuse des demandes mobile money (24 h, sans frais). */
  private expirerPaiementsMobileMoney(db: DemoDb): boolean {
    const maintenant = Date.now();
    let change = false;
    for (const p of db.paiementsMobileMoney) {
      if (p.statut === "en_attente" && maintenant > new Date(p.expire_le).getTime()) {
        p.statut = "expire";
        change = true;
      }
    }
    if (change) saveDb(db);
    return change;
  }

  async demanderPaiementMobileMoney(
    operateur: OperateurMobileMoney,
    telephone: string,
    plan?: Plan
  ): Promise<PaiementMobileMoney> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    if (!["ecocash", "lumicash", "enoti"].includes(operateur)) {
      throw err("ERR_MM_TELEPHONE_INVALIDE");
    }
    if (!telephoneMobileMoneyValide(telephone)) throw err("ERR_MM_TELEPHONE_INVALIDE");
    const db = loadDb();
    const abo = this.chargerAbonnement(db);
    this.expirerPaiementsMobileMoney(db);
    const planVise = plan ?? abo.plan;
    if (!["starter", "pro", "agence"].includes(planVise)) throw err("ERR_PLAN_INVALIDE");
    const maintenant = new Date().toISOString();
    const paiement: PaiementMobileMoney = {
      id: uid(),
      owner_id: session.id,
      operateur,
      telephone: telephone.trim(),
      montant: this.prixDynamique(db, planVise, abo.grille),
      plan: planVise,
      reference: genererReferenceMobileMoney(),
      statut: "en_attente",
      cree_le: maintenant,
      expire_le: ajouterJours(maintenant, MOBILE_MONEY_EXPIRATION_HEURES / 24),
      confirme_le: null,
    };
    db.paiementsMobileMoney.push(paiement);
    saveDb(db);
    return paiement;
  }

  async confirmerPaiementMobileMoney(reference: string): Promise<PaiementMobileMoney> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    const db = loadDb();
    this.expirerPaiementsMobileMoney(db);
    const paiement = db.paiementsMobileMoney.find((p) => p.reference === reference);
    if (!paiement) throw err("ERR_MM_INTROUVABLE");
    if (paiement.statut === "expire") throw err("ERR_MM_EXPIRE");
    if (paiement.statut !== "en_attente") throw err("ERR_MM_DEJA_TRAITE");
    // Confirmation SIMULÉE (démo) : en réel, seul le webhook confirme.
    const maintenant = new Date().toISOString();
    paiement.statut = "confirme";
    paiement.confirme_le = maintenant;
    const abo = this.chargerAbonnement(db);
    abo.plan = paiement.plan;
    abo.plan_en_attente = null;
    abo.date_effet_plan = null;
    abo.resiliation_programmee = false;
    abo.echec_paiement = false;
    abo.grace_ends_at = null;
    abo.statut = "actif";
    abo.trial_ends_at = null;
    abo.debut_periode = maintenant;
    abo.fin_periode = ajouterMois(maintenant, 1);
    abo.mobile_money_ref = reference;
    this.emettreFacture(db, paiement.plan, "mobile_money", reference, maintenant);
    // Anti-fraude (signal c) : au PREMIER paiement, le pays du moyen de
    // paiement (préfixe mobile money) est capturé ; une contradiction
    // avec la grille attribuée fait passer le compte « a_verifier ».
    if (!db.profil.pays_paiement) {
      const paysPaiement = paysDepuisTelephone(paiement.telephone);
      if (paysPaiement) {
        db.profil.pays_paiement = paysPaiement;
        const statut = evaluerPaysPaiement(
          abo.grille,
          paysPaiement,
          db.finance.parametres.pays_grille_afrique
        );
        if (statut === "a_verifier") db.profil.grille_statut = "a_verifier";
      }
    }
    saveDb(db);
    return paiement;
  }

  async listerPaiementsMobileMoney(): Promise<PaiementMobileMoney[]> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    const db = loadDb();
    this.expirerPaiementsMobileMoney(db);
    return db.paiementsMobileMoney
      .slice()
      .sort((a, b) => b.cree_le.localeCompare(a.cree_le));
  }

  // ==========================================================================
  // EXTENSION v1.2 — CONSOLE PLATEFORME (Admin / Super Admin), approbation
  // des comptes, avis, rattachements, supervision, finances dynamiques.
  // Voir docs/admin-finance-v1.2.md. Toute action est journalisée.
  // ==========================================================================

  /** Acteur plateforme de la session (refus net si non plateforme). */
  private acteurPlateforme(db: DemoDb): {
    id: string;
    email: string;
    nom: string;
    role: "admin" | "super_admin";
  } {
    const email = this.sessionPlateformeEmail();
    if (!email) throw err("ERR_ACCES_PLATEFORME");
    const entree = db.plateforme.comptesAdmins.find(
      (a) => a.email.toLowerCase() === email
    );
    if (!entree || entree.statut === "suspendu") throw err("ERR_ACCES_PLATEFORME");
    // v1.5 (miroir de est_admin_plateforme) : un employé Admin dont
    // l'accès console a été coupé par le Super Admin
    // (acces_admin_actif = false, sur l'entrée Admin OU sur le profil
    // lié par e-mail) est refusé par CETTE garde centrale — toutes les
    // méthodes plateforme passent par ici. Le Super Admin n'est pas
    // concerné par la coupure d'accès employé.
    if (entree.role === "admin") {
      let accesActif = entree.acces_admin_actif ?? true;
      if (db.profil.email.toLowerCase() === email) {
        accesActif = accesActif && (db.profil.acces_admin_actif ?? true);
      }
      const lie = db.plateforme.comptesClients.find(
        (c) => c.email.toLowerCase() === email
      );
      if (lie) accesActif = accesActif && (lie.acces_admin_actif ?? true);
      if (!accesActif) throw err("ERR_ACCES_PLATEFORME");
    }
    return { id: entree.id, email: entree.email, nom: entree.nom, role: entree.role };
  }

  private acteurSuperAdmin(db: DemoDb) {
    const acteur = this.acteurPlateforme(db);
    if (acteur.role !== "super_admin") throw err("ERR_SUPER_ADMIN_REQUIS");
    return acteur;
  }

  private journaliserAudit(
    db: DemoDb,
    // v1.5 : l'acteur peut aussi être un CLIENT (demande / annulation
    // de suppression de son propre compte) — acteur_role reflète alors
    // son rôle réel (proprietaire / gestionnaire…), même si le type
    // EntreeAudit historique ne déclare que les rôles plateforme.
    acteur: { id: string; email: string; role: string; nom?: string },
    action: string,
    cibleType: CibleAudit,
    cibleId: string | null,
    cibleEmail: string | null,
    details?: Record<string, unknown> | null
  ): void {
    // Audit enrichi (2026-11-07) : le nom de l'acteur est FIGÉ dans
    // l'entrée (miroir du snapshot réel) — fourni par l'appelant
    // quand il l'a (acteurPlateforme), sinon résolu depuis le
    // registre (profil principal, admins, clients).
    const acteurNom =
      acteur.nom ??
      (db.profil.id === acteur.id ? db.profil.nom : null) ??
      db.plateforme.comptesAdmins.find((a) => a.id === acteur.id)?.nom ??
      db.plateforme.comptesClients.find((c) => c.id === acteur.id)?.nom ??
      null;
    db.plateforme.journal.push({
      id: uid(),
      acteur_id: acteur.id,
      acteur_email: acteur.email,
      acteur_nom: acteurNom,
      acteur_role: acteur.role as EntreeAudit["acteur_role"],
      action,
      cible_type: cibleType,
      cible_id: cibleId,
      cible_email: cibleEmail,
      details: details ?? null,
      created_at: new Date().toISOString(),
    });
  }

  /** Envoi e-mail via la chaîne existante — statut honnête, jamais simulé. */
  private async envoyerEmailPlateforme(
    destinataire: string,
    sujet: string,
    texte: string,
    langue?: "fr" | "en",
    piecesJointes?: { nom: string; contenuBase64: string }[]
  ): Promise<Avis["statut_envoi"]> {
    try {
      const resultat = await this.envoyerEmailAlerteFn({
        destinataire,
        sujet,
        texte,
        langue,
        piecesJointes,
      });
      return statutEmailDepuisResultat(resultat);
    } catch {
      return "echec";
    }
  }

  /** v1.3 : dossier complet du compte principal = photo + pièce d'identité reçues. */
  private dossierCompletPrincipal(db: DemoDb): boolean {
    return (
      Boolean(db.profil.photo_profil_path) &&
      db.documents.some(
        (d) =>
          d.entite_type === "compte" &&
          d.type === "piece_identite" &&
          d.entite_id === db.profil.id
      )
    );
  }

  /** Vue console du compte principal (le compte client « réel » de la démo). */
  private comptePrincipal(db: DemoDb): ComptePlateforme {
    const abo = this.chargerAbonnement(db);
    const vue = {
      plan: abo.plan,
      grille: abo.grille,
      statut: abo.statut,
      debut_periode: abo.debut_periode,
      fin_periode: abo.fin_periode,
      trial_ends_at: abo.trial_ends_at,
      echec_paiement: abo.echec_paiement,
      grace_ends_at: abo.grace_ends_at,
      statut_pre_suspension: abo.statut_pre_suspension ?? null,
      // v1.4 : pack choisi pour la fin de l'essai (vue console).
      plan_apres_essai: abo.plan_apres_essai ?? "starter",
    };
    return {
      id: db.profil.id,
      email: db.profil.email,
      nom: db.profil.nom,
      role: db.profil.role,
      pays: db.profil.pays,
      langue: db.profil.langue,
      suspendu: db.profil.suspendu,
      created_at: db.profil.created_at,
      pays_declare: db.profil.pays_declare ?? db.profil.pays,
      pays_ip: db.profil.pays_ip ?? null,
      pays_paiement: db.profil.pays_paiement ?? null,
      grille_statut: db.profil.grille_statut ?? "ok",
      motif_refus: db.profil.motif_refus ?? null,
      abonnement: vue,
      en_retard: estEnRetardPaiement(vue, db.finance.parametres),
      display_id: db.profil.display_id ?? null,
      telephone: db.profil.telephone,
      type_intention: db.profil.type_intention ?? "proprietaire",
      statut_contrat: db.profil.statut_contrat ?? "sans_objet",
      statut_contrat_proprietaire: db.profil.statut_contrat_proprietaire ?? "sans_objet",
      motif_contrat_proprietaire: db.profil.motif_contrat_proprietaire ?? null,
      dossier_complet: this.dossierCompletPrincipal(db),
      // v1.5 : assignation + suppression (champs OBLIGATOIRES du type).
      admin_responsable_id: db.profil.admin_responsable_id ?? null,
      admin_responsable_nom: db.profil.admin_responsable_id
        ? this.resoudreNomAdmin(db, db.profil.admin_responsable_id)
        : null,
      suppression_demandee_le: db.profil.suppression_demandee_le ?? null,
    };
  }

  private compteRegistre(db: DemoDb, entree: CompteClientDemo): ComptePlateforme {
    return {
      id: entree.id,
      email: entree.email,
      nom: entree.nom,
      role: entree.role,
      pays: entree.pays,
      langue: entree.langue,
      suspendu: entree.abonnement.statut === "suspendu",
      created_at: entree.created_at,
      pays_declare: entree.pays_declare,
      pays_ip: entree.pays_ip,
      pays_paiement: entree.pays_paiement,
      grille_statut: entree.grille_statut,
      motif_refus: entree.motif_refus ?? null,
      abonnement: entree.abonnement,
      en_retard: estEnRetardPaiement(entree.abonnement, db.finance.parametres),
      display_id: entree.display_id,
      telephone: entree.telephone,
      type_intention: entree.type_intention,
      statut_contrat: entree.statut_contrat,
      statut_contrat_proprietaire: entree.statut_contrat_proprietaire ?? "sans_objet",
      motif_contrat_proprietaire: entree.motif_contrat_proprietaire ?? null,
      dossier_complet: entree.dossier_complet,
      // v1.5 : assignation + suppression (champs OBLIGATOIRES du type).
      admin_responsable_id: entree.admin_responsable_id ?? null,
      admin_responsable_nom: entree.admin_responsable_id
        ? this.resoudreNomAdmin(db, entree.admin_responsable_id)
        : null,
      suppression_demandee_le: entree.suppression_demandee_le ?? null,
    };
  }

  async listerComptesPlateforme(): Promise<ComptePlateforme[]> {
    const db = loadDb();
    this.acteurPlateforme(db);
    const comptes = [
      // v1.5 : après exécution de sa suppression, le compte principal
      // ne figure plus dans la console.
      ...(db.principalSupprime ? [] : [this.comptePrincipal(db)]),
      ...db.plateforme.comptesClients.map((c) => this.compteRegistre(db, c)),
    ];
    return comptes.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  /** Localise la cible d'une action console : compte principal ou registre. */
  private trouverCible(
    db: DemoDb,
    compteId: string
  ): { principal: boolean; entree: CompteClientDemo | null } {
    if (compteId === db.profil.id) return { principal: true, entree: null };
    const entree = db.plateforme.comptesClients.find((c) => c.id === compteId);
    if (!entree) throw err("ERR_INTROUVABLE");
    return { principal: false, entree };
  }

  async suspendreCompte(compteId: string): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurPlateforme(db);
    const cible = this.trouverCible(db, compteId);
    if (cible.principal) {
      db.profil.suspendu = true;
      const abo = db.abonnement;
      if (abo.statut !== "suspendu" && abo.statut !== "en_attente") {
        abo.statut_pre_suspension = abo.statut;
        abo.statut = "suspendu";
      }
      this.journaliserAudit(db, acteur, "compte_suspendu", "compte", db.profil.id, db.profil.email);
    } else {
      const abo = cible.entree!.abonnement;
      if (abo.statut !== "suspendu" && abo.statut !== "en_attente") {
        abo.statut_pre_suspension = abo.statut;
        abo.statut = "suspendu";
      }
      this.journaliserAudit(db, acteur, "compte_suspendu", "compte", cible.entree!.id, cible.entree!.email);
    }
    saveDb(db);
  }

  async reactiverCompte(compteId: string): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurPlateforme(db);
    const cible = this.trouverCible(db, compteId);
    if (cible.principal) {
      db.profil.suspendu = false;
      const abo = db.abonnement;
      if (abo.statut === "suspendu") {
        abo.statut = abo.statut_pre_suspension ?? "actif";
        abo.statut_pre_suspension = null;
      }
      this.journaliserAudit(db, acteur, "compte_reactive", "compte", db.profil.id, db.profil.email);
    } else {
      const abo = cible.entree!.abonnement;
      if (abo.statut === "suspendu") {
        abo.statut = abo.statut_pre_suspension ?? "actif";
        abo.statut_pre_suspension = null;
      }
      this.journaliserAudit(db, acteur, "compte_reactive", "compte", cible.entree!.id, cible.entree!.email);
    }
    saveDb(db);
  }

  async supprimerCompteDefinitivement(compteId: string): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurSuperAdmin(db);
    const cible = this.trouverCible(db, compteId);
    // Le compte principal de la démo porte tout le parc fictif : sa
    // suppression détruirait la démonstration elle-même — refusée ici.
    // En réel, la suppression définitive passe par la fonction SQL
    // supprimer_compte_definitivement (Super Admin uniquement).
    if (cible.principal) throw err("ERR_OPERATION_INTERDITE");
    this.journaliserAudit(db, acteur, "compte_supprime_definitivement", "compte", cible.entree!.id, cible.entree!.email);
    db.plateforme.comptesClients = db.plateforme.comptesClients.filter(
      (c) => c.id !== compteId
    );
    saveDb(db);
  }

  async approuverCompte(compteId: string): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurPlateforme(db);
    const cible = this.trouverCible(db, compteId);
    // Checklist de vérification (2026-11-07, miroir de la garde base
    // de approuver_compte) : pour un compte EN ATTENTE, la revue
    // consignée doit être complète — anti-fraude exigée seulement
    // si le compte est signalé « a_verifier ». Le refus reste libre.
    const statutCible = cible.principal
      ? db.abonnement.statut
      : cible.entree!.abonnement.statut;
    if (statutCible === "en_attente") {
      const grilleStatutCible = cible.principal
        ? db.profil.grille_statut ?? "ok"
        : cible.entree!.grille_statut;
      const chk = db.plateforme.checklistsDossiers?.[compteId] ?? null;
      if (
        !chk ||
        !chk.photo_verifiee ||
        !chk.piece_coherente ||
        !chk.infos_verifiees ||
        (grilleStatutCible === "a_verifier" && !chk.antifraude_examinee)
      ) {
        throw err("ERR_CHECKLIST_INCOMPLETE");
      }
    }
    const maintenant = new Date().toISOString();
    const finEssai = ajouterJours(maintenant, db.finance.parametres.jours_essai);
    let emailCible: string;
    let nomCible: string;
    let langueCible: "fr" | "en";
    let grilleConfirmee: Grille;
    let intentionCible: TypeIntention = "proprietaire";
    let displayIdCible: string | null = null;
    let telephoneCible: string | null = null;
    let paysCible: string | null = null;
    if (cible.principal) {
      const abo = db.abonnement;
      if (abo.statut !== "en_attente") throw err("ERR_COMPTE_NON_EN_ATTENTE");
      abo.statut = "essai";
      // v1.4 : l'approbation force le pack STARTER (miroir de la
      // fonction SQL public.approuver_compte).
      abo.plan = "starter";
      abo.plan_apres_essai = "starter";
      abo.debut_periode = maintenant;
      abo.trial_ends_at = finEssai;
      abo.fin_periode = finEssai;
      // La grille affichée dans la file est confirmée au même geste.
      db.profil.grille_attribuee = abo.grille;
      emailCible = db.profil.email;
      nomCible = db.profil.nom;
      langueCible = db.profil.langue;
      grilleConfirmee = abo.grille;
      intentionCible = db.profil.type_intention ?? "proprietaire";
      displayIdCible = db.profil.display_id ?? null;
      telephoneCible = db.profil.telephone;
      paysCible = db.profil.pays;
      // v1.3 : l'approbation d'un GESTIONNAIRE déclenche le contrat.
      if (intentionCible === "gestionnaire") db.profil.statut_contrat = "a_signer";
      // Option C : l'approbation d'un PROPRIÉTAIRE déclenche le sien.
      if (intentionCible === "proprietaire") db.profil.statut_contrat_proprietaire = "a_signer";
    } else {
      const abo = cible.entree!.abonnement;
      if (abo.statut !== "en_attente") throw err("ERR_COMPTE_NON_EN_ATTENTE");
      abo.statut = "essai";
      // v1.4 : essai Starter forcé à l'approbation (comme en réel).
      abo.plan = "starter";
      abo.plan_apres_essai = "starter";
      abo.debut_periode = maintenant;
      abo.trial_ends_at = finEssai;
      abo.fin_periode = finEssai;
      emailCible = cible.entree!.email;
      nomCible = cible.entree!.nom;
      langueCible = cible.entree!.langue;
      grilleConfirmee = abo.grille;
      intentionCible = cible.entree!.type_intention;
      displayIdCible = cible.entree!.display_id;
      telephoneCible = cible.entree!.telephone;
      paysCible = cible.entree!.pays;
      if (intentionCible === "gestionnaire") cible.entree!.statut_contrat = "a_signer";
      if (intentionCible === "proprietaire") cible.entree!.statut_contrat_proprietaire = "a_signer";
    }
    // v1.3 : compte à intention GESTIONNAIRE → e-mail de DÉCISION avec
    // le contrat de collaboration en pièce jointe (PDF personnalisé
    // avec le Display ID). Ses fonctions restent verrouillées tant que
    // le contrat signé n'est pas validé (statut_contrat).
    let emailStatut: Avis["statut_envoi"];
    let contratJoint = false;
    if (intentionCible === "gestionnaire" && displayIdCible) {
      const contrat = await genererContratGestionnairePdf({
        nom: nomCible,
        displayId: displayIdCible,
        email: emailCible,
        telephone: telephoneCible,
        pays: paysCible,
        langue: langueCible,
        date: maintenant.slice(0, 10),
      });
      const decision = rendreDecisionGestionnaire(nomCible, displayIdCible, langueCible);
      // Guide d'utilisation : joint en plus du contrat, dans la
      // langue du compte (repli non bloquant intégré au helper —
      // si le guide est illisible, la décision part avec le
      // contrat seul).
      const piecesDecision = await piecesJointesAvecGuide(
        [{ nom: contrat.nomFichier, contenuBase64: contrat.contenuBase64 }],
        langueCible
      );
      emailStatut = await this.envoyerEmailPlateforme(
        emailCible,
        decision.sujet,
        decision.corps,
        langueCible,
        piecesDecision
      );
      contratJoint = true;
    } else if (displayIdCible) {
      // Option C — propriétaire : bienvenue + contrat de service joint
      // (non bloquant : l'essai vient de démarrer ci-dessus). Repli :
      // si la génération du PDF échoue (harnais sans DOM complet),
      // bienvenue sans pièce jointe — le contrat reste téléchargeable
      // depuis l'espace (getMonContratProprietaire le régénère).
      let piecesJointes: { nom: string; contenuBase64: string }[] | undefined;
      try {
        const contrat = await genererContratProprietairePdf({
          nom: nomCible,
          displayId: displayIdCible,
          email: emailCible,
          telephone: telephoneCible,
          pays: paysCible,
          langue: langueCible,
          date: maintenant.slice(0, 10),
        });
        piecesJointes = [{ nom: contrat.nomFichier, contenuBase64: contrat.contenuBase64 }];
        contratJoint = true;
      } catch {
        piecesJointes = undefined;
      }
      // Guide d'utilisation : joint en plus du contrat, dans la
      // langue du compte (repli non bloquant intégré au helper).
      piecesJointes = await piecesJointesAvecGuide(piecesJointes, langueCible);
      const bienvenue = rendreBienvenueProprietaire(nomCible, displayIdCible, langueCible);
      emailStatut = await this.envoyerEmailPlateforme(
        emailCible,
        bienvenue.sujet,
        bienvenue.corps,
        langueCible,
        piecesJointes
      );
    } else {
      const bienvenue = rendreBienvenue(nomCible, langueCible);
      emailStatut = await this.envoyerEmailPlateforme(
        emailCible,
        bienvenue.sujet,
        bienvenue.corps,
        langueCible
      );
    }
    const chkAppro = db.plateforme.checklistsDossiers?.[compteId] ?? null;
    this.journaliserAudit(db, acteur, "compte_approuve", "compte", compteId, emailCible, {
      grille: grilleConfirmee,
      trial_ends_at: finEssai,
      email_bienvenue: emailStatut,
      // Checklist consignée au moment de l'approbation (preuve de
      // la revue, comme en réel).
      ...(chkAppro
        ? {
            checklist_photo_verifiee: chkAppro.photo_verifiee,
            checklist_piece_coherente: chkAppro.piece_coherente,
            checklist_infos_verifiees: chkAppro.infos_verifiees,
            checklist_antifraude_examinee: chkAppro.antifraude_examinee,
          }
        : {}),
      ...(contratJoint
        ? {
            contrat_envoye: true,
            display_id: displayIdCible,
            ...(intentionCible === "proprietaire"
              ? { contrat_proprietaire_envoye: true }
              : {}),
          }
        : {}),
    });
    saveDb(db);
  }

  async enregistrerChecklistDossier(
    compteId: string,
    saisie: ChecklistDossierSaisie
  ): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurPlateforme(db);
    const cible = this.trouverCible(db, compteId);
    const statutCible = cible.principal
      ? db.abonnement.statut
      : cible.entree!.abonnement.statut;
    if (statutCible !== "en_attente") throw err("ERR_COMPTE_NON_EN_ATTENTE");
    // Miroir de la RPC réelle : l'état complet est consigné avec
    // l'identité de l'Admin relecteur et l'horodatage.
    (db.plateforme.checklistsDossiers ??= {})[compteId] = {
      photo_verifiee: saisie.photo_verifiee,
      piece_coherente: saisie.piece_coherente,
      infos_verifiees: saisie.infos_verifiees,
      antifraude_examinee: saisie.antifraude_examinee,
      acteur_nom: acteur.nom,
      acteur_email: acteur.email,
      updated_at: new Date().toISOString(),
    };
    saveDb(db);
  }

  async refuserCompte(compteId: string, motif: MotifRefus): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurPlateforme(db);
    const cible = this.trouverCible(db, compteId);
    let emailCible: string;
    let nomCible: string;
    let langueCible: "fr" | "en";
    let planCible: Plan;
    if (cible.principal) {
      if (db.abonnement.statut !== "en_attente") throw err("ERR_COMPTE_NON_EN_ATTENTE");
      db.abonnement.statut = "annule";
      db.profil.motif_refus = motif;
      emailCible = db.profil.email;
      nomCible = db.profil.nom;
      langueCible = db.profil.langue;
      planCible = db.abonnement.plan;
    } else {
      if (cible.entree!.abonnement.statut !== "en_attente") {
        throw err("ERR_COMPTE_NON_EN_ATTENTE");
      }
      cible.entree!.abonnement.statut = "annule";
      cible.entree!.motif_refus = motif;
      emailCible = cible.entree!.email;
      nomCible = cible.entree!.nom;
      langueCible = cible.entree!.langue;
      planCible = cible.entree!.abonnement.plan;
    }
    const variables = {
      nom: nomCible,
      plan: planCible,
      date: new Date().toISOString().slice(0, 10),
      motif: libellerMotif(motif, langueCible),
    };
    const rendu = rendreAvis("inscription_refusee", variables, langueCible);
    const emailStatut = await this.envoyerEmailPlateforme(
      emailCible,
      rendu.sujet,
      rendu.corps,
      langueCible
    );
    db.plateforme.avis.push({
      id: uid(),
      modele: "inscription_refusee",
      destinataire_id: compteId,
      destinataire_email: emailCible,
      variables,
      sujet: rendu.sujet,
      corps: rendu.corps,
      envoye_par: acteur.id,
      envoye_par_role: acteur.role,
      statut_envoi: emailStatut,
      created_at: new Date().toISOString(),
    });
    this.journaliserAudit(db, acteur, "compte_refuse", "compte", compteId, emailCible, {
      motif,
      email_refus: emailStatut,
    });
    saveDb(db);
  }

  async reattribuerGrille(compteId: string, grille: Grille): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurPlateforme(db);
    const cible = this.trouverCible(db, compteId);
    if (cible.principal) {
      db.abonnement.grille = grille;
      db.profil.grille_attribuee = grille;
      db.profil.grille_statut = "ok";
      this.journaliserAudit(db, acteur, "grille_reattribuee", "compte", db.profil.id, db.profil.email, { grille });
    } else {
      cible.entree!.abonnement.grille = grille;
      cible.entree!.grille_statut = "ok";
      this.journaliserAudit(db, acteur, "grille_reattribuee", "compte", cible.entree!.id, cible.entree!.email, { grille });
    }
    saveDb(db);
  }

  async envoyerAvis(compteId: string, modele: ModeleAvis): Promise<Avis> {
    const db = loadDb();
    const acteur = this.acteurPlateforme(db);
    const comptes = await this.listerComptesPlateforme();
    const compte = comptes.find((c) => c.id === compteId);
    if (!compte) throw err("ERR_INTROUVABLE");
    const variables = {
      nom: compte.nom,
      plan: compte.abonnement?.plan ?? "pro",
      date: (
        compte.abonnement?.trial_ends_at ??
        compte.abonnement?.fin_periode ??
        new Date().toISOString()
      ).slice(0, 10),
    };
    const rendu = rendreAvis(modele, variables, compte.langue);
    const statut = await this.envoyerEmailPlateforme(compte.email, rendu.sujet, rendu.corps, compte.langue);
    const avis: Avis = {
      id: uid(),
      modele,
      destinataire_id: compte.id,
      destinataire_email: compte.email,
      variables,
      sujet: rendu.sujet,
      corps: rendu.corps,
      envoye_par: acteur.id,
      envoye_par_role: acteur.role,
      statut_envoi: statut,
      created_at: new Date().toISOString(),
    };
    db.plateforme.avis.push(avis);
    this.journaliserAudit(db, acteur, "avis_envoye", "compte", compte.id, compte.email, {
      modele,
      statut_envoi: statut,
    });
    saveDb(db);
    return avis;
  }

  async listerAdmins(): Promise<CompteAdmin[]> {
    const db = loadDb();
    this.acteurPlateforme(db);
    return db.plateforme.comptesAdmins
      .slice()
      .sort((a, b) =>
        a.role === b.role ? a.email.localeCompare(b.email) : a.role === "super_admin" ? -1 : 1
      )
      // v1.5 : accès console + charge (dossiers assignés) résolus.
      .map((a) => ({
        ...a,
        acces_admin_actif: this.resoudreAccesAdmin(db, a),
        dossiers_assignes: this.compterDossiersAssignes(
          db,
          this.aliasAdmin(db, a.id, a.email)
        ),
      }));
  }

  async creerAdmin(email: string, nom: string): Promise<CompteAdmin> {
    const db = loadDb();
    const acteur = this.acteurSuperAdmin(db);
    const adresse = email.trim().toLowerCase();
    if (!emailValide(adresse)) throw err("ERR_EMAIL_INVALIDE");
    if (db.plateforme.comptesAdmins.some((a) => a.email.toLowerCase() === adresse)) {
      throw err("ERR_DEJA_ADMIN");
    }
    const cree: CompteAdmin = {
      id: uid(),
      email: adresse,
      nom: nom.trim() || adresse,
      role: "admin",
      statut: "actif",
      created_at: new Date().toISOString(),
      acces_admin_actif: true,
    };
    db.plateforme.comptesAdmins.push(cree);
    this.journaliserAudit(db, acteur, "admin_cree", "admin", cree.id, cree.email);
    saveDb(db);
    return cree;
  }

  async promouvoirAdmin(email: string): Promise<CompteAdmin> {
    const db = loadDb();
    const acteur = this.acteurSuperAdmin(db);
    const adresse = email.trim().toLowerCase();
    if (db.plateforme.comptesAdmins.some((a) => a.email.toLowerCase() === adresse)) {
      throw err("ERR_DEJA_ADMIN");
    }
    let nom: string | null = null;
    // v1.5 (miroir du fournisseur réel) : la promotion pose le rôle
    // « admin » sur le PROFIL du compte et conserve son rôle client
    // d'origine dans role_avant_admin, pour un retrait fidèle par
    // retirerRoleAdmin(). L'identifiant de l'entrée Admin créée est
    // celui du profil promu — un seul identifiant par personne.
    let idCible: string | null = null;
    if (db.profil.email.toLowerCase() === adresse) {
      nom = db.profil.nom;
      idCible = db.profil.id;
      if (db.profil.role !== "admin" && db.profil.role !== "super_admin") {
        db.profil.role_avant_admin = db.profil.role;
        db.profil.role = "admin";
      }
      db.profil.acces_admin_actif = true;
    }
    const client = db.plateforme.comptesClients.find(
      (c) => c.email.toLowerCase() === adresse
    );
    if (client) {
      nom = client.nom;
      idCible = client.id;
      if (client.role !== "admin" && client.role !== "super_admin") {
        client.role_avant_admin = client.role;
        client.role = "admin";
      }
      client.acces_admin_actif = true;
    }
    const invitation = db.gestionnaires.find(
      (g) => g.email.toLowerCase() === adresse
    );
    if (invitation) {
      nom = invitation.nom ?? nom;
      idCible = idCible ?? invitation.id;
    }
    if (!nom) throw err("ERR_INTROUVABLE");
    const cree: CompteAdmin = {
      id: idCible ?? uid(),
      email: adresse,
      nom,
      role: "admin",
      statut: "actif",
      created_at: new Date().toISOString(),
      acces_admin_actif: true,
    };
    db.plateforme.comptesAdmins.push(cree);
    this.journaliserAudit(db, acteur, "admin_promu", "admin", cree.id, cree.email);
    saveDb(db);
    return cree;
  }

  async suspendreAdmin(adminId: string): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurSuperAdmin(db);
    const entree = db.plateforme.comptesAdmins.find((a) => a.id === adminId);
    if (!entree) throw err("ERR_INTROUVABLE");
    if (entree.role === "super_admin") throw err("ERR_OPERATION_INTERDITE");
    entree.statut = "suspendu";
    this.journaliserAudit(db, acteur, "admin_suspendu", "admin", entree.id, entree.email);
    saveDb(db);
  }

  async reactiverAdmin(adminId: string): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurSuperAdmin(db);
    const entree = db.plateforme.comptesAdmins.find((a) => a.id === adminId);
    if (!entree) throw err("ERR_INTROUVABLE");
    entree.statut = "actif";
    this.journaliserAudit(db, acteur, "admin_reactive", "admin", entree.id, entree.email);
    saveDb(db);
  }

  async retirerAdmin(adminId: string): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurSuperAdmin(db);
    const entree = db.plateforme.comptesAdmins.find((a) => a.id === adminId);
    if (!entree) throw err("ERR_INTROUVABLE");
    if (entree.role === "super_admin") throw err("ERR_OPERATION_INTERDITE");
    this.journaliserAudit(db, acteur, "admin_retire", "admin", entree.id, entree.email);
    db.plateforme.comptesAdmins = db.plateforme.comptesAdmins.filter(
      (a) => a.id !== adminId
    );
    saveDb(db);
  }

  async listerJournalAudit(): Promise<EntreeAudit[]> {
    const db = loadDb();
    this.acteurPlateforme(db);
    return db.plateforme.journal
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async listerRattachements(): Promise<RattachementGestionnaire[]> {
    const db = loadDb();
    this.acteurPlateforme(db);
    return db.plateforme.rattachements
      .slice()
      .sort((a, b) => a.gestionnaire_email.localeCompare(b.gestionnaire_email));
  }

  async creerRattachement(input: {
    gestionnaire_email: string;
    gestionnaire_nom?: string | null;
    contexte: "cizagroup" | "proprietaire";
    proprietaire_id?: string | null;
    immeuble_ids: string[];
  }): Promise<RattachementGestionnaire> {
    const db = loadDb();
    const acteur = this.acteurPlateforme(db);
    const adresse = input.gestionnaire_email.trim().toLowerCase();
    if (!emailValide(adresse)) throw err("ERR_EMAIL_INVALIDE");
    if (input.immeuble_ids.length === 0) throw err("ERR_GESTIONNAIRE_SANS_IMMEUBLE");
    let proprietaireId: string | null = null;
    let proprietaireNom: string | null = null;
    let immeublesValides: Set<string>;
    if (input.contexte === "proprietaire") {
      // Démo : un seul propriétaire client — le compte principal.
      if (input.proprietaire_id && input.proprietaire_id !== db.profil.id) {
        throw err("ERR_INTROUVABLE");
      }
      proprietaireId = db.profil.id;
      proprietaireNom = db.profil.nom;
      immeublesValides = new Set(db.immeubles.map((i) => i.id));
    } else {
      immeublesValides = new Set(db.parcCizaGroup.immeubles.map((i) => i.id));
    }
    if (!input.immeuble_ids.every((id) => immeublesValides.has(id))) {
      throw err("ERR_INTROUVABLE");
    }
    if (
      db.plateforme.rattachements.some(
        (r) =>
          r.gestionnaire_email.toLowerCase() === adresse &&
          r.contexte === input.contexte &&
          r.proprietaire_id === proprietaireId &&
          r.statut === "actif"
      )
    ) {
      throw err("ERR_RATTACHEMENT_EXISTANT");
    }
    const invitation = db.gestionnaires.find(
      (g) => g.email.toLowerCase() === adresse
    );
    const compteGestR = db.plateforme.comptesClients.find(
      (c) => c.email.toLowerCase() === adresse
    );
    const compteProprioR = db.plateforme.comptesClients.find(
      (c) => c.id === proprietaireId
    );
    const cree: RattachementGestionnaire = {
      id: uid(),
      gestionnaire_id: adresse,
      gestionnaire_email: adresse,
      gestionnaire_nom: input.gestionnaire_nom ?? invitation?.nom ?? null,
      gestionnaire_telephone: compteGestR?.telephone ?? null,
      contexte: input.contexte,
      proprietaire_id: proprietaireId,
      proprietaire_nom: proprietaireNom,
      proprietaire_email: compteProprioR?.email ?? null,
      proprietaire_telephone: compteProprioR?.telephone ?? null,
      immeuble_ids: input.immeuble_ids,
      statut: "actif",
      created_at: new Date().toISOString(),
    };
    db.plateforme.rattachements.push(cree);
    this.journaliserAudit(db, acteur, "rattachement_cree", "gestionnaire", cree.id, adresse, {
      contexte: input.contexte,
    });
    saveDb(db);
    return cree;
  }

  async retirerRattachement(id: string): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurPlateforme(db);
    const entree = db.plateforme.rattachements.find((r) => r.id === id);
    if (!entree) throw err("ERR_INTROUVABLE");
    this.journaliserAudit(db, acteur, "rattachement_retire", "gestionnaire", entree.id, entree.gestionnaire_email);
    db.plateforme.rattachements = db.plateforme.rattachements.filter((r) => r.id !== id);
    saveDb(db);
  }

  async listerMesRattachements(): Promise<RattachementGestionnaire[]> {
    const db = loadDb();
    const email = this.sessionGestionnaireEmail();
    if (!email) return [];
    return db.plateforme.rattachements
      .filter((r) => r.gestionnaire_email.toLowerCase() === email)
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async getContexteActif(): Promise<RattachementGestionnaire | null> {
    const db = loadDb();
    return this.rattachementActif(db);
  }

  async definirContexteActif(rattachementId: string): Promise<RattachementGestionnaire> {
    const db = loadDb();
    const email = this.sessionGestionnaireEmail();
    if (!email) throw err("ERR_ACCES_PLATEFORME");
    const entree = this.rattachementsActifsDe(db, email).find((r) => r.id === rattachementId);
    if (!entree) throw err("ERR_INTROUVABLE");
    if (isBrowser()) {
      window.localStorage.setItem(DEMO_CONTEXTE_KEY, rattachementId);
    }
    return entree;
  }

  async ouvrirSupervision(rattachementId: string): Promise<SupervisionGestionnaire> {
    const db = loadDb();
    const acteur = this.acteurPlateforme(db);
    const rattachement = db.plateforme.rattachements.find((r) => r.id === rattachementId);
    if (!rattachement) throw err("ERR_INTROUVABLE");
    // Ouverture JOURNALISÉE (qui, quand, quel gestionnaire, quel contexte).
    this.journaliserAudit(db, acteur, "supervision_ouverte", "gestionnaire", rattachement.id, rattachement.gestionnaire_email, {
      contexte: rattachement.contexte,
    });
    saveDb(db);
    const parc: ParcDemo =
      rattachement.contexte === "cizagroup"
        ? db.parcCizaGroup
        : {
            profil: db.profil,
            immeubles: db.immeubles,
            appartements: db.appartements,
            locataires: db.locataires,
            baux: db.baux,
            echeances: db.echeances,
            paiements: db.paiements,
            depenses: db.depenses,
            documents: db.documents,
            activites: db.activites,
            alertes: db.alertes,
            coproprietaires: db.coproprietaires,
          };
    const immeubles = parc.immeubles
      .filter((i) => rattachement.immeuble_ids.includes(i.id))
      .map((imm) => {
        const apts = parc.appartements.filter((a) => a.immeuble_id === imm.id);
        const aptIds = new Set(apts.map((a) => a.id));
        const locatairesActifs = new Set(
          parc.baux
            .filter((b) => b.statut === "actif" && aptIds.has(b.appartement_id))
            .map((b) => b.locataire_id)
        );
        return {
          id: imm.id,
          nom: imm.nom,
          ville: imm.ville,
          devise_principale: imm.devise,
          nb_appartements: apts.length,
          nb_locataires_actifs: locatairesActifs.size,
        };
      });
    return { rattachement, immeubles };
  }

  // --- Finances dynamiques -------------------------------------------------

  async getTarifsPlateforme(): Promise<TarifPlateforme[]> {
    // Lecture PUBLIQUE (front public, page tarifs, mini-grille accueil).
    const db = loadDb();
    return db.finance.tarifs
      .map((t) => ({ ...t }))
      .sort((a, b) => a.grille.localeCompare(b.grille) || a.plan.localeCompare(b.plan));
  }

  async getParametresFinance(): Promise<ParametresFinance> {
    // Lecture publique (écran d'attente : délai d'approbation affiché).
    const db = loadDb();
    return { ...db.finance.parametres };
  }

  async mettreAJourTarifs(
    tarifs: TarifPlateforme[],
    parametres: ParametresFinance
  ): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurSuperAdmin(db);
    for (const t of tarifs) {
      if (!t || typeof t.prix_mensuel !== "number" || t.prix_mensuel <= 0) {
        throw err("ERR_PRIX_INVALIDE");
      }
    }
    if (
      !(parametres.jours_essai > 0) ||
      !(parametres.jours_grace >= 0) ||
      !(parametres.remise_annuelle_pct >= 0 && parametres.remise_annuelle_pct <= 100)
    ) {
      throw err("ERR_PRIX_INVALIDE");
    }
    const maintenant = new Date().toISOString();
    db.finance.tarifs = tarifs.map((t) => ({
      ...t,
      updated_at: maintenant,
      updated_by: acteur.id,
    }));
    db.finance.parametres = {
      ...parametres,
      pays_grille_afrique: (parametres.pays_grille_afrique ?? [])
        .map((c) => c.trim().toUpperCase())
        .filter((c) => /^[A-Z]{2}$/.test(c)),
      delai_approbation_affiche:
        parametres.delai_approbation_affiche?.trim() || "24 h ouvrées",
    };
    this.journaliserAudit(db, acteur, "tarifs_modifies", "tarif", null, null, {
      tarifs: db.finance.tarifs.map((t) => ({
        grille: t.grille,
        plan: t.plan,
        prix_mensuel: t.prix_mensuel,
      })),
    });
    this.journaliserAudit(db, acteur, "parametres_modifies", "parametre", null, null, {
      parametres: db.finance.parametres,
    });
    saveDb(db);
  }

  // ==========================================================================
  // EXTENSION v1.3 — Dossiers vérifiés, contrat gestionnaire, rattachement
  // par Display ID (triple validation). Voir docs/parcours-inscription-v1.3.md.
  // ==========================================================================

  /**
   * Identité « compte » du gestionnaire DÉMO (Marc Dubois) : il n'est pas
   * dans le registre clients — son dossier v1.3 est fixe et établi
   * (Display ID CIM-000002, contrat VALIDÉ) ; ses documents vivent dans
   * plateforme.documentsComptes.
   */
  private compteGestionnaireDemo(
    db: DemoDb
  ): { id: string; email: string; nom: string; display_id: string; statut_contrat: StatutContrat } | null {
    const invitation = db.gestionnaires.find(
      (g) => g.email.toLowerCase() === GESTIONNAIRE_DEMO_EMAIL
    );
    if (!invitation) return null;
    return {
      id: invitation.id,
      email: invitation.email,
      nom: invitation.nom ?? "Marc Dubois",
      display_id: "CIM-000002",
      statut_contrat: "valide",
    };
  }

  /** Cherche un compte par Display ID : principal, registre, gestionnaire démo. */
  private trouverParDisplayId(
    db: DemoDb,
    displayId: string
  ): {
    id: string;
    email: string;
    nom: string;
    type_intention: TypeIntention;
    statut_contrat: StatutContrat;
  } | null {
    const cible = displayId.trim().toUpperCase();
    if (!cible) return null;
    if ((db.profil.display_id ?? "").toUpperCase() === cible) {
      return {
        id: db.profil.id,
        email: db.profil.email,
        nom: db.profil.nom,
        type_intention: db.profil.type_intention ?? "proprietaire",
        statut_contrat: db.profil.statut_contrat ?? "sans_objet",
      };
    }
    const entree = db.plateforme.comptesClients.find(
      (c) => c.display_id.toUpperCase() === cible
    );
    if (entree) {
      return {
        id: entree.id,
        email: entree.email,
        nom: entree.nom,
        type_intention: entree.type_intention,
        statut_contrat: entree.statut_contrat,
      };
    }
    const marc = this.compteGestionnaireDemo(db);
    if (marc && marc.display_id === cible) {
      return {
        id: marc.id,
        email: marc.email,
        nom: marc.nom,
        type_intention: "gestionnaire",
        statut_contrat: marc.statut_contrat,
      };
    }
    return null;
  }

  /**
   * Ajoute un document au DOSSIER du compte connecté (entite « compte »).
   * Accessible pendant l'attente d'approbation (pas de garde abonnement) :
   * c'est précisément là que le dossier se complète.
   */
  private async ajouterDocumentCompte(
    type: "piece_identite" | "contrat",
    input: DocumentInput
  ): Promise<Document> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    const db = loadDb();
    const nom = input.nom_fichier.trim();
    if (!nom) throw err("ERR_NOT_FOUND");
    const extension = nom.split(".").pop()?.toLowerCase() ?? "";
    const mimeOk = !input.mime_type || FORMATS_DOCUMENT_ACCEPTES.includes(input.mime_type);
    if (!["pdf", "jpg", "jpeg", "png"].includes(extension) || !mimeOk) {
      throw err("ERR_DOCUMENT_FORMAT");
    }
    if (
      input.taille_octets !== undefined &&
      input.taille_octets !== null &&
      input.taille_octets > TAILLE_MAX_DOCUMENT_OCTETS
    ) {
      throw err("ERR_DOCUMENT_TROP_GROS");
    }
    let ownerId: string;
    let liste: Document[];
    if (session.id.startsWith("gestionnaire:")) {
      const marc = this.compteGestionnaireDemo(db);
      if (!marc) throw err("ERR_NOT_FOUND");
      ownerId = marc.id;
      liste = db.plateforme.documentsComptes;
    } else if (
      session.id.startsWith("plateforme:") ||
      session.id.startsWith("coprop:")
    ) {
      throw err("ERR_NOT_FOUND");
    } else {
      ownerId = db.profil.id;
      liste = db.documents;
    }
    if (
      liste.some(
        (d) =>
          d.entite_type === "compte" &&
          d.entite_id === ownerId &&
          d.type === type &&
          d.nom_fichier.trim().toLowerCase() === nom.toLowerCase()
      )
    ) {
      throw err("ERR_DOCUMENT_DOUBLON");
    }
    const taille = input.taille_octets ?? null;
    const contenuConserve =
      input.contenu && taille !== null && taille <= LIMITE_DEMO_CONTENU_OCTETS
        ? input.contenu
        : null;
    const document: Document = {
      id: uid(),
      owner_id: ownerId,
      type,
      entite_type: "compte",
      entite_id: ownerId,
      nom_fichier: nom,
      storage_path: `demo:${uid()}`,
      taille_octets: taille,
      mime_type: input.mime_type ?? null,
      ajoute_par: ownerId,
      created_at: new Date().toISOString(),
      contenu: contenuConserve,
      contenu_non_conserve: Boolean(input.contenu) && !contenuConserve,
    };
    liste.push(document);
    saveDb(db);
    return document;
  }

  async soumettreDocumentCompte(
    type: "piece_identite" | "contrat",
    input: DocumentInput
  ): Promise<Document> {
    return this.ajouterDocumentCompte(type, input);
  }

  async televerserPhotoProfil(input: DocumentInput): Promise<string> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    const nom = input.nom_fichier.trim();
    const extension = nom.split(".").pop()?.toLowerCase() ?? "";
    if (!["jpg", "jpeg", "png"].includes(extension)) {
      throw err("ERR_DOCUMENT_FORMAT");
    }
    if (
      input.taille_octets !== undefined &&
      input.taille_octets !== null &&
      input.taille_octets > TAILLE_MAX_DOCUMENT_OCTETS
    ) {
      throw err("ERR_DOCUMENT_TROP_GROS");
    }
    const chemin = `demo:photo-profil-${uid()}`;
    if (session.id.startsWith("gestionnaire:")) {
      // Gestionnaire démo : la photo est acceptée (chemin retourné),
      // son dossier seedé reste la référence.
      return chemin;
    }
    if (session.id.startsWith("plateforme:") || session.id.startsWith("coprop:")) {
      throw err("ERR_NOT_FOUND");
    }
    const db = loadDb();
    db.profil.photo_profil_path = chemin;
    saveDb(db);
    return chemin;
  }

  // ==========================================================================
  // DOSSIER EMPLOYÉ DES ADMINS (2026-11-08) — miroir démo du réel.
  // Stockage : entrée `comptesAdmins` (sessions plateforme) ou profil
  // principal (Admin promu connecté comme lui-même) ; la pièce vit
  // dans documentsComptes (plateforme) ou db.documents (profil).
  // Complétude CALCULÉE (lib/dossier-employe.ts), jamais stockée.
  // ==========================================================================

  /** Dernière pièce d'identité d'une liste de documents de compte. */
  private pieceLaPlusRecente(
    docs: Document[],
    entiteId: string
  ): Document | null {
    const pieces = docs
      .filter(
        (d) =>
          d.entite_type === "compte" &&
          d.entite_id === entiteId &&
          d.type === "piece_identite"
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return pieces[0] ?? null;
  }

  /** Assemble la vue DossierEmploye à partir d'ingrédients résolus. */
  private assemblerDossierEmploye(champs: {
    compte_id: string;
    email: string;
    nom: string;
    role: "admin" | "super_admin";
    photo_profil_path: string | null;
    piece_identite: Document | null;
    telephone: string | null;
    adresse: string | null;
    adresse_ville: string | null;
    adresse_code_postal: string | null;
    adresse_pays: string | null;
  }): DossierEmploye {
    const evaluation = evaluerDossierEmploye({
      photoPresente: !!champs.photo_profil_path,
      piecePresente: !!champs.piece_identite,
      telephone: champs.telephone,
      adresse: champs.adresse,
      adresseVille: champs.adresse_ville,
      adressePays: champs.adresse_pays,
    });
    return {
      ...champs,
      photo_profil_url: null,
      complet: evaluation.complet,
      manquants: evaluation.manquants,
    };
  }

  /** Dossier employé depuis une entrée `comptesAdmins` (plateforme). */
  private dossierDepuisEntreeAdmin(
    db: DemoDb,
    entree: CompteAdmin
  ): DossierEmploye {
    return this.assemblerDossierEmploye({
      compte_id: entree.id,
      email: entree.email,
      nom: entree.nom,
      role: entree.role,
      photo_profil_path: entree.photo_profil_path ?? null,
      piece_identite: this.pieceLaPlusRecente(
        db.plateforme.documentsComptes,
        entree.id
      ),
      telephone: entree.telephone ?? null,
      adresse: entree.adresse ?? null,
      adresse_ville: entree.adresse_ville ?? null,
      adresse_code_postal: entree.adresse_code_postal ?? null,
      adresse_pays: entree.adresse_pays ?? null,
    });
  }

  /** Dossier employé depuis le profil principal (Admin promu). */
  private dossierDepuisProfilPrincipal(db: DemoDb): DossierEmploye {
    return this.assemblerDossierEmploye({
      compte_id: db.profil.id,
      email: db.profil.email,
      nom: db.profil.nom,
      role: db.profil.role === "super_admin" ? "super_admin" : "admin",
      photo_profil_path: db.profil.photo_profil_path ?? null,
      piece_identite: this.pieceLaPlusRecente(db.documents, db.profil.id),
      telephone: db.profil.telephone ?? null,
      adresse: db.profil.adresse ?? null,
      adresse_ville: db.profil.adresse_ville ?? null,
      adresse_code_postal: db.profil.adresse_code_postal ?? null,
      adresse_pays: db.profil.adresse_pays ?? null,
    });
  }

  /** Dossier employé depuis un compte client promu (vue Équipe). */
  private dossierDepuisClientPlateforme(
    db: DemoDb,
    client: CompteClientDemo
  ): DossierEmploye {
    return this.assemblerDossierEmploye({
      compte_id: client.id,
      email: client.email,
      nom: client.nom,
      role: client.role === "super_admin" ? "super_admin" : "admin",
      // Synthèse démo : le drapeau dossier_complet porte la photo,
      // comme la vue Dossier client démo.
      photo_profil_path: client.dossier_complet ? `demo:photo-profil` : null,
      piece_identite: this.pieceLaPlusRecente(
        db.plateforme.documentsComptes,
        client.id
      ),
      telephone: client.telephone ?? null,
      adresse: null,
      adresse_ville: null,
      adresse_code_postal: null,
      adresse_pays: null,
    });
  }

  /**
   * Résout le « moi employé » de la session : entrée plateforme ou
   * profil principal au rôle plateforme. null si la session n'est pas
   * celle d'un admin/super_admin.
   */
  private moiEmploye(db: DemoDb):
    | { kind: "entree"; entree: CompteAdmin }
    | { kind: "profil" }
    | null {
    const emailPlateforme = this.sessionPlateformeEmail();
    if (emailPlateforme) {
      const entree = db.plateforme.comptesAdmins.find(
        (a) => a.email.toLowerCase() === emailPlateforme
      );
      return entree ? { kind: "entree", entree } : null;
    }
    if (db.profil.role === "admin" || db.profil.role === "super_admin") {
      return { kind: "profil" };
    }
    return null;
  }

  async getMonDossierEmploye(): Promise<DossierEmploye> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    const db = loadDb();
    const moi = this.moiEmploye(db);
    if (!moi) throw err("ERR_ACCES_PLATEFORME");
    return moi.kind === "entree"
      ? this.dossierDepuisEntreeAdmin(db, moi.entree)
      : this.dossierDepuisProfilPrincipal(db);
  }

  async mettreAJourDossierEmploye(
    patch: DossierEmployePatch
  ): Promise<DossierEmploye> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    const db = loadDb();
    const moi = this.moiEmploye(db);
    if (!moi) throw err("ERR_ACCES_PLATEFORME");
    if (moi.kind === "entree") {
      const entree = moi.entree;
      if (patch.telephone !== undefined) entree.telephone = patch.telephone;
      if (patch.adresse !== undefined) entree.adresse = patch.adresse;
      if (patch.adresse_ville !== undefined) entree.adresse_ville = patch.adresse_ville;
      if (patch.adresse_code_postal !== undefined)
        entree.adresse_code_postal = patch.adresse_code_postal;
      if (patch.adresse_pays !== undefined) entree.adresse_pays = patch.adresse_pays;
      saveDb(db);
      return this.dossierDepuisEntreeAdmin(db, entree);
    }
    await this.modifierProfil({
      telephone: patch.telephone,
      adresse: patch.adresse,
      adresse_ville: patch.adresse_ville,
      adresse_code_postal: patch.adresse_code_postal,
      adresse_pays: patch.adresse_pays,
    });
    return this.dossierDepuisProfilPrincipal(loadDb());
  }

  /** Validation partagée des téléversements du dossier employé. */
  private validerTeleversementEmploye(
    input: DocumentInput,
    extensions: string[]
  ): string {
    const nom = input.nom_fichier.trim();
    if (!nom) throw err("ERR_NOT_FOUND");
    const extension = nom.split(".").pop()?.toLowerCase() ?? "";
    const mimeOk =
      !input.mime_type || FORMATS_DOCUMENT_ACCEPTES.includes(input.mime_type);
    if (!extensions.includes(extension) || !mimeOk) {
      throw err("ERR_DOCUMENT_FORMAT");
    }
    if (
      input.taille_octets !== undefined &&
      input.taille_octets !== null &&
      input.taille_octets > TAILLE_MAX_DOCUMENT_OCTETS
    ) {
      throw err("ERR_DOCUMENT_TROP_GROS");
    }
    return nom;
  }

  async televerserPhotoDossierEmploye(
    input: DocumentInput
  ): Promise<DossierEmploye> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    const db = loadDb();
    const moi = this.moiEmploye(db);
    if (!moi) throw err("ERR_ACCES_PLATEFORME");
    this.validerTeleversementEmploye(input, ["jpg", "jpeg", "png"]);
    if (moi.kind === "entree") {
      moi.entree.photo_profil_path = `demo:photo-profil-${uid()}`;
      saveDb(db);
      return this.dossierDepuisEntreeAdmin(db, moi.entree);
    }
    await this.televerserPhotoProfil(input);
    return this.dossierDepuisProfilPrincipal(loadDb());
  }

  async televerserPieceDossierEmploye(
    input: DocumentInput
  ): Promise<DossierEmploye> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    const db = loadDb();
    const moi = this.moiEmploye(db);
    if (!moi) throw err("ERR_ACCES_PLATEFORME");
    if (moi.kind === "entree") {
      const nom = this.validerTeleversementEmploye(input, [
        "pdf",
        "jpg",
        "jpeg",
        "png",
      ]);
      const entree = moi.entree;
      if (
        db.plateforme.documentsComptes.some(
          (d) =>
            d.entite_type === "compte" &&
            d.entite_id === entree.id &&
            d.type === "piece_identite" &&
            d.nom_fichier.trim().toLowerCase() === nom.toLowerCase()
        )
      ) {
        throw err("ERR_DOCUMENT_DOUBLON");
      }
      const taille = input.taille_octets ?? null;
      const contenuConserve =
        input.contenu && taille !== null && taille <= LIMITE_DEMO_CONTENU_OCTETS
          ? input.contenu
          : null;
      db.plateforme.documentsComptes.push({
        id: uid(),
        owner_id: entree.id,
        type: "piece_identite",
        entite_type: "compte",
        entite_id: entree.id,
        nom_fichier: nom,
        storage_path: `demo:${uid()}`,
        taille_octets: taille,
        mime_type: input.mime_type ?? null,
        ajoute_par: entree.id,
        created_at: new Date().toISOString(),
        contenu: contenuConserve,
        contenu_non_conserve: Boolean(input.contenu) && !contenuConserve,
      });
      saveDb(db);
      return this.dossierDepuisEntreeAdmin(db, entree);
    }
    await this.ajouterDocumentCompte("piece_identite", input);
    return this.dossierDepuisProfilPrincipal(loadDb());
  }

  async listerDossierEmploye(adminId: string): Promise<DossierEmploye> {
    const db = loadDb();
    this.acteurSuperAdmin(db);
    const entree = db.plateforme.comptesAdmins.find((a) => a.id === adminId);
    if (entree) return this.dossierDepuisEntreeAdmin(db, entree);
    if (
      db.profil.id === adminId &&
      (db.profil.role === "admin" || db.profil.role === "super_admin")
    ) {
      return this.dossierDepuisProfilPrincipal(db);
    }
    const client = db.plateforme.comptesClients.find(
      (c) =>
        c.id === adminId && (c.role === "admin" || c.role === "super_admin")
    );
    if (client) return this.dossierDepuisClientPlateforme(db, client);
    throw err("ERR_INTROUVABLE");
  }

  /** Complétude du dossier employé d'un membre (vue Équipe démo). */
  private evaluationEquipe(
    db: DemoDb,
    id: string
  ): { complet: boolean; manquants: DossierEmploye["manquants"] } {
    const entree = db.plateforme.comptesAdmins.find((a) => a.id === id);
    if (entree) {
      const d = this.dossierDepuisEntreeAdmin(db, entree);
      return { complet: d.complet, manquants: d.manquants };
    }
    if (db.profil.id === id) {
      const d = this.dossierDepuisProfilPrincipal(db);
      return { complet: d.complet, manquants: d.manquants };
    }
    const client = db.plateforme.comptesClients.find((c) => c.id === id);
    if (client) {
      const d = this.dossierDepuisClientPlateforme(db, client);
      return { complet: d.complet, manquants: d.manquants };
    }
    return { complet: false, manquants: ["photo", "piece_identite", "telephone", "adresse"] };
  }

  async listerDossier(compteId: string): Promise<DossierCompte> {
    const db = loadDb();
    this.acteurPlateforme(db);
    const comptes = await this.listerComptesPlateforme();
    const compte = comptes.find((c) => c.id === compteId);
    if (!compte) throw err("ERR_INTROUVABLE");
    const estPrincipal = compteId === db.profil.id;

    const documentsCompte = estPrincipal
      ? db.documents.filter((d) => d.entite_type === "compte" && d.entite_id === compteId)
      : db.plateforme.documentsComptes.filter((d) => d.entite_id === compteId);
    const photoPath = estPrincipal
      ? db.profil.photo_profil_path ?? null
      : compte.dossier_complet
        ? `demo:photo-${compteId}`
        : null;

    // v1.7 : vignette d'un immeuble = sa photo principale (en démo,
    // la valeur stockée est directement affichable), sinon le
    // photo_url historique.
    const vignette = (i: Immeuble): string | null =>
      i.photos_urls?.[0] ?? i.photos?.[0] ?? i.photo_url ?? null;
    const immeublesPossedes = estPrincipal
      ? db.immeubles
          .filter((i) => i.owner_id === compteId)
          .map((i) => ({ id: i.id, nom: i.nom, ville: i.ville, adresse: i.adresse, photo_url: vignette(i) }))
      : [];
    const idsPossedes = new Set(immeublesPossedes.map((i) => i.id));
    const preuvesPropriete = estPrincipal
      ? db.documents.filter(
          (d) =>
            d.entite_type === "immeuble" &&
            d.type === "justificatif" &&
            idsPossedes.has(d.entite_id)
        )
      : [];

    const tousRattachements = db.plateforme.rattachements;
    const commeProprietaire = tousRattachements.filter(
      (r) => r.proprietaire_id === compteId
    );
    const commeGestionnaire = tousRattachements.filter(
      (r) =>
        r.gestionnaire_email.toLowerCase() === compte.email.toLowerCase()
    );
    const parcs = [db.immeubles, db.parcCizaGroup.immeubles];
    const resoudre = (id: string) => {
      for (const parc of parcs) {
        const trouve = parc.find((i) => i.id === id);
        if (trouve) return { id: trouve.id, nom: trouve.nom, ville: trouve.ville, adresse: trouve.adresse, photo_url: vignette(trouve) };
      }
      return null;
    };
    const immeublesGeres = commeGestionnaire
      .flatMap((r) => r.immeuble_ids)
      .map(resoudre)
      .filter((i): i is { id: string; nom: string; ville: string; adresse: string; photo_url: string | null } => i !== null);

    // v1.7 : immeubles créés par CE gestionnaire (revue plateforme) —
    // en démo, le créateur est identifié par l'id de session
    // « gestionnaire:<e-mail> » posé comme owner_id à la création.
    const identitesCreateur = new Set([
      compteId,
      `gestionnaire:${compte.email.toLowerCase()}`,
    ]);
    const tousDocuments = [...db.documents, ...db.parcCizaGroup.documents];
    const immeublesEnRevue = parcs
      .flat()
      .filter(
        (i) =>
          i.origine_creation === "gestionnaire" &&
          identitesCreateur.has(i.owner_id)
      )
      .map((i) => {
        const autorisation =
          tousDocuments
            .filter(
              (d) =>
                d.entite_type === "immeuble" &&
                d.type === "autorisation" &&
                d.entite_id === i.id
            )
            .sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ??
          null;
        return {
          id: i.id,
          nom: i.nom,
          ville: i.ville,
          adresse: i.adresse,
          photo_url: vignette(i),
          proprietaire_declare_nom: i.proprietaire_declare_nom,
          proprietaire_declare_email: i.proprietaire_declare_email,
          proprietaire_concordance: i.proprietaire_concordance,
          validation_statut: i.validation_statut,
          validation_motif: i.validation_motif,
          autorisation,
        };
      });

    const annonces = estPrincipal
      ? db.appartements
          .filter((a) => a.vitrine && idsPossedes.has(a.immeuble_id))
          .map((a) => ({
            id: a.id,
            immeuble_nom:
              db.immeubles.find((i) => i.id === a.immeuble_id)?.nom ?? "",
            numero: a.numero,
          }))
      : [];

    return {
      compte,
      checklist: db.plateforme.checklistsDossiers?.[compteId] ?? null,
      photo_profil_path: photoPath,
      photo_profil_url: null,
      documents_compte: documentsCompte,
      preuves_propriete: preuvesPropriete,
      rattachements_comme_proprietaire: commeProprietaire,
      rattachements_comme_gestionnaire: commeGestionnaire,
      demandes: db.plateforme.demandesRattachement.filter(
        (d) =>
          d.proprietaire_id === compteId ||
          d.gestionnaire_id === compteId ||
          d.gestionnaire_email.toLowerCase() === compte.email.toLowerCase()
      ),
      immeubles_possedes: immeublesPossedes,
      immeubles_geres: immeublesGeres,
      immeubles_en_revue: immeublesEnRevue,
      annonces,
      audit: db.plateforme.journal.filter(
        (e) => e.cible_id === compteId || e.cible_email === compte.email
      ),
    };
  }

  async rechercherCompteParDisplayId(
    displayId: string
  ): Promise<{ nom: string; display_id: string } | null> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    const db = loadDb();
    const trouve = this.trouverParDisplayId(db, displayId);
    if (!trouve || trouve.type_intention !== "gestionnaire") return null;
    // Recherche PUBLIQUE minimale : nom + Display ID, rien d'autre.
    return { nom: trouve.nom, display_id: displayId.trim().toUpperCase() };
  }

  async demanderRattachementParDisplayId(
    displayId: string
  ): Promise<DemandeRattachement> {
    const session = await this.getSession();
    if (
      !session ||
      session.id.startsWith("plateforme:") ||
      session.id.startsWith("gestionnaire:") ||
      session.id.startsWith("coprop:")
    ) {
      throw err("ERR_NOT_FOUND");
    }
    const db = loadDb();
    const cible = this.trouverParDisplayId(db, displayId);
    if (!cible || cible.type_intention !== "gestionnaire" || cible.id === db.profil.id) {
      throw err("ERR_INTROUVABLE");
    }
    const existante = db.plateforme.demandesRattachement.find(
      (d) =>
        d.proprietaire_id === db.profil.id &&
        d.gestionnaire_id === cible.id &&
        d.statut !== "refuse"
    );
    if (existante) throw err("ERR_DEMANDE_EXISTANTE");
    const demande: DemandeRattachement = {
      id: uid(),
      proprietaire_id: db.profil.id,
      proprietaire_email: db.profil.email,
      proprietaire_nom: db.profil.nom,
      gestionnaire_id: cible.id,
      gestionnaire_email: cible.email,
      gestionnaire_nom: cible.nom,
      gestionnaire_display_id: displayId.trim().toUpperCase(),
      statut: "en_attente_gestionnaire",
      created_at: new Date().toISOString(),
      repondu_le: null,
      valide_par: null,
      valide_le: null,
      rattachement_id: null,
    };
    db.plateforme.demandesRattachement.push(demande);
    saveDb(db);
    return demande;
  }

  async listerDemandesRattachement(): Promise<DemandeRattachement[]> {
    const session = await this.getSession();
    if (!session) return [];
    const db = loadDb();
    const toutes = [...db.plateforme.demandesRattachement].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
    if (session.id.startsWith("plateforme:")) return toutes;
    if (session.id.startsWith("gestionnaire:")) {
      const email = session.id.slice("gestionnaire:".length);
      return toutes.filter(
        (d) => d.gestionnaire_email.toLowerCase() === email
      );
    }
    if (session.id.startsWith("coprop:")) return [];
    // Compte principal : ses demandes envoyées (propriétaire) ET celles
    // reçues (si son intention est « gestionnaire »).
    const miennes = toutes.filter(
      (d) =>
        d.proprietaire_id === db.profil.id ||
        d.gestionnaire_email.toLowerCase() === db.profil.email.toLowerCase()
    );
    // Immeubles assignés du rattachement lié (écran d'assignation).
    return miennes.map((d) => {
      if (!d.rattachement_id) return d;
      const rattachement = db.plateforme.rattachements.find(
        (r) => r.id === d.rattachement_id
      );
      return rattachement
        ? { ...d, rattachement_immeuble_ids: [...rattachement.immeuble_ids] }
        : d;
    });
  }

  async repondreDemandeRattachement(
    demandeId: string,
    accepter: boolean
  ): Promise<DemandeRattachement> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    const db = loadDb();
    const demande = db.plateforme.demandesRattachement.find((d) => d.id === demandeId);
    if (!demande) throw err("ERR_INTROUVABLE");
    let statutContratActeur: StatutContrat;
    if (session.id.startsWith("gestionnaire:")) {
      const email = session.id.slice("gestionnaire:".length);
      if (demande.gestionnaire_email.toLowerCase() !== email) {
        throw err("ERR_INTROUVABLE");
      }
      statutContratActeur =
        this.compteGestionnaireDemo(db)?.statut_contrat ?? "sans_objet";
    } else if (
      !session.id.startsWith("plateforme:") &&
      !session.id.startsWith("coprop:")
    ) {
      if (demande.gestionnaire_email.toLowerCase() !== db.profil.email.toLowerCase()) {
        throw err("ERR_INTROUVABLE");
      }
      statutContratActeur = db.profil.statut_contrat ?? "sans_objet";
    } else {
      throw err("ERR_INTROUVABLE");
    }
    if (demande.statut !== "en_attente_gestionnaire") {
      throw err("ERR_STATUT_INVALIDE");
    }
    if (accepter) {
      // Verrou contrat : accepter exige un contrat VALIDÉ.
      if (statutContratActeur !== "valide") throw err("ERR_CONTRAT_NON_VALIDE");
      demande.statut = "en_attente_admin";
    } else {
      demande.statut = "refuse";
    }
    demande.repondu_le = new Date().toISOString();
    saveDb(db);
    return demande;
  }

  async validerRattachementAdmin(
    demandeId: string,
    accepter: boolean
  ): Promise<DemandeRattachement> {
    const db = loadDb();
    const acteur = this.acteurPlateforme(db);
    const demande = db.plateforme.demandesRattachement.find((d) => d.id === demandeId);
    if (!demande) throw err("ERR_INTROUVABLE");
    if (demande.statut !== "en_attente_admin") throw err("ERR_STATUT_INVALIDE");
    demande.valide_par = acteur.id;
    demande.valide_le = new Date().toISOString();
    if (accepter) {
      const compteGestV = db.plateforme.comptesClients.find(
        (c) => c.email.toLowerCase() === demande.gestionnaire_email.toLowerCase()
      );
      const compteProprioV = db.plateforme.comptesClients.find(
        (c) => c.id === demande.proprietaire_id
      );
      const rattachement: RattachementGestionnaire = {
        id: uid(),
        gestionnaire_id: demande.gestionnaire_email,
        gestionnaire_email: demande.gestionnaire_email,
        gestionnaire_nom: demande.gestionnaire_nom,
        gestionnaire_telephone: compteGestV?.telephone ?? null,
        contexte: "proprietaire",
        proprietaire_id: demande.proprietaire_id,
        proprietaire_nom: demande.proprietaire_nom,
        proprietaire_email: compteProprioV?.email ?? null,
        proprietaire_telephone: compteProprioV?.telephone ?? null,
        // AUCUN immeuble à la création : l'assignation est le geste du
        // propriétaire, via le mécanisme existant (immeuble_ids).
        immeuble_ids: [],
        statut: "actif",
        created_at: new Date().toISOString(),
      };
      db.plateforme.rattachements.push(rattachement);
      demande.rattachement_id = rattachement.id;
      demande.statut = "actif";
    } else {
      demande.statut = "refuse";
    }
    this.journaliserAudit(
      db,
      acteur,
      accepter ? "rattachement_valide" : "rattachement_refuse",
      "gestionnaire",
      demande.gestionnaire_id,
      demande.gestionnaire_email,
      { demande_id: demande.id, proprietaire: demande.proprietaire_email }
    );
    saveDb(db);
    return demande;
  }

  async assignerImmeublesRattachement(
    rattachementId: string,
    immeubleIds: string[]
  ): Promise<RattachementGestionnaire> {
    const session = await this.getSession();
    if (
      !session ||
      session.id.startsWith("plateforme:") ||
      session.id.startsWith("gestionnaire:") ||
      session.id.startsWith("coprop:")
    ) {
      throw err("ERR_NOT_FOUND");
    }
    const db = loadDb();
    const rattachement = db.plateforme.rattachements.find(
      (r) =>
        r.id === rattachementId &&
        r.proprietaire_id === db.profil.id &&
        r.statut === "actif"
    );
    if (!rattachement) throw err("ERR_INTROUVABLE");
    // Seuls les immeubles du propriétaire peuvent être assignés.
    rattachement.immeuble_ids = immeubleIds.filter((id) =>
      db.immeubles.some((i) => i.id === id && i.owner_id === db.profil.id)
    );
    saveDb(db);
    return rattachement;
  }

  /** Données d'en-tête du contrat pour un compte (principal / registre / démo). */
  private donneesContrat(
    db: DemoDb,
    compteId: string
  ): {
    nom: string;
    displayId: string;
    email: string;
    telephone: string | null;
    pays: string | null;
    langue: "fr" | "en";
  } | null {
    if (compteId === db.profil.id) {
      if (!db.profil.display_id) return null;
      return {
        nom: db.profil.nom,
        displayId: db.profil.display_id,
        email: db.profil.email,
        telephone: db.profil.telephone,
        pays: db.profil.pays,
        langue: db.profil.langue,
      };
    }
    const entree = db.plateforme.comptesClients.find((c) => c.id === compteId);
    if (entree) {
      return {
        nom: entree.nom,
        displayId: entree.display_id,
        email: entree.email,
        telephone: entree.telephone,
        pays: entree.pays,
        langue: entree.langue,
      };
    }
    const marc = this.compteGestionnaireDemo(db);
    if (marc && compteId === marc.id) {
      return {
        nom: marc.nom,
        displayId: marc.display_id,
        email: marc.email,
        telephone: null,
        pays: "Canada",
        langue: "fr",
      };
    }
    return null;
  }

  async genererContratGestionnaire(
    compteId: string
  ): Promise<{ nomFichier: string; contenuBase64: string }> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    const db = loadDb();
    const donnees = this.donneesContrat(db, compteId);
    if (!donnees) throw err("ERR_INTROUVABLE");
    const estPlateforme = session.id.startsWith("plateforme:");
    const estSoi =
      compteId === db.profil.id ||
      (session.id.startsWith("gestionnaire:") &&
        donnees.email.toLowerCase() ===
          session.id.slice("gestionnaire:".length));
    if (!estPlateforme && !estSoi) throw err("ERR_INTROUVABLE");
    return genererContratGestionnairePdf({
      ...donnees,
      date: new Date().toISOString().slice(0, 10),
    });
  }

  async getMonContrat(): Promise<{
    statut: StatutContrat;
    display_id: string | null;
    nomFichier: string;
    contenuBase64: string | null;
  }> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    const db = loadDb();
    if (session.id.startsWith("gestionnaire:")) {
      const marc = this.compteGestionnaireDemo(db);
      if (!marc) throw err("ERR_NOT_FOUND");
      const pdf = await genererContratGestionnairePdf({
        nom: marc.nom,
        displayId: marc.display_id,
        email: marc.email,
        telephone: null,
        pays: "Canada",
        langue: "fr",
        date: new Date().toISOString().slice(0, 10),
      });
      return {
        statut: marc.statut_contrat,
        display_id: marc.display_id,
        nomFichier: pdf.nomFichier,
        contenuBase64: pdf.contenuBase64,
      };
    }
    if (session.id.startsWith("plateforme:") || session.id.startsWith("coprop:")) {
      throw err("ERR_NOT_FOUND");
    }
    const donnees = this.donneesContrat(db, db.profil.id);
    const pdf = donnees
      ? await genererContratGestionnairePdf({
          ...donnees,
          date: new Date().toISOString().slice(0, 10),
        })
      : null;
    return {
      statut: db.profil.statut_contrat ?? "sans_objet",
      display_id: db.profil.display_id ?? null,
      nomFichier: pdf?.nomFichier ?? "",
      contenuBase64: pdf?.contenuBase64 ?? null,
    };
  }

  async televerserContratSigne(input: DocumentInput): Promise<Document> {
    const document = await this.ajouterDocumentCompte("contrat", input);
    const session = await this.getSession();
    const db = loadDb();
    // Compte principal à intention gestionnaire : le contrat signé
    // attend maintenant la validation d'un Admin.
    if (
      session &&
      !session.id.startsWith("gestionnaire:") &&
      !session.id.startsWith("plateforme:") &&
      !session.id.startsWith("coprop:") &&
      db.profil.type_intention === "gestionnaire" &&
      db.profil.statut_contrat === "a_signer"
    ) {
      db.profil.statut_contrat = "signe_recu";
      saveDb(db);
    }
    return document;
  }

  async validerContrat(compteId: string): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurPlateforme(db);
    const cible = this.trouverCible(db, compteId);
    let emailCible: string;
    let nomCible: string;
    let langueCible: "fr" | "en";
    let displayIdCible: string | null;
    if (cible.principal) {
      if (db.profil.statut_contrat !== "signe_recu") {
        throw err("ERR_STATUT_INVALIDE");
      }
      db.profil.statut_contrat = "valide";
      emailCible = db.profil.email;
      nomCible = db.profil.nom;
      langueCible = db.profil.langue;
      displayIdCible = db.profil.display_id ?? null;
    } else {
      if (cible.entree!.statut_contrat !== "signe_recu") {
        throw err("ERR_STATUT_INVALIDE");
      }
      cible.entree!.statut_contrat = "valide";
      emailCible = cible.entree!.email;
      nomCible = cible.entree!.nom;
      langueCible = cible.entree!.langue;
      displayIdCible = cible.entree!.display_id;
    }
    const activation = rendreActivationGestionnaire(
      nomCible,
      displayIdCible ?? "",
      langueCible
    );
    const emailStatut = await this.envoyerEmailPlateforme(
      emailCible,
      activation.sujet,
      activation.corps,
      langueCible
    );
    this.journaliserAudit(db, acteur, "contrat_valide", "compte", compteId, emailCible, {
      display_id: displayIdCible,
      email_activation: emailStatut,
    });
    saveDb(db);
  }

  // ==========================================================================
  // OPTION C (2026-11-08) — Contrat de service PROPRIÉTAIRE non
  // bloquant (miroir démo du réel). Rétroactivité : la graine pose
  // « a_signer » sur les propriétaires déjà approuvés (profil
  // principal inclus) — aucun e-mail de rattrapage.
  // ==========================================================================

  async genererContratProprietaire(
    compteId: string
  ): Promise<{ nomFichier: string; contenuBase64: string }> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    const db = loadDb();
    const donnees = this.donneesContrat(db, compteId);
    if (!donnees) throw err("ERR_INTROUVABLE");
    const estPlateforme = session.id.startsWith("plateforme:");
    const estSoi = compteId === db.profil.id;
    if (!estPlateforme && !estSoi) throw err("ERR_INTROUVABLE");
    return genererContratProprietairePdf({
      ...donnees,
      date: new Date().toISOString().slice(0, 10),
    });
  }

  async getMonContratProprietaire(): Promise<{
    statut: StatutContratProprietaire;
    motif: string | null;
    display_id: string | null;
    nomFichier: string;
    contenuBase64: string | null;
  }> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    if (
      session.id.startsWith("gestionnaire:") ||
      session.id.startsWith("plateforme:") ||
      session.id.startsWith("coprop:")
    ) {
      throw err("ERR_NOT_FOUND");
    }
    const db = loadDb();
    const donnees = this.donneesContrat(db, db.profil.id);
    const pdf = donnees
      ? await genererContratProprietairePdf({
          ...donnees,
          date: new Date().toISOString().slice(0, 10),
        })
      : null;
    return {
      statut: db.profil.statut_contrat_proprietaire ?? "sans_objet",
      motif: db.profil.motif_contrat_proprietaire ?? null,
      display_id: db.profil.display_id ?? null,
      nomFichier: pdf?.nomFichier ?? "",
      contenuBase64: pdf?.contenuBase64 ?? null,
    };
  }

  async televerserContratProprietaireSigne(input: DocumentInput): Promise<Document> {
    const document = await this.ajouterDocumentCompte("contrat", input);
    const session = await this.getSession();
    const db = loadDb();
    if (
      session &&
      !session.id.startsWith("gestionnaire:") &&
      !session.id.startsWith("plateforme:") &&
      !session.id.startsWith("coprop:") &&
      db.profil.type_intention === "proprietaire" &&
      (db.profil.statut_contrat_proprietaire === "a_signer" ||
        db.profil.statut_contrat_proprietaire === "refuse")
    ) {
      db.profil.statut_contrat_proprietaire = "signe_depose";
      db.profil.motif_contrat_proprietaire = null;
      saveDb(db);
    }
    return document;
  }

  async validerContratProprietaire(compteId: string): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurPlateforme(db);
    const cible = this.trouverCible(db, compteId);
    let emailCible: string;
    let nomCible: string;
    let langueCible: "fr" | "en";
    let displayIdCible: string | null;
    if (cible.principal) {
      if (db.profil.statut_contrat_proprietaire !== "signe_depose") {
        throw err("ERR_STATUT_INVALIDE");
      }
      db.profil.statut_contrat_proprietaire = "valide";
      db.profil.motif_contrat_proprietaire = null;
      emailCible = db.profil.email;
      nomCible = db.profil.nom;
      langueCible = db.profil.langue;
      displayIdCible = db.profil.display_id ?? null;
    } else {
      if (cible.entree!.statut_contrat_proprietaire !== "signe_depose") {
        throw err("ERR_STATUT_INVALIDE");
      }
      cible.entree!.statut_contrat_proprietaire = "valide";
      cible.entree!.motif_contrat_proprietaire = null;
      emailCible = cible.entree!.email;
      nomCible = cible.entree!.nom;
      langueCible = cible.entree!.langue;
      displayIdCible = cible.entree!.display_id;
    }
    const validation = rendreValidationContratProprietaire(nomCible, langueCible);
    const emailStatut = await this.envoyerEmailPlateforme(
      emailCible,
      validation.sujet,
      validation.corps,
      langueCible
    );
    this.journaliserAudit(db, acteur, "contrat_proprietaire_valide", "compte", compteId, emailCible, {
      display_id: displayIdCible,
      email_validation: emailStatut,
    });
    saveDb(db);
  }

  async refuserContratProprietaire(compteId: string, motif: string): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurPlateforme(db);
    const motifNet = (motif ?? "").trim();
    if (!motifNet) throw err("ERR_MOTIF_REQUIS");
    const cible = this.trouverCible(db, compteId);
    let emailCible: string;
    let nomCible: string;
    let langueCible: "fr" | "en";
    let displayIdCible: string | null;
    if (cible.principal) {
      if (db.profil.statut_contrat_proprietaire !== "signe_depose") {
        throw err("ERR_STATUT_INVALIDE");
      }
      db.profil.statut_contrat_proprietaire = "refuse";
      db.profil.motif_contrat_proprietaire = motifNet;
      emailCible = db.profil.email;
      nomCible = db.profil.nom;
      langueCible = db.profil.langue;
      displayIdCible = db.profil.display_id ?? null;
    } else {
      if (cible.entree!.statut_contrat_proprietaire !== "signe_depose") {
        throw err("ERR_STATUT_INVALIDE");
      }
      cible.entree!.statut_contrat_proprietaire = "refuse";
      cible.entree!.motif_contrat_proprietaire = motifNet;
      emailCible = cible.entree!.email;
      nomCible = cible.entree!.nom;
      langueCible = cible.entree!.langue;
      displayIdCible = cible.entree!.display_id;
    }
    const refus = rendreRefusContratProprietaire(nomCible, motifNet, langueCible);
    const emailStatut = await this.envoyerEmailPlateforme(
      emailCible,
      refus.sujet,
      refus.corps,
      langueCible
    );
    this.journaliserAudit(db, acteur, "contrat_proprietaire_refuse", "compte", compteId, emailCible, {
      display_id: displayIdCible,
      motif: motifNet,
      email_refus: emailStatut,
    });
    saveDb(db);
  }

  // ==========================================================================
  // EXTENSION v1.5 — Suppression de compte par le client, messagerie
  // directe supervisée, assignation des dossiers, page Équipe et espace
  // « Mes dossiers ». Voir docs/messagerie-suppression-v15.md.
  // Miroir DÉMO de la base : demande → lecture seule immédiate +
  // instantané ; annulation ≤ 30 jours → restauration à l'identique ;
  // exécution ≥ 30 jours par le Super Admin → factures anonymisées
  // puis compte supprimé ; plateforme en LECTURE SEULE sur les fils
  // propriétaire ↔ gestionnaire ; assignation = responsabilité.
  // ==========================================================================

  /** Session brute (synchrone) lue dans le stockage démo. */
  private sessionBrute(): SessionUser | null {
    if (!isBrowser()) return null;
    try {
      const raw = window.localStorage.getItem(DEMO_SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw) as SessionUser;
      return s?.id && s?.email ? s : null;
    } catch {
      return null;
    }
  }

  /** Copie profonde (données démo = JSON pur). */
  private copieProfonde<T>(valeur: T): T {
    return JSON.parse(JSON.stringify(valeur)) as T;
  }

  // --- Résolution d'identités (principal, registre, démo, plateforme) ----

  /** Résout une personne par id OU e-mail, toutes sources démo confondues. */
  private resoudrePersonne(
    db: DemoDb,
    ref: string | null | undefined
  ): {
    id: string;
    email: string;
    nom: string;
    display_id: string | null;
    admin_responsable_id: string | null;
  } | null {
    if (!ref) return null;
    const cle = ref.toLowerCase();
    const admin = db.plateforme.comptesAdmins.find(
      (a) => a.id === ref || a.email.toLowerCase() === cle
    );
    if (admin) {
      return { id: admin.id, email: admin.email, nom: admin.nom, display_id: null, admin_responsable_id: null };
    }
    if (db.profil.id === ref || db.profil.email.toLowerCase() === cle) {
      return {
        id: db.profil.id,
        email: db.profil.email,
        nom: db.profil.nom,
        display_id: db.profil.display_id ?? null,
        admin_responsable_id: db.profil.admin_responsable_id ?? null,
      };
    }
    if (
      db.parcCizaGroup.profil.id === ref ||
      db.parcCizaGroup.profil.email.toLowerCase() === cle
    ) {
      const p = db.parcCizaGroup.profil;
      return { id: p.id, email: p.email, nom: p.nom, display_id: null, admin_responsable_id: null };
    }
    const client = db.plateforme.comptesClients.find(
      (c) => c.id === ref || c.email.toLowerCase() === cle
    );
    if (client) {
      return {
        id: client.id,
        email: client.email,
        nom: client.nom,
        display_id: client.display_id,
        admin_responsable_id: client.admin_responsable_id ?? null,
      };
    }
    const marc = this.compteGestionnaireDemo(db);
    if (marc && (marc.id === ref || marc.email.toLowerCase() === cle)) {
      return {
        id: marc.id,
        email: marc.email,
        nom: marc.nom,
        display_id: marc.display_id,
        admin_responsable_id: null,
      };
    }
    const rattachement = db.plateforme.rattachements.find(
      (r) =>
        r.gestionnaire_id === ref ||
        r.gestionnaire_email.toLowerCase() === cle ||
        r.proprietaire_id === ref
    );
    if (rattachement) {
      if (rattachement.proprietaire_id === ref) {
        return {
          id: ref,
          email: "",
          nom: rattachement.proprietaire_nom ?? ref,
          display_id: null,
          admin_responsable_id: null,
        };
      }
      return {
        id: rattachement.gestionnaire_id,
        email: rattachement.gestionnaire_email,
        nom: rattachement.gestionnaire_nom ?? rattachement.gestionnaire_email,
        display_id: null,
        admin_responsable_id: null,
      };
    }
    return null;
  }

  /** Nom d'affichage d'un Admin responsable (null si introuvable). */
  private resoudreNomAdmin(db: DemoDb, ref: string | null | undefined): string | null {
    if (!ref) return null;
    return this.resoudrePersonne(db, ref)?.nom ?? null;
  }

  /**
   * Tous les identifiants équivalents d'un Admin (entrée Admin, profil
   * principal lié, compte registre lié — même personne, par e-mail).
   */
  private aliasAdmin(db: DemoDb, id: string, email: string): Set<string> {
    const alias = new Set<string>([id, email.toLowerCase()]);
    const entree = db.plateforme.comptesAdmins.find(
      (a) => a.id === id || a.email.toLowerCase() === email.toLowerCase()
    );
    if (entree) {
      alias.add(entree.id);
      alias.add(entree.email.toLowerCase());
    }
    if (db.profil.id === id || db.profil.email.toLowerCase() === email.toLowerCase()) {
      alias.add(db.profil.id);
      alias.add(db.profil.email.toLowerCase());
    }
    const client = db.plateforme.comptesClients.find(
      (c) => c.id === id || c.email.toLowerCase() === email.toLowerCase()
    );
    if (client) {
      alias.add(client.id);
      alias.add(client.email.toLowerCase());
    }
    return alias;
  }

  /** Accès console effectif d'un Admin (entrée + profil lié). */
  private resoudreAccesAdmin(db: DemoDb, entree: CompteAdmin): boolean {
    let acces = entree.acces_admin_actif ?? true;
    if (db.profil.email.toLowerCase() === entree.email.toLowerCase()) {
      acces = acces && (db.profil.acces_admin_actif ?? true);
    }
    const client = db.plateforme.comptesClients.find(
      (c) => c.email.toLowerCase() === entree.email.toLowerCase()
    );
    if (client) acces = acces && (client.acces_admin_actif ?? true);
    return acces;
  }

  /** Charge d'un Admin : dossiers clients dont il est le responsable. */
  private compterDossiersAssignes(db: DemoDb, alias: Set<string>): number {
    let total = 0;
    if (
      !db.principalSupprime &&
      db.profil.admin_responsable_id &&
      alias.has(db.profil.admin_responsable_id)
    ) {
      total += 1;
    }
    total += db.plateforme.comptesClients.filter(
      (c) => c.admin_responsable_id && alias.has(c.admin_responsable_id)
    ).length;
    return total;
  }

  /** Cibles liées d'un Admin désigné par id (entrée + profil + registre). */
  private ciblesAdmin(
    db: DemoDb,
    ref: string
  ): {
    entree: CompteAdmin | null;
    principalLie: boolean;
    registreLie: CompteClientDemo | null;
    role: Role | null;
    idCanonique: string;
    email: string | null;
  } {
    let entree =
      db.plateforme.comptesAdmins.find((a) => a.id === ref) ?? null;
    const principalLieDirect = db.profil.id === ref;
    const registreLieDirect =
      db.plateforme.comptesClients.find((c) => c.id === ref) ?? null;
    if (!entree) {
      const emailLie = principalLieDirect
        ? db.profil.email
        : registreLieDirect?.email ?? null;
      if (emailLie) {
        entree =
          db.plateforme.comptesAdmins.find(
            (a) => a.email.toLowerCase() === emailLie.toLowerCase()
          ) ?? null;
      }
    }
    const principalLie =
      principalLieDirect ||
      (entree !== null &&
        db.profil.email.toLowerCase() === entree.email.toLowerCase());
    const registreLie =
      registreLieDirect ??
      (entree
        ? db.plateforme.comptesClients.find(
            (c) => c.email.toLowerCase() === entree!.email.toLowerCase()
          ) ?? null
        : null);
    const role: Role | null =
      entree?.role ??
      (principalLie ? db.profil.role : registreLie?.role ?? null);
    return {
      entree,
      principalLie,
      registreLie,
      role,
      idCanonique: entree?.id ?? ref,
      email:
        entree?.email ??
        (principalLie ? db.profil.email : registreLie?.email ?? null),
    };
  }

  /** Résout un Admin par id pour l'assignation (rôle plateforme exigé). */
  private resoudreAdminParId(
    db: DemoDb,
    ref: string
  ): { id: string; email: string; nom: string; role: "admin" | "super_admin" } | null {
    const cibles = this.ciblesAdmin(db, ref);
    if (!cibles.role || (cibles.role !== "admin" && cibles.role !== "super_admin")) {
      return null;
    }
    const personne = this.resoudrePersonne(db, cibles.idCanonique);
    return {
      id: cibles.idCanonique,
      email: cibles.email ?? personne?.email ?? "",
      nom: personne?.nom ?? cibles.email ?? ref,
      role: cibles.role,
    };
  }

  // --- Suppression de compte par le client --------------------------------

  /**
   * Garde des demandes de suppression : acteur CLIENT uniquement —
   * une session plateforme (ou restreinte gestionnaire/co-propriétaire,
   * sans compte propre en démo) est refusée ERR_OPERATION_INTERDITE.
   */
  private acteurClientSuppression(): void {
    const session = this.sessionBrute();
    if (!session) throw err("ERR_NOT_FOUND");
    if (
      session.id.startsWith("plateforme:") ||
      session.id.startsWith("gestionnaire:") ||
      session.id.startsWith("coprop:")
    ) {
      throw err("ERR_OPERATION_INTERDITE");
    }
  }

  async demanderSuppressionCompte(motDePasse: string): Promise<Profil> {
    this.acteurClientSuppression();
    // Renfort fondateur (2026-11-07) : la confirmation par mot de
    // passe est exigée ici comme en réel. La démo n'a pas de mots de
    // passe réels (la connexion démo accepte n'importe quel mot de
    // passe) : la vérification cohérente est la présence d'un mot de
    // passe non vide — vide → ERR_MOT_DE_PASSE_INCORRECT, aucun
    // changement d'état. Le mode réel, lui, ré-authentifie via
    // Supabase Auth (voir real.ts).
    if (!motDePasse || !motDePasse.trim()) {
      throw err("ERR_MOT_DE_PASSE_INCORRECT");
    }
    const db = loadDb();
    if (db.profil.suppression_demandee_le) {
      throw err("ERR_SUPPRESSION_DEJA_DEMANDEE");
    }
    const maintenant = new Date().toISOString();
    // Instantané COMPLET de l'abonnement courant (transitions
    // paresseuses appliquées d'abord), pris AVANT le passage en
    // lecture seule — restauré tel quel à l'annulation.
    const abo = this.chargerAbonnement(db);
    const instantane = this.copieProfonde(abo) as unknown as Record<string, unknown>;
    instantane.instantane_avant_suppression = null;
    db.profil.suppression_demandee_le = maintenant;
    abo.instantane_avant_suppression = instantane;
    abo.statut = "lecture_seule";
    // Audit signé par le CLIENT lui-même (rôle réel dans l'entrée).
    this.journaliserAudit(
      db,
      { id: db.profil.id, email: db.profil.email, role: db.profil.role },
      "suppression_demandee",
      "compte",
      db.profil.id,
      db.profil.email,
      { suppression_demandee_le: maintenant, echeance_le: ajouterJours(maintenant, 30) }
    );
    saveDb(db);
    return { ...db.profil };
  }

  async annulerSuppressionCompte(): Promise<Profil> {
    this.acteurClientSuppression();
    const db = loadDb();
    const demandeeLe = db.profil.suppression_demandee_le;
    if (!demandeeLe) throw err("ERR_AUCUNE_SUPPRESSION");
    const echeance = ajouterJours(demandeeLe, 30);
    if (Date.now() >= new Date(echeance).getTime()) throw err("ERR_DELAI_EXPIRE");
    const instantane = db.abonnement.instantane_avant_suppression;
    if (instantane) {
      // Restauration À L'IDENTIQUE (tous les champs de l'abonnement).
      const restaure = this.copieProfonde(instantane) as unknown as Abonnement;
      restaure.instantane_avant_suppression = null;
      db.abonnement = restaure;
    } else {
      db.abonnement.instantane_avant_suppression = null;
    }
    db.profil.suppression_demandee_le = null;
    this.journaliserAudit(
      db,
      { id: db.profil.id, email: db.profil.email, role: db.profil.role },
      "suppression_annulee",
      "compte",
      db.profil.id,
      db.profil.email,
      { suppression_demandee_le: demandeeLe }
    );
    saveDb(db);
    return { ...db.profil };
  }

  async listerSuppressionsEnAttente(): Promise<SuppressionEnAttente[]> {
    const db = loadDb();
    this.acteurPlateforme(db);
    const maintenant = Date.now();
    const construire = (
      compteId: string,
      email: string,
      nom: string,
      displayId: string | null,
      demandeeLe: string
    ): SuppressionEnAttente => {
      const echeanceLe = ajouterJours(demandeeLe, 30);
      return {
        compte_id: compteId,
        email,
        nom,
        display_id: displayId,
        suppression_demandee_le: demandeeLe,
        echeance_le: echeanceLe,
        executable: maintenant >= new Date(echeanceLe).getTime(),
      };
    };
    const liste: SuppressionEnAttente[] = [];
    if (!db.principalSupprime && db.profil.suppression_demandee_le) {
      liste.push(
        construire(
          db.profil.id,
          db.profil.email,
          db.profil.nom,
          db.profil.display_id ?? null,
          db.profil.suppression_demandee_le
        )
      );
    }
    for (const c of db.plateforme.comptesClients) {
      if (c.suppression_demandee_le) {
        liste.push(
          construire(c.id, c.email, c.nom, c.display_id, c.suppression_demandee_le)
        );
      }
    }
    return liste.sort((a, b) =>
      a.suppression_demandee_le.localeCompare(b.suppression_demandee_le)
    );
  }

  async executerSuppressionCompte(compteId: string): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurSuperAdmin(db);
    const cible = this.trouverCible(db, compteId);
    const demandeeLe = cible.principal
      ? db.profil.suppression_demandee_le
      : cible.entree!.suppression_demandee_le;
    if (!demandeeLe) throw err("ERR_AUCUNE_SUPPRESSION");
    const echeanceLe = ajouterJours(demandeeLe, 30);
    if (Date.now() < new Date(echeanceLe).getTime()) {
      throw err("ERR_DELAI_NON_ECOULE");
    }
    const emailCible = cible.principal ? db.profil.email : cible.entree!.email;
    // Factures du compte : anonymisation comptable (montants, dates et
    // moyens conservés ; références remplacées par « ANONYMISE »).
    // En démo, db.factures ne contient que les factures du compte
    // principal (owner_id) — le filtre par owner_id couvre donc les
    // seules factures accessibles ; un compte du registre n'en a pas.
    for (const f of db.factures) {
      if (f.owner_id !== compteId) continue;
      f.anonymise = true;
      if (f.stripe_invoice_id) f.stripe_invoice_id = "ANONYMISE";
      if (f.reference_mobile_money) f.reference_mobile_money = "ANONYMISE";
    }
    // Audit AVANT la suppression : l'entrée survit à la cible.
    this.journaliserAudit(db, acteur, "suppression_executee", "compte", compteId, emailCible, {
      suppression_demandee_le: demandeeLe,
      echeance_le: echeanceLe,
    });
    // Fils de discussion du compte supprimé (+ leurs messages).
    const convsSupprimees = new Set(
      db.conversations
        .filter((c) => c.proprietaire_id === compteId || c.gestionnaire_id === compteId)
        .map((c) => c.id)
    );
    db.conversations = db.conversations.filter((c) => !convsSupprimees.has(c.id));
    db.messages = db.messages.filter((m) => !convsSupprimees.has(m.conversation_id));
    if (cible.principal) {
      // Compte principal : le parc et les données liées sont vidés et
      // le compte est retiré des listes console (drapeau
      // principalSupprime — db.profil ne peut pas disparaître de la
      // structure démo mono-compte). Les factures ANONYMISÉES restent.
      db.immeubles = [];
      db.appartements = [];
      db.locataires = [];
      db.baux = [];
      db.echeances = [];
      db.paiements = [];
      db.depenses = [];
      db.documents = [];
      db.activites = [];
      db.alertes = [];
      db.coproprietaires = [];
      db.gestionnaires = [];
      db.paiementsMobileMoney = db.paiementsMobileMoney.filter(
        (p) => p.owner_id !== compteId
      );
      db.plateforme.demandesRattachement =
        db.plateforme.demandesRattachement.filter(
          (d) => d.proprietaire_id !== compteId && d.gestionnaire_id !== compteId
        );
      db.abonnement = {
        ...db.abonnement,
        statut: "annule",
        instantane_avant_suppression: null,
      };
      db.profil = {
        ...db.profil,
        nom: "Compte supprimé",
        suspendu: true,
        suppression_demandee_le: null,
      };
      db.principalSupprime = true;
    } else {
      // Compte du registre : suppression de l'entrée (profil +
      // abonnement embarqués) et de ses documents de dossier.
      db.plateforme.comptesClients = db.plateforme.comptesClients.filter(
        (c) => c.id !== compteId
      );
      db.plateforme.documentsComptes = db.plateforme.documentsComptes.filter(
        (d) => d.entite_id !== compteId && d.owner_id !== compteId
      );
      db.plateforme.demandesRattachement =
        db.plateforme.demandesRattachement.filter(
          (d) => d.proprietaire_id !== compteId && d.gestionnaire_id !== compteId
        );
    }
    saveDb(db);
  }

  // --- Messagerie directe ---------------------------------------------------

  /** Acteur messagerie de la session (null si non connecté). */
  private acteurMessagerieOuNull(db: DemoDb): {
    id: string;
    email: string;
    nom: string;
    role: string;
    estPlateforme: boolean;
    ids: Set<string>;
  } | null {
    const session = this.sessionBrute();
    if (!session) return null;
    if (session.id.startsWith("plateforme:")) {
      // Garde centrale (suspension + accès coupé v1.5 inclus).
      const acteur = this.acteurPlateforme(db);
      return {
        id: acteur.id,
        email: acteur.email,
        nom: acteur.nom,
        role: acteur.role,
        estPlateforme: true,
        ids: new Set([acteur.id, acteur.email.toLowerCase(), session.id]),
      };
    }
    if (session.id.startsWith("gestionnaire:")) {
      const marc = this.compteGestionnaireDemo(db);
      const email = session.id.slice("gestionnaire:".length);
      const id = marc?.id ?? session.id;
      return {
        id,
        email,
        nom: session.nom ?? marc?.nom ?? email,
        role: "gestionnaire",
        estPlateforme: false,
        ids: new Set([id, session.id, email.toLowerCase()]),
      };
    }
    if (session.id.startsWith("coprop:")) {
      const email = session.id.slice("coprop:".length);
      return {
        id: session.id,
        email,
        nom: session.nom ?? email,
        role: "coproprietaire",
        estPlateforme: false,
        ids: new Set([session.id, email.toLowerCase()]),
      };
    }
    return {
      id: db.profil.id,
      email: db.profil.email,
      nom: db.profil.nom,
      role: db.profil.role,
      estPlateforme: false,
      ids: new Set([db.profil.id, session.id, db.profil.email.toLowerCase(), session.email.toLowerCase()]),
    };
  }

  private acteurMessagerie(db: DemoDb) {
    const acteur = this.acteurMessagerieOuNull(db);
    if (!acteur) throw err("ERR_NOT_FOUND");
    return acteur;
  }

  /** Un acteur est participant d'un fil (ou plateforme = supervision). */
  private estParticipantConversation(
    db: DemoDb,
    acteur: { ids: Set<string>; estPlateforme: boolean },
    conv: Conversation
  ): boolean {
    if (acteur.estPlateforme) return true;
    for (const ref of [conv.proprietaire_id, conv.gestionnaire_id]) {
      if (!ref) continue;
      if (acteur.ids.has(ref) || acteur.ids.has(ref.toLowerCase())) return true;
      const personne = this.resoudrePersonne(db, ref);
      if (
        personne &&
        (acteur.ids.has(personne.id) || acteur.ids.has(personne.email.toLowerCase()))
      ) {
        return true;
      }
    }
    return false;
  }

  /** Conversation enrichie pour l'affichage (jointures + non-lus acteur). */
  private enrichirConversation(
    db: DemoDb,
    conv: Conversation,
    acteur: { ids: Set<string>; estPlateforme: boolean } | null
  ): Conversation {
    const msgs = db.messages
      .filter((m) => m.conversation_id === conv.id)
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const dernier = msgs.length > 0 ? msgs[msgs.length - 1] : null;
    const prop = this.resoudrePersonne(db, conv.proprietaire_id);
    const gest = conv.gestionnaire_id
      ? this.resoudrePersonne(db, conv.gestionnaire_id)
      : null;
    const adminResp = conv.admin_responsable_id
      ? this.resoudrePersonne(db, conv.admin_responsable_id)
      : null;
    let nonLus = 0;
    if (acteur) {
      nonLus = msgs.filter((m) => {
        if (acteur.ids.has(m.expediteur_id)) return false;
        return acteur.estPlateforme ? !m.lu_par_plateforme : !m.lu_par_client;
      }).length;
    }
    return {
      ...conv,
      proprietaire_nom: prop?.nom ?? conv.proprietaire_nom,
      proprietaire_email: prop?.email ?? conv.proprietaire_email,
      proprietaire_display_id: prop?.display_id ?? conv.proprietaire_display_id ?? null,
      gestionnaire_nom: gest?.nom ?? conv.gestionnaire_nom ?? null,
      gestionnaire_display_id: gest?.display_id ?? conv.gestionnaire_display_id ?? null,
      admin_responsable_nom: adminResp?.nom ?? conv.admin_responsable_nom ?? null,
      dernier_message: dernier?.corps ?? null,
      dernier_message_le: dernier?.created_at ?? null,
      non_lus: nonLus,
    };
  }

  async listerConversations(): Promise<Conversation[]> {
    const db = loadDb();
    const acteur = this.acteurMessagerieOuNull(db);
    if (!acteur) return [];
    const visibles = acteur.estPlateforme
      ? db.conversations.filter((c) => c.type === "plateforme")
      : db.conversations.filter((c) =>
          this.estParticipantConversation(db, acteur, c)
        );
    return visibles
      .map((c) => this.enrichirConversation(db, c, acteur))
      .sort((a, b) =>
        (b.dernier_message_le ?? b.created_at).localeCompare(
          a.dernier_message_le ?? a.created_at
        )
      );
  }

  async getConversationPlateforme(compteId?: string): Promise<Conversation> {
    const db = loadDb();
    const acteur = this.acteurMessagerie(db);
    let cibleId: string;
    if (acteur.estPlateforme) {
      cibleId = compteId ?? db.profil.id;
      if (!this.resoudrePersonne(db, cibleId)) {
        throw err("ERR_CONVERSATION_INTROUVABLE");
      }
    } else {
      if (
        compteId &&
        !acteur.ids.has(compteId) &&
        !acteur.ids.has(compteId.toLowerCase())
      ) {
        throw err("ERR_CONVERSATION_INTROUVABLE");
      }
      cibleId = acteur.id;
    }
    const existante = db.conversations.find(
      (c) => c.type === "plateforme" && c.proprietaire_id === cibleId
    );
    if (existante) return this.enrichirConversation(db, existante, acteur);
    const personne = this.resoudrePersonne(db, cibleId);
    const creee: Conversation = {
      id: uid(),
      type: "plateforme",
      proprietaire_id: cibleId,
      gestionnaire_id: null,
      rattachement_id: null,
      // Routage : l'Admin responsable du client au moment de la création.
      admin_responsable_id: personne?.admin_responsable_id ?? null,
      created_at: new Date().toISOString(),
    };
    db.conversations.push(creee);
    saveDb(db);
    return this.enrichirConversation(db, creee, acteur);
  }

  async getConversationRattachement(rattachementId: string): Promise<Conversation> {
    const db = loadDb();
    const acteur = this.acteurMessagerie(db);
    // Le paramètre peut désigner le rattachement ACTIF lui-même ou la
    // DEMANDE (actif) qui l'a créé.
    let rattachement =
      db.plateforme.rattachements.find(
        (r) => r.id === rattachementId && r.statut === "actif"
      ) ?? null;
    if (!rattachement) {
      const demande = db.plateforme.demandesRattachement.find(
        (d) => d.id === rattachementId
      );
      if (demande?.rattachement_id) {
        rattachement =
          db.plateforme.rattachements.find(
            (r) => r.id === demande.rattachement_id && r.statut === "actif"
          ) ?? null;
      }
    }
    if (!rattachement) throw err("ERR_CONVERSATION_INTROUVABLE");
    // Participants seuls (+ plateforme en supervision).
    if (!acteur.estPlateforme) {
      const refs = [
        rattachement.proprietaire_id,
        rattachement.gestionnaire_id,
        rattachement.gestionnaire_email,
      ].filter((r): r is string => Boolean(r));
      const estParticipant = refs.some(
        (ref) =>
          acteur.ids.has(ref) ||
          acteur.ids.has(ref.toLowerCase()) ||
          (() => {
            const p = this.resoudrePersonne(db, ref);
            return (
              p !== null &&
              (acteur.ids.has(p.id) || acteur.ids.has(p.email.toLowerCase()))
            );
          })()
      );
      if (!estParticipant) throw err("ERR_CONVERSATION_INTROUVABLE");
    }
    const existante = db.conversations.find(
      (c) => c.type === "rattachement" && c.rattachement_id === rattachement!.id
    );
    if (existante) return this.enrichirConversation(db, existante, acteur);
    const creee: Conversation = {
      id: uid(),
      type: "rattachement",
      proprietaire_id: rattachement.proprietaire_id ?? CIZAGROUP_OWNER_ID,
      gestionnaire_id: rattachement.gestionnaire_id,
      rattachement_id: rattachement.id,
      admin_responsable_id: null,
      created_at: new Date().toISOString(),
    };
    db.conversations.push(creee);
    saveDb(db);
    return this.enrichirConversation(db, creee, acteur);
  }

  async listerMessages(conversationId: string): Promise<MessageDirect[]> {
    const db = loadDb();
    const acteur = this.acteurMessagerie(db);
    const conv = db.conversations.find((c) => c.id === conversationId);
    if (!conv || !this.estParticipantConversation(db, acteur, conv)) {
      throw err("ERR_CONVERSATION_INTROUVABLE");
    }
    return db.messages
      .filter((m) => m.conversation_id === conversationId)
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((m) => ({
        ...m,
        expediteur_nom:
          this.resoudrePersonne(db, m.expediteur_id)?.nom ?? m.expediteur_nom,
      }));
  }

  async envoyerMessage(conversationId: string, corps: string): Promise<MessageDirect> {
    if (!corps || !corps.trim()) throw err("ERR_MESSAGE_VIDE");
    const db = loadDb();
    const acteur = this.acteurMessagerie(db);
    const conv = db.conversations.find((c) => c.id === conversationId);
    if (!conv || !this.estParticipantConversation(db, acteur, conv)) {
      throw err("ERR_CONVERSATION_INTROUVABLE");
    }
    // Supervision = LECTURE SEULE : la plateforme n'écrit jamais dans
    // un fil propriétaire ↔ gestionnaire (miroir du refus RLS réel).
    if (acteur.estPlateforme && conv.type === "rattachement") {
      throw err("ERR_SUPERVISION_LECTURE_SEULE");
    }
    const message: MessageDirect = {
      id: uid(),
      conversation_id: conversationId,
      expediteur_id: acteur.id,
      expediteur_nom: acteur.nom,
      corps: corps.trim(),
      created_at: new Date().toISOString(),
      // Le message naît lu par le côté EXPÉDITEUR.
      lu_par_client: !acteur.estPlateforme,
      lu_par_plateforme: acteur.estPlateforme,
    };
    db.messages.push(message);
    saveDb(db);
    return { ...message };
  }

  async marquerLu(conversationId: string): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurMessagerie(db);
    const conv = db.conversations.find((c) => c.id === conversationId);
    if (!conv || !this.estParticipantConversation(db, acteur, conv)) {
      throw err("ERR_CONVERSATION_INTROUVABLE");
    }
    for (const m of db.messages) {
      if (m.conversation_id !== conversationId) continue;
      if (acteur.estPlateforme) m.lu_par_plateforme = true;
      else m.lu_par_client = true;
    }
    saveDb(db);
  }

  async listerConversationsSupervisees(): Promise<Conversation[]> {
    const db = loadDb();
    this.acteurPlateforme(db);
    const acteur = this.acteurMessagerie(db);
    return db.conversations
      .filter((c) => c.type === "rattachement")
      .map((c) => this.enrichirConversation(db, c, acteur))
      .sort((a, b) =>
        (b.dernier_message_le ?? b.created_at).localeCompare(
          a.dernier_message_le ?? a.created_at
        )
      );
  }

  /**
   * Conversation « plateforme » enrichie pour la BOÎTE DE RÉCEPTION :
   * non-lus = messages DU CLIENT (expéditeur = proprietaire_id du
   * fil) non lus par la plateforme — jamais les messages d'un autre
   * membre de l'équipe. Miroir du compteur réel.
   */
  private enrichirConversationPlateforme(
    db: DemoDb,
    conv: Conversation
  ): Conversation {
    const msgs = db.messages
      .filter((m) => m.conversation_id === conv.id)
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const dernier = msgs.length > 0 ? msgs[msgs.length - 1] : null;
    const prop = this.resoudrePersonne(db, conv.proprietaire_id);
    const gest = conv.gestionnaire_id
      ? this.resoudrePersonne(db, conv.gestionnaire_id)
      : null;
    const adminResp = conv.admin_responsable_id
      ? this.resoudrePersonne(db, conv.admin_responsable_id)
      : null;
    const nonLus = msgs.filter(
      (m) => m.expediteur_id === conv.proprietaire_id && !m.lu_par_plateforme
    ).length;
    return {
      ...conv,
      proprietaire_nom: prop?.nom ?? conv.proprietaire_nom,
      proprietaire_email: prop?.email ?? conv.proprietaire_email,
      proprietaire_display_id: prop?.display_id ?? conv.proprietaire_display_id ?? null,
      gestionnaire_nom: gest?.nom ?? conv.gestionnaire_nom ?? null,
      gestionnaire_display_id: gest?.display_id ?? conv.gestionnaire_display_id ?? null,
      admin_responsable_nom: adminResp?.nom ?? conv.admin_responsable_nom ?? null,
      dernier_message: dernier?.corps ?? null,
      dernier_message_le: dernier?.created_at ?? null,
      non_lus: nonLus,
    };
  }

  /**
   * Boîte de réception plateforme (miroir démo) : TOUS les fils
   * « plateforme », assignés ou NON — un dossier non assigné
   * (admin_responsable_id NULL) compte et apparaît, comme en réel.
   */
  async listerConversationsPlateforme(): Promise<Conversation[]> {
    const db = loadDb();
    this.acteurPlateforme(db);
    return db.conversations
      .filter((c) => c.type === "plateforme")
      .map((c) => this.enrichirConversationPlateforme(db, c))
      .sort((a, b) =>
        (b.dernier_message_le ?? b.created_at).localeCompare(
          a.dernier_message_le ?? a.created_at
        )
      );
  }

  /** Badge console (miroir démo) : somme des non-lus de la boîte. */
  async compterMessagesPlateformeNonLus(): Promise<number> {
    const conversations = await this.listerConversationsPlateforme();
    return conversations.reduce((somme, c) => somme + (c.non_lus ?? 0), 0);
  }

  async journaliserConsultationMessages(conversationId: string): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurPlateforme(db);
    const conv = db.conversations.find((c) => c.id === conversationId);
    if (!conv || conv.type !== "rattachement") {
      throw err("ERR_CONVERSATION_INTROUVABLE");
    }
    this.journaliserAudit(db, acteur, "consultation_messages", "plateforme", conv.id, null, {
      conversation_id: conv.id,
      rattachement_id: conv.rattachement_id,
      proprietaire_id: conv.proprietaire_id,
      gestionnaire_id: conv.gestionnaire_id,
    });
    saveDb(db);
  }

  // --- Assignation des dossiers + équipe ------------------------------------

  async assignerDossier(compteId: string, adminId: string | null): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurSuperAdmin(db);
    const cible = this.trouverCible(db, compteId);
    let canonique: string | null = null;
    if (adminId !== null) {
      const admin = this.resoudreAdminParId(db, adminId);
      if (!admin) throw err("ERR_ADMIN_INTROUVABLE");
      canonique = admin.id;
    }
    if (cible.principal) {
      db.profil.admin_responsable_id = canonique;
    } else {
      cible.entree!.admin_responsable_id = canonique;
    }
    // Le fil plateforme existant du client suit le nouveau routage.
    for (const conv of db.conversations) {
      if (conv.type === "plateforme" && conv.proprietaire_id === compteId) {
        conv.admin_responsable_id = canonique;
      }
    }
    this.journaliserAudit(
      db,
      acteur,
      "assignation",
      "compte",
      compteId,
      cible.principal ? db.profil.email : cible.entree!.email,
      { admin_responsable_id: canonique }
    );
    saveDb(db);
  }

  async listerEquipeAdmins(): Promise<MembreEquipe[]> {
    const db = loadDb();
    this.acteurPlateforme(db);
    const membres: MembreEquipe[] = [];
    const emailsVus = new Set<string>();
    const construire = (
      id: string,
      email: string,
      nom: string,
      role: "admin" | "super_admin",
      statut: "actif" | "suspendu",
      acces: boolean,
      createdAt: string
    ): MembreEquipe => {
      const alias = this.aliasAdmin(db, id, email);
      const activitesActeur = db.plateforme.journal
        .filter(
          (e) =>
            (e.acteur_id !== null && alias.has(e.acteur_id)) ||
            e.acteur_email.toLowerCase() === email.toLowerCase()
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      // Dossier employé (2026-11-08) : complétude CALCULÉE du membre.
      const evaluation = this.evaluationEquipe(db, id);
      return {
        id,
        email,
        nom,
        role,
        statut,
        acces_admin_actif: acces,
        dossiers_assignes: this.compterDossiersAssignes(db, alias),
        derniere_activite: activitesActeur[0]?.created_at ?? null,
        created_at: createdAt,
        dossier_employe_complet: evaluation.complet,
        dossier_employe_manquants: evaluation.manquants,
      };
    };
    for (const a of db.plateforme.comptesAdmins) {
      emailsVus.add(a.email.toLowerCase());
      membres.push(
        construire(
          a.id,
          a.email,
          a.nom,
          a.role,
          a.statut,
          this.resoudreAccesAdmin(db, a),
          a.created_at
        )
      );
    }
    // Profils promus sans entrée Admin distincte (filet de cohérence).
    if (
      (db.profil.role === "admin" || db.profil.role === "super_admin") &&
      !emailsVus.has(db.profil.email.toLowerCase())
    ) {
      emailsVus.add(db.profil.email.toLowerCase());
      membres.push(
        construire(
          db.profil.id,
          db.profil.email,
          db.profil.nom,
          db.profil.role,
          db.profil.suspendu ? "suspendu" : "actif",
          db.profil.acces_admin_actif ?? true,
          db.profil.created_at
        )
      );
    }
    for (const c of db.plateforme.comptesClients) {
      if (
        (c.role === "admin" || c.role === "super_admin") &&
        !emailsVus.has(c.email.toLowerCase())
      ) {
        emailsVus.add(c.email.toLowerCase());
        membres.push(
          construire(
            c.id,
            c.email,
            c.nom,
            c.role,
            c.abonnement.statut === "suspendu" ? "suspendu" : "actif",
            c.acces_admin_actif ?? true,
            c.created_at
          )
        );
      }
    }
    return membres.sort((a, b) =>
      a.role === b.role
        ? a.email.localeCompare(b.email)
        : a.role === "super_admin"
          ? -1
          : 1
    );
  }

  async basculerAccesAdmin(adminId: string, actif: boolean): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurSuperAdmin(db);
    const cibles = this.ciblesAdmin(db, adminId);
    if (!cibles.entree && !cibles.principalLie && !cibles.registreLie) {
      throw err("ERR_INTROUVABLE");
    }
    // Cible : un employé « admin » uniquement (jamais le Super Admin).
    if (cibles.role !== "admin") throw err("ERR_OPERATION_INTERDITE");
    if (cibles.entree) cibles.entree.acces_admin_actif = actif;
    if (cibles.principalLie) db.profil.acces_admin_actif = actif;
    if (cibles.registreLie) cibles.registreLie.acces_admin_actif = actif;
    this.journaliserAudit(db, acteur, "acces_admin_modifie", "admin", cibles.idCanonique, cibles.email, {
      acces_admin_actif: actif,
    });
    saveDb(db);
  }

  async retirerRoleAdmin(adminId: string): Promise<void> {
    const db = loadDb();
    const acteur = this.acteurSuperAdmin(db);
    const cibles = this.ciblesAdmin(db, adminId);
    if (!cibles.entree && !cibles.principalLie && !cibles.registreLie) {
      throw err("ERR_INTROUVABLE");
    }
    if (cibles.role !== "admin") throw err("ERR_OPERATION_INTERDITE");
    // Le compte redevient client avec son rôle d'origine
    // (role_avant_admin, sinon l'intention déclarée à l'inscription).
    if (cibles.principalLie) {
      db.profil.role =
        db.profil.role_avant_admin ??
        (db.profil.type_intention === "gestionnaire"
          ? "gestionnaire"
          : "proprietaire");
      db.profil.role_avant_admin = null;
      db.profil.acces_admin_actif = true;
    }
    if (cibles.registreLie) {
      cibles.registreLie.role =
        cibles.registreLie.role_avant_admin ??
        (cibles.registreLie.type_intention === "gestionnaire"
          ? "gestionnaire"
          : "proprietaire");
      cibles.registreLie.role_avant_admin = null;
      cibles.registreLie.acces_admin_actif = true;
    }
    // Désassignation de tous ses dossiers (clients + routage des fils).
    const alias = this.aliasAdmin(db, cibles.idCanonique, cibles.email ?? "");
    alias.add(adminId);
    if (!db.principalSupprime && db.profil.admin_responsable_id && alias.has(db.profil.admin_responsable_id)) {
      db.profil.admin_responsable_id = null;
    }
    for (const c of db.plateforme.comptesClients) {
      if (c.admin_responsable_id && alias.has(c.admin_responsable_id)) {
        c.admin_responsable_id = null;
      }
    }
    for (const conv of db.conversations) {
      if (conv.admin_responsable_id && alias.has(conv.admin_responsable_id)) {
        conv.admin_responsable_id = null;
      }
    }
    this.journaliserAudit(db, acteur, "admin_retire", "admin", cibles.idCanonique, cibles.email);
    if (cibles.entree) {
      db.plateforme.comptesAdmins = db.plateforme.comptesAdmins.filter(
        (a) => a.id !== cibles.entree!.id
      );
    }
    saveDb(db);
  }

  async listerMesDossiers(): Promise<ComptePlateforme[]> {
    const db = loadDb();
    const acteur = this.acteurPlateforme(db);
    const alias = this.aliasAdmin(db, acteur.id, acteur.email);
    const comptes = await this.listerComptesPlateforme();
    return comptes.filter(
      (c) => c.admin_responsable_id !== null && alias.has(c.admin_responsable_id)
    );
  }
}

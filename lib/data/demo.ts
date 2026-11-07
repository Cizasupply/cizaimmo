import type { DataProvider } from "./provider";
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
  CibleAudit,
  CompteAdmin,
  ComptePlateforme,
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
  DossierCompte,
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
  StatutContrat,
  StatutWhatsApp,
  SupervisionGestionnaire,
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
  rendreDecisionGestionnaire,
} from "../avis";
import { genererContratGestionnairePdf } from "../contrat";
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
    if (db.preferences && (db.preferences as unknown as Record<string, unknown>).canal_whatsapp === undefined) {
      (db.preferences as unknown as Record<string, unknown>).canal_whatsapp = true;
      migre = true;
    }
    for (const alerte of db.alertes) {
      const rec = alerte as unknown as Record<string, unknown>;
      if (rec.whatsapp_statut === undefined) { rec.whatsapp_statut = "non_configuré"; migre = true; }
    }
    // Migration douce (module 5) : nouveaux champs de l'abonnement.
    const aboFrais = frais.abonnement;
    for (const cle of ["plan_en_attente", "date_effet_plan", "resiliation_programmee", "echec_paiement", "grace_ends_at", "lecture_seule_jusqu_au"] as const) {
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
      created_at: debut,
    };
    db.compteurDisplayId += 1;
    db.abonnement = {
      ...db.abonnement,
      owner_id: db.profil.id,
      plan: "pro",
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

  /** L'indivision exige le plan Pro ou Agence (l'essai = fonctions Pro). */
  private verifierPlanIndivision(db: DemoDb): void {
    const abo = this.chargerAbonnement(db);
    const planEffectif = abo.statut === "essai" ? "pro" : abo.plan;
    if (!INDIVISION_PAR_PLAN[planEffectif]) throw err("ERR_INDIVISION_PLAN");
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
    const immeuble: Immeuble = {
      id: uid(),
      owner_id: ownerId,
      ...input,
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
    const maj: Appartement = { ...courant, ...patch, numero: candidat.numero.trim() };
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

  async listerAnnoncesPubliques(): Promise<AnnoncePublique[]> {
    // Page publique : aucune session requise. Seuls les appartements
    // publiés, vacants ou réservés — jamais de coordonnée de locataire.
    const db = loadDb();
    return db.appartements
      .filter((a) => a.vitrine && !a.archive && (a.statut === "vacant" || a.statut === "reserve"))
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
    if (!apt || !apt.vitrine || apt.archive || (apt.statut !== "vacant" && apt.statut !== "reserve")) {
      return null;
    }
    return this.construireAnnonce(db, apt);
  }

  private construireAnnonce(db: DemoDb, appartement: Appartement): AnnoncePublique | null {
    const immeuble = db.immeubles.find((i) => i.id === appartement.immeuble_id);
    if (!immeuble) return null;
    return {
      appartement,
      immeuble_id: immeuble.id,
      immeuble_nom: immeuble.nom,
      ville: immeuble.ville,
      pays: immeuble.pays,
      contact: {
        nom: db.profil.nom,
        email: db.profil.email,
        telephone: db.profil.telephone ?? null,
      },
    };
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
      .sort((a, b) => b.date_emission.localeCompare(a.date_emission));
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
    return { id: entree.id, email: entree.email, nom: entree.nom, role: entree.role };
  }

  private acteurSuperAdmin(db: DemoDb) {
    const acteur = this.acteurPlateforme(db);
    if (acteur.role !== "super_admin") throw err("ERR_SUPER_ADMIN_REQUIS");
    return acteur;
  }

  private journaliserAudit(
    db: DemoDb,
    acteur: { id: string; email: string; role: "admin" | "super_admin" },
    action: string,
    cibleType: CibleAudit,
    cibleId: string | null,
    cibleEmail: string | null,
    details?: Record<string, unknown> | null
  ): void {
    db.plateforme.journal.push({
      id: uid(),
      acteur_id: acteur.id,
      acteur_email: acteur.email,
      acteur_role: acteur.role,
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
      dossier_complet: this.dossierCompletPrincipal(db),
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
      dossier_complet: entree.dossier_complet,
    };
  }

  async listerComptesPlateforme(): Promise<ComptePlateforme[]> {
    const db = loadDb();
    this.acteurPlateforme(db);
    const comptes = [
      this.comptePrincipal(db),
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
    } else {
      const abo = cible.entree!.abonnement;
      if (abo.statut !== "en_attente") throw err("ERR_COMPTE_NON_EN_ATTENTE");
      abo.statut = "essai";
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
      emailStatut = await this.envoyerEmailPlateforme(
        emailCible,
        decision.sujet,
        decision.corps,
        langueCible,
        [{ nom: contrat.nomFichier, contenuBase64: contrat.contenuBase64 }]
      );
      contratJoint = true;
    } else {
      const bienvenue = rendreBienvenue(nomCible, langueCible);
      emailStatut = await this.envoyerEmailPlateforme(
        emailCible,
        bienvenue.sujet,
        bienvenue.corps,
        langueCible
      );
    }
    this.journaliserAudit(db, acteur, "compte_approuve", "compte", compteId, emailCible, {
      grille: grilleConfirmee,
      trial_ends_at: finEssai,
      email_bienvenue: emailStatut,
      ...(contratJoint
        ? { contrat_envoye: true, display_id: displayIdCible }
        : {}),
    });
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
      );
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
    if (db.profil.email.toLowerCase() === adresse) nom = db.profil.nom;
    const client = db.plateforme.comptesClients.find(
      (c) => c.email.toLowerCase() === adresse
    );
    if (client) nom = client.nom;
    const invitation = db.gestionnaires.find(
      (g) => g.email.toLowerCase() === adresse
    );
    if (invitation) nom = invitation.nom ?? nom;
    if (!nom) throw err("ERR_INTROUVABLE");
    const cree: CompteAdmin = {
      id: uid(),
      email: adresse,
      nom,
      role: "admin",
      statut: "actif",
      created_at: new Date().toISOString(),
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
    const cree: RattachementGestionnaire = {
      id: uid(),
      gestionnaire_id: adresse,
      gestionnaire_email: adresse,
      gestionnaire_nom: input.gestionnaire_nom ?? invitation?.nom ?? null,
      contexte: input.contexte,
      proprietaire_id: proprietaireId,
      proprietaire_nom: proprietaireNom,
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

    const immeublesPossedes = estPrincipal
      ? db.immeubles
          .filter((i) => i.owner_id === compteId)
          .map((i) => ({ id: i.id, nom: i.nom, ville: i.ville }))
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
        if (trouve) return { id: trouve.id, nom: trouve.nom, ville: trouve.ville };
      }
      return null;
    };
    const immeublesGeres = commeGestionnaire
      .flatMap((r) => r.immeuble_ids)
      .map(resoudre)
      .filter((i): i is { id: string; nom: string; ville: string } => i !== null);

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
      photo_profil_path: photoPath,
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
      const rattachement: RattachementGestionnaire = {
        id: uid(),
        gestionnaire_id: demande.gestionnaire_email,
        gestionnaire_email: demande.gestionnaire_email,
        gestionnaire_nom: demande.gestionnaire_nom,
        contexte: "proprietaire",
        proprietaire_id: demande.proprietaire_id,
        proprietaire_nom: demande.proprietaire_nom,
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
}

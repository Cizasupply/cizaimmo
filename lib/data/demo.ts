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
  Bail,
  BailInput,
  CautionStatut,
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
  FactureAbonnement,
  FiltreAppartements,
  FiltreBaux,
  FiltreDepenses,
  FiltreDocuments,
  FiltreEcheances,
  FiltreRecus,
  GestionnaireInvite,
  Immeuble,
  ImmeubleInput,
  ImmeublePatch,
  LienLocataire,
  LimiteBlocs,
  Locataire,
  LocataireInput,
  LocatairePatch,
  OperateurMobileMoney,
  Paiement,
  PaiementMobileMoney,
  Plan,
  PreferencesNotifications,
  Profil,
  ProfilPatch,
  Recu,
  SessionUser,
  SignUpInput,
  StatutAppartement,
  StatutWhatsApp,
  TauxChange,
  TauxManuelInput,
  TauxResultat,
  TypeAlerte,
  TypeActivite,
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
import { buildDemoDb, GESTIONNAIRE_DEMO_EMAIL, type DemoDb } from "./demo-seed";
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

export const DEMO_SESSION_COOKIE = "cizaimmo-demo-session";
const DEMO_DB_KEY = "cizaimmo-demo-db-v1";
const DEMO_SESSION_KEY = "cizaimmo-demo-session-v1";

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
    const { debut, fin } = trialDates();
    db.profil = {
      id: db.profil.id,
      nom: input.nom,
      email: input.email.trim().toLowerCase(),
      pays: input.pays,
      langue: input.langue,
      devise_principale: input.devisePrincipale,
      role: "proprietaire",
      telephone: null,
      created_at: debut,
    };
    db.abonnement = {
      ...db.abonnement,
      owner_id: db.profil.id,
      plan: "pro",
      grille: grillePourPays(input.pays),
      statut: "essai",
      debut_periode: debut,
      fin_periode: fin,
      trial_ends_at: fin,
      plan_en_attente: null,
      date_effet_plan: null,
      resiliation_programmee: false,
      echec_paiement: false,
      grace_ends_at: null,
      lecture_seule_jusqu_au: null,
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
    if (session.id.startsWith("coprop:") || session.id.startsWith("gestionnaire:")) return null;
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
      const invitation = db.gestionnaires.find(
        (g) => g.email.trim().toLowerCase() === emailGestionnaire
      );
      return new Set(invitation?.immeuble_ids ?? []);
    }
    return null;
  }

  /** Immeuble d'un appartement (résolution pour le filtrage coproprietaire). */
  private immeubleDeAppartement(db: DemoDb, appartementId: string): string | null {
    return db.appartements.find((a) => a.id === appartementId)?.immeuble_id ?? null;
  }

  private immeubleDeBail(db: DemoDb, bailId: string): string | null {
    const bail = db.baux.find((b) => b.id === bailId);
    return bail ? this.immeubleDeAppartement(db, bail.appartement_id) : null;
  }

  private immeubleDeEcheance(db: DemoDb, echeanceId: string): string | null {
    const ech = db.echeances.find((e) => e.id === echeanceId);
    return ech ? this.immeubleDeBail(db, ech.bail_id) : null;
  }

  /** Un locataire est visible pour une session restreinte s'il a au
   * moins un bail (actif ou terminé) sur un immeuble visible. */
  private locataireVisible(db: DemoDb, locataireId: string, visibles: Set<string>): boolean {
    return db.baux.some((b) => {
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
    db.activites.push({
      id: uid(),
      owner_id: db.profil.id,
      type,
      entite_type: entiteType,
      entite_id: entiteId,
      auteur: auteurId ?? null,
      description,
      created_at: new Date().toISOString(),
    });
  }

  private nomLocataire(db: DemoDb, locataireId: string): string {
    return db.locataires.find((l) => l.id === locataireId)?.nom ?? "—";
  }

  private async verifierLimiteBlocs(db: DemoDb, nbActifs: number): Promise<void> {
    const abo = db.abonnement;
    const limite = limiteBlocs(abo.plan, abo.statut);
    if (nbActifs >= limite) throw err("ERR_LIMITE_BLOCS");
  }

  async listerImmeubles(inclureArchives = false): Promise<Immeuble[]> {
    const db = loadDb();
    const visibles = this.immeublesVisibles(db);
    return db.immeubles
      .filter((i) => inclureArchives || i.statut === "actif")
      .filter((i) => !visibles || visibles.has(i.id))
      .slice()
      .sort((a, b) => a.nom.localeCompare(b.nom));
  }

  async getImmeuble(id: string): Promise<Immeuble | null> {
    const db = loadDb();
    const visibles = this.immeublesVisibles(db);
    if (visibles && !visibles.has(id)) return null;
    return db.immeubles.find((i) => i.id === id) ?? null;
  }

  async creerImmeuble(input: ImmeubleInput): Promise<Immeuble> {
    const ownerId = await this.requireOwnerId();
    const db = loadDb();
    this.verifierEcriture(db);
    if (input.valeur_bien !== null && input.valeur_bien <= 0) throw err("ERR_VALEUR_NON_POSITIVE");
    if (input.prix_acquisition !== null && input.prix_acquisition < 0) throw err("ERR_VALEUR_NON_POSITIVE");
    if (
      db.immeubles.some(
        (i) => i.owner_id === ownerId && i.nom.trim().toLowerCase() === input.nom.trim().toLowerCase()
      )
    ) {
      throw err("ERR_IMMEUBLE_NOM_UNIQUE");
    }
    const nbActifs = db.immeubles.filter(
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
    db.immeubles.push(immeuble);
    saveDb(db);
    return immeuble;
  }

  async modifierImmeuble(id: string, patch: ImmeublePatch): Promise<Immeuble> {
    const ownerId = await this.requireOwnerId();
    const db = loadDb();
    this.verifierEcriture(db);
    const idx = db.immeubles.findIndex((i) => i.id === id && i.owner_id === ownerId);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    if (patch.valeur_bien !== undefined && patch.valeur_bien !== null && patch.valeur_bien <= 0) {
      throw err("ERR_VALEUR_NON_POSITIVE");
    }
    if (patch.nom) {
      const nom = patch.nom.trim().toLowerCase();
      if (db.immeubles.some((i) => i.id !== id && i.owner_id === ownerId && i.nom.trim().toLowerCase() === nom)) {
        throw err("ERR_IMMEUBLE_NOM_UNIQUE");
      }
    }
    const maj: Immeuble = {
      ...db.immeubles[idx],
      ...patch,
      nom: patch.nom ? patch.nom.trim() : db.immeubles[idx].nom,
    };
    db.immeubles[idx] = maj;
    saveDb(db);
    return maj;
  }

  async archiverImmeuble(id: string): Promise<Immeuble> {
    return this.modifierImmeuble(id, { statut: "archive" });
  }

  async desarchiverImmeuble(id: string): Promise<Immeuble> {
    const ownerId = await this.requireOwnerId();
    const db = loadDb();
    this.verifierEcriture(db);
    const nbActifs = db.immeubles.filter(
      (i) => i.owner_id === ownerId && i.statut === "actif"
    ).length;
    await this.verifierLimiteBlocs(db, nbActifs);
    return this.modifierImmeuble(id, { statut: "actif" });
  }

  async listerAppartements(
    filtre?: FiltreAppartements & { inclureArchives?: boolean }
  ): Promise<Appartement[]> {
    const db = loadDb();
    const visibles = this.immeublesVisibles(db);
    return db.appartements
      .filter((a) => (filtre?.inclureArchives ? true : !a.archive))
      .filter((a) => !filtre?.immeubleId || a.immeuble_id === filtre.immeubleId)
      .filter((a) => !filtre?.statut || a.statut === filtre.statut)
      .filter((a) => !visibles || visibles.has(a.immeuble_id))
      .slice()
      .sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
  }

  async getAppartement(id: string): Promise<Appartement | null> {
    const db = loadDb();
    const apt = db.appartements.find((a) => a.id === id) ?? null;
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
      db.appartements.some(
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
    this.verifierEcriture(db);
    if (!db.immeubles.some((i) => i.id === input.immeuble_id)) throw err("ERR_NOT_FOUND");
    if (input.statut === "occupe") throw err("ERR_SANS_BAIL");
    this.verifierAppartementInput(db, input.immeuble_id, input);
    const appartement: Appartement = {
      id: uid(),
      ...input,
      numero: input.numero.trim(),
      archive: false,
      created_at: new Date().toISOString(),
    };
    db.appartements.push(appartement);
    saveDb(db);
    return appartement;
  }

  async creerAppartementsEnLot(
    immeubleId: string,
    items: Omit<AppartementInput, "immeuble_id">[]
  ): Promise<Appartement[]> {
    await this.requireOwnerId();
    const db = loadDb();
    this.verifierEcriture(db);
    if (!db.immeubles.some((i) => i.id === immeubleId)) throw err("ERR_NOT_FOUND");
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
    db.appartements.push(...crees);
    saveDb(db);
    return crees;
  }

  async modifierAppartement(id: string, patch: AppartementPatch): Promise<Appartement> {
    await this.requireOwnerId();
    const db = loadDb();
    this.verifierEcriture(db);
    const idx = db.appartements.findIndex((a) => a.id === id);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    const courant = db.appartements[idx];
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
    const bailActif = db.baux.some(
      (b) => b.appartement_id === id && b.statut === "actif"
    );
    if (candidat.statut === "occupe" && !bailActif) throw err("ERR_SANS_BAIL");
    if (candidat.statut !== "occupe" && bailActif && courant.statut === "occupe") {
      throw err("ERR_APPARTEMENT_OCCUPE");
    }
    const maj: Appartement = { ...courant, ...patch, numero: candidat.numero.trim() };
    db.appartements[idx] = maj;
    saveDb(db);
    return maj;
  }

  private bailActifDe(db: DemoDb, appartementId: string): Bail | undefined {
    return db.baux.find((b) => b.appartement_id === appartementId && b.statut === "actif");
  }

  async changerStatutAppartement(
    id: string,
    statut: StatutAppartement
  ): Promise<Appartement> {
    const db = loadDb();
    this.verifierEcriture(db);
    const apt = db.appartements.find((a) => a.id === id);
    if (!apt) throw err("ERR_NOT_FOUND");
    const bailActif = this.bailActifDe(db, id);
    if (statut === "occupe" && !bailActif) throw err("ERR_SANS_BAIL");
    if (statut !== "occupe" && bailActif) throw err("ERR_APPARTEMENT_OCCUPE");
    return this.modifierAppartement(id, { statut });
  }

  async basculerVitrine(id: string, vitrine: boolean): Promise<Appartement> {
    const db = loadDb();
    this.verifierEcriture(db);
    const apt = db.appartements.find((a) => a.id === id);
    if (!apt) throw err("ERR_NOT_FOUND");
    // Spec §6 (vitrine) : seuls les vacants ou bientôt libres sont publiés.
    if (vitrine && apt.statut !== "vacant" && apt.statut !== "reserve") {
      throw err("ERR_VITRINE_STATUT");
    }
    return this.modifierAppartement(id, { vitrine });
  }

  async archiverAppartement(id: string): Promise<Appartement> {
    const db = loadDb();
    this.verifierEcriture(db);
    const apt = db.appartements.find((a) => a.id === id);
    if (!apt) throw err("ERR_NOT_FOUND");
    if (this.bailActifDe(db, id)) throw err("ERR_APPARTEMENT_OCCUPE");
    apt.archive = true;
    saveDb(db);
    return apt;
  }

  async desarchiverAppartement(id: string): Promise<Appartement> {
    const db = loadDb();
    this.verifierEcriture(db);
    const apt = db.appartements.find((a) => a.id === id);
    if (!apt) throw err("ERR_NOT_FOUND");
    apt.archive = false;
    saveDb(db);
    return apt;
  }

  async supprimerAppartement(id: string): Promise<void> {
    const db = loadDb();
    this.verifierEcriture(db);
    const apt = db.appartements.find((a) => a.id === id);
    if (!apt) throw err("ERR_NOT_FOUND");
    if (this.bailActifDe(db, id)) throw err("ERR_APPARTEMENT_OCCUPE");
    if (db.baux.some((b) => b.appartement_id === id)) throw err("ERR_BAIL_EXISTANT");
    db.appartements = db.appartements.filter((a) => a.id !== id);
    saveDb(db);
  }

  async listerLocataires(): Promise<Locataire[]> {
    const db = loadDb();
    const visibles = this.immeublesVisibles(db);
    return db.locataires
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
    const loc = db.locataires.find((l) => l.id === id) ?? null;
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
    db.locataires.push(locataire);
    saveDb(db);
    return locataire;
  }

  async modifierLocataire(id: string, patch: LocatairePatch): Promise<Locataire> {
    const ownerId = await this.requireOwnerId();
    const db = loadDb();
    this.verifierEcriture(db);
    const idx = db.locataires.findIndex((l) => l.id === id && l.owner_id === ownerId);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    const maj: Locataire = {
      ...db.locataires[idx],
      ...patch,
      nom: patch.nom ? patch.nom.trim() : db.locataires[idx].nom,
    };
    db.locataires[idx] = maj;
    saveDb(db);
    return maj;
  }

  async supprimerLocataire(id: string): Promise<void> {
    const db = loadDb();
    this.verifierEcriture(db);
    const loc = db.locataires.find((l) => l.id === id);
    if (!loc) throw err("ERR_NOT_FOUND");
    if (db.baux.some((b) => b.locataire_id === id && b.statut === "actif")) {
      throw err("ERR_LOCATAIRE_BAIL_ACTIF");
    }
    db.locataires = db.locataires.filter((l) => l.id !== id);
    saveDb(db);
  }

  async genererLienLocataire(id: string): Promise<LienLocataire> {
    const db = loadDb();
    this.verifierEcriture(db);
    const idx = db.locataires.findIndex((l) => l.id === id);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    const token = genererToken();
    const expireLe = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    db.locataires[idx].lien_token = token;
    db.locataires[idx].lien_expire_le = expireLe;
    saveDb(db);
    const origine =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "";
    return { token, expireLe, url: `${origine}/locataire/${token}` };
  }

  async revoquerLienLocataire(id: string): Promise<Locataire> {
    const db = loadDb();
    this.verifierEcriture(db);
    const idx = db.locataires.findIndex((l) => l.id === id);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    db.locataires[idx].lien_token = null;
    db.locataires[idx].lien_expire_le = null;
    saveDb(db);
    return db.locataires[idx];
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
    const visibles = this.immeublesVisibles(db);
    return db.baux
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
    const bail = db.baux.find((b) => b.id === id) ?? null;
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
    this.verifierEcriture(db);
    const appartement = db.appartements.find((a) => a.id === input.appartement_id);
    const locataire = db.locataires.find((l) => l.id === input.locataire_id);
    if (!appartement || !locataire) throw err("ERR_NOT_FOUND");
    if (input.loyer_mensuel <= 0) throw err("ERR_LOYER_NON_POSITIF");
    if (input.jour_exigibilite < 1 || input.jour_exigibilite > 28) throw err("ERR_JOUR_EXIGIBILITE");
    if (input.fin && input.fin <= input.debut) throw err("ERR_BAIL_FIN_AVANT_DEBUT");
    if (input.caution !== null && input.caution < 0) throw err("ERR_VALEUR_NON_POSITIVE");
    const chevauchement = db.baux.some(
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
    db.baux.push(bail);
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
    this.verifierEcriture(db);
    const idx = db.baux.findIndex((b) => b.id === id);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    const bail = db.baux[idx];
    bail.statut = "termine";
    if (cautionStatut) bail.caution_statut = cautionStatut;
    db.baux[idx] = bail;
    const session = await this.getSession();
    this.journaliser(
      db,
      "bail",
      "bail",
      bail.id,
      `Bail clôturé : ${this.nomLocataire(db, bail.locataire_id)} — appartement ${db.appartements.find((a) => a.id === bail.appartement_id)?.numero ?? "—"}`,
      session?.id
    );
    // L'appartement repasse « vacant » s'il n'a plus aucun bail actif.
    const autreActif = db.baux.some(
      (b) => b.appartement_id === bail.appartement_id && b.statut === "actif"
    );
    if (!autreActif) {
      const apt = db.appartements.find((a) => a.id === bail.appartement_id);
      if (apt) apt.statut = "vacant";
    }
    saveDb(db);
    return bail;
  }

  async listerDepenses(filtre?: FiltreDepenses): Promise<Depense[]> {
    const db = loadDb();
    const visibles = this.immeublesVisibles(db);
    return db.depenses
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
    const filtre: FiltreEcheances =
      typeof bailIdOuFiltre === "string"
        ? { bailId: bailIdOuFiltre }
        : bailIdOuFiltre ?? {};
    const visibles = this.immeublesVisibles(db);
    let liste = db.echeances
      .filter((e) => !filtre.bailId || e.bail_id === filtre.bailId)
      .filter((e) => !filtre.mois || e.mois === moisVersIso(filtre.mois))
      .filter((e) => {
        if (!visibles) return true;
        const imm = this.immeubleDeBail(db, e.bail_id);
        return imm !== null && visibles.has(imm);
      });
    if (filtre.immeubleId) {
      const bauxImmeuble = new Set(
        db.baux
          .filter((b) =>
            db.appartements.some(
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
    const visibles = this.immeublesVisibles(db);
    return db.paiements
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
    const bail = db.baux.find((b) => b.id === echeance.bail_id);
    const paye = totalPayeValide(
      db.paiements.filter((p) => p.echeance_id === echeance.id),
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
    const idx = db.echeances.findIndex((e) => e.id === echeanceId);
    if (idx >= 0) db.echeances[idx] = this.avecStatutCalcule(db, db.echeances[idx]);
  }

  async genererEcheances(mois: string): Promise<EcheanceLoyer[]> {
    const moisIso = moisVersIso(mois);
    const db = loadDb();
    this.verifierEcriture(db);
    // Session restreinte : on ne génère des échéances que pour ses
    // immeubles — sinon la visite d'un mois créerait des échéances
    // pour les biens des autres.
    const visibles = this.immeublesVisibles(db);
    const bauxActifs = db.baux.filter((b) => {
      if (b.statut !== "actif" || !bailCouvreMois(b, moisIso)) return false;
      if (!visibles) return true;
      const imm = this.immeubleDeAppartement(db, b.appartement_id);
      return imm !== null && visibles.has(imm);
    });
    for (const bail of bauxActifs) {
      const existe = db.echeances.some(
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
      db.echeances.push(echeance);
    }
    // Resynchroniser les statuts du mois avant de retourner.
    for (const e of db.echeances.filter((x) => x.mois === moisIso)) {
      this.resynchroniserStatut(db, e.id);
    }
    saveDb(db);
    return this.listerEcheances({ mois: moisIso });
  }

  async prochainNumeroRecu(): Promise<string> {
    const db = loadDb();
    return calculerProchainNumero(
      db.paiements.map((p) => p.recu_numero),
      new Date().getFullYear()
    );
  }

  async declarerPaiement(
    input: DeclarerPaiementInput
  ): Promise<{ paiement: Paiement; recuNumero: string }> {
    if (!input.montant || input.montant <= 0) throw err("ERR_MONTANT_NON_POSITIF");
    const session = await this.getSession();
    const db = loadDb();
    this.verifierEcriture(db);
    const echeance = db.echeances.find((e) => e.id === input.echeance_id);
    if (!echeance) throw err("ERR_ECHEANCE_INTROUVABLE");
    const annee = new Date(input.date_paiement).getFullYear();
    const recuNumero = calculerProchainNumero(
      db.paiements.map((p) => p.recu_numero),
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
    db.paiements.push(paiement);
    this.resynchroniserStatut(db, input.echeance_id);
    const echeanceLue = db.echeances.find((e) => e.id === input.echeance_id);
    const bailPaiement = echeanceLue ? db.baux.find((b) => b.id === echeanceLue.bail_id) : undefined;
    const aptPaiement = bailPaiement ? db.appartements.find((a) => a.id === bailPaiement.appartement_id) : undefined;
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
    this.verifierEcriture(db);
    const idx = db.paiements.findIndex((p) => p.id === id);
    if (idx < 0) throw err("ERR_PAIEMENT_INTROUVABLE");
    const paiement = db.paiements[idx];
    if (paiement.statut === "annule") throw err("ERR_PAIEMENT_DEJA_ANNULE");
    const maj: Paiement = {
      ...paiement,
      statut: "annule",
      annule_par: session?.id ?? null,
      annule_le: new Date().toISOString(),
      motif_annulation: motif?.trim() ? motif.trim() : null,
    };
    db.paiements[idx] = maj;
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
    this.verifierEcriture(db);
    const ancien = db.paiements.find((p) => p.id === id);
    if (!ancien) throw err("ERR_PAIEMENT_INTROUVABLE");
    if (ancien.statut === "annule") throw err("ERR_PAIEMENT_DEJA_ANNULE");
    // Un reçu émis ne se modifie pas : annulation + nouvelle déclaration.
    await this.annulerPaiement(id, "correction");
    const { paiement, recuNumero } = await this.declarerPaiement({
      ...input,
      echeance_id: ancien.echeance_id,
    });
    const db2 = loadDb();
    const idx = db2.paiements.findIndex((p) => p.id === paiement.id);
    if (idx >= 0) {
      db2.paiements[idx] = { ...db2.paiements[idx], remplace_paiement_id: id };
      saveDb(db2);
    }
    return { paiement: { ...paiement, remplace_paiement_id: id }, recuNumero };
  }

  /** Construit la vue « reçu » à partir d'un paiement et de ses entités liées. */
  private construireRecu(db: DemoDb, paiement: Paiement): Recu | null {
    if (!paiement.recu_numero) return null;
    const echeance = db.echeances.find((e) => e.id === paiement.echeance_id);
    if (!echeance) return null;
    const bail = db.baux.find((b) => b.id === echeance.bail_id);
    const locataire = bail ? db.locataires.find((l) => l.id === bail.locataire_id) : undefined;
    const appartement = bail ? db.appartements.find((a) => a.id === bail.appartement_id) : undefined;
    const immeuble = appartement ? db.immeubles.find((i) => i.id === appartement.immeuble_id) : undefined;
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
    const visibles = this.immeublesVisibles(db);
    let recus = db.paiements
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
    this.verifierEcriture(db);
    if (!db.immeubles.some((i) => i.id === input.immeuble_id)) throw err("ERR_NOT_FOUND");
    if (input.appartement_id && !db.appartements.some((a) => a.id === input.appartement_id)) {
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
    db.depenses.push(depense);
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
    this.verifierEcriture(db);
    const idx = db.depenses.findIndex((d) => d.id === id);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    if (patch.montant !== undefined && patch.montant !== null && patch.montant <= 0) {
      throw err("ERR_MONTANT_NON_POSITIF");
    }
    if (patch.categorie !== undefined && !patch.categorie) throw err("ERR_CATEGORIE_MANQUANTE");
    const maj: Depense = {
      ...db.depenses[idx],
      ...patch,
      libelle: patch.libelle ? patch.libelle.trim() : db.depenses[idx].libelle,
    };
    db.depenses[idx] = maj;
    saveDb(db);
    return maj;
  }

  async supprimerDepense(id: string): Promise<void> {
    const db = loadDb();
    this.verifierEcriture(db);
    if (!db.depenses.some((d) => d.id === id)) throw err("ERR_NOT_FOUND");
    db.depenses = db.depenses.filter((d) => d.id !== id);
    saveDb(db);
  }

  async listerDocuments(filtre?: FiltreDocuments): Promise<Document[]> {
    const db = loadDb();
    const visibles = this.immeublesVisibles(db);
    let liste = db.documents.slice();
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
          const dep = db.depenses.find((x) => x.id === d.entite_id);
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
      db.documents.some(
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
    db.documents.push(document);
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
    this.verifierEcriture(db);
    const idx = db.documents.findIndex((d) => d.id === id);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    const nom = nomFichier.trim();
    if (
      db.documents.some(
        (d) =>
          d.id !== id &&
          d.entite_type === db.documents[idx].entite_type &&
          d.entite_id === db.documents[idx].entite_id &&
          d.nom_fichier.trim().toLowerCase() === nom.toLowerCase()
      )
    ) {
      throw err("ERR_DOCUMENT_DOUBLON");
    }
    db.documents[idx] = { ...db.documents[idx], nom_fichier: nom };
    saveDb(db);
    return db.documents[idx];
  }

  async supprimerDocument(id: string): Promise<void> {
    const db = loadDb();
    this.verifierEcriture(db);
    if (!db.documents.some((d) => d.id === id)) throw err("ERR_NOT_FOUND");
    db.documents = db.documents.filter((d) => d.id !== id);
    saveDb(db);
  }

  async telechargerDocument(id: string): Promise<{ url: string; nomFichier: string }> {
    const db = loadDb();
    const doc = db.documents.find((d) => d.id === id);
    if (!doc) throw err("ERR_NOT_FOUND");
    if (!doc.contenu) throw err("ERR_DOCUMENT_CONTENU_ABSENT");
    return { url: doc.contenu, nomFichier: doc.nom_fichier };
  }

  async listerActivites(immeubleId?: string | null): Promise<Activite[]> {
    const db = loadDb();
    let liste = filtrerActivites(db.activites, immeubleId ?? null, db.appartements);
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
          const cop = db.coproprietaires.find((c) => c.id === a.entite_id);
          return cop !== undefined && visibles.has(cop.immeuble_id);
        }
        if (a.entite_type === "loyer") {
          const imm = a.entite_id ? this.immeubleDeEcheance(db, a.entite_id) : null;
          return imm !== null && visibles.has(imm);
        }
        if (a.entite_type === "depense") {
          const dep = db.depenses.find((x) => x.id === a.entite_id);
          return dep !== undefined && visibles.has(dep.immeuble_id);
        }
        if (a.entite_type === "bail") {
          const imm = a.entite_id ? this.immeubleDeBail(db, a.entite_id) : null;
          return imm !== null && visibles.has(imm);
        }
        if (a.entite_type === "document") {
          const doc = db.documents.find((x) => x.id === a.entite_id);
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
    const session = await this.getSession();
    const echeances = await this.listerEcheances();
    const visibles = this.immeublesVisibles(db);
    // Session restreinte : les alertes ne se génèrent que sur ses biens
    // (la lecture est déjà filtrée, mais on ne crée pas d'alertes pour
    // les autres immeubles — ni d'e-mails au propriétaire à leur sujet).
    const bauxVisibles = visibles
      ? db.baux.filter((b) => {
          const imm = this.immeubleDeAppartement(db, b.appartement_id);
          return imm !== null && visibles.has(imm);
        })
      : db.baux;
    const appartementsVisibles = visibles
      ? db.appartements.filter((a) => visibles.has(a.immeuble_id))
      : db.appartements;
    const paiementsVisibles = visibles
      ? db.paiements.filter((p) => {
          const imm = this.immeubleDeEcheance(db, p.echeance_id);
          return imm !== null && visibles.has(imm);
        })
      : db.paiements;
    const candidates = genererAlertesCandidates({
      baux: bauxVisibles,
      echeances,
      paiements: paiementsVisibles,
      appartements: appartementsVisibles,
      abonnement: db.abonnement,
      seuilVacanceJours: db.preferences.seuil_vacance_jours,
      langue: db.profil.langue,
    });
    const existantes = new Set(db.alertes.map((a) => a.dedup_key));
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
      db.alertes.push(alerte);
      this.journaliser(db, "alerte", "alerte", alerte.id, `Alerte déclenchée : ${c.message}`, session?.id);
    }
    saveDb(db);
    return this.listerAlertes();
  }

  async listerAlertes(): Promise<Alerte[]> {
    const db = loadDb();
    const visibles = this.immeublesVisibles(db);
    let liste = db.alertes.slice();
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
    const idx = db.alertes.findIndex((a) => a.id === id);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    const session = await this.getSession();
    db.alertes[idx] = { ...db.alertes[idx], statut: "traitee", traitee_le: new Date().toISOString() };
    this.journaliser(db, "alerte", "alerte", id, `Alerte traitée : ${db.alertes[idx].message}`, session?.id);
    saveDb(db);
    return db.alertes[idx];
  }

  async modifierProfil(patch: ProfilPatch): Promise<Profil> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    // Co-propriétaire et gestionnaire : le profil du compte appartient
    // au propriétaire — une session restreinte ne le modifie pas
    // (sinon le gestionnaire réécrirait le profil du propriétaire).
    if (session.id.startsWith("coprop:") || session.id.startsWith("gestionnaire:")) {
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
    const visibles = this.immeublesVisibles(db);
    if (visibles && !visibles.has(immeubleId)) return [];
    return db.coproprietaires
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
    this.verifierEcriture(db);
    this.verifierPlanIndivision(db);
    const immeuble = db.immeubles.find((i) => i.id === immeubleId);
    if (!immeuble) throw err("ERR_NOT_FOUND");
    const adresse = input.email.trim().toLowerCase();
    if (!emailValide(adresse)) throw err("ERR_EMAIL_INVALIDE");
    if (!Number.isFinite(input.part) || input.part <= 0 || input.part > 100) {
      throw err("ERR_PART_INVALIDE");
    }
    if (
      db.coproprietaires.some(
        (c) => c.immeuble_id === immeubleId && c.email.trim().toLowerCase() === adresse
      )
    ) {
      throw err("ERR_PART_EMAIL_UNIQUE");
    }
    const sommeApres =
      sommeParts(db.coproprietaires.filter((c) => c.immeuble_id === immeubleId)) +
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
    db.coproprietaires.push(coproprietaire);
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
    this.verifierEcriture(db);
    this.verifierPlanIndivision(db);
    const immeuble = db.immeubles.find((i) => i.id === immeubleId);
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
    const anciens = db.coproprietaires.filter((c) => c.immeuble_id === immeubleId);
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
        const idx = db.coproprietaires.findIndex((c) => c.id === ancien.id);
        db.coproprietaires[idx] = maj;
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
        db.coproprietaires.push(cree);
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
        db.coproprietaires = db.coproprietaires.filter((c) => c.id !== ancien.id);
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
    this.verifierEcriture(db);
    const cop = db.coproprietaires.find((c) => c.id === id);
    if (!cop) throw err("ERR_COPROPRIETAIRE_INTROUVABLE");
    const immeuble = db.immeubles.find((i) => i.id === cop.immeuble_id);
    db.coproprietaires = db.coproprietaires.filter((c) => c.id !== id);
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
    const idx = db.coproprietaires.findIndex((c) => c.id === id);
    if (idx < 0) throw err("ERR_COPROPRIETAIRE_INTROUVABLE");
    const cop = db.coproprietaires[idx];
    const estProprietaire = !this.sessionEstCoproprietaire();
    const estConcerne =
      session.email.trim().toLowerCase() === cop.email.trim().toLowerCase();
    if (!estProprietaire && !estConcerne) throw err("ERR_ROLE_LECTURE_SEULE");
    if (cop.statut === "actif") return cop;
    const maj: Coproprietaire = { ...cop, statut: "actif" };
    db.coproprietaires[idx] = maj;
    const immeuble = db.immeubles.find((i) => i.id === cop.immeuble_id);
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
    const idx = db.alertes.findIndex((a) => a.id === id);
    if (idx < 0) throw err("ERR_NOT_FOUND");
    db.alertes[idx] = { ...db.alertes[idx], whatsapp_statut: statut };
    saveDb(db);
    return db.alertes[idx];
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
    if (session.id.startsWith("coprop:") || session.id.startsWith("gestionnaire:")) {
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
      montant: prixPlan(plan, db.abonnement.grille),
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
      montant: prixPlan(planVise, abo.grille),
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
}

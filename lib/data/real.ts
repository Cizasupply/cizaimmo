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
  Coproprietaire,
  CoproprietaireInput,
  DeclarerPaiementInput,
  DemandeRattachement,
  Depense,
  DepenseInput,
  DepensePatch,
  Devise,
  Document,
  DocumentInput,
  ChecklistDossier,
  RevueImmeubleGestion,
  ChecklistDossierSaisie,
  DossierCompte,
  EntreeAudit,
  FiltreDocuments,
  GestionnaireInvite,
  Grille,
  ModeleAvis,
  MotifRefus,
  ParametresFinance,
  PreferencesNotifications,
  ProfilPatch,
  RattachementGestionnaire,
  StatutContrat,
  StatutContratProprietaire,
  StatutWhatsApp,
  SupervisionGestionnaire,
  TarifPlateforme,
  TauxChange,
  TauxManuelInput,
  TauxResultat,
  TypeAlerte,
  TypeActivite,
  Conversation,
  EcheanceLoyer,
  FactureAbonnement,
  FiltreAppartements,
  FiltreBaux,
  FiltreDepenses,
  FiltreEcheances,
  FiltreRecus,
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
  OperateurMobileMoney,
  Paiement,
  PaiementMobileMoney,
  Plan,
  Profil,
  Recu,
  SessionUser,
  SignUpInput,
  StatutAppartement,
  SuppressionEnAttente,
} from "./types";
import {
  construirePrixPlans,
  estEnRetardPaiement,
  PARAMETRES_FINANCE_DEFAUT,
  TARIFS_SEED,
} from "../tarifs";
import { attribuerGrille } from "../grille";
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
import { limiteBlocs, LIMITE_BLOCS } from "./types";
import {
  ajouterJours,
  ajouterMois,
  appliquerTransitions,
  estLectureSeule,
  genererReferenceMobileMoney,
  GRACE_ECHEC_PAIEMENT_JOURS,
  INDIVISION_PAR_PLAN,
  MOBILE_MONEY_EXPIRATION_HEURES,
  prixPlan,
  prochainNumeroFactureAbo,
  RANG_PLAN,
  telephoneMobileMoneyValide,
} from "../abonnement";
import { bauxSeChevauchent, emailValide, err, genererToken } from "./helpers";
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
} from "../module4";
import { sommeParts, validerParts } from "../indivision";
import { FORMATS_DOCUMENT_ACCEPTES, TAILLE_MAX_DOCUMENT_OCTETS } from "./types";
import { DEMO_SESSION_COOKIE, getSupabaseBrowserClient } from "../supabase";
import {
  envoyerEmailViaApi,
  statutEmailDepuisResultat,
  type EmailAlerte,
  type ResultatEnvoiEmail,
} from "../email";

/**
 * CizaImmo — fournisseur RÉEL (Supabase Auth + tables RLS, Module 1).
 *
 * - Inscription : Supabase Auth avec métadonnées (nom, pays,
 *   devise_principale, langue). Le trigger SQL `handle_new_user`
 *   (supabase/schema.sql) crée alors le profil + l'abonnement
 *   « en attente » (v1.4 : essai Starter de 30 jours à l'approbation,
 *   sans carte). En secours, si le trigger n'est pas
 *   installé, getProfil() crée le profil et l'essai à la première lecture.
 * - L'essai démarre à la validation de l'e-mail (spec §3) : tant que
 *   l'e-mail n'est pas confirmé, Supabase refuse la connexion et signIn
 *   lève une erreur claire.
 * - Les erreurs Supabase sont traduites en messages clairs (jamais de code
 *   technique affiché à l'utilisateur).
 */

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "invalidCredentials";
  if (m.includes("email not confirmed")) return "emailNotConfirmed";
  if (m.includes("user already registered") || m.includes("already registered"))
    return "emailAlreadyRegistered";
  if (m.includes("password") && m.includes("at least")) return "passwordTooShort";
  if (m.includes("rate limit") || m.includes("too many requests")) return "tooManyAttempts";
  return "genericError";
}

/** Erreur d'authentification portant une clé i18n du namespace « auth » (clé nue, sans préfixe) plutôt qu'un texte brut. */
export class AuthError extends Error {
  readonly i18nKey: string;
  constructor(i18nKey: string) {
    super(i18nKey);
    this.i18nKey = i18nKey;
  }
}

/**
 * v1.5 — Traduction des exceptions SQL des RPC (SECURITY DEFINER) en
 * codes d'erreur métier, sur le même patron que approuverCompte /
 * supprimerCompteDefinitivement : si le message contient la chaîne,
 * on mappe vers le code ; les chaînes connues non listées explicitement
 * passent en « ERR_<message> ».
 */
const MAPPAGE_ERREURS_RPC_V15: ReadonlyArray<readonly [string, string]> = [
  ["SUPPRESSION_DEJA_DEMANDEE", "ERR_SUPPRESSION_DEJA_DEMANDEE"],
  ["AUCUNE_SUPPRESSION", "ERR_AUCUNE_SUPPRESSION"],
  ["DELAI_NON_ECOULE", "ERR_DELAI_NON_ECOULE"],
  // DELAI_EXPIRE : la demande n'est plus annulable — assimilé à
  // « aucune suppression (annulable) en cours ».
  ["DELAI_EXPIRE", "ERR_AUCUNE_SUPPRESSION"],
  ["SUPER_ADMIN_REQUIS", "ERR_SUPER_ADMIN_REQUIS"],
  ["ADMIN_INTROUVABLE", "ERR_ADMIN_INTROUVABLE"],
  ["ADMIN_PLATEFORME_REQUIS", "ERR_OPERATION_INTERDITE"],
  ["CONVERSATION_NON_SUPERVISEE", "ERR_CONVERSATION_NON_SUPERVISEE"],
  ["CIBLE_NON_ADMIN", "ERR_CIBLE_NON_ADMIN"],
  ["AUTO_MODIFICATION_INTERDITE", "ERR_AUTO_MODIFICATION_INTERDITE"],
  ["AUTO_SUPPRESSION_INTERDITE", "ERR_AUTO_SUPPRESSION_INTERDITE"],
  ["COMPTE_PLATEFORME", "ERR_COMPTE_PLATEFORME"],
  ["PROFIL_INTROUVABLE", "ERR_PROFIL_INTROUVABLE"],
];

function erreurRpcV15(error: { message: string }): Error {
  for (const [chaine, code] of MAPPAGE_ERREURS_RPC_V15) {
    if (error.message.includes(chaine)) return err(code);
  }
  return new Error(error.message);
}

/** Ligne brute de la table conversations (v1.5), avant enrichissement d'affichage. */
type LigneConversation = Pick<
  Conversation,
  | "id"
  | "type"
  | "proprietaire_id"
  | "gestionnaire_id"
  | "rattachement_id"
  | "admin_responsable_id"
  | "created_at"
>;

/** Ligne brute de la table messages_directs (v1.5). */
type LigneMessage = Pick<
  MessageDirect,
  | "id"
  | "conversation_id"
  | "expediteur_id"
  | "corps"
  | "created_at"
  | "lu_par_client"
  | "lu_par_plateforme"
>;

function appUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return base.replace(/\/$/, "");
}

export class RealProvider implements DataProvider {
  readonly mode = "reel" as const;

  /**
   * Envoi e-mail des alertes (Correctif 2, spec §10) — injectable pour
   * les tests. Par défaut : route API serveur (/api/email/envoyer), qui
   * répond « non_configuré » tant qu'aucun fournisseur n'est branché —
   * jamais de faux envoi.
   */
  envoyerEmailAlerteFn: (
    email: EmailAlerte
  ) => Promise<ResultatEnvoiEmail> = envoyerEmailViaApi;

  private client() {
    const c = getSupabaseBrowserClient();
    if (!c) throw new AuthError("genericError");
    return c;
  }

  async getSession(): Promise<SessionUser | null> {
    const { data } = await this.client().auth.getSession();
    const user = data.session?.user;
    if (!user) return null;
    return {
      id: user.id,
      email: user.email ?? "",
      nom: (user.user_metadata?.nom as string | undefined) ?? null,
    };
  }

  async signUp(input: SignUpInput): Promise<{ needsEmailConfirmation: boolean }> {
    // Anti-fraude tarifaire (v1.2) : la matrice d'attribution est
    // calculée AVANT l'inscription (liste d'éligibilité DYNAMIQUE lue
    // dans parametres_finance — lecture publique) et transmise en
    // métadonnées ; le trigger handle_new_user la stocke et crée
    // l'abonnement « en_attente » (approbation manuelle, ajout n°3).
    let codesEligibles = PARAMETRES_FINANCE_DEFAUT.pays_grille_afrique;
    try {
      const parametres = await this.getParametresFinance();
      if (parametres.pays_grille_afrique.length > 0) {
        codesEligibles = parametres.pays_grille_afrique;
      }
    } catch {
      // Repli : liste seed — l'attribution reste prudente et la console
      // peut corriger (grille_statut fait foi, pas ce repli).
    }
    const attribution = attribuerGrille(
      { paysDeclare: input.pays, paysIp: input.paysIp ?? null },
      codesEligibles
    );
    const { data, error } = await this.client().auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.motDePasse,
      options: {
        data: {
          nom: input.nom,
          pays: input.pays,
          devise_principale: input.devisePrincipale,
          langue: input.langue,
          pays_ip: input.paysIp ?? null,
          grille_attribuee: attribution.grille,
          grille_statut: attribution.statut,
          // v1.3 : téléphone + intention — le trigger handle_new_user
          // (module-v13.sql) les stocke et génère le Display ID.
          telephone: input.telephone,
          intention: input.intention,
        },
        // Après validation de l'e-mail, Supabase redirige vers le callback
        // qui échange le code puis envoie vers le tableau de bord.
        emailRedirectTo: `${appUrl()}/auth/callback`,
      },
    });
    if (error) throw new AuthError(translateAuthError(error.message));
    // Pas de session immédiate = confirmation e-mail requise.
    const needsEmailConfirmation = !data.session;
    return { needsEmailConfirmation };
  }

  async signIn(email: string, motDePasse: string): Promise<void> {
    const client = this.client();
    const { error } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: motDePasse,
    });
    if (error) throw new AuthError(translateAuthError(error.message));
    // Extension v1.2 : compte REFUSÉ (ajout n°3) ou SUSPENDU par la
    // plateforme → connexion bloquée avec un message propre (la session
    // ouverte est refermée aussitôt). Un profil absent (secours du
    // trigger) ne bloque pas.
    const session = await this.getSession();
    if (session) {
      const { data } = await client
        .from("profils")
        .select("suspendu, motif_refus")
        .eq("id", session.id)
        .maybeSingle();
      if (data?.motif_refus) {
        await client.auth.signOut();
        throw new AuthError("accountRefused");
      }
      if (data?.suspendu) {
        await client.auth.signOut();
        throw new AuthError("accountSuspended");
      }
    }
  }

  async signOut(): Promise<void> {
    await this.client().auth.signOut();
    // Correctif 2026-11-07 (zone connectée figée) : effacer aussi un
    // éventuel cookie de session DÉMO résiduel (posé pendant la
    // période démo du 2026-11-06, valable 30 jours). Sans cela, le
    // middleware pouvait le prendre pour une session active et
    // renvoyer l'utilisateur déconnecté vers le tableau de bord —
    // déconnexion impossible. (Le middleware ne l'honore de toute
    // façon plus qu'en mode démo ; ceci nettoie le navigateur.)
    if (typeof document !== "undefined") {
      document.cookie = `${DEMO_SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
    }
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await this.client().auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${appUrl()}/auth/callback?next=/nouveau-mot-de-passe` }
    );
    if (error) throw new AuthError(translateAuthError(error.message));
  }

  async updatePassword(nouveauMotDePasse: string): Promise<void> {
    const { error } = await this.client().auth.updateUser({ password: nouveauMotDePasse });
    if (error) throw new AuthError(translateAuthError(error.message));
  }

  async getProfil(): Promise<Profil | null> {
    const session = await this.getSession();
    if (!session) return null;
    const client = this.client();
    const { data, error } = await client
      .from("profils")
      .select("*")
      .eq("id", session.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return mapProfil(data as Profil);
    // Secours si le trigger handle_new_user n'est pas installé : créer le
    // profil + l'essai Pro 30 jours à la première lecture.
    // Module 6 : un e-mail invité en indivision devient un compte
    // coproprietaire (lecture seule, sans abonnement) — pas un essai Pro.
    const nom = session.nom ?? session.email.split("@")[0];
    const { data: invitation } = await client
      .from("coproprietaires")
      .select("id")
      .eq("email", session.email)
      .limit(1)
      .maybeSingle();
    const role: Profil["role"] = invitation ? "coproprietaire" : "proprietaire";
    // Métadonnées d'inscription (matrice anti-fraude) si présentes.
    const { data: userData } = await client.auth.getUser();
    const meta = (userData.user?.user_metadata ?? {}) as Record<string, unknown>;
    const grilleMeta =
      meta.grille_attribuee === "afrique" || meta.grille_attribuee === "internationale"
        ? (meta.grille_attribuee as Profil["grille_attribuee"])
        : "internationale";
    const { data: created, error: insertError } = await client
      .from("profils")
      .insert({
        id: session.id,
        nom,
        email: session.email,
        pays: (meta.pays as string | undefined) ?? null,
        langue: (meta.langue as string | undefined) ?? "fr",
        devise_principale: (meta.devise_principale as string | undefined) ?? "USD",
        role,
        pays_declare: (meta.pays as string | undefined) ?? null,
        pays_ip: (meta.pays_ip as string | undefined) ?? null,
        grille_attribuee: grilleMeta,
        grille_statut: meta.grille_statut === "a_verifier" ? "a_verifier" : "ok",
      })
      .select()
      .single();
    if (insertError) throw new Error(insertError.message);
    if (role !== "coproprietaire") {
      // Approbation manuelle (ajout n°3) : en_attente, sans dates
      // d'essai ; v1.4 : pack Starter (plan + pack de fin d'essai).
      await client.from("abonnements").insert({
        owner_id: session.id,
        plan: "starter",
        plan_apres_essai: "starter",
        grille: grilleMeta ?? "internationale",
        statut: "en_attente",
        debut_periode: new Date().toISOString(),
        fin_periode: null,
        trial_ends_at: null,
      });
    }
    return mapProfil(created as Profil);
  }

  async getAbonnement(): Promise<Abonnement | null> {
    const session = await this.getSession();
    if (!session) return null;
    const { data, error } = await this.client()
      .from("abonnements")
      .select("*")
      .eq("owner_id", session.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const abo = data ? mapAbonnement(data as Abonnement) : null;
    if (!abo) return null;
    // Transitions paresseuses (spec §12) : fin d'essai, descente et
    // résiliation effectives, grâce dépassée. Persistées si changées.
    const { abo: maj, change } = appliquerTransitions(abo);
    if (change) {
      await this.client()
        .from("abonnements")
        .update({
          plan: maj.plan,
          plan_en_attente: maj.plan_en_attente,
          date_effet_plan: maj.date_effet_plan,
          resiliation_programmee: maj.resiliation_programmee,
          statut: maj.statut,
          lecture_seule_jusqu_au: maj.lecture_seule_jusqu_au,
        })
        .eq("id", maj.id);
      return maj;
    }
    return abo;
  }

  /**
   * Garde-fou lecture seule (Module 5, spec §12) : en lecture seule,
   * toute NOUVELLE saisie est refusée (ERR_ABONNEMENT_REQUIS). La
   * lecture et les exports ne passent jamais par ici.
   * Module 6 : un co-propriétaire (lecture seule) ne peut rien saisir
   * du tout — ERR_ROLE_LECTURE_SEULE (la RLS le refuserait aussi, mais
   * le code clair est traduit dans l'interface).
   */
  private async verifierEcritureAutorisee(): Promise<void> {
    const profil = await this.getProfil();
    if (profil?.role === "coproprietaire") throw err("ERR_ROLE_LECTURE_SEULE");
    const abo = await this.getAbonnement();
    if (abo && estLectureSeule(abo)) throw err("ERR_ABONNEMENT_REQUIS");
  }

  /** Rôle de la session courante (null si non connecté). */
  private async roleSession(): Promise<Profil["role"] | null> {
    const profil = await this.getProfil();
    return profil?.role ?? null;
  }

  /** L'indivision exige le plan Pro ou Agence (v1.4 : l'essai est
   * Starter, donc sans indivision — le plan en cours fait foi). */
  private async verifierPlanIndivision(): Promise<void> {
    const abo = await this.getAbonnement();
    if (!abo) throw err("ERR_NOT_FOUND");
    if (!INDIVISION_PAR_PLAN[abo.plan]) throw err("ERR_INDIVISION_PLAN");
  }

  /** Un co-propriétaire ne voit jamais les coordonnées des locataires. */
  private masquerCoordonneesLocataire(
    l: Locataire,
    estCoproprietaire: boolean
  ): Locataire {
    if (!estCoproprietaire) return l;
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

  // ==========================================================================
  // MODULE 2 — CRUD (Supabase + RLS). Mêmes règles que le fournisseur démo.
  // Les montants NUMERIC reviennent parfois en chaîne : on les convertit.
  // ==========================================================================

  private async requireSession(): Promise<SessionUser> {
    const session = await this.getSession();
    if (!session) throw err("ERR_NOT_FOUND");
    return session;
  }

  private async verifierLimiteBlocs(): Promise<void> {
    const session = await this.requireSession();
    const abo = await this.getAbonnement();
    if (!abo) return;
    const { data, error } = await this.client()
      .from("immeubles")
      .select("id")
      .eq("owner_id", session.id)
      .eq("statut", "actif");
    if (error) throw new Error(error.message);
    if ((data?.length ?? 0) >= limiteBlocs(abo.plan, abo.statut)) {
      throw err("ERR_LIMITE_BLOCS");
    }
  }

  /**
   * v1.7 : résout les URLs d'affichage des photos des immeubles —
   * liens signés (1 h) du bucket privé, un seul appel pour tous les
   * chemins. Les tableaux photos / photos_urls restent alignés par
   * index (chaîne vide si une signature échoue).
   */
  private async enrichirPhotosImmeubles<T extends Immeuble>(liste: T[]): Promise<T[]> {
    const chemins = Array.from(
      new Set(liste.flatMap((i) => (Array.isArray(i.photos) ? i.photos : [])))
    );
    if (chemins.length === 0) return liste;
    const { data } = await this.client()
      .storage.from("documents-prives")
      .createSignedUrls(chemins, 3600);
    const parChemin = new Map<string, string>();
    (data ?? []).forEach((s, idx) => {
      if (s?.signedUrl) parChemin.set(chemins[idx], s.signedUrl);
    });
    for (const im of liste) {
      im.photos_urls = (im.photos ?? []).map((p) => parChemin.get(p) ?? "");
    }
    return liste;
  }

  /**
   * v1.7 — contrôle allégé : le propriétaire déclaré correspond-il à
   * un propriétaire DÉJÀ rattaché à ce gestionnaire (rattachement
   * « proprietaire » actif, validé par l'Admin) ? La concordance se
   * juge sur l'e-mail (identifiant du compte propriétaire).
   */
  private async calculerConcordanceProprietaire(
    gestionnaireId: string,
    emailDeclare: string
  ): Promise<boolean> {
    const { data: rattachements } = await this.client()
      .from("rattachements_gestionnaires")
      .select("proprietaire_id")
      .eq("gestionnaire_id", gestionnaireId)
      .eq("contexte", "proprietaire")
      .eq("statut", "actif");
    const ids = ((rattachements as { proprietaire_id: string | null }[] | null) ?? [])
      .map((r) => r.proprietaire_id)
      .filter((x): x is string => Boolean(x));
    if (ids.length === 0) return false;
    const { data: profils } = await this.client()
      .from("profils")
      .select("email")
      .in("id", ids);
    return ((profils as { email: string }[] | null) ?? []).some(
      (p) => p.email.toLowerCase() === emailDeclare
    );
  }

  async listerImmeubles(inclureArchives = false): Promise<Immeuble[]> {
    const session = await this.requireSession();
    const role = await this.roleSession();
    // Module 6 : un co-propriétaire ne filtre PAS par owner_id — la RLS
    // (immeuble_visible) ne lui retourne que ses biens partagés.
    let q = this.client().from("immeubles").select("*").order("nom", { ascending: true });
    if (role !== "coproprietaire") q = q.eq("owner_id", session.id);
    if (!inclureArchives) q = q.eq("statut", "actif");
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return this.enrichirPhotosImmeubles((data as Immeuble[]).map(mapImmeuble));
  }

  async getImmeuble(id: string): Promise<Immeuble | null> {
    const { data, error } = await this.client()
      .from("immeubles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const [enrichi] = await this.enrichirPhotosImmeubles([
      mapImmeuble(data as Immeuble),
    ]);
    return enrichi;
  }

  async creerImmeuble(input: ImmeubleInput): Promise<Immeuble> {
    await this.verifierEcritureAutorisee();
    const session = await this.requireSession();
    if (input.valeur_bien !== null && input.valeur_bien <= 0) throw err("ERR_VALEUR_NON_POSITIVE");
    const { data: doublon } = await this.client()
      .from("immeubles")
      .select("id")
      .eq("owner_id", session.id)
      .ilike("nom", input.nom.trim())
      .limit(1);
    if (doublon && doublon.length > 0) throw err("ERR_IMMEUBLE_NOM_UNIQUE");
    await this.verifierLimiteBlocs();
    // v1.7 : un créateur GESTIONNAIRE déclare le propriétaire du bien
    // (nom + e-mail obligatoires) et l'immeuble part en revue
    // plateforme ; un créateur propriétaire reste « valide » d'office.
    const role = await this.roleSession();
    let declareNom: string | null = null;
    let declareEmail: string | null = null;
    let concordance = false;
    let origine: Immeuble["origine_creation"] = "proprietaire";
    let validation: Immeuble["validation_statut"] = "valide";
    if (role === "gestionnaire") {
      declareNom = input.proprietaire_declare_nom?.trim() || null;
      declareEmail = input.proprietaire_declare_email?.trim().toLowerCase() || null;
      if (!declareNom || !declareEmail) {
        throw err("ERR_PROPRIETAIRE_DECLARE_REQUIS");
      }
      origine = "gestionnaire";
      validation = "en_attente";
      concordance = await this.calculerConcordanceProprietaire(
        session.id,
        declareEmail
      );
    }
    const { data, error } = await this.client()
      .from("immeubles")
      .insert({
        ...input,
        proprietaire_declare_nom: declareNom,
        proprietaire_declare_email: declareEmail,
        origine_creation: origine,
        validation_statut: validation,
        proprietaire_concordance: concordance,
        photos: [],
        owner_id: session.id,
        nom: input.nom.trim(),
        statut: "actif",
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") throw err("ERR_IMMEUBLE_NOM_UNIQUE");
      throw new Error(error.message);
    }
    const [cree] = await this.enrichirPhotosImmeubles([
      mapImmeuble(data as Immeuble),
    ]);
    return cree;
  }

  async modifierImmeuble(id: string, patch: ImmeublePatch): Promise<Immeuble> {
    await this.verifierEcritureAutorisee();
    const session = await this.requireSession();
    if (patch.valeur_bien !== undefined && patch.valeur_bien !== null && patch.valeur_bien <= 0) {
      throw err("ERR_VALEUR_NON_POSITIVE");
    }
    if (patch.nom) {
      const { data: doublon } = await this.client()
        .from("immeubles")
        .select("id")
        .eq("owner_id", session.id)
        .ilike("nom", patch.nom.trim())
        .neq("id", id)
        .limit(1);
      if (doublon && doublon.length > 0) throw err("ERR_IMMEUBLE_NOM_UNIQUE");
    }
    // v1.7 : immeuble de gestionnaire — le propriétaire déclaré reste
    // obligatoire ; le modifier recalcule la concordance et, si la
    // plateforme avait refusé la validation, resoumet le bien en revue.
    const maj: Record<string, unknown> = {
      ...patch,
      nom: patch.nom ? patch.nom.trim() : undefined,
    };
    if (
      patch.proprietaire_declare_nom !== undefined ||
      patch.proprietaire_declare_email !== undefined
    ) {
      const { data: actuel } = await this.client()
        .from("immeubles")
        .select(
          "owner_id, origine_creation, validation_statut, proprietaire_declare_nom, proprietaire_declare_email"
        )
        .eq("id", id)
        .maybeSingle();
      if (actuel && actuel.origine_creation === "gestionnaire") {
        const nomDeclare =
          patch.proprietaire_declare_nom !== undefined
            ? patch.proprietaire_declare_nom?.trim() || null
            : (actuel.proprietaire_declare_nom as string | null);
        const emailDeclare =
          patch.proprietaire_declare_email !== undefined
            ? patch.proprietaire_declare_email?.trim().toLowerCase() || null
            : (actuel.proprietaire_declare_email as string | null);
        if (!nomDeclare || !emailDeclare) {
          throw err("ERR_PROPRIETAIRE_DECLARE_REQUIS");
        }
        maj.proprietaire_declare_nom = nomDeclare;
        maj.proprietaire_declare_email = emailDeclare;
        maj.proprietaire_concordance =
          await this.calculerConcordanceProprietaire(
            actuel.owner_id as string,
            emailDeclare
          );
        if (actuel.validation_statut === "refuse") {
          maj.validation_statut = "en_attente";
          maj.validation_motif = null;
        }
      }
    }
    const { data, error } = await this.client()
      .from("immeubles")
      .update(maj)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") throw err("ERR_IMMEUBLE_NOM_UNIQUE");
      throw new Error(error.message);
    }
    const [modifie] = await this.enrichirPhotosImmeubles([
      mapImmeuble(data as Immeuble),
    ]);
    return modifie;
  }

  async archiverImmeuble(id: string): Promise<Immeuble> {
    await this.verifierEcritureAutorisee();
    return this.modifierImmeuble(id, { statut: "archive" });
  }

  async desarchiverImmeuble(id: string): Promise<Immeuble> {
    await this.verifierEcritureAutorisee();
    await this.verifierLimiteBlocs();
    return this.modifierImmeuble(id, { statut: "actif" });
  }

  // --- v1.7 : photos du bien (bucket privé, liens signés) -------------------
  async ajouterPhotoImmeuble(
    immeubleId: string,
    photo: PhotoImmeubleInput
  ): Promise<Immeuble> {
    await this.verifierEcritureAutorisee();
    const session = await this.requireSession();
    const nom = photo.nom_fichier.trim();
    const extension = nom.split(".").pop()?.toLowerCase() ?? "";
    const mimeOk =
      !photo.mime_type || ["image/jpeg", "image/png"].includes(photo.mime_type);
    if (!["jpg", "jpeg", "png"].includes(extension) || !mimeOk || !photo.contenu) {
      throw err("ERR_DOCUMENT_FORMAT");
    }
    if (
      photo.taille_octets !== undefined &&
      photo.taille_octets !== null &&
      photo.taille_octets > TAILLE_MAX_DOCUMENT_OCTETS
    ) {
      throw err("ERR_DOCUMENT_TROP_GROS");
    }
    const { data: actuel, error: errLecture } = await this.client()
      .from("immeubles")
      .select("photos")
      .eq("id", immeubleId)
      .maybeSingle();
    if (errLecture) throw new Error(errLecture.message);
    if (!actuel) throw err("ERR_NOT_FOUND");
    const photosActuelles: string[] = Array.isArray(actuel.photos)
      ? (actuel.photos as string[])
      : [];
    // Même patron que les documents : bucket PRIVÉ « documents-prives »,
    // chemin préfixé par l'id de l'uploader (politiques Storage).
    const storagePath = `${session.id}/immeuble/${immeubleId}/photo-${Date.now()}-${nom}`;
    const blob = await (await fetch(photo.contenu)).blob();
    const { error: uploadError } = await this.client()
      .storage.from("documents-prives")
      .upload(storagePath, blob, {
        contentType: photo.mime_type ?? blob.type,
        upsert: false,
      });
    if (uploadError) {
      if (/bucket not found/i.test(uploadError.message)) {
        throw err("ERR_BUCKET_MANQUANT");
      }
      throw new Error(uploadError.message);
    }
    const { data, error } = await this.client()
      .from("immeubles")
      .update({ photos: [...photosActuelles, storagePath] })
      .eq("id", immeubleId)
      .select()
      .single();
    if (error) {
      await this.client().storage.from("documents-prives").remove([storagePath]);
      throw new Error(error.message);
    }
    const [maj] = await this.enrichirPhotosImmeubles([
      mapImmeuble(data as Immeuble),
    ]);
    return maj;
  }

  async retirerPhotoImmeuble(
    immeubleId: string,
    index: number
  ): Promise<Immeuble> {
    await this.verifierEcritureAutorisee();
    await this.requireSession();
    const { data: actuel, error: errLecture } = await this.client()
      .from("immeubles")
      .select("photos")
      .eq("id", immeubleId)
      .maybeSingle();
    if (errLecture) throw new Error(errLecture.message);
    if (!actuel) throw err("ERR_NOT_FOUND");
    const photosActuelles: string[] = Array.isArray(actuel.photos)
      ? [...(actuel.photos as string[])]
      : [];
    if (index < 0 || index >= photosActuelles.length) {
      throw err("ERR_NOT_FOUND");
    }
    const [retiree] = photosActuelles.splice(index, 1);
    const { data, error } = await this.client()
      .from("immeubles")
      .update({ photos: photosActuelles })
      .eq("id", immeubleId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    if (retiree) {
      await this.client().storage.from("documents-prives").remove([retiree]);
    }
    const [maj] = await this.enrichirPhotosImmeubles([
      mapImmeuble(data as Immeuble),
    ]);
    return maj;
  }

  // --- v1.7 : décision plateforme (RPC — la base décide) --------------------
  async deciderValidationImmeuble(
    immeubleId: string,
    accepter: boolean,
    motif?: string | null
  ): Promise<void> {
    await this.acteurPlateforme();
    const { error } = await this.client().rpc("decider_validation_immeuble", {
      p_immeuble: immeubleId,
      p_accepter: accepter,
      p_motif: motif ?? null,
    });
    if (error) {
      if (error.message.includes("ERR_VALIDATION_PAS_EN_ATTENTE")) {
        throw err("ERR_VALIDATION_PAS_EN_ATTENTE");
      }
      if (error.message.includes("ERR_VALIDATION_MOTIF_REQUIS")) {
        throw err("ERR_VALIDATION_MOTIF_REQUIS");
      }
      if (error.message.includes("ERR_ACCES_PLATEFORME")) {
        throw err("ERR_ACCES_PLATEFORME");
      }
      if (error.message.includes("ERR_NOT_FOUND")) throw err("ERR_NOT_FOUND");
      throw new Error(error.message);
    }
  }

  async listerAppartements(
    filtre?: FiltreAppartements & { inclureArchives?: boolean }
  ): Promise<Appartement[]> {
    let q = this.client().from("appartements").select("*").order("numero", { ascending: true });
    if (filtre?.immeubleId) q = q.eq("immeuble_id", filtre.immeubleId);
    if (filtre?.statut) q = q.eq("statut", filtre.statut);
    if (!filtre?.inclureArchives) q = q.eq("archive", false);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data as Appartement[]).map(mapAppartement);
  }

  async getAppartement(id: string): Promise<Appartement | null> {
    const { data, error } = await this.client()
      .from("appartements")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapAppartement(data as Appartement) : null;
  }

  private async verifierNumeroUnique(
    immeubleId: string,
    numero: string,
    exclureId?: string
  ): Promise<void> {
    let q = this.client()
      .from("appartements")
      .select("id")
      .eq("immeuble_id", immeubleId)
      .ilike("numero", numero.trim())
      .limit(1);
    if (exclureId) q = q.neq("id", exclureId);
    const { data } = await q;
    if (data && data.length > 0) throw err("ERR_APPARTEMENT_NUMERO_UNIQUE");
  }

  async creerAppartement(input: AppartementInput): Promise<Appartement> {
    await this.verifierEcritureAutorisee();
    if (input.loyer_defaut <= 0) throw err("ERR_LOYER_NON_POSITIF");
    if (input.valeur_bien !== null && input.valeur_bien <= 0) throw err("ERR_VALEUR_NON_POSITIVE");
    if (input.statut === "occupe") throw err("ERR_SANS_BAIL");
    await this.verifierNumeroUnique(input.immeuble_id, input.numero);
    const { data, error } = await this.client()
      .from("appartements")
      .insert({ ...input, numero: input.numero.trim(), archive: false })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") throw err("ERR_APPARTEMENT_NUMERO_UNIQUE");
      throw new Error(error.message);
    }
    return mapAppartement(data as Appartement);
  }

  async creerAppartementsEnLot(
    immeubleId: string,
    items: Omit<AppartementInput, "immeuble_id">[]
  ): Promise<Appartement[]> {
    await this.verifierEcritureAutorisee();
    // Validation complète du lot avant toute insertion (tout ou rien).
    const numeros = new Set<string>();
    for (const item of items) {
      const cle = item.numero.trim().toLowerCase();
      if (numeros.has(cle)) throw err("ERR_APPARTEMENT_NUMERO_UNIQUE");
      numeros.add(cle);
      if (item.loyer_defaut <= 0) throw err("ERR_LOYER_NON_POSITIF");
      if (item.valeur_bien !== null && item.valeur_bien !== undefined && item.valeur_bien <= 0) {
        throw err("ERR_VALEUR_NON_POSITIVE");
      }
      await this.verifierNumeroUnique(immeubleId, item.numero);
    }
    const lignes = items.map((item) => ({
      ...item,
      immeuble_id: immeubleId,
      numero: item.numero.trim(),
      archive: false,
    }));
    const { data, error } = await this.client()
      .from("appartements")
      .insert(lignes)
      .select();
    if (error) {
      if (error.code === "23505") throw err("ERR_APPARTEMENT_NUMERO_UNIQUE");
      throw new Error(error.message);
    }
    return (data as Appartement[]).map(mapAppartement);
  }

  async modifierAppartement(id: string, patch: AppartementPatch): Promise<Appartement> {
    await this.verifierEcritureAutorisee();
    if (patch.loyer_defaut !== undefined && patch.loyer_defaut <= 0) {
      throw err("ERR_LOYER_NON_POSITIF");
    }
    if (patch.valeur_bien !== undefined && patch.valeur_bien !== null && patch.valeur_bien <= 0) {
      throw err("ERR_VALEUR_NON_POSITIVE");
    }
    if (patch.statut) {
      const bailActif = await this.bailActifDe(id);
      const courant = await this.getAppartement(id);
      if (!courant) throw err("ERR_NOT_FOUND");
      if (patch.statut === "occupe" && !bailActif) throw err("ERR_SANS_BAIL");
      if (patch.statut !== "occupe" && bailActif && courant.statut === "occupe") {
        throw err("ERR_APPARTEMENT_OCCUPE");
      }
    }
    if (patch.numero) {
      const courant = await this.getAppartement(id);
      if (!courant) throw err("ERR_NOT_FOUND");
      await this.verifierNumeroUnique(courant.immeuble_id, patch.numero, id);
    }
    const { data, error } = await this.client()
      .from("appartements")
      .update({ ...patch, numero: patch.numero ? patch.numero.trim() : undefined })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") throw err("ERR_APPARTEMENT_NUMERO_UNIQUE");
      throw new Error(error.message);
    }
    return mapAppartement(data as Appartement);
  }

  private async bailActifDe(appartementId: string): Promise<Bail | null> {
    const { data, error } = await this.client()
      .from("baux")
      .select("*")
      .eq("appartement_id", appartementId)
      .eq("statut", "actif")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapBail(data as Bail) : null;
  }

  async changerStatutAppartement(
    id: string,
    statut: StatutAppartement
  ): Promise<Appartement> {
    await this.verifierEcritureAutorisee();
    const bailActif = await this.bailActifDe(id);
    if (statut === "occupe" && !bailActif) throw err("ERR_SANS_BAIL");
    if (statut !== "occupe" && bailActif) throw err("ERR_APPARTEMENT_OCCUPE");
    return this.modifierAppartement(id, { statut });
  }

  async basculerVitrine(id: string, vitrine: boolean): Promise<Appartement> {
    await this.verifierEcritureAutorisee();
    const apt = await this.getAppartement(id);
    if (!apt) throw err("ERR_NOT_FOUND");
    if (vitrine && apt.statut !== "vacant" && apt.statut !== "reserve") {
      throw err("ERR_VITRINE_STATUT");
    }
    return this.modifierAppartement(id, { vitrine });
  }

  async archiverAppartement(id: string): Promise<Appartement> {
    await this.verifierEcritureAutorisee();
    if (await this.bailActifDe(id)) throw err("ERR_APPARTEMENT_OCCUPE");
    return this.modifierAppartement(id, { archive: true } as AppartementPatch);
  }

  async desarchiverAppartement(id: string): Promise<Appartement> {
    await this.verifierEcritureAutorisee();
    return this.modifierAppartement(id, { archive: false } as AppartementPatch);
  }

  async supprimerAppartement(id: string): Promise<void> {
    await this.verifierEcritureAutorisee();
    if (await this.bailActifDe(id)) throw err("ERR_APPARTEMENT_OCCUPE");
    const { data: baux } = await this.client()
      .from("baux")
      .select("id")
      .eq("appartement_id", id)
      .limit(1);
    if (baux && baux.length > 0) throw err("ERR_BAIL_EXISTANT");
    const { error } = await this.client().from("appartements").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async listerLocataires(): Promise<Locataire[]> {
    const session = await this.requireSession();
    const role = await this.roleSession();
    // Module 6 : un co-propriétaire ne filtre pas par owner_id (la RLS
    // ne lui retourne que les locataires de ses biens partagés) et ne
    // voit jamais leurs coordonnées complètes (noms seulement).
    let q = this.client().from("locataires").select("*").order("nom", { ascending: true });
    if (role !== "coproprietaire") q = q.eq("owner_id", session.id);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const estCoproprietaire = role === "coproprietaire";
    return (data as Locataire[]).map((l) =>
      this.masquerCoordonneesLocataire(l, estCoproprietaire)
    );
  }

  async getLocataire(id: string): Promise<Locataire | null> {
    const { data, error } = await this.client()
      .from("locataires")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const role = await this.roleSession();
    return this.masquerCoordonneesLocataire(data as Locataire, role === "coproprietaire");
  }

  async creerLocataire(input: LocataireInput): Promise<Locataire> {
    await this.verifierEcritureAutorisee();
    const session = await this.requireSession();
    const { data, error } = await this.client()
      .from("locataires")
      .insert({ ...input, owner_id: session.id, nom: input.nom.trim() })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Locataire;
  }

  async modifierLocataire(id: string, patch: LocatairePatch): Promise<Locataire> {
    await this.verifierEcritureAutorisee();
    const { data, error } = await this.client()
      .from("locataires")
      .update({ ...patch, nom: patch.nom ? patch.nom.trim() : undefined })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Locataire;
  }

  async supprimerLocataire(id: string): Promise<void> {
    await this.verifierEcritureAutorisee();
    const { data: baux } = await this.client()
      .from("baux")
      .select("id")
      .eq("locataire_id", id)
      .eq("statut", "actif")
      .limit(1);
    if (baux && baux.length > 0) throw err("ERR_LOCATAIRE_BAIL_ACTIF");
    const { error } = await this.client().from("locataires").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async genererLienLocataire(id: string): Promise<LienLocataire> {
    await this.verifierEcritureAutorisee();
    const token = genererToken();
    const expireLe = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await this.client()
      .from("locataires")
      .update({ lien_token: token, lien_expire_le: expireLe })
      .eq("id", id);
    if (error) throw new Error(error.message);
    const origine =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "";
    return { token, expireLe, url: `${origine}/locataire/${token}` };
  }

  async revoquerLienLocataire(id: string): Promise<Locataire> {
    await this.verifierEcritureAutorisee();
    const { data, error } = await this.client()
      .from("locataires")
      .update({ lien_token: null, lien_expire_le: null })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Locataire;
  }

  /**
   * Accès lecture seule par lien sécurisé (Correctif 1, spec §2, §14).
   * Sans connexion : la fonction SQL SECURITY DEFINER
   * `acces_locataire_par_token` (supabase/schema.sql) retrouve le
   * locataire par son jeton, vérifie l'expiration, et retourne
   * UNIQUEMENT ses données (bail en cours, échéances, paiements,
   * reçus). Jeton expiré, révoqué ou inconnu -> null, sans aucune
   * donnée. Aucune table n'est exposée en lecture anonyme : seul
   * l'appel RPC est autorisé (grant execute to anon).
   * Les statuts d'échéances sont recalculés ici, avec la même règle
   * que listerEcheances (vérité = paiements valides).
   */
  async getLocataireParToken(token: string): Promise<AccesLocataire | null> {
    if (!token) return null;
    const { data, error } = await this.client().rpc(
      "acces_locataire_par_token",
      { p_token: token }
    );
    if (error) throw new Error(error.message);
    const brut = data as {
      locataire: Locataire;
      bail: Bail | null;
      appartement_numero: string | null;
      immeuble_nom: string | null;
      emetteur_nom: string | null;
      echeances: EcheanceLoyer[];
      paiements: Paiement[];
      recus: Recu[];
    } | null;
    if (!brut || !brut.locataire) return null;
    const bail = brut.bail ? mapBail(brut.bail) : null;
    const paiements = (brut.paiements ?? []).map(mapPaiement);
    const echeances = (brut.echeances ?? [])
      .map((e) => {
        const montantDu = Number(e.montant_du);
        const paye = totalPayeValide(
          paiements.filter((p) => p.echeance_id === e.id),
          e.devise
        );
        return {
          ...e,
          montant_du: montantDu,
          statut: calculerStatutEcheance({
            montantDu,
            paye,
            jourExigibilite: bail?.jour_exigibilite ?? 1,
            moisIso: e.mois,
          }),
        };
      })
      .sort((a, b) => b.mois.localeCompare(a.mois));
    const recus = (brut.recus ?? []).map((r) => ({
      ...r,
      montant: Number(r.montant),
    }));
    return {
      locataire: brut.locataire,
      bail,
      appartementNumero: brut.appartement_numero,
      immeubleNom: brut.immeuble_nom,
      emetteurNom: brut.emetteur_nom ?? "CizaImmo",
      echeances,
      paiements,
      recus,
    };
  }

  async listerBaux(filtre?: FiltreBaux): Promise<Bail[]> {
    let q = this.client().from("baux").select("*").order("debut", { ascending: false });
    if (filtre?.appartementId) q = q.eq("appartement_id", filtre.appartementId);
    if (filtre?.locataireId) q = q.eq("locataire_id", filtre.locataireId);
    if (filtre?.statut) q = q.eq("statut", filtre.statut);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data as Bail[]).map(mapBail);
  }

  async getBail(id: string): Promise<Bail | null> {
    const { data, error } = await this.client()
      .from("baux")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapBail(data as Bail) : null;
  }

  async creerBail(input: BailInput): Promise<Bail> {
    await this.verifierEcritureAutorisee();
    if (input.loyer_mensuel <= 0) throw err("ERR_LOYER_NON_POSITIF");
    if (input.jour_exigibilite < 1 || input.jour_exigibilite > 28) throw err("ERR_JOUR_EXIGIBILITE");
    if (input.fin && input.fin <= input.debut) throw err("ERR_BAIL_FIN_AVANT_DEBUT");
    if (input.caution !== null && input.caution < 0) throw err("ERR_VALEUR_NON_POSITIVE");
    const actifs = await this.listerBaux({ appartementId: input.appartement_id, statut: "actif" });
    if (
      actifs.some((b) => bauxSeChevauchent(b.debut, b.fin, input.debut, input.fin))
    ) {
      throw err("ERR_BAIL_CHEVAUCHEMENT");
    }
    const { data, error } = await this.client()
      .from("baux")
      .insert({ ...input, statut: "actif" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await this.client()
      .from("appartements")
      .update({ statut: "occupe", archive: false })
      .eq("id", input.appartement_id);
    await this.journaliser("bail", "bail", (data as Bail).id, `Bail créé — appartement ${input.appartement_id} (dès le ${input.debut})`);
    return mapBail(data as Bail);
  }

  async cloturerBail(id: string, cautionStatut?: CautionStatut): Promise<Bail> {
    await this.verifierEcritureAutorisee();
    const bail = await this.getBail(id);
    if (!bail) throw err("ERR_NOT_FOUND");
    const { data, error } = await this.client()
      .from("baux")
      .update({ statut: "termine", caution_statut: cautionStatut ?? bail.caution_statut })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const autresActifs = await this.listerBaux({
      appartementId: bail.appartement_id,
      statut: "actif",
    });
    if (autresActifs.length === 0) {
      await this.client()
        .from("appartements")
        .update({ statut: "vacant" })
        .eq("id", bail.appartement_id);
    }
    await this.journaliser("bail", "bail", id, "Bail clôturé");
    return mapBail(data as Bail);
  }

  async listerDepenses(filtre?: FiltreDepenses): Promise<Depense[]> {
    let q = this.client().from("depenses").select("*").order("date", { ascending: false });
    if (filtre?.immeubleId) q = q.eq("immeuble_id", filtre.immeubleId);
    if (filtre?.appartementId) q = q.eq("appartement_id", filtre.appartementId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data as Depense[]).map((d) => ({ ...d, montant: Number(d.montant) }));
  }

  async listerEcheances(
    bailIdOuFiltre?: string | FiltreEcheances
  ): Promise<EcheanceLoyer[]> {
    const filtre: FiltreEcheances =
      typeof bailIdOuFiltre === "string"
        ? { bailId: bailIdOuFiltre }
        : bailIdOuFiltre ?? {};
    let q = this.client().from("loyers").select("*").order("mois", { ascending: false });
    if (filtre.bailId) q = q.eq("bail_id", filtre.bailId);
    if (filtre.mois) q = q.eq("mois", moisVersIso(filtre.mois));
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    let echeances = (data as EcheanceLoyer[]).map((e) => ({
      ...e,
      montant_du: Number(e.montant_du),
    }));
    if (filtre.immeubleId) {
      const baux = await this.listerBaux();
      const appartements = await this.listerAppartements({ inclureArchives: true });
      const bauxImmeuble = new Set(
        baux
          .filter((b) =>
            appartements.some(
              (a) => a.id === b.appartement_id && a.immeuble_id === filtre.immeubleId
            )
          )
          .map((b) => b.id)
      );
      echeances = echeances.filter((e) => bauxImmeuble.has(e.bail_id));
    }
    // Statut RECALCULÉ (spec §9) : la vérité vient des paiements valides.
    const recalculees = await Promise.all(
      echeances.map((e) => this.avecStatutCalcule(e))
    );
    return filtre.statut
      ? recalculees.filter((e) => e.statut === filtre.statut)
      : recalculees;
  }

  async listerPaiements(echeanceId?: string): Promise<Paiement[]> {
    let q = this.client().from("paiements").select("*").order("date_paiement", { ascending: false });
    if (echeanceId) q = q.eq("echeance_id", echeanceId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data as Paiement[]).map(mapPaiement);
  }

  // ==========================================================================
  // MODULE 3 — Loyers & paiements + reçus (Supabase + RLS).
  // ==========================================================================

  /** Recalcule le statut d'une échéance depuis ses paiements valides. */
  private async avecStatutCalcule(echeance: EcheanceLoyer): Promise<EcheanceLoyer> {
    const bail = await this.getBail(echeance.bail_id);
    const paiements = await this.listerPaiements(echeance.id);
    const statut = calculerStatutEcheance({
      montantDu: echeance.montant_du,
      paye: totalPayeValide(paiements, echeance.devise),
      jourExigibilite: bail?.jour_exigibilite ?? 1,
      moisIso: echeance.mois,
    });
    return { ...echeance, statut };
  }

  /** Après écriture, on resynchronise le statut stocké (cache) en base. */
  private async resynchroniserStatut(echeanceId: string): Promise<void> {
    const { data } = await this.client()
      .from("loyers")
      .select("*")
      .eq("id", echeanceId)
      .maybeSingle();
    if (!data) return;
    const echeance = { ...(data as EcheanceLoyer), montant_du: Number((data as EcheanceLoyer).montant_du) };
    const recalculee = await this.avecStatutCalcule(echeance);
    await this.client()
      .from("loyers")
      .update({ statut: recalculee.statut })
      .eq("id", echeanceId);
  }

  async genererEcheances(mois: string): Promise<EcheanceLoyer[]> {
    await this.verifierEcritureAutorisee();
    const moisIso = moisVersIso(mois);
    const bauxActifs = (await this.listerBaux({ statut: "actif" })).filter((b) =>
      bailCouvreMois(b, moisIso)
    );
    const existantes = await this.listerEcheances({ mois: moisIso });
    const dejaLa = new Set(existantes.map((e) => e.bail_id));
    for (const bail of bauxActifs) {
      if (dejaLa.has(bail.id)) continue; // idempotence : une par bail et par mois.
      const prorata = calculerProrata(bail, moisIso);
      const { error } = await this.client().from("loyers").insert({
        bail_id: bail.id,
        mois: moisIso,
        montant_du: prorata.montantDu,
        devise: bail.devise,
        statut: "a_venir",
        prorata: prorata.prorata,
        prorata_detail: prorata.detail,
      });
      // 23505 = un autre appel vient de créer la même échéance : on ignore.
      if (error && error.code !== "23505") throw new Error(error.message);
    }
    return this.listerEcheances({ mois: moisIso });
  }

  async prochainNumeroRecu(): Promise<string> {
    const annee = new Date().getFullYear();
    const { data, error } = await this.client()
      .from("paiements")
      .select("recu_numero")
      .like("recu_numero", `CIM-${annee}-%`);
    if (error) throw new Error(error.message);
    return calculerProchainNumero(
      (data ?? []).map((r) => r.recu_numero as string | null),
      annee
    );
  }

  private async prochainNumeroPourAnnee(annee: number): Promise<string> {
    const { data, error } = await this.client()
      .from("paiements")
      .select("recu_numero")
      .like("recu_numero", `CIM-${annee}-%`);
    if (error) throw new Error(error.message);
    return calculerProchainNumero(
      (data ?? []).map((r) => r.recu_numero as string | null),
      annee
    );
  }

  async declarerPaiement(
    input: DeclarerPaiementInput
  ): Promise<{ paiement: Paiement; recuNumero: string }> {
    await this.verifierEcritureAutorisee();
    if (!input.montant || input.montant <= 0) throw err("ERR_MONTANT_NON_POSITIF");
    const session = await this.requireSession();
    const { data: echeance, error: echeanceError } = await this.client()
      .from("loyers")
      .select("id")
      .eq("id", input.echeance_id)
      .maybeSingle();
    if (echeanceError) throw new Error(echeanceError.message);
    if (!echeance) throw err("ERR_ECHEANCE_INTROUVABLE");
    const annee = new Date(input.date_paiement).getFullYear();
    const anneeRecu = Number.isFinite(annee) ? annee : new Date().getFullYear();
    let recuNumero = await this.prochainNumeroPourAnnee(anneeRecu);
    const ligne = {
      echeance_id: input.echeance_id,
      montant: input.montant,
      devise: input.devise,
      date_paiement: input.date_paiement,
      moyen: input.moyen,
      reference: input.reference?.trim() ? input.reference.trim() : null,
      declare_par: session.id,
      recu_numero: recuNumero,
      statut: "valide",
      taux_conversion: input.taux_conversion ?? null,
      date_taux: input.date_taux ?? null,
      montant_converti: input.montant_converti ?? null,
    };
    let { data, error } = await this.client()
      .from("paiements")
      .insert(ligne)
      .select()
      .single();
    if (error && error.code === "23505") {
      // Numéro déjà pris entre-temps : on recalcule et on réessaie une fois.
      recuNumero = await this.prochainNumeroPourAnnee(anneeRecu);
      ({ data, error } = await this.client()
        .from("paiements")
        .insert({ ...ligne, recu_numero: recuNumero })
        .select()
        .single());
    }
    if (error) throw new Error(error.message);
    await this.resynchroniserStatut(input.echeance_id);
    await this.journaliser("paiement", "loyer", input.echeance_id, `Paiement déclaré : ${input.montant} ${input.devise}`);
    return { paiement: mapPaiement(data as Paiement), recuNumero };
  }

  async annulerPaiement(id: string, motif?: string): Promise<Paiement> {
    await this.verifierEcritureAutorisee();
    const session = await this.requireSession();
    const { data: courant, error: lectureError } = await this.client()
      .from("paiements")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (lectureError) throw new Error(lectureError.message);
    if (!courant) throw err("ERR_PAIEMENT_INTROUVABLE");
    if ((courant as Paiement).statut === "annule") throw err("ERR_PAIEMENT_DEJA_ANNULE");
    const { data, error } = await this.client()
      .from("paiements")
      .update({
        statut: "annule",
        annule_par: session.id,
        annule_le: new Date().toISOString(),
        motif_annulation: motif?.trim() ? motif.trim() : null,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await this.resynchroniserStatut((courant as Paiement).echeance_id);
    return mapPaiement(data as Paiement);
  }

  async corrigerPaiement(
    id: string,
    input: Omit<DeclarerPaiementInput, "echeance_id">
  ): Promise<{ paiement: Paiement; recuNumero: string }> {
    await this.verifierEcritureAutorisee();
    const { data: ancien, error: lectureError } = await this.client()
      .from("paiements")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (lectureError) throw new Error(lectureError.message);
    if (!ancien) throw err("ERR_PAIEMENT_INTROUVABLE");
    if ((ancien as Paiement).statut === "annule") throw err("ERR_PAIEMENT_DEJA_ANNULE");
    // Un reçu émis ne se modifie pas : annulation + nouvelle déclaration.
    await this.annulerPaiement(id, "correction");
    const { paiement, recuNumero } = await this.declarerPaiement({
      ...input,
      echeance_id: (ancien as Paiement).echeance_id,
    });
    await this.client()
      .from("paiements")
      .update({ remplace_paiement_id: id })
      .eq("id", paiement.id);
    return { paiement: { ...paiement, remplace_paiement_id: id }, recuNumero };
  }

  async listerRecus(filtre?: FiltreRecus): Promise<Recu[]> {
    const [paiements, echeances, baux, locataires, appartements, immeubles] =
      await Promise.all([
        this.listerPaiements(),
        this.listerEcheances(),
        this.listerBaux(),
        this.listerLocataires(),
        this.listerAppartements({ inclureArchives: true }),
        this.listerImmeubles(true),
      ]);
    let recus: Recu[] = [];
    for (const p of paiements) {
      if (!p.recu_numero) continue;
      const echeance = echeances.find((e) => e.id === p.echeance_id);
      if (!echeance) continue;
      const bail = baux.find((b) => b.id === echeance.bail_id);
      const locataire = bail ? locataires.find((l) => l.id === bail.locataire_id) : undefined;
      const appartement = bail ? appartements.find((a) => a.id === bail.appartement_id) : undefined;
      const immeuble = appartement ? immeubles.find((i) => i.id === appartement.immeuble_id) : undefined;
      recus.push({
        numero: p.recu_numero,
        paiement_id: p.id,
        echeance_id: p.echeance_id,
        bail_id: echeance.bail_id,
        locataire_id: locataire?.id ?? null,
        locataire_nom: locataire?.nom ?? "—",
        locataire_telephone: locataire?.telephone ?? null,
        locataire_email: locataire?.email ?? null,
        immeuble_nom: immeuble?.nom ?? "—",
        appartement_numero: appartement?.numero ?? "—",
        mois: echeance.mois,
        montant: p.montant,
        devise: p.devise,
        moyen: p.moyen,
        date_paiement: p.date_paiement,
        date_emission: p.created_at,
        reference: p.reference,
        statut: p.statut,
      });
    }
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
        b.date_paiement.localeCompare(a.date_paiement) || b.numero.localeCompare(a.numero)
      );
  }

  // ==========================================================================
  // MODULE 4 — Dépenses, documents (Storage privé), fil, taux, alertes,
  // paramètres (Supabase + RLS).
  // ==========================================================================

  /** Journalise un événement (fil d'actualité). Un échec ne bloque jamais l'opération principale. */
  private async journaliser(type: TypeActivite, entiteType: string | null, entiteId: string | null, description: string, ownerId?: string): Promise<void> {
    try {
      const session = await this.getSession();
      if (!session) return;
      await this.client().from("activites").insert({
        owner_id: ownerId ?? session.id,
        type,
        entite_type: entiteType,
        entite_id: entiteId,
        auteur: session.id,
        description,
      });
    } catch {
      // Le fil est informatif : on ne fait jamais échouer une mutation pour lui.
    }
  }

  async creerDepense(input: DepenseInput): Promise<Depense> {
    await this.verifierEcritureAutorisee();
    const session = await this.requireSession();
    if (!input.categorie) throw err("ERR_CATEGORIE_MANQUANTE");
    if (!input.montant || input.montant <= 0) throw err("ERR_MONTANT_NON_POSITIF");
    const { data, error } = await this.client()
      .from("depenses")
      .insert({
        owner_id: session.id,
        immeuble_id: input.immeuble_id,
        appartement_id: input.appartement_id,
        date: input.date,
        categorie: input.categorie,
        libelle: input.libelle.trim(),
        montant: input.montant,
        devise: input.devise,
        fournisseur: input.fournisseur?.trim() ? input.fournisseur.trim() : null,
        justificatif_url: input.justificatif_url ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const depense = { ...(data as Depense), montant: Number((data as Depense).montant) };
    await this.journaliser("depense", "depense", depense.id, `Dépense ajoutée : ${depense.libelle} (${depense.montant} ${depense.devise})`);
    return depense;
  }

  async modifierDepense(id: string, patch: DepensePatch): Promise<Depense> {
    await this.verifierEcritureAutorisee();
    if (patch.montant !== undefined && patch.montant !== null && patch.montant <= 0) {
      throw err("ERR_MONTANT_NON_POSITIF");
    }
    if (patch.categorie !== undefined && !patch.categorie) throw err("ERR_CATEGORIE_MANQUANTE");
    const { data, error } = await this.client()
      .from("depenses")
      .update({ ...patch, libelle: patch.libelle ? patch.libelle.trim() : undefined })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ...(data as Depense), montant: Number((data as Depense).montant) };
  }

  async supprimerDepense(id: string): Promise<void> {
    await this.verifierEcritureAutorisee();
    const { error } = await this.client().from("depenses").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async listerDocuments(filtre?: FiltreDocuments): Promise<Document[]> {
    let q = this.client().from("documents").select("*").order("created_at", { ascending: false });
    if (filtre?.type) q = q.eq("type", filtre.type);
    if (filtre?.entite_type) q = q.eq("entite_type", filtre.entite_type);
    if (filtre?.entite_id) q = q.eq("entite_id", filtre.entite_id);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    let liste = (data as Document[]).map((d) => ({ ...d, taille_octets: d.taille_octets === null ? null : Number(d.taille_octets) }));
    if (filtre?.recherche) {
      const rech = filtre.recherche.trim().toLowerCase();
      if (rech) liste = liste.filter((d) => d.nom_fichier.toLowerCase().includes(rech));
    }
    return liste;
  }

  async televerserDocument(input: DocumentInput): Promise<Document> {
    await this.verifierEcritureAutorisee();
    const session = await this.requireSession();
    const nom = input.nom_fichier.trim();
    const extension = nom.split(".").pop()?.toLowerCase() ?? "";
    const mimeOk = !input.mime_type || FORMATS_DOCUMENT_ACCEPTES.includes(input.mime_type);
    if (!["pdf", "jpg", "jpeg", "png"].includes(extension) || !mimeOk) throw err("ERR_DOCUMENT_FORMAT");
    if (input.taille_octets !== undefined && input.taille_octets !== null && input.taille_octets > TAILLE_MAX_DOCUMENT_OCTETS) {
      throw err("ERR_DOCUMENT_TROP_GROS");
    }
    const { data: doublon } = await this.client()
      .from("documents")
      .select("id")
      .eq("entite_type", input.entite_type)
      .eq("entite_id", input.entite_id)
      .ilike("nom_fichier", nom)
      .limit(1);
    if (doublon && doublon.length > 0) throw err("ERR_DOCUMENT_DOUBLON");
    if (!input.contenu) throw err("ERR_DOCUMENT_FORMAT");
    // Stockage PRIVÉ : bucket « documents-prives », jamais de lien public.
    const storagePath = `${session.id}/${input.entite_type}/${input.entite_id}/${Date.now()}-${nom}`;
    const blob = await (await fetch(input.contenu)).blob();
    const { error: uploadError } = await this.client()
      .storage.from("documents-prives")
      .upload(storagePath, blob, { contentType: input.mime_type ?? blob.type, upsert: false });
    if (uploadError) {
      if (/bucket not found/i.test(uploadError.message)) throw err("ERR_BUCKET_MANQUANT");
      throw new Error(uploadError.message);
    }
    const { data, error } = await this.client()
      .from("documents")
      .insert({
        owner_id: session.id,
        type: input.type,
        entite_type: input.entite_type,
        entite_id: input.entite_id,
        nom_fichier: nom,
        storage_path: storagePath,
        taille_octets: input.taille_octets ?? blob.size,
        mime_type: input.mime_type ?? blob.type,
        ajoute_par: session.id,
      })
      .select()
      .single();
    if (error) {
      await this.client().storage.from("documents-prives").remove([storagePath]);
      throw new Error(error.message);
    }
    await this.journaliser("document", "document", (data as Document).id, `Document ajouté : ${nom}`);
    return data as Document;
  }

  async renommerDocument(id: string, nomFichier: string): Promise<Document> {
    await this.verifierEcritureAutorisee();
    const { data, error } = await this.client()
      .from("documents")
      .update({ nom_fichier: nomFichier.trim() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Document;
  }

  async supprimerDocument(id: string): Promise<void> {
    await this.verifierEcritureAutorisee();
    const { data } = await this.client().from("documents").select("storage_path").eq("id", id).maybeSingle();
    const { error } = await this.client().from("documents").delete().eq("id", id);
    if (error) throw new Error(error.message);
    if (data?.storage_path) {
      await this.client().storage.from("documents-prives").remove([data.storage_path as string]);
    }
  }

  async telechargerDocument(id: string): Promise<{ url: string; nomFichier: string }> {
    const { data, error } = await this.client().from("documents").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw err("ERR_NOT_FOUND");
    const doc = data as Document;
    const { data: signe, error: signeError } = await this.client()
      .storage.from("documents-prives")
      .createSignedUrl(doc.storage_path, 3600); // lien signé, 1 heure
    if (signeError) {
      if (/bucket not found/i.test(signeError.message)) throw err("ERR_BUCKET_MANQUANT");
      throw new Error(signeError.message);
    }
    return { url: signe.signedUrl, nomFichier: doc.nom_fichier };
  }

  async listerActivites(immeubleId?: string | null): Promise<Activite[]> {
    const { data, error } = await this.client()
      .from("activites")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const appartements = await this.listerAppartements({ inclureArchives: true });
    return filtrerActivites(data as Activite[], immeubleId ?? null, appartements);
  }

  async getTaux(deviseSource: Devise, deviseCible: Devise): Promise<TauxResultat | null> {
    if (deviseSource === deviseCible) return null;
    const taux = await this.listerTaux();
    return trouverTaux(taux, deviseSource, deviseCible);
  }

  async listerTaux(): Promise<TauxChange[]> {
    const { data, error } = await this.client()
      .from("taux_change")
      .select("*")
      .order("date_taux", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data as TauxChange[]).map((t) => ({ ...t, taux: Number(t.taux) }));
  }

  async saisirTauxManuel(input: TauxManuelInput): Promise<TauxChange> {
    await this.verifierEcritureAutorisee();
    if (!input.taux || input.taux <= 0) throw err("ERR_MONTANT_NON_POSITIF");
    if (input.devise_source === input.devise_cible) throw err("ERR_TAUX_MEME_DEVISE");
    const { data, error } = await this.client()
      .from("taux_change")
      .insert({ ...input, source: "manuel" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ...(data as TauxChange), taux: Number((data as TauxChange).taux) };
  }

  async genererAlertes(): Promise<Alerte[]> {
    const session = await this.requireSession();
    const prefs = await this.getPreferencesNotifications();
    const profil = await this.getProfil();
    const [baux, echeances, paiements, appartements, abonnement] = await Promise.all([
      this.listerBaux(),
      this.listerEcheances(),
      this.listerPaiements(),
      this.listerAppartements({ inclureArchives: true }),
      this.getAbonnement(),
    ]);
    const candidates = genererAlertesCandidates({
      baux,
      echeances,
      paiements,
      appartements,
      abonnement,
      seuilVacanceJours: prefs.seuil_vacance_jours,
      langue: profil?.langue ?? "fr",
    });
    const { data: existantes } = await this.client().from("alertes").select("dedup_key");
    const clesExistantes = new Set((existantes ?? []).map((r) => r.dedup_key as string));
    const coupe = new Set<TypeAlerte>(prefs.types_coupes);
    for (const c of candidates) {
      if (clesExistantes.has(c.dedup_key) || coupe.has(c.type)) continue;
      const { data: inseree, error } = await this.client()
        .from("alertes")
        .insert({
          owner_id: session.id,
          type: c.type,
          entite_type: c.entite_type,
          entite_id: c.entite_id,
          message: c.message,
          statut: "active",
          canal: "app",
          dedup_key: c.dedup_key,
          urgence: c.urgence,
          email_statut: "non_configuré",
          // WhatsApp (module 6) : « desactive » si le canal est coupé dans
          // les Paramètres, sinon « non_configuré » tant qu'aucun envoi réel
          // n'a eu lieu — jamais de faux envoi.
          whatsapp_statut: prefs.canal_whatsapp ? "non_configuré" : "desactive",
        })
        .select()
        .single();
      if (!error && inseree) {
        clesExistantes.add(c.dedup_key);
        await this.journaliser("alerte", "alerte", null, `Alerte déclenchée : ${c.message}`);
        // E-mail (Correctif 2, spec §10) : envoyé au propriétaire à la
        // création de l'alerte, sauf canal coupé (« desactive ») — jamais
        // de faux envoi : sans fournisseur configuré, le statut reste
        // « non_configuré ». Un échec est signalé sans bloquer les autres
        // canaux ni la génération de l'alerte.
        let emailStatut: Alerte["email_statut"] = "non_configuré";
        if (!prefs.canal_email) {
          emailStatut = "desactive";
        } else if (!profil?.email) {
          emailStatut = "echec";
        } else {
          try {
            const resultat = await this.envoyerEmailAlerteFn({
              destinataire: profil.email,
              sujet: `CizaImmo — ${c.message}`,
              texte: c.message,
              langue: profil.langue === "en" ? "en" : "fr",
            });
            emailStatut = statutEmailDepuisResultat(resultat);
          } catch {
            emailStatut = "echec";
          }
        }
        if (emailStatut !== "non_configuré") {
          await this.client()
            .from("alertes")
            .update({ email_statut: emailStatut })
            .eq("id", (inseree as Alerte).id);
        }
      }
    }
    return this.listerAlertes();
  }

  async listerAlertes(): Promise<Alerte[]> {
    const { data, error } = await this.client()
      .from("alertes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ordre = { haute: 0, moyenne: 1, basse: 2 } as const;
    return (data as Alerte[]).sort((a, b) => {
      if (a.statut !== b.statut) return a.statut === "active" ? -1 : 1;
      return ordre[a.urgence] - ordre[b.urgence] || b.created_at.localeCompare(a.created_at);
    });
  }

  async marquerAlerteTraitee(id: string): Promise<Alerte> {
    const { data, error } = await this.client()
      .from("alertes")
      .update({ statut: "traitee", traitee_le: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    await this.journaliser("alerte", "alerte", id, `Alerte traitée : ${(data as Alerte).message}`);
    return data as Alerte;
  }

  async modifierProfil(patch: ProfilPatch): Promise<Profil> {
    const session = await this.requireSession();
    const { data, error } = await this.client()
      .from("profils")
      .update({
        nom: patch.nom !== undefined ? patch.nom.trim() : undefined,
        pays: patch.pays !== undefined ? patch.pays : undefined,
        telephone: patch.telephone !== undefined ? patch.telephone : undefined,
        langue: patch.langue,
        devise_principale: patch.devise_principale,
      })
      .eq("id", session.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapProfil(data as Profil);
  }

  async getPreferencesNotifications(): Promise<PreferencesNotifications> {
    const session = await this.requireSession();
    const { data, error } = await this.client()
      .from("preferences_notifications")
      .select("*")
      .eq("owner_id", session.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data as PreferencesNotifications;
    return {
      owner_id: session.id,
      types_coupes: [],
      canal_app: true,
      canal_email: true,
      canal_whatsapp: true,
      seuil_vacance_jours: 30,
      updated_at: new Date().toISOString(),
    };
  }

  async sauvegarderPreferencesNotifications(
    prefs: Partial<Omit<PreferencesNotifications, "owner_id" | "updated_at">>
  ): Promise<PreferencesNotifications> {
    const session = await this.requireSession();
    const courantes = await this.getPreferencesNotifications();
    const typesCoupes = (prefs.types_coupes ?? courantes.types_coupes).filter((t) => t !== "essai_abonnement");
    const ligne = {
      owner_id: session.id,
      types_coupes: typesCoupes,
      canal_app: prefs.canal_app ?? courantes.canal_app,
      canal_email: prefs.canal_email ?? courantes.canal_email,
      canal_whatsapp: prefs.canal_whatsapp ?? courantes.canal_whatsapp ?? true,
      seuil_vacance_jours:
        prefs.seuil_vacance_jours !== undefined && prefs.seuil_vacance_jours >= 7
          ? prefs.seuil_vacance_jours
          : courantes.seuil_vacance_jours,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await this.client()
      .from("preferences_notifications")
      .upsert(ligne, { onConflict: "owner_id" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as PreferencesNotifications;
  }

  async listerGestionnaires(): Promise<GestionnaireInvite[]> {
    const { data, error } = await this.client()
      .from("invitations_gestionnaires")
      .select("*")
      .order("email", { ascending: true });
    if (error) throw new Error(error.message);
    return (data as GestionnaireInvite[]).map((g) => ({
      ...g,
      immeuble_ids: (g.immeuble_ids as string[]) ?? [],
    }));
  }

  async inviterGestionnaire(email: string, immeubleIds: string[]): Promise<GestionnaireInvite> {
    const session = await this.requireSession();
    const adresse = email.trim().toLowerCase();
    if (!emailValide(adresse)) throw err("ERR_EMAIL_INVALIDE");
    if (immeubleIds.length === 0) throw err("ERR_GESTIONNAIRE_SANS_IMMEUBLE");
    const { data, error } = await this.client()
      .from("invitations_gestionnaires")
      .insert({ owner_id: session.id, email: adresse, nom: null, immeuble_ids: immeubleIds, statut: "invite" })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") throw err("ERR_GESTIONNAIRE_DEJA_INVITE");
      throw new Error(error.message);
    }
    return { ...(data as GestionnaireInvite), immeuble_ids: immeubleIds };
  }

  async retirerGestionnaire(id: string): Promise<void> {
    // Retrait = perte d'accès immédiate (spec §14) : la ligne d'invitation
    // disparaît et l'affectation gestionnaires_immeubles associée aussi.
    const { data } = await this.client()
      .from("invitations_gestionnaires")
      .select("email")
      .eq("id", id)
      .maybeSingle();
    const { error } = await this.client().from("invitations_gestionnaires").delete().eq("id", id);
    if (error) throw new Error(error.message);
    if (data?.email) {
      const { data: profils } = await this.client().from("profils").select("id").eq("email", data.email as string).limit(1);
      if (profils && profils.length > 0) {
        await this.client().from("gestionnaires_immeubles").delete().eq("profil_id", (profils[0] as { id: string }).id);
      }
    }
  }

  // ==========================================================================
  // MODULE 6 — Indivision familiale, vitrine publique, taux automatiques,
  // WhatsApp (spec §6 suite, §4, §9, §10). RLS : la lecture des biens
  // partagés passe par immeuble_visible() ; les écritures d'indivision
  // sont réservées au propriétaire (coproprietaires_write_owner).
  // RÈGLE DURE : CizaImmo calcule et affiche la répartition, mais
  // n'encaisse ni ne distribue AUCUN argent entre co-propriétaires.
  // ==========================================================================

  async listerCoproprietaires(immeubleId: string): Promise<Coproprietaire[]> {
    const { data, error } = await this.client()
      .from("coproprietaires")
      .select("*")
      .eq("immeuble_id", immeubleId)
      .order("nom", { ascending: true });
    if (error) throw new Error(error.message);
    return (data as Coproprietaire[]).map((c) => ({
      ...c,
      part: Number(c.part),
    }));
  }

  async inviterCoproprietaire(
    immeubleId: string,
    input: CoproprietaireInput
  ): Promise<Coproprietaire> {
    await this.verifierEcritureAutorisee();
    await this.verifierPlanIndivision();
    const session = await this.requireSession();
    const adresse = input.email.trim().toLowerCase();
    if (!emailValide(adresse)) throw err("ERR_EMAIL_INVALIDE");
    if (!Number.isFinite(input.part) || input.part <= 0 || input.part > 100) {
      throw err("ERR_PART_INVALIDE");
    }
    const immeuble = await this.getImmeuble(immeubleId);
    if (!immeuble || immeuble.owner_id !== session.id) throw err("ERR_NOT_FOUND");
    const existants = await this.listerCoproprietaires(immeubleId);
    if (existants.some((c) => c.email.trim().toLowerCase() === adresse)) {
      throw err("ERR_PART_EMAIL_UNIQUE");
    }
    if (sommeParts(existants) + input.part > 100 + 0.01) throw err("ERR_PARTS_TOTAL");
    const { data, error } = await this.client()
      .from("coproprietaires")
      .insert({
        immeuble_id: immeubleId,
        nom: input.nom.trim(),
        email: adresse,
        telephone: input.telephone?.trim() ? input.telephone.trim() : null,
        part: input.part,
        statut: "invite",
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") throw err("ERR_PART_EMAIL_UNIQUE");
      throw new Error(error.message);
    }
    const cree = { ...(data as Coproprietaire), part: Number((data as Coproprietaire).part) };
    await this.journaliser(
      "coproprietaire",
      "coproprietaire",
      cree.id,
      `Co-propriétaire invité : ${cree.nom} (${cree.email}, part ${cree.part} %) — ${immeuble.nom}`
    );
    return cree;
  }

  async definirParts(
    immeubleId: string,
    parts: CoproprietaireInput[]
  ): Promise<Coproprietaire[]> {
    await this.verifierEcritureAutorisee();
    await this.verifierPlanIndivision();
    const session = await this.requireSession();
    const immeuble = await this.getImmeuble(immeubleId);
    if (!immeuble || immeuble.owner_id !== session.id) throw err("ERR_NOT_FOUND");
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
    const anciens = await this.listerCoproprietaires(immeubleId);
    const parEmail = new Map(anciens.map((c) => [c.email.trim().toLowerCase(), c]));
    const gardes = new Set<string>();
    const resultat: Coproprietaire[] = [];
    for (const p of normalisees) {
      const ancien = parEmail.get(p.email);
      if (ancien) {
        gardes.add(ancien.id);
        if (ancien.part !== p.part) {
          await this.journaliser(
            "coproprietaire",
            "coproprietaire",
            ancien.id,
            `Part modifiée : ${ancien.nom} (${ancien.email}) — ${ancien.part} % → ${p.part} % — ${immeuble.nom}`
          );
        }
        const { data, error } = await this.client()
          .from("coproprietaires")
          .update({ nom: p.nom, telephone: p.telephone, part: p.part })
          .eq("id", ancien.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        resultat.push({ ...(data as Coproprietaire), part: Number((data as Coproprietaire).part) });
      } else {
        const { data, error } = await this.client()
          .from("coproprietaires")
          .insert({
            immeuble_id: immeubleId,
            nom: p.nom,
            email: p.email,
            telephone: p.telephone,
            part: p.part,
            statut: "invite",
          })
          .select()
          .single();
        if (error) {
          if (error.code === "23505") throw err("ERR_PART_EMAIL_UNIQUE");
          throw new Error(error.message);
        }
        const cree = { ...(data as Coproprietaire), part: Number((data as Coproprietaire).part) };
        await this.journaliser(
          "coproprietaire",
          "coproprietaire",
          cree.id,
          `Co-propriétaire invité : ${cree.nom} (${cree.email}, part ${cree.part} %) — ${immeuble.nom}`
        );
        resultat.push(cree);
      }
    }
    for (const ancien of anciens) {
      if (!gardes.has(ancien.id)) {
        const { error } = await this.client()
          .from("coproprietaires")
          .delete()
          .eq("id", ancien.id);
        if (error) throw new Error(error.message);
        await this.journaliser(
          "coproprietaire",
          "coproprietaire",
          ancien.id,
          `Co-propriétaire retiré : ${ancien.nom} (${ancien.email}, part ${ancien.part} %) — ${immeuble.nom}`
        );
      }
    }
    return resultat.sort((a, b) => a.nom.localeCompare(b.nom));
  }

  async retirerCoproprietaire(id: string): Promise<void> {
    await this.verifierEcritureAutorisee();
    const session = await this.requireSession();
    const { data: cop, error } = await this.client()
      .from("coproprietaires")
      .select("*, immeubles!inner(owner_id, nom)")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cop) throw err("ERR_COPROPRIETAIRE_INTROUVABLE");
    const ligne = cop as unknown as {
      nom: string;
      email: string;
      part: number;
      immeuble_id: string;
      immeubles: { owner_id: string; nom: string };
    };
    if (ligne.immeubles.owner_id !== session.id) throw err("ERR_NOT_FOUND");
    const { error: delError } = await this.client()
      .from("coproprietaires")
      .delete()
      .eq("id", id);
    if (delError) throw new Error(delError.message);
    await this.journaliser(
      "coproprietaire",
      "coproprietaire",
      id,
      `Co-propriétaire retiré : ${ligne.nom} (${ligne.email}, part ${ligne.part} %) — ${ligne.immeubles.nom}`
    );
  }

  async accepterInvitationCoproprietaire(id: string): Promise<Coproprietaire> {
    const session = await this.requireSession();
    const { data, error } = await this.client()
      .from("coproprietaires")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw err("ERR_COPROPRIETAIRE_INTROUVABLE");
    const cop = data as Coproprietaire;
    const immeuble = await this.getImmeuble(cop.immeuble_id);
    const estProprietaire = immeuble?.owner_id === session.id;
    const estConcerne =
      session.email.trim().toLowerCase() === cop.email.trim().toLowerCase();
    if (!estProprietaire && !estConcerne) throw err("ERR_ROLE_LECTURE_SEULE");
    if (cop.statut === "actif") return { ...cop, part: Number(cop.part) };
    const { data: maj, error: updError } = await this.client()
      .from("coproprietaires")
      .update({ statut: "actif" })
      .eq("id", id)
      .select()
      .single();
    if (updError) throw new Error(updError.message);
    // Le fil appartient au propriétaire du bien (owner_id = lui).
    await this.journaliser(
      "coproprietaire",
      "coproprietaire",
      id,
      `Invitation acceptée : ${cop.nom} (${cop.email}) — accès lecture seule sur ${immeuble?.nom ?? "—"}`,
      immeuble?.owner_id
    );
    return { ...(maj as Coproprietaire), part: Number((maj as Coproprietaire).part) };
  }

  /**
   * v1.6 : contact ATTENDU du dossier pour un immeuble — le gestionnaire
   * rattaché ACTIF de l'immeuble (contexte « proprietaire ») s'il
   * existe, sinon le propriétaire. Partagé par la vitrine publique
   * (repli du contact affiché) et la file de validation Admin
   * (comparaison de divergence). Les rattachements du propriétaire sont
   * récupérés puis filtrés en JS sur immeuble_ids : pas de dépendance
   * à l'opérateur tableau PostgREST.
   */
  private async contactDossierAttendu(
    ownerId: string,
    immeubleId: string
  ): Promise<{ contact: ContactPublic; role: "gestionnaire" | "proprietaire" }> {
    const client = this.client();
    const { data: rattachements } = await client
      .from("rattachements_gestionnaires")
      .select("gestionnaire_id, immeuble_ids")
      .eq("contexte", "proprietaire")
      .eq("proprietaire_id", ownerId)
      .eq("statut", "actif");
    const rattachement = (
      (rattachements as
        | { gestionnaire_id: string; immeuble_ids: string[] | null }[]
        | null) ?? []
    ).find((r) => (r.immeuble_ids ?? []).includes(immeubleId));
    if (rattachement) {
      const { data: profilGestionnaire } = await client
        .from("profils")
        .select("nom, email, telephone")
        .eq("id", rattachement.gestionnaire_id)
        .maybeSingle();
      if (profilGestionnaire) {
        const p = profilGestionnaire as {
          nom: string;
          email: string | null;
          telephone: string | null;
        };
        return {
          contact: {
            nom: p.nom,
            email: p.email ?? null,
            telephone: p.telephone ?? null,
          },
          role: "gestionnaire",
        };
      }
    }
    const { data: profilProprietaire } = await client
      .from("profils")
      .select("nom, email, telephone")
      .eq("id", ownerId)
      .maybeSingle();
    const p = (profilProprietaire as {
      nom: string;
      email: string | null;
      telephone: string | null;
    } | null) ?? { nom: "—", email: null, telephone: null };
    return {
      contact: {
        nom: p.nom,
        email: p.email ?? null,
        telephone: p.telephone ?? null,
      },
      role: "proprietaire",
    };
  }

  async listerAnnoncesPubliques(): Promise<AnnoncePublique[]> {
    // Page publique : aucune session requise — la RLS (politiques « anon »,
    // supabase/schema.sql) ne retourne que les appartements publiés,
    // vacants ou réservés. Jamais de coordonnée de locataire.
    // v1.6 : seules les annonces APPROUVÉES par un Admin s'affichent
    // (vitrine_statut = « approuve », décidé dans la base) — badge
    // « ✓ Vérifié » sur chaque annonce affichée.
    const { data, error } = await this.client()
      .from("appartements")
      .select("*, immeubles!inner(id, nom, adresse, quartier, ville, pays, owner_id)")
      .eq("vitrine", true)
      .eq("vitrine_statut", "approuve")
      .eq("archive", false)
      .in("statut", ["vacant", "reserve"])
      .order("numero", { ascending: true });
    if (error) throw new Error(error.message);
    const annonces: AnnoncePublique[] = [];
    for (const ligne of (data ?? []) as unknown as Record<string, unknown>[]) {
      const apt = mapAppartement(ligne as unknown as Appartement);
      const imm = ligne.immeubles as {
        id: string;
        nom: string;
        adresse: string;
        quartier: string | null;
        ville: string;
        pays: string;
        owner_id: string;
      };
      const dossier = await this.contactDossierAttendu(imm.owner_id, imm.id);
      // Contact AFFICHÉ : celui de l'annonce s'il est renseigné (son
      // nom retombe sur celui du dossier), sinon le contact du dossier.
      const contact: ContactPublic =
        apt.contact_telephone !== null || apt.contact_email !== null
          ? {
              nom: apt.contact_nom ?? dossier.contact.nom,
              email: apt.contact_email ?? null,
              telephone: apt.contact_telephone ?? null,
            }
          : dossier.contact;
      annonces.push({
        appartement: apt,
        immeuble_id: imm.id,
        immeuble_nom: imm.nom,
        ville: imm.ville,
        pays: imm.pays,
        adresse: imm.adresse,
        quartier: imm.quartier ?? null,
        contact,
      });
    }
    return annonces.sort((a, b) => a.ville.localeCompare(b.ville));
  }

  async getAnnoncePublique(appartementId: string): Promise<AnnoncePublique | null> {
    const annonces = await this.listerAnnoncesPubliques();
    return annonces.find((a) => a.appartement.id === appartementId) ?? null;
  }

  // --- v1.6 « Vitrine vérifiée » : modération (la base décide, via RPC) ---

  /** Relecture d'un appartement après un appel RPC vitrine. */
  private async relireAppartementVitrine(appartementId: string): Promise<Appartement> {
    const apt = await this.getAppartement(appartementId);
    if (!apt) throw err("ERR_NOT_FOUND");
    return apt;
  }

  async demanderPublicationVitrine(appartementId: string): Promise<Appartement> {
    // RPC base : passe l'annonce en « en_attente » ; la justification
    // est exigée par la base si le contact annoncé diverge du dossier.
    const { error } = await this.client().rpc("demander_publication_vitrine", {
      p_appartement: appartementId,
    });
    if (error) throw new Error(error.message);
    return this.relireAppartementVitrine(appartementId);
  }

  async retirerPublicationVitrine(appartementId: string): Promise<Appartement> {
    const { error } = await this.client().rpc("retirer_publication_vitrine", {
      p_appartement: appartementId,
    });
    if (error) throw new Error(error.message);
    return this.relireAppartementVitrine(appartementId);
  }

  async validerPublicationVitrine(
    appartementId: string,
    accepter: boolean,
    motif?: string | null
  ): Promise<Appartement> {
    // Décision Admin journalisée par la RPC base (approuve / refuse).
    const { error } = await this.client().rpc("valider_publication_vitrine", {
      p_appartement: appartementId,
      p_accepter: accepter,
      p_motif: motif ?? null,
    });
    if (error) throw new Error(error.message);
    return this.relireAppartementVitrine(appartementId);
  }

  async listerVitrineAValider(): Promise<AnnonceAValider[]> {
    // File console : le client de la session Admin lit via les
    // politiques plateforme existantes (patron listerDossier).
    await this.acteurPlateforme();
    const client = this.client();
    const { data, error } = await client
      .from("appartements")
      .select("*")
      .eq("vitrine_statut", "en_attente")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const resultats: AnnonceAValider[] = [];
    for (const ligne of (data as Appartement[] | null) ?? []) {
      const apt = mapAppartement(ligne);
      const { data: immData } = await client
        .from("immeubles")
        .select("id, nom, adresse, quartier, ville, owner_id")
        .eq("id", apt.immeuble_id)
        .maybeSingle();
      if (!immData) continue;
      const imm = immData as {
        id: string;
        nom: string;
        adresse: string;
        quartier: string | null;
        ville: string;
        owner_id: string;
      };
      const { data: profilProprietaire } = await client
        .from("profils")
        .select("nom, display_id")
        .eq("id", imm.owner_id)
        .maybeSingle();
      const proprietaire = (profilProprietaire as {
        nom: string;
        display_id: string | null;
      } | null) ?? { nom: "—", display_id: null };
      const dossier = await this.contactDossierAttendu(imm.owner_id, imm.id);
      const contactAnnonce: ContactPublic = {
        nom: apt.contact_nom ?? "—",
        email: apt.contact_email,
        telephone: apt.contact_telephone,
      };
      resultats.push({
        appartement: apt,
        immeuble_id: imm.id,
        immeuble_nom: imm.nom,
        immeuble_adresse: imm.adresse,
        immeuble_quartier: imm.quartier ?? null,
        immeuble_ville: imm.ville,
        proprietaire_id: imm.owner_id,
        proprietaire_nom: proprietaire.nom,
        proprietaire_display_id: proprietaire.display_id ?? null,
        contact_annonce: contactAnnonce,
        contact_dossier: dossier.contact,
        contact_dossier_role: dossier.role,
        justification: apt.contact_justification,
        divergent: contactVitrineDivergent(contactAnnonce, dossier.contact),
      });
    }
    return resultats;
  }

  async enregistrerTauxAuto(
    taux: Omit<TauxChange, "id" | "created_at">[]
  ): Promise<TauxChange[]> {
    await this.verifierEcritureAutorisee();
    const lignes = taux.filter(
      (t) => t.taux > 0 && t.devise_source !== t.devise_cible
    );
    if (lignes.length === 0) return [];
    const existants = await this.listerTaux();
    const aInserer = lignes.filter(
      (l) =>
        !existants.some(
          (t) =>
            t.devise_source === l.devise_source &&
            t.devise_cible === l.devise_cible &&
            t.date_taux.slice(0, 10) === l.date_taux.slice(0, 10) &&
            t.source === l.source
        )
    );
    if (aInserer.length === 0) return [];
    const { data, error } = await this.client()
      .from("taux_change")
      .insert(
        aInserer.map((l) => ({ ...l, date_taux: l.date_taux.slice(0, 10), source: "auto" }))
      )
      .select();
    if (error) throw new Error(error.message);
    return (data as TauxChange[]).map((t) => ({ ...t, taux: Number(t.taux) }));
  }

  async marquerAlerteWhatsApp(id: string, statut: StatutWhatsApp): Promise<Alerte> {
    const { data, error } = await this.client()
      .from("alertes")
      .update({ whatsapp_statut: statut })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Alerte;
  }

  // ==========================================================================
  // MODULE 5 — Abonnement & facturation (spec §12).
  // Tables : factures_abonnement, paiements_mobile_money (supabase/module5.sql).
  // En réel, la confirmation d'un paiement mobile money arrive UNIQUEMENT
  // par le webhook /api/mobile-money/webhook (agrégateur / partenaire
  // local) ; confirmerPaiementMobileMoney() refuse donc ici.
  // ==========================================================================

  async getLimiteBlocs(): Promise<LimiteBlocs> {
    const session = await this.requireSession();
    const abo = await this.getAbonnement();
    if (!abo) throw err("ERR_NOT_FOUND");
    const { data, error } = await this.client()
      .from("immeubles")
      .select("id")
      .eq("owner_id", session.id)
      .eq("statut", "actif");
    if (error) throw new Error(error.message);
    return {
      utilises: data?.length ?? 0,
      autorises: limiteBlocs(abo.plan, abo.statut),
      plan: abo.plan,
      statut: abo.statut,
    };
  }

  /**
   * Prix DYNAMIQUE (extension v1.2) : lu dans tarifs_plateforme via
   * getTarifsPlateforme() — jamais le littéral codé en dur. Repli :
   * prixPlan (seed) si la source est injoignable.
   */
  private async prixDynamiqueReel(plan: Plan, grille: Grille): Promise<number> {
    try {
      const tarifs = await this.getTarifsPlateforme();
      return construirePrixPlans(tarifs)[plan][grille];
    } catch {
      return prixPlan(plan, grille);
    }
  }

  /** Émet une facture d'abonnement (enregistrement, pas un encaissement). */
  private async emettreFacture(
    abo: Abonnement,
    plan: Plan,
    moyen: FactureAbonnement["moyen"],
    referenceMobileMoney: string | null,
    debut: string
  ): Promise<void> {
    const { data: existantes } = await this.client()
      .from("factures_abonnement")
      .select("numero")
      .eq("owner_id", abo.owner_id);
    const numero = prochainNumeroFactureAbo(
      (existantes ?? []).map((r) => (r as { numero: string }).numero),
      new Date(debut).getFullYear()
    );
    const { error } = await this.client().from("factures_abonnement").insert({
      owner_id: abo.owner_id,
      numero,
      plan,
      grille: abo.grille,
      montant: await this.prixDynamiqueReel(plan, abo.grille),
      devise: "USD",
      date_emission: debut,
      date_debut: debut,
      date_fin: ajouterMois(debut, 1),
      moyen,
      statut: "payee",
      stripe_invoice_id: null,
      reference_mobile_money: referenceMobileMoney,
    });
    if (error) throw new Error(error.message);
  }

  private async majAbonnement(id: string, patch: Partial<Abonnement>): Promise<Abonnement> {
    const { data, error } = await this.client()
      .from("abonnements")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return mapAbonnement(data as Abonnement);
  }

  async changerPlan(plan: Plan): Promise<Abonnement> {
    const session = await this.requireSession();
    if (!["starter", "pro", "agence"].includes(plan)) throw err("ERR_PLAN_INVALIDE");
    const abo = await this.getAbonnement();
    if (!abo) throw err("ERR_NOT_FOUND");
    const maintenant = new Date().toISOString();

    if (plan === abo.plan) {
      if (abo.plan_en_attente || abo.resiliation_programmee) {
        return this.majAbonnement(abo.id, {
          plan_en_attente: null,
          date_effet_plan: null,
          resiliation_programmee: false,
        });
      }
      if (abo.statut === "essai") return abo;
      const maj = await this.majAbonnement(abo.id, {
        statut: "actif",
        trial_ends_at: null,
        echec_paiement: false,
        grace_ends_at: null,
        debut_periode: maintenant,
        fin_periode: ajouterMois(maintenant, 1),
      });
      await this.emettreFacture(maj, plan, "stripe", null, maintenant);
      return maj;
    }

    // Descente : effective à la fin de la période payée, avec contrôle
    // préalable de la limite de blocs (spec §12).
    if (RANG_PLAN[plan] < RANG_PLAN[abo.plan]) {
      const { utilises } = await this.getLimiteBlocs();
      if (utilises > LIMITE_BLOCS[plan]) throw err("ERR_DESCENTE_BLOQUEE");
      return this.majAbonnement(abo.id, {
        plan_en_attente: plan,
        date_effet_plan:
          abo.fin_periode ?? abo.trial_ends_at ?? ajouterMois(maintenant, 1),
      });
    }

    // Montée immédiate (ou reprise depuis la lecture seule) : nouvelle
    // période d'1 mois. En réel, le paiement passe par Stripe Checkout ;
    // cette méthode applique le changement une fois le paiement confirmé
    // (webhook) ou simulé (démo).
    const maj = await this.majAbonnement(abo.id, {
      plan,
      plan_en_attente: null,
      date_effet_plan: null,
      resiliation_programmee: false,
      echec_paiement: false,
      grace_ends_at: null,
      statut: "actif",
      trial_ends_at: null,
      debut_periode: maintenant,
      fin_periode: ajouterMois(maintenant, 1),
    });
    await this.emettreFacture(maj, plan, "stripe", null, maintenant);
    return maj;
  }

  /** v1.4 : pack choisi pendant l'essai pour la fin de l'essai. */
  async definirPlanApresEssai(plan: Plan): Promise<Abonnement> {
    await this.requireSession();
    if (!["starter", "pro", "agence"].includes(plan)) throw err("ERR_PLAN_INVALIDE");
    const abo = await this.getAbonnement();
    if (!abo) throw err("ERR_NOT_FOUND");
    if (abo.statut !== "essai") return abo;
    return this.majAbonnement(abo.id, { plan_apres_essai: plan });
  }

  async annulerAbonnement(): Promise<Abonnement> {
    await this.requireSession();
    const abo = await this.getAbonnement();
    if (!abo) throw err("ERR_NOT_FOUND");
    // Effective en fin de période ; données conservées 90 jours en
    // lecture seule ensuite (transition paresseuse, spec §12).
    if (abo.statut === "essai" || abo.statut === "actif") {
      return this.majAbonnement(abo.id, { resiliation_programmee: true });
    }
    return abo;
  }

  async listerFactures(): Promise<FactureAbonnement[]> {
    await this.requireSession();
    const { data, error } = await this.client()
      .from("factures_abonnement")
      .select("*")
      .order("date_emission", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as FactureAbonnement[]).map((f) => ({
      ...f,
      montant: Number(f.montant),
      // v1.5 : anonymisation comptable après suppression de compte.
      anonymise: (f as FactureAbonnement).anonymise ?? false,
    }));
  }

  async signalerEchecPaiement(): Promise<Abonnement> {
    await this.requireSession();
    const abo = await this.getAbonnement();
    if (!abo) throw err("ERR_NOT_FOUND");
    if (abo.statut !== "actif") return abo;
    return this.majAbonnement(abo.id, {
      echec_paiement: true,
      grace_ends_at: ajouterJours(new Date().toISOString(), GRACE_ECHEC_PAIEMENT_JOURS),
    });
  }

  async demanderPaiementMobileMoney(
    operateur: OperateurMobileMoney,
    telephone: string,
    plan?: Plan
  ): Promise<PaiementMobileMoney> {
    const session = await this.requireSession();
    if (!["ecocash", "lumicash", "enoti"].includes(operateur)) {
      throw err("ERR_MM_TELEPHONE_INVALIDE");
    }
    if (!telephoneMobileMoneyValide(telephone)) throw err("ERR_MM_TELEPHONE_INVALIDE");
    const abo = await this.getAbonnement();
    if (!abo) throw err("ERR_NOT_FOUND");
    const planVise = plan ?? abo.plan;
    if (!["starter", "pro", "agence"].includes(planVise)) throw err("ERR_PLAN_INVALIDE");
    const maintenant = new Date().toISOString();
    const { data, error } = await this.client()
      .from("paiements_mobile_money")
      .insert({
        owner_id: session.id,
        operateur,
        telephone: telephone.trim(),
        montant: await this.prixDynamiqueReel(planVise, abo.grille),
        plan: planVise,
        reference: genererReferenceMobileMoney(),
        statut: "en_attente",
        cree_le: maintenant,
        expire_le: ajouterJours(maintenant, MOBILE_MONEY_EXPIRATION_HEURES / 24),
        confirme_le: null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ...(data as PaiementMobileMoney), montant: Number((data as PaiementMobileMoney).montant) };
  }

  async confirmerPaiementMobileMoney(_reference: string): Promise<PaiementMobileMoney> {
    // En mode réel, seul le webhook du fournisseur / agrégateur peut
    // confirmer un paiement mobile money (jamais une auto-confirmation).
    await this.requireSession();
    throw err("ERR_MM_CONFIRMATION_WEBHOOK");
  }

  async listerPaiementsMobileMoney(): Promise<PaiementMobileMoney[]> {
    await this.requireSession();
    // Expiration paresseuse des demandes non confirmées sous 24 h.
    const maintenant = new Date().toISOString();
    await this.client()
      .from("paiements_mobile_money")
      .update({ statut: "expire" })
      .eq("statut", "en_attente")
      .lt("expire_le", maintenant);
    const { data, error } = await this.client()
      .from("paiements_mobile_money")
      .select("*")
      .order("cree_le", { ascending: false });
    if (error) throw new Error(error.message);
    return (data as PaiementMobileMoney[]).map((p) => ({ ...p, montant: Number(p.montant) }));
  }

  // ==========================================================================
  // EXTENSION v1.2 — CONSOLE PLATEFORME (Admin / Super Admin), approbation
  // des comptes, avis, rattachements, supervision, finances dynamiques.
  // Voir docs/admin-finance-v1.2.md. La RLS (module-admin.sql) double
  // chaque garde applicative ci-dessous ; toute action est journalisée
  // dans journal_audit (append-only).
  // ==========================================================================

  private async acteurPlateforme(): Promise<{
    id: string;
    email: string;
    nom: string;
    role: "admin" | "super_admin";
  }> {
    const profil = await this.getProfil();
    if (
      !profil ||
      (profil.role !== "admin" && profil.role !== "super_admin") ||
      profil.suspendu
    ) {
      throw err("ERR_ACCES_PLATEFORME");
    }
    // Audit enrichi : le NOM de l'acteur est figé dans chaque entrée
    // du journal (snapshot du profil au moment de l'action).
    return { id: profil.id, email: profil.email, nom: profil.nom, role: profil.role };
  }

  private async acteurSuperAdmin() {
    const acteur = await this.acteurPlateforme();
    if (acteur.role !== "super_admin") throw err("ERR_SUPER_ADMIN_REQUIS");
    return acteur;
  }

  private async journaliserAudit(
    acteur: { id: string; email: string; nom: string; role: "admin" | "super_admin" },
    action: string,
    cibleType: CibleAudit,
    cibleId: string | null,
    cibleEmail: string | null,
    details?: Record<string, unknown> | null
  ): Promise<void> {
    await this.client().from("journal_audit").insert({
      acteur_id: acteur.id,
      acteur_email: acteur.email,
      // Audit enrichi (2026-11-07) : snapshot du nom de l'acteur —
      // la base complète par trigger si un chemin ne le fournit pas.
      acteur_nom: acteur.nom,
      acteur_role: acteur.role,
      action,
      cible_type: cibleType,
      cible_id: cibleId,
      cible_email: cibleEmail,
      details: details ?? null,
    });
  }

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

  /** Abonnement le plus récent d'un compte (console). */
  private async abonnementDe(compteId: string): Promise<Abonnement | null> {
    const { data } = await this.client()
      .from("abonnements")
      .select("*")
      .eq("owner_id", compteId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? mapAbonnement(data as Abonnement) : null;
  }

  async listerComptesPlateforme(): Promise<ComptePlateforme[]> {
    await this.acteurPlateforme();
    const client = this.client();
    const parametres = await this.getParametresFinance();
    const { data: profils, error } = await client
      .from("profils")
      .select("*")
      .in("role", ["proprietaire", "gestionnaire", "coproprietaire"])
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: abonnements } = await client
      .from("abonnements")
      .select("*")
      .order("created_at", { ascending: false });
    const parProprietaire = new Map<string, Abonnement>();
    for (const a of (abonnements as Abonnement[] | null) ?? []) {
      if (!parProprietaire.has(a.owner_id)) parProprietaire.set(a.owner_id, a);
    }
    // v1.3 : dossiers complets = pièce d'identité reçue (la photo est
    // sur le profil). Une seule requête pour tous les comptes.
    const { data: piecesIdentite } = await client
      .from("documents")
      .select("entite_id")
      .eq("entite_type", "compte")
      .eq("type", "piece_identite");
    const dossiersAvecPiece = new Set(
      ((piecesIdentite as { entite_id: string }[] | null) ?? []).map((d) => d.entite_id)
    );
    // v1.5 : noms des Admins responsables (jointure manuelle en batch,
    // les Admins ne font pas partie de la liste des comptes clients).
    const listeProfils = (profils as Profil[] | null) ?? [];
    const idsResponsables = Array.from(
      new Set(
        listeProfils
          .map((p) => p.admin_responsable_id)
          .filter((id): id is string => Boolean(id))
      )
    );
    const nomResponsableParId = new Map<string, string>();
    if (idsResponsables.length > 0) {
      const { data: responsables } = await client
        .from("profils")
        .select("id, nom")
        .in("id", idsResponsables);
      for (const r of (responsables as { id: string; nom: string }[] | null) ?? []) {
        nomResponsableParId.set(r.id, r.nom);
      }
    }
    return listeProfils.map((p) => {
      const abo = parProprietaire.get(p.id) ?? null;
      const vue = abo
        ? {
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
          }
        : null;
      return {
        id: p.id,
        email: p.email,
        nom: p.nom,
        role: p.role,
        pays: p.pays,
        langue: p.langue,
        suspendu: p.suspendu ?? false,
        created_at: p.created_at,
        pays_declare: p.pays_declare ?? p.pays,
        pays_ip: p.pays_ip ?? null,
        pays_paiement: p.pays_paiement ?? null,
        grille_statut: p.grille_statut ?? "ok",
        motif_refus: p.motif_refus ?? null,
        abonnement: vue,
        en_retard: estEnRetardPaiement(vue, parametres),
        display_id: p.display_id ?? null,
        telephone: p.telephone ?? null,
        type_intention: p.type_intention ?? "proprietaire",
        statut_contrat: p.statut_contrat ?? "sans_objet",
        // Option C : contrat propriétaire non bloquant (console).
        statut_contrat_proprietaire: p.statut_contrat_proprietaire ?? "sans_objet",
        motif_contrat_proprietaire: p.motif_contrat_proprietaire ?? null,
        dossier_complet: Boolean(p.photo_profil_path) && dossiersAvecPiece.has(p.id),
        // v1.5 : assignation + suppression en cours (champs requis).
        admin_responsable_id: p.admin_responsable_id ?? null,
        admin_responsable_nom: p.admin_responsable_id
          ? nomResponsableParId.get(p.admin_responsable_id) ?? null
          : null,
        suppression_demandee_le: p.suppression_demandee_le ?? null,
      };
    });
  }

  async suspendreCompte(compteId: string): Promise<void> {
    const acteur = await this.acteurPlateforme();
    const client = this.client();
    const abo = await this.abonnementDe(compteId);
    const { data: profil } = await client
      .from("profils")
      .select("email")
      .eq("id", compteId)
      .maybeSingle();
    if (!profil) throw err("ERR_INTROUVABLE");
    await client
      .from("profils")
      .update({ suspendu: true, suspendu_le: new Date().toISOString() })
      .eq("id", compteId);
    if (abo && abo.statut !== "suspendu" && abo.statut !== "en_attente") {
      await client
        .from("abonnements")
        .update({ statut_pre_suspension: abo.statut, statut: "suspendu" })
        .eq("id", abo.id);
    }
    await this.journaliserAudit(acteur, "compte_suspendu", "compte", compteId, profil.email);
  }

  async reactiverCompte(compteId: string): Promise<void> {
    const acteur = await this.acteurPlateforme();
    const client = this.client();
    const abo = await this.abonnementDe(compteId);
    const { data: profil } = await client
      .from("profils")
      .select("email")
      .eq("id", compteId)
      .maybeSingle();
    if (!profil) throw err("ERR_INTROUVABLE");
    await client
      .from("profils")
      .update({ suspendu: false, suspendu_le: null })
      .eq("id", compteId);
    if (abo && abo.statut === "suspendu") {
      await client
        .from("abonnements")
        .update({
          statut: abo.statut_pre_suspension ?? "actif",
          statut_pre_suspension: null,
        })
        .eq("id", abo.id);
    }
    await this.journaliserAudit(acteur, "compte_reactive", "compte", compteId, profil.email);
  }

  async supprimerCompteDefinitivement(compteId: string): Promise<void> {
    const acteur = await this.acteurSuperAdmin();
    const client = this.client();
    const { data: profil } = await client
      .from("profils")
      .select("email")
      .eq("id", compteId)
      .maybeSingle();
    if (!profil) throw err("ERR_INTROUVABLE");
    // Audit AVANT la suppression : la ligne survit à la cible (le journal
    // référence l'acteur, pas la cible, en clé étrangère).
    await this.journaliserAudit(
      acteur,
      "compte_supprime_definitivement",
      "compte",
      compteId,
      profil.email
    );
    const { error } = await client.rpc("supprimer_compte_definitivement", {
      cible: compteId,
    });
    if (error) {
      if (error.message.includes("SUPER_ADMIN_REQUIS")) throw err("ERR_SUPER_ADMIN_REQUIS");
      if (error.message.includes("AUTO_SUPPRESSION")) throw err("ERR_OPERATION_INTERDITE");
      throw new Error(error.message);
    }
  }

  async approuverCompte(compteId: string): Promise<void> {
    const acteur = await this.acteurPlateforme();
    const client = this.client();
    const abo = await this.abonnementDe(compteId);
    if (!abo || abo.statut !== "en_attente") throw err("ERR_COMPTE_NON_EN_ATTENTE");
    const { data: profil } = await client
      .from("profils")
      .select("email, nom, langue, type_intention, display_id, telephone, pays")
      .eq("id", compteId)
      .maybeSingle();
    if (!profil) throw err("ERR_INTROUVABLE");
    // Checklist de vérification (2026-11-07) : la dernière
    // consignation est relue ici pour être versée au journal de
    // l'approbation (cases cochées) ; la GARDE elle-même vit dans la
    // base (approuver_compte refuse une checklist incomplète).
    const { data: checklistRows } = await client
      .from("dossier_checklists")
      .select("photo_verifiee, piece_coherente, infos_verifiees, antifraude_examinee")
      .eq("cible_id", compteId)
      .order("created_at", { ascending: false })
      .limit(1);
    const checklist = (checklistRows as ChecklistDossierSaisie[] | null)?.[0] ?? null;
    const maintenant = new Date();
    // v1.4 — LA BASE DÉCIDE : la transition d'approbation est la
    // fonction SQL public.approuver_compte (module-v14.sql). Elle
    // vérifie le rôle plateforme en interne, démarre l'essai À
    // L'APPROBATION avec la durée dynamique (parametres_finance) et
    // force le pack STARTER ; elle retourne la fin d'essai posée.
    const { data: finEssaiRpc, error: rpcError } = await client.rpc("approuver_compte", {
      cible: compteId,
    });
    if (rpcError) {
      if (rpcError.message.includes("COMPTE_NON_EN_ATTENTE")) throw err("ERR_COMPTE_NON_EN_ATTENTE");
      if (rpcError.message.includes("ADMIN_PLATEFORME_REQUIS")) throw err("ERR_ACCES_PLATEFORME");
      if (rpcError.message.includes("ABONNEMENT_INTROUVABLE")) throw err("ERR_INTROUVABLE");
      if (rpcError.message.includes("CHECKLIST_INCOMPLETE")) throw err("ERR_CHECKLIST_INCOMPLETE");
      throw new Error(rpcError.message);
    }
    const finEssai = (finEssaiRpc as string | null) ?? maintenant.toISOString();
    // La grille affichée est confirmée (sur le profil, ci-dessous).
    const estGestionnaire = profil.type_intention === "gestionnaire";
    await client
      .from("profils")
      .update({
        grille_attribuee: abo.grille,
        // v1.3 : l'approbation d'un GESTIONNAIRE déclenche le contrat.
        ...(estGestionnaire ? { statut_contrat: "a_signer" } : {}),
        // Option C : l'approbation d'un PROPRIÉTAIRE déclenche son
        // contrat de service (non bloquant — simple suivi).
        ...(!estGestionnaire ? { statut_contrat_proprietaire: "a_signer" } : {}),
      })
      .eq("id", compteId);
    const langue = profil.langue === "en" ? "en" : "fr";
    // v1.3 : gestionnaire → e-mail de DÉCISION avec le contrat en pièce
    // jointe ; propriétaire → e-mail de bienvenue (flux v1.2 inchangé).
    // Option C : la bienvenue PROPRIÉTAIRE emporte son contrat de
    // service en pièce jointe — l'accès et l'essai sont déjà actifs.
    let emailStatut: Avis["statut_envoi"];
    let contratJoint = false;
    if (estGestionnaire && profil.display_id) {
      const contrat = await genererContratGestionnairePdf({
        nom: profil.nom,
        displayId: profil.display_id,
        email: profil.email,
        telephone: profil.telephone ?? null,
        pays: profil.pays ?? null,
        langue,
        date: maintenant.toISOString().slice(0, 10),
      });
      const decision = rendreDecisionGestionnaire(profil.nom, profil.display_id, langue);
      emailStatut = await this.envoyerEmailPlateforme(
        profil.email,
        decision.sujet,
        decision.corps,
        langue,
        [{ nom: contrat.nomFichier, contenuBase64: contrat.contenuBase64 }]
      );
      contratJoint = true;
    } else if (profil.display_id) {
      // Option C — propriétaire : bienvenue + contrat de service joint.
      // Repli NON BLOQUANT : si la génération du PDF échoue, la
      // bienvenue part sans pièce jointe — le contrat reste
      // téléchargeable depuis l'espace du propriétaire (régénéré à
      // la demande par getMonContratProprietaire). L'approbation et
      // l'essai ne dépendent jamais de la pièce jointe.
      let piecesJointes: { nom: string; contenuBase64: string }[] | undefined;
      try {
        const contrat = await genererContratProprietairePdf({
          nom: profil.nom,
          displayId: profil.display_id,
          email: profil.email,
          telephone: profil.telephone ?? null,
          pays: profil.pays ?? null,
          langue,
          date: maintenant.toISOString().slice(0, 10),
        });
        piecesJointes = [{ nom: contrat.nomFichier, contenuBase64: contrat.contenuBase64 }];
        contratJoint = true;
      } catch {
        piecesJointes = undefined;
      }
      const bienvenue = rendreBienvenueProprietaire(profil.nom, profil.display_id, langue);
      emailStatut = await this.envoyerEmailPlateforme(
        profil.email,
        bienvenue.sujet,
        bienvenue.corps,
        langue,
        piecesJointes
      );
    } else {
      const bienvenue = rendreBienvenue(profil.nom, langue);
      emailStatut = await this.envoyerEmailPlateforme(
        profil.email,
        bienvenue.sujet,
        bienvenue.corps,
        langue
      );
    }
    await this.journaliserAudit(acteur, "compte_approuve", "compte", compteId, profil.email, {
      grille: abo.grille,
      trial_ends_at: finEssai,
      email_bienvenue: emailStatut,
      // Checklist consignée au moment de l'approbation (cases
      // cochées par l'Admin relecteur — preuve de la revue).
      ...(checklist
        ? {
            checklist_photo_verifiee: checklist.photo_verifiee,
            checklist_piece_coherente: checklist.piece_coherente,
            checklist_infos_verifiees: checklist.infos_verifiees,
            checklist_antifraude_examinee: checklist.antifraude_examinee,
          }
        : {}),
      ...(contratJoint
        ? {
            contrat_envoye: true,
            display_id: profil.display_id,
            // Option C : distingue le contrat propriétaire (bienvenue)
            // du contrat gestionnaire (e-mail de décision).
            ...(estGestionnaire ? {} : { contrat_proprietaire_envoye: true }),
          }
        : {}),
    });
  }

  async enregistrerChecklistDossier(
    compteId: string,
    saisie: ChecklistDossierSaisie
  ): Promise<void> {
    await this.acteurPlateforme();
    // LA BASE DÉCIDE (patron v1.4) : la consignation passe par la RPC
    // public.enregistrer_checklist_dossier (module-checklist-audit.sql)
    // — rôle vérifié en interne, acteur = session, horodatage base.
    const { error } = await this.client().rpc("enregistrer_checklist_dossier", {
      cible: compteId,
      p_photo: saisie.photo_verifiee,
      p_piece: saisie.piece_coherente,
      p_infos: saisie.infos_verifiees,
      p_antifraude: saisie.antifraude_examinee,
    });
    if (error) {
      if (error.message.includes("ADMIN_PLATEFORME_REQUIS")) throw err("ERR_ACCES_PLATEFORME");
      if (error.message.includes("COMPTE_INTROUVABLE")) throw err("ERR_INTROUVABLE");
      if (error.message.includes("COMPTE_NON_EN_ATTENTE")) throw err("ERR_COMPTE_NON_EN_ATTENTE");
      throw new Error(error.message);
    }
  }

  async refuserCompte(compteId: string, motif: MotifRefus): Promise<void> {
    const acteur = await this.acteurPlateforme();
    const client = this.client();
    const abo = await this.abonnementDe(compteId);
    if (!abo || abo.statut !== "en_attente") throw err("ERR_COMPTE_NON_EN_ATTENTE");
    const { data: profil } = await client
      .from("profils")
      .select("email, nom, langue")
      .eq("id", compteId)
      .maybeSingle();
    if (!profil) throw err("ERR_INTROUVABLE");
    const langue = profil.langue === "en" ? "en" : "fr";
    await client.from("profils").update({ motif_refus: motif }).eq("id", compteId);
    await client.from("abonnements").update({ statut: "annule" }).eq("id", abo.id);
    const variables = {
      nom: profil.nom,
      plan: abo.plan,
      date: new Date().toISOString().slice(0, 10),
      motif: libellerMotif(motif, langue),
    };
    const rendu = rendreAvis("inscription_refusee", variables, langue);
    const emailStatut = await this.envoyerEmailPlateforme(
      profil.email,
      rendu.sujet,
      rendu.corps,
      langue
    );
    await client.from("avis").insert({
      modele: "inscription_refusee",
      destinataire_id: compteId,
      destinataire_email: profil.email,
      variables,
      sujet: rendu.sujet,
      corps: rendu.corps,
      envoye_par: acteur.id,
      envoye_par_role: acteur.role,
      statut_envoi: emailStatut,
    });
    await this.journaliserAudit(acteur, "compte_refuse", "compte", compteId, profil.email, {
      motif,
      email_refus: emailStatut,
    });
  }

  async reattribuerGrille(compteId: string, grille: Grille): Promise<void> {
    const acteur = await this.acteurPlateforme();
    const client = this.client();
    // Correctif grille (2026-11-07) — LA BASE DÉCIDE (patron v1.4) :
    // la mutation passe par la RPC public.reattribuer_grille
    // (module-correctif-grille.sql), qui vérifie le rôle plateforme
    // en interne et lève des erreurs nommées. L'ancien chemin (deux
    // UPDATE directs dont le champ « error » n'était jamais lu)
    // avalait tout refus de la base en silence : la grille et le
    // drapeau « à vérifier » ne changeaient jamais, sans message.
    const { error: rpcError } = await client.rpc("reattribuer_grille", {
      cible: compteId,
      nouvelle_grille: grille,
    });
    if (rpcError) {
      if (rpcError.message.includes("ADMIN_PLATEFORME_REQUIS")) throw err("ERR_ACCES_PLATEFORME");
      if (rpcError.message.includes("COMPTE_INTROUVABLE")) throw err("ERR_INTROUVABLE");
      if (rpcError.message.includes("ABONNEMENT_INTROUVABLE")) throw err("ERR_INTROUVABLE");
      if (rpcError.message.includes("GRILLE_INVALIDE")) throw err("ERR_GRILLE_INVALIDE");
      throw new Error(rpcError.message);
    }
    const { data: profil } = await client
      .from("profils")
      .select("email")
      .eq("id", compteId)
      .maybeSingle();
    await this.journaliserAudit(acteur, "grille_reattribuee", "compte", compteId, profil?.email ?? null, {
      grille,
    });
  }

  async envoyerAvis(compteId: string, modele: ModeleAvis): Promise<Avis> {
    const acteur = await this.acteurPlateforme();
    const client = this.client();
    const { data: profil } = await client
      .from("profils")
      .select("email, nom, langue")
      .eq("id", compteId)
      .maybeSingle();
    if (!profil) throw err("ERR_INTROUVABLE");
    const abo = await this.abonnementDe(compteId);
    const variables = {
      nom: profil.nom,
      plan: abo?.plan ?? "pro",
      date: (abo?.trial_ends_at ?? abo?.fin_periode ?? new Date().toISOString()).slice(0, 10),
    };
    const rendu = rendreAvis(modele, variables, profil.langue === "en" ? "en" : "fr");
    const statut = await this.envoyerEmailPlateforme(profil.email, rendu.sujet, rendu.corps, profil.langue === "en" ? "en" : "fr");
    const { data, error } = await client
      .from("avis")
      .insert({
        modele,
        destinataire_id: compteId,
        destinataire_email: profil.email,
        variables,
        sujet: rendu.sujet,
        corps: rendu.corps,
        envoye_par: acteur.id,
        envoye_par_role: acteur.role,
        statut_envoi: statut,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await this.journaliserAudit(acteur, "avis_envoye", "compte", compteId, profil.email, {
      modele,
      statut_envoi: statut,
    });
    return data as Avis;
  }

  async listerAdmins(): Promise<CompteAdmin[]> {
    await this.acteurPlateforme();
    const { data, error } = await this.client()
      .from("profils")
      .select("id, email, nom, role, suspendu, created_at")
      .in("role", ["admin", "super_admin"])
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return ((data as Record<string, unknown>[] | null) ?? []).map((r) => ({
      id: r.id as string,
      email: r.email as string,
      nom: r.nom as string,
      role: r.role as "admin" | "super_admin",
      statut: r.suspendu ? ("suspendu" as const) : ("actif" as const),
      created_at: r.created_at as string,
    }));
  }

  async creerAdmin(_email: string, _nom: string): Promise<CompteAdmin> {
    await this.acteurSuperAdmin();
    // Un compte Auth ne se crée pas depuis le client : l'employé
    // s'inscrit normalement, puis le Super Admin le PROMEUT.
    throw err("ERR_PROMOTION_REQUISE");
  }

  async promouvoirAdmin(email: string): Promise<CompteAdmin> {
    const acteur = await this.acteurSuperAdmin();
    const client = this.client();
    const adresse = email.trim().toLowerCase();
    const { data: profil } = await client
      .from("profils")
      .select("id, email, nom, role, suspendu, created_at")
      .eq("email", adresse)
      .maybeSingle();
    if (!profil) throw err("ERR_INTROUVABLE");
    if (profil.role === "admin" || profil.role === "super_admin") {
      throw err("ERR_DEJA_ADMIN");
    }
    // v1.5 : conserver le rôle client d'origine pour un retrait fidèle
    // (retirer_role_admin / retirerRoleAdmin le restaurent).
    await client
      .from("profils")
      .update({ role: "admin", role_avant_admin: profil.role })
      .eq("id", profil.id);
    await this.journaliserAudit(acteur, "admin_promu", "admin", profil.id, profil.email);
    return {
      id: profil.id,
      email: profil.email,
      nom: profil.nom,
      role: "admin",
      statut: profil.suspendu ? "suspendu" : "actif",
      created_at: profil.created_at,
    };
  }

  async suspendreAdmin(adminId: string): Promise<void> {
    const acteur = await this.acteurSuperAdmin();
    const client = this.client();
    const { data: profil } = await client
      .from("profils")
      .select("email, role")
      .eq("id", adminId)
      .maybeSingle();
    if (!profil) throw err("ERR_INTROUVABLE");
    if (profil.role !== "admin") throw err("ERR_OPERATION_INTERDITE");
    await client.from("profils").update({ suspendu: true }).eq("id", adminId);
    await this.journaliserAudit(acteur, "admin_suspendu", "admin", adminId, profil.email);
  }

  async reactiverAdmin(adminId: string): Promise<void> {
    const acteur = await this.acteurSuperAdmin();
    const client = this.client();
    const { data: profil } = await client
      .from("profils")
      .select("email")
      .eq("id", adminId)
      .maybeSingle();
    if (!profil) throw err("ERR_INTROUVABLE");
    await client.from("profils").update({ suspendu: false }).eq("id", adminId);
    await this.journaliserAudit(acteur, "admin_reactive", "admin", adminId, profil.email);
  }

  /**
   * v1.2 (conservée) : retrait direct du rôle Admin. La voie v1.5 est
   * retirerRoleAdmin() (RPC base, restauration du rôle d'origine) —
   * les deux coexistent ; les nouveaux écrans utilisent la RPC.
   */
  async retirerAdmin(adminId: string): Promise<void> {
    const acteur = await this.acteurSuperAdmin();
    const client = this.client();
    const { data: profil } = await client
      .from("profils")
      .select("email, role")
      .eq("id", adminId)
      .maybeSingle();
    if (!profil) throw err("ERR_INTROUVABLE");
    if (profil.role !== "admin") throw err("ERR_OPERATION_INTERDITE");
    // Retirer = le compte redevient un propriétaire ordinaire.
    await client.from("profils").update({ role: "proprietaire" }).eq("id", adminId);
    await this.journaliserAudit(acteur, "admin_retire", "admin", adminId, profil.email);
  }

  async listerJournalAudit(): Promise<EntreeAudit[]> {
    await this.acteurPlateforme();
    const { data, error } = await this.client()
      .from("journal_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data as EntreeAudit[] | null) ?? [];
  }

  /** Résout e-mails/noms des profils référencés par les rattachements. */
  private async mapperRattachements(
    lignes: Record<string, unknown>[]
  ): Promise<RattachementGestionnaire[]> {
    const ids = new Set<string>();
    for (const l of lignes) {
      ids.add(l.gestionnaire_id as string);
      if (l.proprietaire_id) ids.add(l.proprietaire_id as string);
    }
    const parId = new Map<string, { email: string; nom: string; telephone: string | null }>();
    if (ids.size > 0) {
      const { data } = await this.client()
        .from("profils")
        .select("id, email, nom, telephone")
        .in("id", Array.from(ids));
      for (const p of (data as { id: string; email: string; nom: string; telephone: string | null }[] | null) ?? []) {
        parId.set(p.id, { email: p.email, nom: p.nom, telephone: p.telephone ?? null });
      }
    }
    return lignes.map((l) => ({
      id: l.id as string,
      gestionnaire_id: l.gestionnaire_id as string,
      gestionnaire_email: parId.get(l.gestionnaire_id as string)?.email ?? "",
      gestionnaire_nom: parId.get(l.gestionnaire_id as string)?.nom ?? null,
      gestionnaire_telephone: parId.get(l.gestionnaire_id as string)?.telephone ?? null,
      contexte: l.contexte as RattachementGestionnaire["contexte"],
      proprietaire_id: (l.proprietaire_id as string | null) ?? null,
      proprietaire_nom: l.proprietaire_id
        ? parId.get(l.proprietaire_id as string)?.nom ?? null
        : null,
      proprietaire_email: l.proprietaire_id
        ? parId.get(l.proprietaire_id as string)?.email ?? null
        : null,
      proprietaire_telephone: l.proprietaire_id
        ? parId.get(l.proprietaire_id as string)?.telephone ?? null
        : null,
      immeuble_ids: (l.immeuble_ids as string[] | null) ?? [],
      statut: l.statut as RattachementGestionnaire["statut"],
      created_at: l.created_at as string,
    }));
  }

  async listerRattachements(): Promise<RattachementGestionnaire[]> {
    await this.acteurPlateforme();
    const { data, error } = await this.client()
      .from("rattachements_gestionnaires")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return this.mapperRattachements((data as Record<string, unknown>[] | null) ?? []);
  }

  async creerRattachement(input: {
    gestionnaire_email: string;
    gestionnaire_nom?: string | null;
    contexte: "cizagroup" | "proprietaire";
    proprietaire_id?: string | null;
    immeuble_ids: string[];
  }): Promise<RattachementGestionnaire> {
    const acteur = await this.acteurPlateforme();
    const client = this.client();
    const adresse = input.gestionnaire_email.trim().toLowerCase();
    const { data: gestionnaire } = await client
      .from("profils")
      .select("id")
      .eq("email", adresse)
      .maybeSingle();
    if (!gestionnaire) throw err("ERR_INTROUVABLE");
    if (input.contexte === "proprietaire" && !input.proprietaire_id) {
      throw err("ERR_INTROUVABLE");
    }
    const { data, error } = await client
      .from("rattachements_gestionnaires")
      .insert({
        gestionnaire_id: gestionnaire.id,
        contexte: input.contexte,
        proprietaire_id: input.contexte === "proprietaire" ? input.proprietaire_id : null,
        immeuble_ids: input.immeuble_ids,
        statut: "actif",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await this.journaliserAudit(acteur, "rattachement_cree", "gestionnaire", data.id, adresse, {
      contexte: input.contexte,
    });
    const [mappe] = await this.mapperRattachements([data as Record<string, unknown>]);
    return mappe;
  }

  async retirerRattachement(id: string): Promise<void> {
    const acteur = await this.acteurPlateforme();
    const client = this.client();
    const { data: ligne } = await client
      .from("rattachements_gestionnaires")
      .select("id, gestionnaire_id")
      .eq("id", id)
      .maybeSingle();
    if (!ligne) throw err("ERR_INTROUVABLE");
    await client.from("rattachements_gestionnaires").delete().eq("id", id);
    await this.journaliserAudit(acteur, "rattachement_retire", "gestionnaire", id, null);
  }

  async listerMesRattachements(): Promise<RattachementGestionnaire[]> {
    const session = await this.getSession();
    if (!session) return [];
    const { data, error } = await this.client()
      .from("rattachements_gestionnaires")
      .select("*")
      .eq("gestionnaire_id", session.id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return this.mapperRattachements((data as Record<string, unknown>[] | null) ?? []);
  }

  async getContexteActif(): Promise<RattachementGestionnaire | null> {
    const miens = await this.listerMesRattachements();
    const actifs = miens.filter((r) => r.statut === "actif");
    if (actifs.length === 0) return null;
    let choisi: string | null = null;
    try {
      choisi = window.localStorage.getItem("cizaimmo-contexte-rattachement");
    } catch {
      choisi = null;
    }
    return actifs.find((r) => r.id === choisi) ?? actifs[0];
  }

  async definirContexteActif(rattachementId: string): Promise<RattachementGestionnaire> {
    const miens = await this.listerMesRattachements();
    const entree = miens.find((r) => r.id === rattachementId && r.statut === "actif");
    if (!entree) throw err("ERR_INTROUVABLE");
    try {
      window.localStorage.setItem("cizaimmo-contexte-rattachement", rattachementId);
    } catch {
      // Stockage indisponible : le contexte reste le premier actif.
    }
    return entree;
  }

  async ouvrirSupervision(rattachementId: string): Promise<SupervisionGestionnaire> {
    const acteur = await this.acteurPlateforme();
    const client = this.client();
    const { data: ligne } = await client
      .from("rattachements_gestionnaires")
      .select("*")
      .eq("id", rattachementId)
      .maybeSingle();
    if (!ligne) throw err("ERR_INTROUVABLE");
    const [rattachement] = await this.mapperRattachements([
      ligne as Record<string, unknown>,
    ]);
    // Ouverture JOURNALISÉE avant l'affichage des données.
    await this.journaliserAudit(
      acteur,
      "supervision_ouverte",
      "gestionnaire",
      rattachementId,
      rattachement.gestionnaire_email || null,
      { contexte: rattachement.contexte }
    );
    let immeubles: SupervisionGestionnaire["immeubles"] = [];
    if (rattachement.immeuble_ids.length > 0) {
      const { data: imms } = await client
        .from("immeubles")
        .select("id, nom, ville, devise")
        .in("id", rattachement.immeuble_ids);
      const { data: apts } = await client
        .from("appartements")
        .select("id, immeuble_id")
        .in("immeuble_id", rattachement.immeuble_ids);
      const aptParImmeuble = new Map<string, string[]>();
      for (const a of (apts as { id: string; immeuble_id: string }[] | null) ?? []) {
        const liste = aptParImmeuble.get(a.immeuble_id) ?? [];
        liste.push(a.id);
        aptParImmeuble.set(a.immeuble_id, liste);
      }
      const tousApts = (apts as { id: string }[] | null)?.map((a) => a.id) ?? [];
      const { data: baux } = tousApts.length
        ? await client
            .from("baux")
            .select("appartement_id, locataire_id")
            .eq("statut", "actif")
            .in("appartement_id", tousApts)
        : { data: [] };
      immeubles = ((imms as { id: string; nom: string; ville: string; devise: Immeuble["devise"] }[] | null) ?? []).map(
        (imm) => {
          const aptIds = aptParImmeuble.get(imm.id) ?? [];
          const locataires = new Set(
            ((baux as { appartement_id: string; locataire_id: string }[] | null) ?? [])
              .filter((b) => aptIds.includes(b.appartement_id))
              .map((b) => b.locataire_id)
          );
          return {
            id: imm.id,
            nom: imm.nom,
            ville: imm.ville,
            devise_principale: imm.devise,
            nb_appartements: aptIds.length,
            nb_locataires_actifs: locataires.size,
          };
        }
      );
    }
    return { rattachement, immeubles };
  }

  // --- Finances dynamiques -------------------------------------------------

  async getTarifsPlateforme(): Promise<TarifPlateforme[]> {
    // Lecture PUBLIQUE (anon) : le front public lit les prix ici.
    try {
      const { data, error } = await this.client()
        .from("tarifs_plateforme")
        .select("*")
        .order("grille", { ascending: true })
        .order("plan", { ascending: true });
      if (error || !data || data.length === 0) return TARIFS_SEED.map((t) => ({ ...t }));
      return (data as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        grille: r.grille as TarifPlateforme["grille"],
        plan: r.plan as TarifPlateforme["plan"],
        prix_mensuel: Number(r.prix_mensuel),
        devise: (r.devise as string) ?? "USD",
        updated_at: r.updated_at as string,
        updated_by: (r.updated_by as string | null) ?? null,
      }));
    } catch {
      return TARIFS_SEED.map((t) => ({ ...t }));
    }
  }

  async getParametresFinance(): Promise<ParametresFinance> {
    try {
      const { data, error } = await this.client()
        .from("parametres_finance")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error || !data) return { ...PARAMETRES_FINANCE_DEFAUT };
      const r = data as Record<string, unknown>;
      return {
        remise_annuelle_pct: Number(r.remise_annuelle_pct ?? 20),
        jours_essai: Number(r.jours_essai ?? 30),
        jours_grace: Number(r.jours_grace ?? 5),
        penalites_retard_actives: Boolean(r.penalites_retard_actives ?? false),
        pays_grille_afrique: Array.isArray(r.pays_grille_afrique)
          ? (r.pays_grille_afrique as string[])
          : [...PARAMETRES_FINANCE_DEFAUT.pays_grille_afrique],
        delai_approbation_affiche:
          (r.delai_approbation_affiche as string) ??
          PARAMETRES_FINANCE_DEFAUT.delai_approbation_affiche,
      };
    } catch {
      return { ...PARAMETRES_FINANCE_DEFAUT };
    }
  }

  async mettreAJourTarifs(
    tarifs: TarifPlateforme[],
    parametres: ParametresFinance
  ): Promise<void> {
    const acteur = await this.acteurSuperAdmin();
    const client = this.client();
    for (const t of tarifs) {
      if (!t || typeof t.prix_mensuel !== "number" || t.prix_mensuel <= 0) {
        throw err("ERR_PRIX_INVALIDE");
      }
    }
    const maintenant = new Date().toISOString();
    const { error: errTarifs } = await client.from("tarifs_plateforme").upsert(
      tarifs.map((t) => ({
        grille: t.grille,
        plan: t.plan,
        prix_mensuel: t.prix_mensuel,
        devise: "USD",
        updated_at: maintenant,
        updated_by: acteur.id,
      })),
      { onConflict: "grille,plan" }
    );
    if (errTarifs) throw new Error(errTarifs.message);
    const { error: errParams } = await client
      .from("parametres_finance")
      .update({
        remise_annuelle_pct: parametres.remise_annuelle_pct,
        jours_essai: parametres.jours_essai,
        jours_grace: parametres.jours_grace,
        penalites_retard_actives: parametres.penalites_retard_actives,
        pays_grille_afrique: (parametres.pays_grille_afrique ?? [])
          .map((c) => c.trim().toUpperCase())
          .filter((c) => /^[A-Z]{2}$/.test(c)),
        delai_approbation_affiche:
          parametres.delai_approbation_affiche?.trim() || "24 h ouvrées",
        updated_at: maintenant,
        updated_by: acteur.id,
      })
      .eq("id", 1);
    if (errParams) throw new Error(errParams.message);
    await this.journaliserAudit(acteur, "tarifs_modifies", "tarif", null, null, {
      tarifs: tarifs.map((t) => ({
        grille: t.grille,
        plan: t.plan,
        prix_mensuel: t.prix_mensuel,
      })),
    });
    await this.journaliserAudit(acteur, "parametres_modifies", "parametre", null, null, {
      parametres,
    });
  }

  // ==========================================================================
  // EXTENSION v1.3 — Dossiers vérifiés, contrat gestionnaire, rattachement
  // par Display ID (triple validation). Voir docs/parcours-inscription-v1.3.md
  // et supabase/module-v13.sql (table demandes_rattachement, RPC de
  // recherche par Display ID, politique « contrepartie »).
  // ==========================================================================

  /** Mappe une ligne demandes_rattachement (+ profils résolus) vers le type partagé. */
  private async mapperDemandes(
    lignes: Record<string, unknown>[]
  ): Promise<DemandeRattachement[]> {
    const ids = new Set<string>();
    for (const l of lignes) {
      ids.add(l.proprietaire_id as string);
      ids.add(l.gestionnaire_id as string);
    }
    const parId = new Map<string, { email: string; nom: string }>();
    if (ids.size > 0) {
      const { data } = await this.client()
        .from("profils")
        .select("id, email, nom")
        .in("id", Array.from(ids));
      for (const p of (data as { id: string; email: string; nom: string }[] | null) ?? []) {
        parId.set(p.id, { email: p.email, nom: p.nom });
      }
    }
    return lignes.map((l) => ({
      id: l.id as string,
      proprietaire_id: l.proprietaire_id as string,
      proprietaire_email: parId.get(l.proprietaire_id as string)?.email ?? "",
      proprietaire_nom: parId.get(l.proprietaire_id as string)?.nom ?? "",
      gestionnaire_id: l.gestionnaire_id as string,
      gestionnaire_email: parId.get(l.gestionnaire_id as string)?.email ?? "",
      gestionnaire_nom: parId.get(l.gestionnaire_id as string)?.nom ?? "",
      gestionnaire_display_id: l.gestionnaire_display_id as string,
      statut: l.statut as DemandeRattachement["statut"],
      created_at: l.created_at as string,
      repondu_le: (l.repondu_le as string | null) ?? null,
      valide_par: (l.valide_par as string | null) ?? null,
      valide_le: (l.valide_le as string | null) ?? null,
      rattachement_id: (l.rattachement_id as string | null) ?? null,
    }));
  }

  async soumettreDocumentCompte(
    type: "piece_identite" | "contrat",
    input: DocumentInput
  ): Promise<Document> {
    // Pas de garde « abonnement actif » : le dossier se complète PENDANT
    // l'attente d'approbation. La RLS borne l'écriture au titulaire
    // (owner_id = auth.uid()) et la lecture au titulaire + plateforme.
    const session = await this.requireSession();
    const nom = input.nom_fichier.trim();
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
    const client = this.client();
    const { data: doublon } = await client
      .from("documents")
      .select("id")
      .eq("entite_type", "compte")
      .eq("entite_id", session.id)
      .eq("type", type)
      .ilike("nom_fichier", nom)
      .limit(1);
    if (doublon && doublon.length > 0) throw err("ERR_DOCUMENT_DOUBLON");
    if (!input.contenu) throw err("ERR_DOCUMENT_FORMAT");
    const storagePath = `${session.id}/compte/${Date.now()}-${nom}`;
    const blob = await (await fetch(input.contenu)).blob();
    const { error: uploadError } = await client.storage
      .from("documents-prives")
      .upload(storagePath, blob, { contentType: input.mime_type ?? blob.type, upsert: false });
    if (uploadError) {
      if (/bucket not found/i.test(uploadError.message)) throw err("ERR_BUCKET_MANQUANT");
      throw new Error(uploadError.message);
    }
    const { data, error } = await client
      .from("documents")
      .insert({
        owner_id: session.id,
        type,
        entite_type: "compte",
        entite_id: session.id,
        nom_fichier: nom,
        storage_path: storagePath,
        taille_octets: input.taille_octets ?? blob.size,
        mime_type: input.mime_type ?? blob.type,
        ajoute_par: session.id,
      })
      .select()
      .single();
    if (error) {
      await client.storage.from("documents-prives").remove([storagePath]);
      throw new Error(error.message);
    }
    return data as Document;
  }

  async televerserPhotoProfil(input: DocumentInput): Promise<string> {
    const session = await this.requireSession();
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
    if (!input.contenu) throw err("ERR_DOCUMENT_FORMAT");
    const client = this.client();
    const storagePath = `${session.id}/profil/photo-${Date.now()}.${extension}`;
    const blob = await (await fetch(input.contenu)).blob();
    const { error: uploadError } = await client.storage
      .from("documents-prives")
      .upload(storagePath, blob, { contentType: input.mime_type ?? blob.type, upsert: false });
    if (uploadError) {
      if (/bucket not found/i.test(uploadError.message)) throw err("ERR_BUCKET_MANQUANT");
      throw new Error(uploadError.message);
    }
    const { error } = await client
      .from("profils")
      .update({ photo_profil_path: storagePath })
      .eq("id", session.id);
    if (error) throw new Error(error.message);
    return storagePath;
  }

  async listerDossier(compteId: string): Promise<DossierCompte> {
    await this.acteurPlateforme();
    const client = this.client();
    const comptes = await this.listerComptesPlateforme();
    const compte = comptes.find((c) => c.id === compteId);
    if (!compte) throw err("ERR_INTROUVABLE");
    const { data: profilRow } = await client
      .from("profils")
      .select("photo_profil_path")
      .eq("id", compteId)
      .maybeSingle();

    const { data: docsCompte } = await client
      .from("documents")
      .select("*")
      .eq("entite_type", "compte")
      .eq("entite_id", compteId)
      .order("created_at", { ascending: false });

    // v1.7 : les lignes immeubles portent aussi leurs photos (chemins
    // Storage) — les vignettes sont signées en un seul appel plus bas.
    type LigneImmeubleDossier = {
      id: string;
      nom: string;
      ville: string;
      adresse: string;
      photos?: string[] | null;
      photo_url?: string | null;
      origine_creation?: string | null;
      proprietaire_declare_nom?: string | null;
      proprietaire_declare_email?: string | null;
      proprietaire_concordance?: boolean | null;
      validation_statut?: string | null;
      validation_motif?: string | null;
    };
    const { data: immeublesRows } = await client
      .from("immeubles")
      .select(
        "id, nom, ville, adresse, photos, photo_url, origine_creation, proprietaire_declare_nom, proprietaire_declare_email, proprietaire_concordance, validation_statut, validation_motif"
      )
      .eq("owner_id", compteId);
    const lignesPossedees = (immeublesRows as LigneImmeubleDossier[] | null) ?? [];
    const idsPossedes = lignesPossedees.map((i) => i.id);

    let preuvesPropriete: Document[] = [];
    if (idsPossedes.length > 0) {
      const { data } = await client
        .from("documents")
        .select("*")
        .eq("entite_type", "immeuble")
        .eq("type", "justificatif")
        .in("entite_id", idsPossedes)
        .order("created_at", { ascending: false });
      preuvesPropriete = (data as Document[] | null) ?? [];
    }

    const { data: rattRows } = await client
      .from("rattachements_gestionnaires")
      .select("*")
      .or(`proprietaire_id.eq.${compteId},gestionnaire_id.eq.${compteId}`);
    const rattachements = await this.mapperRattachements(
      (rattRows as Record<string, unknown>[] | null) ?? []
    );
    const commeProprietaire = rattachements.filter((r) => r.proprietaire_id === compteId);
    const commeGestionnaire = rattachements.filter((r) => r.gestionnaire_id === compteId);

    const { data: demandeRows } = await client
      .from("demandes_rattachement")
      .select("*")
      .or(`proprietaire_id.eq.${compteId},gestionnaire_id.eq.${compteId}`)
      .order("created_at", { ascending: false });
    const demandes = await this.mapperDemandes(
      (demandeRows as Record<string, unknown>[] | null) ?? []
    );

    const idsGeres = Array.from(new Set(commeGestionnaire.flatMap((r) => r.immeuble_ids)));
    let lignesGerees: LigneImmeubleDossier[] = [];
    if (idsGeres.length > 0) {
      const { data } = await client
        .from("immeubles")
        .select("id, nom, ville, adresse, photos, photo_url")
        .in("id", idsGeres);
      lignesGerees = (data as LigneImmeubleDossier[] | null) ?? [];
    }

    let annonces: { id: string; immeuble_nom: string; numero: string }[] = [];
    if (idsPossedes.length > 0) {
      const { data } = await client
        .from("appartements")
        .select("id, numero, immeuble_id")
        .eq("vitrine", true)
        .in("immeuble_id", idsPossedes);
      const nomParId = new Map(lignesPossedees.map((i) => [i.id, i.nom]));
      annonces = ((data as { id: string; numero: string; immeuble_id: string }[] | null) ?? []).map(
        (a) => ({ id: a.id, immeuble_nom: nomParId.get(a.immeuble_id) ?? "", numero: a.numero })
      );
    }

    // v1.7 : vignettes du dossier — la photo principale de chaque
    // immeuble (possédé, géré ou en revue) est signée en UN appel.
    const lignesRevue = lignesPossedees.filter(
      (i) => i.origine_creation === "gestionnaire"
    );
    const cheminsVignettes = Array.from(
      new Set(
        [...lignesPossedees, ...lignesGerees]
          .map((i) => (Array.isArray(i.photos) ? i.photos[0] : undefined))
          .filter((p): p is string => Boolean(p))
      )
    );
    const vignettes = new Map<string, string>();
    if (cheminsVignettes.length > 0) {
      const { data: signes } = await client.storage
        .from("documents-prives")
        .createSignedUrls(cheminsVignettes, 3600);
      (signes ?? []).forEach((s, idx) => {
        if (s?.signedUrl) vignettes.set(cheminsVignettes[idx], s.signedUrl);
      });
    }
    const avecVignette = (i: LigneImmeubleDossier) => ({
      id: i.id,
      nom: i.nom,
      ville: i.ville,
      adresse: i.adresse,
      photo_url:
        (Array.isArray(i.photos) && i.photos[0]
          ? vignettes.get(i.photos[0])
          : undefined) ??
        i.photo_url ??
        null,
    });
    const immeublesPossedes = lignesPossedees.map(avecVignette);
    const immeublesGeres = lignesGerees.map(avecVignette);

    // v1.7 : revue plateforme des immeubles créés par ce gestionnaire
    // — autorisation de gestion la plus récente jointe à chaque bien.
    let immeublesEnRevue: RevueImmeubleGestion[] = [];
    if (lignesRevue.length > 0) {
      const { data: docsAutorisation } = await client
        .from("documents")
        .select("*")
        .eq("entite_type", "immeuble")
        .eq("type", "autorisation")
        .in("entite_id", lignesRevue.map((i) => i.id))
        .order("created_at", { ascending: false });
      const autorisationParImmeuble = new Map<string, Document>();
      for (const d of (docsAutorisation as Document[] | null) ?? []) {
        if (!autorisationParImmeuble.has(d.entite_id)) {
          autorisationParImmeuble.set(d.entite_id, d);
        }
      }
      immeublesEnRevue = lignesRevue.map((i) => ({
        ...avecVignette(i),
        proprietaire_declare_nom: i.proprietaire_declare_nom ?? null,
        proprietaire_declare_email: i.proprietaire_declare_email ?? null,
        proprietaire_concordance: Boolean(i.proprietaire_concordance ?? false),
        validation_statut:
          (i.validation_statut as RevueImmeubleGestion["validation_statut"] | null) ??
          "valide",
        validation_motif: i.validation_motif ?? null,
        autorisation: autorisationParImmeuble.get(i.id) ?? null,
      }));
    }

    const { data: auditRows } = await client
      .from("journal_audit")
      .select("*")
      .or(`cible_id.eq.${compteId},cible_email.eq.${compte.email}`)
      .order("created_at", { ascending: false })
      .limit(50);

    // Checklist de vérification : la consignation la plus récente
    // fait foi pour l'état courant (qui a coché, quand).
    let checklist: ChecklistDossier | null = null;
    const { data: checklistRows } = await client
      .from("dossier_checklists")
      .select("*")
      .eq("cible_id", compteId)
      .order("created_at", { ascending: false })
      .limit(1);
    const checklistRow = (checklistRows as Record<string, unknown>[] | null)?.[0];
    if (checklistRow) {
      const { data: acteurRow } = await client
        .from("profils")
        .select("nom, email")
        .eq("id", checklistRow.acteur_id as string)
        .maybeSingle();
      checklist = {
        photo_verifiee: Boolean(checklistRow.photo_verifiee),
        piece_coherente: Boolean(checklistRow.piece_coherente),
        infos_verifiees: Boolean(checklistRow.infos_verifiees),
        antifraude_examinee: Boolean(checklistRow.antifraude_examinee),
        acteur_nom: (acteurRow?.nom as string | undefined) ?? null,
        acteur_email: (acteurRow?.email as string | undefined) ?? null,
        updated_at: (checklistRow.created_at as string | undefined) ?? null,
      };
    }

    // Photo de profil : lien signé (1 h) pour l'afficher dans le
    // dossier — la politique Storage « select plateforme » autorise
    // l'Admin à lire les fichiers clients du bucket privé. Un échec
    // de signature ne bloque jamais le dossier (url null).
    const photoPath = profilRow?.photo_profil_path ?? null;
    let photoProfilUrl: string | null = null;
    if (photoPath) {
      const { data: signePhoto } = await client.storage
        .from("documents-prives")
        .createSignedUrl(photoPath, 3600);
      photoProfilUrl = signePhoto?.signedUrl ?? null;
    }

    return {
      compte,
      checklist,
      photo_profil_path: photoPath,
      photo_profil_url: photoProfilUrl,
      documents_compte: (docsCompte as Document[] | null) ?? [],
      preuves_propriete: preuvesPropriete,
      rattachements_comme_proprietaire: commeProprietaire,
      rattachements_comme_gestionnaire: commeGestionnaire,
      demandes,
      immeubles_possedes: immeublesPossedes,
      immeubles_geres: immeublesGeres,
      immeubles_en_revue: immeublesEnRevue,
      annonces,
      audit: (auditRows as EntreeAudit[] | null) ?? [],
    };
  }

  async rechercherCompteParDisplayId(
    displayId: string
  ): Promise<{ nom: string; display_id: string } | null> {
    await this.requireSession();
    // RPC security definer (module-v13.sql) : ne retourne que l'id
    // technique, le nom et le Display ID d'un compte « gestionnaire ».
    const { data, error } = await this.client().rpc(
      "rechercher_gestionnaire_par_display_id",
      { p_display_id: displayId.trim().toUpperCase() }
    );
    if (error) throw new Error(error.message);
    const ligne = (data as { id: string; nom: string; display_id: string }[] | null)?.[0];
    if (!ligne) return null;
    // L'écran de confirmation n'expose QUE le nom + le Display ID.
    return { nom: ligne.nom, display_id: ligne.display_id };
  }

  async demanderRattachementParDisplayId(
    displayId: string
  ): Promise<DemandeRattachement> {
    const session = await this.requireSession();
    const client = this.client();
    const { data: rpcData, error: rpcError } = await client.rpc(
      "rechercher_gestionnaire_par_display_id",
      { p_display_id: displayId.trim().toUpperCase() }
    );
    if (rpcError) throw new Error(rpcError.message);
    const gestionnaire = (rpcData as { id: string; nom: string; display_id: string }[] | null)?.[0];
    if (!gestionnaire || gestionnaire.id === session.id) throw err("ERR_INTROUVABLE");
    const { data: existante } = await client
      .from("demandes_rattachement")
      .select("id")
      .eq("proprietaire_id", session.id)
      .eq("gestionnaire_id", gestionnaire.id)
      .neq("statut", "refuse")
      .limit(1);
    if (existante && existante.length > 0) throw err("ERR_DEMANDE_EXISTANTE");
    const { data, error } = await client
      .from("demandes_rattachement")
      .insert({
        proprietaire_id: session.id,
        gestionnaire_id: gestionnaire.id,
        gestionnaire_display_id: gestionnaire.display_id,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const [mappee] = await this.mapperDemandes([data as Record<string, unknown>]);
    return mappee;
  }

  async listerDemandesRattachement(): Promise<DemandeRattachement[]> {
    const session = await this.getSession();
    if (!session) return [];
    const profil = await this.getProfil();
    const client = this.client();
    let requete = client
      .from("demandes_rattachement")
      .select("*")
      .order("created_at", { ascending: false });
    if (profil?.role !== "admin" && profil?.role !== "super_admin") {
      requete = requete.or(
        `proprietaire_id.eq.${session.id},gestionnaire_id.eq.${session.id}`
      );
    }
    const { data, error } = await requete;
    if (error) throw new Error(error.message);
    const demandes = await this.mapperDemandes(
      (data as Record<string, unknown>[] | null) ?? []
    );
    // Immeubles assignés des rattachements liés (écran d'assignation).
    const rattachementIds = demandes
      .map((d) => d.rattachement_id)
      .filter((id): id is string => Boolean(id));
    if (rattachementIds.length > 0) {
      const { data: rattachements } = await this.client()
        .from("rattachements_gestionnaires")
        .select("id, immeuble_ids")
        .in("id", rattachementIds);
      const parId = new Map(
        ((rattachements as { id: string; immeuble_ids: string[] }[] | null) ?? []).map(
          (r) => [r.id, r.immeuble_ids ?? []] as const
        )
      );
      for (const d of demandes) {
        if (d.rattachement_id) {
          d.rattachement_immeuble_ids = parId.get(d.rattachement_id) ?? [];
        }
      }
    }
    return demandes;
  }

  async repondreDemandeRattachement(
    demandeId: string,
    accepter: boolean
  ): Promise<DemandeRattachement> {
    const session = await this.requireSession();
    const client = this.client();
    const { data: demande } = await client
      .from("demandes_rattachement")
      .select("*")
      .eq("id", demandeId)
      .maybeSingle();
    if (!demande || demande.gestionnaire_id !== session.id) {
      throw err("ERR_INTROUVABLE");
    }
    if (demande.statut !== "en_attente_gestionnaire") {
      throw err("ERR_STATUT_INVALIDE");
    }
    if (accepter) {
      // Verrou contrat : accepter exige un contrat VALIDÉ.
      const profil = await this.getProfil();
      if (profil?.statut_contrat !== "valide") throw err("ERR_CONTRAT_NON_VALIDE");
    }
    const { data, error } = await client
      .from("demandes_rattachement")
      .update({
        statut: accepter ? "en_attente_admin" : "refuse",
        repondu_le: new Date().toISOString(),
      })
      .eq("id", demandeId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const [mappee] = await this.mapperDemandes([data as Record<string, unknown>]);
    return mappee;
  }

  async validerRattachementAdmin(
    demandeId: string,
    accepter: boolean
  ): Promise<DemandeRattachement> {
    const acteur = await this.acteurPlateforme();
    const client = this.client();
    const { data: demande } = await client
      .from("demandes_rattachement")
      .select("*")
      .eq("id", demandeId)
      .maybeSingle();
    if (!demande) throw err("ERR_INTROUVABLE");
    if (demande.statut !== "en_attente_admin") throw err("ERR_STATUT_INVALIDE");
    let rattachementId: string | null = null;
    if (accepter) {
      const { data: rattachement, error: errRatt } = await client
        .from("rattachements_gestionnaires")
        .insert({
          gestionnaire_id: demande.gestionnaire_id,
          contexte: "proprietaire",
          proprietaire_id: demande.proprietaire_id,
          // AUCUN immeuble à la création : l'assignation est le geste
          // du propriétaire (mécanisme existant, immeuble_ids).
          immeuble_ids: [],
          statut: "actif",
        })
        .select()
        .single();
      if (errRatt) throw new Error(errRatt.message);
      rattachementId = rattachement.id as string;
    }
    const { data, error } = await client
      .from("demandes_rattachement")
      .update({
        statut: accepter ? "actif" : "refuse",
        valide_par: acteur.id,
        valide_le: new Date().toISOString(),
        rattachement_id: rattachementId,
      })
      .eq("id", demandeId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const [mappee] = await this.mapperDemandes([data as Record<string, unknown>]);
    await this.journaliserAudit(
      acteur,
      accepter ? "rattachement_valide" : "rattachement_refuse",
      "gestionnaire",
      demande.gestionnaire_id,
      mappee.gestionnaire_email || null,
      { demande_id: demandeId, proprietaire: mappee.proprietaire_email }
    );
    return mappee;
  }

  async assignerImmeublesRattachement(
    rattachementId: string,
    immeubleIds: string[]
  ): Promise<RattachementGestionnaire> {
    const session = await this.requireSession();
    const client = this.client();
    const { data: rattachement } = await client
      .from("rattachements_gestionnaires")
      .select("*")
      .eq("id", rattachementId)
      .eq("proprietaire_id", session.id)
      .eq("statut", "actif")
      .maybeSingle();
    if (!rattachement) throw err("ERR_INTROUVABLE");
    // Seuls les immeubles du propriétaire peuvent être assignés.
    let valides: string[] = [];
    if (immeubleIds.length > 0) {
      const { data } = await client
        .from("immeubles")
        .select("id")
        .eq("owner_id", session.id)
        .in("id", immeubleIds);
      valides = ((data as { id: string }[] | null) ?? []).map((i) => i.id);
    }
    const { data, error } = await client
      .from("rattachements_gestionnaires")
      .update({ immeuble_ids: valides })
      .eq("id", rattachementId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    const [mappe] = await this.mapperRattachements([data as Record<string, unknown>]);
    return mappe;
  }

  async genererContratGestionnaire(
    compteId: string
  ): Promise<{ nomFichier: string; contenuBase64: string }> {
    const session = await this.requireSession();
    if (compteId !== session.id) await this.acteurPlateforme();
    const { data: profil } = await this.client()
      .from("profils")
      .select("nom, email, telephone, pays, langue, display_id")
      .eq("id", compteId)
      .maybeSingle();
    if (!profil || !profil.display_id) throw err("ERR_INTROUVABLE");
    return genererContratGestionnairePdf({
      nom: profil.nom,
      displayId: profil.display_id,
      email: profil.email,
      telephone: profil.telephone ?? null,
      pays: profil.pays ?? null,
      langue: profil.langue === "en" ? "en" : "fr",
      date: new Date().toISOString().slice(0, 10),
    });
  }

  async getMonContrat(): Promise<{
    statut: StatutContrat;
    display_id: string | null;
    nomFichier: string;
    contenuBase64: string | null;
  }> {
    const profil = await this.getProfil();
    if (!profil) throw err("ERR_NOT_FOUND");
    if (!profil.display_id) {
      return {
        statut: profil.statut_contrat ?? "sans_objet",
        display_id: null,
        nomFichier: "",
        contenuBase64: null,
      };
    }
    const pdf = await genererContratGestionnairePdf({
      nom: profil.nom,
      displayId: profil.display_id,
      email: profil.email,
      telephone: profil.telephone ?? null,
      pays: profil.pays ?? null,
      langue: profil.langue === "en" ? "en" : "fr",
      date: new Date().toISOString().slice(0, 10),
    });
    return {
      statut: profil.statut_contrat ?? "sans_objet",
      display_id: profil.display_id,
      nomFichier: pdf.nomFichier,
      contenuBase64: pdf.contenuBase64,
    };
  }

  async televerserContratSigne(input: DocumentInput): Promise<Document> {
    const document = await this.soumettreDocumentCompte("contrat", input);
    const profil = await this.getProfil();
    if (
      profil &&
      profil.type_intention === "gestionnaire" &&
      profil.statut_contrat === "a_signer"
    ) {
      await this.client()
        .from("profils")
        .update({ statut_contrat: "signe_recu" })
        .eq("id", profil.id);
    }
    return document;
  }

  async validerContrat(compteId: string): Promise<void> {
    const acteur = await this.acteurPlateforme();
    const client = this.client();
    const { data: profil } = await client
      .from("profils")
      .select("email, nom, langue, display_id, statut_contrat")
      .eq("id", compteId)
      .maybeSingle();
    if (!profil) throw err("ERR_INTROUVABLE");
    if (profil.statut_contrat !== "signe_recu") throw err("ERR_STATUT_INVALIDE");
    await client
      .from("profils")
      .update({ statut_contrat: "valide" })
      .eq("id", compteId);
    const langue = profil.langue === "en" ? "en" : "fr";
    const activation = rendreActivationGestionnaire(
      profil.nom,
      profil.display_id ?? "",
      langue
    );
    const emailStatut = await this.envoyerEmailPlateforme(
      profil.email,
      activation.sujet,
      activation.corps,
      langue
    );
    await this.journaliserAudit(acteur, "contrat_valide", "compte", compteId, profil.email, {
      display_id: profil.display_id,
      email_activation: emailStatut,
    });
  }

  // ==========================================================================
  // OPTION C (2026-11-08) — Contrat de service PROPRIÉTAIRE non
  // bloquant. Même patron que le flux gestionnaire ci-dessus, cycle
  // propre (profils.statut_contrat_proprietaire) : aucun état ne
  // conditionne l'accès ni l'essai. Rétroactivité : les comptes déjà
  // approuvés ont été basculés « a_signer » par le SQL
  // (module-contrat-proprietaire.sql) — leur contrat est donc
  // disponible ici sans aucun e-mail de rattrapage.
  // ==========================================================================

  async genererContratProprietaire(
    compteId: string
  ): Promise<{ nomFichier: string; contenuBase64: string }> {
    const session = await this.requireSession();
    if (compteId !== session.id) await this.acteurPlateforme();
    const { data: profil } = await this.client()
      .from("profils")
      .select("nom, email, telephone, pays, langue, display_id")
      .eq("id", compteId)
      .maybeSingle();
    if (!profil || !profil.display_id) throw err("ERR_INTROUVABLE");
    return genererContratProprietairePdf({
      nom: profil.nom,
      displayId: profil.display_id,
      email: profil.email,
      telephone: profil.telephone ?? null,
      pays: profil.pays ?? null,
      langue: profil.langue === "en" ? "en" : "fr",
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
    const profil = await this.getProfil();
    if (!profil) throw err("ERR_NOT_FOUND");
    if (!profil.display_id) {
      return {
        statut: profil.statut_contrat_proprietaire ?? "sans_objet",
        motif: profil.motif_contrat_proprietaire ?? null,
        display_id: null,
        nomFichier: "",
        contenuBase64: null,
      };
    }
    const pdf = await genererContratProprietairePdf({
      nom: profil.nom,
      displayId: profil.display_id,
      email: profil.email,
      telephone: profil.telephone ?? null,
      pays: profil.pays ?? null,
      langue: profil.langue === "en" ? "en" : "fr",
      date: new Date().toISOString().slice(0, 10),
    });
    return {
      statut: profil.statut_contrat_proprietaire ?? "sans_objet",
      motif: profil.motif_contrat_proprietaire ?? null,
      display_id: profil.display_id,
      nomFichier: pdf.nomFichier,
      contenuBase64: pdf.contenuBase64,
    };
  }

  async televerserContratProprietaireSigne(input: DocumentInput): Promise<Document> {
    const document = await this.soumettreDocumentCompte("contrat", input);
    const profil = await this.getProfil();
    if (
      profil &&
      profil.type_intention === "proprietaire" &&
      (profil.statut_contrat_proprietaire === "a_signer" ||
        profil.statut_contrat_proprietaire === "refuse")
    ) {
      await this.client()
        .from("profils")
        .update({ statut_contrat_proprietaire: "signe_depose", motif_contrat_proprietaire: null })
        .eq("id", profil.id);
    }
    return document;
  }

  async validerContratProprietaire(compteId: string): Promise<void> {
    const acteur = await this.acteurPlateforme();
    const client = this.client();
    const { data: profil } = await client
      .from("profils")
      .select("email, nom, langue, display_id, statut_contrat_proprietaire")
      .eq("id", compteId)
      .maybeSingle();
    if (!profil) throw err("ERR_INTROUVABLE");
    if (profil.statut_contrat_proprietaire !== "signe_depose") throw err("ERR_STATUT_INVALIDE");
    await client
      .from("profils")
      .update({ statut_contrat_proprietaire: "valide", motif_contrat_proprietaire: null })
      .eq("id", compteId);
    const langue = profil.langue === "en" ? "en" : "fr";
    const validation = rendreValidationContratProprietaire(profil.nom, langue);
    const emailStatut = await this.envoyerEmailPlateforme(
      profil.email,
      validation.sujet,
      validation.corps,
      langue
    );
    await this.journaliserAudit(acteur, "contrat_proprietaire_valide", "compte", compteId, profil.email, {
      display_id: profil.display_id,
      email_validation: emailStatut,
    });
  }

  async refuserContratProprietaire(compteId: string, motif: string): Promise<void> {
    const acteur = await this.acteurPlateforme();
    const motifNet = (motif ?? "").trim();
    if (!motifNet) throw err("ERR_MOTIF_REQUIS");
    const client = this.client();
    const { data: profil } = await client
      .from("profils")
      .select("email, nom, langue, display_id, statut_contrat_proprietaire")
      .eq("id", compteId)
      .maybeSingle();
    if (!profil) throw err("ERR_INTROUVABLE");
    if (profil.statut_contrat_proprietaire !== "signe_depose") throw err("ERR_STATUT_INVALIDE");
    await client
      .from("profils")
      .update({ statut_contrat_proprietaire: "refuse", motif_contrat_proprietaire: motifNet })
      .eq("id", compteId);
    const langue = profil.langue === "en" ? "en" : "fr";
    const refus = rendreRefusContratProprietaire(profil.nom, motifNet, langue);
    const emailStatut = await this.envoyerEmailPlateforme(
      profil.email,
      refus.sujet,
      refus.corps,
      langue
    );
    await this.journaliserAudit(acteur, "contrat_proprietaire_refuse", "compte", compteId, profil.email, {
      display_id: profil.display_id,
      motif: motifNet,
      email_refus: emailStatut,
    });
  }

  // ==========================================================================
  // EXTENSION v1.5 — Suppression de compte par le client, messagerie
  // directe supervisée, assignation des dossiers, page Équipe et espace
  // « Mes dossiers ». Voir docs/messagerie-suppression-v15.md et
  // supabase/module-v15.sql. Principe : LA BASE DÉCIDE — les transitions
  // sensibles sont des RPC SECURITY DEFINER qui journalisent ELLES-MÊMES
  // dans journal_audit ; l'app n'ajoute donc AUCUN audit en double pour
  // demande / annulation / exécution / assignation / accès / retrait /
  // consultation (appel RPC simple, erreurs SQL mappées par erreurRpcV15).
  // ==========================================================================

  // --- Suppression de compte par le client --------------------------------

  async demanderSuppressionCompte(motDePasse: string): Promise<Profil> {
    const session = await this.requireSession();
    // Renfort fondateur (2026-11-07) : ré-authentification par mot de
    // passe AVANT tout appel à la RPC de suppression. signInWithPassword
    // avec l'e-mail de la session = vérification par Supabase Auth (la
    // session reste celle du même utilisateur). Mot de passe faux ou
    // vide → ERR_MOT_DE_PASSE_INCORRECT et AUCUN changement d'état.
    if (!motDePasse) throw err("ERR_MOT_DE_PASSE_INCORRECT");
    const { error: erreurAuth } = await this.client().auth.signInWithPassword({
      email: session.email,
      password: motDePasse
    });
    if (erreurAuth) throw err("ERR_MOT_DE_PASSE_INCORRECT");
    const { error } = await this.client().rpc("demander_suppression_compte");
    if (error) throw erreurRpcV15(error);
    const profil = await this.getProfil();
    if (!profil) throw err("ERR_NOT_FOUND");
    return profil;
  }

  async annulerSuppressionCompte(): Promise<Profil> {
    await this.requireSession();
    const { error } = await this.client().rpc("annuler_suppression_compte");
    if (error) throw erreurRpcV15(error);
    const profil = await this.getProfil();
    if (!profil) throw err("ERR_NOT_FOUND");
    return profil;
  }

  async listerSuppressionsEnAttente(): Promise<SuppressionEnAttente[]> {
    await this.acteurPlateforme();
    const { data, error } = await this.client()
      .from("profils")
      .select("id, email, nom, display_id, suppression_demandee_le")
      .not("suppression_demandee_le", "is", null)
      .order("suppression_demandee_le", { ascending: true });
    if (error) throw new Error(error.message);
    const maintenant = Date.now();
    return (
      (data as {
        id: string;
        email: string;
        nom: string;
        display_id: string | null;
        suppression_demandee_le: string;
      }[] | null) ?? []
    ).map((p) => {
      // Échéance = demande + 30 jours (délai de rétractation).
      const echeance = ajouterJours(p.suppression_demandee_le, 30);
      return {
        compte_id: p.id,
        email: p.email,
        nom: p.nom,
        display_id: p.display_id ?? null,
        suppression_demandee_le: p.suppression_demandee_le,
        echeance_le: echeance,
        executable: maintenant >= new Date(echeance).getTime(),
      };
    });
  }

  async executerSuppressionCompte(compteId: string): Promise<void> {
    // Audit en base par la RPC — aucun journaliserAudit côté app.
    const { error } = await this.client().rpc("executer_suppression_compte", {
      cible: compteId,
    });
    if (error) throw erreurRpcV15(error);
  }

  // --- Messagerie directe : helpers d'enrichissement -----------------------

  /** Jointure manuelle des profils (patron mapperRattachements). */
  private async profilsAffichage(
    ids: string[]
  ): Promise<
    Map<string, { nom: string; email: string; display_id: string | null }>
  > {
    const parId = new Map<
      string,
      { nom: string; email: string; display_id: string | null }
    >();
    const uniques = Array.from(new Set(ids.filter(Boolean)));
    if (uniques.length === 0) return parId;
    const { data } = await this.client()
      .from("profils")
      .select("id, nom, email, display_id")
      .in("id", uniques);
    for (const p of (data as {
      id: string;
      nom: string;
      email: string;
      display_id: string | null;
    }[] | null) ?? []) {
      parId.set(p.id, {
        nom: p.nom,
        email: p.email,
        display_id: p.display_id ?? null,
      });
    }
    return parId;
  }

  /**
   * Enrichit des fils : noms / Display ID des participants, dernier
   * message et non-lus POUR L'ACTEUR (batch messages groupés en
   * mémoire). Supervision (plateforme sur un fil rattachement) :
   * non_lus forcé à 0 — la plateforme lit, elle n'est pas destinataire.
   */
  private async enrichirConversations(
    lignes: LigneConversation[],
    acteurId: string,
    acteurEstPlateforme: boolean,
    nonLusDepuisClient = false
  ): Promise<Conversation[]> {
    if (lignes.length === 0) return [];
    const idsProfils: string[] = [];
    for (const l of lignes) {
      idsProfils.push(l.proprietaire_id);
      if (l.gestionnaire_id) idsProfils.push(l.gestionnaire_id);
      if (l.admin_responsable_id) idsProfils.push(l.admin_responsable_id);
    }
    const parId = await this.profilsAffichage(idsProfils);
    const { data: messagesData } = await this.client()
      .from("messages_directs")
      .select("*")
      .in(
        "conversation_id",
        lignes.map((l) => l.id)
      )
      .order("created_at", { ascending: true });
    const parConversation = new Map<string, LigneMessage[]>();
    for (const m of (messagesData as LigneMessage[] | null) ?? []) {
      const liste = parConversation.get(m.conversation_id) ?? [];
      liste.push(m);
      parConversation.set(m.conversation_id, liste);
    }
    return lignes.map((l) => {
      const liste = parConversation.get(l.id) ?? [];
      const dernier = liste.length > 0 ? liste[liste.length - 1] : null;
      let nonLus = 0;
      if (l.type === "rattachement" && acteurEstPlateforme) {
        nonLus = 0;
      } else if (nonLusDepuisClient) {
        // Boîte de réception plateforme : seuls les messages DU
        // CLIENT comptent (expéditeur = proprietaire_id du fil) —
        // jamais ceux d'un autre membre de l'équipe plateforme.
        nonLus = liste.filter(
          (m) => m.expediteur_id === l.proprietaire_id && !m.lu_par_plateforme
        ).length;
      } else if (
        acteurId === l.proprietaire_id ||
        acteurId === l.gestionnaire_id
      ) {
        nonLus = liste.filter(
          (m) => m.expediteur_id !== acteurId && !m.lu_par_client
        ).length;
      } else {
        nonLus = liste.filter(
          (m) => m.expediteur_id !== acteurId && !m.lu_par_plateforme
        ).length;
      }
      const proprietaire = parId.get(l.proprietaire_id);
      const gestionnaire = l.gestionnaire_id
        ? parId.get(l.gestionnaire_id)
        : undefined;
      const responsable = l.admin_responsable_id
        ? parId.get(l.admin_responsable_id)
        : undefined;
      return {
        id: l.id,
        type: l.type,
        proprietaire_id: l.proprietaire_id,
        gestionnaire_id: l.gestionnaire_id ?? null,
        rattachement_id: l.rattachement_id ?? null,
        admin_responsable_id: l.admin_responsable_id ?? null,
        created_at: l.created_at,
        proprietaire_nom: proprietaire?.nom,
        proprietaire_email: proprietaire?.email,
        proprietaire_display_id: proprietaire?.display_id ?? null,
        gestionnaire_nom: gestionnaire?.nom ?? null,
        gestionnaire_display_id: gestionnaire?.display_id ?? null,
        admin_responsable_nom: responsable?.nom ?? null,
        dernier_message: dernier?.corps ?? null,
        dernier_message_le: dernier?.created_at ?? null,
        non_lus: nonLus,
      };
    });
  }

  /** Charge un fil visible par l'acteur (RLS) ; null si invisible. */
  private async chargerConversation(
    conversationId: string
  ): Promise<LigneConversation | null> {
    const { data, error } = await this.client()
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as LigneConversation | null) ?? null;
  }

  private estPlateforme(profil: Profil | null): boolean {
    return profil?.role === "admin" || profil?.role === "super_admin";
  }

  // --- Messagerie directe ---------------------------------------------------

  async listerConversations(): Promise<Conversation[]> {
    const session = await this.getSession();
    if (!session) return [];
    const profil = await this.getProfil();
    // La RLS borne déjà les fils visibles (participants + plateforme).
    const { data, error } = await this.client()
      .from("conversations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return this.enrichirConversations(
      (data as LigneConversation[] | null) ?? [],
      session.id,
      this.estPlateforme(profil)
    );
  }

  async getConversationPlateforme(compteId?: string): Promise<Conversation> {
    const session = await this.requireSession();
    const profil = await this.getProfil();
    const acteurEstPlateforme = this.estPlateforme(profil);
    // Cible : le client désigné pour la plateforme, soi-même pour un client.
    let cible: string;
    if (acteurEstPlateforme) {
      if (!compteId) throw err("ERR_CONVERSATION_INTROUVABLE");
      cible = compteId;
    } else {
      cible = session.id;
    }
    const client = this.client();
    const { data: existante, error } = await client
      .from("conversations")
      .select("*")
      .eq("type", "plateforme")
      .eq("proprietaire_id", cible)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (existante) {
      const [conv] = await this.enrichirConversations(
        [existante as LigneConversation],
        session.id,
        acteurEstPlateforme
      );
      return conv;
    }
    // Création au premier accès : routage = Admin responsable du client
    // (relu sur SON profil au moment de la création).
    const { data: profilClient } = await client
      .from("profils")
      .select("admin_responsable_id")
      .eq("id", cible)
      .maybeSingle();
    if (!profilClient) throw err("ERR_INTROUVABLE");
    const { data: cree, error: erreurCreation } = await client
      .from("conversations")
      .insert({
        type: "plateforme",
        proprietaire_id: cible,
        admin_responsable_id:
          (profilClient as { admin_responsable_id: string | null })
            .admin_responsable_id ?? null,
      })
      .select()
      .single();
    if (erreurCreation) {
      // Course possible (création simultanée) : on relit le fil.
      const { data: relue } = await client
        .from("conversations")
        .select("*")
        .eq("type", "plateforme")
        .eq("proprietaire_id", cible)
        .maybeSingle();
      if (!relue) throw new Error(erreurCreation.message);
      const [conv] = await this.enrichirConversations(
        [relue as LigneConversation],
        session.id,
        acteurEstPlateforme
      );
      return conv;
    }
    const [conv] = await this.enrichirConversations(
      [cree as LigneConversation],
      session.id,
      acteurEstPlateforme
    );
    return conv;
  }

  async getConversationRattachement(
    rattachementId: string
  ): Promise<Conversation> {
    const session = await this.requireSession();
    const profil = await this.getProfil();
    const acteurEstPlateforme = this.estPlateforme(profil);
    const client = this.client();
    const { data: rattachement, error: erreurRatt } = await client
      .from("rattachements_gestionnaires")
      .select("id, statut, proprietaire_id, gestionnaire_id")
      .eq("id", rattachementId)
      .maybeSingle();
    if (erreurRatt) throw new Error(erreurRatt.message);
    const ratt = rattachement as {
      statut: string;
      proprietaire_id: string | null;
      gestionnaire_id: string;
    } | null;
    if (
      !ratt ||
      ratt.statut !== "actif" ||
      !ratt.proprietaire_id ||
      !ratt.gestionnaire_id
    ) {
      throw err("ERR_CONVERSATION_INTROUVABLE");
    }
    const { data: existante, error } = await client
      .from("conversations")
      .select("*")
      .eq("rattachement_id", rattachementId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (existante) {
      const [conv] = await this.enrichirConversations(
        [existante as LigneConversation],
        session.id,
        acteurEstPlateforme
      );
      return conv;
    }
    const { data: cree, error: erreurCreation } = await client
      .from("conversations")
      .insert({
        type: "rattachement",
        proprietaire_id: ratt.proprietaire_id,
        gestionnaire_id: ratt.gestionnaire_id,
        rattachement_id: rattachementId,
      })
      .select()
      .single();
    if (erreurCreation) {
      const { data: relue } = await client
        .from("conversations")
        .select("*")
        .eq("rattachement_id", rattachementId)
        .maybeSingle();
      if (!relue) throw new Error(erreurCreation.message);
      const [conv] = await this.enrichirConversations(
        [relue as LigneConversation],
        session.id,
        acteurEstPlateforme
      );
      return conv;
    }
    const [conv] = await this.enrichirConversations(
      [cree as LigneConversation],
      session.id,
      acteurEstPlateforme
    );
    return conv;
  }

  async listerMessages(conversationId: string): Promise<MessageDirect[]> {
    await this.requireSession();
    const { data, error } = await this.client()
      .from("messages_directs")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const lignes = (data as LigneMessage[] | null) ?? [];
    const parId = await this.profilsAffichage(
      lignes.map((m) => m.expediteur_id)
    );
    return lignes.map((m) => ({
      id: m.id,
      conversation_id: m.conversation_id,
      expediteur_id: m.expediteur_id,
      expediteur_nom: parId.get(m.expediteur_id)?.nom,
      corps: m.corps,
      created_at: m.created_at,
      lu_par_client: Boolean(m.lu_par_client),
      lu_par_plateforme: Boolean(m.lu_par_plateforme),
    }));
  }

  async envoyerMessage(
    conversationId: string,
    corps: string
  ): Promise<MessageDirect> {
    const texte = corps.trim();
    if (!texte) throw err("ERR_MESSAGE_VIDE");
    const session = await this.requireSession();
    const profil = await this.getProfil();
    const conversation = await this.chargerConversation(conversationId);
    if (!conversation) throw err("ERR_CONVERSATION_INTROUVABLE");
    const acteurEstPlateforme = this.estPlateforme(profil);
    // Pré-vérification : la plateforme est en LECTURE SEULE sur les fils
    // rattachement (la RLS refuserait l'insertion de toute façon).
    if (acteurEstPlateforme && conversation.type === "rattachement") {
      throw err("ERR_SUPERVISION_LECTURE_SEULE");
    }
    const coteClient =
      session.id === conversation.proprietaire_id ||
      session.id === conversation.gestionnaire_id;
    const cotePlateforme = acteurEstPlateforme && !coteClient;
    if (!coteClient && !cotePlateforme) {
      throw err("ERR_CONVERSATION_INTROUVABLE");
    }
    const { data, error } = await this.client()
      .from("messages_directs")
      .insert({
        conversation_id: conversationId,
        expediteur_id: session.id,
        corps: texte,
        lu_par_client: coteClient,
        lu_par_plateforme: cotePlateforme,
      })
      .select()
      .single();
    if (error) throw erreurRpcV15(error);
    const ligne = data as LigneMessage;
    return {
      id: ligne.id,
      conversation_id: ligne.conversation_id,
      expediteur_id: ligne.expediteur_id,
      expediteur_nom: profil?.nom,
      corps: ligne.corps,
      created_at: ligne.created_at,
      lu_par_client: Boolean(ligne.lu_par_client),
      lu_par_plateforme: Boolean(ligne.lu_par_plateforme),
    };
  }

  async marquerLu(conversationId: string): Promise<void> {
    const session = await this.requireSession();
    const conversation = await this.chargerConversation(conversationId);
    if (!conversation) throw err("ERR_CONVERSATION_INTROUVABLE");
    const coteClient =
      session.id === conversation.proprietaire_id ||
      session.id === conversation.gestionnaire_id;
    const client = this.client();
    // On ne marque que les messages des AUTRES, du côté de l'acteur.
    const { error } = coteClient
      ? await client
          .from("messages_directs")
          .update({ lu_par_client: true })
          .eq("conversation_id", conversationId)
          .neq("expediteur_id", session.id)
      : await client
          .from("messages_directs")
          .update({ lu_par_plateforme: true })
          .eq("conversation_id", conversationId)
          .neq("expediteur_id", session.id);
    if (error) throw new Error(error.message);
  }

  async listerConversationsSupervisees(): Promise<Conversation[]> {
    const acteur = await this.acteurPlateforme();
    const { data, error } = await this.client()
      .from("conversations")
      .select("*")
      .eq("type", "rattachement")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return this.enrichirConversations(
      (data as LigneConversation[] | null) ?? [],
      acteur.id,
      true
    );
  }

  /**
   * Boîte de réception plateforme (2026-11-07, demande du fondateur
   * après un message cliente passé inaperçu) : TOUS les fils
   * « plateforme » — assignés ou NON. L'assignation est une
   * responsabilité, pas une restriction d'accès : la politique
   * conversations_select autorise déjà est_admin_plateforme() sur
   * tous les fils. Tri : dernier message décroissant (repli : date
   * de création du fil).
   */
  async listerConversationsPlateforme(): Promise<Conversation[]> {
    const acteur = await this.acteurPlateforme();
    const { data, error } = await this.client()
      .from("conversations")
      .select("*")
      .eq("type", "plateforme")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const enrichies = await this.enrichirConversations(
      (data as LigneConversation[] | null) ?? [],
      acteur.id,
      true,
      true
    );
    return enrichies.sort((a, b) =>
      (b.dernier_message_le ?? b.created_at).localeCompare(
        a.dernier_message_le ?? a.created_at
      )
    );
  }

  /**
   * Badge console : total des messages clients non lus par la
   * plateforme. Dérivé de la boîte de réception — le badge égale
   * donc toujours la somme des pastilles de la page Messages.
   */
  async compterMessagesPlateformeNonLus(): Promise<number> {
    const conversations = await this.listerConversationsPlateforme();
    return conversations.reduce((somme, c) => somme + (c.non_lus ?? 0), 0);
  }

  async journaliserConsultationMessages(conversationId: string): Promise<void> {
    // Audit en base par la RPC — aucun journaliserAudit côté app.
    const { error } = await this.client().rpc(
      "journaliser_consultation_messages",
      { p_conversation: conversationId }
    );
    if (error) throw erreurRpcV15(error);
  }

  // --- Assignation des dossiers + équipe ------------------------------------

  async assignerDossier(compteId: string, adminId: string | null): Promise<void> {
    // Audit en base par la RPC — aucun journaliserAudit côté app.
    const { error } = await this.client().rpc("assigner_dossier", {
      cible: compteId,
      admin_id: adminId,
    });
    if (error) throw erreurRpcV15(error);
  }

  async listerEquipeAdmins(): Promise<MembreEquipe[]> {
    await this.acteurPlateforme();
    const client = this.client();
    const { data, error } = await client
      .from("profils")
      .select(
        "id, email, nom, role, suspendu, acces_admin_actif, created_at"
      )
      .in("role", ["admin", "super_admin"])
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const membres = (data as {
      id: string;
      email: string;
      nom: string;
      role: "admin" | "super_admin";
      suspendu: boolean;
      acces_admin_actif: boolean | null;
      created_at: string;
    }[] | null) ?? [];
    // Charge : RPC lister_charge_admins ; repli = comptage local des
    // dossiers assignés si la RPC échoue (module SQL non encore appliqué).
    const chargeParId = new Map<string, number>();
    let chargeViaRpc = false;
    try {
      const { data: charges, error: erreurCharge } = await client.rpc(
        "lister_charge_admins"
      );
      if (!erreurCharge && charges) {
        for (const c of charges as { admin_id: string; dossiers: number }[]) {
          chargeParId.set(c.admin_id, Number(c.dossiers));
        }
        chargeViaRpc = true;
      }
    } catch {
      chargeViaRpc = false;
    }
    if (!chargeViaRpc) {
      const { data: dossiers } = await client
        .from("profils")
        .select("admin_responsable_id")
        .not("admin_responsable_id", "is", null);
      for (const d of (dossiers as { admin_responsable_id: string }[] | null) ??
        []) {
        chargeParId.set(
          d.admin_responsable_id,
          (chargeParId.get(d.admin_responsable_id) ?? 0) + 1
        );
      }
    }
    // Dernière activité : 200 entrées d'audit les plus récentes, max
    // par acteur calculé en mémoire (la requête est déjà triée desc).
    const derniereParActeur = new Map<string, string>();
    const { data: audit } = await client
      .from("journal_audit")
      .select("acteur_id, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    for (const e of (audit as {
      acteur_id: string | null;
      created_at: string;
    }[] | null) ?? []) {
      if (e.acteur_id && !derniereParActeur.has(e.acteur_id)) {
        derniereParActeur.set(e.acteur_id, e.created_at);
      }
    }
    return membres.map((m) => ({
      id: m.id,
      email: m.email,
      nom: m.nom,
      role: m.role,
      statut: m.suspendu ? ("suspendu" as const) : ("actif" as const),
      acces_admin_actif: m.acces_admin_actif ?? true,
      dossiers_assignes: chargeParId.get(m.id) ?? 0,
      derniere_activite: derniereParActeur.get(m.id) ?? null,
      created_at: m.created_at,
    }));
  }

  async basculerAccesAdmin(adminId: string, actif: boolean): Promise<void> {
    // Audit en base par la RPC — aucun journaliserAudit côté app.
    const { error } = await this.client().rpc("basculer_acces_admin", {
      cible: adminId,
      actif,
    });
    if (error) throw erreurRpcV15(error);
  }

  async retirerRoleAdmin(adminId: string): Promise<void> {
    // Audit en base par la RPC — aucun journaliserAudit côté app.
    const { error } = await this.client().rpc("retirer_role_admin", {
      cible: adminId,
    });
    if (error) throw erreurRpcV15(error);
  }

  async listerMesDossiers(): Promise<ComptePlateforme[]> {
    const profil = await this.getProfil();
    if (!profil) throw err("ERR_NOT_FOUND");
    const comptes = await this.listerComptesPlateforme();
    return comptes.filter((c) => c.admin_responsable_id === profil.id);
  }
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  return Number(v);
}

function mapImmeuble(r: Immeuble): Immeuble {
  const brut = r as Immeuble & Record<string, unknown>;
  return {
    ...r,
    valeur_bien: num(r.valeur_bien),
    prix_acquisition: num(r.prix_acquisition),
    // v1.6 : quartier — défaut sûr si la ligne est antérieure à la migration.
    quartier: (brut.quartier as string | null | undefined) ?? null,
    // v1.7 : photos (chemins Storage) + revue gestionnaire — défauts
    // sûrs si la ligne est antérieure à la migration. photos_urls est
    // résolu à part (liens signés, voir enrichirPhotosImmeubles).
    photos: Array.isArray(brut.photos) ? (brut.photos as string[]) : [],
    photos_urls: [],
    origine_creation:
      brut.origine_creation === "gestionnaire" ? "gestionnaire" : "proprietaire",
    proprietaire_declare_nom:
      (brut.proprietaire_declare_nom as string | null | undefined) ?? null,
    proprietaire_declare_email:
      (brut.proprietaire_declare_email as string | null | undefined) ?? null,
    proprietaire_concordance: Boolean(brut.proprietaire_concordance ?? false),
    validation_statut:
      (brut.validation_statut as Immeuble["validation_statut"] | undefined) ??
      "valide",
    validation_motif:
      (brut.validation_motif as string | null | undefined) ?? null,
  };
}

function mapAppartement(r: Appartement): Appartement {
  const brut = r as Appartement & Record<string, unknown>;
  return {
    ...r,
    loyer_defaut: Number(r.loyer_defaut),
    charges: Number(r.charges),
    surface_m2: num(r.surface_m2),
    valeur_bien: num(r.valeur_bien),
    archive: Boolean((r as unknown as { archive?: boolean }).archive),
    // v1.6 « Vitrine vérifiée » : défauts sûrs si la ligne est
    // antérieure à la migration (façon mapProfil) — jamais publiée
    // par défaut, aucun contact annoncé, aucune visite renseignée.
    vitrine_statut:
      (brut.vitrine_statut as Appartement["vitrine_statut"] | undefined) ??
      "non_publie",
    vitrine_motif_refus:
      (brut.vitrine_motif_refus as string | null | undefined) ?? null,
    vitrine_valide_par:
      (brut.vitrine_valide_par as string | null | undefined) ?? null,
    vitrine_valide_le:
      (brut.vitrine_valide_le as string | null | undefined) ?? null,
    pieces: num(brut.pieces),
    meuble: typeof brut.meuble === "boolean" ? brut.meuble : false,
    disponible_le: (brut.disponible_le as string | null | undefined) ?? null,
    visite_jours: Array.isArray(brut.visite_jours)
      ? (brut.visite_jours as string[])
      : [],
    visite_heures: (brut.visite_heures as string | null | undefined) ?? null,
    contact_nom: (brut.contact_nom as string | null | undefined) ?? null,
    contact_telephone:
      (brut.contact_telephone as string | null | undefined) ?? null,
    contact_email: (brut.contact_email as string | null | undefined) ?? null,
    contact_justification:
      (brut.contact_justification as string | null | undefined) ?? null,
  };
}

/** v1.6 : normalisation e-mail pour la comparaison annonce ↔ dossier. */
function normaliserEmailVitrine(valeur: string): string {
  return valeur.trim().toLowerCase();
}

/** v1.6 : normalisation téléphone — seuls chiffres et « + » comptent. */
function normaliserTelephoneVitrine(valeur: string): string {
  return valeur.replace(/[^0-9+]/g, "");
}

/**
 * v1.6 : le contact ANNONCÉ diverge-t-il du contact du DOSSIER ?
 * Seuls les champs annoncés non null sont comparés (un champ non
 * renseigné retombe sur le dossier : pas de divergence).
 */
function contactVitrineDivergent(
  annonce: ContactPublic,
  dossier: ContactPublic
): boolean {
  if (annonce.email !== null) {
    const attendu =
      dossier.email !== null ? normaliserEmailVitrine(dossier.email) : "";
    if (normaliserEmailVitrine(annonce.email) !== attendu) return true;
  }
  if (annonce.telephone !== null) {
    const attendu =
      dossier.telephone !== null
        ? normaliserTelephoneVitrine(dossier.telephone)
        : "";
    if (normaliserTelephoneVitrine(annonce.telephone) !== attendu) return true;
  }
  return false;
}

function mapBail(r: Bail): Bail {
  return { ...r, loyer_mensuel: Number(r.loyer_mensuel), caution: num(r.caution) };
}

/** v1.5 : mappe les 4 nouveaux champs du profil (défauts sûrs si la ligne est antérieure à la migration). */
function mapProfil(r: Profil): Profil {
  const brut = r as Profil & Record<string, unknown>;
  return {
    ...r,
    suppression_demandee_le:
      (brut.suppression_demandee_le as string | null | undefined) ?? null,
    admin_responsable_id:
      (brut.admin_responsable_id as string | null | undefined) ?? null,
    acces_admin_actif:
      typeof brut.acces_admin_actif === "boolean" ? brut.acces_admin_actif : true,
    role_avant_admin: (brut.role_avant_admin as Profil["role_avant_admin"]) ?? null,
  };
}

/** v1.5 : instantané avant suppression (jsonb), null hors demande en cours. */
function mapAbonnement(r: Abonnement): Abonnement {
  const brut = r as Abonnement & Record<string, unknown>;
  return {
    ...r,
    instantane_avant_suppression:
      (brut.instantane_avant_suppression as Record<string, unknown> | null | undefined) ??
      null,
  };
}

function mapPaiement(r: Paiement): Paiement {
  return {
    ...r,
    montant: Number(r.montant),
    taux_conversion:
      r.taux_conversion === null || r.taux_conversion === undefined
        ? null
        : Number(r.taux_conversion),
    montant_converti:
      r.montant_converti === null || r.montant_converti === undefined
        ? null
        : Number(r.montant_converti),
  };
}

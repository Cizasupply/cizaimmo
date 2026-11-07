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
  StatutWhatsApp,
  SupervisionGestionnaire,
  TarifPlateforme,
  TauxChange,
  TauxManuelInput,
  TauxResultat,
  TypeAlerte,
  TypeActivite,
  EcheanceLoyer,
  FactureAbonnement,
  FiltreAppartements,
  FiltreBaux,
  FiltreDepenses,
  FiltreEcheances,
  FiltreRecus,
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
  Profil,
  Recu,
  SessionUser,
  SignUpInput,
  StatutAppartement,
} from "./types";
import {
  construirePrixPlans,
  estEnRetardPaiement,
  PARAMETRES_FINANCE_DEFAUT,
  TARIFS_SEED,
} from "../tarifs";
import { attribuerGrille } from "../grille";
import { libellerMotif, rendreAvis, rendreBienvenue } from "../avis";
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
import { getSupabaseBrowserClient } from "../supabase";
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
 *   (supabase/schema.sql) crée alors le profil + l'abonnement d'essai
 *   (plan Pro, 30 jours, sans carte). En secours, si le trigger n'est pas
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
    if (data) return data as Profil;
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
      // Approbation manuelle (ajout n°3) : en_attente, sans dates d'essai.
      await client.from("abonnements").insert({
        owner_id: session.id,
        plan: "pro",
        grille: grilleMeta ?? "internationale",
        statut: "en_attente",
        debut_periode: new Date().toISOString(),
        fin_periode: null,
        trial_ends_at: null,
      });
    }
    return created as Profil;
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
    const abo = (data as Abonnement | null) ?? null;
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

  /** L'indivision exige le plan Pro ou Agence (l'essai = fonctions Pro). */
  private async verifierPlanIndivision(): Promise<void> {
    const abo = await this.getAbonnement();
    if (!abo) throw err("ERR_NOT_FOUND");
    const planEffectif = abo.statut === "essai" ? "pro" : abo.plan;
    if (!INDIVISION_PAR_PLAN[planEffectif]) throw err("ERR_INDIVISION_PLAN");
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
    return (data as Immeuble[]).map(mapImmeuble);
  }

  async getImmeuble(id: string): Promise<Immeuble | null> {
    const { data, error } = await this.client()
      .from("immeubles")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapImmeuble(data as Immeuble) : null;
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
    const { data, error } = await this.client()
      .from("immeubles")
      .insert({ ...input, owner_id: session.id, nom: input.nom.trim(), statut: "actif" })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") throw err("ERR_IMMEUBLE_NOM_UNIQUE");
      throw new Error(error.message);
    }
    return mapImmeuble(data as Immeuble);
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
    const { data, error } = await this.client()
      .from("immeubles")
      .update({ ...patch, nom: patch.nom ? patch.nom.trim() : undefined })
      .eq("id", id)
      .select()
      .single();
    if (error) {
      if (error.code === "23505") throw err("ERR_IMMEUBLE_NOM_UNIQUE");
      throw new Error(error.message);
    }
    return mapImmeuble(data as Immeuble);
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
    return data as Profil;
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

  async listerAnnoncesPubliques(): Promise<AnnoncePublique[]> {
    // Page publique : aucune session requise — la RLS (politiques « anon »,
    // supabase/schema.sql) ne retourne que les appartements publiés,
    // vacants ou réservés. Jamais de coordonnée de locataire.
    const { data, error } = await this.client()
      .from("appartements")
      .select("*, immeubles!inner(id, nom, ville, pays, owner_id)")
      .eq("vitrine", true)
      .eq("archive", false)
      .in("statut", ["vacant", "reserve"])
      .order("numero", { ascending: true });
    if (error) throw new Error(error.message);
    const annonces: AnnoncePublique[] = [];
    for (const ligne of (data ?? []) as unknown as Record<string, unknown>[]) {
      const apt = mapAppartement(ligne as unknown as Appartement);
      const imm = ligne.immeubles as { id: string; nom: string; ville: string; pays: string; owner_id: string };
      const { data: profil } = await this.client()
        .from("profils")
        .select("nom, email, telephone")
        .eq("id", imm.owner_id)
        .maybeSingle();
      const contact = (profil as { nom: string; email: string | null; telephone: string | null } | null) ?? {
        nom: "—",
        email: null,
        telephone: null,
      };
      annonces.push({
        appartement: apt,
        immeuble_id: imm.id,
        immeuble_nom: imm.nom,
        ville: imm.ville,
        pays: imm.pays,
        contact: {
          nom: contact.nom,
          email: contact.email ?? null,
          telephone: contact.telephone ?? null,
        },
      });
    }
    return annonces.sort((a, b) => a.ville.localeCompare(b.ville));
  }

  async getAnnoncePublique(appartementId: string): Promise<AnnoncePublique | null> {
    const annonces = await this.listerAnnoncesPubliques();
    return annonces.find((a) => a.appartement.id === appartementId) ?? null;
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
    return data as Abonnement;
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
    return (data as FactureAbonnement[]).map((f) => ({ ...f, montant: Number(f.montant) }));
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
    return { id: profil.id, email: profil.email, role: profil.role };
  }

  private async acteurSuperAdmin() {
    const acteur = await this.acteurPlateforme();
    if (acteur.role !== "super_admin") throw err("ERR_SUPER_ADMIN_REQUIS");
    return acteur;
  }

  private async journaliserAudit(
    acteur: { id: string; email: string; role: "admin" | "super_admin" },
    action: string,
    cibleType: CibleAudit,
    cibleId: string | null,
    cibleEmail: string | null,
    details?: Record<string, unknown> | null
  ): Promise<void> {
    await this.client().from("journal_audit").insert({
      acteur_id: acteur.id,
      acteur_email: acteur.email,
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
    langue?: "fr" | "en"
  ): Promise<Avis["statut_envoi"]> {
    try {
      const resultat = await this.envoyerEmailAlerteFn({ destinataire, sujet, texte, langue });
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
    return (data as Abonnement | null) ?? null;
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
    return ((profils as Profil[] | null) ?? []).map((p) => {
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
      .select("email, nom, langue")
      .eq("id", compteId)
      .maybeSingle();
    if (!profil) throw err("ERR_INTROUVABLE");
    const parametres = await this.getParametresFinance();
    const maintenant = new Date();
    const finEssai = ajouterJours(maintenant.toISOString(), parametres.jours_essai);
    // L'essai démarre À L'APPROBATION ; la grille affichée est confirmée.
    await client
      .from("abonnements")
      .update({
        statut: "essai",
        debut_periode: maintenant.toISOString(),
        trial_ends_at: finEssai,
        fin_periode: finEssai,
      })
      .eq("id", abo.id);
    await client
      .from("profils")
      .update({ grille_attribuee: abo.grille })
      .eq("id", compteId);
    const bienvenue = rendreBienvenue(profil.nom, profil.langue === "en" ? "en" : "fr");
    const emailStatut = await this.envoyerEmailPlateforme(
      profil.email,
      bienvenue.sujet,
      bienvenue.corps,
      profil.langue === "en" ? "en" : "fr"
    );
    await this.journaliserAudit(acteur, "compte_approuve", "compte", compteId, profil.email, {
      grille: abo.grille,
      trial_ends_at: finEssai,
      email_bienvenue: emailStatut,
    });
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
    const abo = await this.abonnementDe(compteId);
    if (!abo) throw err("ERR_INTROUVABLE");
    await client.from("abonnements").update({ grille }).eq("id", abo.id);
    await client
      .from("profils")
      .update({ grille_attribuee: grille, grille_statut: "ok" })
      .eq("id", compteId);
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
    await client.from("profils").update({ role: "admin" }).eq("id", profil.id);
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
      gestionnaire_id: l.gestionnaire_id as string,
      gestionnaire_email: parId.get(l.gestionnaire_id as string)?.email ?? "",
      gestionnaire_nom: parId.get(l.gestionnaire_id as string)?.nom ?? null,
      contexte: l.contexte as RattachementGestionnaire["contexte"],
      proprietaire_id: (l.proprietaire_id as string | null) ?? null,
      proprietaire_nom: l.proprietaire_id
        ? parId.get(l.proprietaire_id as string)?.nom ?? null
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
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  return Number(v);
}

function mapImmeuble(r: Immeuble): Immeuble {
  return { ...r, valeur_bien: num(r.valeur_bien), prix_acquisition: num(r.prix_acquisition) };
}

function mapAppartement(r: Appartement): Appartement {
  return {
    ...r,
    loyer_defaut: Number(r.loyer_defaut),
    charges: Number(r.charges),
    surface_m2: num(r.surface_m2),
    valeur_bien: num(r.valeur_bien),
    archive: Boolean((r as unknown as { archive?: boolean }).archive),
  };
}

function mapBail(r: Bail): Bail {
  return { ...r, loyer_mensuel: Number(r.loyer_mensuel), caution: num(r.caution) };
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

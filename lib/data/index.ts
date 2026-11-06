import { isDemoMode } from "../supabase";
import { DemoProvider } from "./demo";
import { RealProvider } from "./real";
import type { DataProvider } from "./provider";

/**
 * Point d'entrée UNIQUE de la couche données.
 * Les pages et composants importent getDataProvider() et n'appellent jamais
 * Supabase directement. Le mode est choisi par la configuration :
 * Supabase configuré -> réel, sinon -> démo (données fictives étiquetées).
 */
let cached: DataProvider | null = null;

export function getDataProvider(): DataProvider {
  if (!cached) {
    cached = isDemoMode() ? new DemoProvider() : new RealProvider();
  }
  return cached;
}

export { isDemoMode } from "../supabase";
export type { DataProvider } from "./provider";
export type {
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
  CategorieDepense,
  ContactPublic,
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
  EntiteType,
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
  Langue,
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
  Role,
  SessionUser,
  SignUpInput,
  StatutAbonnement,
  StatutAppartement,
  StatutBail,
  StatutCoproprietaire,
  StatutImmeuble,
  StatutLoyer,
  StatutWhatsApp,
  TauxChange,
  TauxManuelInput,
  TauxResultat,
  TypeAlerte,
  TypeDocument,
  TypeAppartement,
  TypeImmeuble,
  UrgenceAlerte,
} from "./types";
export { CATEGORIES_DEPENSES, DEVISES, OPERATEURS_MOBILE_MONEY, TYPES_APPARTEMENT, TYPES_DOCUMENT, TAILLE_MAX_DOCUMENT_OCTETS, limiteBlocs, LIMITE_BLOCS } from "./types";
export {
  ESSAI_JOURS,
  GRACE_ECHEC_PAIEMENT_JOURS,
  RETENTION_LECTURE_SEULE_JOURS,
  MOBILE_MONEY_EXPIRATION_HEURES,
  PRIX_PLANS,
  RANG_PLAN,
  GESTIONNAIRES_MAX,
  VITRINE_PAR_PLAN,
  INDIVISION_PAR_PLAN,
  prixPlan,
  grillePourPays,
  estLectureSeule,
} from "../abonnement";
export { DEMO_SESSION_COOKIE } from "./demo";

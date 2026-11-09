"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEMO_SESSION_COOKIE = exports.estLectureSeule = exports.grillePourPays = exports.prixPlan = exports.INDIVISION_PAR_PLAN = exports.VITRINE_PAR_PLAN = exports.GESTIONNAIRES_MAX = exports.RANG_PLAN = exports.PRIX_PLANS = exports.MOBILE_MONEY_EXPIRATION_HEURES = exports.RETENTION_LECTURE_SEULE_JOURS = exports.GRACE_ECHEC_PAIEMENT_JOURS = exports.ESSAI_JOURS = exports.LIMITE_BLOCS = exports.limiteBlocs = exports.TAILLE_MAX_DOCUMENT_OCTETS = exports.TYPES_DOCUMENT = exports.TYPES_APPARTEMENT = exports.OPERATEURS_MOBILE_MONEY = exports.FORMATS_DOCUMENT_ACCEPTES = exports.EXTENSIONS_DOCUMENT_ACCEPTEES = exports.DEVISES = exports.CATEGORIES_DEPENSES = exports.verificationEmployeValide = exports.verdictVerificationEmploye = exports.progressionPackEmploye = exports.carteEmployeEmise = exports.totauxParDevise = exports.moisValide = exports.moisCourant = exports.blocagesPaie = exports.CATEGORIES_DEPENSE_PLATEFORME = exports.evaluerDossierEmploye = exports.isDemoMode = void 0;
exports.getDataProvider = getDataProvider;
const supabase_1 = require("../supabase");
const demo_1 = require("./demo");
const real_1 = require("./real");
/**
 * Point d'entrée UNIQUE de la couche données.
 * Les pages et composants importent getDataProvider() et n'appellent jamais
 * Supabase directement. Le mode est choisi par la configuration :
 * Supabase configuré -> réel, sinon -> démo (données fictives étiquetées).
 */
let cached = null;
function getDataProvider() {
    if (!cached) {
        cached = (0, supabase_1.isDemoMode)() ? new demo_1.DemoProvider() : new real_1.RealProvider();
    }
    return cached;
}
var supabase_2 = require("../supabase");
Object.defineProperty(exports, "isDemoMode", { enumerable: true, get: function () { return supabase_2.isDemoMode; } });
var dossier_employe_1 = require("../dossier-employe");
Object.defineProperty(exports, "evaluerDossierEmploye", { enumerable: true, get: function () { return dossier_employe_1.evaluerDossierEmploye; } });
var finances_plateforme_1 = require("../finances-plateforme");
Object.defineProperty(exports, "CATEGORIES_DEPENSE_PLATEFORME", { enumerable: true, get: function () { return finances_plateforme_1.CATEGORIES_DEPENSE_PLATEFORME; } });
Object.defineProperty(exports, "blocagesPaie", { enumerable: true, get: function () { return finances_plateforme_1.blocagesPaie; } });
Object.defineProperty(exports, "moisCourant", { enumerable: true, get: function () { return finances_plateforme_1.moisCourant; } });
Object.defineProperty(exports, "moisValide", { enumerable: true, get: function () { return finances_plateforme_1.moisValide; } });
Object.defineProperty(exports, "totauxParDevise", { enumerable: true, get: function () { return finances_plateforme_1.totauxParDevise; } });
var pack_employe_1 = require("../pack-employe");
Object.defineProperty(exports, "carteEmployeEmise", { enumerable: true, get: function () { return pack_employe_1.carteEmployeEmise; } });
Object.defineProperty(exports, "progressionPackEmploye", { enumerable: true, get: function () { return pack_employe_1.progressionPackEmploye; } });
Object.defineProperty(exports, "verdictVerificationEmploye", { enumerable: true, get: function () { return pack_employe_1.verdictVerificationEmploye; } });
Object.defineProperty(exports, "verificationEmployeValide", { enumerable: true, get: function () { return pack_employe_1.verificationEmployeValide; } });
var types_1 = require("./types");
Object.defineProperty(exports, "CATEGORIES_DEPENSES", { enumerable: true, get: function () { return types_1.CATEGORIES_DEPENSES; } });
Object.defineProperty(exports, "DEVISES", { enumerable: true, get: function () { return types_1.DEVISES; } });
Object.defineProperty(exports, "EXTENSIONS_DOCUMENT_ACCEPTEES", { enumerable: true, get: function () { return types_1.EXTENSIONS_DOCUMENT_ACCEPTEES; } });
Object.defineProperty(exports, "FORMATS_DOCUMENT_ACCEPTES", { enumerable: true, get: function () { return types_1.FORMATS_DOCUMENT_ACCEPTES; } });
Object.defineProperty(exports, "OPERATEURS_MOBILE_MONEY", { enumerable: true, get: function () { return types_1.OPERATEURS_MOBILE_MONEY; } });
Object.defineProperty(exports, "TYPES_APPARTEMENT", { enumerable: true, get: function () { return types_1.TYPES_APPARTEMENT; } });
Object.defineProperty(exports, "TYPES_DOCUMENT", { enumerable: true, get: function () { return types_1.TYPES_DOCUMENT; } });
Object.defineProperty(exports, "TAILLE_MAX_DOCUMENT_OCTETS", { enumerable: true, get: function () { return types_1.TAILLE_MAX_DOCUMENT_OCTETS; } });
Object.defineProperty(exports, "limiteBlocs", { enumerable: true, get: function () { return types_1.limiteBlocs; } });
Object.defineProperty(exports, "LIMITE_BLOCS", { enumerable: true, get: function () { return types_1.LIMITE_BLOCS; } });
var abonnement_1 = require("../abonnement");
Object.defineProperty(exports, "ESSAI_JOURS", { enumerable: true, get: function () { return abonnement_1.ESSAI_JOURS; } });
Object.defineProperty(exports, "GRACE_ECHEC_PAIEMENT_JOURS", { enumerable: true, get: function () { return abonnement_1.GRACE_ECHEC_PAIEMENT_JOURS; } });
Object.defineProperty(exports, "RETENTION_LECTURE_SEULE_JOURS", { enumerable: true, get: function () { return abonnement_1.RETENTION_LECTURE_SEULE_JOURS; } });
Object.defineProperty(exports, "MOBILE_MONEY_EXPIRATION_HEURES", { enumerable: true, get: function () { return abonnement_1.MOBILE_MONEY_EXPIRATION_HEURES; } });
Object.defineProperty(exports, "PRIX_PLANS", { enumerable: true, get: function () { return abonnement_1.PRIX_PLANS; } });
Object.defineProperty(exports, "RANG_PLAN", { enumerable: true, get: function () { return abonnement_1.RANG_PLAN; } });
Object.defineProperty(exports, "GESTIONNAIRES_MAX", { enumerable: true, get: function () { return abonnement_1.GESTIONNAIRES_MAX; } });
Object.defineProperty(exports, "VITRINE_PAR_PLAN", { enumerable: true, get: function () { return abonnement_1.VITRINE_PAR_PLAN; } });
Object.defineProperty(exports, "INDIVISION_PAR_PLAN", { enumerable: true, get: function () { return abonnement_1.INDIVISION_PAR_PLAN; } });
Object.defineProperty(exports, "prixPlan", { enumerable: true, get: function () { return abonnement_1.prixPlan; } });
Object.defineProperty(exports, "grillePourPays", { enumerable: true, get: function () { return abonnement_1.grillePourPays; } });
Object.defineProperty(exports, "estLectureSeule", { enumerable: true, get: function () { return abonnement_1.estLectureSeule; } });
var demo_2 = require("./demo");
Object.defineProperty(exports, "DEMO_SESSION_COOKIE", { enumerable: true, get: function () { return demo_2.DEMO_SESSION_COOKIE; } });

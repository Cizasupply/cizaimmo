"use strict";
/**
 * CizaImmo — types de la couche données (Module 1).
 * Noms de tables et de champs en snake_case, alignés sur supabase/schema.sql.
 * Le module 1 ne couvre que l'authentification et le profil ; les types des
 * autres entités sont posés ici pour que les modules suivants réutilisent
 * exactement les mêmes formes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXTENSIONS_DOCUMENT_ACCEPTEES = exports.FORMATS_DOCUMENT_ACCEPTES = exports.TAILLE_MAX_DOCUMENT_OCTETS = exports.TYPES_DOCUMENT = exports.CATEGORIES_DEPENSES = exports.LIMITE_BLOCS = exports.TYPES_APPARTEMENT = exports.OPERATEURS_MOBILE_MONEY = exports.DEVISES = void 0;
exports.limiteBlocs = limiteBlocs;
exports.DEVISES = [
    "USD", "EUR", "GBP", "CAD", "BIF", "XAF", "XOF", "KES", "TZS", "RWF", "UGX", "BRL",
];
exports.OPERATEURS_MOBILE_MONEY = [
    "ecocash",
    "lumicash",
    "enoti",
];
exports.TYPES_APPARTEMENT = [
    "studio", "T1", "T2", "T3", "T4", "T5+", "autre",
];
/** Limite de blocs par plan (spec §12). */
exports.LIMITE_BLOCS = {
    starter: 1,
    pro: 5,
    agence: Number.POSITIVE_INFINITY,
};
function limiteBlocs(plan, statut) {
    // Extension v1.2 : en attente d'approbation ou suspendu = aucun bloc.
    if (statut === "en_attente" || statut === "suspendu")
        return 0;
    // v1.4 : l'essai EST le pack Starter — le plan de l'abonnement vaut
    // « starter » pendant tout l'essai (forcé à l'approbation, dans la
    // base), donc plus aucune fonction Pro offerte pendant l'essai :
    // la limite suit simplement le plan en cours.
    return exports.LIMITE_BLOCS[plan];
}
exports.CATEGORIES_DEPENSES = [
    "entretien", "reparation", "taxe", "assurance", "salaire", "autre",
];
exports.TYPES_DOCUMENT = [
    "bail",
    "piece_identite",
    "justificatif",
    "facture",
    "contrat",
    "autorisation",
    "autre",
];
exports.TAILLE_MAX_DOCUMENT_OCTETS = 10 * 1024 * 1024; // 10 Mo (spec §6)
exports.FORMATS_DOCUMENT_ACCEPTES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/heif",
];
/**
 * Extensions acceptées pour un DOCUMENT (contrat signé, pièce,
 * justificatif…) — liste UNIQUE partagée par les deux fournisseurs
 * et le sélecteur de fichier (components/DocumentUpload.tsx).
 * HEIC/HEIF ajoutés le 2026-11-08 (correctif captures fondateur,
 * point 7) : c'est le format photo NATIF de l'iPhone — un employé
 * qui photographie son contrat signé produit un .heic, que l'ancienne
 * liste refusait partout (sélecteur, validation, fournisseurs) alors
 * que le bucket privé n'impose AUCUNE restriction de type (aucun
 * allowed_mime_types ; sa politique INSERT ne borne que le préfixe
 * <uid>/ du chemin). Les flux PHOTO (photo de profil, photos
 * d'immeuble) gardent leur liste propre JPG/PNG : ils retraitent
 * l'image, un document, lui, est conservé tel quel.
 */
exports.EXTENSIONS_DOCUMENT_ACCEPTEES = [
    "pdf",
    "jpg",
    "jpeg",
    "png",
    "heic",
    "heif",
];

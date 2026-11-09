"use strict";
/**
 * CizaImmo — helpers partagés par les deux fournisseurs (Module 2).
 * Règles métier pures, sans accès base : mêmes contrôles en démo et en réel.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.uid = uid;
exports.genererToken = genererToken;
exports.telephoneValide = telephoneValide;
exports.emailValide = emailValide;
exports.bauxSeChevauchent = bauxSeChevauchent;
exports.err = err;
function uid() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
/** Jeton opaque du lien locataire (32 caractères hexadécimaux). */
function genererToken() {
    if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}
/** Téléphone international : 10 à 15 chiffres (spec §8). */
function telephoneValide(telephone) {
    const chiffres = telephone.replace(/[\s\-().]/g, "");
    return /^\+?\d{10,15}$/.test(chiffres);
}
function emailValide(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
/**
 * Deux baux se chevauchent si leurs périodes se croisent.
 * Une fin null = bail sans date de fin (ouvert).
 */
function bauxSeChevauchent(aDebut, aFin, bDebut, bFin) {
    const finA = aFin ?? "9999-12-31";
    const finB = bFin ?? "9999-12-31";
    return aDebut <= finB && bDebut <= finA;
}
/** Erreur métier portant un code traduit par les pages (crud.errors.<code>). */
function err(code) {
    return new Error(code);
}

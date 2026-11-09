"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRIX_STRIPE_ENV = exports.STRIPE_TEST_CARD = void 0;
exports.getStripePriceId = getStripePriceId;
exports.stripeConfigured = stripeConfigured;
exports.stripeTestKeyPresentButLive = stripeTestKeyPresentButLive;
exports.getStripeClient = getStripeClient;
exports.stripeWebhookSecret = stripeWebhookSecret;
/**
 * CizaImmo — Stripe, MODE TEST UNIQUEMENT (Module 5, spec §12).
 *
 * SERVEUR UNIQUEMENT : ce fichier ne doit jamais être importé par du
 * code client (la clé secrète ne quitte jamais le serveur).
 *
 * Règles absolues :
 *  - compte Stripe EXISTANT de Ciza Group / CizaShop, en MODE TEST d'abord ;
 *    AUCUN nouveau compte n'est créé ici ;
 *  - une clé live (sk_live_…) est REFUSÉE : stripeConfigured() retourne
 *    false et aucune session n'est créée ;
 *  - sans clés, l'interface affiche honnêtement « Stripe non configuré —
 *    mode test » et ne prétend JAMAIS qu'un paiement a réussi ;
 *  - cartes de test uniquement (4242 4242 4242 4242…), aucun débit réel.
 */
const stripe_1 = __importDefault(require("stripe"));
exports.STRIPE_TEST_CARD = "4242 4242 4242 4242";
/** Identifiants de prix Stripe (mode test), lus depuis l'environnement. */
exports.PRIX_STRIPE_ENV = {
    afrique_starter: "STRIPE_PRICE_AFRIQUE_STARTER",
    afrique_pro: "STRIPE_PRICE_AFRIQUE_PRO",
    afrique_agence: "STRIPE_PRICE_AFRIQUE_AGENCE",
    internationale_starter: "STRIPE_PRICE_INTERNATIONALE_STARTER",
    internationale_pro: "STRIPE_PRICE_INTERNATIONALE_PRO",
    internationale_agence: "STRIPE_PRICE_INTERNATIONALE_AGENCE",
};
function getStripePriceId(grille, plan) {
    const valeur = process.env[exports.PRIX_STRIPE_ENV[`${grille}_${plan}`]];
    return valeur && !valeur.includes("placeholder") ? valeur : undefined;
}
/** Vrai uniquement si une clé secrète TEST est configurée. */
function stripeConfigured() {
    const cle = process.env.STRIPE_SECRET_KEY;
    if (!cle || cle.includes("placeholder"))
        return false;
    // MODE TEST UNIQUEMENT : une clé live est refusée.
    return cle.startsWith("sk_test_");
}
function stripeTestKeyPresentButLive() {
    const cle = process.env.STRIPE_SECRET_KEY ?? "";
    return cle.startsWith("sk_live_");
}
function getStripeClient() {
    if (!stripeConfigured())
        return null;
    return new stripe_1.default(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2026-10-28.endive",
    });
}
function stripeWebhookSecret() {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    return secret && !secret.includes("placeholder") ? secret : undefined;
}

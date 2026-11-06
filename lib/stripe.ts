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
import Stripe from "stripe";
import type { Grille, Plan } from "./data/types";

export const STRIPE_TEST_CARD = "4242 4242 4242 4242";

/** Identifiants de prix Stripe (mode test), lus depuis l'environnement. */
export const PRIX_STRIPE_ENV: Record<`${Grille}_${Plan}`, string> = {
  afrique_starter: "STRIPE_PRICE_AFRIQUE_STARTER",
  afrique_pro: "STRIPE_PRICE_AFRIQUE_PRO",
  afrique_agence: "STRIPE_PRICE_AFRIQUE_AGENCE",
  internationale_starter: "STRIPE_PRICE_INTERNATIONALE_STARTER",
  internationale_pro: "STRIPE_PRICE_INTERNATIONALE_PRO",
  internationale_agence: "STRIPE_PRICE_INTERNATIONALE_AGENCE",
};

export function getStripePriceId(grille: Grille, plan: Plan): string | undefined {
  const valeur = process.env[PRIX_STRIPE_ENV[`${grille}_${plan}`]];
  return valeur && !valeur.includes("placeholder") ? valeur : undefined;
}

/** Vrai uniquement si une clé secrète TEST est configurée. */
export function stripeConfigured(): boolean {
  const cle = process.env.STRIPE_SECRET_KEY;
  if (!cle || cle.includes("placeholder")) return false;
  // MODE TEST UNIQUEMENT : une clé live est refusée.
  return cle.startsWith("sk_test_");
}

export function stripeTestKeyPresentButLive(): boolean {
  const cle = process.env.STRIPE_SECRET_KEY ?? "";
  return cle.startsWith("sk_live_");
}

export function getStripeClient(): Stripe | null {
  if (!stripeConfigured()) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY as string, {
    apiVersion: "2026-10-28.endive",
  });
}

export function stripeWebhookSecret(): string | undefined {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  return secret && !secret.includes("placeholder") ? secret : undefined;
}

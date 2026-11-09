"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYS_AFRIQUE = exports.PAYS = void 0;
/**
 * Liste de pays du formulaire d'inscription (Module 1).
 * La valeur enregistrée est le nom du pays (chaîne libre côté base).
 * Afrique d'abord (marché prioritaire), puis international.
 */
exports.PAYS = [
    "Burundi",
    "Rwanda",
    "République démocratique du Congo",
    "Congo",
    "Kenya",
    "Tanzanie",
    "Ouganda",
    "Cameroun",
    "Sénégal",
    "Côte d'Ivoire",
    "Mali",
    "Burkina Faso",
    "Bénin",
    "Togo",
    "Gabon",
    "Tchad",
    "Niger",
    "Guinée",
    "Madagascar",
    "Éthiopie",
    "Ghana",
    "Nigeria",
    "Angola",
    "Zambie",
    "Zimbabwe",
    "Mozambique",
    "Afrique du Sud",
    "Maroc",
    "Algérie",
    "Tunisie",
    "Égypte",
    "Canada",
    "France",
    "Belgique",
    "Suisse",
    "Luxembourg",
    "États-Unis",
    "Royaume-Uni",
    "Autre",
];
/**
 * Pays de la grille Afrique (spec §12) — MÊME liste que le trigger
 * handle_new_user de supabase/schema.sql. Un pays hors de cette liste
 * (ou inconnu) relève de la grille Internationale.
 */
exports.PAYS_AFRIQUE = exports.PAYS.slice(0, 31);

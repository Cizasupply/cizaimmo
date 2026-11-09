"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prenomDe = prenomDe;
/**
 * Prénom affiché d'un utilisateur : premier mot de son nom complet
 * (le profil ne stocke qu'un seul champ `nom`, prénom + nom ensemble).
 *
 * Cas particuliers :
 * - nom vide ou absent → null (l'appelant n'affiche rien) ;
 * - nom synthétique = e-mail (co-propriétaire invité sans nom enregistré)
 *   → partie avant « @ », pour ne jamais saluer avec une adresse e-mail.
 */
function prenomDe(nom) {
    const propre = (nom ?? "").trim();
    if (!propre)
        return null;
    const base = propre.includes("@") ? propre.split("@")[0] : propre;
    // Sécurité : ne jamais saluer avec le préfixe technique « Démo — »
    // si un ancien nom enregistré le porte encore.
    const sansPrefixe = base.replace(/^\s*D[ée]mo\s*[—–-]\s*/i, "").trim();
    const premier = sansPrefixe.split(/\s+/)[0] ?? "";
    return premier || null;
}

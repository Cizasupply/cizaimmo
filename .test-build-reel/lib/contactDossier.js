"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contactDossierPourImmeuble = contactDossierPourImmeuble;
async function contactDossierPourImmeuble(provider, immeubleId) {
    const profil = await provider.getProfil().catch(() => null);
    if (!profil)
        return null;
    // Un gestionnaire connecté EST le contact attendu de ses immeubles.
    if (profil.role === "gestionnaire") {
        return { telephone: profil.telephone ?? null, email: profil.email };
    }
    if (immeubleId) {
        const invites = await provider.listerGestionnaires().catch(() => []);
        const gestionnaire = invites.find((g) => g.statut === "actif" && g.immeuble_ids.includes(immeubleId));
        if (gestionnaire) {
            return { telephone: null, email: gestionnaire.email };
        }
    }
    return { telephone: profil.telephone ?? null, email: profil.email };
}

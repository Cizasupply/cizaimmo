"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
/**
 * Route API PUBLIQUE — taux du convertisseur de la mini-grille tarifaire
 * de l'accueil (visiteur anonyme, sans compte).
 *
 * GET /api/taux/publics — aucune authentification : les taux de change
 * sont des données publiques. La table `taux_change` reste protégée par
 * RLS (un anonyme n'y lit rien) ; cette route interroge donc les deux
 * services gratuits sans clé via recupererTauxConvertisseur()
 * (Frankfurter prioritaire, ER-API en repli — appels mis en cache 1 h).
 *
 * Chaque ligne retournée porte la DATE de sa source : un taux daté
 * n'est jamais présenté comme un taux en direct. En cas d'échec des
 * deux sources, la route répond 502 et l'accueil affiche les prix en
 * USD — aucun taux n'est jamais inventé.
 */
const server_1 = require("next/server");
const taux_1 = require("@/lib/taux");
// Exécution à la demande : les appels amont sont eux-mêmes mis en
// cache (revalidate 3600 dans lib/taux.ts), pas la réponse complète.
exports.dynamic = "force-dynamic";
async function GET() {
    try {
        const taux = await (0, taux_1.recupererTauxConvertisseur)();
        return server_1.NextResponse.json({ taux });
    }
    catch {
        return server_1.NextResponse.json({ error: "taux_indisponible" }, { status: 502 });
    }
}

"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = exports.PLACEHOLDER_ANON_KEY = exports.PLACEHOLDER_URL = exports.DEMO_SESSION_COOKIE = void 0;
exports.getSupabaseEnv = getSupabaseEnv;
exports.isDemoMode = isDemoMode;
exports.getSupabaseBrowserClient = getSupabaseBrowserClient;
exports.createSupabaseServerClient = createSupabaseServerClient;
exports.createSupabaseMiddlewareClient = createSupabaseMiddlewareClient;
const ssr_1 = require("@supabase/ssr");
/**
 * CizaImmo — clients Supabase + détection du mode (Module 1).
 *
 * MODE DÉMO : si NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY
 * est absente ou vaut un placeholder évident, l'application fonctionne SANS
 * Supabase, avec des données de démonstration étiquetées DÉMO (voir
 * lib/data/demo.ts). Aucun appel réseau Supabase n'est émis dans ce mode.
 *
 * MODE RÉEL : les deux variables sont renseignées avec les valeurs du projet
 * Supabase (dans .env.local, jamais commité). Auth + RLS s'appliquent.
 *
 * RÈGLE DURE : aucun vrai secret n'est jamais écrit dans le code.
 */
/**
 * Nom du cookie de session DÉMO. Défini ICI (module léger) plutôt que
 * dans lib/data/demo.ts : le middleware (Edge Runtime) et les routes
 * API ne doivent importer que cette constante, sans tirer tout le
 * fournisseur démo — qui dépend depuis la v1.3 du générateur de
 * contrat (jsPDF, interdit en Edge Runtime).
 */
exports.DEMO_SESSION_COOKIE = "cizaimmo-demo-session";
exports.PLACEHOLDER_URL = "https://your-project.supabase.co";
exports.PLACEHOLDER_ANON_KEY = "your-anon-key-here";
function getSupabaseEnv() {
    return {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
}
/** Vrai si les variables Supabase sont absentes ou valent un placeholder. */
function isDemoMode() {
    const { url, anonKey } = getSupabaseEnv();
    if (!url || !anonKey)
        return true;
    if (url === exports.PLACEHOLDER_URL || url.includes("your-project"))
        return true;
    if (anonKey === exports.PLACEHOLDER_ANON_KEY || anonKey === "placeholder-anon-key")
        return true;
    return false;
}
/** Client navigateur (composants "use client"). Retourne null en mode démo. */
function getSupabaseBrowserClient() {
    if (isDemoMode())
        return null;
    const { url, anonKey } = getSupabaseEnv();
    return (0, ssr_1.createBrowserClient)(url, anonKey);
}
/**
 * Client serveur (Route Handlers / Server Components).
 * À appeler avec les cookies de la requête via next/headers.
 */
async function createSupabaseServerClient() {
    if (isDemoMode())
        return null;
    const { cookies } = await Promise.resolve().then(() => __importStar(require("next/headers")));
    const { url, anonKey } = getSupabaseEnv();
    const cookieStore = await cookies();
    return (0, ssr_1.createServerClient)(url, anonKey, {
        cookies: {
            getAll: () => cookieStore.getAll(),
            setAll: (cookiesToSet) => {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
                }
                catch {
                    // setAll appelé depuis un Server Component : ignoré (cas documenté
                    // par Supabase — le middleware rafraîchit la session).
                }
            },
        },
    });
}
/**
 * Client Supabase pour le middleware (Edge). Rafraîchit la session si besoin.
 * Retourne null en mode démo.
 */
function createSupabaseMiddlewareClient(req, res) {
    if (isDemoMode())
        return null;
    const { url, anonKey } = getSupabaseEnv();
    return (0, ssr_1.createServerClient)(url, anonKey, {
        cookies: {
            getAll: () => req.cookies.getAll(),
            setAll: (cookiesToSet) => {
                cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
            },
        },
    });
}
/**
 * Client historique (compatibilité avec le code pré-Module 1).
 * En mode démo, c'est un client placeholder qui ne sera jamais appelé
 * (la couche données bascule sur le fournisseur démo avant tout appel).
 * @deprecated Utiliser getSupabaseBrowserClient() / createSupabaseServerClient().
 */
exports.supabase = (0, ssr_1.createBrowserClient)(getSupabaseEnv().url ?? exports.PLACEHOLDER_URL, getSupabaseEnv().anonKey ?? exports.PLACEHOLDER_ANON_KEY);

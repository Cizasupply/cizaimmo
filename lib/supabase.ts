import { createBrowserClient, createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";

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
export const DEMO_SESSION_COOKIE = "cizaimmo-demo-session";

export const PLACEHOLDER_URL = "https://your-project.supabase.co";
export const PLACEHOLDER_ANON_KEY = "your-anon-key-here";

export function getSupabaseEnv(): { url: string | undefined; anonKey: string | undefined } {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

/** Vrai si les variables Supabase sont absentes ou valent un placeholder. */
export function isDemoMode(): boolean {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) return true;
  if (url === PLACEHOLDER_URL || url.includes("your-project")) return true;
  if (anonKey === PLACEHOLDER_ANON_KEY || anonKey === "placeholder-anon-key") return true;
  return false;
}

/** Client navigateur (composants "use client"). Retourne null en mode démo. */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (isDemoMode()) return null;
  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url as string, anonKey as string);
}

/**
 * Client serveur (Route Handlers / Server Components).
 * À appeler avec les cookies de la requête via next/headers.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient | null> {
  if (isDemoMode()) return null;
  const { cookies } = await import("next/headers");
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();
  return createServerClient(url as string, anonKey as string, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
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
export function createSupabaseMiddlewareClient(
  req: NextRequest,
  res: NextResponse
): SupabaseClient | null {
  if (isDemoMode()) return null;
  const { url, anonKey } = getSupabaseEnv();
  return createServerClient(url as string, anonKey as string, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        );
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
export const supabase: SupabaseClient = createBrowserClient(
  getSupabaseEnv().url ?? PLACEHOLDER_URL,
  getSupabaseEnv().anonKey ?? PLACEHOLDER_ANON_KEY
);

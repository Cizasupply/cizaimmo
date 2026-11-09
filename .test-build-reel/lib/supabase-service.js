"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupabaseServiceClient = getSupabaseServiceClient;
/**
 * Client Supabase « service_role » pour les webhooks (Module 5).
 *
 * Les webhooks (Stripe, mobile money) arrivent sans session utilisateur :
 * ils ne peuvent pas passer par la RLS. Ce client contourne la RLS et ne
 * doit être utilisé QUE dans les routes API webhook, jamais côté client.
 * Sans SUPABASE_SERVICE_ROLE_KEY, les webhooks accusent réception sans
 * appliquer de changement (applied: false) — jamais de fausse activation.
 */
const supabase_js_1 = require("@supabase/supabase-js");
function getSupabaseServiceClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || url.includes("your-project"))
        return null;
    if (!serviceKey || serviceKey.includes("placeholder"))
        return null;
    return (0, supabase_js_1.createClient)(url, serviceKey, { auth: { persistSession: false } });
}

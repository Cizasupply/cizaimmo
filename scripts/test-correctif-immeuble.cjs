// Test — Correctif « premier immeuble en réel » (2026-11-07).
//
// Bug vécu par la première cliente réelle (Kaneza, CIM-000002) :
// la création de son premier immeuble échouait avec le bandeau
// générique « Une erreur est survenue » et le bouton affichait la
// clé brute « crud.common.create ». Deux causes traitées :
//  A. i18n : clés utilisées mais absentes des messages —
//     crud.common.create (6 pages de création) et
//     crud.receipts.resendWhatsAppApi (page reçus). La parité
//     FR/EN seule ne les voyait pas ; le balayage complet des clés
//     utilisées vit dans scripts/i18n-cles-utilisees.py (branché
//     dans run-tests.sh). Ici : présence explicite des deux clés,
//     FR et EN, valeurs non vides.
//  B. Base : le payload d'insert d'un immeuble contient TOUJOURS
//     date_estimation et mode_acquisition (passeport), colonnes
//     définies UNIQUEMENT par la section « Module 6 » de
//     schema.sql. Le module correctif supabase/module-correctif-
//     immeuble.sql les ajoute en idempotent (ainsi que les autres
//     colonnes de la même section écrites par le code : statut des
//     co-propriétaires, whatsapp_statut des alertes, canal_whatsapp
//     des préférences) et réaffirme la garde d'écriture v1.4 +
//     les politiques d'écriture des immeubles. Ici : contenu du
//     module vérifié statiquement, et cohérence payload/colonnes
//     entre lib/data (ImmeubleInput) et l'ensemble des SQL.
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}

console.log("== A. i18n : les clés du bug sont présentes FR + EN ==");
const fr = JSON.parse(fs.readFileSync(path.join(RACINE, "messages/fr.json"), "utf-8"));
const en = JSON.parse(fs.readFileSync(path.join(RACINE, "messages/en.json"), "utf-8"));
check("fr : crud.common.create = « Créer »", fr.crud?.common?.create === "Créer", JSON.stringify(fr.crud?.common?.create));
check("en : crud.common.create = \"Create\"", en.crud?.common?.create === "Create", JSON.stringify(en.crud?.common?.create));
check("fr : crud.receipts.resendWhatsAppApi présent", typeof fr.crud?.receipts?.resendWhatsAppApi === "string" && fr.crud.receipts.resendWhatsAppApi.includes("API"));
check("en : crud.receipts.resendWhatsAppApi présent", typeof en.crud?.receipts?.resendWhatsAppApi === "string" && en.crud.receipts.resendWhatsAppApi.includes("API"));

console.log("== B. SQL correctif : colonnes passeport + garde réaffirmées ==");
const sqlCorr = fs.readFileSync(path.join(RACINE, "supabase/module-correctif-immeuble.sql"), "utf-8");
for (const col of ["date_estimation", "mode_acquisition", "quartier"]) {
  check(`module correctif : immeubles.${col} (add column if not exists)`,
    sqlCorr.includes(`add column if not exists ${col}`));
}
check("module correctif : coproprietaires.statut", sqlCorr.includes("add column if not exists statut"));
check("module correctif : alertes.whatsapp_statut", sqlCorr.includes("add column if not exists whatsapp_statut"));
check("module correctif : preferences_notifications.canal_whatsapp", sqlCorr.includes("add column if not exists canal_whatsapp"));
check("module correctif : garde abonnement_permets_ecriture recréée",
  sqlCorr.includes("create or replace function public.abonnement_permets_ecriture(p_owner uuid)"));
check("module correctif : garde — essai non expiré -> vrai",
  /when a\.statut = 'essai'\s+and a\.trial_ends_at is not null and a\.trial_ends_at > now\(\) then true/.test(sqlCorr));
for (const pol of ["immeubles_insert_owner", "immeubles_update", "immeubles_delete_owner"]) {
  check(`module correctif : politique ${pol} recréée avec la garde`,
    sqlCorr.includes(`create policy ${pol} on public.immeubles`) && sqlCorr.includes("abonnement_permets_ecriture"));
}

console.log("== C. Cohérence : chaque champ d'ImmeubleInput a sa colonne SQL ==");
// Colonnes connues de la table immeubles à travers schema.sql + modules.
// (v1.7 : proprietaire_declare_nom / proprietaire_declare_email sont
// définis par supabase/module-v17.sql — vérifié juste après.)
const colonnes = new Set([
  "id", "owner_id", "nom", "adresse", "ville", "pays", "devise", "type",
  "etages", "photo_url", "notes", "valeur_bien", "devise_valeur",
  "date_acquisition", "prix_acquisition", "statut", "created_at",
  "date_estimation", "mode_acquisition", "quartier",
  "proprietaire_declare_nom", "proprietaire_declare_email",
]);
const types = fs.readFileSync(path.join(RACINE, "lib/data/types.ts"), "utf-8");
const bloc = types.match(/export interface ImmeubleInput \{([\s\S]*?)\n\}/);
check("ImmeubleInput introuvable dans types.ts", !!bloc);
if (bloc) {
  const champs = [...bloc[1].matchAll(/^\s{2}(\w+)[?:]/gm)].map((m) => m[1]);
  check("ImmeubleInput : 18 champs attendus (16 + 2 déclarés v1.7)", champs.length === 18, `reçu ${champs.length} : ${champs.join(",")}`);
  for (const c of champs) {
    check(`champ ${c} -> colonne immeubles connue`, colonnes.has(c));
  }
}
// Les deux colonnes passeport doivent être définies par le SQL correctif
// OU par schema.sql (section Module 6) — jamais par le seul code.
const schema = fs.readFileSync(path.join(RACINE, "supabase/schema.sql"), "utf-8");
check("schema.sql définit date_estimation", schema.includes("add column if not exists date_estimation date"));
check("schema.sql définit mode_acquisition", schema.includes("add column if not exists mode_acquisition text"));
// v1.7 : les deux colonnes « propriétaire déclaré » viennent du SQL
// (module-v17), jamais du seul code.
const sqlV17 = fs.readFileSync(path.join(RACINE, "supabase/module-v17.sql"), "utf-8");
check("module-v17.sql définit proprietaire_declare_nom", sqlV17.includes("add column if not exists proprietaire_declare_nom"));
check("module-v17.sql définit proprietaire_declare_email", sqlV17.includes("add column if not exists proprietaire_declare_email"));

console.log(`\nRésultat : ${ok} OK, ${ko} KO`);
process.exit(ko ? 1 : 0);

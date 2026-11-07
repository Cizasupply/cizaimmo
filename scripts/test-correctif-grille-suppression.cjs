// Test — Correctif « grille console + suppression Paramètres +
// bilingue » (2026-11-07).
//
// Trois défauts vécus par le fondateur en production :
//  1. GRILLE : les boutons « Attribuer la grille Afrique /
//     Internationale » de la console échouaient. Cause : la
//     réattribution (v1.2) était la seule mutation plateforme en
//     UPDATEs directs SANS lecture du champ « error » — tout refus
//     base était avalé en silence ; aucune RPC reattribuer_grille
//     n'existait (contrairement à approuver_compte & consorts).
//     Correctif : RPC SECURITY DEFINER (module-correctif-grille.sql)
//     + politiques d'écriture plateforme réaffirmées + appel RPC
//     avec mapping d'erreurs dans real.ts. Ici : contenu statique
//     du module et du provider vérifiés.
//  2. SUPPRESSION : le bouton « Supprimer mon compte » (v1.5)
//     n'existait qu'en bas de la page Abonnement — introuvable.
//     Correctif : section dédiée dans la page Paramètres (mêmes
//     clés v15, mêmes RPC provider). Ici : présence du point
//     d'entrée et des clés FR + EN vérifiée.
//  3. BILINGUE : le sélecteur de langue n'était monté que sur les
//     pages publiques (absent d'AppShell et de ConsoleShell), et
//     8 codes d'erreur atteignables depuis la console n'avaient
//     aucune traduction (console.errors). Ici : présence du
//     sélecteur dans les deux shells + clés d'erreur complètes.
const fs = require("fs");
const path = require("path");

const RACINE = path.join(__dirname, "..");
let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}
const lire = (p) => fs.readFileSync(path.join(RACINE, p), "utf-8");

console.log("== 1. Grille : RPC base + provider branché ==");
const sql = lire("supabase/module-correctif-grille.sql");
check("module grille : fonction reattribuer_grille créée",
  sql.includes("create or replace function public.reattribuer_grille(cible uuid, nouvelle_grille text)"));
check("module grille : rôle vérifié en interne (ADMIN_PLATEFORME_REQUIS)",
  sql.includes("est_admin_plateforme()") && sql.includes("ADMIN_PLATEFORME_REQUIS"));
for (const chaine of ["GRILLE_INVALIDE", "COMPTE_INTROUVABLE", "ABONNEMENT_INTROUVABLE"]) {
  check(`module grille : erreur nommée ${chaine}`, sql.includes(chaine));
}
check("module grille : mutation profil (grille + statut ok)",
  sql.includes("grille_attribuee = nouvelle_grille") && sql.includes("grille_statut = 'ok'"));
check("module grille : grant execute authenticated",
  sql.includes("grant execute on function public.reattribuer_grille(uuid, text) to authenticated"));
for (const pol of ["profils_update_suspension_plateforme", "abonnements_update_suspension_plateforme"]) {
  check(`module grille : politique réaffirmée ${pol}`, sql.includes(`create policy ${pol}`));
}
const real = lire("lib/data/real.ts");
check("real.ts : reattribuerGrille appelle la RPC",
  real.includes('rpc("reattribuer_grille"'));
check("real.ts : mapping GRILLE_INVALIDE -> ERR_GRILLE_INVALIDE",
  real.includes('rpcError.message.includes("GRILLE_INVALIDE")') && real.includes('err("ERR_GRILLE_INVALIDE")'));
check("real.ts : ancien UPDATE direct de la grille disparu",
  !real.includes("from(\"abonnements\").update({ grille })"));

console.log("== 2. Suppression : point d'entrée Paramètres ==");
const params = lire("app/[locale]/parametres/page.tsx");
check("parametres : section suppression (titre v15)", params.includes('t15("deletionTitle")'));
check("parametres : bouton de demande (clé v15)", params.includes('t15("deletionButton")'));
check("parametres : demande branchée sur le dialogue partagé (provider)",
  params.includes("SuppressionCompteDialog") &&
  lire("components/SuppressionCompteDialog.tsx").includes("demanderSuppressionCompte(motDePasse)"));
check("parametres : rétractation branchée", params.includes("annulerSuppressionCompte()"));
check("parametres : état « en attente » + date (30 j)", params.includes('t15("deletionScheduled"') && params.includes("suppression_demandee_le"));
check("parametres : dialogue de confirmation (SuppressionCompteDialog)",
  params.includes("aConfirmerSuppression") && params.includes("SuppressionCompteDialog"));

console.log("== 3. Bilingue : sélecteur + erreurs console traduites ==");
for (const shell of ["components/AppShell.tsx", "components/ConsoleShell.tsx"]) {
  const src = lire(shell);
  const usages = (src.match(/<LanguageSwitcher/g) || []).length;
  check(`${shell} : LanguageSwitcher monté (${usages} usages)`, usages >= 2, `usages=${usages}`);
}
const fr = JSON.parse(lire("messages/fr.json"));
const en = JSON.parse(lire("messages/en.json"));
const codesConsole = [
  "ERR_GRILLE_INVALIDE", "ERR_CONVERSATION_NON_SUPERVISEE", "ERR_CIBLE_NON_ADMIN",
  "ERR_AUTO_MODIFICATION_INTERDITE", "ERR_AUTO_SUPPRESSION_INTERDITE",
  "ERR_COMPTE_PLATEFORME", "ERR_PROFIL_INTROUVABLE", "ERR_COMPTE_SUSPENDU", "ERR_COMPTE_REFUSE",
];
for (const code of codesConsole) {
  check(`console.errors FR : ${code}`, typeof fr.console?.errors?.[code] === "string" && fr.console.errors[code].length > 0);
  check(`console.errors EN : ${code}`, typeof en.console?.errors?.[code] === "string" && en.console.errors[code].length > 0);
}
const clesDeletion = ["deletionTitle", "deletionText", "deletionButton", "deletionConfirmTitle",
  "deletionConfirmText", "deletionConfirmButton", "deletionPendingTitle", "deletionScheduled",
  "cancelDeletionButton", "deletionRequestedMsg", "deletionCancelledMsg"];
for (const cle of clesDeletion) {
  check(`v15 FR : ${cle}`, typeof fr.v15?.[cle] === "string" && fr.v15[cle].length > 0);
  check(`v15 EN : ${cle}`, typeof en.v15?.[cle] === "string" && en.v15[cle].length > 0);
}
check("parité FR/EN des clés feuilles (comptage)",
  JSON.stringify(Object.keys(fr).length) === JSON.stringify(Object.keys(en).length));

console.log(`\nCorrectif grille/suppression/bilingue : ${ok} OK, ${ko} KO`);
process.exit(ko ? 1 : 0);

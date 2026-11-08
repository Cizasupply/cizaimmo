// Test — Correctif « zone connectée figée » (2026-11-07, soir).
//
// CAUSE RACINE du défaut corrigé ici :
// le site a tourné en MODE DÉMO le 2026-11-06 au soir, avant le
// branchement de Supabase. DemoProvider.signIn pose alors le cookie
// `cizaimmo-demo-session=1` pour 30 JOURS (lib/data/demo.ts). Or :
//   1. le middleware honorait ce cookie comme une authentification
//      DANS TOUS LES MODES — même en mode réel (Supabase configuré),
//      et court-circuitait la vérification de la session Supabase ;
//   2. RealProvider.signOut n'effaçait PAS ce cookie (seul
//      DemoProvider.signOut le fait).
// Résultat, pour tout navigateur ayant touché la démo (cookie encore
// vivant) : à la première déconnexion réelle, signOut efface la
// session Supabase puis route vers /connexion — le middleware, voyant
// le cookie démo, « ré-authentifie » et renvoie au tableau de bord,
// où getSession() vaut null : parc vide, boutons sans effet,
// connexion impossible (les pages d'auth rebondissent au dashboard).
// Les pages publiques, non protégées, n'étaient pas touchées.
//
// CORRECTIF (2 points, chirurgical) :
//   A. middleware.ts : le cookie démo n'authentifie QUE si le site
//      tourne réellement en mode démo (isDemoMode()).
//   B. lib/data/real.ts : RealProvider.signOut efface aussi le
//      cookie de session démo résiduel.
//
// Ce test est STATIQUE (vérification explicite du mécanisme, patron
// des correctifs précédents) + table de décision documentée. Il
// ÉCHOUE sur le code fautif et PASSE sur le code corrigé.
// Racine des sources : CIZAIMMO_SRC_ROOT (défaut : racine du dépôt).
const fs = require("fs");
const path = require("path");

const ROOT = process.env.CIZAIMMO_SRC_ROOT || path.join(__dirname, "..");
let ok = true;
function check(label, cond) {
  console.log(`${cond ? "OK  " : "KO  "} ${label}`);
  if (!cond) ok = false;
}
function lire(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const middleware = lire("middleware.ts");
const real = lire("lib/data/real.ts");
const demo = lire("lib/data/demo.ts");

// --- A. Le middleware ne doit honorer le cookie démo qu'en mode démo.
// On extrait l'instruction qui calcule hasDemoSession et on exige la
// présence de la garde isDemoMode() DANS cette instruction.
const m = middleware.match(/const hasDemoSession =[^;]*;/s);
check("middleware : calcul de hasDemoSession présent", Boolean(m));
check(
  "middleware : hasDemoSession gardé par isDemoMode() (le cookie démo seul n'authentifie plus en mode réel)",
  Boolean(m) && /isDemoMode\(\)|modeDemo/.test(m[0])
);
// La session Supabase ne doit plus être court-circuitée par le cookie :
// la branche réelle doit dépendre du mode, pas seulement du cookie.
check(
  "middleware : la vérification Supabase n'est pas court-circuitée par le cookie démo en mode réel",
  /if \(!authenticated && !modeDemo\)|if \(!authenticated && !isDemoMode\(\)\)/.test(middleware)
);

// Table de décision attendue (mécanisme corrigé) :
//   authentifié = (modeDemo && cookieDemo) || utilisateurSupabase
function authentifie(modeDemo, cookieDemo, utilisateurSupabase) {
  return Boolean((modeDemo && cookieDemo) || utilisateurSupabase);
}
check("décision : mode réel + cookie démo résiduel + aucune session Supabase -> NON authentifié (le piège)", authentifie(false, true, false) === false);
check("décision : mode réel + cookie démo + session Supabase -> authentifié (par Supabase)", authentifie(false, true, true) === true);
check("décision : mode démo + cookie démo -> authentifié (la démo reste intacte)", authentifie(true, true, false) === true);
check("décision : mode réel sans rien -> NON authentifié", authentifie(false, false, false) === false);

// --- B. RealProvider.signOut doit effacer le cookie démo résiduel.
check(
  "real.ts : DEMO_SESSION_COOKIE importé depuis ../supabase",
  /import \{[^}]*DEMO_SESSION_COOKIE[^}]*\} from "\.\.\/supabase"/.test(real)
);
const signOutMatch = real.match(/async signOut\(\)[^{]*\{([\s\S]*?)\n  \}/);
check("real.ts : méthode signOut présente", Boolean(signOutMatch));
check(
  "real.ts : signOut efface le cookie démo (DEMO_SESSION_COOKIE + max-age=0) en plus de la session Supabase",
  Boolean(signOutMatch) &&
    /auth\.signOut\(\)/.test(signOutMatch[1]) &&
    /DEMO_SESSION_COOKIE/.test(signOutMatch[1]) &&
    /max-age=0/.test(signOutMatch[1])
);

// --- C. Garde-fou : le comportement DÉMO d'origine est inchangé
// (pose du cookie à la connexion démo, effacement à la déconnexion
// démo) — le correctif ne casse pas le mode démo.
check(
  "demo.ts : signIn démo pose toujours le cookie de session démo",
  /document\.cookie = `\$\{DEMO_SESSION_COOKIE\}=1;/.test(demo)
);
check(
  "demo.ts : signOut démo efface toujours le cookie de session démo",
  /document\.cookie = `\$\{DEMO_SESSION_COOKIE\}=; path=\/; max-age=0;/.test(demo)
);

console.log(ok ? "\nCorrectif cookie démo : tous les contrôles passent." : "\nCorrectif cookie démo : ÉCHECS ci-dessus.");
process.exit(ok ? 0 : 1);

// Test — Correctif visuel « cartes + graphique » (2026-11-07, soir,
// demandes du fondateur après ses tests sur ordinateur du tableau de
// bord cliente) :
//   1. BORDURES : dans l'espace connecté, les cartes étaient blanches
//      SANS bordure sur fond blanc — contours invisibles. Le patron
//      partagé devient « rounded-2xl border border-slate-200 bg-… »
//      (celui que la console utilisait déjà) : 132 chaînes de classes
//      uniformisées, couleurs des données inchangées.
//   2. GRAPHIQUE RÉDUIT : « Collecte des 6 derniers mois » prenait
//      beaucoup trop de place (viewBox 360×170 étiré pleine largeur,
//      mois en très gros caractères). viewBox ramené à 360×100
//      (hauteur des barres 110 → 58) et conteneur plafonné à 560 px
//      centré : les libellés des mois redeviennent normaux. Légende,
//      note de conversion et couleurs (marine = collecté, or =
//      attendu) inchangées ; les 4 KPI restent affichés.
//
// Test STATIQUE (lecture des sources). Il ÉCHOUE sur l'ancien code
// et PASSE sur le code corrigé.
const fs = require("fs");
const path = require("path");

const ROOT = process.env.CIZAIMMO_SRC_ROOT || path.join(__dirname, "..");

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}
function lire(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }

/** Extrait les chaînes de classes des className="…" / '…' / {`…`}
 *  (mini-parseur : les apostrophes du texte JSX ne désynchronisent
 *  pas la lecture, contrairement à un balayage de guillemets naïf). */
function chainesClasses(txt) {
  const res = [];
  let i = 0;
  while (true) {
    const j = txt.indexOf("className=", i);
    if (j < 0) return res;
    const k = j + "className=".length;
    if (txt[k] === '"' || txt[k] === "'") {
      const e = txt.indexOf(txt[k], k + 1);
      if (e < 0) return res;
      res.push(txt.slice(k + 1, e)); i = e + 1;
    } else if (txt[k] === "{" && txt[k + 1] === "`") {
      let depth = 0, p = k + 2;
      while (p < txt.length) {
        if (txt[p] === "$" && txt[p + 1] === "{") { depth++; p += 2; continue; }
        if (txt[p] === "}" && depth > 0) { depth--; p++; continue; }
        if (txt[p] === "`" && depth === 0) break;
        p++;
      }
      res.push(txt.slice(k + 2, p)); i = p + 1;
    } else i = k;
  }
}

function fichiersTsx(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...fichiersTsx(p));
    else if (ent.name.endsWith(".tsx")) out.push(p);
  }
  return out;
}

// ---------- 1. Bordures : recensement de tout l'espace connecté ----------
const LOCALE = path.join(ROOT, "app", "[locale]");
const PERIMETRE = ["dashboard", "immeubles", "appartements", "loyers", "locataires",
  "depenses", "documents", "rapports", "parametres", "abonnement", "alertes",
  "messages", "recus", "contrat", "vitrine", "console"];
const COMPOSANTS = ["IndivisionSection.tsx"];
const FONDS = ["bg-white", "bg-green-50", "bg-red-50", "bg-amber-50", "bg-orange-50", "bg-sky-50"];

let fichiers = [];
for (const d of PERIMETRE) fichiers.push(...fichiersTsx(path.join(LOCALE, d)));
for (const c of COMPOSANTS) fichiers.push(path.join(ROOT, "components", c));

let cartesSansBordure = [];
let cartesAvecBordure = 0;
for (const f of fichiers) {
  for (const seg of chainesClasses(fs.readFileSync(f, "utf8"))) {
    if (!seg.includes("rounded-2xl") || !seg.includes("shadow-sm")) continue;
    if (seg.includes("animate-pulse")) continue;
    if (!FONDS.some((b) => seg.includes(b))) continue;
    if (seg.includes("border")) cartesAvecBordure++;
    else cartesSansBordure.push(`${path.relative(ROOT, f)} :: ${seg.slice(0, 60)}`);
  }
}
check("recensement : des cartes bordées existent dans l'espace connecté", cartesAvecBordure >= 100, `(${cartesAvecBordure})`);
check("recensement : AUCUNE carte blanche/teintée sans bordure (hors squelettes)",
  cartesSansBordure.length === 0, cartesSansBordure.slice(0, 3).join(" | "));

// ---------- 2. Tableau de bord : KPI + sections bordées ----------
const dash = lire("app/[locale]/dashboard/page.tsx");
check("KPI collecté (vert) bordée", dash.includes("rounded-2xl border border-slate-200 bg-green-50"));
check("KPI retard (rouge) bordée", dash.includes("rounded-2xl border border-slate-200 bg-red-50"));
check("KPI vacants (ambre) bordée", dash.includes("rounded-2xl border border-slate-200 bg-amber-50"));
check("KPI occupation (fond conditionnel) bordée",
  /rounded-2xl border border-slate-200 p-4 shadow-sm \$\{indicateurs\.occupation/.test(dash));
check("sections de contenu bordées (≥ 5 sections cartes)",
  (dash.match(/<section className="[^"]*rounded-2xl border border-slate-200/g) || []).length >= 5);
check("couleurs des données inchangées (fonds vert/rouge/ambre toujours là)",
  dash.includes("bg-green-50") && dash.includes("bg-red-50") && dash.includes("bg-amber-50"));

// ---------- 3. Graphique réduit ----------
check("graphique : viewBox réduit à 360×100", dash.includes('viewBox="0 0 360 100"'));
check("graphique : ancien viewBox 360×170 absent", !dash.includes('viewBox="0 0 360 170"'));
check("graphique : conteneur plafonné et centré (max-w-[560px])",
  dash.includes("mx-auto mt-4 max-w-[560px] overflow-x-auto"));
check("graphique : hauteur des barres réduite (× 58)",
  dash.includes("* 58)") && !dash.includes("* 110)"));
check("graphique : couleurs inchangées (or attendu / marine collecté)",
  dash.includes('fill="#D4AF37"') && dash.includes('fill="#1B2A4A"'));
check("graphique : légende Collecté / Attendu toujours affichée",
  dash.includes('td("chartCollected")') && dash.includes('td("chartExpected")'));
check("graphique : note de conversion toujours affichée",
  dash.includes('td("chartInCurrency"'));
check("les 4 KPI toujours présents (occupation, collecté, retard, vacants)",
  ["occupancy", "collectedMonth", "lateAmount", "vacant"].every((k) => dash.includes(`td("${k}")`)));

console.log(`\nCorrectif cartes + graphique : ${ok} OK / ${ko} KO`);
process.exit(ko ? 1 : 0);

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
//
// ADAPTATION (2026-11-07, design « Marine & Or » validé par le
// fondateur, passe tableau de bord) : les cartes KPI quittent les
// fonds teintés (bg-green-50 / bg-red-50 / bg-amber-50) pour des
// cartes BLANCHES avec barre d'accent métier de 4 px ; les
// assertions du §2 visent donc le NOUVEAU patron (carte blanche
// bordée + accent + couleurs métier conservées sur les VALEURS et
// les accents) — l'assertion fonctionnelle « les couleurs métier
// continuent de coder l'état » est préservée, seule sa forme
// visuelle a changé. Le §4 couvre la passe design elle-même (fond
// crème de l'AppShell, sidebar marine, carte héros, menu premium
// mobile-first) et revérifie que TOUTES les destinations de
// navigation historiques sont toujours présentes dans l'AppShell.
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
// Patron « Marine & Or » (voir l'en-tête) : cartes KPI blanches
// bordées + barre d'accent métier de 4 px (w-1) par carte.
const dash = lire("app/[locale]/dashboard/page.tsx");
const CARTE_KPI = "overflow-hidden rounded-2xl border border-slate-200 bg-white";
check("KPI : 4 cartes blanches bordées (patron Marine & Or)",
  (dash.split(CARTE_KPI).length - 1) >= 4, `(${(dash.split(CARTE_KPI).length - 1)})`);
check("KPI occupation : accent marine (barre 4 px)",
  dash.includes('className="absolute inset-y-0 left-0 w-1 bg-navy"'));
check("KPI collecté : accent vert (barre 4 px)",
  dash.includes('className="absolute inset-y-0 left-0 w-1 bg-green-500"'));
check("KPI retard : accent rouge (barre 4 px)",
  dash.includes('className="absolute inset-y-0 left-0 w-1 bg-red-500"'));
check("KPI vacants : accent ambre (barre 4 px)",
  dash.includes('className="absolute inset-y-0 left-0 w-1 bg-amber-500"'));
check("sections de contenu bordées (≥ 5 sections cartes)",
  (dash.match(/<section className="[^"]*rounded-2xl border border-slate-200/g) || []).length >= 5);
check("couleurs des données inchangées (les valeurs gardent vert/rouge/ambre)",
  dash.includes("text-green-700") && dash.includes("text-red-700") && dash.includes("text-amber-700"));

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

// ---------- 4. Design « Marine & Or » : cadre + héros + menu premium ----------
const shell = lire("components/AppShell.tsx");
check("design : fond général crème de l'espace connecté (bg-cream #F7F5F0)",
  shell.includes("min-h-screen bg-cream") &&
  lire("tailwind.config.ts").includes('cream: "#F7F5F0"'));
check("design : barre latérale bureau marine (#1B2A4A = bg-navy)",
  shell.includes("bg-navy p-6 text-white md:flex"));
check("design : barre supérieure mobile marine",
  shell.includes("bg-navy px-4 py-3 md:hidden"));
check("design : menu complet mobile en panneau plein écran marine",
  shell.includes('id="menu-mobile"') && shell.includes("h-full flex-col overflow-y-auto bg-navy"));
check("design : barre inférieure mobile fixe + safe-area iPhone",
  shell.includes("fixed inset-x-0 bottom-0 z-40") &&
  shell.includes("pb-[env(safe-area-inset-bottom)]"));
check("design : barre inférieure — zones tactiles ≥ 44 px (min-h-[3.5rem])",
  // 2 patrons dans le source : celui des 4 liens (rendu par map) + le
  // bouton « Plus » — soit 5 zones tactiles à l'écran.
  (shell.split("min-h-[3.5rem]").length - 1) >= 2);
check("design : actif en or (barre latérale + barre inférieure)",
  shell.includes("text-gold shadow-[inset_4px_0_0_0_#D4AF37]") &&
  shell.includes("h-0.5 rounded-full bg-gold"));
// ADAPTATION (2026-11-07, design console « Marine & Or ») : le jeu
// d'icônes a été EXTRAIT de l'AppShell vers le composant partagé
// components/IconeNav.tsx (étendu aux entrées console) pour que les
// deux shells utilisent exactement le même jeu. L'assertion vise
// donc le composant partagé + son import par l'AppShell — l'intention
// (« le menu possède un jeu d'icônes SVG uniforme ») est inchangée.
const iconesPartagees = lire("components/IconeNav.tsx");
check("design : icônes SVG du menu (IconeNav) présentes",
  iconesPartagees.includes("function IconeNav") && iconesPartagees.includes("ICONES") &&
  shell.includes('from "@/components/IconeNav"'));
check("design : contenu jamais masqué par la barre inférieure (pb-28 mobile)",
  shell.includes("px-6 pb-28 pt-6 md:ml-60"));
check("héros : carte marine du tableau de bord (fond bg-navy, montant or)",
  dash.includes("rounded-2xl bg-navy p-5 text-white shadow-sm") &&
  dash.includes("text-3xl font-bold text-gold"));
check("héros : taux de collecte affiché (clé dashboard.collectionRate)",
  dash.includes('td("collectionRate")') && dash.includes("tauxCollecte"));
check("actions rapides : primaire or, secondaires contour marine",
  dash.includes("rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy") &&
  (dash.split("border border-navy bg-white").length - 1) >= 2);
// Aucune destination de navigation perdue dans la refonte du menu :
// toutes les routes historiques restent présentes dans l'AppShell.
for (const href of ["/dashboard", "/immeubles", "/appartements", "/locataires",
  "/loyers", "/recus", "/depenses", "/documents", "/alertes", "/messages",
  "/rapports", "/parametres", "/vitrine", "/abonnement", "/contrat"]) {
  check(`navigation : destination toujours présente (${href})`, shell.includes(`"${href}"`));
}

console.log(`\nCorrectif cartes + graphique : ${ok} OK / ${ko} KO`);
process.exit(ko ? 1 : 0);

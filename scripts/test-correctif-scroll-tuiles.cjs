// Test — Correctif « ligne au scroll + tuiles statistiques »
// (2026-11-08, preuves du fondateur : enregistrement d'écran du
// tableau de bord client + capture du passeport de Kaneza Home).
//
// Défaut A — « Quand tu scroll, il y a une ligne qui passe au
// milieu » : bande marine translucide traversant l'écran pendant le
// défilement iOS, par-dessus les cartes, parfois dédoublée (la
// vraie barre restait en bas), parfois étirée. Coupable : la barre
// inférieure fixe des coques (AppShell / ConsoleShell), SEUL
// élément fixe visible pendant le défilement mobile, repeinte par
// WebKit à une position périmée faute de couche de composition
// propre. Correctif : classe .barre-fixe-ios (globals.css) —
// translateZ(0) + backface-visibility hidden — sur les deux barres ;
// fond marine plein, hauteurs et safe-area inchangés, aucun ancêtre
// transformé (balayage : ni backdrop-blur, ni sticky, ni
// transform/filter/perspective/will-change dans les coques).
//
// Défaut B — passeport du bien : « 300 000 000 BIF » débordait de
// sa tuile. Un montant formaté est un jeton INSECABLE (séparateurs
// U+202F + espace U+00A0) : ~146 px à text-xl pour ~107 px utiles.
// Traitement appliqué à TOUTES les tuiles statistiques et à tous
// les montants encore en break-all : whitespace-nowrap + taille
// par paliers + grilles minmax(0,1fr), format complet inchangé.
//
// Test STATIQUE (lecture des sources), même style que
// test-correctif-mobile-annotations.cjs.
const fs = require("fs");
const path = require("path");

const ROOT = process.env.CIZAIMMO_SRC_ROOT || path.join(__dirname, "..");

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}
function lire(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
function occurrences(s, motif) { return s.split(motif).length - 1; }

// ---------- A. Fantôme de barre au scroll (iOS) ----------
const css = lire("app/globals.css");
check("A : globals.css définit .barre-fixe-ios (translateZ(0))",
  css.includes(".barre-fixe-ios") && css.includes("transform: translateZ(0)"));
check("A : .barre-fixe-ios masque la face arrière (backface-visibility)",
  css.includes("backface-visibility: hidden"));

for (const [rel, nom] of [
  ["components/AppShell.tsx", "AppShell"],
  ["components/ConsoleShell.tsx", "ConsoleShell"],
]) {
  const src = lire(rel);
  check(`A : ${nom} — barre inférieure fixe promue en couche propre`,
    src.includes("barre-fixe-ios fixed inset-x-0 bottom-0"));
  check(`A : ${nom} — fond marine PLEIN conservé (bg-navy, pas de translucidité)`,
    src.includes("bg-navy pb-[env(safe-area-inset-bottom)]"));
  check(`A : ${nom} — safe-area et hauteur inchangées`,
    occurrences(src, "pb-[env(safe-area-inset-bottom)]") >= 1 &&
    src.includes("min-h-[3.5rem]"));
  check(`A : ${nom} — aucun backdrop-blur ni fond translucide`,
    !src.includes("backdrop-blur") && !src.includes("bg-navy/") && !src.includes("bg-white/"));
  check(`A : ${nom} — aucun transform/filter/will-change (ancêtre ou barre)`,
    !/translate-x|translate-y|scale-|will-change|perspective/.test(src));
}

// ---------- B1. Passeport du bien : les 6 tuiles ----------
const passeport = lire("app/[locale]/immeubles/[id]/page.tsx");
check("B : passeport — grille minmax(0,1fr), 3 colonnes à lg seulement",
  passeport.includes("grid grid-cols-2 gap-4 lg:grid-cols-3") &&
  !passeport.includes("grid grid-cols-2 gap-4 md:grid-cols-3"));
check("B : passeport — 6 tuiles en padding réduit mobile (p-3 sm:p-4)",
  occurrences(passeport, "rounded-xl bg-slate-50 p-3 sm:p-4") === 6);
check("B : passeport — 6 montants nowrap à taille par paliers (13px -> text-xl)",
  occurrences(passeport,
    "whitespace-nowrap text-[13px] font-bold text-navy min-[420px]:text-sm sm:text-base md:text-lg lg:text-xl") === 6);
check("B : passeport — plus aucun montant à l'ancien patron (text-xl nu)",
  !passeport.includes('className="text-xl font-bold text-navy"'));

// ---------- B2. Détail appartement ----------
const appart = lire("app/[locale]/appartements/[id]/page.tsx");
check("B : appartement — grille stats 4 colonnes à lg seulement",
  appart.includes("grid grid-cols-2 gap-4 lg:grid-cols-4"));
check("B : appartement — 4 valeurs nowrap par paliers (base -> lg:text-lg)",
  occurrences(appart,
    "whitespace-nowrap text-base font-bold text-navy lg:text-lg") === 4);

// ---------- B3. Indivision : répartition en tuiles ----------
const indivision = lire("components/IndivisionSection.tsx");
check("B : indivision — tuiles empilées sur mobile, 3 colonnes dès 560 px",
  indivision.includes("grid grid-cols-1 gap-3 text-center min-[560px]:grid-cols-3") &&
  !indivision.includes("grid grid-cols-3 gap-3 text-center"));
check("B : indivision — 3 montants nowrap par paliers",
  occurrences(indivision,
    "whitespace-nowrap text-base font-bold text-navy min-[560px]:text-xs min-[900px]:text-sm lg:text-base") === 3);

// ---------- B4. Plus aucun montant en break-all dans l'app ----------
for (const [rel, motif, nom] of [
  ["app/[locale]/loyers/page.tsx", "font-semibold whitespace-nowrap", "loyers — totaux du mois (4 lignes)"],
  ["app/[locale]/depenses/page.tsx", "shrink-0 whitespace-nowrap", "dépenses — totaux + lignes (3)"],
  ["app/[locale]/rapports/page.tsx", "whitespace-nowrap font-semibold", "rapports — cartes + lignes par immeuble (6)"],
  ["app/[locale]/dashboard/page.tsx", "shrink-0 whitespace-nowrap", "tableau de bord — dépenses du mois"],
  ["app/[locale]/immeubles/page.tsx", "whitespace-nowrap font-bold text-navy", "immeubles (liste) — loyers du mois"],
  ["app/[locale]/appartements/page.tsx", "mt-1 whitespace-nowrap text-base font-bold text-navy", "appartements (liste) — loyer"],
  ["app/[locale]/recus/page.tsx", "mt-1 whitespace-nowrap text-base font-bold", "reçus (liste) — montant"],
]) {
  const src = lire(rel);
  check(`B : ${nom} — montants en whitespace-nowrap`, src.includes(motif));
}
for (const rel of [
  "app/[locale]/loyers/page.tsx",
  "app/[locale]/depenses/page.tsx",
  "app/[locale]/rapports/page.tsx",
  "app/[locale]/immeubles/page.tsx",
  "app/[locale]/appartements/page.tsx",
  "app/[locale]/recus/page.tsx",
]) {
  const src = lire(rel);
  const lignesMontants = src.split("\n").filter(
    (l) => l.includes("break-all") && l.includes("formatMoney"));
  check(`B : ${rel.split("/").slice(-2).join("/")} — aucun montant résiduel en break-all`,
    lignesMontants.length === 0, lignesMontants.join(" | "));
}

console.log(`\nCorrectif scroll + tuiles : ${ok} OK / ${ko} KO`);
process.exit(ko ? 1 : 0);

// Test — Correctif « ligne au scroll + tuiles statistiques »
// (2026-11-08, preuves du fondateur : enregistrement d'écran du
// tableau de bord client + capture du passeport de Kaneza Home).
//
// Défaut A — « Quand tu scroll, il y a une ligne qui passe au
// milieu » : bande marine traversant l'écran pendant le défilement
// iOS. PASSE 1 (couche de composition .barre-fixe-ios, translateZ(0))
// INSUFFISANTE — le fondateur a confirmé sur son iPhone réel : « La
// barre de la video passe toujours ». PASSE 2, STRUCTURELLE : le
// mécanisme est SUPPRIMÉ. La barre inférieure mobile des coques
// n'est plus un élément fixed superposé au document qui défile :
// la coque mobile est une colonne flex h-dvh — [zone défilante
// flex-1 overflow-y-auto : barre supérieure + contenu] puis [barre
// inférieure DANS LE FLUX, flex-none]. Seule la zone du milieu
// défile, comme une application native. Bureau inchangé
// (md:contents dissout les enveloppes). La classe .barre-fixe-ios
// est retirée de globals.css et des coques ; la compensation pb-28
// du contenu disparaît avec la barre fixe.
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

// ---------- A. Fantôme de barre au scroll (iOS) — passe 2 structurelle ----------
const css = lire("app/globals.css");
check("A2 : globals.css — la RÈGLE .barre-fixe-ios est retirée (le mot ne reste qu'en commentaire)",
  !css.includes(".barre-fixe-ios {") && !css.includes("backface-visibility"));

for (const [rel, nom] of [
  ["components/AppShell.tsx", "AppShell"],
  ["components/ConsoleShell.tsx", "ConsoleShell"],
]) {
  const src = lire(rel);
  check(`A2 : ${nom} — racine mobile en colonne flex h-dvh (bureau restauré en md)`,
    src.includes("flex h-dvh flex-col bg-cream md:block md:h-auto md:min-h-screen"));
  check(`A2 : ${nom} — enveloppe flex + zone défilante interne (overflow-y-auto, md:contents)`,
    src.includes("flex min-h-0 flex-1 flex-col md:contents") &&
    src.includes("min-h-0 flex-1 overflow-y-auto md:contents"));
  check(`A2 : ${nom} — zone verrouillée quand le panneau « Plus » est ouvert`,
    src.includes("zoneDefilanteRef") && src.includes('zone.style.overflowY = "hidden"'));
  check(`A2 : ${nom} — barre inférieure DANS LE FLUX (plus aucun fixed, plus de .barre-fixe-ios)`,
    !src.includes("barre-fixe-ios") && !src.includes("fixed inset-x-0 bottom-0") &&
    src.includes("shrink-0 border-t border-white/10 bg-navy pb-[env(safe-area-inset-bottom)]"));
  check(`A2 : ${nom} — panneau « Plus » toujours fixed plein écran (hors zone défilante)`,
    /fixed inset-0 z-50 md:hidden/.test(src));
  check(`A2 : ${nom} — compensation pb-28 RETIRÉE, contenu en py-6 (fin atteignable, barre en flux)`,
    !src.includes("pb-28") && src.includes("px-6 py-6 md:ml-60 md:p-10"));
  check(`A2 : ${nom} — fond marine PLEIN conservé (bg-navy, pas de translucidité)`,
    src.includes("bg-navy pb-[env(safe-area-inset-bottom)]"));
  check(`A2 : ${nom} — safe-area et hauteur de barre inchangées`,
    occurrences(src, "pb-[env(safe-area-inset-bottom)]") >= 1 &&
    src.includes("min-h-[3.5rem]"));
  check(`A2 : ${nom} — aucun backdrop-blur ni fond translucide`,
    !src.includes("backdrop-blur") && !src.includes("bg-navy/") && !src.includes("bg-white/"));
  check(`A2 : ${nom} — aucun transform/filter/will-change (ancêtre ou barre)`,
    !/translate-x|translate-y|scale-|will-change|perspective/.test(src));
  check(`A2 : ${nom} — sidebar bureau fixe inchangée (hidden md:flex)`,
    src.includes("fixed inset-y-0 left-0 hidden w-60 flex-col bg-navy p-6 text-white md:flex"));
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

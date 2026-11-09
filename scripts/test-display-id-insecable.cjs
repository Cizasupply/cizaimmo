// Test — Micro-correctif capture fondateur (2026-11-08) :
// sur l'écran « Compte en attente d'approbation », le numéro de
// dossier (Display ID) s'affichait coupé en deux lignes dans son
// encadré (« CIM- » / « 000003 »). Le Display ID est désormais
// INSÉCABLE (whitespace-nowrap) sur cet écran, et la même
// discipline est appliquée partout où il est rendu comme une
// pastille ou un élément mis en avant du même patron (strong
// font-bold tracking-wide text-navy, ou pastille rounded-full) :
// page Contrat, section contrat propriétaire, console (comptes,
// dossier, mes dossiers, messages, suppressions, vitrine).
// Aucun texte modifié — seules des classes CSS changent.
// Test STATIQUE sur les fichiers sources.
const fs = require("fs");
const path = require("path");

const ROOT = process.env.CIZAIMMO_SRC_ROOT || path.join(__dirname, "..");

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}
function lire(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }

// 1. Écran d'attente (le défaut rapporté) : l'encadré or du
//    Display ID, strong insécable.
const appShell = lire("components/AppShell.tsx");
check("écran d'attente : Display ID insécable dans l'encadré",
  appShell.includes('<strong className="whitespace-nowrap text-base font-bold tracking-wide text-navy">'));

// 2. Même patron ailleurs (strong / pastille du Display ID).
const cibles = [
  ["app/[locale]/contrat/page.tsx",
   '<strong className="whitespace-nowrap font-bold tracking-wide text-navy">{displayId}</strong>',
   "page Contrat : Display ID insécable"],
  ["components/SectionContratProprietaire.tsx",
   '<strong className="whitespace-nowrap font-bold tracking-wide text-navy">{displayId}</strong>',
   "section contrat propriétaire : Display ID insécable"],
  ["app/[locale]/console/comptes/page.tsx",
   '<strong className="whitespace-nowrap font-bold tracking-wide text-navy">{compte.display_id}</strong>',
   "console comptes : Display ID insécable"],
  ["app/[locale]/console/comptes/[id]/page.tsx",
   // Bandeau de titre marine (2026-11-08) : le Display ID de
   // l'en-tête passe en accent OR sur fond marine — l'insécable
   // (whitespace-nowrap) est inchangé, seule la couleur change.
   '<strong className="whitespace-nowrap font-bold tracking-wide text-gold">{compte.display_id}</strong>',
   "console dossier : Display ID insécable"],
  ["app/[locale]/console/mes-dossiers/page.tsx",
   '<strong className="whitespace-nowrap font-bold tracking-wide text-navy">',
   "console mes dossiers : Display ID insécable"],
  ["app/[locale]/console/messages/page.tsx",
   '<strong className="ml-2 whitespace-nowrap text-sm font-bold tracking-wide text-navy">',
   "console messages : Display ID insécable"],
  ["app/[locale]/console/suppressions/page.tsx",
   '<td className="whitespace-nowrap px-4 py-3 font-bold tracking-wide text-navy">',
   "console suppressions : Display ID insécable"],
  ["app/[locale]/console/vitrine/page.tsx",
   '<span className="ml-2 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">',
   "console vitrine : pastille Display ID insécable"],
];
for (const [rel, motif, nom] of cibles) {
  check(nom, lire(rel).includes(motif), `(motif absent dans ${rel})`);
}

// 3. Aucun rendu « strong du patron » sans whitespace-nowrap ne
//    subsiste pour un Display ID (garde anti-régression globale).
const fichiers = [
  "components/AppShell.tsx",
  "app/[locale]/contrat/page.tsx",
  "components/SectionContratProprietaire.tsx",
  "app/[locale]/console/comptes/page.tsx",
  "app/[locale]/console/comptes/[id]/page.tsx",
  "app/[locale]/console/mes-dossiers/page.tsx",
  "app/[locale]/console/messages/page.tsx",
  "app/[locale]/console/suppressions/page.tsx",
];
let restants = 0;
for (const rel of fichiers) {
  const src = lire(rel);
  restants += src.split('className="font-bold tracking-wide text-navy"').length - 1;
  restants += src.split('className="ml-2 text-sm font-bold tracking-wide text-navy"').length - 1;
  restants += src.split('className="px-4 py-3 font-bold tracking-wide text-navy"').length - 1;
  restants += src.split('className="text-base font-bold tracking-wide text-navy"').length - 1;
}
check("aucun rendu du patron sans whitespace-nowrap ne subsiste", restants === 0,
  `(${restants} restant(s))`);

console.log(`\nDisplay ID insécable : ${ok} OK, ${ko} KO`);
process.exit(ko ? 1 : 0);

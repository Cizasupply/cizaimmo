// Test — Correctifs mobile « annotations du fondateur » (2026-11-08).
//
// Le fondateur a transmis 3 captures annotées au doigt sur son
// téléphone ; 4 défauts EXACTS, corrigés en une passe, design
// uniquement (aucune donnée, logique ni libellé touché) :
//   1. Console mobile, barre supérieure : la pastille texte
//      « Se déconnecter » débordait hors écran à droite. Barre
//      disciplinée : logo réduit (96 px), langue en pastille
//      compacte (variante `compact` du LanguageSwitcher : code
//      « EN » / « FR », nom complet en aria-label), déconnexion en
//      BOUTON ICÔNE SEUL dans la barre (le texte reste dans le
//      panneau « Plus » et le pied de sidebar bureau). Même
//      discipline vérifiée sur la barre supérieure de l'AppShell.
//   2. Console mobile, page Dossier : la carte « Identité »
//      débordait horizontalement (valeurs coupées au bord droit).
//      Grille des cartes en colonne unique explicite
//      (grid-cols-1 = minmax(0,1fr)), lignes libellé/valeur
//      enroulables (dt shrink-0, dd min-w-0 + break-words), listes
//      de documents/rattachements/audit assainies ; même famille
//      corrigée sur les grilles console sans colonne explicite
//      (messages supervisés, vitrine, finances, gestionnaires).
//   3. Client mobile, KPI « Montant en retard » : « 680 000 BIF »
//      cassait en plein milieu (« 680 000 B » / « IF », break-all).
//      Montants KPI en whitespace-nowrap + taille responsive
//      (réduite mobile, pleine dès sm) sur les 4 cartes du tableau
//      de bord client ET les cartes KPI console (Vue d'ensemble,
//      Comptes, Mes dossiers) ; break-all retiré de la carte héros
//      (un montant formaté est un jeton insécable) ; les sous-lignes
//      (≈ conversion) restent en flux normal.
//   4. Console mobile, héros Vue d'ensemble : les 3 libellés se
//      touchaient en 3 colonnes étroites — empilement sur mobile
//      (grid-cols-1), 3 colonnes dès sm, bureau inchangé.
//
// Test STATIQUE (lecture des sources), dans le style des autres
// tests design : il verrouille la présence des classes clés qui
// empêchent les débordements/coupures.
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

// ---------- 1. Barres supérieures mobiles : rien ne déborde ----------
const css = lire("app/globals.css");
const switcher = lire("components/LanguageSwitcher.tsx");
check("langue : variante compacte (code court, nom complet en aria-label)",
  switcher.includes("compact = false") && switcher.includes("otherLocale.toUpperCase()") &&
  switcher.includes('aria-label={`${t("language")}'));

const consoleShell = lire("components/ConsoleShell.tsx");
const enteteConsole = consoleShell.slice(
  consoleShell.indexOf("Barre supérieure mobile"),
  consoleShell.indexOf("Menu complet mobile")
);
check("console : barre supérieure — logo réduit (96 px)",
  enteteConsole.includes("width={96}"));
check("console : barre supérieure — langue en pastille compacte",
  enteteConsole.includes("<LanguageSwitcher compact"));
check("console : barre supérieure — déconnexion en bouton icône seul (aria-label, pas de texte)",
  enteteConsole.includes('aria-label={tc("logout")}') &&
  enteteConsole.includes('<IconeNav nom="logout"') &&
  !enteteConsole.includes('{tc("logout")}\n        </button>'));
check("console : déconnexion TEXTE toujours présente (panneau « Plus » + sidebar bureau)",
  occurrences(consoleShell, "{tc(\"logout\")}") >= 2);
check("console : badge Messages intact (compteur + recalcul à la navigation)",
  consoleShell.includes("compterMessagesPlateformeNonLus()") &&
  consoleShell.includes("[profil, pathname]"));

const appShell = lire("components/AppShell.tsx");
const enteteApp = appShell.slice(
  appShell.indexOf("Barre supérieure mobile"),
  appShell.indexOf("Menu complet mobile")
);
check("client : barre supérieure — logo réduit (96 px) + langue compacte",
  enteteApp.includes("width={96}") && enteteApp.includes("<LanguageSwitcher compact"));
check("client : barre supérieure — cloche et avatar icônes (largeur fixe)",
  enteteApp.includes("<AlertBell />") && enteteApp.includes("h-10 w-10 shrink-0"));

// ---------- 2. Page Dossier + grilles console : aucun débordement ----------
const dossier = lire("app/[locale]/console/comptes/[id]/page.tsx");
check("dossier : grille des cartes en colonne unique explicite (minmax(0,1fr))",
  dossier.includes("grid grid-cols-1 gap-6 lg:grid-cols-2"));
check("dossier : lignes libellé/valeur enroulables (flex-wrap, 11 lignes)",
  occurrences(dossier, "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5") === 11);
check("dossier : valeurs protégées (min-w-0 + break-words, 11 valeurs)",
  occurrences(dossier, '<dd className="min-w-0 break-words text-right">') === 11);
check("dossier : libellés jamais compressés (shrink-0, 12 libellés)",
  occurrences(dossier, '<dt className="shrink-0 font-semibold">') === 12);
check("dossier : documents — bloc nom réductible (flex-1, tronque réel)",
  occurrences(dossier, '<span className="min-w-0 flex-1 text-sm">') === 2);
check("dossier : aucune ancienne ligne rigide libellé/valeur",
  !dossier.includes('className="flex justify-between gap-3"'));

for (const [rel, motif] of [
  ["app/[locale]/console/messages-supervises/page.tsx", "grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]"],
  ["app/[locale]/console/vitrine/page.tsx", "grid grid-cols-1 gap-5 md:grid-cols-[240px_1fr]"],
  ["app/[locale]/console/finances/page.tsx", "grid grid-cols-1 gap-4 md:grid-cols-3"],
  ["app/[locale]/console/finances/page.tsx", "grid grid-cols-1 gap-4 md:grid-cols-2"],
  ["app/[locale]/console/gestionnaires/page.tsx", "grid grid-cols-1 gap-3 md:grid-cols-2"],
]) {
  check(`grille console explicite sur mobile (${rel.split("/").slice(-2).join("/")})`,
    lire(rel).includes(motif));
}

// ---------- 3. Montants KPI : jamais coupés en plein milieu ----------
const dash = lire("app/[locale]/dashboard/page.tsx");
check("client : plus AUCUN break-all sur les montants (héros + KPI)",
  !dash.includes("break-all text-3xl") && !dash.includes("break-all text-2xl"));
check("client : héros — montant entier (text-3xl conservé, sans break-all)",
  dash.includes('className="mt-1 text-3xl font-bold text-gold sm:text-4xl"'));
check("client : KPI montants en nowrap + taille responsive (collecté vert, retard rouge)",
  dash.includes("whitespace-nowrap text-xl font-bold text-green-700 sm:text-2xl") &&
  dash.includes("whitespace-nowrap text-xl font-bold text-red-700 sm:text-2xl"));
check("client : KPI valeurs en nowrap + taille responsive (occupation, retard 0, vacants)",
  occurrences(dash, "whitespace-nowrap text-2xl font-bold") >= 3 &&
  dash.includes("sm:text-3xl"));
check("client : sous-lignes de conversion (≈) en flux normal (wrapping libre)",
  dash.includes("block whitespace-normal break-words text-sm font-normal text-green-700") &&
  dash.includes("block whitespace-normal break-words text-sm font-normal text-red-700"));

const accueil = lire("app/[locale]/console/page.tsx");
check("console : KPI Vue d'ensemble — valeur nowrap + responsive",
  accueil.includes("whitespace-nowrap text-xl font-bold sm:text-2xl"));
check("console : KPI Comptes — valeur nowrap + responsive",
  lire("app/[locale]/console/comptes/page.tsx").includes(
    "whitespace-nowrap text-xl font-bold text-amber-600 sm:text-2xl"));
check("console : KPI Mes dossiers — valeur nowrap + responsive",
  lire("app/[locale]/console/mes-dossiers/page.tsx").includes(
    "whitespace-nowrap text-xl font-bold sm:text-2xl"));

// ---------- 4. Héros console : libellés jamais collés ----------
check("console : héros — empilé sur mobile, 3 colonnes dès sm",
  accueil.includes("grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-4") &&
  !accueil.includes('className="grid grid-cols-3 gap-4"'));
check("console : héros — chiffres or conservés (compteurs existants)",
  occurrences(accueil, "text-3xl font-bold text-gold") >= 3 &&
  accueil.includes("{enAttente.length}") && accueil.includes("{totalMessagesNonLus}"));

// ---------- 5. Défaut C — détail locataire : e-mail hors carte ----------
// Lot additionnel du fondateur (2026-11-08, interface EN, compte
// Kaneza) : la valeur Email « mcna2009@yahoo.ca » débordait de la
// carte « Contact details » — ligne libellé/valeur rigide (flex +
// dt w-40) et jeton insécable sans min-w-0, même cause que la carte
// Identité console. Traitement : dd en min-w-0 ; e-mail/téléphone en
// break-all ; le reste en break-words. Balayage même patron : page
// publique du locataire (lien) — ses 7 valeurs protégées aussi.
const locDetail = lire("app/[locale]/locataires/[id]/page.tsx");
check("C : détail locataire — e-mail en min-w-0 + break-all",
  locDetail.includes('<dd className="min-w-0 break-all">{locataire.email'));
check("C : détail locataire — téléphone en min-w-0 + break-all",
  locDetail.includes('<dd className="min-w-0 break-all font-semibold text-navy">{locataire.telephone}</dd>'));
check("C : détail locataire — toutes les valeurs de la carte protégées (6 dd)",
  occurrences(locDetail, "min-w-0 break-") >= 6 &&
  !locDetail.includes("<dd>{locataire.") && !locDetail.includes('<dd className="font-semibold text-navy">{locataire.telephone}</dd>'));
const pageLien = lire("app/[locale]/locataire/[token]/page.tsx");
check("C : page lien locataire — les 7 valeurs du bail en min-w-0 + break-words",
  occurrences(pageLien, "min-w-0 break-words font-semibold text-navy") === 7);

// ---------- 6. Défaut D — page Messages plus large que l'écran ----------
// La grille liste + fil n'avait pas de colonne mobile explicite :
// la piste implicite se dimensionnait au max-content le plus large
// et TOUTE la page dépassait l'écran (bandeau marine et sous-titre
// coupés à droite). Colonnes minmax(0,1fr), sections min-w-0 ;
// bureau inchangé (deux volets). Même normalisation sur la page
// console Messages supervisés.
const pageMessages = lire("app/[locale]/messages/page.tsx");
check("D : messages — grille en colonnes minmax(0,1fr) (mobile empilé, bureau 2 volets)",
  pageMessages.includes("grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]") &&
  !pageMessages.includes("lg:grid-cols-[320px_1fr]"));
check("D : messages — les deux sections en min-w-0, titre et sous-titre enroulables",
  occurrences(pageMessages, "min-w-0 rounded-2xl") === 2 &&
  pageMessages.includes("break-words text-lg font-semibold text-navy") &&
  pageMessages.includes("mb-4 mt-1 break-words text-sm text-slate-500"));
check("D : messages supervisés (console) — volet en minmax(0,1fr)",
  lire("app/[locale]/console/messages-supervises/page.tsx").includes("lg:grid-cols-[340px_minmax(0,1fr)]"));

// ---------- 7. Défaut E — champ DATE plus large que les autres ----------
// Dialogue « New expense » : le champ date dépassait à droite —
// largeur intrinsèque WebKit iOS des input[type=date]. Traitement :
// composant Field (racine + contrôle en min-w-0, contrôle en
// max-w-full), champs date bruts alignés (filtres Dépenses,
// Rapports) et garde-fou global dans globals.css.
const field = lire("components/Field.tsx");
check("E : Field — contrôle en w-full min-w-0 max-w-full, racine min-w-0",
  field.includes("w-full min-w-0 max-w-full") && field.includes('<div className="min-w-0">'));
check("E : globals.css — garde-fou global des champs date/heure",
  css.includes('input[type="date"]') && /input\[type="date"\][^{]*\{[^}]*min-width: 0/.test(css) &&
  /input\[type="date"\][^{]*\{[^}]*max-width: 100%/.test(css));
check("E : champs date bruts alignés (Dépenses filtres, Rapports)",
  occurrences(lire("app/[locale]/depenses/page.tsx"), "min-w-0 max-w-full") >= 2 &&
  occurrences(lire("app/[locale]/rapports/page.tsx"), "min-w-0 max-w-full") >= 2);
check("E : aucun input[type=date] hors patron (Field ou aligné)",
  occurrences(lire("app/[locale]/loyers/page.tsx"), 'type="date"') >= 0); // via Field (loyers, paramètres, formulaires)

console.log(`\nCorrectif mobile (annotations) : ${ok} OK / ${ko} KO`);
process.exit(ko ? 1 : 0);

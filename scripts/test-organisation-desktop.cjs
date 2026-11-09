// Test — Organisation desktop « ultra premium » des pages console
// (2026-11-08, ordre du fondateur sur captures bureau : trop
// d'espace vide sur écran large — cartes étirées pleine largeur,
// contenu collé à gauche).
//
// Traitement, DESKTOP SEULEMENT (préfixes lg:/xl:) :
//   1. ConsoleShell : contenu plafonné à 1600 px centré (md+),
//      coque mobile h-dvh et barre inférieure dans le flux
//      INCHANGÉES.
//   2. Dossier client : grille xl 3 colonnes — zone principale
//      (2 colonnes dès lg ; Identité large : photo à gauche,
//      définitions en 2 colonnes en xl ; Immeubles en cartes) +
//      Historique en colonne latérale timeline (sticky).
//   3. Finances : totaux en tuiles de statistiques (xl), lignes
//      de paie en grille xl 2 colonnes, dépenses = liste 2/3 +
//      formulaire 1/3 sticky (xl, ordre DOM inchangé).
//   4. Mon dossier employé : grilles xl 2 colonnes
//      (Identité | Adresse ; Coordonnées | Charte+Contrat ;
//      Carte centrée | Ma paie).
//   5. Vue d'ensemble : KPI 4 colonnes (existant) + Messages et
//      Activité récente côte à côte en xl.
//   6. Équipe : cartes membres en grille xl 2 colonnes,
//      formulaires côte à côte. Vérifier un employé : page
//      élargie, recherche/liste | fiche en xl. Messages console :
//      cartes en grille xl 2 colonnes.
//   7. Bordures de cartes teintées OR à 40 % (Marine & Or) via
//      les constantes CARTE et les patrons de cartes des pages —
//      le slate très pâle disparaît des cartes neutres ; les
//      bordures d'état (ambre/rouge/vert) sont inchangées.
//
// Test STATIQUE (lecture des sources) : présence des classes de
// grille bureau sur les sections ciblées ET présence des classes
// de base non préfixées (branches mobiles structurellement
// identiques). Aucune logique, donnée, route, libellé ni règle
// de périmètre par rôle n'est touché par la passe.
const fs = require("fs");
const path = require("path");

const ROOT = process.env.CIZAIMMO_SRC_ROOT || path.join(__dirname, "..");

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}
function lire(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
function contient(src, extrait) { return src.includes(extrait); }
function compte(src, extrait) { return src.split(extrait).length - 1; }

// ---------- 1. ConsoleShell : conteneur bureau, coque mobile intacte ----------
const shell = lire("components/ConsoleShell.tsx");
check("Shell : contenu plafonné 1600 px centré (md+)", contient(shell, "md:max-w-[1600px]"));
check("Shell : coque mobile h-dvh inchangée", contient(shell, "h-dvh"));
check("Shell : décalage sidebar bureau inchangé", contient(shell, "md:ml-60"));
check("Shell : barre inférieure mobile dans le flux (md:hidden conservé)", contient(shell, "md:hidden"));

// ---------- 2. Dossier client ----------
const dossier = lire("app/[locale]/console/comptes/[id]/page.tsx");
check("Dossier : grille bureau xl 3 colonnes", contient(dossier, "grid grid-cols-1 gap-6 xl:grid-cols-3"));
check("Dossier : zone principale 2 colonnes dès lg", contient(dossier, "content-start gap-6 lg:grid-cols-2"));
check("Dossier : Identité large (lg:col-span-2)", compte(dossier, "lg:col-span-2") >= 2);
check("Dossier : définitions Identité en 2 colonnes (xl)", contient(dossier, "xl:grid xl:grid-cols-2 xl:gap-x-8"));
check("Dossier : photo + informations côte à côte (lg:flex)", contient(dossier, "lg:flex lg:items-start lg:gap-6"));
check("Dossier : Immeubles en cartes (lg)", contient(dossier, "lg:grid lg:grid-cols-2 lg:gap-3"));
check("Dossier : Historique timeline latérale (xl:border-l + sticky)", contient(dossier, "xl:border-l") && contient(dossier, "xl:sticky xl:top-6"));
check("Dossier : bordures de sections teintées or", compte(dossier, "border-gold/40") >= 7);

// ---------- 3. Finances plateforme ----------
const fin = lire("app/[locale]/console/finances-plateforme/page.tsx");
check("Finances : patron CARTE teinté or", contient(fin, 'const CARTE = "rounded-2xl border border-gold/40 bg-white p-5 shadow-sm"'));
check("Finances : totaux en tuiles statistiques (xl 3 colonnes)", contient(fin, "xl:grid xl:grid-cols-3 xl:gap-2 xl:space-y-0"));
check("Finances : lignes de paie en grille xl 2 colonnes", contient(fin, "xl:grid xl:grid-cols-2 xl:gap-3 xl:space-y-0"));
check("Finances : dépenses liste 2/3 + formulaire 1/3 (xl:order)", contient(fin, "xl:order-2") && contient(fin, "xl:order-1 xl:col-span-2"));
check("Finances : formulaire sticky en colonne latérale", contient(fin, "xl:sticky xl:top-6 xl:grid-cols-1"));
check("Finances : racine mobile inchangée (pile space-y-5)", contient(fin, '<div className="space-y-5">'));

// ---------- 4. Mon dossier employé ----------
const monDossier = lire("app/[locale]/console/mon-dossier/page.tsx");
check("Mon dossier : patron CARTE teinté or", contient(monDossier, 'const CARTE = "rounded-2xl border border-gold/40 bg-white p-5 shadow-sm"'));
check("Mon dossier : grilles xl 2 colonnes (au moins 2 zones)", compte(monDossier, "xl:grid xl:grid-cols-2 xl:items-start xl:gap-5 xl:space-y-0") >= 2);
check("Mon dossier : base mobile conservée dans les grilles", contient(monDossier, '"space-y-5 xl:grid xl:grid-cols-2'));
check("Mon dossier : carte employé centrée en xl", contient(monDossier, "xl:flex xl:justify-center"));
check("Mon dossier : racine mobile inchangée (pile space-y-5)", contient(monDossier, '<div className="space-y-5">'));

// ---------- 5. Vue d'ensemble ----------
const vue = lire("app/[locale]/console/page.tsx");
check("Vue d'ensemble : bande KPI 4 colonnes (lg) conservée", contient(vue, "lg:grid-cols-4"));
check("Vue d'ensemble : Messages | Activité côte à côte (xl)", contient(vue, "xl:grid xl:grid-cols-2 xl:items-start xl:gap-6"));
check("Vue d'ensemble : file d'attente empilée sous Messages", contient(vue, "space-y-8 xl:space-y-6"));
check("Vue d'ensemble : cartes KPI teintées or", contient(vue, "border-gold/40"));

// ---------- 6. Équipe / Vérifier / Messages / Journal / Vitrine ----------
const equipe = lire("app/[locale]/console/admins/page.tsx");
check("Équipe : cartes membres en grille xl 2 colonnes", contient(equipe, "xl:grid xl:grid-cols-2 xl:items-start xl:gap-4 xl:space-y-0"));
check("Équipe : formulaires côte à côte (xl)", contient(equipe, "xl:grid xl:grid-cols-2 xl:items-start xl:gap-6"));

const verifier = lire("app/[locale]/console/verifier-employe/page.tsx");
check("Vérifier : page élargie en xl seulement", contient(verifier, "max-w-2xl xl:max-w-6xl"));
check("Vérifier : recherche/liste | fiche en xl 2 colonnes", contient(verifier, "xl:grid xl:grid-cols-2 xl:items-start xl:gap-5"));

const messages = lire("app/[locale]/console/messages/page.tsx");
check("Messages : cartes en grille xl 2 colonnes, pile mobile conservée", contient(messages, "mt-6 space-y-3 xl:grid xl:grid-cols-2 xl:items-start xl:gap-4 xl:space-y-0"));

const journal = lire("app/[locale]/console/journal/page.tsx");
check("Journal : tableau pleine largeur conservé (min-w-720)", contient(journal, "min-w-[720px]"));
check("Journal : pagination inchangée", contient(journal, "pagination.totalPages"));
check("Journal : cartes teintées or", contient(journal, "border-gold/40"));

const vitrine = lire("app/[locale]/console/vitrine/page.tsx");
check("Vitrine : cartes teintées or (structure dense inchangée)", contient(vitrine, "border-gold/40"));

// ---------- 7. Espace client : DossierBloc ----------
const dossierBloc = lire("components/DossierBloc.tsx");
check("DossierBloc client : bordure teintée or, structure inchangée", contient(dossierBloc, "rounded-xl border border-gold/40 p-3"));

console.log(`\nOrganisation desktop premium : ${ok} OK / ${ko} KO`);
process.exit(ko ? 1 : 0);

// Test — Design « Marine & Or premium » de la CONSOLE (2026-11-07,
// soir, ordre du fondateur : « Même chose pour Admin »).
//
// Après la validation du traitement complet sur l'espace client, la
// console (Admin + Super Admin) reçoit le MÊME traitement — elle
// n'avait eu que l'alignement léger (fond crème + titres) :
//   1. ConsoleShell : menu premium en parité avec l'AppShell client —
//      sidebar marine à icônes SVG (jeu partagé components/IconeNav,
//      extrait de l'AppShell et étendu aux entrées console), actif
//      or avec liseré, groupes Gestion / Supervision / Plateforme ;
//      mobile : barre supérieure marine + barre inférieure fixe
//      (Vue d'ensemble, Comptes, Messages + pastille, Journal,
//      « Plus » -> panneau plein écran marine) ; l'ancien tiroir
//      hamburger disparaît. La LOGIQUE du badge Messages (compteur
//      plateforme recalculé à la navigation) est INCHANGÉE — le test
//      badge dédié (test-console-messages-badge.cjs) continue de la
//      verrouiller ; ici on vérifie sa PRÉSENTATION étendue.
//   2. Vue d'ensemble : carte héros marine (compteurs DÉJÀ calculés
//      par la page : en attente, comptes, messages non lus) + KPI
//      blancs bordés à barre d'accent métier 4 px.
//   3. Pages console : UN primaire or par page (Approuver sur
//      Comptes + Dossier, Enregistrer sur Finances, Créer un Admin,
//      Approuver une annonce Vitrine ; « Ouvrir la supervision »
//      déjà or sur Gestionnaires, l'envoi du formulaire y devient
//      secondaire), autres boutons pleins marine -> secondaires
//      blanc/contour marine SemiBold, Refuser/destructeurs rouges
//      inchangés, états de sélection marine inchangés, en-têtes de
//      tableaux fond crème texte marine SemiBold (Journal,
//      Suppressions).
//
// Test STATIQUE (lecture des sources), dans le style des autres
// tests design. Aucune logique, donnée, route ni libellé vérifié
// ici ne doit avoir changé.
const fs = require("fs");
const path = require("path");

const ROOT = process.env.CIZAIMMO_SRC_ROOT || path.join(__dirname, "..");

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}
function lire(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }

const OR = "rounded-full bg-gold";
const SECONDAIRE = "border border-navy bg-white";

// ---------- 1. ConsoleShell : menu premium ----------
const shell = lire("components/ConsoleShell.tsx");
check("shell : jeu d'icônes partagé importé (components/IconeNav)",
  shell.includes('from "@/components/IconeNav"') && shell.includes("<IconeNav"));
check("shell : sidebar marine bureau (parité AppShell)",
  shell.includes("hidden w-60 flex-col bg-navy p-6 text-white md:flex"));
check("shell : actif or avec liseré (sidebar + panneau)",
  shell.includes("bg-navy-light font-semibold text-gold shadow-[inset_4px_0_0_0_#D4AF37]"));
check("shell : groupes Gestion / Supervision / Plateforme rendus",
  shell.includes('"groupManagement"') && shell.includes('"groupSupervision"') && shell.includes('"groupPlatform"'));
check("shell : barre supérieure mobile marine (plus de hamburger)",
  shell.includes("bg-navy px-4 py-3 md:hidden") && !shell.includes("☰"));
// ADAPTATION (2026-11-08, correctif structurel « bande au scroll »,
// passe 2) : la barre inférieure n'est plus `fixed` — elle est DANS
// LE FLUX d'une colonne h-dvh (zone défilante interne). L'intention
// (« barre inférieure mobile présente, safe-area respectée ») est
// inchangée ; le patron verrouillé est le nouveau mécanisme.
check("shell : barre inférieure mobile DANS LE FLUX + safe-area iPhone",
  !shell.includes("fixed inset-x-0 bottom-0") &&
  shell.includes("shrink-0 border-t border-white/10 bg-navy pb-[env(safe-area-inset-bottom)]"));
check("shell : barre inférieure — zones tactiles ≥ 44 px (min-h-[3.5rem], liens + « Plus »)",
  (shell.split("min-h-[3.5rem]").length - 1) >= 2);
check("shell : panneau « Plus » plein écran marine (un seul mécanisme de menu complet)",
  shell.includes('id="menu-console-mobile"') && shell.includes("h-full flex-col overflow-y-auto bg-navy"));
check("shell : contenu jamais masqué — barre en flux, zone défilante interne (plus de pb-28)",
  shell.includes("min-h-0 flex-1 overflow-y-auto md:contents") &&
  shell.includes("px-6 py-6 md:ml-60") && !shell.includes("pb-28"));
check("shell : badge Messages — logique inchangée (compteur plateforme, recalcul à la navigation)",
  shell.includes("compterMessagesPlateformeNonLus()") && shell.includes("nonLusMessages > 0") &&
  shell.includes("[profil, pathname]"));
check("shell : badge Messages — pastille AUSSI dans la barre inférieure mobile",
  (shell.split("nonLusMessages > 0 ? nonLusMessages : null").length - 1) >= 2);
check("shell : sélecteur de langue toujours monté (barre latérale + barre supérieure)",
  (shell.match(/<LanguageSwitcher/g) || []).length >= 2);
// Aucune destination de navigation console perdue dans la refonte :
// toutes les routes historiques restent présentes dans le shell.
for (const href of ["/console", "/console/comptes", "/console/gestionnaires",
  "/console/mes-dossiers", "/console/messages", "/console/messages-supervises",
  "/console/vitrine", "/console/journal", "/console/suppressions",
  "/console/admins", "/console/finances"]) {
  check(`navigation console : destination toujours présente (${href})`, shell.includes(`"${href}"`));
}
// Le jeu partagé couvre les entrées console.
const icones = lire("components/IconeNav.tsx");
for (const cle of ["overview", "accounts", "managers", "myFiles", "supervisedMessages",
  "journal", "suppressions", "admins", "finances"]) {
  check(`icônes partagées : entrée console couverte (${cle})`, icones.includes(`${cle}:`));
}

// ---------- 2. Vue d'ensemble : héros + KPI à accents ----------
const accueil = lire("app/[locale]/console/page.tsx");
check("vue d'ensemble : carte héros marine (fond bg-navy, chiffres or)",
  accueil.includes("rounded-2xl bg-navy p-5 text-white shadow-sm") &&
  (accueil.split("text-3xl font-bold text-gold").length - 1) >= 3);
check("vue d'ensemble : héros bâti sur les compteurs existants (enAttente, comptes, totalMessagesNonLus)",
  accueil.includes("{enAttente.length}") && accueil.includes("{comptes.length}") &&
  accueil.includes("{totalMessagesNonLus}"));
check("vue d'ensemble : KPI blancs bordés à accent métier (ambre attente, rouge retard, vert actif)",
  accueil.includes("bg-amber-500") && accueil.includes("bg-red-500") && accueil.includes("bg-green-500") &&
  accueil.includes("absolute inset-y-0 left-0 w-1"));
check("vue d'ensemble : bloc notification messages conservé (titre, boîte, compteur)",
  accueil.includes('t("unreadMessagesTitle")') && accueil.includes("/console/messages") &&
  accueil.includes('t("viewInbox")'));
check("vue d'ensemble : CTA devenus secondaires (plus aucun bouton plein marine)",
  !accueil.includes("bg-navy px-5 py-2 text-sm font-bold text-white") &&
  (accueil.split(SECONDAIRE).length - 1) >= 2);

// ---------- 3. Pages console : primaire or unique + secondaires ----------
const finances = lire("app/[locale]/console/finances/page.tsx");
check("finances : « Enregistrer » = primaire or",
  finances.includes(OR) && finances.includes('t("saveFinances")'));

const dossier = lire("app/[locale]/console/comptes/[id]/page.tsx");
check("dossier : « Approuver » = primaire or, garde checklist INCHANGÉE",
  dossier.includes(OR) && dossier.includes('t("approve")') &&
  dossier.includes("disabled={occupe || !checklistComplete}"));
check("dossier : Refuser reste rouge, Valider le contrat reste vert (validations secondaires)",
  dossier.includes("bg-red-600") && dossier.includes("bg-green-600"));
check("dossier : « Valider l'immeuble » (plein marine) devenu secondaire",
  dossier.includes(SECONDAIRE) && dossier.includes('t17("validateBuilding")'));

const comptes = lire("app/[locale]/console/comptes/page.tsx");
check("comptes : « Approuver » (file de revue) = primaire or",
  comptes.includes(OR) && comptes.includes('t("approve")'));
check("comptes : « Envoyer l'avis » devenu secondaire, filtres = sélection marine inchangée",
  comptes.includes(SECONDAIRE) && comptes.includes('t("sendNotice")') &&
  comptes.includes('"bg-navy text-white"'));
check("comptes : KPI non-assignés à accent ambre",
  comptes.includes('className="absolute inset-y-0 left-0 w-1 bg-amber-500"'));

const vitrine = lire("app/[locale]/console/vitrine/page.tsx");
check("vitrine : « Approuver » l'annonce = primaire or, Refuser reste rouge",
  vitrine.includes(OR) && vitrine.includes('t("approveButton")') && vitrine.includes("bg-red-600"));

const admins = lire("app/[locale]/console/admins/page.tsx");
check("admins : « Créer un Admin » = primaire or, « Promouvoir » secondaire",
  admins.includes(OR) && admins.includes('t("createAdminButton")') &&
  admins.includes(SECONDAIRE) && admins.includes('t("promoteButton")'));

const gestionnaires = lire("app/[locale]/console/gestionnaires/page.tsx");
check("gestionnaires : « Ouvrir la supervision » reste le primaire or, formulaire secondaire",
  gestionnaires.includes("rounded-full bg-gold px-4 py-2") &&
  gestionnaires.includes(SECONDAIRE) && gestionnaires.includes('t("createAttachmentButton")'));

const mesDossiers = lire("app/[locale]/console/mes-dossiers/page.tsx");
check("mes dossiers : cartes d'actions à accents métier (ambre, rouge, marine)",
  mesDossiers.includes("bg-amber-500") && mesDossiers.includes("bg-red-500") &&
  mesDossiers.includes("absolute inset-y-0 left-0 w-1"));

const journal = lire("app/[locale]/console/journal/page.tsx");
check("journal : en-tête de tableau fond crème, texte marine SemiBold",
  journal.includes("bg-cream text-xs font-semibold uppercase tracking-wide text-navy"));
const suppressions = lire("app/[locale]/console/suppressions/page.tsx");
check("suppressions : en-tête de tableau fond crème, exécution toujours rouge",
  suppressions.includes("bg-cream text-xs font-semibold uppercase tracking-wide text-navy") &&
  suppressions.includes("bg-red-600"));

const supervises = lire("app/[locale]/console/messages-supervises/page.tsx");
check("messages supervisés : état de sélection marine inchangé",
  supervises.includes('"bg-navy text-white"'));

// ---------- 4. i18n : groupes du menu console, parité FR = EN ----------
const fr = JSON.parse(lire("messages/fr.json"));
const en = JSON.parse(lire("messages/en.json"));
for (const cle of ["groupManagement", "groupSupervision", "groupPlatform"]) {
  check(`i18n : console.${cle} présent FR + EN`,
    typeof fr.console[cle] === "string" && fr.console[cle].length > 0 &&
    typeof en.console[cle] === "string" && en.console[cle].length > 0);
}

console.log(`\nDesign console « Marine & Or » : ${ok} OK / ${ko} KO`);
process.exit(ko ? 1 : 0);

// Test — Correctif journal d'audit (2026-11-07, demandes du fondateur).
//
// VÉCU EN PRODUCTION : la colonne DÉTAILS du journal affichait
// « tarifs: [object Object],[object Object],… » pour l'action
// « Tarifs modifiés » et « parametres: [object Object] » pour
// « Paramètres finance modifiés », parce que la page rendait chaque
// détail par un `String(v)` naïf : tout objet/tableau imbriqué du
// jsonb `details` devenait « [object Object] ». Les détails plats
// (« grille: afrique ») passaient inaperçus.
//
// CORRECTIF EN TROIS VOLETS (même livraison) :
//   1. Formateur partagé `formatDetailsAudit` (lib/format.ts) :
//      primitives telles quelles, objets en paires « clé : valeur »,
//      tableaux joints, forme « tarif » lue « afrique/starter : 1.99 »,
//      repli JSON compact — « [object Object] » impossible.
//   2. FILTRE INTELLIGENT sur la page Journal : recherche libre sur
//      le texte LISIBLE (détails formatés compris), filtres
//      combinables Action / Acteur / Période (helper pur
//      `periodeJournalContient`), compteur, réinitialisation.
//   3. ORGANISATION de la page : filtres en carte console, tableau
//      bureau sans débordement (détails en retour à la ligne),
//      cartes sur mobile (patron de l'app connectée).
//
// Ce test est FONCTIONNEL sur le formateur et la période (harnais
// compilé, TEST_BUILD_DIR) + STATIQUE sur la page et les clés i18n.
// Il ÉCHOUE sur le code fautif et PASSE sur le code corrigé.
const fs = require("fs");
const path = require("path");

const BUILD = process.env.TEST_BUILD_DIR || "/tmp/m7test";
const ROOT = process.env.CIZAIMMO_SRC_ROOT || path.join(__dirname, "..");

const { formatDetailsAudit, periodeJournalContient } = require(`${BUILD}/format.js`);

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}
function lire(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

// =====================================================================
console.log("== Formateur : détails plats (comportement historique conservé) ==");
check(
  "plat simple : { grille: 'afrique' } -> « grille : afrique »",
  formatDetailsAudit({ grille: "afrique" }, "fr") === "grille : afrique",
  `reçu « ${formatDetailsAudit({ grille: "afrique" }, "fr")} »`
);
check(
  "plat multiple : paires jointes par « · »",
  formatDetailsAudit({ grille: "internationale", motif: "documents_incomplets" }, "fr") ===
    "grille : internationale · motif : documents_incomplets"
);
check(
  "booléen localisé : FR « non », EN « no »",
  formatDetailsAudit({ penalites: false }, "fr") === "penalites : non" &&
    formatDetailsAudit({ penalites: false }, "en") === "penalites : no"
);

// =====================================================================
console.log("== Formateur : les deux cas VÉCUS en production ==");
const detailsTarifs = {
  tarifs: [
    { grille: "afrique", plan: "starter", prix_mensuel: 1.99 },
    { grille: "afrique", plan: "pro", prix_mensuel: 5.99 },
    { grille: "afrique", plan: "agence", prix_mensuel: 11.99 },
    { grille: "internationale", plan: "starter", prix_mensuel: 4.99 },
    { grille: "internationale", plan: "pro", prix_mensuel: 14.99 },
    { grille: "internationale", plan: "agence", prix_mensuel: 29.99 },
  ],
};
const renduTarifs = formatDetailsAudit(detailsTarifs, "fr");
check(
  "tarifs : chaque tarif se lit « grille/plan : prix »",
  renduTarifs ===
    "tarifs : afrique/starter : 1.99, afrique/pro : 5.99, afrique/agence : 11.99, " +
      "internationale/starter : 4.99, internationale/pro : 14.99, internationale/agence : 29.99",
  `reçu « ${renduTarifs} »`
);
check("tarifs : aucun « [object Object] »", !renduTarifs.includes("[object Object]"));

const detailsParametres = {
  parametres: {
    remise_annuelle_pct: 20,
    jours_essai: 30,
    jours_grace: 5,
    penalites_retard_actives: false,
    pays_grille_afrique: ["BI", "CD", "KE"],
    delai_approbation_affiche: "24 h ouvrées",
  },
};
const renduParams = formatDetailsAudit(detailsParametres, "fr");
check(
  "paramètres : objet imbriqué en paires lisibles (parenthèses, virgules)",
  renduParams ===
    "parametres : (remise_annuelle_pct : 20, jours_essai : 30, jours_grace : 5, " +
      "penalites_retard_actives : non, pays_grille_afrique : BI, CD, KE, " +
      "delai_approbation_affiche : 24 h ouvrées)",
  `reçu « ${renduParams} »`
);
check("paramètres : aucun « [object Object] »", !renduParams.includes("[object Object]"));

// =====================================================================
console.log("== Formateur : cas limites ==");
check("null -> chaîne vide", formatDetailsAudit(null, "fr") === "");
check("undefined -> chaîne vide", formatDetailsAudit(undefined, "fr") === "");
check("objet vide {} -> chaîne vide", formatDetailsAudit({}, "fr") === "");
check(
  "valeur null dans une paire -> « — », pas de crash",
  formatDetailsAudit({ note: null }, "fr") === "note : —"
);
check(
  "tableau de primitives joint par «, »",
  formatDetailsAudit({ pays: ["BI", "CD"] }, "fr") === "pays : BI, CD"
);
const profond = formatDetailsAudit({ a: { b: { c: { d: { e: 1 } } } } }, "fr");
check(
  "imbrication profonde : bornée, repli JSON, jamais « [object Object] »",
  !profond.includes("[object Object]") && profond.includes('"e":1'),
  `reçu « ${profond} »`
);
const grand = formatDetailsAudit(
  { codes: Array.from({ length: 25 }, (_, i) => `C${i}`) },
  "fr"
);
check(
  "grand tableau : tronqué proprement avec compteur « … +5 »",
  grand.endsWith("… +5") && !grand.includes("[object Object]"),
  `reçu « ${grand} »`
);

// =====================================================================
console.log("== Période du filtre (fonction pure) ==");
const maintenant = new Date("2026-11-07T22:30:00");
check("« tout » accepte n'importe quelle date", periodeJournalContient("2020-01-01T00:00:00", "tout", maintenant) === true);
check("« aujourdhui » : même jour -> oui", periodeJournalContient("2026-11-07T08:15:00", "aujourdhui", maintenant) === true);
check("« aujourdhui » : veille -> non", periodeJournalContient("2026-11-06T23:59:00", "aujourdhui", maintenant) === false);
check("« 7j » : il y a 3 jours -> oui", periodeJournalContient("2026-11-04T12:00:00", "7j", maintenant) === true);
check("« 7j » : il y a 10 jours -> non", periodeJournalContient("2026-10-28T12:00:00", "7j", maintenant) === false);
check("« 30j » : il y a 10 jours -> oui", periodeJournalContient("2026-10-28T12:00:00", "30j", maintenant) === true);
check("« 30j » : il y a 60 jours -> non", periodeJournalContient("2026-09-08T12:00:00", "30j", maintenant) === false);
check("date invalide hors « tout » -> non", periodeJournalContient("pas-une-date", "7j", maintenant) === false);

// =====================================================================
console.log("== Page Journal : formateur, filtre, organisation (statique) ==");
const page = lire("app/[locale]/console/journal/page.tsx");
check(
  "la page importe et utilise le formateur partagé formatDetailsAudit",
  /import \{[^}]*formatDetailsAudit[^}]*\} from "@\/lib\/format"/.test(page) &&
    (page.match(/formatDetailsAudit\(/g) || []).length >= 2
);
check(
  "l'ancien rendu naïf a disparu (plus de Object.entries(e.details) ni de String(v))",
  !page.includes("Object.entries(e.details)") && !page.includes("String(v)")
);
check(
  "filtre : états recherche / action / acteur / période présents",
  /useState\(""\)/.test(page) &&
    page.includes("setFiltreAction") &&
    page.includes("setFiltreActeur") &&
    page.includes("setPeriode")
);
check(
  "filtre : listes distinctes dérivées des entrées (actions + acteurs)",
  page.includes("actionsDistinctes") && page.includes("acteursDistincts") && page.includes("new Set(")
);
check(
  "filtre : la période passe par l'helper pur periodeJournalContient",
  page.includes("periodeJournalContient(e.created_at, periode, maintenant)")
);
check(
  "filtre : la recherche couvre le texte formaté des détails",
  page.includes("formatDetailsAudit(e.details, locale)") && page.includes("foin.includes(q)")
);
check(
  "filtre : compteur de résultats + réinitialisation câblés",
  page.includes('t("journalResultsCount"') && page.includes("reinitialiser") && page.includes('t("journalReset")')
);
check(
  // Bordure teintée or depuis l'organisation desktop 2026-11-08
  // (ajout du fondateur : bordures de cartes Marine & Or).
  "organisation : barre de filtres en carte console (rounded-2xl border bg-white)",
  /rounded-2xl border border-gold\/40 bg-white p-4/.test(page)
);
check(
  "organisation : tableau bureau (md:block) + cartes mobile (md:hidden), patron de l'app",
  page.includes("md:hidden") && page.includes("hidden overflow-x-auto") && page.includes("md:block")
);
check(
  "organisation : colonne détails SANS truncate, avec retour à la ligne (break-words)",
  !/max-w-\[\d+px\] truncate/.test(page) && page.includes("break-words")
);
check(
  "organisation : état vide propre après filtrage (journalNoResults)",
  page.includes('t("journalNoResults")')
);

// =====================================================================
console.log("== i18n : les nouveaux libellés existent en FR et en EN ==");
const fr = JSON.parse(lire("messages/fr.json"));
const en = JSON.parse(lire("messages/en.json"));
const cles = [
  "journalSearchLabel", "journalSearchPlaceholder", "journalFilterAction",
  "journalFilterActor", "journalFilterAllActions", "journalFilterAllActors",
  "journalFilterPeriod", "journalPeriodAll", "journalPeriodToday",
  "journalPeriod7d", "journalPeriod30d", "journalResultsCount",
  "journalNoResults", "journalReset",
];
for (const cle of cles) {
  check(
    `console.${cle} présent en FR et en EN`,
    typeof fr.console[cle] === "string" && typeof en.console[cle] === "string"
  );
}

console.log(`\nJournal détails + filtre : ${ok} OK, ${ko} KO.`);
process.exit(ko ? 1 : 0);

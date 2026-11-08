// Test — Cohérence héros ↔ KPI du tableau de bord (2026-11-07, soir,
// design « Marine & Or » déployé aux pages).
//
// BUG RÉEL (capture du fondateur, compte de Kaneza) : la carte héros
// affichait « Loyers collectés du mois : 0 BIF — Attendus : 0 BIF »
// alors que la carte KPI « Loyers collectés du mois » du MÊME écran
// affichait « Attendus : 680 000 BIF ». Cause : la fonction locale
// totauxConvertis de la page n'ajoutait au total converti QUE les
// groupes convertis (autre devise) ; un groupe déjà dans la devise
// d'affichage retournait tôt sans s'additionner — et le KPI, qui lit
// les LIGNES, restait juste pendant que le héros (qui lit le TOTAL)
// tombait à 0. Kaneza : tout en BIF, affichage BIF → total = 0.
//
// CORRECTIF : la fonction vit désormais dans lib/module4.ts
// (totauxConvertis) et la page l'utilise pour les TROIS agrégats
// (collectés, attendus, retards) : héros et KPI lisent les mêmes
// objets retournés — lignes pour les KPI, totalConverti pour le
// héros. Ce test verrouille :
//   1. (fonctionnel, harnais compilé) le cas Kaneza exact ;
//   2. les cas mixtes (même devise + devise convertie), le taux
//      manquant (total null, repli par lignes), et le taux de
//      collecte dérivé des mêmes totaux (0 % pour Kaneza) ;
//   3. (statique) la page n'a PLUS de fonction locale et importe
//      celle de lib/module4 pour héros ET KPI.
const fs = require("fs");
const path = require("path");

const BUILD = process.env.TEST_BUILD_DIR || "/tmp/m7test";
const ROOT = process.env.CIZAIMMO_SRC_ROOT || path.join(__dirname, "..");

const { totauxConvertis } = require(`${BUILD}/module4.js`);

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}

// Taux USD -> BIF (forme TauxChange réelle).
const TAUX_USD_BIF = [
  { id: "t1", devise_source: "USD", devise_cible: "BIF", taux: 2900, date_taux: "2026-11-06", source: "auto", created_at: "2026-11-06T00:00:00Z" },
];

(() => {
  console.log("== Cas Kaneza (régression exacte) : tout en BIF, affichage BIF ==");
  const attendus = totauxConvertis([{ devise: "BIF", total: 680000 }], "BIF", []);
  check("attendus : totalConverti = 680 000 (pas 0)", attendus.totalConverti === 680000, `reçu ${attendus.totalConverti}`);
  check("attendus : ligne BIF converti = 680 000", attendus.lignes.length === 1 && attendus.lignes[0].converti === 680000);
  const collectes = totauxConvertis([{ devise: "BIF", total: 0 }], "BIF", []);
  check("collectés : totalConverti = 0", collectes.totalConverti === 0, `reçu ${collectes.totalConverti}`);
  // Taux de collecte tel que la page le calcule (rapport des deux totaux).
  const tauxCollecte =
    collectes.totalConverti !== null && attendus.totalConverti !== null && attendus.totalConverti > 0
      ? collectes.totalConverti / attendus.totalConverti
      : null;
  check("taux de collecte Kaneza = 0 % (affiché, pas masqué)", tauxCollecte === 0, `reçu ${tauxCollecte}`);

  console.log("== Cohérence héros ↔ KPI : le total égale la somme des lignes converties ==");
  const cas = [
    { groupes: [{ devise: "BIF", total: 680000 }], affichage: "BIF", taux: [] },
    { groupes: [{ devise: "USD", total: 100 }], affichage: "BIF", taux: TAUX_USD_BIF },
    { groupes: [{ devise: "BIF", total: 50000 }, { devise: "USD", total: 100 }], affichage: "BIF", taux: TAUX_USD_BIF },
    { groupes: [{ devise: "USD", total: 250 }, { devise: "USD", total: 50 }], affichage: "USD", taux: [] },
    { groupes: [], affichage: "BIF", taux: [] },
  ];
  cas.forEach((c, i) => {
    const r = totauxConvertis(c.groupes, c.affichage, c.taux);
    const sommeLignes = r.lignes.reduce((s, l) => s + (l.converti ?? NaN), 0);
    check(`cas ${i + 1} : totalConverti = somme des lignes converties`, r.totalConverti === sommeLignes,
      `total=${r.totalConverti} somme=${sommeLignes}`);
  });

  console.log("== Cas mixte : même devise + convertie s'additionnent ==");
  const mixte = totauxConvertis(
    [{ devise: "BIF", total: 50000 }, { devise: "USD", total: 100 }],
    "BIF",
    TAUX_USD_BIF
  );
  check("mixte : total = 50 000 + 100×2900 = 340 000", mixte.totalConverti === 340000, `reçu ${mixte.totalConverti}`);
  check("mixte : la ligne convertie garde la date du taux", mixte.lignes[1].dateTaux === "2026-11-06");

  console.log("== Taux manquant : total null (repli héros par lignes), lignes intactes ==");
  const sansTaux = totauxConvertis(
    [{ devise: "BIF", total: 50000 }, { devise: "USD", total: 100 }],
    "BIF",
    []
  );
  check("sans taux : totalConverti = null", sansTaux.totalConverti === null);
  check("sans taux : la ligne BIF garde son total (ce que lit le KPI)", sansTaux.lignes[0].total === 50000 && sansTaux.lignes[0].converti === 50000);
  check("sans taux : la ligne USD a converti = null", sansTaux.lignes[1].converti === null);

  console.log("== Page : source unique héros + KPI (statique) ==");
  const dash = fs.readFileSync(path.join(ROOT, "app", "[locale]", "dashboard", "page.tsx"), "utf8");
  check("la page importe totauxConvertis depuis lib/module4",
    /from "@\/lib\/module4"/.test(dash) && dash.includes("totauxConvertis"));
  check("la page n'a PLUS de fonction locale totauxConvertis",
    !/function totauxConvertis\(/.test(dash));
  check("les 3 agrégats passent par la fonction partagée (collectés, attendus, retards)",
    (dash.match(/totauxConvertis\(indicateurs\./g) || []).length === 3,
    `reçu ${(dash.match(/totauxConvertis\(indicateurs\./g) || []).length}`);
  check("héros : lit attendusConv.totalConverti (même objet que les lignes du KPI)",
    dash.includes("attendusConv.totalConverti") && dash.includes("attendusConv.lignes"));
  check("héros : lit collectesConv.totalConverti", dash.includes("collectesConv.totalConverti"));

  console.log(`\n=== Cohérence héros/KPI : ${ok} OK, ${ko} KO ===`);
  process.exit(ko ? 1 : 0);
})();

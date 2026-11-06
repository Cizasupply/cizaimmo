// Test Module 7 — alertes bilingues (spec §14), parité i18n FR/EN,
// constantes de tarification et limites de blocs (spec §12).
// Harness compilé par scripts/run-tests.sh (TEST_BUILD_DIR) ou manuel :
//   npx tsc --outDir .test-build --module commonjs --target es2020 \
//     --esModuleInterop --skipLibCheck --moduleResolution node --rootDir lib \
//     lib/module4.ts lib/loyers.ts lib/format.ts lib/abonnement.ts \
//     lib/countries.ts lib/data/types.ts lib/data/helpers.ts lib/data/provider.ts
// Puis : node scripts/test-module7.cjs
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  },
};
globalThis.document = { cookie: "" };

// Harness compilé : TEST_BUILD_DIR (scripts/run-tests.sh) ou /tmp/m7test (manuel).
const BUILD = process.env.TEST_BUILD_DIR || "/tmp/m7test";

const M4 = require(`${BUILD}/module4.js`);
const A = require(`${BUILD}/abonnement.js`);
const { LIMITE_BLOCS } = require(`${BUILD}/data/types.js`);
const fs = require("fs");
const path = require("path");

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}

function cles(d, prefixe = "") {
  const out = new Set();
  for (const [k, v] of Object.entries(d)) {
    const p = prefixe ? `${prefixe}.${k}` : k;
    if (v && typeof v === "object") for (const s of cles(v, p)) out.add(s);
    else out.add(p);
  }
  return out;
}

(async () => {
  console.log("== Alertes bilingues (spec §14) ==");
  const base = {
    baux: [{ id: "b1", appartement_id: "a1", statut: "actif", debut: "2026-01-01", fin: "2026-12-06", jour_exigibilite: 3 }],
    echeances: [{ id: "e1", bail_id: "b1", mois: "2026-11-01", montant_du: 100000, devise: "BIF" }],
    paiements: [],
    appartements: [{ id: "a1", numero: "A1", statut: "vacant", created_at: "2026-01-01T00:00:00.000Z", archive: false }],
    abonnement: null,
    aujourdHui: new Date("2026-12-06T00:00:00"),
  };
  // Fin de bail J-30 : le bail finit le 2026-12-06, aujourd'hui 2026-11-06.
  const fr = M4.genererAlertesCandidates({ ...base, aujourdHui: new Date("2026-11-06T00:00:00"), langue: "fr" });
  const en = M4.genererAlertesCandidates({ ...base, aujourdHui: new Date("2026-11-06T00:00:00"), langue: "en" });
  const finFr = fr.find((a) => a.type === "fin_de_bail");
  const finEn = en.find((a) => a.type === "fin_de_bail");
  check("fin de bail J-30 en français", finFr?.message === "Fin de bail J-30 — 2026-12-06", finFr?.message ?? "absente");
  check("fin de bail J-30 en anglais", finEn?.message === "Lease ending J-30 — 2026-12-06", finEn?.message ?? "absente");
  check("même dedup_key FR/EN (pas de doublon)", finFr?.dedup_key === finEn?.dedup_key);
  // Loyer en retard : échéance nov. 2026, exigibilité le 3, grâce 5 j -> en retard dès le 9 nov.
  const retardFr = M4.genererAlertesCandidates({ ...base, aujourdHui: new Date("2026-11-10T00:00:00"), langue: "fr" })
    .find((a) => a.type === "loyer_en_retard");
  const retardEn = M4.genererAlertesCandidates({ ...base, aujourdHui: new Date("2026-11-10T00:00:00"), langue: "en" })
    .find((a) => a.type === "loyer_en_retard");
  check("loyer en retard FR", retardFr?.message === "Loyer en retard — échéance 2026-11, restant 100000 BIF", retardFr?.message ?? "absente");
  check("loyer en retard EN", retardEn?.message === "Late rent — due 2026-11, remaining 100000 BIF", retardEn?.message ?? "absente");
  // Défaut = français (compatibilité avec les appels existants).
  const defaut = M4.genererAlertesCandidates({ ...base, aujourdHui: new Date("2026-11-06T00:00:00") })
    .find((a) => a.type === "fin_de_bail");
  check("langue par défaut = français", defaut?.message === "Fin de bail J-30 — 2026-12-06", defaut?.message ?? "absente");

  console.log("== Tarifs et limites de blocs (spec §12) ==");
  check("Starter Afrique 1,99 $", A.PRIX_PLANS.starter.afrique === 1.99);
  check("Pro Afrique 5,99 $", A.PRIX_PLANS.pro.afrique === 5.99);
  check("Agence Afrique 11,99 $", A.PRIX_PLANS.agence.afrique === 11.99);
  check("Starter Internationale 4,99 $", A.PRIX_PLANS.starter.internationale === 4.99);
  check("Pro Internationale 14,99 $", A.PRIX_PLANS.pro.internationale === 14.99);
  check("Agence Internationale 29,99 $", A.PRIX_PLANS.agence.internationale === 29.99);
  check("Limite blocs Starter 1 / Pro 5 / Agence ∞",
    LIMITE_BLOCS.starter === 1 && LIMITE_BLOCS.pro === 5 && !Number.isFinite(LIMITE_BLOCS.agence));
  check("Essai 30 jours", A.ESSAI_JOURS === 30);
  check("Rétention lecture seule 90 jours", A.RETENTION_LECTURE_SEULE_JOURS === 90);

  console.log("== Parité i18n FR/EN (spec §14) ==");
  const racine = path.resolve(__dirname, "..");
  const frJson = JSON.parse(fs.readFileSync(path.join(racine, "messages", "fr.json"), "utf-8"));
  const enJson = JSON.parse(fs.readFileSync(path.join(racine, "messages", "en.json"), "utf-8"));
  const kf = cles(frJson), ke = cles(enJson);
  const manqueEn = [...kf].filter((k) => !ke.has(k));
  const manqueFr = [...ke].filter((k) => !kf.has(k));
  check("aucune clé FR sans EN", manqueEn.length === 0, manqueEn.join(", "));
  check("aucune clé EN sans FR", manqueFr.length === 0, manqueFr.join(", "));
  check("clés publiques module 7 présentes (tarifs/contact/legal)",
    ["pricingPage.title", "contact.title", "legal.privacy.title", "legal.terms.title",
     "legal.notice.title", "legal.cookies.title", "landing.howTitle", "landing.ctaTrial",
     "alerts.messageLateRent"].every((k) => kf.has(k) && ke.has(k)));
  check("aucun témoignage dans les dictionnaires",
    !JSON.stringify(frJson).toLowerCase().includes("témoignage") &&
    !JSON.stringify(enJson).toLowerCase().includes("testimonial"));

  console.log(`\nModule 7 : ${ok} OK, ${ko} KO`);
  process.exit(ko === 0 ? 0 : 1);
})();

// Test logique métier Module 3 — fournisseur démo + fonctions pures.
// localStorage simulé en mémoire (le fournisseur démo lit window.localStorage).
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  },
};
globalThis.document = { cookie: "" };

// Harness compilé : TEST_BUILD_DIR (scripts/run-tests.sh) ou /tmp/m3test (manuel).
const BUILD = process.env.TEST_BUILD_DIR || "/tmp/m3test";

const L = require(`${BUILD}/loyers.js`);
const { DemoProvider } = require(`${BUILD}/data/demo.js`);

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

(async () => {
  console.log("== Fonctions pures ==");
  // Prorata entrée : 280 000 × 17/31
  const p1 = L.calculerProrata({ debut: "2026-10-15", fin: "2027-10-14", loyer_mensuel: 280000 }, "2026-10-01");
  check("prorata entrée 17/31 = 153548", p1.montantDu === 153548 && p1.prorata && p1.detail === "17/31", JSON.stringify(p1));
  // Prorata sortie : fin le 10 nov., 300 000 × 10/30
  const p2 = L.calculerProrata({ debut: "2026-01-01", fin: "2026-11-10", loyer_mensuel: 300000 }, "2026-11-01");
  check("prorata sortie 10/30 = 100000", p2.montantDu === 100000 && p2.prorata, JSON.stringify(p2));
  // Mois plein : pas de prorata
  const p3 = L.calculerProrata({ debut: "2026-01-01", fin: "2026-12-31", loyer_mensuel: 450000 }, "2026-11-01");
  check("mois plein = loyer entier", p3.montantDu === 450000 && !p3.prorata, JSON.stringify(p3));

  // Statuts (aujourd'hui simulé)
  const S = (paye, du, jour, mois, date) =>
    L.calculerStatutEcheance({ montantDu: du, paye, jourExigibilite: jour, moisIso: mois, aujourdHui: new Date(date) });
  check("statut payé (plein)", S(450000, 450000, 5, "2026-11-01", "2026-11-06T12:00:00") === "paye");
  check("statut payé (trop-perçu)", S(500000, 450000, 5, "2026-11-01", "2026-11-06T12:00:00") === "paye");
  check("statut à venir (jour 20, le 6)", S(0, 280000, 20, "2026-11-01", "2026-11-06T12:00:00") === "a_venir");
  check("statut dû (jour 5, le 6, grâce jusqu'au 10)", S(0, 450000, 5, "2026-11-01", "2026-11-06T12:00:00") === "du");
  check("statut partiel (jour 5, le 6)", S(400000, 650000, 5, "2026-11-01", "2026-11-06T12:00:00") === "partiel");
  check("statut en retard (jour 5, le 11)", S(0, 450000, 5, "2026-11-01", "2026-11-11T12:00:00") === "en_retard");
  check("statut en retard même partiel (jour 5, le 11)", S(400000, 650000, 5, "2026-11-01", "2026-11-11T12:00:00") === "en_retard");
  check("statut dû le jour de grâce (jour 1, le 6)", S(0, 1250, 1, "2026-11-01", "2026-11-06T12:00:00") === "du");
  check("statut en retard le lendemain de la grâce (jour 1, le 7)", S(0, 1250, 1, "2026-11-01", "2026-11-07T12:00:00") === "en_retard");

  // Numérotation
  check("prochain numéro sans trou", L.prochainNumeroRecu(["CIM-2026-000006", null, "CIM-2025-000099"], 2026) === "CIM-2026-000007");
  check("prochain numéro vide", L.prochainNumeroRecu([], 2026) === "CIM-2026-000001");

  // Montants en lettres
  check("lettres FR 450000", L.nombreEnLettres(450000, "fr") === "quatre cent cinquante mille", L.nombreEnLettres(450000, "fr"));
  check("lettres FR 153548", L.nombreEnLettres(153548, "fr") === "cent cinquante-trois mille cinq cent quarante-huit", L.nombreEnLettres(153548, "fr"));
  check("lettres EN 1250", L.nombreEnLettres(1250, "en") === "one thousand two hundred fifty", L.nombreEnLettres(1250, "en"));
  check("lettres FR 980", L.nombreEnLettres(980, "fr") === "neuf cent quatre-vingts", L.nombreEnLettres(980, "fr"));

  console.log("== Fournisseur démo ==");
  const p = new DemoProvider();
  await p.signIn("demo@cizaimmo.com", "motdepasse");
  check("session démo ouverte", (await p.getSession()) !== null);

  // Génération idempotente — novembre déjà ensemencé (5 baux actifs)
  const nov1 = await p.genererEcheances("2026-11-01");
  const nov2 = await p.genererEcheances("2026-11-01");
  check("nov : 5 échéances", nov1.length === 5, `n=${nov1.length}`);
  check("nov : idempotente (2e appel = 5)", nov2.length === 5 && eq(nov1.map((e) => e.id).sort(), nov2.map((e) => e.id).sort()));
  const statutsNov = Object.fromEntries(nov1.map((e) => [e.bail_id.slice(-3), e.statut]));
  console.log("   statuts nov (par bail …501-505):", JSON.stringify(statutsNov));
  check("nov : statuts recalculés (payé/partiel/payé/à venir/dû)",
    statutsNov["501"] === "paye" && statutsNov["502"] === "partiel" && statutsNov["503"] === "paye" &&
    statutsNov["504"] === "a_venir" && statutsNov["505"] === "du", JSON.stringify(statutsNov));

  // Octobre : en retard présents
  const oct = await p.genererEcheances("2026-10-01");
  check("oct : 4 échéances", oct.length === 4, `n=${oct.length}`);
  const statutsOct = Object.fromEntries(oct.map((e) => [e.bail_id.slice(-3), e.statut]));
  check("oct : 2 en retard (502, 504)", statutsOct["502"] === "en_retard" && statutsOct["504"] === "en_retard", JSON.stringify(statutsOct));
  const ech504oct = oct.find((e) => e.bail_id.endsWith("504"));
  check("oct 504 : prorata 153548 (17/31)", ech504oct.montant_du === 153548 && ech504oct.prorata_detail === "17/31", JSON.stringify(ech504oct));

  // Décembre : génération d'un mois vierge, puis idempotence
  const dec1 = await p.genererEcheances("2026-12-01");
  const dec2 = await p.genererEcheances("2026-12-01");
  check("déc : 5 échéances créées", dec1.length === 5, `n=${dec1.length}`);
  check("déc : idempotente", dec2.length === 5 && eq(dec1.map((e) => e.id).sort(), dec2.map((e) => e.id).sort()));

  // Déclaration : montant nul refusé
  const ech505 = nov1.find((e) => e.bail_id.endsWith("505"));
  let errMontant = null;
  try { await p.declarerPaiement({ echeance_id: ech505.id, montant: 0, devise: "CAD", date_paiement: "2026-11-06", moyen: "especes" }); }
  catch (e) { errMontant = e.message; }
  check("montant 0 refusé (ERR_MONTANT_NON_POSITIF)", errMontant === "ERR_MONTANT_NON_POSITIF", errMontant);

  // Déclaration partielle puis totale sur 505 (980 CAD, dû)
  const d1 = await p.declarerPaiement({ echeance_id: ech505.id, montant: 500, devise: "CAD", date_paiement: "2026-11-06", moyen: "mobile_money", reference: "test-1" });
  check("reçu 1 = CIM-2026-000007", d1.recuNumero === "CIM-2026-000007", d1.recuNumero);
  let apres = (await p.listerEcheances({ mois: "2026-11-01" })).find((e) => e.id === ech505.id);
  check("après 500/980 : partiel", apres.statut === "partiel", apres.statut);
  const d2 = await p.declarerPaiement({ echeance_id: ech505.id, montant: 480, devise: "CAD", date_paiement: "2026-11-06", moyen: "especes" });
  check("reçu 2 = CIM-2026-000008", d2.recuNumero === "CIM-2026-000008", d2.recuNumero);
  apres = (await p.listerEcheances({ mois: "2026-11-01" })).find((e) => e.id === ech505.id);
  check("après 980/980 : payé", apres.statut === "paye", apres.statut);

  // Déclaration avec conversion (devise différente du bail)
  const ech501 = nov1.find((e) => e.bail_id.endsWith("501"));
  const d3 = await p.declarerPaiement({
    echeance_id: ech501.id, montant: 100, devise: "USD", date_paiement: "2026-11-06",
    moyen: "virement", taux_conversion: 2900, date_taux: "2026-11-05", montant_converti: 290000,
  });
  check("reçu conversion = CIM-2026-000009", d3.recuNumero === "CIM-2026-000009", d3.recuNumero);
  check("conversion stockée (taux + date + converti)",
    d3.paiement.taux_conversion === 2900 && d3.paiement.date_taux === "2026-11-05" && d3.paiement.montant_converti === 290000,
    JSON.stringify(d3.paiement));

  // Annulation : paiement + reçu annulés, statut recalculé
  const annule = await p.annulerPaiement(d1.paiement.id, "test annulation");
  check("annulation : statut annule + trace", annule.statut === "annule" && annule.motif_annulation === "test annulation" && !!annule.annule_le, JSON.stringify(annule));
  apres = (await p.listerEcheances({ mois: "2026-11-01" })).find((e) => e.id === ech505.id);
  check("après annulation 500 : partiel (480/980)", apres.statut === "partiel", apres.statut);
  let errDouble = null;
  try { await p.annulerPaiement(d1.paiement.id); } catch (e) { errDouble = e.message; }
  check("double annulation refusée", errDouble === "ERR_PAIEMENT_DEJA_ANNULE", errDouble);

  // Correction : annule l'ancien + nouveau numéro
  const corr = await p.corrigerPaiement(d2.paiement.id, { montant: 980, devise: "CAD", date_paiement: "2026-11-06", moyen: "especes" });
  check("correction : nouveau reçu CIM-2026-000010", corr.recuNumero === "CIM-2026-000010", corr.recuNumero);
  check("correction : remplace l'ancien", corr.paiement.remplace_paiement_id === d2.paiement.id);
  const ancienApres = (await p.listerPaiements(ech505.id)).find((x) => x.id === d2.paiement.id);
  check("correction : ancien paiement annulé", ancienApres.statut === "annule");
  apres = (await p.listerEcheances({ mois: "2026-11-01" })).find((e) => e.id === ech505.id);
  check("après correction 980/980 : payé", apres.statut === "paye", apres.statut);

  // Reçus : liste, recherche, annulés visibles
  const recus = await p.listerRecus();
  check("reçus : 6 initiaux + 4 nouveaux = 10", recus.length === 10, `n=${recus.length}`);
  const annules = recus.filter((r) => r.statut === "annule");
  check("reçus annulés visibles (3 : seed + 2 du test)", annules.length === 3, annules.map((r) => r.numero).join(","));
  check("ancien reçu annulé conservé (CIM-2026-000003)", recus.some((r) => r.numero === "CIM-2026-000003" && r.statut === "annule"));
  const recherche = await p.listerRecus({ recherche: "CIM-2026-000007" });
  check("recherche par numéro", recherche.length === 1 && recherche[0].locataire_nom === "Sophie Gagnon", JSON.stringify(recherche.map((r) => r.locataire_nom)));
  const prochain = await p.prochainNumeroRecu();
  check("prochain numéro = CIM-2026-000011", prochain === "CIM-2026-000011", prochain);

  console.log(`\nRésultat : ${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error("ERREUR TEST", e); process.exit(2); });

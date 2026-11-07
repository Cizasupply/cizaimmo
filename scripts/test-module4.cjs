// Test logique métier Module 4 — fournisseur démo + fonctions pures.
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

// Harness compilé : TEST_BUILD_DIR (scripts/run-tests.sh) ou /tmp/m4test (manuel).
const BUILD = process.env.TEST_BUILD_DIR || "/tmp/m4test";

const M4 = require(`${BUILD}/module4.js`);
const { DemoProvider } = require(`${BUILD}/data/demo.js`);
const XLSX = require("xlsx");
const { buildLoyersWorkbook, buildDepensesWorkbook, buildLocatairesWorkbook, buildRapportWorkbook } = require(`${BUILD}/exports.js`);
const { emailConfigure, envoyerEmailAlerte } = require(`${BUILD}/email.js`);
const { calculerRoi, calculerMargeNette } = require(`${BUILD}/format.js`);

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}
function approx(a, b, eps = 1e-6) { return Math.abs(a - b) < eps; }

(async () => {
  console.log("== Fonctions pures : ROI / marge ==");
  check("ROI (1300000-120000)/180000000", approx(calculerRoi(1300000, 120000, 180000000), 1180000 / 180000000));
  check("ROI sans valeur = null (jamais inventé)", calculerRoi(1000, 100, null) === null && calculerRoi(1000, 100, 0) === null);
  check("marge nette séparée du ROI", approx(calculerMargeNette(1300000, 120000), 1180000 / 1300000));
  check("marge sans revenus = null", calculerMargeNette(0, 100) === null);

  console.log("== Taux (direct / inverse / pivot / absent) ==");
  const tauxSeed = [
    { devise_source: "USD", devise_cible: "BIF", taux: 2900, date_taux: "2026-11-05", source: "auto" },
    { devise_source: "USD", devise_cible: "CAD", taux: 1.39, date_taux: "2026-11-05", source: "auto" },
    { devise_source: "USD", devise_cible: "EUR", taux: 0.86, date_taux: "2026-11-05", source: "auto" },
  ];
  const t1 = M4.trouverTaux(tauxSeed, "USD", "BIF");
  check("USD->BIF direct 2900, daté, auto", t1 && t1.taux === 2900 && t1.date_taux === "2026-11-05" && t1.source === "auto", JSON.stringify(t1));
  const t2 = M4.trouverTaux(tauxSeed, "BIF", "USD");
  check("BIF->USD inverse 1/2900", t2 && approx(t2.taux, 1 / 2900), JSON.stringify(t2));
  const t3 = M4.trouverTaux(tauxSeed, "CAD", "USD");
  check("CAD->USD inverse 1/1.39", t3 && approx(t3.taux, 1 / 1.39), JSON.stringify(t3));
  check("GBP->BIF = null (jamais inventé)", M4.trouverTaux(tauxSeed, "GBP", "BIF") === null);
  check("même devise = null", M4.trouverTaux(tauxSeed, "USD", "USD") === null);

  console.log("== Alertes candidates (pures, dates simulées) ==");
  const p = new DemoProvider();
  await p.signIn("demo@cizaimmo.com", "motdepasse");
  const db = p.getDemoDb();
  const auJour = (iso) => new Date(iso + "T12:00:00");
  const base = { baux: db.baux, echeances: db.echeances, paiements: db.paiements, appartements: db.appartements, abonnement: db.abonnement };
  const candJ60 = M4.genererAlertesCandidates({ ...base, aujourdHui: auJour("2026-11-01") });
  check("fin de bail J-60 (501, fin 2026-12-31, le 2026-11-01)", candJ60.some((c) => c.type === "fin_de_bail" && c.dedup_key === "fin_de_bail:00000000-0000-4000-8000-000000000501:J-60"), JSON.stringify(candJ60.map((c) => c.dedup_key)));
  const candJ30 = M4.genererAlertesCandidates({ ...base, aujourdHui: auJour("2026-12-01") });
  check("fin de bail J-30 (le 2026-12-01)", candJ30.some((c) => c.dedup_key.includes(":J-30")));
  const candJ7 = M4.genererAlertesCandidates({ ...base, aujourdHui: auJour("2026-12-24") });
  check("fin de bail J-7 (le 2026-12-24)", candJ7.some((c) => c.dedup_key.includes(":J-7")));
  const candRetard = M4.genererAlertesCandidates({ ...base, aujourdHui: auJour("2026-11-06") });
  check("retard oct. 502 (grâce 10 oct. dépassée)", candRetard.some((c) => c.type === "loyer_en_retard" && c.entite_id.endsWith("612")));
  check("retard oct. 504 prorata (grâce 25 oct. dépassée)", candRetard.some((c) => c.type === "loyer_en_retard" && c.entite_id.endsWith("614")));
  check("pas de retard nov. 502 le 6 nov. (grâce jusqu'au 10)", !candRetard.some((c) => c.type === "loyer_en_retard" && c.entite_id.endsWith("602")));
  check("vacance prolongée A4 (> 30 j depuis le 20 sept.)", candRetard.some((c) => c.type === "vacance_prolongee" && c.entite_id.endsWith("307")));
  const candEssai = M4.genererAlertesCandidates({ ...base, abonnement: { ...db.abonnement, trial_ends_at: "2026-11-13T00:00:00.000Z" }, aujourdHui: auJour("2026-11-06") });
  check("essai J-7 (fin 13 nov., le 6 nov.)", candEssai.some((c) => c.type === "essai_abonnement" && c.dedup_key.includes(":J-7")));
  const candDemarrant = M4.genererAlertesCandidates({ ...base, baux: [...db.baux, { ...db.baux[0], id: "bail-futur", debut: "2026-11-07", fin: "2027-11-06", statut: "actif" }], aujourdHui: auJour("2026-11-06") });
  check("bail démarrant (la veille)", candDemarrant.some((c) => c.type === "bail_demarrant" && c.entite_id === "bail-futur"));

  console.log("== Fournisseur démo : indicateurs novembre 2026 ==");
  const ind = M4.calculerIndicateurs({
    immeubles: db.immeubles, appartements: db.appartements, baux: db.baux,
    echeances: db.echeances, paiements: db.paiements, depenses: db.depenses,
    moisIso: "2026-11-01", aujourdHui: auJour("2026-11-06"),
  });
  // v1.6 : le seed a gagné un 7e appartement vacant (n° 201, Bloc
  // Saint-Laurent — l'annonce en attente de validation de la vitrine
  // vérifiée). Les indicateurs suivent la fixture : 5 occupés / 7,
  // 2 vacants (A4 + 201). Le calcul lui-même est inchangé.
  check("occupation 5/7 (A4 + 201 vacants)", approx(ind.occupation, 5 / 7), String(ind.occupation));
  check("vacants = 2 (A4 + 201)", ind.nbVacants === 2, String(ind.nbVacants));
  const colBif = ind.collectes.find((c) => c.devise === "BIF");
  const colCad = ind.collectes.find((c) => c.devise === "CAD");
  check("collectés nov. BIF 850 000", colBif && colBif.total === 850000, JSON.stringify(ind.collectes));
  check("collectés nov. CAD 1 250", colCad && colCad.total === 1250, JSON.stringify(ind.collectes));
  const attBif = ind.attendus.find((c) => c.devise === "BIF");
  const attCad = ind.attendus.find((c) => c.devise === "CAD");
  check("attendus nov. BIF 1 380 000", attBif && attBif.total === 1380000, JSON.stringify(ind.attendus));
  check("attendus nov. CAD 2 230", attCad && attCad.total === 2230, JSON.stringify(ind.attendus));
  const retBif = ind.enRetard.find((c) => c.devise === "BIF");
  check("en retard BIF 803 548 (650 000 + 153 548)", retBif && retBif.total === 803548, JSON.stringify(ind.enRetard));
  check("retards listés = 2 (oct. 502, 504)", ind.retards.length === 2, String(ind.retards.length));
  check("fins de bail 60 j : 501 (fin 31 déc.)", ind.finsDeBail60j.some((b) => b.id.endsWith("501")));
  check("collecte 6 mois = 6 points", ind.collecte6Mois.length === 6);

  console.log("== Rapport & ROI (période oct.–nov. 2026) ==");
  const rapport = M4.calculerRapport({
    immeubles: db.immeubles, appartements: db.appartements, baux: db.baux,
    echeances: db.echeances, paiements: db.paiements, depenses: db.depenses,
    periodeDebut: "2026-10-01", periodeFin: "2026-11-30",
  });
  const buhomba = rapport.lignes.find((l) => l.immeuble_nom === "Immeuble Buhomba");
  const stLaurent = rapport.lignes.find((l) => l.immeuble_nom === "Bloc Saint-Laurent");
  check("Buhomba : revenus 1 300 000 BIF", buhomba && buhomba.revenus === 1300000, JSON.stringify(buhomba));
  check("Buhomba : dépenses 120 000 BIF", buhomba && buhomba.depenses === 120000, JSON.stringify(buhomba));
  check("Buhomba : net 1 180 000", buhomba && buhomba.resultatNet === 1180000);
  check("Buhomba : ROI 0,6556 %", buhomba && approx(buhomba.roi, 1180000 / 180000000), String(buhomba && buhomba.roi));
  check("Buhomba : marge nette 90,77 % (séparée du ROI)", buhomba && approx(buhomba.marge, 1180000 / 1300000), String(buhomba && buhomba.marge));
  check("St-Laurent : revenus 2 500 CAD", stLaurent && stLaurent.revenus === 2500, JSON.stringify(stLaurent));
  check("St-Laurent : ROI 2 415/850 000", stLaurent && approx(stLaurent.roi, 2415 / 850000), String(stLaurent && stLaurent.roi));
  check("rapport : 2 lignes (archivé exclu)", rapport.lignes.length === 2, String(rapport.lignes.length));

  console.log("== Dépenses CRUD ==");
  let errMontant = null;
  try { await p.creerDepense({ immeuble_id: db.immeubles[0].id, appartement_id: null, date: "2026-11-06", categorie: "entretien", libelle: "Test zéro", montant: 0, devise: "BIF", fournisseur: null }); } catch (e) { errMontant = e.message; }
  check("montant 0 refusé", errMontant === "ERR_MONTANT_NON_POSITIF", errMontant);
  let errCat = null;
  try { await p.creerDepense({ immeuble_id: db.immeubles[0].id, appartement_id: null, date: "2026-11-06", categorie: "", libelle: "Sans catégorie", montant: 1000, devise: "BIF", fournisseur: null }); } catch (e) { errCat = e.message; }
  check("catégorie manquante refusée", errCat === "ERR_CATEGORIE_MANQUANTE", errCat);
  const dep = await p.creerDepense({ immeuble_id: db.immeubles[0].id, appartement_id: null, date: "2026-11-06", categorie: "taxe", libelle: "Taxe foncière test", montant: 50000, devise: "BIF", fournisseur: "Commune" });
  check("dépense créée", dep.id && dep.libelle === "Taxe foncière test");
  const depMod = await p.modifierDepense(dep.id, { montant: 55000 });
  check("dépense modifiée (55 000)", depMod.montant === 55000);
  const listeDep = await p.listerDepenses({ immeubleId: db.immeubles[0].id });
  check("dépense listée dans son immeuble", listeDep.some((d) => d.id === dep.id));
  await p.supprimerDepense(dep.id);
  const listeApres = await p.listerDepenses({ immeubleId: db.immeubles[0].id });
  check("dépense supprimée", !listeApres.some((d) => d.id === dep.id));

  console.log("== Documents ==");
  const petit = "data:text/plain;base64," + Buffer.from("contenu test").toString("base64");
  const doc = await p.televerserDocument({ type: "facture", entite_type: "immeuble", entite_id: db.immeubles[0].id, nom_fichier: "facture-test.pdf", contenu: petit, taille_octets: 12, mime_type: "application/pdf" });
  check("document téléversé (petit fichier conservé)", doc.id && doc.contenu === petit, JSON.stringify({ contenu: !!doc.contenu, nonConserve: doc.contenu_non_conserve }));
  let errDoublon = null;
  try { await p.televerserDocument({ type: "facture", entite_type: "immeuble", entite_id: db.immeubles[0].id, nom_fichier: "facture-test.pdf", contenu: petit, taille_octets: 12, mime_type: "application/pdf" }); } catch (e) { errDoublon = e.message; }
  check("doublon (même nom + même entité) refusé", errDoublon === "ERR_DOCUMENT_DOUBLON", errDoublon);
  let errFormat = null;
  try { await p.televerserDocument({ type: "autre", entite_type: "immeuble", entite_id: db.immeubles[0].id, nom_fichier: "virus.exe", contenu: petit, taille_octets: 12, mime_type: "application/octet-stream" }); } catch (e) { errFormat = e.message; }
  check("format .exe refusé", errFormat === "ERR_DOCUMENT_FORMAT", errFormat);
  let errGros = null;
  try { await p.televerserDocument({ type: "autre", entite_type: "immeuble", entite_id: db.immeubles[0].id, nom_fichier: "gros.pdf", contenu: petit, taille_octets: 11 * 1024 * 1024, mime_type: "application/pdf" }); } catch (e) { errGros = e.message; }
  check("> 10 Mo refusé", errGros === "ERR_DOCUMENT_TROP_GROS", errGros);
  const docRenomme = await p.renommerDocument(doc.id, "facture-test-renommee.pdf");
  check("document renommé", docRenomme.nom_fichier === "facture-test-renommee.pdf");
  const telech = await p.telechargerDocument(doc.id);
  check("téléchargement démo = contenu conservé", telech.url === petit && telech.nomFichier === "facture-test-renommee.pdf");
  await p.supprimerDocument(doc.id);
  const docsApres = await p.listerDocuments({ entite_type: "immeuble", entite_id: db.immeubles[0].id });
  check("document supprimé", !docsApres.some((d) => d.id === doc.id));

  console.log("== Taux fournisseur + manuel ==");
  const tauxUsdBif = await p.getTaux("USD", "BIF");
  check("getTaux USD->BIF 2900 (2026-11-05, auto)", tauxUsdBif && tauxUsdBif.taux === 2900 && tauxUsdBif.date_taux === "2026-11-05" && tauxUsdBif.source === "auto", JSON.stringify(tauxUsdBif));
  check("getTaux GBP->BIF null", (await p.getTaux("GBP", "BIF")) === null);
  const manuel = await p.saisirTauxManuel({ devise_source: "USD", devise_cible: "GBP", taux: 0.79, date_taux: "2026-11-06" });
  check("taux manuel saisi (source manuel)", manuel.source === "manuel" && manuel.taux === 0.79);
  const tauxManuel = await p.getTaux("USD", "GBP");
  check("getTaux USD->GBP = manuel 0.79", tauxManuel && tauxManuel.taux === 0.79 && tauxManuel.source === "manuel", JSON.stringify(tauxManuel));

  console.log("== Alertes (génération idempotente + clôture) ==");
  // Environnement Node : pas de route /api/email/envoyer — on simule la
  // réponse de la route sans fournisseur configuré (Correctif 2) : le
  // statut reste « non_configuré », jamais de faux envoi.
  p.envoyerEmailAlerteFn = async () => ({ envoye: false, raison: "non_configuré" });
  const a1 = await p.genererAlertes();
  const a2 = await p.genererAlertes();
  check("génération idempotente (2e appel = même nombre)", a1.length === a2.length && a1.length > 0, `${a1.length} vs ${a2.length}`);
  check("alerte retard présente", a1.some((a) => a.type === "loyer_en_retard"));
  check("alerte vacance A4 présente", a1.some((a) => a.type === "vacance_prolongee"));
  check("e-mail des alertes = non configuré (jamais de faux envoi)", a1.every((a) => a.email_statut === "non_configuré"));
  const premiere = a1.find((a) => a.statut === "active");
  const traitee = await p.marquerAlerteTraitee(premiere.id);
  check("alerte clôturée (traitée, jamais supprimée)", traitee.statut === "traitee" && !!traitee.traitee_le);
  const a3 = await p.genererAlertes();
  check("pas de régénération de l'alerte traitée", a3.filter((a) => a.id === premiere.id).length === 1);

  console.log("== Fil d'actualité alimenté par les événements ==");
  const feedAvant = await p.listerActivites();
  check("fil de départ ≥ 5 événements", feedAvant.length >= 5, String(feedAvant.length));
  await p.creerDepense({ immeuble_id: db.immeubles[0].id, appartement_id: null, date: "2026-11-06", categorie: "entretien", libelle: "Dépense fil test", montant: 1000, devise: "BIF", fournisseur: null });
  const feedApres = await p.listerActivites();
  check("dépense ajoutée → événement dans le fil", feedApres.length === feedAvant.length + 1 && feedApres[0].description.includes("Dépense fil test"), feedApres[0] && feedApres[0].description);
  const feedImm = await p.listerActivites(db.immeubles[0].id);
  check("fil filtrable par immeuble", feedImm.length > 0 && feedImm.length <= feedApres.length);

  console.log("== ROI sans valeur (immeuble test) ==");
  const immSansValeur = await p.creerImmeuble({ nom: "Test Sans Valeur", adresse: "1 rue Test", ville: "Bujumbura", pays: "Burundi", devise: "USD", type: "maison", etages: 1, photo_url: null, notes: null, valeur_bien: null, devise_valeur: null, date_acquisition: null, prix_acquisition: null });
  const rapport2 = M4.calculerRapport({
    immeubles: [immSansValeur], appartements: [], baux: [], echeances: [], paiements: [], depenses: [],
    periodeDebut: "2026-01-01", periodeFin: "2026-11-30",
  });
  check("ROI null sans valeur du bien", rapport2.lignes[0].roi === null, JSON.stringify(rapport2.lignes[0]));

  console.log("== Exports Excel (feuilles et lignes) ==");
  const meta = { periode: "2026-11", dateExport: "2026-11-06", devises: ["BIF", "CAD"] };
  const wbLoyers = buildLoyersWorkbook({
    echeances: db.echeances.map((e) => ({ echeance: e, bail: db.baux.find((b) => b.id === e.bail_id), locataire: db.locataires.find((l) => l.id === (db.baux.find((b) => b.id === e.bail_id) || {}).locataire_id), appartement: undefined, immeuble: undefined, paye: 0, restant: e.montant_du })),
    paiements: db.paiements.map((pa) => ({ paiement: pa, locataireNom: "Test", mois: "2026-11-01" })),
  }, meta);
  check("Excel Loyers : 3 feuilles", JSON.stringify(wbLoyers.SheetNames) === JSON.stringify(["Loyers", "Paiements", "Synthèse"]), wbLoyers.SheetNames.join(","));
  const lignesLoyers = XLSX.utils.sheet_to_json(wbLoyers.Sheets["Loyers"], { header: 1 });
  check("Excel Loyers : 1re ligne = période/date/devises", String(lignesLoyers[0][0]).includes("2026-11") && String(lignesLoyers[0][0]).includes("2026-11-06") && String(lignesLoyers[0][0]).includes("BIF"), String(lignesLoyers[0][0]));
  check("Excel Loyers : 9 échéances + en-têtes", lignesLoyers.length === 12, String(lignesLoyers.length));
  const wbDep = buildDepensesWorkbook(db.depenses, { immeuble: (id) => id.slice(-3), appartement: (id) => id ?? "—" }, meta);
  check("Excel Dépenses : feuille unique", wbDep.SheetNames.join(",") === "Dépenses");
  const lignesDep = XLSX.utils.sheet_to_json(wbDep.Sheets["Dépenses"], { header: 1 });
  check("Excel Dépenses : 2 dépenses + méta + en-têtes", lignesDep.length === 5, String(lignesDep.length));
  const wbLoc = buildLocatairesWorkbook(db.locataires.map((l) => ({ locataire: l, statutMois: "du" })), meta);
  const lignesLoc = XLSX.utils.sheet_to_json(wbLoc.Sheets["Locataires"], { header: 1 });
  check("Excel Locataires : 5 locataires", lignesLoc.length === 8, String(lignesLoc.length));
  const wbRap = buildRapportWorkbook(rapport, { ...meta, tauxUtilises: ["USD → BIF : 2900 (taux du 2026-11-05)"] });
  check("Excel Rapport : feuilles Rapport + Taux utilisés", JSON.stringify(wbRap.SheetNames) === JSON.stringify(["Rapport", "Taux utilisés"]), wbRap.SheetNames.join(","));
  const buf = XLSX.write(wbRap, { type: "buffer", bookType: "xlsx" });
  check("Excel Rapport : buffer lisible (round-trip)", XLSX.read(buf).SheetNames.length === 2);

  console.log("== E-mail : jamais de faux envoi ==");
  check("e-mail non configuré (pas de fournisseur)", emailConfigure() === false);
  const envoi = await envoyerEmailAlerte({ destinataire: "test@exemple.bi", sujet: "Test", texte: "Test" });
  check("envoi sans config = non_configuré, envoye=false", envoi.envoye === false && envoi.raison === "non_configuré", JSON.stringify(envoi));

  console.log(`\nRésultat : ${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error("ERREUR TEST", e); process.exit(2); });

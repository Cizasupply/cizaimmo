// Test logique métier Module 6 — indivision, vitrine, passeport, taux
// automatiques, WhatsApp (spec §2, §4, §6, §9, §10, §13, §14).
// Fournisseur démo + fonctions pures. localStorage simulé en mémoire.
// Compilation préalable :
//   npx tsc --outDir .test-build   # via scripts/run-tests.sh --module commonjs --target es2020 \
//     --esModuleInterop --skipLibCheck --moduleResolution node --rootDir lib \
//     lib/indivision.ts lib/whatsapp.ts lib/taux.ts lib/module4.ts \
//     lib/format.ts lib/loyers.ts lib/abonnement.ts lib/countries.ts \
//     lib/data/demo.ts lib/data/demo-seed.ts lib/data/types.ts \
//     lib/data/helpers.ts lib/data/provider.ts
// Puis : node scripts/test-module6.cjs
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  },
};
globalThis.document = { cookie: "" };

// Harness compilé : TEST_BUILD_DIR (scripts/run-tests.sh) ou /tmp/m6test (manuel).
const BUILD = process.env.TEST_BUILD_DIR || "/tmp/m6test";

const IND = require(`${BUILD}/indivision.js`);
const WA = require(`${BUILD}/whatsapp.js`);
const TX = require(`${BUILD}/taux.js`);
const M4 = require(`${BUILD}/module4.js`);
const { DemoProvider } = require(`${BUILD}/data/demo.js`);

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}
async function attendErreur(promesse) {
  try {
    await promesse;
    return { levee: false, code: null };
  } catch (e) {
    return { levee: true, code: e instanceof Error ? e.message : String(e) };
  }
}

(async () => {
  console.log("== Indivision : fonctions pures (spec §6 suite) ==");
  const parts100 = [
    { nom: "Jean-Marie", email: "jean-marie@exemple.bi", part: 60 },
    { nom: "Diane", email: "diane@exemple.ca", part: 40 },
  ];
  check("sommeParts 60 + 40 = 100", IND.sommeParts(parts100) === 100);
  check("validerParts 100 % OK", IND.validerParts(parts100).valide === true);
  check("somme 90 % refusée (ERR_PARTS_TOTAL)", IND.validerParts([{ nom: "A", email: "a@x.bi", part: 60 }, { nom: "B", email: "b@x.bi", part: 30 }]).code === "ERR_PARTS_TOTAL");
  check("somme 110 % refusée (ERR_PARTS_TOTAL)", IND.validerParts([{ nom: "A", email: "a@x.bi", part: 60 }, { nom: "B", email: "b@x.bi", part: 50 }]).code === "ERR_PARTS_TOTAL");
  check("e-mail en double refusé (ERR_PART_EMAIL_UNIQUE)", IND.validerParts([{ nom: "A", email: "a@x.bi", part: 50 }, { nom: "A2", email: "A@x.bi", part: 50 }]).code === "ERR_PART_EMAIL_UNIQUE");
  check("part 0 refusée (ERR_PART_INVALIDE)", IND.validerParts([{ nom: "A", email: "a@x.bi", part: 0 }, { nom: "B", email: "b@x.bi", part: 100 }]).code === "ERR_PART_INVALIDE");
  check("part > 100 refusée (ERR_PART_INVALIDE)", IND.validerParts([{ nom: "A", email: "a@x.bi", part: 101 }]).code === "ERR_PART_INVALIDE");

  console.log("== Répartition du résultat net au prorata ==");
  const copros100 = [
    { id: "c1", immeuble_id: "im1", nom: "Jean-Marie", email: "jean-marie@exemple.bi", telephone: null, part: 60, statut: "actif", created_at: "2026-11-06T00:00:00.000Z" },
    { id: "c2", immeuble_id: "im1", nom: "Diane", email: "diane@exemple.ca", telephone: null, part: 40, statut: "actif", created_at: "2026-11-06T00:00:00.000Z" },
  ];
  const rep = IND.repartirResultatNet({
    revenus: 1000000,
    depenses: 0,
    devise: "BIF",
    coproprietaires: copros100,
  });
  check("répartition 60/40 de 1 000 000 BIF", rep.resultat_net === 1000000 && rep.parts_completes === true && rep.lignes.find((l) => l.email === "jean-marie@exemple.bi").montant === 600000 && rep.lignes.find((l) => l.email === "diane@exemple.ca").montant === 400000, JSON.stringify(rep));
  check("résultat net = revenus - dépenses", IND.repartirResultatNet({ revenus: 1000000, depenses: 250000, devise: "BIF", coproprietaires: copros100 }).resultat_net === 750000);
  check("résultat net nul -> parts à zéro", IND.repartirResultatNet({ revenus: 0, depenses: 0, devise: "BIF", coproprietaires: copros100 }).lignes.every((l) => l.montant === 0));
  check("parts incomplètes -> aucune ligne", IND.repartirResultatNet({ revenus: 1000, depenses: 0, devise: "BIF", coproprietaires: [copros100[0]] }).lignes.length === 0 && IND.repartirResultatNet({ revenus: 1000, depenses: 0, devise: "BIF", coproprietaires: [copros100[0]] }).parts_completes === false);
  const repMulti = IND.repartirResultatNet({
    revenus: 1000,
    depenses: 0,
    devise: "CAD",
    coproprietaires: [
      { id: "c1", immeuble_id: "im1", nom: "A", email: "a@exemple.ca", telephone: null, part: 50, statut: "actif", created_at: "2026-11-06T00:00:00.000Z" },
      { id: "c2", immeuble_id: "im1", nom: "B", email: "b@exemple.ca", telephone: null, part: 50, statut: "actif", created_at: "2026-11-06T00:00:00.000Z" },
    ],
    devise_cible: "BIF",
    taux: [{ id: "t1", devise_source: "CAD", devise_cible: "BIF", taux: 2080, date_taux: "2026-11-05", source: "auto" }],
  });
  check("multi-devises : 1000 CAD -> 500 CAD / 1 040 000 BIF par part", repMulti.lignes.every((l) => l.montant === 500 && l.montant_converti === 1040000 && l.date_taux === "2026-11-05" && l.source_taux === "auto"), JSON.stringify(repMulti.lignes));
  const repSansTaux = IND.repartirResultatNet({
    revenus: 1000, depenses: 0, devise: "CAD",
    coproprietaires: [{ id: "c1", immeuble_id: "im1", nom: "A", email: "a@exemple.ca", telephone: null, part: 100, statut: "actif", created_at: "2026-11-06T00:00:00.000Z" }],
    devise_cible: "BIF",
    taux: [],
  });
  check("sans taux : montant converti null (jamais inventé)", repSansTaux.lignes[0].montant_converti === null && repSansTaux.lignes[0].montant === 1000, JSON.stringify(repSansTaux.lignes));

  console.log("== WhatsApp : jamais de simulation (spec §10, §14) ==");
  delete process.env.WHATSAPP_API_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  check("whatsappConfigure() faux sans variables", WA.whatsappConfigure() === false);
  const nonConf = await WA.envoyerWhatsApp({ destinataire: "+257 79 00 00 01", texte: "Test" });
  check("sans configuration -> non_configuré, aucun envoi", nonConf.envoye === false && nonConf.raison === "non_configuré", JSON.stringify(nonConf));
  check("normaliser +1 514 502 9503 -> 15145029503", WA.normaliserNumeroWhatsApp("+1 514 502 9503") === "15145029503");
  check("normaliser +257 79 22 22 22 -> 25779222222", WA.normaliserNumeroWhatsApp("+257 79 22 22 22") === "25779222222");
  check("normaliser enlève espaces, tirets, parenthèses", WA.normaliserNumeroWhatsApp("+1 (514) 502-9503") === "15145029503");
  process.env.WHATSAPP_API_TOKEN = "token-test";
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
  check("whatsappConfigure() vrai avec variables", WA.whatsappConfigure() === true);
  const invalide = await WA.envoyerWhatsApp({ destinataire: "abc", texte: "Test" });
  check("numéro invalide -> numero_invalide (avant tout appel)", invalide.envoye === false && invalide.raison === "numero_invalide", JSON.stringify(invalide));
  const tropCourt = await WA.envoyerWhatsApp({ destinataire: "+33 1", texte: "Test" });
  check("numéro trop court -> numero_invalide", tropCourt.envoye === false && tropCourt.raison === "numero_invalide", JSON.stringify(tropCourt));
  delete process.env.WHATSAPP_API_TOKEN;
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;

  console.log("== Taux automatiques : paresseux, datés, manuel prioritaire (spec §9) ==");
  check("doitActualiserTaux([]) vrai", TX.doitActualiserTaux([]) === true);
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const tauxFrais = [{ devise_source: "USD", devise_cible: "BIF", taux: 2900, date_taux: aujourdhui, source: "auto" }];
  check("taux auto du jour -> pas d'actualisation", TX.doitActualiserTaux(tauxFrais) === false);
  check("dernierTauxAuto renvoie le plus récent", TX.dernierTauxAuto(tauxFrais).taux === 2900);
  const tauxVieux = [{ devise_source: "USD", devise_cible: "BIF", taux: 2900, date_taux: "2026-11-01", source: "auto" }];
  check("taux auto de plus de 24 h -> actualisation", TX.doitActualiserTaux(tauxVieux) === true);
  const fauxFetch = async () => ({
    ok: true,
    json: async () => ({ result: "success", base_code: "USD", rates: { BIF: 2900, CAD: 1.39, EUR: 0.86 } }),
  });
  const lignes = TX.construireTauxAuto(await TX.recupererTauxExternes(fauxFetch), aujourdhui);
  check("construction auto : paires USD->devise + devise->USD, source auto", lignes.some((l) => l.devise_source === "USD" && l.devise_cible === "BIF" && l.taux === 2900 && l.source === "auto") && lignes.some((l) => l.devise_source === "BIF" && l.devise_cible === "USD" && Math.abs(l.taux - 1 / 2900) < 1e-9), JSON.stringify(lignes));
  const fetchEnEchec = async () => { throw new Error("réseau coupé"); };
  let echecTaux = null;
  try { await TX.recupererTauxExternes(fetchEnEchec); } catch (e) { echecTaux = e; }
  check("échec du service externe -> erreur (jamais de taux inventé)", echecTaux instanceof Error);

  console.log("== Fournisseur démo : indivision (seed Buhomba 60/40) ==");
  const p = new DemoProvider();
  await p.signIn("demo@cizaimmo.com", "demo");
  const db = p.getDemoDb();
  const buhomba = db.immeubles.find((i) => i.nom.includes("Buhomba"));
  const stLaurent = db.immeubles.find((i) => i.nom.includes("Saint-Laurent"));
  check("seed : Buhomba a 2 co-propriétaires, 100 %", (await p.listerCoproprietaires(buhomba.id)).length === 2 && IND.sommeParts(await p.listerCoproprietaires(buhomba.id)) === 100);
  const eTotal = await attendErreur(p.definirParts(buhomba.id, [
    { nom: "Jean-Marie Niyonzima", email: "jean-marie@exemple.bi", telephone: null, part: 60 },
    { nom: "Diane Niyonzima", email: "diane@exemple.ca", telephone: null, part: 30 },
  ]));
  check("definirParts somme 90 % refusée (ERR_PARTS_TOTAL)", eTotal.levee && eTotal.code === "ERR_PARTS_TOTAL", JSON.stringify(eTotal));
  const eDoublon = await attendErreur(p.definirParts(buhomba.id, [
    { nom: "A", email: "a@exemple.bi", telephone: null, part: 50 },
    { nom: "B", email: "A@exemple.bi", telephone: null, part: 50 },
  ]));
  check("definirParts e-mail en double refusé (ERR_PART_EMAIL_UNIQUE)", eDoublon.levee && eDoublon.code === "ERR_PART_EMAIL_UNIQUE", JSON.stringify(eDoublon));
  const maj = await p.definirParts(buhomba.id, [
    { nom: "Jean-Marie Niyonzima", email: "jean-marie@exemple.bi", telephone: "+257 79 22 22 22", part: 50 },
    { nom: "Diane Niyonzima", email: "diane@exemple.ca", telephone: "+1 514 555 0104", part: 50 },
  ]);
  check("definirParts 50/50 acceptée", maj.length === 2 && IND.sommeParts(maj) === 100, JSON.stringify(maj));
  const acts = await p.listerActivites(buhomba.id);
  check("modification de part tracée dans le fil (auteur, ancienne -> nouvelle)", acts.some((a) => a.description.includes("Part modifiée") && a.description.includes("60 % → 50 %")), JSON.stringify(acts.map((a) => a.description)));
  const eInvite = await attendErreur(p.inviterCoproprietaire(buhomba.id, { nom: "Troisième", email: "trois@exemple.bi", telephone: null, part: 10 }));
  check("invitation dépassant 100 % refusée", eInvite.levee && (eInvite.code === "ERR_PARTS_TOTAL" || eInvite.code === "ERR_PART_INVALIDE"), JSON.stringify(eInvite));
  const invite = await p.inviterCoproprietaire(stLaurent.id, { nom: "Marc Tremblay", email: "marc@exemple.ca", telephone: "+1 514 555 0202", part: 30 });
  check("invitation 30 % sur Saint-Laurent (somme 0 -> 30) acceptée, statut invite", invite.statut === "invite" && invite.part === 30, JSON.stringify(invite));
  const accepte = await p.accepterInvitationCoproprietaire(invite.id);
  check("acceptation de l'invitation -> statut actif", accepte.statut === "actif");
  const eInvite2 = await attendErreur(p.inviterCoproprietaire(stLaurent.id, { nom: "Autre", email: "autre@exemple.ca", telephone: null, part: 80 }));
  check("invitation 30 + 80 > 100 refusée", eInvite2.levee, JSON.stringify(eInvite2));
  const retire = await p.retirerCoproprietaire(invite.id);
  check("retrait du co-propriétaire", retire === undefined && (await p.listerCoproprietaires(stLaurent.id)).length === 0);
  const eRetire = await attendErreur(p.retirerCoproprietaire("coprop-introuvable"));
  check("retrait d'un id inconnu refusé (ERR_COPROPRIETAIRE_INTROUVABLE)", eRetire.levee && eRetire.code === "ERR_COPROPRIETAIRE_INTROUVABLE", JSON.stringify(eRetire));

  console.log("== Accès co-propriétaire : limité à ses biens, lecture seule ==");
  await p.signIn("diane@exemple.ca", "motdepasse");
  const profilCo = await p.getProfil();
  check("session Diane -> rôle coproprietaire", profilCo && profilCo.role === "coproprietaire", JSON.stringify(profilCo));
  const imsCo = await p.listerImmeubles();
  check("Diane ne voit que Buhomba (1 immeuble)", imsCo.length === 1 && imsCo[0].id === buhomba.id, JSON.stringify(imsCo.map((i) => i.nom)));
  const aptsCo = await p.listerAppartements();
  check("Diane ne voit que les appartements de Buhomba", aptsCo.length > 0 && aptsCo.every((a) => a.immeuble_id === buhomba.id), JSON.stringify(aptsCo.map((a) => a.numero)));
  const locsCo = await p.listerLocataires();
  check("locataires visibles par nom, coordonnées masquées", locsCo.length > 0 && locsCo.every((l) => l.telephone === "" && l.email === null), JSON.stringify(locsCo));
  check("aucun accès à l'abonnement (null)", (await p.getAbonnement()) === null);
  check("aucun gestionnaire visible", (await p.listerGestionnaires()).length === 0);
  const eMut = await attendErreur(p.creerDepense({ immeuble_id: buhomba.id, appartement_id: null, date: "2026-11-06", categorie: "entretien", libelle: "Test coprop", montant: 1000, devise: "BIF", fournisseur: null }));
  check("mutation refusée (ERR_ROLE_LECTURE_SEULE) : creerDepense", eMut.levee && eMut.code === "ERR_ROLE_LECTURE_SEULE", JSON.stringify(eMut));
  const eMut2 = await attendErreur(p.definirParts(buhomba.id, [
    { nom: "Jean-Marie Niyonzima", email: "jean-marie@exemple.bi", telephone: null, part: 50 },
    { nom: "Diane Niyonzima", email: "diane@exemple.ca", telephone: null, part: 50 },
  ]));
  check("mutation refusée (ERR_ROLE_LECTURE_SEULE) : definirParts", eMut2.levee && eMut2.code === "ERR_ROLE_LECTURE_SEULE", JSON.stringify(eMut2));
  const eMut3 = await attendErreur(p.getLimiteBlocs());
  check("limite de blocs refusée au co-propriétaire", eMut3.levee && eMut3.code === "ERR_ROLE_LECTURE_SEULE", JSON.stringify(eMut3));
  // Retour propriétaire.
  await p.signIn("demo@cizaimmo.com", "demo");

  console.log("== Vitrine publique (spec §4) ==");
  await p.signOut();
  const annonces = await p.listerAnnoncesPubliques();
  check("annonces publiques listées sans connexion", annonces.length >= 1, JSON.stringify(annonces.length));
  check("aucun contact locataire exposé dans les annonces", annonces.every((a) => !("locataire_telephone" in a) && !("locataire_email" in a) && JSON.stringify(a).toLowerCase().indexOf("locataire") === -1), JSON.stringify(annonces[0]));
  check("l'annonce publiée est un appartement vacant ou réservé", annonces.every((a) => a.appartement.statut === "vacant" || a.appartement.statut === "reserve"));
  const annonce = await p.getAnnoncePublique(annonces[0].appartement.id);
  check("fiche publique : loyer + contact propriétaire, pas de locataire", annonce !== null && annonce.appartement.loyer_defaut > 0 && annonce.contact !== null && annonce.contact.email !== null, JSON.stringify(annonce));
  const annonceInconnue = await p.getAnnoncePublique("apt-introuvable");
  check("fiche publique d'un id inconnu -> null", annonceInconnue === null);
  await p.signIn("demo@cizaimmo.com", "demo");
  const db2 = p.getDemoDb();
  const occupe = db2.appartements.find((a) => a.statut === "occupe");
  const eVitrine = await attendErreur(p.basculerVitrine(occupe.id, true));
  check("publication d'un appartement occupé refusée (ERR_VITRINE_STATUT)", eVitrine.levee && eVitrine.code === "ERR_VITRINE_STATUT", JSON.stringify(eVitrine));

  console.log("== Passeport du bien (spec §6 suite) ==");
  const imBuhomba = await p.getImmeuble(buhomba.id);
  check("passeport immeuble : mode d'acquisition + date d'estimation", imBuhomba.mode_acquisition === "achat" && imBuhomba.date_estimation === "2026-10-01", JSON.stringify({ mode: imBuhomba.mode_acquisition, estimation: imBuhomba.date_estimation }));
  check("passeport immeuble : valeur + devise + date d'acquisition + prix", imBuhomba.valeur_bien !== null && imBuhomba.devise_valeur !== null && imBuhomba.date_acquisition !== null && imBuhomba.prix_acquisition !== null, JSON.stringify(imBuhomba));
  const roiApt = M4.roiAppartement({
    appartement: db2.appartements.find((a) => a.immeuble_id === buhomba.id),
    immeuble: imBuhomba,
    baux: db2.baux,
    echeances: db2.echeances,
    paiements: db2.paiements,
    depenses: db2.depenses,
    periodeDebut: "2026-01-01",
    periodeFin: "2026-11-06",
  });
  check("ROI appartement calculé sur la valeur du bien (nombre ou null)", roiApt === null || typeof roiApt === "number", String(roiApt));

  console.log("== Taux : manuel prioritaire, jamais inventé (module 4) ==");
  const tauxSeed = await p.listerTaux();
  check("taux seed présents (auto datés 2026-11-05)", tauxSeed.length >= 5 && tauxSeed.every((t) => t.date_taux), JSON.stringify(tauxSeed.length));
  const tauxManuel = await p.saisirTauxManuel({ devise_source: "USD", devise_cible: "BIF", taux: 3000, date_taux: "2026-11-06" });
  check("taux manuel saisi (source manuel, daté)", tauxManuel.source === "manuel" && tauxManuel.taux === 3000);
  const trouve = M4.trouverTaux(await p.listerTaux(), "USD", "BIF");
  check("trouverTaux : le manuel (3000) prime sur l'auto (2900)", trouve !== null && trouve.taux === 3000 && trouve.source === "manuel", JSON.stringify(trouve));
  const introuvable = M4.trouverTaux(await p.listerTaux(), "BIF", "KES");
  check("paire sans taux -> null (jamais inventé)", introuvable === null, JSON.stringify(introuvable));
  check("convertirMontant sans taux -> null", M4.convertirMontant(1000, "BIF", "KES", await p.listerTaux()) === null);
  const autoEnregistres = await p.enregistrerTauxAuto([
    { devise_source: "USD", devise_cible: "BIF", taux: 2950, date_taux: aujourdhui, source: "auto" },
    { devise_source: "USD", devise_cible: "BIF", taux: 2950, date_taux: aujourdhui, source: "auto" },
  ]);
  check("enregistrerTauxAuto déduplique paire + date + source", autoEnregistres.length === 1, JSON.stringify(autoEnregistres.length));

  console.log(`\nRésultat : ${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error("ERREUR TEST", e); process.exit(2); });

// Test logique métier Module 5 — abonnements & facturation (spec §12).
// Fournisseur démo + fonctions pures. localStorage simulé en mémoire.
// Compilation préalable :
//   npx tsc --outDir .test-build   # via scripts/run-tests.sh --module commonjs --target es2020 \
//     --esModuleInterop --skipLibCheck --moduleResolution node --rootDir lib \
//     lib/abonnement.ts lib/countries.ts lib/module4.ts lib/loyers.ts \
//     lib/format.ts lib/data/demo.ts lib/data/demo-seed.ts lib/data/types.ts \
//     lib/data/helpers.ts lib/data/provider.ts
// Puis : node scripts/test-module5.cjs
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  },
};
globalThis.document = { cookie: "" };

// Harness compilé : TEST_BUILD_DIR (scripts/run-tests.sh) ou /tmp/m5test (manuel).
const BUILD = process.env.TEST_BUILD_DIR || "/tmp/m5test";

const A = require(`${BUILD}/abonnement.js`);
const M4 = require(`${BUILD}/module4.js`);
const { DemoProvider } = require(`${BUILD}/data/demo.js`);
const { SUPER_ADMIN_DEMO_EMAIL } = require(`${BUILD}/data/demo-seed.js`);

// Extension v1.2 (ajout fondateur n°3) : chaque inscription passe par
// l'APPROBATION manuelle d'un Admin / Super Admin — l'essai démarre à
// l'approbation. Ce helper rejoue le geste console du Super Admin démo
// puis rouvre la session du compte testé, pour que les scénarios
// historiques ci-dessous (mécanique d'abonnement post-approbation)
// restent vérifiés à l'identique.
async function approuverInscription(p, email) {
  await p.signIn(SUPER_ADMIN_DEMO_EMAIL, "motdepasse");
  const comptes = await p.listerComptesPlateforme();
  const cible = comptes.find((c) => c.email === email);
  if (!cible) throw new Error(`Compte à approuver introuvable : ${email}`);
  await p.approuverCompte(cible.id);
  await p.signOut();
  await p.signIn(email, "motdepasse123");
}

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}
async function attendErreur(promesse, code) {
  try {
    await promesse;
    return { levee: false, code: null };
  } catch (e) {
    return { levee: true, code: e instanceof Error ? e.message : String(e) };
  }
}
const jours = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

(async () => {
  console.log("== Fonctions pures : prix verrouillés (spec §12) ==");
  check("Starter Afrique 1,99 / Internationale 4,99", A.prixPlan("starter", "afrique") === 1.99 && A.prixPlan("starter", "internationale") === 4.99);
  check("Pro Afrique 5,99 / Internationale 14,99", A.prixPlan("pro", "afrique") === 5.99 && A.prixPlan("pro", "internationale") === 14.99);
  check("Agence Afrique 11,99 / Internationale 29,99", A.prixPlan("agence", "afrique") === 11.99 && A.prixPlan("agence", "internationale") === 29.99);

  console.log("== Grille déterminée par le pays à l'inscription ==");
  check("Burundi -> afrique", A.grillePourPays("Burundi") === "afrique");
  check("Rwanda, Kenya, Sénégal, Maroc -> afrique", ["Rwanda", "Kenya", "Sénégal", "Maroc"].every((p) => A.grillePourPays(p) === "afrique"));
  check("Canada, France, États-Unis -> internationale", ["Canada", "France", "États-Unis"].every((p) => A.grillePourPays(p) === "internationale"));
  check("pays inconnu / null -> internationale", A.grillePourPays(null) === "internationale" && A.grillePourPays("Autre") === "internationale");

  console.log("== Transitions paresseuses (pures) ==");
  const base = { id: "a1", owner_id: "o1", plan: "pro", grille: "afrique", statut: "essai", debut_periode: jours(-30), fin_periode: jours(-1), trial_ends_at: jours(-1), stripe_customer_id: null, stripe_subscription_id: null, mobile_money_ref: null, created_at: jours(-30), plan_en_attente: null, date_effet_plan: null, resiliation_programmee: false, echec_paiement: false, grace_ends_at: null, lecture_seule_jusqu_au: null };
  const t1 = A.appliquerTransitions(base);
  check("essai terminé -> lecture_seule + 90 jours", t1.change && t1.abo.statut === "lecture_seule" && t1.abo.lecture_seule_jusqu_au.slice(0, 10) === new Date(Date.now() + 89 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10), JSON.stringify(t1.abo));
  check("estLectureSeule vrai après essai", A.estLectureSeule(t1.abo) === true);
  const t2 = A.appliquerTransitions({ ...base, statut: "actif", trial_ends_at: null, fin_periode: jours(10), plan_en_attente: "starter", date_effet_plan: jours(-1) });
  check("descente effective à la date d'effet", t2.change && t2.abo.plan === "starter" && t2.abo.plan_en_attente === null, JSON.stringify(t2.abo));
  const t3 = A.appliquerTransitions({ ...base, statut: "actif", trial_ends_at: null, fin_periode: jours(-1), resiliation_programmee: true });
  check("résiliation effective en fin de période -> annule + 90 j", t3.change && t3.abo.statut === "annule" && t3.abo.lecture_seule_jusqu_au !== null, JSON.stringify(t3.abo));
  const t4 = A.appliquerTransitions({ ...base, statut: "actif", trial_ends_at: null, fin_periode: jours(10), echec_paiement: true, grace_ends_at: jours(-1) });
  check("grâce dépassée -> lecture_seule", t4.change && t4.abo.statut === "lecture_seule", JSON.stringify(t4.abo));
  const t5 = A.appliquerTransitions({ ...base, statut: "actif", trial_ends_at: null, fin_periode: jours(10), echec_paiement: true, grace_ends_at: jours(3) });
  check("pendant la grâce : fonctionnement normal", t5.change === false && A.estLectureSeule({ ...base, statut: "actif", trial_ends_at: null, echec_paiement: true, grace_ends_at: jours(3) }) === false);
  check("facture CIM-ABO-2026-0002 après 0001", A.prochainNumeroFactureAbo(["CIM-ABO-2026-0001"], 2026) === "CIM-ABO-2026-0002");
  check("référence MM-XXXXXXXX", /^MM-[A-Z0-9]{8}$/.test(A.genererReferenceMobileMoney()));

  console.log("== Inscription + approbation : essai Pro 30 jours, sans carte, grille par pays ==");
  const p = new DemoProvider();
  await p.signUp({ nom: "Test Canada", email: "test@exemple.ca", motDePasse: "motdepasse123", pays: "Canada", devisePrincipale: "CAD", langue: "fr" });
  await approuverInscription(p, "test@exemple.ca");
  let abo = await p.getAbonnement();
  check("essai Pro, grille internationale (Canada)", abo && abo.statut === "essai" && abo.plan === "pro" && abo.grille === "internationale", JSON.stringify(abo));
  check("essai 30 jours, sans carte", abo && abo.trial_ends_at && Math.round((new Date(abo.trial_ends_at).getTime() - Date.now()) / 86400000) === 30 && abo.stripe_customer_id === null, abo?.trial_ends_at);
  await p.signUp({ nom: "Test Burundi", email: "test@exemple.bi", motDePasse: "motdepasse123", pays: "Burundi", devisePrincipale: "BIF", langue: "fr" });
  await approuverInscription(p, "test@exemple.bi");
  abo = await p.getAbonnement();
  check("réinscription Burundi -> grille afrique", abo && abo.grille === "afrique", JSON.stringify(abo?.grille));

  console.log("== Limites de blocs par plan ==");
  const lim = await p.getLimiteBlocs();
  check("essai Pro : 2 utilisés / 5 autorisés (seed)", lim.utilises === 2 && lim.autorises === 5, JSON.stringify(lim));

  console.log("== Alertes essai J-7 / J-1 (branchement module 4) ==");
  const db = p.getDemoDb();
  const auJour = (iso) => new Date(iso + "T12:00:00");
  const baseAlertes = { baux: db.baux, echeances: db.echeances, paiements: db.paiements, appartements: db.appartements, abonnement: { ...db.abonnement, trial_ends_at: "2026-11-13T00:00:00.000Z" } };
  check("essai J-7 (fin 13 nov., le 6 nov.)", M4.genererAlertesCandidates({ ...baseAlertes, aujourdHui: auJour("2026-11-06") }).some((c) => c.type === "essai_abonnement" && c.dedup_key.includes(":J-7")));
  check("essai J-1 (fin 13 nov., le 12 nov.)", M4.genererAlertesCandidates({ ...baseAlertes, aujourdHui: auJour("2026-11-12") }).some((c) => c.type === "essai_abonnement" && c.dedup_key.includes(":J-1")));

  console.log("== Montée immédiate / descente en fin de période ==");
  const e1 = await attendErreur(p.changerPlan("starter"), "ERR_DESCENTE_BLOQUEE");
  check("descente vers Starter refusée (2 blocs > 1)", e1.levee && e1.code === "ERR_DESCENTE_BLOQUEE", JSON.stringify(e1));
  abo = await p.changerPlan("agence");
  check("montée Agence immédiate, actif, période 1 mois", abo.plan === "agence" && abo.statut === "actif" && abo.fin_periode !== null, JSON.stringify(abo));
  let factures = await p.listerFactures();
  check("facture Agence Afrique 11,99 $ émise (DÉMO)", factures.length === 1 && factures[0].montant === 11.99 && factures[0].moyen === "demo" && factures[0].numero === "CIM-ABO-2026-0001", JSON.stringify(factures));
  abo = await p.changerPlan("pro");
  check("descente Pro programmée (pas immédiate)", abo.plan === "agence" && abo.plan_en_attente === "pro" && abo.date_effet_plan === abo.fin_periode, JSON.stringify(abo));
  check("getAbonnement avant l'échéance : toujours Agence", (await p.getAbonnement()).plan === "agence");
  // Avancer la date d'effet dans le passé -> la descente s'applique.
  const db2 = p.getDemoDb();
  db2.abonnement.date_effet_plan = jours(-1);
  const { setItem } = globalThis.window.localStorage;
  setItem("cizaimmo-demo-db-v1", JSON.stringify(db2));
  abo = await p.getAbonnement();
  check("descente appliquée après la fin de période : Pro", abo.plan === "pro" && abo.plan_en_attente === null, JSON.stringify(abo));

  console.log("== Annulation en fin de période + conservation 90 jours ==");
  abo = await p.annulerAbonnement();
  check("résiliation programmée (statut encore actif)", abo.statut === "actif" && abo.resiliation_programmee === true, JSON.stringify(abo));
  const db3 = p.getDemoDb();
  db3.abonnement.fin_periode = jours(-1);
  setItem("cizaimmo-demo-db-v1", JSON.stringify(db3));
  abo = await p.getAbonnement();
  check("après fin de période : annulé + lecture seule 90 jours", abo.statut === "annule" && abo.lecture_seule_jusqu_au !== null, JSON.stringify(abo));
  check("mutations refusées (annulé) : creerImmeuble", (await attendErreur(p.creerImmeuble({ nom: "Test", adresse: "a", ville: "v", pays: "Burundi", devise: "BIF", type: "immeuble", etages: null, photo_url: null, notes: null, valeur_bien: null, devise_valeur: null, date_acquisition: null, prix_acquisition: null }), "")).code === "ERR_ABONNEMENT_REQUIS");
  check("lecture OK (annulé) : listerImmeubles + listerRecus", (await p.listerImmeubles()).length >= 2 && (await p.listerRecus()).length >= 1);

  console.log("== Essai 30 jours puis lecture seule ==");
  await p.signUp({ nom: "Test Essai", email: "essai@exemple.bi", motDePasse: "motdepasse123", pays: "Burundi", devisePrincipale: "BIF", langue: "fr" });
  await approuverInscription(p, "essai@exemple.bi");
  abo = await p.getAbonnement();
  check("nouvel essai Pro 30 jours", abo.statut === "essai" && abo.plan === "pro", JSON.stringify(abo?.statut));
  const db4 = p.getDemoDb();
  db4.abonnement.trial_ends_at = jours(-1);
  db4.abonnement.fin_periode = jours(-1);
  setItem("cizaimmo-demo-db-v1", JSON.stringify(db4));
  abo = await p.getAbonnement();
  check("essai terminé sans abonnement -> lecture_seule", abo.statut === "lecture_seule", JSON.stringify(abo?.statut));
  const eDep = await attendErreur(p.creerDepense({ immeuble_id: db4.immeubles[0].id, appartement_id: null, date: "2026-11-06", categorie: "entretien", libelle: "Test", montant: 1000, devise: "BIF", fournisseur: null }), "");
  check("mutation refusée (lecture seule) : creerDepense", eDep.levee && eDep.code === "ERR_ABONNEMENT_REQUIS", JSON.stringify(eDep));
  check("mutation refusée (lecture seule) : declarerPaiement", (await attendErreur(p.declarerPaiement({ echeance_id: db4.echeances[0].id, montant: 1000, devise: "BIF", date_paiement: "2026-11-06", moyen: "especes" }), "")).code === "ERR_ABONNEMENT_REQUIS");
  check("lecture + export OK (lecture seule)", (await p.listerImmeubles()).length >= 2 && (await p.listerRecus()).length >= 1 && (await p.listerEcheances()).length >= 1);

  console.log("== Échec de paiement + grâce 7 jours ==");
  // Réactivation par montée (simulation démo) puis échec.
  abo = await p.changerPlan("pro");
  check("réactivation Pro (montée simulée)", abo.statut === "actif" && abo.plan === "pro", JSON.stringify(abo?.statut));
  abo = await p.signalerEchecPaiement();
  check("échec signalé : grâce 7 jours", abo.echec_paiement === true && abo.grace_ends_at !== null, JSON.stringify(abo?.grace_ends_at));
  const db5 = p.getDemoDb();
  const candEchec = M4.genererAlertesCandidates({ baux: db5.baux, echeances: db5.echeances, paiements: db5.paiements, appartements: db5.appartements, abonnement: db5.abonnement });
  check("alerte immédiate d'échec de paiement", candEchec.some((c) => c.type === "essai_abonnement" && c.dedup_key.startsWith("echec_paiement:")), JSON.stringify(candEchec.map((c) => c.dedup_key)));
  const depOk = await p.creerDepense({ immeuble_id: db5.immeubles[0].id, appartement_id: null, date: "2026-11-06", categorie: "entretien", libelle: "Pendant la grâce", montant: 5000, devise: "BIF", fournisseur: null });
  check("pendant la grâce : fonctionnement normal (dépense créée)", depOk && depOk.libelle === "Pendant la grâce");
  const db6 = p.getDemoDb();
  db6.abonnement.grace_ends_at = jours(-1);
  setItem("cizaimmo-demo-db-v1", JSON.stringify(db6));
  abo = await p.getAbonnement();
  check("grâce dépassée -> lecture_seule", abo.statut === "lecture_seule", JSON.stringify(abo?.statut));
  check("mutation refusée après grâce : creerDepense", (await attendErreur(p.creerDepense({ immeuble_id: db6.immeubles[0].id, appartement_id: null, date: "2026-11-06", categorie: "entretien", libelle: "Après grâce", montant: 1000, devise: "BIF", fournisseur: null }), "")).code === "ERR_ABONNEMENT_REQUIS");

  console.log("== Mobile money : demande -> en attente -> confirmation -> actif ==");
  const eTel = await attendErreur(p.demanderPaiementMobileMoney("ecocash", "abc", "pro"), "");
  check("téléphone invalide refusé", eTel.levee && eTel.code === "ERR_MM_TELEPHONE_INVALIDE", JSON.stringify(eTel));
  const mm = await p.demanderPaiementMobileMoney("ecocash", "+257 79 00 00 00", "pro");
  check("demande créée : en_attente, 5,99 $ (Pro Afrique), réf MM-", mm.statut === "en_attente" && mm.montant === 5.99 && /^MM-[A-Z0-9]{8}$/.test(mm.reference), JSON.stringify(mm));
  let mms = await p.listerPaiementsMobileMoney();
  check("demande listée en attente", mms.some((x) => x.reference === mm.reference && x.statut === "en_attente"));
  const mmConf = await p.confirmerPaiementMobileMoney(mm.reference);
  check("confirmation simulée (démo) : confirmé", mmConf.statut === "confirme" && mmConf.confirme_le !== null, JSON.stringify(mmConf));
  abo = await p.getAbonnement();
  check("abonnement actif Pro après confirmation", abo.statut === "actif" && abo.plan === "pro" && abo.mobile_money_ref === mm.reference, JSON.stringify(abo));
  factures = await p.listerFactures();
  check("facture mobile money émise", factures.some((f) => f.moyen === "mobile_money" && f.reference_mobile_money === mm.reference && f.montant === 5.99), JSON.stringify(factures.map((f) => f.moyen)));
  const eDeja = await attendErreur(p.confirmerPaiementMobileMoney(mm.reference), "");
  check("double confirmation refusée", eDeja.levee && eDeja.code === "ERR_MM_DEJA_TRAITE", JSON.stringify(eDeja));
  const eInconnu = await attendErreur(p.confirmerPaiementMobileMoney("MM-XXXXXXXX"), "");
  check("référence inconnue refusée", eInconnu.levee && eInconnu.code === "ERR_MM_INTROUVABLE", JSON.stringify(eInconnu));

  console.log("== Mobile money : non confirmé sous 24 h -> annulé sans frais ==");
  const mm2 = await p.demanderPaiementMobileMoney("lumicash", "+257 79 11 11 11", "starter");
  const db7 = p.getDemoDb();
  const idx = db7.paiementsMobileMoney.findIndex((x) => x.reference === mm2.reference);
  db7.paiementsMobileMoney[idx].expire_le = jours(-1);
  setItem("cizaimmo-demo-db-v1", JSON.stringify(db7));
  mms = await p.listerPaiementsMobileMoney();
  check("demande expirée à la lecture (24 h dépassées)", mms.find((x) => x.reference === mm2.reference).statut === "expire", JSON.stringify(mms.find((x) => x.reference === mm2.reference)));
  const eExpire = await attendErreur(p.confirmerPaiementMobileMoney(mm2.reference), "");
  check("confirmation d'une demande expirée refusée", eExpire.levee && eExpire.code === "ERR_MM_EXPIRE", JSON.stringify(eExpire));
  abo = await p.getAbonnement();
  check("aucun débit / activation après expiration (toujours Pro actif)", abo.statut === "actif" && abo.plan === "pro", JSON.stringify(abo?.plan));

  console.log(`\nRésultat : ${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error("ERREUR TEST", e); process.exit(2); });

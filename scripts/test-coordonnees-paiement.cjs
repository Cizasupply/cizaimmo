// ============================================================================
// Test « Coordonnées de paiement de l'employé + liste Vérifier un
// employé + TALON DE PAIE » (2026-11-08, ajouts VALIDÉS par le
// fondateur ; modèle de coordonnées PRÉCISÉ par lui : coordonnées
// bancaires COMPLÈTES structurées selon le moyen).
// - complétude CALCULÉE par moyen : virement = banque + n° de compte
//   (IBAN, SWIFT, agence OPTIONNELS) ; mobile money = opérateur +
//   numéro ; espèces = titulaire seul. Moyen/titulaire manquants ou
//   moyen hors liste = incomplet/refusé.
// - les coordonnées ne changent NI la complétude du dossier employé
//   NI les règles de la carte : elles ne bloquent QUE la paie.
// - porte d'émission, ORDRE : dossier (ERR_DOSSIER_INCOMPLET) puis
//   contrat (ERR_PAIE_SANS_CONTRAT) puis coordonnées
//   (ERR_COORDONNEES_PAIEMENT_MANQUANTES).
// - à l'émission, la paie FIGE moyen + destination instantanée
//   (composée des champs pertinents du moyen) : un changement
//   ultérieur du profil ne réécrit pas l'historique.
// - TALON DE PAIE : PDF régénéré à la demande depuis la paie émise ;
//   données d'entrée de la génération vérifiées (montant + destination
//   instantanés) ; accès : Super Admin ou l'employé pour SES paies
//   (paie d'un autre / inexistante -> ERR_TALON_INTROUVABLE) ;
//   en-tête aux DEUX logos (constantes d'assets verrouillées).
// - « Vérifier un employé » : recherche par nom partiel (casse et
//   accents ignorés) et par Display ID ; sélection -> fiche du bon
//   membre ; liste limitée aux comptes plateforme (aucun client).
// Fournisseur démo (le réel est couvert par test-finances-reel.cjs).
// localStorage simulé en mémoire. Compilation via run-tests.sh.
// ============================================================================
const fs = require("fs");
const path = require("path");

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  },
  URL: globalThis.URL,
  Blob: globalThis.Blob,
  File: globalThis.File,
  FileReader: globalThis.FileReader,
  atob: globalThis.atob,
  btoa: globalThis.btoa,
  navigator: { userAgent: "node" },
  location: { href: "" },
};
globalThis.document = { cookie: "" };

const BUILD = process.env.TEST_BUILD_DIR || "/tmp/m7test";
const RACINE = path.join(__dirname, "..");

const { DemoProvider } = require(`${BUILD}/data/demo.js`);
const { SUPER_ADMIN_DEMO_EMAIL, ADMIN_DEMO_EMAIL } = require(`${BUILD}/data/demo-seed.js`);
const FIN = require(`${BUILD}/finances-plateforme.js`);
const PE = require(`${BUILD}/pack-employe.js`);
const TALON = require(`${BUILD}/talon-paie.js`);

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
function lire(rel) {
  return fs.readFileSync(path.join(RACINE, rel), "utf8");
}

const PETIT_PDF = "data:application/pdf;base64," + Buffer.from("%PDF-1.4 piece").toString("base64");
const PETITE_PHOTO = "data:image/jpeg;base64," + Buffer.from("photo-employe").toString("base64");
const MOIS = "2026-11";
const PARAMS_CONTRAT = {
  voie: "travail", type: "CDI", duree: null, montant: 500000,
  devise: "BIF",
  modalites_paiement: "Virement bancaire, au plus tard le 5 du mois suivant.",
  lieu: "Bujumbura, Burundi (bureau de l'Employeur)",
  horaires: "Du lundi au vendredi, de 8 h à 17 h",
  date_debut: "2026-11-09", periode_essai: "trois (3) mois",
};

(async () => {
  console.log("== Fonctions pures : complétude des coordonnées PAR MOYEN ==");
  const cas = [
    ["virement complet SANS IBAN/SWIFT/agence (optionnels) -> présent",
      { moyen: "virement", titulaire: "Aline Uwase", banque: "Banque Solidarité", numero_compte: "00112233" }, true],
    ["virement : banque SANS n° de compte -> incomplet",
      { moyen: "virement", titulaire: "Aline Uwase", banque: "Banque Solidarité" }, false],
    ["virement : n° de compte SANS banque -> incomplet",
      { moyen: "virement", titulaire: "Aline Uwase", numero_compte: "00112233" }, false],
    ["virement complet AVEC IBAN + SWIFT + agence -> présent, champs conservés",
      { moyen: "virement", titulaire: "Aline Uwase", banque: "Banque Solidarité", agence: "Rohero", numero_compte: "00112233", iban: "BI12 3456 7890", swift: "SOLIBI22" }, true],
    ["mobile money : opérateur + numéro -> présent",
      { moyen: "mobile_money", titulaire: "Aline Uwase", operateur: "EcoCash", numero_mobile: "+257 79 00 00 00" }, true],
    ["mobile money SANS opérateur -> incomplet",
      { moyen: "mobile_money", titulaire: "Aline Uwase", numero_mobile: "+257 79 00 00 00" }, false],
    ["mobile money SANS numéro -> incomplet",
      { moyen: "mobile_money", titulaire: "Aline Uwase", operateur: "EcoCash" }, false],
    ["espèces : titulaire SEUL -> présent",
      { moyen: "especes", titulaire: "Aline Uwase" }, true],
    ["espèces SANS titulaire -> incomplet",
      { moyen: "especes", titulaire: " " }, false],
    ["sans moyen -> incomplet",
      { moyen: null, titulaire: "Aline Uwase", banque: "B", numero_compte: "1" }, false],
    ["moyen hors liste -> incomplet",
      { moyen: "cheque", titulaire: "Aline Uwase" }, false],
  ];
  for (const [nom, champs, attendu] of cas) {
    check(nom, FIN.coordonneesPaiementPresentes(champs) === attendu,
      JSON.stringify(FIN.coordonneesPaiementDepuis(champs)));
  }
  const normMobile = FIN.coordonneesPaiementDepuis({
    moyen: "mobile_money", titulaire: "Aline Uwase", operateur: "EcoCash",
    numero_mobile: "+257 79 00 00 00", banque: "Banque Parasite", iban: "XX",
  });
  check("normalisation : les champs hors moyen sont neutralisés (mobile avec banque -> banque null)",
    !!normMobile && normMobile.banque === null && normMobile.iban === null);
  const normVir = FIN.coordonneesPaiementDepuis({
    moyen: "virement", titulaire: "Aline Uwase", banque: "Banque Solidarité",
    agence: "Rohero", numero_compte: "00112233", iban: "BI12 3456 7890", swift: "SOLIBI22",
  });
  check("instantané virement complet : « Virement — Banque, agence — compte, IBAN, SWIFT — Titulaire »",
    FIN.instantaneDestinationPaiement(normVir) ===
      "Virement — Banque Solidarité, agence Rohero — compte 00112233, IBAN BI12 3456 7890, SWIFT SOLIBI22 — Aline Uwase",
    FIN.instantaneDestinationPaiement(normVir));
  check("instantané virement minimal : sans agence/IBAN/SWIFT",
    FIN.instantaneDestinationPaiement(FIN.coordonneesPaiementDepuis({
      moyen: "virement", titulaire: "Aline Uwase", banque: "Banque Solidarité", numero_compte: "00112233",
    })) === "Virement — Banque Solidarité — compte 00112233 — Aline Uwase");
  check("instantané mobile : « Mobile money — EcoCash +257 … — Titulaire »",
    FIN.instantaneDestinationPaiement(normMobile) ===
      "Mobile money — EcoCash +257 79 00 00 00 — Aline Uwase");
  check("instantané espèces : « Espèces — Titulaire »",
    FIN.instantaneDestinationPaiement(FIN.coordonneesPaiementDepuis({
      moyen: "especes", titulaire: "Aline Uwase",
    })) === "Espèces — Aline Uwase");

  console.log("== Fonctions pures : recherche d'employés (nom / Display ID) ==");
  const membresTest = [
    { nom: "Aline Uwase", display_id: "CIM-000003" },
    { nom: "John Assu", display_id: "CIM-000001" },
    { nom: "Barros Innocent", display_id: "CIM-000004" },
  ];
  check("recherche par nom partiel, casse ignorée",
    PE.filtrerMembresEmployes(membresTest, "aline").length === 1 &&
    PE.filtrerMembresEmployes(membresTest, "ALINE")[0].nom === "Aline Uwase");
  check("recherche par nom, accents ignorés (« innocènt » -> Innocent)",
    PE.filtrerMembresEmployes(membresTest, "innocènt").length === 1);
  check("recherche par Display ID partiel, casse ignorée",
    PE.filtrerMembresEmployes(membresTest, "cim-000004")[0].nom === "Barros Innocent");
  check("recherche vide -> toute la liste",
    PE.filtrerMembresEmployes(membresTest, "  ").length === 3);
  check("recherche sans correspondance -> liste vide",
    PE.filtrerMembresEmployes(membresTest, "zzz").length === 0);

  console.log("== Contrôles statiques : SQL, fournisseurs, surfaces, talon ==");
  const sql = lire("supabase/module-coordonnees-paiement.sql");
  check("SQL : 9 colonnes coordonnées sur profils + 2 sur paies_employes",
    ["paiement_moyen", "paiement_titulaire", "paiement_banque", "paiement_agence",
     "paiement_numero_compte", "paiement_iban", "paiement_swift",
     "paiement_operateur", "paiement_numero_mobile", "paiement_destination"]
      .every((c) => sql.includes(c)));
  check("SQL : CHECK du moyen (virement/mobile_money/especes), aucune politique nouvelle",
    sql.includes("paiement_moyen in ('virement', 'mobile_money', 'especes')") &&
    !sql.toLowerCase().includes("create policy"));
  const reel = lire("lib/data/real.ts");
  const demo = lire("lib/data/demo.ts");
  check("fournisseurs : porte coordonnées + instantané à l'émission (réel ET démo)",
    reel.includes("ERR_COORDONNEES_PAIEMENT_MANQUANTES") &&
    demo.includes("ERR_COORDONNEES_PAIEMENT_MANQUANTES") &&
    reel.includes("instantaneDestinationPaiement") &&
    reel.includes("paiement_destination") &&
    demo.includes("paiement_destination"));
  check("BUG PRODUCTION corrigé : la vue Finances trie les dépenses par « cree_le » (pas « created_at »)",
    reel.includes('.order("cree_le", { ascending: false })'));
  check("Mon dossier : section « Mes coordonnées de paiement » + champs selon le moyen",
    lire("app/[locale]/console/mon-dossier/page.tsx").includes("paymentSection") &&
    lire("app/[locale]/console/mon-dossier/page.tsx").includes("formPaiement.moyen === \"virement\"") &&
    lire("app/[locale]/console/mon-dossier/page.tsx").includes("formPaiement.moyen === \"mobile_money\""));
  check("Équipe + Finances : affichage structuré des coordonnées (composant partagé)",
    lire("app/[locale]/console/admins/page.tsx").includes("CoordonneesPaiementVue") &&
    lire("app/[locale]/console/finances-plateforme/page.tsx").includes("CoordonneesPaiementVue") &&
    lire("app/[locale]/console/finances-plateforme/page.tsx").includes("blockCoordonnees"));
  check("Vérifier un employé : liste + recherche câblées (listerEquipeAdmins + filtre pur)",
    lire("app/[locale]/console/verifier-employe/page.tsx").includes("listerEquipeAdmins") &&
    lire("app/[locale]/console/verifier-employe/page.tsx").includes("filtrerMembresEmployes"));
  check("talon : les DEUX logos dans la génération (assets verrouillés)",
    TALON.TALON_LOGO_CIZAIMMO_URL === "/cizaimmo-logo-compact.png" &&
    TALON.TALON_LOGO_CIZAGROUP_URL === "/cizagroup-logo-transparent.png" &&
    lire("lib/talon-paie.ts").includes("logoCizaImmo") &&
    lire("lib/talon-paie.ts").includes("logoCizaGroup") &&
    fs.existsSync(path.join(RACINE, "public/cizaimmo-logo-compact.png")) &&
    fs.existsSync(path.join(RACINE, "public/cizagroup-logo-transparent.png")));
  check("talon : fournisseurs câblés (réel + démo, refus ERR_TALON_INTROUVABLE)",
    reel.includes("genererTalonPaie") && demo.includes("genererTalonPaie") &&
    reel.includes("ERR_TALON_INTROUVABLE") && demo.includes("ERR_TALON_INTROUVABLE"));
  check("parcours client INCHANGÉ : rien des coordonnées côté client",
    !lire("components/AppShell.tsx").includes("paiement_") &&
    !lire("components/DossierBloc.tsx").includes("coordonnees_paiement"));

  // ------------------------------------------------------------------
  const p = new DemoProvider();
  async function connecter(email, mdp = "motdepasse") {
    try { await p.signOut(); } catch { /* pas de session */ }
    await p.signIn(email, mdp);
  }
  async function creerEmploye(nom, email) {
    await p.signOut();
    await p.signUp({
      nom, email, motDePasse: "motdepasse123",
      pays: "Burundi", devisePrincipale: "BIF", langue: "fr", paysIp: "BI",
      telephone: "+257 79 55 55 55", intention: "proprietaire",
    });
    await connecter(SUPER_ADMIN_DEMO_EMAIL);
    await p.promouvoirAdmin(email);
    const membres = await p.listerEquipeAdmins();
    return membres.find((m) => m.email === email);
  }
  async function completerDossier(email, compteId, suffixe = "") {
    await connecter(email, "motdepasse123");
    await p.mettreAJourDossierEmploye({
      telephone: "+257 79 55 55 55",
      adresse: "6ème Avenue N° 47, Buhomba",
      adresse_ville: "Bujumbura",
      adresse_code_postal: null,
      adresse_pays: "Burundi",
    });
    await p.televerserPhotoDossierEmploye({
      type: "autre", entite_type: "compte", entite_id: compteId,
      nom_fichier: `photo${suffixe}.jpg`, taille_octets: 1200,
      mime_type: "image/jpeg", contenu: PETITE_PHOTO,
    });
    const d = await p.televerserPieceDossierEmploye({
      type: "piece_identite", entite_type: "compte", entite_id: compteId,
      nom_fichier: `cni${suffixe}.pdf`, taille_octets: 900,
      mime_type: "application/pdf", contenu: PETIT_PDF,
    });
    return d;
  }

  console.log("== Employé 1 (virement) : ordre des portes d'émission ==");
  const emp1 = await creerEmploye("Coord Virement", "coord.virement@exemple.com");
  check("employé 1 promu, présent dans l'Équipe avec Display ID",
    !!emp1 && /^CIM-\d{6}$/.test(emp1.display_id ?? ""), JSON.stringify(emp1?.display_id));
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const errOrdre1 = await attendErreur(p.emettrePaieEmploye(emp1.id, MOIS));
  check("ordre : dossier incomplet d'abord -> ERR_DOSSIER_INCOMPLET",
    errOrdre1.code === "ERR_DOSSIER_INCOMPLET", errOrdre1.code);
  const dossier1 = await completerDossier("coord.virement@exemple.com", emp1.id);
  check("dossier employé 1 complet SANS coordonnées (complétude inchangée)",
    dossier1.complet === true && dossier1.coordonnees_paiement === null);
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const errOrdre2 = await attendErreur(p.emettrePaieEmploye(emp1.id, MOIS));
  check("ordre : puis le contrat -> ERR_PAIE_SANS_CONTRAT",
    errOrdre2.code === "ERR_PAIE_SANS_CONTRAT", errOrdre2.code);
  await p.preparerContratEmploye(emp1.id, PARAMS_CONTRAT);
  const vue1 = await p.getVueFinancesPlateforme(MOIS);
  const ligne1 = vue1.lignes_paie.find((l) => l.compte_id === emp1.id);
  check("ligne Finances : dossier complet, blocage « coordonnees » seul",
    !!ligne1 && ligne1.dossier_complet === true &&
    JSON.stringify(ligne1.blocages) === JSON.stringify(["coordonnees"]),
    JSON.stringify(ligne1?.blocages));
  const errOrdre3 = await attendErreur(p.emettrePaieEmploye(emp1.id, MOIS));
  check("ordre : enfin les coordonnées -> ERR_COORDONNEES_PAIEMENT_MANQUANTES",
    errOrdre3.code === "ERR_COORDONNEES_PAIEMENT_MANQUANTES", errOrdre3.code);

  console.log("== Coordonnées partielles puis complètes (virement) ==");
  await connecter("coord.virement@exemple.com", "motdepasse123");
  const errMoyen = await attendErreur(
    p.mettreAJourDossierEmploye({ paiement_moyen: "cheque" }));
  check("moyen hors liste refusé à l'enregistrement -> ERR_COORDONNEES_PAIEMENT_INVALIDES",
    errMoyen.code === "ERR_COORDONNEES_PAIEMENT_INVALIDES", errMoyen.code);
  await p.mettreAJourDossierEmploye({
    paiement_moyen: "virement", paiement_titulaire: "Coord Virement",
    paiement_banque: "Banque Solidarité",
  });
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const errPartiel = await attendErreur(p.emettrePaieEmploye(emp1.id, MOIS));
  check("virement SANS n° de compte : toujours bloqué (coordonnées)",
    errPartiel.code === "ERR_COORDONNEES_PAIEMENT_MANQUANTES", errPartiel.code);
  await connecter("coord.virement@exemple.com", "motdepasse123");
  const dossierComplet1 = await p.mettreAJourDossierEmploye({
    paiement_numero_compte: "00112233",
  });
  check("virement complet SANS IBAN : coordonnées présentes",
    dossierComplet1.coordonnees_paiement?.moyen === "virement" &&
    dossierComplet1.coordonnees_paiement?.iban === null);
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const paie1 = await p.emettrePaieEmploye(emp1.id, MOIS, "VIR-001");
  check("émission OK : destination virement instantanée figée",
    paie1.paiement_moyen === "virement" &&
    paie1.paiement_destination ===
      "Virement — Banque Solidarité — compte 00112233 — Coord Virement",
    paie1.paiement_destination);

  console.log("== Instantané FIGÉ : le profil change, la paie ne bouge pas ==");
  await connecter("coord.virement@exemple.com", "motdepasse123");
  await p.mettreAJourDossierEmploye({
    paiement_moyen: "mobile_money", paiement_operateur: "Lumicash",
    paiement_numero_mobile: "+257 69 00 00 00",
  });
  const mesPaies1 = await p.listerMesPaies();
  check("listerMesPaies : destination TOUJOURS le virement d'origine",
    mesPaies1.length === 1 &&
    mesPaies1[0].paiement_destination ===
      "Virement — Banque Solidarité — compte 00112233 — Coord Virement",
    JSON.stringify(mesPaies1.map((x) => x.paiement_destination)));
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const histo1 = (await p.getVueFinancesPlateforme(MOIS)).historique_paies
    .find((x) => x.id === paie1.id);
  check("historique Finances : même destination figée",
    histo1?.paiement_destination === paie1.paiement_destination);

  console.log("== Employé 2 (espèces) : l'Admin du seed ==");
  // NB modèle démo : signUp remplace le profil principal (un seul id)
  // — le second employé du scénario est donc l'Admin du seed, qui a
  // son propre identifiant d'entrée (patron du test finances).
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const membresSeed = await p.listerEquipeAdmins();
  const adminSeed = membresSeed.find((m) => m.email === ADMIN_DEMO_EMAIL);
  check("Admin du seed présente dans l'Équipe (id distinct de l'employé 1)",
    !!adminSeed && adminSeed.id !== emp1.id);
  await connecter(ADMIN_DEMO_EMAIL);
  const departSeed = await p.getMonDossierEmploye();
  await completerDossier(ADMIN_DEMO_EMAIL, departSeed.compte_id, "-seed");
  await p.mettreAJourDossierEmploye({
    paiement_moyen: "especes", paiement_titulaire: "Aline Uwase",
  });
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  await p.preparerContratEmploye(adminSeed.id, PARAMS_CONTRAT);
  const paie2 = await p.emettrePaieEmploye(adminSeed.id, MOIS);
  check("espèces (titulaire seul) : émission OK, destination « Espèces — Titulaire »",
    paie2.paiement_destination === "Espèces — Aline Uwase",
    paie2.paiement_destination);

  console.log("== TALON DE PAIE : génération + accès ==");
  const donneesTalon = TALON.assemblerDonneesTalonPaie(
    paie1,
    { nom: "Coord Virement", display_id: emp1.display_id, role: "admin", langue: "fr" },
    "Ciza Misigaro"
  );
  check("données d'entrée du talon : montant + destination instantanés de la paie émise",
    donneesTalon.montant === 500000 && donneesTalon.devise === "BIF" &&
    donneesTalon.destination === paie1.paiement_destination &&
    donneesTalon.mois === MOIS && donneesTalon.emisParNom === "Ciza Misigaro");
  const textesFr = TALON.textesTalonPaie(donneesTalon);
  check("textes FR : titre, ligne salaire, total (aucune retenue)",
    textesFr.titre === "Talon de paie" &&
    textesFr.ligneSalaire === "Salaire selon contrat d'engagement" &&
    textesFr.totalPayer === "Total à payer" &&
    TALON.formaterMoisTalon(MOIS, "fr") === "Novembre 2026");
  const textesEn = TALON.textesTalonPaie({ ...donneesTalon, langue: "en" });
  check("textes EN symétriques : Pay stub",
    textesEn.titre === "Pay stub" && textesEn.totalPayer === "Total to pay" &&
    TALON.formaterMoisTalon(MOIS, "en") === "November 2026");
  const talonSuper = await p.genererTalonPaie(paie1.id);
  check("Super Admin : talon généré (PDF base64, nom Display ID + mois)",
    talonSuper.nomFichier === `talon-paie-${emp1.display_id}-2026-11.pdf` &&
    talonSuper.contenuBase64.startsWith("JVBERi0") &&
    talonSuper.contenuBase64.length > 500,
    talonSuper.nomFichier);
  await connecter("coord.virement@exemple.com", "motdepasse123");
  const talonPropre = await p.genererTalonPaie(paie1.id);
  check("employé : SON talon se génère", talonPropre.contenuBase64.length > 500);
  const errTalonAutre = await attendErreur(p.genererTalonPaie(paie2.id));
  check("employé : la paie d'un AUTRE -> ERR_TALON_INTROUVABLE",
    errTalonAutre.code === "ERR_TALON_INTROUVABLE", errTalonAutre.code);
  const errTalonInconnu = await attendErreur(p.genererTalonPaie("paie-inexistante"));
  check("paie inexistante -> ERR_TALON_INTROUVABLE",
    errTalonInconnu.code === "ERR_TALON_INTROUVABLE", errTalonInconnu.code);
  await connecter("demo@cizaimmo.com");
  const errTalonClient = await attendErreur(p.genererTalonPaie(paie1.id));
  check("client : talon refusé (ERR_ACCES_PLATEFORME)",
    errTalonClient.code === "ERR_ACCES_PLATEFORME", errTalonClient.code);

  console.log("== Vérifier un employé : liste limitée + sélection ==");
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const equipe = await p.listerEquipeAdmins();
  check("liste Équipe : Display ID + photo exposés pour la sélection",
    equipe.every((m) => "display_id" in m && "photo_profil_url" in m) &&
    equipe.some((m) => m.id === emp1.id && m.display_id === emp1.display_id));
  check("liste limitée aux comptes plateforme : aucun client",
    equipe.every((m) => m.role === "admin" || m.role === "super_admin") &&
    !equipe.some((m) => m.email === "demo@cizaimmo.com"));
  const trouves = PE.filtrerMembresEmployes(equipe, "coord vir");
  check("recherche réelle sur la liste : « coord vir » -> l'employé 1",
    trouves.length === 1 && trouves[0].id === emp1.id,
    JSON.stringify(trouves.map((m) => m.nom)));
  const fiche = await p.verifierEmploye(trouves[0].display_id);
  check("sélection : la fiche affichée est celle du membre choisi",
    !!fiche && fiche.nom === "Coord Virement" &&
    fiche.display_id === emp1.display_id,
    JSON.stringify(fiche && { nom: fiche.nom, id: fiche.display_id }));

  console.log(`\n=== Coordonnées de paiement + liste + talon : ${ok} OK, ${ko} KO ===`);
  process.exit(ko > 0 ? 1 : 0);
})().catch((e) => {
  console.error("ERREUR FATALE", e);
  process.exit(1);
});

// Test « Finances de la plateforme : paie + dépenses supervisées »
// (2026-11-08, décision VALIDÉE par le fondateur) — CizaImmo seulement.
// - paie émise DEPUIS le dossier employé : montant/devise/modalités
//   copiés du contrat d'engagement en base ;
// - dossier INCOMPLET -> émission impossible (ERR_DOSSIER_INCOMPLET)
//   et manquants listés dans la ligne de paie ;
// - pas de contrat (ou sans montant) -> ERR_PAIE_SANS_CONTRAT ;
// - UNICITÉ : une paie par employé et par mois (ERR_PAIE_DEJA_EMISE) ;
// - dépenses : l'Admin SAISIT mais ne VALIDE pas (même les siennes :
//   ERR_SUPER_ADMIN_REQUIS) ; validation/refus SUPER ADMIN seul ;
//   refus sans motif -> ERR_MOTIF_REQUIS ;
// - totaux du mois PAR DEVISE (aucune conversion) : paie émise +
//   dépenses validées ; en attente à part ; refusées exclues ;
// - l'employé ne voit QUE sa paie (listerMesPaies) ; le client est
//   refusé (ERR_ACCES_PLATEFORME) ; parcours client inchangé.
// Fournisseur démo. localStorage simulé en mémoire.
// Compilation préalable via scripts/run-tests.sh (TEST_BUILD_DIR).
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
const AUTRE_MOIS = "2026-10";
const PARAMS_CONTRAT = {
  voie: "travail", type: "CDI", duree: null, montant: 500000,
  devise: "BIF",
  modalites_paiement: "Virement bancaire, au plus tard le 5 du mois suivant.",
  lieu: "Bujumbura, Burundi (bureau de l'Employeur)",
  horaires: "Du lundi au vendredi, de 8 h à 17 h",
  date_debut: "2026-11-09", periode_essai: "trois (3) mois",
};

(async () => {
  console.log("== Fonctions pures : blocages + totaux par devise ==");
  check("moisValide : « 2026-11 » oui, « 2026-13 » non, « 11-2026 » non",
    FIN.moisValide("2026-11") && !FIN.moisValide("2026-13") && !FIN.moisValide("11-2026"));
  check("blocages : dossier incomplet -> « dossier » d'abord (cumulé)",
    JSON.stringify(FIN.blocagesPaie({
      dossierComplet: false, contratPrepare: false,
      montant: null, dejaEmise: false, coordonneesPresentes: true,
    })) === JSON.stringify(["dossier", "contrat"]));
  check("blocages : dossier complet sans contrat -> « contrat »",
    JSON.stringify(FIN.blocagesPaie({
      dossierComplet: true, contratPrepare: false,
      montant: null, dejaEmise: false, coordonneesPresentes: true,
    })) === JSON.stringify(["contrat"]));
  check("blocages : contrat sans montant -> « montant »",
    JSON.stringify(FIN.blocagesPaie({
      dossierComplet: true, contratPrepare: true,
      montant: null, dejaEmise: false, coordonneesPresentes: true,
    })) === JSON.stringify(["montant"]));
  check("blocages : tout en ordre + paie existante -> « deja_emise »",
    JSON.stringify(FIN.blocagesPaie({
      dossierComplet: true, contratPrepare: true,
      montant: 100, dejaEmise: true, coordonneesPresentes: true,
    })) === JSON.stringify(["deja_emise"]));
  check("blocages : tout en ordre SANS coordonnées -> « coordonnees » (2026-11-08)",
    JSON.stringify(FIN.blocagesPaie({
      dossierComplet: true, contratPrepare: true,
      montant: 100, dejaEmise: false, coordonneesPresentes: false,
    })) === JSON.stringify(["coordonnees"]));
  const totauxTest = FIN.totauxParDevise({
    paies: [{ montant: 500000, devise: "BIF" }, { montant: 100, devise: "USD" }],
    depenses: [
      { montant: 200000, devise: "BIF", statut: "validee" },
      { montant: 50, devise: "USD", statut: "en_attente" },
      { montant: 999, devise: "USD", statut: "refusee" },
    ],
  });
  check("totaux : par devise, refusées exclues, en attente à part",
    totauxTest.length === 2 &&
    totauxTest.find((t) => t.devise === "BIF").paie_emise === 500000 &&
    totauxTest.find((t) => t.devise === "BIF").depenses_validees === 200000 &&
    totauxTest.find((t) => t.devise === "USD").depenses_en_attente === 50 &&
    totauxTest.find((t) => t.devise === "USD").depenses_validees === 0,
    JSON.stringify(totauxTest));

  console.log("== Contrôles statiques : SQL, fournisseur, surfaces ==");
  const sql = lire("supabase/module-finances-plateforme.sql");
  check("SQL : tables paies_employes + depenses_plateforme + RLS plateforme",
    sql.includes("create table if not exists public.paies_employes") &&
    sql.includes("create table if not exists public.depenses_plateforme") &&
    sql.includes("est_admin_plateforme()") && sql.includes("est_super_admin()"));
  check("SQL : unicité une paie par employé et par mois (index partiel)",
    sql.includes("paies_employes_unique_mois") &&
    sql.includes("where statut = 'emise'"));
  check("fournisseur : les 6 méthodes finances plateforme",
    ["getVueFinancesPlateforme", "emettrePaieEmploye",
     "saisirDepensePlateforme", "validerDepensePlateforme",
     "refuserDepensePlateforme", "listerMesPaies"].every((m) =>
      lire("lib/data/provider.ts").includes(m)));
  check("ConsoleShell : entrée « Paie & Dépenses » (deux rôles)",
    lire("components/ConsoleShell.tsx").includes("/console/finances-plateforme") &&
    lire("components/ConsoleShell.tsx").includes("platformFinances") &&
    lire("components/IconeNav.tsx").includes("platformFinances"));
  const pageFin = lire("app/[locale]/console/finances-plateforme/page.tsx");
  check("page Finances : vue + émission + saisie + validation via le fournisseur",
    pageFin.includes("getVueFinancesPlateforme") &&
    pageFin.includes("emettrePaieEmploye") &&
    pageFin.includes("saisirDepensePlateforme") &&
    pageFin.includes("validerDepensePlateforme") &&
    pageFin.includes("refuserDepensePlateforme"));
  check("Mon dossier : section « Ma paie » (listerMesPaies)",
    lire("app/[locale]/console/mon-dossier/page.tsx").includes("listerMesPaies"));
  check("parcours client INCHANGÉ : rien des finances plateforme côté client",
    !lire("components/DossierBloc.tsx").includes("financesPlateforme") &&
    !lire("components/AppShell.tsx").includes("finances-plateforme"));

  const p = new DemoProvider();
  async function connecter(email) {
    try { await p.signOut(); } catch { /* pas de session */ }
    await p.signIn(email, "motdepasse");
  }

  console.log("== Surfaces par rôle : le client est refusé ==");
  await connecter("demo@cizaimmo.com");
  check("client : getVueFinancesPlateforme -> ERR_ACCES_PLATEFORME",
    (await attendErreur(p.getVueFinancesPlateforme(MOIS))).code === "ERR_ACCES_PLATEFORME");
  check("client : listerMesPaies -> ERR_ACCES_PLATEFORME",
    (await attendErreur(p.listerMesPaies())).code === "ERR_ACCES_PLATEFORME");

  console.log("== Paie : dossier incomplet = émission impossible ==");
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const membres = await p.listerEquipeAdmins();
  const admin = membres.find((m) => m.email === ADMIN_DEMO_EMAIL);
  const vueDepart = await p.getVueFinancesPlateforme(MOIS);
  const ligneDepart = vueDepart.lignes_paie.find((l) => l.compte_id === admin.id);
  check("ligne Admin : dossier incomplet + manquants listés + blocage « dossier »",
    !!ligneDepart && ligneDepart.dossier_complet === false &&
    ligneDepart.dossier_manquants.length === 4 &&
    ligneDepart.blocages.includes("dossier"),
    JSON.stringify(ligneDepart && ligneDepart.dossier_manquants));
  const errDossier = await attendErreur(p.emettrePaieEmploye(admin.id, MOIS));
  check("émission avec dossier incomplet -> ERR_DOSSIER_INCOMPLET",
    errDossier.code === "ERR_DOSSIER_INCOMPLET", errDossier.code);

  console.log("== Complétion du dossier de l'Admin (comme elle) ==");
  await connecter(ADMIN_DEMO_EMAIL);
  const depart = await p.getMonDossierEmploye();
  await p.mettreAJourDossierEmploye({
    telephone: "+257 79 11 22 33",
    adresse: "6ème Avenue N° 47, Buhomba",
    adresse_ville: "Bujumbura",
    adresse_code_postal: null,
    adresse_pays: "Burundi",
  });
  await p.televerserPhotoDossierEmploye({
    type: "autre", entite_type: "compte", entite_id: depart.compte_id,
    nom_fichier: "photo-employe.jpg", taille_octets: 1200,
    mime_type: "image/jpeg", contenu: PETITE_PHOTO,
  });
  const dossierComplet = await p.televerserPieceDossierEmploye({
    type: "piece_identite", entite_type: "compte", entite_id: depart.compte_id,
    nom_fichier: "passeport.pdf", taille_octets: 900,
    mime_type: "application/pdf", contenu: PETIT_PDF,
  });
  check("dossier de l'Admin complété", dossierComplet.complet === true);
  // Coordonnées de paiement (2026-11-08) : requises pour l'émission.
  const dossierAvecCoord = await p.mettreAJourDossierEmploye({
    paiement_moyen: "mobile_money",
    paiement_titulaire: "Aline Uwase",
    paiement_operateur: "EcoCash",
    paiement_numero_mobile: "+257 79 11 22 33",
  });
  check("coordonnées de l'Admin enregistrées (mobile money)",
    dossierAvecCoord.coordonnees_paiement?.operateur === "EcoCash" &&
    dossierAvecCoord.coordonnees_paiement?.numero_mobile === "+257 79 11 22 33",
    JSON.stringify(dossierAvecCoord.coordonnees_paiement));

  console.log("== Paie : sans contrat, puis émission depuis le contrat ==");
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const errContrat = await attendErreur(p.emettrePaieEmploye(admin.id, MOIS));
  check("dossier complet sans contrat -> ERR_PAIE_SANS_CONTRAT",
    errContrat.code === "ERR_PAIE_SANS_CONTRAT", errContrat.code);
  await p.preparerContratEmploye(admin.id, PARAMS_CONTRAT);
  const paie = await p.emettrePaieEmploye(admin.id, MOIS, "VIR-2026-11-001");
  check("émission OK : montant/devise/modalités copiés du contrat, référence conservée",
    paie.montant === 500000 && paie.devise === "BIF" &&
    paie.modalites === PARAMS_CONTRAT.modalites_paiement &&
    paie.reference === "VIR-2026-11-001" && paie.mois === MOIS,
    JSON.stringify(paie));
  check("émission : moyen + destination instantanés figés sur la paie",
    paie.paiement_moyen === "mobile_money" &&
    paie.paiement_destination ===
      "Mobile money — EcoCash +257 79 11 22 33 — Aline Uwase",
    JSON.stringify(paie));
  const errDoublon = await attendErreur(p.emettrePaieEmploye(admin.id, MOIS));
  check("doublon même mois -> ERR_PAIE_DEJA_EMISE",
    errDoublon.code === "ERR_PAIE_DEJA_EMISE", errDoublon.code);
  const paieAutreMois = await p.emettrePaieEmploye(admin.id, AUTRE_MOIS);
  check("autre mois : émission OK", paieAutreMois.mois === AUTRE_MOIS);
  const errAdminEmission = await (async () => {
    await connecter(ADMIN_DEMO_EMAIL);
    const e = await attendErreur(p.emettrePaieEmploye(admin.id, "2026-09"));
    await connecter(SUPER_ADMIN_DEMO_EMAIL);
    return e;
  })();
  check("un Admin ne peut pas émettre une paie -> ERR_SUPER_ADMIN_REQUIS",
    errAdminEmission.code === "ERR_SUPER_ADMIN_REQUIS", errAdminEmission.code);

  console.log("== Dépenses : saisie Admin, validation Super Admin seul ==");
  await connecter(ADMIN_DEMO_EMAIL);
  const dep1 = await p.saisirDepensePlateforme({
    date: "2026-11-05", libelle: "Hébergement du site — novembre",
    categorie: "hebergement_services", montant: 200000, devise: "BIF",
    justificatif: {
      nom_fichier: "facture-hebergement.pdf", contenu: PETIT_PDF,
      mime_type: "application/pdf", taille_octets: 900,
    },
  });
  check("Admin saisit une dépense (avec justificatif) -> en_attente",
    dep1.statut === "en_attente" &&
    !!dep1.justificatif_path && dep1.categorie === "hebergement_services");
  const errValAdmin = await attendErreur(p.validerDepensePlateforme(dep1.id));
  check("Admin : valider SA propre dépense -> ERR_SUPER_ADMIN_REQUIS",
    errValAdmin.code === "ERR_SUPER_ADMIN_REQUIS", errValAdmin.code);
  const errRefAdmin = await attendErreur(
    p.refuserDepensePlateforme(dep1.id, "Non justifiée"));
  check("Admin : refuser une dépense -> ERR_SUPER_ADMIN_REQUIS",
    errRefAdmin.code === "ERR_SUPER_ADMIN_REQUIS", errRefAdmin.code);
  const dep2 = await p.saisirDepensePlateforme({
    date: "2026-11-06", libelle: "Publicité réseaux sociaux",
    categorie: "marketing", montant: 75, devise: "USD", justificatif: null,
  });
  const dep3 = await p.saisirDepensePlateforme({
    date: "2026-11-07", libelle: "Déplacement client Bujumbura",
    categorie: "deplacements", montant: 40, devise: "USD", justificatif: null,
  });
  const vueAdmin = await p.getVueFinancesPlateforme(MOIS);
  check("vue Admin : SA ligne de paie seulement + SES dépenses seulement",
    vueAdmin.lignes_paie.length === 1 &&
    vueAdmin.lignes_paie[0].compte_id === admin.id &&
    vueAdmin.lignes_paie[0].paie?.id === paie.id &&
    vueAdmin.depenses.length === 3,
    JSON.stringify({
      lignes: vueAdmin.lignes_paie.length, dep: vueAdmin.depenses.length,
    }));

  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const errMotif = await attendErreur(p.refuserDepensePlateforme(dep3.id, "  "));
  check("refus sans motif -> ERR_MOTIF_REQUIS",
    errMotif.code === "ERR_MOTIF_REQUIS", errMotif.code);
  const dep3Refusee = await p.refuserDepensePlateforme(
    dep3.id, "Justificatif manquant : à re-saisir avec la facture.");
  check("refus motivé : statut refusee + motif + validateur enregistrés",
    dep3Refusee.statut === "refusee" &&
    dep3Refusee.motif_refus.includes("Justificatif manquant") &&
    !!dep3Refusee.valide_par && !!dep3Refusee.valide_le);
  const errStatut = await attendErreur(p.validerDepensePlateforme(dep3.id));
  check("valider une dépense déjà traitée -> ERR_STATUT_INVALIDE",
    errStatut.code === "ERR_STATUT_INVALIDE", errStatut.code);
  const dep1Validee = await p.validerDepensePlateforme(dep1.id);
  check("validation Super Admin : statut validee + validateur + date",
    dep1Validee.statut === "validee" && !!dep1Validee.valide_par &&
    !!dep1Validee.valide_le);
  const errInvalide = await attendErreur(p.saisirDepensePlateforme({
    date: "2026-11-08", libelle: " ", categorie: "marketing",
    montant: 10, devise: "USD", justificatif: null,
  }));
  check("saisie invalide (libellé blanc) -> ERR_DEPENSE_INVALIDE",
    errInvalide.code === "ERR_DEPENSE_INVALIDE", errInvalide.code);

  console.log("== Totaux du mois par devise + historique ==");
  const vueFinale = await p.getVueFinancesPlateforme(MOIS);
  const totBif = vueFinale.totaux.find((t) => t.devise === "BIF");
  const totUsd = vueFinale.totaux.find((t) => t.devise === "USD");
  check("totaux BIF : paie 500 000 + dépense validée 200 000",
    !!totBif && totBif.paie_emise === 500000 &&
    totBif.depenses_validees === 200000,
    JSON.stringify(totBif));
  check("totaux USD : en attente 75 (dép. marketing), refusée 40 exclue",
    !!totUsd && totUsd.depenses_en_attente === 75 &&
    totUsd.depenses_validees === 0 && totUsd.paie_emise === 0,
    JSON.stringify(totUsd));
  check("vue Super Admin : toutes les lignes + historique des 2 paies",
    vueFinale.lignes_paie.length >= 2 &&
    vueFinale.historique_paies.length === 2 &&
    vueFinale.historique_paies[0].employe_nom === admin.nom);

  console.log("== Côté employé : il ne voit QUE sa paie ==");
  await connecter(ADMIN_DEMO_EMAIL);
  const mesPaies = await p.listerMesPaies();
  check("listerMesPaies : ses 2 paies, toutes à son nom",
    mesPaies.length === 2 &&
    mesPaies.every((x) => x.profil_id === admin.id) &&
    mesPaies.some((x) => x.mois === MOIS) &&
    mesPaies.some((x) => x.mois === AUTRE_MOIS),
    JSON.stringify(mesPaies.map((x) => x.mois)));
  const dep2vue = (await p.getVueFinancesPlateforme(MOIS)).depenses
    .find((d) => d.id === dep2.id);
  check("l'Admin voit le statut de sa dépense en attente (aucune action)",
    !!dep2vue && dep2vue.statut === "en_attente");

  console.log("== Journal d'audit ==");
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const journal = await p.listerJournalAudit();
  const actions = journal.map((j) => j.action);
  check("journal : paie_emise + saisie + validation + refus journalisés",
    actions.includes("paie_emise") &&
    actions.includes("depense_plateforme_saisie") &&
    actions.includes("depense_plateforme_validee") &&
    actions.includes("depense_plateforme_refusee"),
    actions.join(","));

  console.log(`\n=== Finances plateforme : ${ok} OK, ${ko} KO ===`);
  process.exit(ko > 0 ? 1 : 0);
})().catch((e) => {
  console.error("ERREUR FATALE", e);
  process.exit(1);
});

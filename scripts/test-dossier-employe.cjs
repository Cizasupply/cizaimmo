// Test « Dossier employé des Admins » (2026-11-08, décision du
// fondateur) : un Admin remplit SON dossier complet — photo, pièce
// d'identité, téléphone + ADRESSE postale (nouveau champ).
// - complétude CALCULÉE (fonction pure) : 4 éléments, code postal
//   optionnel, adresse = adresse + ville + pays ;
// - surfaces par rôle : un CLIENT est refusé (ERR_ACCES_PLATEFORME),
//   un admin et le super admin accèdent à « Mon dossier employé » ;
// - exigence suivie NON bloquante : dossier incomplet -> les méthodes
//   console fonctionnent quand même ;
// - page Équipe : statuts calculés par membre + détail Super Admin
//   (listerDossierEmploye ; un admin simple : ERR_SUPER_ADMIN_REQUIS) ;
// - rétroactivité : le Super Admin fondateur démarre « incomplet »,
//   et un compte fraîchement PROMU Admin aussi (adresse manquante) ;
// - parcours client inchangé : aucun champ adresse côté client.
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
const DE = require(`${BUILD}/dossier-employe.js`);

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

(async () => {
  console.log("== Fonction pure : complétude calculée ==");
  const base = {
    photoPresente: true, piecePresente: true,
    telephone: "+257 79 00 00 00",
    adresse: "6ème Avenue N° 47", adresseVille: "Bujumbura",
    adresseCodePostal: null, adressePays: "Burundi",
  };
  check("4 éléments présents (code postal absent) -> complet",
    DE.evaluerDossierEmploye(base).complet === true);
  check("code postal renseigné -> toujours complet",
    DE.evaluerDossierEmploye({ ...base, adresseCodePostal: "BP 123" }).complet === true);
  check("adresse sans ville -> manquant « adresse » seulement",
    JSON.stringify(DE.evaluerDossierEmploye({ ...base, adresseVille: " " }).manquants) ===
      JSON.stringify(["adresse"]));
  check("rien du tout -> les 4 manquants, dans l'ordre",
    JSON.stringify(DE.evaluerDossierEmploye({
      photoPresente: false, piecePresente: false, telephone: null,
      adresse: null, adresseVille: null, adressePays: null,
    }).manquants) === JSON.stringify(["photo", "piece_identite", "telephone", "adresse"]));
  check("téléphone vide (espaces) -> manquant « telephone »",
    DE.evaluerDossierEmploye({ ...base, telephone: "   " }).manquants.includes("telephone"));

  console.log("== Statique : SQL, surfaces, parcours client intact ==");
  const sql = lire("supabase/module-dossier-employe.sql");
  check("SQL : les 4 colonnes d'adresse (add column if not exists)",
    ["adresse", "adresse_ville", "adresse_code_postal", "adresse_pays"].every((c) =>
      sql.includes(`add column if not exists ${c}`) || sql.includes(`${c} text`)));
  check("SQL : vérifications V1..V4 documentées",
    ["V1", "V2", "V3", "V4"].every((v) => sql.includes(v)));
  check("SQL : rétroactivité + cas du compte de test CIM-000003 documentés",
    sql.includes("CIM-000003") && sql.includes("CIM-000001"));
  check("fournisseur : les 5 méthodes du dossier employé sont déclarées",
    ["getMonDossierEmploye", "mettreAJourDossierEmploye", "televerserPhotoDossierEmploye",
     "televerserPieceDossierEmploye", "listerDossierEmploye"].every((m) =>
      lire("lib/data/provider.ts").includes(m)));
  check("ConsoleShell : entrée « Mon dossier employé » (deux rôles plateforme)",
    lire("components/ConsoleShell.tsx").includes("/console/mon-dossier") &&
    lire("components/ConsoleShell.tsx").includes("myEmployeeFile") &&
    lire("components/IconeNav.tsx").includes("myEmployeeFile"));
  const page = lire("app/[locale]/console/mon-dossier/page.tsx");
  check("page Mon dossier employé : lit + complète via le fournisseur",
    page.includes("getMonDossierEmploye") &&
    page.includes("televerserPieceDossierEmploye") &&
    page.includes("televerserPhotoDossierEmploye") &&
    page.includes("mettreAJourDossierEmploye"));
  const equipe = lire("app/[locale]/console/admins/page.tsx");
  check("page Équipe : statut par membre + détail (listerDossierEmploye)",
    equipe.includes("dossier_employe_complet") &&
    equipe.includes("listerDossierEmploye"));
  check("parcours client INCHANGÉ : le bloc dossier client n'a aucun champ adresse",
    !lire("components/DossierBloc.tsx").includes("adresse"));

  const p = new DemoProvider();
  async function connecter(email) {
    try { await p.signOut(); } catch { /* pas de session */ }
    await p.signIn(email, "motdepasse");
  }

  console.log("== Surfaces par rôle : le client est refusé ==");
  await connecter("demo@cizaimmo.com");
  const errClient = await attendErreur(p.getMonDossierEmploye());
  check("client : getMonDossierEmploye -> ERR_ACCES_PLATEFORME",
    errClient.code === "ERR_ACCES_PLATEFORME", errClient.code);
  const errClientMaj = await attendErreur(
    p.mettreAJourDossierEmploye({ adresse: "1 rue Test" })
  );
  check("client : mettreAJourDossierEmploye -> ERR_ACCES_PLATEFORME",
    errClientMaj.code === "ERR_ACCES_PLATEFORME", errClientMaj.code);

  console.log("== Admin démo : départ incomplet, NON bloquant, complétion ==");
  await connecter(ADMIN_DEMO_EMAIL);
  const depart = await p.getMonDossierEmploye();
  check("rétroactivité : l'Admin existant démarre INCOMPLET (4 manquants)",
    depart.complet === false &&
    JSON.stringify(depart.manquants) ===
      JSON.stringify(["photo", "piece_identite", "telephone", "adresse"]),
    JSON.stringify(depart.manquants));
  const comptes = await p.listerComptesPlateforme();
  check("NON bloquant : la console fonctionne avec un dossier incomplet",
    Array.isArray(comptes) && comptes.length > 0);
  const apresChamps = await p.mettreAJourDossierEmploye({
    telephone: "+257 79 11 22 33",
    adresse: "6ème Avenue N° 47, Buhomba",
    adresse_ville: "Bujumbura",
    adresse_code_postal: null,
    adresse_pays: "Burundi",
  });
  check("téléphone + adresse (sans code postal) -> restent photo + pièce",
    apresChamps.complet === false &&
    JSON.stringify(apresChamps.manquants) === JSON.stringify(["photo", "piece_identite"]),
    JSON.stringify(apresChamps.manquants));
  const apresPhoto = await p.televerserPhotoDossierEmploye({
    type: "autre", entite_type: "compte", entite_id: depart.compte_id,
    nom_fichier: "photo-employe.jpg", taille_octets: 1200,
    mime_type: "image/jpeg", contenu: PETITE_PHOTO,
  });
  check("photo téléversée -> reste la pièce",
    JSON.stringify(apresPhoto.manquants) === JSON.stringify(["piece_identite"]),
    JSON.stringify(apresPhoto.manquants));
  const complet = await p.televerserPieceDossierEmploye({
    type: "piece_identite", entite_type: "compte", entite_id: depart.compte_id,
    nom_fichier: "passeport.pdf", taille_octets: 900,
    mime_type: "application/pdf", contenu: PETIT_PDF,
  });
  check("pièce déposée -> dossier COMPLET",
    complet.complet === true && complet.manquants.length === 0 &&
    complet.piece_identite?.nom_fichier === "passeport.pdf",
    JSON.stringify(complet.manquants));

  console.log("== Équipe (Super Admin) : statuts + détail ==");
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const membres = await p.listerEquipeAdmins();
  const membreAdmin = membres.find((m) => m.email === ADMIN_DEMO_EMAIL);
  const membreSuper = membres.find((m) => m.email === SUPER_ADMIN_DEMO_EMAIL);
  check("Équipe : l'Admin complété s'affiche COMPLET",
    !!membreAdmin && membreAdmin.dossier_employe_complet === true,
    membreAdmin && JSON.stringify(membreAdmin.dossier_employe_manquants));
  check("Équipe : le Super Admin fondateur démarre INCOMPLET (rétroactivité)",
    !!membreSuper && membreSuper.dossier_employe_complet === false &&
    membreSuper.dossier_employe_manquants.includes("adresse"),
    membreSuper && JSON.stringify(membreSuper.dossier_employe_manquants));
  const detail = await p.listerDossierEmploye(membreAdmin.id);
  check("détail Super Admin : adresse + pièce + téléphone du membre",
    detail.complet === true &&
    detail.adresse === "6ème Avenue N° 47, Buhomba" &&
    detail.adresse_ville === "Bujumbura" &&
    detail.adresse_pays === "Burundi" &&
    detail.telephone === "+257 79 11 22 33" &&
    detail.piece_identite?.nom_fichier === "passeport.pdf",
    JSON.stringify({ a: detail.adresse, p: detail.piece_identite?.nom_fichier }));
  const monDossierSuper = await p.getMonDossierEmploye();
  check("le Super Admin a SA page dossier (incomplète au départ)",
    monDossierSuper.role === "super_admin" && monDossierSuper.complet === false);

  console.log("== Détail réservé au Super Admin ==");
  await connecter(ADMIN_DEMO_EMAIL);
  const errDetail = await attendErreur(p.listerDossierEmploye(membreSuper.id));
  check("admin simple : listerDossierEmploye -> ERR_SUPER_ADMIN_REQUIS",
    errDetail.code === "ERR_SUPER_ADMIN_REQUIS", errDetail.code);

  console.log("== Promotion : le nouvel Admin démarre incomplet ==");
  await p.signOut();
  await p.signUp({
    nom: "Employé Test", email: "employe.test@exemple.com", motDePasse: "motdepasse123",
    pays: "Burundi", devisePrincipale: "BIF", langue: "fr", paysIp: "BI",
    telephone: "+257 79 44 44 44", intention: "proprietaire",
  });
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  await p.promouvoirAdmin("employe.test@exemple.com");
  const membresApres = await p.listerEquipeAdmins();
  const membrePromu = membresApres.find((m) => m.email === "employe.test@exemple.com");
  check("compte promu : présent dans l'Équipe, dossier INCOMPLET (adresse manquante)",
    !!membrePromu && membrePromu.dossier_employe_complet === false &&
    membrePromu.dossier_employe_manquants.includes("adresse"),
    membrePromu && JSON.stringify(membrePromu.dossier_employe_manquants));

  console.log(`\nRésultat : ${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => {
  console.error("ERREUR FATALE", e);
  process.exit(1);
});

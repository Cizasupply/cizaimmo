// Test « Pack employé Admin » (2026-11-08, pack VALIDÉ par le
// fondateur, branché PAR-DESSUS le dossier employé) :
// - Code 128 pur : vecteurs calculés à la main (CIM-000001 ->
//   contrôle 5, 145 modules ; ABC -> contrôle 1) ;
// - contrat à DEUX VOIES : voie A « travail » = texte validé (CDI,
//   certificat de travail, Code du travail) ; voie B « prestation »
//   = prestataire indépendant, virement international, fin de
//   mission SANS certificat de travail ni solde de tout compte
//   salarié ; AUCUN « INSS » dans AUCUN texte généré (verrou) ;
// - cycle complet en démo : préparation Super Admin (e-mail avec le
//   PDF joint) -> dépôt du signé -> refus à motif obligatoire ->
//   redépôt -> validation ; charte acceptée et DATÉE (idempotente) ;
// - carte conditionnée : dossier COMPLET + contrat VALIDÉ ;
// - vérification contre la base : un employé SUSPENDU ressort
//   NON VALIDE ; un Display ID inconnu -> null ;
// - correctifs 2026-11-08 (soir) : verdict de vérification en
//   TROIS états (vert seulement si la carte est ÉMISE ; ambre
//   « CARTE NON ÉMISE » si le compte est en règle sans carte) et
//   logo de la maison mère CIZA GROUP sur la carte employé
//   (écran + PDF, PNG transparent verrouillé) ;
// - surfaces par rôle : le client est refusé (ERR_ACCES_PLATEFORME),
//   la préparation/revue sont réservées au Super Admin ;
// - parcours client inchangé.
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
const FICHIERS_GOAL = path.join(
  RACINE, "..", "goals", "lancer-cizaimmo-en-saas", "files"
);

const { DemoProvider } = require(`${BUILD}/data/demo.js`);
const { SUPER_ADMIN_DEMO_EMAIL, ADMIN_DEMO_EMAIL } = require(`${BUILD}/data/demo-seed.js`);
const C128 = require(`${BUILD}/code128.js`);
const PE = require(`${BUILD}/pack-employe.js`);
const CE = require(`${BUILD}/contrat-employe.js`);

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
function texteComplet(textes) {
  return [
    textes.titre, textes.partieEntreprise, textes.partieEmploye,
    textes.introArticles,
    ...textes.articles.flatMap((a) => [a.titre, ...a.paragraphes]),
    textes.cloture,
  ].join("\n");
}

const PETIT_PDF = "data:application/pdf;base64," + Buffer.from("%PDF-1.4 piece").toString("base64");
const PETITE_PHOTO = "data:image/jpeg;base64," + Buffer.from("photo-employe").toString("base64");

const PARAMS_A = {
  voie: "travail", type: "CDI", duree: null, montant: 500000,
  devise: "BIF",
  modalites_paiement: "Virement bancaire, au plus tard le 5 du mois suivant.",
  lieu: "Bujumbura, Burundi (bureau de l'Employeur), avec déplacements possibles dans le pays",
  horaires: "Du lundi au vendredi, de 8 h à 17 h",
  date_debut: "2026-11-09", periode_essai: "trois (3) mois",
};
const PARAMS_B = {
  voie: "prestation", type: "PRESTA_DET", duree: "six (6) mois",
  montant: 1200, devise: "USD",
  modalites_paiement: "Virement international mensuel.",
  lieu: "Toronto, Canada (à distance)",
  horaires: "Disponibilité du lundi au vendredi, de 9 h à 17 h (heure de Toronto)",
  date_debut: "2026-11-09", periode_essai: null,
};

(async () => {
  console.log("== Code 128 : vecteurs de référence ==");
  const v1 = C128.encoderCode128B("CIM-000001");
  check("CIM-000001 : valeurs [104, 35, 41, 45, 13, 16×5, 17, contrôle 5, 106]",
    JSON.stringify(v1.valeurs) ===
      JSON.stringify([104, 35, 41, 45, 13, 16, 16, 16, 16, 16, 17, 5, 106]),
    JSON.stringify(v1.valeurs));
  check("CIM-000001 : 145 modules au total",
    v1.modules.length === 145, String(v1.modules.length));
  check("ABC : contrôle = 1",
    C128.encoderCode128B("ABC").valeurs.at(-2) === 1,
    JSON.stringify(C128.encoderCode128B("ABC").valeurs));
  const errVide = await attendErreur(Promise.resolve().then(() => C128.encoderCode128B("  ")));
  check("texte vide -> ERR_CODE128_VIDE", errVide.code === "ERR_CODE128_VIDE", errVide.code);
  const errCar = await attendErreur(Promise.resolve().then(() => C128.encoderCode128B("CIM-é")));
  check("caractère hors jeu B -> ERR_CODE128_CARACTERE", errCar.code === "ERR_CODE128_CARACTERE", errCar.code);

  console.log("== Logique pure : carte, progression, vérification ==");
  check("carte émise = dossier complet + contrat validé (et rien d'autre)",
    PE.carteEmployeEmise(true, "valide") === true &&
    PE.carteEmployeEmise(true, "a_signer") === false &&
    PE.carteEmployeEmise(false, "valide") === false);
  check("blocages : dossier incomplet + contrat non validé -> les deux",
    JSON.stringify(PE.blocagesCarteEmploye(false, "a_signer")) ===
      JSON.stringify(["dossier", "contrat"]));
  const prog0 = PE.progressionPackEmploye({
    dossierComplet: false, charteAccepteeLe: null,
    statutContrat: "sans_objet", carteEmise: false,
  });
  check("progression au départ : dossier en_cours, le reste à faire",
    JSON.stringify(prog0.map((e) => e.etat)) ===
      JSON.stringify(["en_cours", "a_faire", "a_faire", "a_faire"]));
  const progFin = PE.progressionPackEmploye({
    dossierComplet: true, charteAccepteeLe: "2026-11-08T10:00:00.000Z",
    statutContrat: "valide", carteEmise: true,
  });
  check("progression complète : 4 étapes faites",
    progFin.every((e) => e.etat === "faite"));
  check("vérification : suspendu ou accès fermé -> NON VALIDE",
    PE.verificationEmployeValide({ statutCompte: "suspendu", accesConsoleActif: true }) === false &&
    PE.verificationEmployeValide({ statutCompte: "actif", accesConsoleActif: false }) === false &&
    PE.verificationEmployeValide({ statutCompte: "actif", accesConsoleActif: true }) === true);
  check("verdict TROIS états : suspendu/fermé -> non_valide ; actif + carte émise -> valide ; actif SANS carte -> carte_non_emise",
    PE.verdictVerificationEmploye({ statutCompte: "suspendu", accesConsoleActif: true, carteEmise: true }) === "non_valide" &&
    PE.verdictVerificationEmploye({ statutCompte: "actif", accesConsoleActif: false, carteEmise: true }) === "non_valide" &&
    PE.verdictVerificationEmploye({ statutCompte: "suspendu", accesConsoleActif: true, carteEmise: false }) === "non_valide" &&
    PE.verdictVerificationEmploye({ statutCompte: "actif", accesConsoleActif: true, carteEmise: true }) === "valide" &&
    PE.verdictVerificationEmploye({ statutCompte: "actif", accesConsoleActif: true, carteEmise: false }) === "carte_non_emise");

  console.log("== Textes générés : deux voies, différences strictes, aucun INSS ==");
  const donneesBase = {
    nom: "Employé Test", displayId: "CIM-000099",
    email: "employe.test@exemple.com", telephone: "+257 79 44 44 44",
    adresse: "6ème Avenue N° 47, Bujumbura, Burundi",
    pieceIdentite: "passeport.pdf", langue: "fr", date: "2026-11-08",
  };
  const texteA = texteComplet(CE.textesContratEmploye({ ...donneesBase, parametres: PARAMS_A }));
  const texteB = texteComplet(CE.textesContratEmploye({ ...donneesBase, parametres: PARAMS_B }));
  check("voie A : Contrat de travail, CDI traduit, partie « L'Employé »",
    texteA.includes("Contrat de travail") &&
    texteA.includes("indéterminée (CDI)") &&
    texteA.includes("L'Employé"));
  check("voie A : certificat de travail + solde de tout compte + Code du travail",
    texteA.includes("certificat de travail") &&
    texteA.includes("solde de tout compte") &&
    texteA.includes("Code du travail"));
  check("voie A : période d'essai rendue",
    texteA.includes("trois (3) mois"));
  check("voie B : prestation de services + collaborateur indépendant, sans subordination",
    texteB.includes("Contrat de prestation de services") &&
    texteB.includes("collaborateur indépendant") &&
    texteB.includes("ni lien de subordination"));
  check("voie B : virement international + lieu déclaré (Toronto)",
    texteB.includes("virement international") && texteB.includes("Toronto"));
  check("voie B : fin de mission SANS certificat ni solde salarié (négation explicite)",
    texteB.includes("ne donne lieu ni à un certificat de travail, ni à un solde de tout compte"));
  check("voie B : ni « Code du travail », ni « bulletin de paie », ni salariat",
    !texteB.includes("Code du travail") &&
    !texteB.includes("bulletin de paie") &&
    !texteB.includes("droit du travail burundais"));
  check("les DEUX voies : tâches + confidentialité + journalisation identiques",
    texteA.includes("Revue des dossiers clients") &&
    texteB.includes("Revue des dossiers clients") &&
    texteA.includes("strictement confidentielles") &&
    texteB.includes("strictement confidentielles") &&
    texteA.includes("journalisé dans le journal d'audit") &&
    texteB.includes("journalisé dans le journal d'audit"));
  check("AUCUN « INSS » dans les textes générés (A, B) ni la charte du code",
    !texteA.includes("INSS") && !texteB.includes("INSS") &&
    !lire("lib/contrat-employe.ts").includes("INSS"));
  const brouillonB = fs.readFileSync(
    path.join(FICHIERS_GOAL, "pack-employe-contrat-prestation-BROUILLON.md"), "utf8");
  check("variante voie B consignée pour relecture (fichier du goal), sans INSS",
    brouillonB.includes("collaborateur indépendant") && !brouillonB.includes("INSS"));

  console.log("== Statique : SQL, fournisseur, surfaces ==");
  const sql = lire("supabase/module-pack-employe.sql");
  check("SQL : colonnes contrat + charte (add column if not exists)",
    ["statut_contrat_employe", "motif_contrat_employe", "contrat_employe_voie",
     "contrat_employe_montant", "contrat_employe_date_debut",
     "contrat_employe_prepare_le", "charte_acceptee_le"].every((c) =>
      sql.includes(`add column if not exists ${c}`)));
  check("SQL : contraintes des statuts et des voies + V1..V5",
    sql.includes("sans_objet") && sql.includes("signe_depose") &&
    sql.includes("'travail'") && sql.includes("'prestation'") &&
    ["V1", "V2", "V3", "V4", "V5"].every((v) => sql.includes(v)));
  check("fournisseur : les 9 méthodes du pack sont déclarées",
    ["getMonPackEmploye", "getPackEmploye", "accepterCharteEmploye",
     "preparerContratEmploye", "genererContratEmploye",
     "televerserContratEmployeSigne", "validerContratEmploye",
     "refuserContratEmploye", "verifierEmploye"].every((m) =>
      lire("lib/data/provider.ts").includes(m)));
  const shell = lire("components/ConsoleShell.tsx");
  check("ConsoleShell : « Vérifier un employé » + portail charte monté",
    shell.includes("/console/verifier-employe") &&
    shell.includes("CharteConfidentialite"));
  check("ConsoleShell : entrée « Vérifier un employé » verrouillée Super Admin (superSeul, 2026-11-08)",
    /\{\s*key: "verifyEmployee",[^}]*superSeul: true\s*\}/.test(shell));
  const charte = lire("components/CharteConfidentialite.tsx");
  check("portail charte : acceptation via le fournisseur (datée en base)",
    charte.includes("accepterCharteEmploye") && charte.includes("charteItem1"));
  const monDossier = lire("app/[locale]/console/mon-dossier/page.tsx");
  check("Mon dossier : progression + contrat (dépôt) + carte à code-barres",
    monDossier.includes("getMonPackEmploye") &&
    monDossier.includes("televerserContratEmployeSigne") &&
    monDossier.includes("CarteEmploye") &&
    monDossier.includes("progression"));
  const equipe = lire("app/[locale]/console/admins/page.tsx");
  check("Équipe : pastilles contrat/charte/carte + panneau de préparation",
    equipe.includes("contrat_employe_statut") &&
    equipe.includes("charte_acceptee_le") &&
    equipe.includes("PackEmployeAdmin") &&
    lire("components/PackEmployeAdmin.tsx").includes("preparerContratEmploye"));
  const pageVerif = lire("app/[locale]/console/verifier-employe/page.tsx");
  check("page Vérifier : saisie Display ID + bannière NON VALIDE",
    pageVerif.includes("verifierEmploye") && pageVerif.includes("verifyInvalid"));
  check("page Vérifier : verdict TROIS états (vert si carte émise, ambre « CARTE NON ÉMISE », rouge sinon)",
    pageVerif.includes("resultat.verdict") &&
    pageVerif.includes("carte_non_emise") &&
    pageVerif.includes("verifyCardNotIssued") &&
    pageVerif.includes("verifyCardNotIssuedHint") &&
    pageVerif.includes("bg-amber-400"));
  check("fournisseurs (réel + démo) : verdict calculé par la fonction pure, « valide » = verdict « valide »",
    lire("lib/data/real.ts").includes("verdictVerificationEmploye") &&
    lire("lib/data/demo.ts").includes("verdictVerificationEmploye") &&
    lire("lib/data/real.ts").includes('valide: verdict === "valide"') &&
    lire("lib/data/demo.ts").includes('valide: verdict === "valide"'));

  console.log("== Carte employé : logo Ciza Group (maison mère) ==");
  const assetLogo = path.join(RACINE, "public", "cizagroup-logo-transparent.png");
  check("asset public présent : public/cizagroup-logo-transparent.png",
    fs.existsSync(assetLogo));
  const octetsLogo = fs.readFileSync(assetLogo);
  check("asset = PNG à canal alpha (type couleur 6, aucun fond blanc) et signature PNG",
    octetsLogo.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    octetsLogo[25] === 6,
    `type=${octetsLogo[25]}`);
  const composantCarte = lire("components/CarteEmploye.tsx");
  check("carte : logo référencé à l'ÉCRAN (img) et dans le PDF (addImage), même asset",
    composantCarte.includes('"/cizagroup-logo-transparent.png"') &&
    composantCarte.includes("LOGO_GROUPE_URL") &&
    (composantCarte.match(/LOGO_GROUPE_URL/g) ?? []).length >= 3 &&
    composantCarte.includes('alt="Ciza Group"') &&
    composantCarte.slice(composantCarte.indexOf("telechargerPdf"))
      .includes("addImage(dataUrlLogo"));
  check("parcours client INCHANGÉ : aucun élément du pack côté client",
    !lire("components/DossierBloc.tsx").includes("packEmploye") &&
    !lire("components/AppShell.tsx").includes("CharteConfidentialite"));

  const p = new DemoProvider();
  const emails = [];
  p.envoyerEmailAlerteFn = async (m) => {
    emails.push(m);
    return { envoye: true };
  };
  async function connecter(email, mdp = "motdepasse") {
    try { await p.signOut(); } catch { /* pas de session */ }
    await p.signIn(email, mdp);
  }

  console.log("== Surfaces par rôle : le client est refusé ==");
  await connecter("demo@cizaimmo.com");
  const errClient = await attendErreur(p.getMonPackEmploye());
  check("client : getMonPackEmploye -> ERR_ACCES_PLATEFORME",
    errClient.code === "ERR_ACCES_PLATEFORME", errClient.code);
  const errClientVerif = await attendErreur(p.verifierEmploye("CIM-000001"));
  check("client : verifierEmploye -> ERR_ACCES_PLATEFORME",
    errClientVerif.code === "ERR_ACCES_PLATEFORME", errClientVerif.code);

  console.log("== Verrouillage 2026-11-08 : le sous-admin est refusé ==");
  await connecter(ADMIN_DEMO_EMAIL);
  const errAdminVerif = await attendErreur(p.verifierEmploye("CIM-000001"));
  check("admin : verifierEmploye -> ERR_SUPER_ADMIN_REQUIS",
    errAdminVerif.code === "ERR_SUPER_ADMIN_REQUIS", errAdminVerif.code);
  const errAdminListe = await attendErreur(p.listerEquipeAdmins());
  check("admin : listerEquipeAdmins (liste de la page Vérifier) -> ERR_SUPER_ADMIN_REQUIS",
    errAdminListe.code === "ERR_SUPER_ADMIN_REQUIS", errAdminListe.code);

  console.log("== Préparation du compte employé de test (promotion) ==");
  await p.signOut();
  await p.signUp({
    nom: "Employé Pack", email: "employe.pack@exemple.com", motDePasse: "motdepasse123",
    pays: "Burundi", devisePrincipale: "BIF", langue: "fr", paysIp: "BI",
    telephone: "+257 79 44 44 44", intention: "proprietaire",
  });
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  await p.promouvoirAdmin("employe.pack@exemple.com");
  const membres0 = await p.listerEquipeAdmins();
  const membre = membres0.find((m) => m.email === "employe.pack@exemple.com");
  check("membre promu présent dans l'Équipe, pack au départ (sans_objet, charte en attente, carte non émise)",
    !!membre && membre.contrat_employe_statut === "sans_objet" &&
    membre.charte_acceptee_le === null && membre.carte_employe_emise === false,
    membre && JSON.stringify({
      c: membre.contrat_employe_statut, ch: membre.charte_acceptee_le, carte: membre.carte_employe_emise,
    }));
  const packDepart = await p.getPackEmploye(membre.id);
  check("Display ID du membre récupéré via le pack (format CIM-000000)",
    /^CIM-\d{6}$/.test(packDepart.display_id ?? ""),
    String(packDepart.display_id));
  const displayId = packDepart.display_id;
  const verifSansCarte = await p.verifierEmploye(displayId);
  check("vérification AVANT émission : compte actif mais verdict « carte_non_emise » (JAMAIS « valide » sans carte)",
    !!verifSansCarte && verifSansCarte.verdict === "carte_non_emise" &&
    verifSansCarte.valide === false && verifSansCarte.carte_emise === false &&
    verifSansCarte.statut_compte === "actif",
    verifSansCarte && JSON.stringify({ v: verifSansCarte.verdict, c: verifSansCarte.carte_emise }));

  console.log("== Charte : acceptation datée, idempotente ==");
  await connecter("employe.pack@exemple.com", "motdepasse123");
  const packAvantCharte = await p.getMonPackEmploye();
  check("avant acceptation : charte en attente dans MON pack",
    packAvantCharte.charte_acceptee_le === null);
  const packCharte = await p.accepterCharteEmploye();
  check("acceptation : date posée",
    typeof packCharte.charte_acceptee_le === "string" &&
    packCharte.charte_acceptee_le.length > 0, packCharte.charte_acceptee_le);
  const packCharte2 = await p.accepterCharteEmploye();
  check("seconde acceptation : la PREMIÈRE date est conservée (idempotente)",
    packCharte2.charte_acceptee_le === packCharte.charte_acceptee_le,
    `${packCharte2.charte_acceptee_le} vs ${packCharte.charte_acceptee_le}`);

  console.log("== Préparation voie A par le Super Admin + e-mail avec le PDF ==");
  await connecter(ADMIN_DEMO_EMAIL);
  const errPrepAdmin = await attendErreur(p.preparerContratEmploye(membre.id, PARAMS_A));
  check("admin simple : preparerContratEmploye -> ERR_SUPER_ADMIN_REQUIS",
    errPrepAdmin.code === "ERR_SUPER_ADMIN_REQUIS", errPrepAdmin.code);
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const errParams = await attendErreur(
    p.preparerContratEmploye(membre.id, { ...PARAMS_A, lieu: " " }));
  check("paramètres incomplets -> ERR_PARAMETRES_CONTRAT",
    errParams.code === "ERR_PARAMETRES_CONTRAT", errParams.code);
  emails.length = 0;
  const packPrepare = await p.preparerContratEmploye(membre.id, PARAMS_A);
  check("préparation : statut « a_signer », paramètres stockés, date posée",
    packPrepare.contrat_statut === "a_signer" &&
    packPrepare.contrat_parametres?.voie === "travail" &&
    packPrepare.contrat_parametres?.montant === 500000 &&
    !!packPrepare.contrat_prepare_le);
  const mailPrep = emails.find((m) => m.destinataire === "employe.pack@exemple.com");
  check("e-mail de mise à disposition : contrat PDF joint, nommé par Display ID",
    !!mailPrep && Array.isArray(mailPrep.piecesJointes) &&
    mailPrep.piecesJointes.length === 1 &&
    mailPrep.piecesJointes[0].nom === `contrat-employe-${displayId}.pdf` &&
    Buffer.from(mailPrep.piecesJointes[0].contenuBase64, "base64")
      .toString("latin1").startsWith("%PDF"),
    mailPrep && JSON.stringify((mailPrep.piecesJointes || []).map((x) => x.nom)));
  const genere = await p.genererContratEmploye(membre.id);
  check("génération à la demande : même nom, contenu PDF",
    genere.nomFichier === `contrat-employe-${displayId}.pdf` &&
    Buffer.from(genere.contenuBase64, "base64").toString("latin1").startsWith("%PDF"));

  console.log("== Dépôt du signé, refus motivé, redépôt, validation ==");
  await connecter("employe.pack@exemple.com", "motdepasse123");
  const errDepotSansContrat = await attendErreur(p.televerserContratEmployeSigne({
    type: "contrat", entite_type: "compte", entite_id: membre.id,
    nom_fichier: "contrat-signe.pdf", taille_octets: 900,
    mime_type: "application/pdf", contenu: PETIT_PDF,
  }));
  check("dépôt accepté dès « a_signer » (pas d'erreur d'état)", errDepotSansContrat.levee === false,
    errDepotSansContrat.code);
  const packDepose = await p.getMonPackEmploye();
  check("après dépôt : statut « signe_depose » + document au pack",
    packDepose.contrat_statut === "signe_depose" &&
    packDepose.contrat_document?.nom_fichier === "contrat-signe.pdf",
    packDepose.contrat_statut);
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const errMotif = await attendErreur(p.refuserContratEmploye(membre.id, "   "));
  check("refus sans motif -> ERR_MOTIF_REQUIS",
    errMotif.code === "ERR_MOTIF_REQUIS", errMotif.code);
  emails.length = 0;
  await p.refuserContratEmploye(membre.id, "Signature illisible : renvoyez un scan net.");
  const packRefuse = await p.getPackEmploye(membre.id);
  check("refus : statut « refuse » + motif conservé + e-mail de décision",
    packRefuse.contrat_statut === "refuse" &&
    packRefuse.contrat_motif === "Signature illisible : renvoyez un scan net." &&
    emails.some((m) => m.destinataire === "employe.pack@exemple.com"),
    packRefuse.contrat_statut);
  await connecter("employe.pack@exemple.com", "motdepasse123");
  await p.televerserContratEmployeSigne({
    type: "contrat", entite_type: "compte", entite_id: membre.id,
    nom_fichier: "contrat-signe-v2.pdf", taille_octets: 950,
    mime_type: "application/pdf", contenu: PETIT_PDF,
  });
  const packRedepose = await p.getMonPackEmploye();
  check("redépôt après refus : « signe_depose », motif effacé",
    packRedepose.contrat_statut === "signe_depose" &&
    packRedepose.contrat_motif === null &&
    packRedepose.contrat_document?.nom_fichier === "contrat-signe-v2.pdf",
    packRedepose.contrat_statut);
  check("carte PAS encore émise : dossier employé incomplet",
    packRedepose.carte_emise === false &&
    packRedepose.carte_blocages.includes("dossier"));

  console.log("== Complétion du dossier + validation -> carte émise ==");
  await p.mettreAJourDossierEmploye({
    telephone: "+257 79 44 44 44",
    adresse: "6ème Avenue N° 47, Buhomba",
    adresse_ville: "Bujumbura", adresse_code_postal: null,
    adresse_pays: "Burundi",
  });
  const idDossier = packRedepose.dossier.compte_id;
  await p.televerserPhotoDossierEmploye({
    type: "autre", entite_type: "compte", entite_id: idDossier,
    nom_fichier: "photo-employe.jpg", taille_octets: 1200,
    mime_type: "image/jpeg", contenu: PETITE_PHOTO,
  });
  await p.televerserPieceDossierEmploye({
    type: "piece_identite", entite_type: "compte", entite_id: idDossier,
    nom_fichier: "passeport.pdf", taille_octets: 900,
    mime_type: "application/pdf", contenu: PETIT_PDF,
  });
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  emails.length = 0;
  await p.validerContratEmploye(membre.id);
  const packValide = await p.getPackEmploye(membre.id);
  check("validation : statut « valide » + e-mail de décision",
    packValide.contrat_statut === "valide" &&
    emails.some((m) => m.destinataire === "employe.pack@exemple.com"));
  check("carte ÉMISE : dossier complet + contrat validé, aucun blocage",
    packValide.carte_emise === true && packValide.carte_blocages.length === 0 &&
    packValide.dossier.complet === true);
  check("progression finale : 4 étapes faites",
    packValide.progression.every((e) => e.etat === "faite"),
    JSON.stringify(packValide.progression));
  const membresFin = await p.listerEquipeAdmins();
  const membreFin = membresFin.find((m) => m.id === membre.id);
  check("Équipe : le membre affiche contrat validé, charte datée, carte émise",
    !!membreFin && membreFin.contrat_employe_statut === "valide" &&
    !!membreFin.charte_acceptee_le && membreFin.carte_employe_emise === true);

  console.log("== Vérification contre la base : actif, suspendu, inconnu ==");
  const verifOk = await p.verifierEmploye(displayId.toLowerCase());
  check("vérification (casse libre) : employé trouvé, VALIDE (carte émise -> verdict « valide »)",
    !!verifOk && verifOk.valide === true && verifOk.verdict === "valide" &&
    verifOk.statut_compte === "actif" && verifOk.carte_emise === true &&
    verifOk.contrat_statut === "valide" && !!verifOk.charte_acceptee_le,
    verifOk && JSON.stringify({ v: verifOk.valide, s: verifOk.statut_compte }));
  await p.suspendreAdmin(membre.id);
  const verifSuspendu = await p.verifierEmploye(displayId);
  check("employé SUSPENDU : verdict « non_valide », visiblement suspendu (même avec une carte émise)",
    !!verifSuspendu && verifSuspendu.valide === false &&
    verifSuspendu.verdict === "non_valide" &&
    verifSuspendu.statut_compte === "suspendu",
    verifSuspendu && JSON.stringify({ v: verifSuspendu.valide, s: verifSuspendu.statut_compte }));
  await p.reactiverAdmin(membre.id);
  const verifRe = await p.verifierEmploye(displayId);
  check("réactivé : la vérification repasse VALIDE (verdict « valide »)",
    !!verifRe && verifRe.valide === true && verifRe.verdict === "valide");
  const verifInconnu = await p.verifierEmploye("CIM-999999");
  check("Display ID inconnu -> null", verifInconnu === null);

  console.log("== Voie B : préparation prestation sur un persona promu ==");
  // (Les entrées plateforme SEEDÉES de la démo n'ont pas de Display ID
  // propre et la démo n'a qu'un compte principal inscriptible : la
  // voie B est éprouvée sur un persona client seedé promu Admin —
  // Jean Bosco, CIM-000003 — qui a un vrai Display ID, comme tout
  // compte en production.)
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  await p.promouvoirAdmin("jean.bosco.demo@exemple.bi");
  const membresB = await p.listerEquipeAdmins();
  const membreB = membresB.find((m) => m.email === "jean.bosco.demo@exemple.bi");
  const packB = await p.preparerContratEmploye(membreB.id, PARAMS_B);
  check("voie B : paramètres prestation stockés (période d'essai forcée à null)",
    packB.contrat_parametres?.voie === "prestation" &&
    packB.contrat_parametres?.periode_essai === null &&
    packB.contrat_parametres?.devise === "USD");
  const genereB = await p.genererContratEmploye(membreB.id);
  check("voie B : PDF généré au nom du membre (son Display ID CIM-000003)",
    genereB.nomFichier === "contrat-employe-CIM-000003.pdf" &&
    packB.display_id === "CIM-000003" &&
    Buffer.from(genereB.contenuBase64, "base64").toString("latin1").startsWith("%PDF"),
    genereB.nomFichier);

  console.log(`\nRésultat : ${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => {
  console.error("ERREUR FATALE", e);
  process.exit(1);
});

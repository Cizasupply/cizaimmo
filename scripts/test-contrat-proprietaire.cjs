// Test Option C (2026-11-08) — Contrat de service PROPRIÉTAIRE non
// bloquant : déclinaison du flux gestionnaire v1.3.
// - génération PDF propriétaire personnalisée (FR + EN) ;
// - approbation propriétaire -> bienvenue + contrat PDF en pièce
//   jointe, statut « a_signer », essai démarré (NON BLOQUANT :
//   écritures métier libres pendant tout le cycle) ;
// - dépôt du signé -> « signe_depose » ; refus Admin motivé ->
//   « refuse » (+ motif, e-mail) ; redépôt -> « signe_depose » ;
//   refus sans motif -> ERR_MOTIF_REQUIS ; validation Admin ->
//   « valide » (+ e-mail) ; re-validation -> ERR_STATUT_INVALIDE ;
// - rétroactivité : le propriétaire démo déjà approuvé (profil
//   principal, cas Kaneza) a son contrat disponible, « a_signer »,
//   sans e-mail de rattrapage ;
// - statique : SQL versionné (colonnes + CHECK 5 statuts + backfill),
//   surfaces (page contrat, console Dossier), aucun « juriste ».
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
const { SUPER_ADMIN_DEMO_EMAIL } = require(`${BUILD}/data/demo-seed.js`);
const AV = require(`${BUILD}/avis.js`);
const CT = require(`${BUILD}/contrat.js`);

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

const PETIT_PDF = Buffer.from("%PDF-1.4 document de test").toString("base64");

(async () => {
  console.log("== Fonctions pures : contrat propriétaire PDF + e-mails ==");
  const contrat = await CT.genererContratProprietairePdf({
    nom: "Kaneza Rehema", displayId: "CIM-000002", email: "nacm2009@yahoo.ca",
    telephone: "+257 79 94 50 08", pays: "Burundi", langue: "fr", date: "2026-11-08",
  });
  check("contrat propriétaire : nom de fichier avec le Display ID",
    contrat.nomFichier === "contrat-proprietaire-CIM-000002.pdf", contrat.nomFichier);
  const pdfTexte = Buffer.from(contrat.contenuBase64, "base64").toString("latin1");
  check("contrat propriétaire : contenu = un vrai PDF", pdfTexte.startsWith("%PDF"), pdfTexte.slice(0, 8));
  check("contrat propriétaire : taille raisonnable pour une pièce jointe (< 500 Ko)",
    contrat.contenuBase64.length < 700000, `${contrat.contenuBase64.length} caractères base64`);
  const contratEn = await CT.genererContratProprietairePdf({
    nom: "John Smith", displayId: "CIM-000043", email: "john@exemple.com",
    telephone: null, pays: "Canada", langue: "en", date: "2026-11-08",
  });
  check("contrat propriétaire EN : généré au même format",
    contratEn.nomFichier === "contrat-proprietaire-CIM-000043.pdf" &&
    Buffer.from(contratEn.contenuBase64, "base64").toString("latin1").startsWith("%PDF"));
  const bienvenue = AV.rendreBienvenueProprietaire("Kaneza Rehema", "CIM-000002", "fr");
  check("bienvenue propriétaire FR : nom + Display ID + non-bloquant énoncé",
    bienvenue.corps.includes("Kaneza Rehema") && bienvenue.corps.includes("CIM-000002") &&
    bienvenue.corps.includes("rien n'est bloqué"));
  const refusMail = AV.rendreRefusContratProprietaire("Kaneza Rehema", "Signature illisible", "fr");
  check("e-mail de refus : motif repris",
    refusMail.corps.includes("Signature illisible"));

  console.log("== Statique : SQL, surfaces, garde-fous ==");
  const sql = lire("supabase/module-contrat-proprietaire.sql");
  check("SQL : colonnes dédiées statut + motif",
    sql.includes("statut_contrat_proprietaire") && sql.includes("motif_contrat_proprietaire"));
  check("SQL : CHECK des 5 statuts",
    ["sans_objet", "a_signer", "signe_depose", "valide", "refuse"].every((s) => sql.includes(`'${s}'`)));
  check("SQL : backfill rétroactif des propriétaires approuvés (-> a_signer)",
    sql.includes("update public.profils") && sql.includes("type_intention = 'proprietaire'") &&
    sql.includes("'en_attente'"));
  check("SQL : vérification du cas Kaneza (CIM-000002) documentée",
    sql.includes("CIM-000002"));
  const contratTs = lire("lib/contrat.ts");
  check("contrat.ts : aucune mention de relecture par un juriste",
    !/juriste/i.test(contratTs));
  check("contrat.ts : variante propriétaire présente (titre de service)",
    contratTs.includes("Contrat de service — Propriétaire CizaImmo"));
  check("page /contrat : section propriétaire branchée",
    lire("app/[locale]/contrat/page.tsx").includes("SectionContratProprietaire"));
  check("AppShell : entrée « Mon contrat » ouverte aux propriétaires",
    lire("components/AppShell.tsx").includes('profil?.type_intention === "proprietaire"'));
  const dossierConsole = lire("app/[locale]/console/comptes/[id]/page.tsx");
  check("console Dossier : revue du contrat propriétaire (valider + refuser)",
    dossierConsole.includes("validerContratProprietaire") &&
    dossierConsole.includes("refuserContratProprietaire") &&
    dossierConsole.includes("ownerContractStatus"));
  check("real.ts : cycle propriétaire câblé (statuts + motif)",
    lire("lib/data/real.ts").includes("statut_contrat_proprietaire") &&
    lire("lib/data/real.ts").includes("ERR_MOTIF_REQUIS"));

  const p = new DemoProvider();
  const emails = [];
  p.envoyerEmailAlerteFn = async (m) => {
    emails.push(m);
    return { envoye: true };
  };
  async function connecter(email) {
    try { await p.signOut(); } catch { /* pas de session */ }
    await p.signIn(email, "motdepasse");
  }
  async function compteParEmail(email) {
    const comptes = await p.listerComptesPlateforme();
    return comptes.find((c) => c.email === email);
  }

  console.log("== Rétroactivité : propriétaire déjà approuvé (cas Kaneza) ==");
  emails.length = 0;
  await connecter("demo@cizaimmo.com");
  const profilPrincipal = await p.getProfil();
  const monContrat = await p.getMonContratProprietaire();
  check("rétroactivité : statut « a_signer » sans nouvel e-mail",
    monContrat.statut === "a_signer" && emails.length === 0, monContrat.statut);
  check("rétroactivité : contrat téléchargeable (nom + PDF)",
    monContrat.nomFichier === `contrat-proprietaire-${profilPrincipal.display_id}.pdf` &&
    !!monContrat.contenuBase64 &&
    Buffer.from(monContrat.contenuBase64, "base64").toString("latin1").startsWith("%PDF"),
    monContrat.nomFichier);

  console.log("== Non-bloquant : les écritures métier restent libres ==");
  const abo = await p.getAbonnement();
  check("essai actif pendant « a_signer »", !!abo && abo.statut === "essai", abo && abo.statut);
  const locataire = await p.creerLocataire({
    nom: "Locataire Test Option C", telephone: "+257 79 00 00 99",
    email: null, piece_type: null, piece_numero: null,
    adresse_precedente: null, contact_urgence: null, notes: null,
  });
  check("création d'un locataire possible pendant « a_signer »", !!locataire.id);

  console.log("== Cycle : dépôt -> refus motivé -> redépôt -> validation ==");
  await p.televerserContratProprietaireSigne({
    nom_fichier: "contrat-signe.pdf", type_mime: "application/pdf",
    contenu_base64: PETIT_PDF, taille_octets: 26,
  });
  let etat = await p.getMonContratProprietaire();
  check("dépôt du signé : statut « signe_depose »", etat.statut === "signe_depose", etat.statut);

  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const errSansMotif = await attendErreur(
    p.refuserContratProprietaire(profilPrincipal.id, "   ")
  );
  check("refus sans motif : ERR_MOTIF_REQUIS",
    errSansMotif.code === "ERR_MOTIF_REQUIS", errSansMotif.code);
  emails.length = 0;
  await p.refuserContratProprietaire(profilPrincipal.id, "Signature illisible");
  const compteRefuse = await compteParEmail("demo@cizaimmo.com");
  check("refus Admin : statut « refuse » + motif conservé (console)",
    compteRefuse && compteRefuse.statut_contrat_proprietaire === "refuse" &&
    compteRefuse.motif_contrat_proprietaire === "Signature illisible",
    compteRefuse && `${compteRefuse.statut_contrat_proprietaire}/${compteRefuse.motif_contrat_proprietaire}`);
  check("refus Admin : e-mail au propriétaire avec le motif",
    emails.some((m) => m.destinataire === "demo@cizaimmo.com" &&
      (m.texte ?? "").includes("Signature illisible")));

  await connecter("demo@cizaimmo.com");
  etat = await p.getMonContratProprietaire();
  check("côté propriétaire : statut « refuse » + motif visibles",
    etat.statut === "refuse" && etat.motif === "Signature illisible",
    `${etat.statut}/${etat.motif}`);
  await p.televerserContratProprietaireSigne({
    nom_fichier: "contrat-signe-corrige.pdf", type_mime: "application/pdf",
    contenu_base64: PETIT_PDF, taille_octets: 26,
  });
  etat = await p.getMonContratProprietaire();
  check("redépôt après refus : « signe_depose », motif effacé",
    etat.statut === "signe_depose" && etat.motif === null, `${etat.statut}/${etat.motif}`);

  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  emails.length = 0;
  await p.validerContratProprietaire(profilPrincipal.id);
  const compteValide = await compteParEmail("demo@cizaimmo.com");
  check("validation Admin : statut « valide »",
    compteValide && compteValide.statut_contrat_proprietaire === "valide",
    compteValide && compteValide.statut_contrat_proprietaire);
  check("validation Admin : e-mail de confirmation au propriétaire",
    emails.some((m) => m.destinataire === "demo@cizaimmo.com"));
  const errRevalider = await attendErreur(p.validerContratProprietaire(profilPrincipal.id));
  check("re-valider un contrat déjà valide : ERR_STATUT_INVALIDE",
    errRevalider.code === "ERR_STATUT_INVALIDE", errRevalider.code);

  console.log("== Approbation d'un nouveau propriétaire : bienvenue + contrat joint ==");
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  // Une session plateforme ne peut pas s'inscrire : on repasse par
  // une déconnexion complète avant le signUp du nouveau compte.
  await p.signOut();
  await p.signUp({
    nom: "Propriétaire Option C", email: "proprio.c@exemple.com", motDePasse: "motdepasse123",
    pays: "Burundi", devisePrincipale: "BIF", langue: "fr", paysIp: "BI",
    telephone: "+257 79 22 22 22", intention: "proprietaire",
  });
  const profilNouveau = await p.getProfil();
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  await p.enregistrerChecklistDossier(profilNouveau.id, {
    photo_verifiee: true, piece_coherente: true,
    infos_verifiees: true, antifraude_examinee: true,
  });
  emails.length = 0;
  await p.approuverCompte(profilNouveau.id);
  const compteNouveau = await compteParEmail("proprio.c@exemple.com");
  check("après approbation : statut_contrat_proprietaire = a_signer",
    compteNouveau && compteNouveau.statut_contrat_proprietaire === "a_signer",
    compteNouveau && compteNouveau.statut_contrat_proprietaire);
  check("après approbation : essai démarré immédiatement (non bloquant)",
    compteNouveau && compteNouveau.abonnement && compteNouveau.abonnement.statut === "essai",
    compteNouveau && compteNouveau.abonnement && compteNouveau.abonnement.statut);
  const mailBienvenue = emails.find((m) => m.destinataire === "proprio.c@exemple.com");
  check("bienvenue : contrat propriétaire PDF en pièce jointe",
    !!mailBienvenue && Array.isArray(mailBienvenue.piecesJointes) &&
    mailBienvenue.piecesJointes.length === 1 &&
    mailBienvenue.piecesJointes[0].nom === `contrat-proprietaire-${profilNouveau.display_id}.pdf`,
    mailBienvenue && JSON.stringify((mailBienvenue.piecesJointes || []).map((x) => x.nom)));
  check("pièce jointe : décodage base64 = %PDF",
    !!mailBienvenue &&
    Buffer.from(mailBienvenue.piecesJointes[0].contenuBase64, "base64").toString("latin1").startsWith("%PDF"));
  check("génération plateforme du contrat d'un propriétaire (console)",
    await p.genererContratProprietaire(profilNouveau.id).then(
      (r) => r.nomFichier === `contrat-proprietaire-${profilNouveau.display_id}.pdf`
    ).catch(() => false));

  console.log(`\nRésultat : ${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => {
  console.error("ERREUR FATALE", e);
  process.exit(1);
});

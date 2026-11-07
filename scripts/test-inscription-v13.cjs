// Test Extension v1.3 — parcours d'inscription et dossiers vérifiés :
// Display ID séquentiel, intention (vs rôle), dossier complet/incomplet,
// approbation gestionnaire -> contrat PDF cacheté joint à l'e-mail de
// décision, contrat signé -> validation Admin -> déblocage, et
// rattachement par Display ID à TRIPLE validation (propriétaire ->
// gestionnaire -> Admin) avec accès limité aux immeubles assignés.
// Fournisseur démo. localStorage simulé en mémoire.
// Compilation préalable via scripts/run-tests.sh (TEST_BUILD_DIR).
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  },
  // jsPDF (chargé dynamiquement par lib/contrat.ts lors de
  // l'approbation d'un gestionnaire) détecte « window » et exige les
  // API navigateur de base : on lui fournit celles de Node, sinon son
  // chargement plante (« reading 'bind' »). Le fournisseur démo
  // n'utilise que localStorage — ces champs sont inertes pour lui.
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

const { DemoProvider } = require(`${BUILD}/data/demo.js`);
const {
  SUPER_ADMIN_DEMO_EMAIL,
  GESTIONNAIRE_DEMO_EMAIL,
} = require(`${BUILD}/data/demo-seed.js`);
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

const PETIT_PDF = Buffer.from("%PDF-1.4 document de test").toString("base64");
const PETITE_PHOTO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString("base64");

(async () => {
  const p = new DemoProvider();
  // Capture de TOUS les e-mails sortants (décisions, activations…).
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

  console.log("== Fonctions pures : avis gestionnaire + contrat PDF ==");
  const avisGest = AV.rendreDecisionGestionnaire("Awa Ndiaye", "CIM-000042", "fr");
  check("avis décision gestionnaire FR : nom + Display ID présents",
    avisGest.corps.includes("Awa Ndiaye") && avisGest.corps.includes("CIM-000042"));
  check("avis décision : aucune mention de relecture par un juriste",
    !/juriste/i.test(avisGest.corps) && !/juriste/i.test(avisGest.objet));
  const contrat = await CT.genererContratGestionnairePdf({
    nom: "Awa Ndiaye", displayId: "CIM-000042", email: "awa@exemple.sn",
    telephone: "+221 77 000 00 00", pays: "Sénégal", langue: "fr",
    date: "2026-11-07",
  });
  check("contrat : nom de fichier avec le Display ID",
    contrat.nomFichier === "contrat-gestionnaire-CIM-000042.pdf", contrat.nomFichier);
  const pdfTexte = Buffer.from(contrat.contenuBase64, "base64").toString("latin1");
  check("contrat : contenu = un vrai PDF", pdfTexte.startsWith("%PDF"), pdfTexte.slice(0, 8));
  check("contrat : taille raisonnable pour une pièce jointe (< 500 Ko)",
    contrat.contenuBase64.length < 700000, `${contrat.contenuBase64.length} caractères base64`);
  const contratEn = await CT.genererContratGestionnairePdf({
    nom: "John Smith", displayId: "CIM-000043", email: "john@exemple.com",
    telephone: "+1 555 000 0000", pays: "Canada", langue: "en",
    date: "2026-11-07",
  });
  check("contrat EN : généré au même format",
    contratEn.nomFichier === "contrat-gestionnaire-CIM-000043.pdf" &&
    Buffer.from(contratEn.contenuBase64, "base64").toString("latin1").startsWith("%PDF"));

  console.log("== Personas démo v1.3 : Display ID fixes ==");
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const comptesSeed = await p.listerComptesPlateforme();
  const amina = comptesSeed.find((c) => c.email === "demo@cizaimmo.com");
  check("fondateur démo : CIM-000001", amina && amina.display_id === "CIM-000001", amina && amina.display_id);
  check("fondateur démo : dossier complet signalé", amina && amina.dossier_complet === true);
  // Marc Dubois est le persona gestionnaire virtuel (pas un compte du
  // registre console) : on le vérifie via SON profil de session.
  await connecter(GESTIONNAIRE_DEMO_EMAIL);
  const profilMarc = await p.getProfil();
  check("Marc Dubois : CIM-000002, intention gestionnaire, contrat valide",
    profilMarc.display_id === "CIM-000002" && profilMarc.type_intention === "gestionnaire" &&
    profilMarc.statut_contrat === "valide",
    JSON.stringify({ d: profilMarc.display_id, c: profilMarc.statut_contrat }));
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const sira = comptesSeed.find((c) => c.display_id === "CIM-000011");
  check("Sira Diallo : gestionnaire, contrat signé reçu (à valider)",
    !!sira && sira.statut_contrat === "signe_recu");
  const incomplet = comptesSeed.find((c) => c.display_id === "CIM-000005");
  check("compte au dossier incomplet signalé comme tel",
    !!incomplet && incomplet.dossier_complet === false);
  check("recherche console par Display ID (données)",
    comptesSeed.filter((c) => (c.display_id || "").toLowerCase().includes("cim-000011")).length === 1);
  check("recherche console par téléphone (données)",
    comptesSeed.some((c) => (c.telephone || "").includes("77 123 45 67")));

  console.log("== Inscription : Display ID, intention, téléphone ==");
  await p.signUp({
    nom: "Gestionnaire Test", email: "gest.test@exemple.com", motDePasse: "motdepasse123",
    pays: "Burundi", devisePrincipale: "BIF", langue: "fr", paysIp: "BI",
    telephone: "+257 79 00 00 00", intention: "gestionnaire",
  });
  const profilGest = await p.getProfil();
  check("Display ID au format CIM-0000XX", /^CIM-\d{6}$/.test(profilGest.display_id || ""), profilGest.display_id);
  check("premier Display ID après les personas : CIM-000012",
    profilGest.display_id === "CIM-000012", profilGest.display_id);
  check("intention stockée : gestionnaire", profilGest.type_intention === "gestionnaire");
  check("rôle technique inchangé à l'inscription : proprietaire",
    profilGest.role === "proprietaire", profilGest.role);
  check("téléphone stocké", profilGest.telephone === "+257 79 00 00 00", profilGest.telephone);
  const gestId = profilGest.id;
  const gestDisplay = profilGest.display_id;

  console.log("== Dossier : incomplet -> complet ==");
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  let compteGest = await compteParEmail("gest.test@exemple.com");
  check("nouveau compte signalé « dossier incomplet »", compteGest && compteGest.dossier_complet === false);
  await connecter("gest.test@exemple.com");
  await p.soumettreDocumentCompte("piece_identite", {
    nom_fichier: "cni-gest.pdf", type_mime: "application/pdf",
    contenu_base64: PETIT_PDF, taille_octets: 26,
  });
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  compteGest = await compteParEmail("gest.test@exemple.com");
  check("pièce reçue mais photo manquante : toujours incomplet",
    compteGest && compteGest.dossier_complet === false);
  await connecter("gest.test@exemple.com");
  await p.televerserPhotoProfil({
    nom_fichier: "photo.jpg", type_mime: "image/jpeg",
    contenu_base64: PETITE_PHOTO, taille_octets: 7,
  });
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  compteGest = await compteParEmail("gest.test@exemple.com");
  check("photo + pièce : dossier complet", compteGest && compteGest.dossier_complet === true);

  console.log("== Approbation gestionnaire : contrat + e-mail avec pièce jointe ==");
  emails.length = 0;
  await p.approuverCompte(gestId);
  compteGest = await compteParEmail("gest.test@exemple.com");
  check("après approbation : statut_contrat = a_signer",
    compteGest && compteGest.statut_contrat === "a_signer", compteGest && compteGest.statut_contrat);
  const mailDecision = emails.find((m) => m.destinataire === "gest.test@exemple.com");
  check("e-mail de décision envoyé au gestionnaire", !!mailDecision);
  check("e-mail de décision : contrat PDF en pièce jointe",
    !!mailDecision && Array.isArray(mailDecision.piecesJointes) && mailDecision.piecesJointes.length === 1 &&
    mailDecision.piecesJointes[0].nom === `contrat-gestionnaire-${gestDisplay}.pdf`,
    mailDecision && JSON.stringify((mailDecision.piecesJointes || []).map((x) => x.nom)));
  check("pièce jointe : décodage base64 = %PDF",
    !!mailDecision && Buffer.from(mailDecision.piecesJointes[0].contenuBase64, "base64").toString("latin1").startsWith("%PDF"));

  console.log("== Contrat signé -> validation Admin -> déblocage ==");
  await connecter("gest.test@exemple.com");
  const monContrat = await p.getMonContrat();
  check("Mon contrat : statut a_signer + PDF téléchargeable",
    monContrat.statut === "a_signer" && !!monContrat.contenuBase64 &&
    Buffer.from(monContrat.contenuBase64, "base64").toString("latin1").startsWith("%PDF"));
  await p.televerserContratSigne({
    nom_fichier: "contrat-signe.pdf", type_mime: "application/pdf",
    contenu_base64: PETIT_PDF, taille_octets: 26,
  });
  const monContrat2 = await p.getMonContrat();
  check("contrat signé téléversé : statut signe_recu", monContrat2.statut === "signe_recu", monContrat2.statut);
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  emails.length = 0;
  await p.validerContrat(gestId);
  compteGest = await compteParEmail("gest.test@exemple.com");
  check("validation Admin : statut_contrat = valide",
    compteGest && compteGest.statut_contrat === "valide", compteGest && compteGest.statut_contrat);
  check("e-mail d'activation des fonctions envoyé",
    emails.some((m) => m.destinataire === "gest.test@exemple.com"));
  // Même validation sur un compte du registre (Sira, signe_recu seedé).
  await p.validerContrat(sira.id);
  const siraApres = await compteParEmail(sira.email);
  check("validation Admin (registre) : Sira passe à valide",
    siraApres && siraApres.statut_contrat === "valide", siraApres && siraApres.statut_contrat);
  const errRevalider = await attendErreur(p.validerContrat(sira.id));
  check("re-valider un contrat déjà valide : ERR_STATUT_INVALIDE",
    errRevalider.code === "ERR_STATUT_INVALIDE", errRevalider.code);

  console.log("== Rattachement par Display ID : triple validation ==");
  await p.signUp({
    nom: "Propriétaire Test", email: "proprio.test@exemple.com", motDePasse: "motdepasse123",
    pays: "Burundi", devisePrincipale: "BIF", langue: "fr", paysIp: "BI",
    telephone: "+257 79 11 11 11", intention: "proprietaire",
  });
  const profilProprio = await p.getProfil();
  check("Display ID unique : le propriétaire reçoit le suivant",
    profilProprio.display_id === "CIM-000013" && profilProprio.display_id !== gestDisplay,
    profilProprio.display_id);
  // Règle v1.2 : les écritures sont bloquées tant que le compte est
  // en_attente — l'Admin approuve d'abord le propriétaire.
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  await p.approuverCompte(profilProprio.id);
  await connecter("proprio.test@exemple.com");
  const immeubleNeuf = await p.creerImmeuble({
    nom: "Résidence Test V13", adresse: "Avenue Test N° 1", ville: "Bujumbura", pays: "Burundi",
    devise: "BIF", type: "immeuble", etages: null, photo_url: null, notes: null,
    valeur_bien: null, devise_valeur: null, date_acquisition: null, prix_acquisition: null,
  });
  check("immeuble de test créé par le propriétaire", !!immeubleNeuf.id);

  const trouve = await p.rechercherCompteParDisplayId("CIM-000002");
  check("recherche par Display ID : nom seul exposé",
    !!trouve && trouve.nom === "Marc Dubois" && Object.keys(trouve).sort().join(",") === "display_id,nom",
    JSON.stringify(trouve));
  const introuvable = await p.rechercherCompteParDisplayId("CIM-999999");
  check("Display ID inconnu : null", introuvable === null);

  // La graine contient déjà une demande Amina -> Marc en attente
  // (demande-demo-2) ; en démo mono-base, le nouveau propriétaire
  // partage l'id du profil principal : Marc la REFUSE d'abord (ce qui
  // libère la voie et teste le chemin du refus).
  await connecter(GESTIONNAIRE_DEMO_EMAIL);
  const enAttenteMarc = await p.listerDemandesRattachement();
  const seedee = enAttenteMarc.find(
    (d) => d.proprietaire_id === profilProprio.id && d.statut === "en_attente_gestionnaire"
  );
  check("demande seedée Amina -> Marc visible par Marc", !!seedee);
  if (seedee) {
    const refusee = await p.repondreDemandeRattachement(seedee.id, false);
    check("refus par le gestionnaire : statut refuse", refusee.statut === "refuse", refusee.statut);
  }
  await connecter("proprio.test@exemple.com");

  const demande = await p.demanderRattachementParDisplayId("CIM-000002");
  check("demande créée : en_attente_gestionnaire", demande.statut === "en_attente_gestionnaire", demande.statut);
  const errDoublon = await attendErreur(p.demanderRattachementParDisplayId("CIM-000002"));
  check("seconde demande identique : ERR_DEMANDE_EXISTANTE",
    errDoublon.code === "ERR_DEMANDE_EXISTANTE", errDoublon.code);

  // Le gestionnaire accepte (contrat valide) -> en_attente_admin.
  await connecter(GESTIONNAIRE_DEMO_EMAIL);
  const recues = await p.listerDemandesRattachement();
  const recue = recues.find((d) => d.id === demande.id);
  check("le gestionnaire voit la demande reçue", !!recue && recue.statut === "en_attente_gestionnaire");
  const apresAcceptation = await p.repondreDemandeRattachement(demande.id, true);
  check("acceptation : en_attente_admin", apresAcceptation.statut === "en_attente_admin", apresAcceptation.statut);

  // AVANT la validation Admin : aucun accès au nouvel immeuble.
  const immeublesMarcAvant = await p.listerImmeubles();
  check("avant validation Admin : Marc ne voit PAS le nouvel immeuble",
    !immeublesMarcAvant.some((i) => i.id === immeubleNeuf.id));

  // L'Admin valide -> rattachement créé, immeuble_ids VIDE.
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const validee = await p.validerRattachementAdmin(demande.id, true);
  check("validation Admin : demande active + rattachement créé",
    validee.statut === "actif" && !!validee.rattachement_id, JSON.stringify(validee));
  const dossierProprio = await p.listerDossier(profilProprio.id);
  const rattachement = dossierProprio.rattachements_comme_proprietaire
    .find((r) => r.id === validee.rattachement_id);
  check("rattachement : contexte proprietaire, aucun immeuble assigné",
    !!rattachement && rattachement.contexte === "proprietaire" && rattachement.immeuble_ids.length === 0,
    JSON.stringify(rattachement));

  // Toujours aucun accès tant que rien n'est assigné.
  await connecter(GESTIONNAIRE_DEMO_EMAIL);
  await p.definirContexteActif(validee.rattachement_id);
  const immeublesMarcApresValidation = await p.listerImmeubles();
  check("après validation mais sans assignation : toujours aucun accès",
    !immeublesMarcApresValidation.some((i) => i.id === immeubleNeuf.id));

  // Le propriétaire assigne SON immeuble -> accès limité à celui-ci.
  await connecter("proprio.test@exemple.com");
  await p.assignerImmeublesRattachement(validee.rattachement_id, [immeubleNeuf.id]);
  await connecter(GESTIONNAIRE_DEMO_EMAIL);
  await p.definirContexteActif(validee.rattachement_id);
  const immeublesMarcApresAssignation = await p.listerImmeubles();
  check("après assignation : Marc voit exactement l'immeuble assigné",
    immeublesMarcApresAssignation.length === 1 &&
    immeublesMarcApresAssignation[0].id === immeubleNeuf.id,
    immeublesMarcApresAssignation.map((i) => i.nom).join(","));

  // Verrou contrat : répondre à une demande adressée à un AUTRE
  // gestionnaire est impossible (destinataire strict).
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const demandesAdmin = await p.listerDemandesRattachement();
  check("console : demandes listées avec Display ID du gestionnaire",
    demandesAdmin.some((d) => d.id === demande.id && d.gestionnaire_display_id === "CIM-000002"));

  console.log(`\n=== v1.3 Inscription/Dossiers : ${ok} OK, ${ko} KO ===`);
  if (ko > 0) process.exit(1);
})().catch((e) => {
  console.error("ERREUR FATALE", e);
  process.exit(1);
});

// Test « Correctifs captures fondateur » (2026-11-08, passe en
// 8 points issue des captures et précisions du fondateur — voir
// docs/correctifs-captures-2026-11-08.md) :
//  1. Vitrine (espace client) : la carte appartement passe en
//     COLONNE sur mobile (titre pleine largeur, bouton en dessous),
//     rangée seulement à partir de sm — plus de titre écrasé ni de
//     mot coupé au milieu.
//  2. En-tête public : navigation 4 liens sur UNE ligne durcie
//     (min-w-0, 11 px sous 400 px) et boutons Connexion / Essai
//     flexibles (min-w-0, libellé insécable) — aucun débordement.
//  3. Audit : inventaire COMPLET des actions journalisées
//     (ACTIONS_AUDIT, lib/format.ts) avec libellé FR + EN pour
//     chacune, repli générique (jamais la clé brute), cible lisible
//     (JAMAIS un UUID : la dépense s'affiche par son libellé et son
//     montant formaté), détails de dépense au montant formaté.
//  4. Finances plateforme : les lignes « Destination » se replient
//     (break-words + min-w-0, bloc de droite non shrink-0), montants
//     sur une ligne — aucun défilement horizontal de page.
//  5. « Ma paie » : la référence purement numérique (« 400000 ») est
//     groupée par milliers comme partout dans l'app ; les autres
//     références passent inchangées.
//  6. Contrats PDF : bandeau aux DEUX logos (CizaImmo compact +
//     Ciza Group) sur les trois générateurs (gestionnaire,
//     propriétaire, employé) — génération réelle avec les images
//     des fichiers public/, présence des deux images vérifiée dans
//     le PDF (largeurs natives 820 et 2000), repli texte sans logo
//     toujours valide.
//  7. Dépôt du contrat employé signé — CAUSES RACINES du blocage
//     Barros : (a) BOUTON MORT sur iPhone : le sélecteur s'ouvrait
//     par un clic scripté (ref.click()) sur un input display:none,
//     qu'iOS Safari ignore — ni sélecteur, ni erreur ; corrigé par
//     l'activation NATIVE <label htmlFor> (+ useId, input sr-only) ;
//     (b) le format HEIC (photo native iPhone) était refusé à TOUS
//     les étages (accept= du sélecteur, fichierValide, fournisseurs
//     réel + démo, liste MIME) alors que le bucket privé n'impose
//     aucune restriction de type. Flux runtime en démo : dépôt
//     .heic accepté dès « a_signer », garde de statut intacte
//     (sans_objet et validé refusés proprement), politiques Storage
//     du pack contrôlées statiquement.
//  8. Périmètre PAIES de la vue Finances (miroir du périmètre
//     dépenses) : un Admin ne voit QUE sa paie — lignes, historique
//     et totaux du mois ; le talon d'un autre employé lui est
//     refusé ; le Super Admin voit tout. Le filtre existait déjà
//     dans les deux fournisseurs : verrouillé ici en démo, et côté
//     réel dans scripts/test-finances-reel.cjs.
// Fournisseur démo pour le runtime ; localStorage simulé en mémoire.
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
const TYPES = require(`${BUILD}/data/types.js`);
const FMT = require(`${BUILD}/format.js`);
const CT = require(`${BUILD}/contrat.js`);
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
function dataUrlPublic(rel) {
  return "data:image/png;base64," + fs.readFileSync(path.join(RACINE, rel)).toString("base64");
}
function imagesPdf(texte) {
  return (texte.match(/\/Subtype \/Image/g) ?? []).length;
}

const PARAMS_A = {
  voie: "travail", type: "CDI", duree: null, montant: 500000,
  devise: "BIF",
  modalites_paiement: "Virement bancaire, au plus tard le 5 du mois suivant.",
  lieu: "Bujumbura, Burundi (bureau de l'Employeur), avec déplacements possibles dans le pays",
  horaires: "Du lundi au vendredi, de 8 h à 17 h",
  date_debut: "2026-11-09", periode_essai: "trois (3) mois",
};

(async () => {
  console.log("== Point 1 : carte Vitrine en colonne sur mobile ==");
  const vitrine = lire("app/[locale]/vitrine/page.tsx");
  check("conteneur de carte : flex-col sur mobile, rangée seulement à partir de sm",
    vitrine.includes("flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between"));
  const blocCarte = vitrine.slice(
    vitrine.indexOf("eligibles.map"),
    vitrine.indexOf("eligibles.map") + 3200
  );
  check("titre en break-words (jamais break-all) dans la carte",
    blocCarte.includes("break-words text-lg font-bold") && !blocCarte.includes("break-all"));

  console.log("== Point 2 : en-tête public durci (aucun débordement) ==");
  const header = lire("components/PublicHeader.tsx");
  check("navigation : flex-nowrap + min-w-0 + taille réduite sous 400 px, 4 liens présents",
    header.includes("flex-nowrap") && header.includes("min-w-0") &&
    header.includes("text-[11px]") &&
    ['href="/tarifs"', 'href="/a-louer"', 'href="/a-propos"', 'href="/contact"']
      .every((h) => header.includes(h)));
  check("boutons Connexion / Essai : flexibles min-w-0, libellé insécable, padding réduit mobile",
    (header.match(/min-w-0 flex-1/g) ?? []).length >= 2 &&
    (header.match(/whitespace-nowrap rounded-full/g) ?? []).length >= 2 &&
    header.includes("px-3 py-2.5"));

  console.log("== Point 3 : audit — inventaire, libellés, cible lisible ==");
  const fr = JSON.parse(lire("messages/fr.json"));
  const en = JSON.parse(lire("messages/en.json"));
  check("ACTIONS_AUDIT : 44 actions, sans doublon",
    FMT.ACTIONS_AUDIT.length === 44 &&
    new Set(FMT.ACTIONS_AUDIT).size === 44,
    String(FMT.ACTIONS_AUDIT.length));
  const clesAuditFr = Object.keys(fr.console.audit);
  check("chaque action de l'inventaire a un libellé FR + EN ; les clés audit = inventaire + repli générique",
    FMT.ACTIONS_AUDIT.every(
      (a) => typeof fr.console.audit[a] === "string" && fr.console.audit[a].length > 0 &&
             typeof en.console.audit[a] === "string" && en.console.audit[a].length > 0
    ) &&
    clesAuditFr.length === FMT.ACTIONS_AUDIT.length + 1 &&
    typeof fr.console.audit.actionInconnue === "string" &&
    typeof en.console.audit.actionInconnue === "string");
  const anciennementMuets = [
    "acces_admin_modifie", "assignation", "charte_acceptee",
    "consultation_messages", "contrat_employe_prepare",
    "contrat_employe_refuse", "contrat_employe_signe_depose",
    "contrat_employe_valide", "role_admin_retire", "suppression_annulee",
    "suppression_demandee", "suppression_executee", "vitrine_approuvee",
    "vitrine_publication_demandee", "vitrine_publication_retiree",
    "vitrine_refusee",
  ];
  check("les 16 actions autrefois affichées en clé brute sont dans l'inventaire",
    anciennementMuets.every((a) => FMT.actionAuditConnue(a)));
  // Balayage des actions réellement journalisées (fournisseurs + SQL) :
  // tout ce qui est journalisé doit être dans l'inventaire.
  const journalisees = new Set();
  for (const f of ["lib/data/real.ts", "lib/data/demo.ts"]) {
    const src = lire(f);
    for (const m of src.matchAll(/journaliserAudit\(([\s\S]{0,200}?)\)/g)) {
      const lits = [...m[1].matchAll(/"([a-z_]+)"/g)].map((x) => x[1]);
      if (lits.length > 0) journalisees.add(lits[0]);
    }
  }
  for (const f of fs.readdirSync(path.join(RACINE, "supabase"))) {
    if (!f.endsWith(".sql")) continue;
    const src = lire(`supabase/${f}`);
    for (const m of src.matchAll(/insert into public\.journal_audit[\s\S]{0,700}?values\s*\(([\s\S]{0,500}?)\)\s*;/g)) {
      const lits = [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
      if (lits.length > 0) journalisees.add(lits[0]);
    }
  }
  check("balayage code + SQL : toute action journalisée est dans l'inventaire",
    journalisees.size >= 40 &&
    [...journalisees].every((a) => FMT.actionAuditConnue(a)),
    [...journalisees].filter((a) => !FMT.actionAuditConnue(a)).join(","));
  check("actionAuditConnue : connue -> true, inconnue -> false (repli générique)",
    FMT.actionAuditConnue("paie_emise") === true &&
    FMT.actionAuditConnue("action_qui_nexiste_pas") === false);
  // Le groupement FR d'Intl utilise une espace fine insécable
  // (U+202F) — la même que formatMoney partout dans l'app : on
  // compare donc à la sortie d'Intl, pas à une espace ordinaire.
  const NB400 = new Intl.NumberFormat("fr-FR").format(400000);
  const MONEY400 = FMT.formatMoney(400000, "BIF", "fr");
  const uuidDep = "11111111-2222-3333-4444-555555555555";
  const cibleDep = FMT.formatCibleAudit(
    { cible_email: null, cible_id: uuidDep,
      details: { libelle: "Paie", categorie: "autre", montant: 400000, devise: "BIF" } },
    "fr"
  );
  check("cible dépense : libellé + montant formaté, JAMAIS l'UUID",
    cibleDep === `Paie — ${MONEY400}` && !cibleDep.includes(uuidDep), cibleDep);
  check("cible : e-mail prioritaire ; rien de lisible -> tiret (jamais l'UUID)",
    FMT.formatCibleAudit({ cible_email: "a@b.c", cible_id: uuidDep, details: null }, "fr") === "a@b.c" &&
    FMT.formatCibleAudit({ cible_email: null, cible_id: uuidDep, details: null }, "fr") === "—");
  const detailsDep = FMT.formatDetailsAudit(
    { libelle: "Paie", categorie: "autre", montant: 400000, devise: "BIF" }, "fr"
  );
  check("détails dépense : libellé + montant formaté (plus de « 400000 » brut)",
    detailsDep.includes(`Paie — ${MONEY400}`) && !detailsDep.includes("400000"),
    detailsDep);
  const journal = lire("app/[locale]/console/journal/page.tsx");
  const vueEnsemble = lire("app/[locale]/console/page.tsx");
  const dossierCompte = lire("app/[locale]/console/comptes/[id]/page.tsx");
  check("journal : libellé via l'inventaire + repli, cible via formatCibleAudit, plus de cible_id affiché",
    journal.includes("actionAuditConnue") && journal.includes("formatCibleAudit") &&
    journal.includes("audit.actionInconnue") && !journal.includes("e.cible_id"));
  check("vue d'ensemble + dossier compte : même formateur partagé (libellé + cible)",
    vueEnsemble.includes("actionAuditConnue") && vueEnsemble.includes("formatCibleAudit") &&
    dossierCompte.includes("actionAuditConnue"));

  console.log("== Point 4 : finances — destinations qui se replient ==");
  const finances = lire("app/[locale]/console/finances-plateforme/page.tsx");
  check("carte membre : bloc de droite en min-w-0 (plus de shrink-0 qui impose sa largeur)",
    finances.includes('className="min-w-0 text-right"'));
  check("les deux lignes « Destination » (carte membre + historique) sont en break-words",
    (finances.match(/<p className="[^"]*break-words[^"]*">\s*\{tf\("payDestinationLabel"\)/g) ?? []).length >= 2);
  check("montants sur une ligne (whitespace-nowrap : carte membre, historique, dépenses)",
    finances.includes("mt-1.5 whitespace-nowrap") &&
    finances.includes("whitespace-nowrap font-bold text-navy"));

  console.log("== Point 5 : « Ma paie » — référence numérique formatée ==");
  check("formatReferencePaie : « 400000 » groupé par milliers (FR, espace fine Intl / EN, virgule)",
    FMT.formatReferencePaie("400000", "fr") === NB400 &&
    FMT.formatReferencePaie("400000", "en") === "400,000");
  check("formatReferencePaie : référence alphanumérique ou à zéro initial inchangée, vide -> vide",
    FMT.formatReferencePaie("VIR-2026-11", "fr") === "VIR-2026-11" &&
    FMT.formatReferencePaie("001234", "fr") === "001234" &&
    FMT.formatReferencePaie(null, "fr") === "" &&
    FMT.formatReferencePaie("", "fr") === "");
  const monDossier = lire("app/[locale]/console/mon-dossier/page.tsx");
  check("« Ma paie » + finances : la référence passe par formatReferencePaie",
    monDossier.includes("formatReferencePaie(p.reference, locale)") &&
    (finances.match(/formatReferencePaie\(/g) ?? []).length >= 2);

  console.log("== Point 6 : contrats PDF aux deux logos (génération réelle) ==");
  const images = {
    logoCizaImmo: dataUrlPublic("public/cizaimmo-logo-compact.png"),
    logoCizaGroup: dataUrlPublic("public/cizagroup-logo-transparent.png"),
  };
  const sansLogos = { logoCizaImmo: null, logoCizaGroup: null };
  const donneesClient = {
    nom: "Kaneza Rehema", displayId: "CIM-000002", email: "nacm2009@yahoo.ca",
    telephone: "+257 79 94 50 08", pays: "Burundi", langue: "fr", date: "2026-11-08",
  };
  const gest = await CT.genererContratGestionnairePdf(donneesClient, images);
  const gestTexte = Buffer.from(gest.contenuBase64, "base64").toString("latin1");
  check("contrat gestionnaire : PDF valide + les DEUX logos embarqués (largeurs natives 820 et 2000)",
    gestTexte.startsWith("%PDF") && gestTexte.includes("/Width 820") &&
    gestTexte.includes("/Width 2000") && imagesPdf(gestTexte) >= 3,
    `images=${imagesPdf(gestTexte)}`);
  const prop = await CT.genererContratProprietairePdf(donneesClient, images);
  const propTexte = Buffer.from(prop.contenuBase64, "base64").toString("latin1");
  check("contrat propriétaire : PDF valide + les DEUX logos embarqués",
    propTexte.startsWith("%PDF") && propTexte.includes("/Width 820") &&
    propTexte.includes("/Width 2000") && imagesPdf(propTexte) >= 3,
    `images=${imagesPdf(propTexte)}`);
  const emp = await CE.genererContratEmployePdf(
    { nom: "Barros Innocent", displayId: "CIM-000003", email: "cizaimmo@yahoo.com",
      telephone: "+257 79 00 00 00", adresse: "Bujumbura, Burundi",
      pieceIdentite: "passeport.pdf", langue: "fr", date: "2026-11-08",
      parametres: PARAMS_A },
    images
  );
  const empTexte = Buffer.from(emp.contenuBase64, "base64").toString("latin1");
  check("contrat employé : PDF valide + les DEUX logos embarqués",
    empTexte.startsWith("%PDF") && empTexte.includes("/Width 820") &&
    empTexte.includes("/Width 2000") && imagesPdf(empTexte) >= 3,
    `images=${imagesPdf(empTexte)}`);
  const gestRepli = await CT.genererContratGestionnairePdf(donneesClient, sansLogos);
  const repliTexte = Buffer.from(gestRepli.contenuBase64, "base64").toString("latin1");
  check("repli sans logos : PDF toujours valide, aucun des deux logos (en-tête texte historique)",
    repliTexte.startsWith("%PDF") && !repliTexte.includes("/Width 820") &&
    !repliTexte.includes("/Width 2000"));
  check("générateurs branchés sur le chargeur partagé + paramètre images optionnel",
    lire("lib/contrat.ts").includes("chargerLogosPdf") &&
    lire("lib/contrat-employe.ts").includes("chargerLogosPdf") &&
    lire("lib/logos-pdf.ts").includes("/cizaimmo-logo-compact.png") &&
    lire("lib/logos-pdf.ts").includes("/cizagroup-logo-transparent.png"));

  console.log("== Point 7 : dépôt du contrat signé — le HEIC iPhone passe ==");
  check("formats partagés : HEIC/HEIF acceptés (MIME + extensions)",
    TYPES.FORMATS_DOCUMENT_ACCEPTES.includes("image/heic") &&
    TYPES.FORMATS_DOCUMENT_ACCEPTES.includes("image/heif") &&
    TYPES.EXTENSIONS_DOCUMENT_ACCEPTEES.includes("heic") &&
    TYPES.EXTENSIONS_DOCUMENT_ACCEPTEES.includes("heif"));
  const storageSql = lire("supabase/storage.sql");
  const packSql = lire("supabase/module-pack-employe.sql");
  check("bucket privé : politique INSERT = préfixe <uid>/ seul, AUCUNE restriction de type (ni bucket ni pack)",
    storageSql.includes("documents_prives_insert_owner") &&
    storageSql.includes("auth.uid()") &&
    !storageSql.includes("allowed_mime_types") &&
    !packSql.includes("allowed_mime_types") &&
    !packSql.includes("storage.objects"));
  const upload = lire("components/DocumentUpload.tsx");
  check("sélecteur : accept= inclut .heic/.heif et fichierValide suit la liste partagée",
    upload.includes(".heic") && upload.includes(".heif") &&
    upload.includes("EXTENSIONS_DOCUMENT_ACCEPTEES"));
  check("sélecteur : ouverture NATIVE par label (htmlFor + useId) — plus de clic scripté sur un input display:none (bouton mort sur iPhone)",
    upload.includes("htmlFor") && upload.includes("useId") &&
    upload.includes('className="sr-only"') &&
    !upload.includes('className="hidden"') &&
    !upload.includes(".current?.click()"));
  check("messages d'échec humains : statut du contrat traduit, formats annoncés avec HEIC (FR + EN)",
    monDossier.includes("ERR_STATUT_INVALIDE") &&
    monDossier.includes("errorContractStatus") &&
    typeof fr.dossierEmploye.errorContractStatus === "string" &&
    typeof en.dossierEmploye.errorContractStatus === "string" &&
    fr.documents.errorFormat.includes("HEIC") && en.documents.errorFormat.includes("HEIC"));
  check("contrat déjà validé : la section le dit proprement (note dédiée, FR + EN)",
    monDossier.includes("contratValidatedNote") &&
    typeof fr.packEmploye.contratValidatedNote === "string" &&
    typeof en.packEmploye.contratValidatedNote === "string");

  const p = new DemoProvider();
  async function connecter(email, mdp = "motdepasse") {
    try { await p.signOut(); } catch { /* pas de session */ }
    await p.signIn(email, mdp);
  }
  await p.signUp({
    nom: "Employé Heic", email: "employe.heic@exemple.com", motDePasse: "motdepasse123",
    pays: "Burundi", devisePrincipale: "BIF", langue: "fr", paysIp: "BI",
    telephone: "+257 79 55 55 55", intention: "proprietaire",
  });
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  await p.promouvoirAdmin("employe.heic@exemple.com");
  const membres = await p.listerEquipeAdmins();
  const membre = membres.find((m) => m.email === "employe.heic@exemple.com");
  const CONTENU_HEIC = "data:image/heic;base64," +
    Buffer.from("photo-heic-contrat-signe").toString("base64");
  const depotHeic = {
    type: "contrat", entite_type: "compte", entite_id: membre.id,
    nom_fichier: "IMG_7243.heic", taille_octets: 2400,
    mime_type: "image/heic", contenu: CONTENU_HEIC,
  };
  await connecter("employe.heic@exemple.com", "motdepasse123");
  const errSansObjet = await attendErreur(p.televerserContratEmployeSigne(depotHeic));
  check("avant préparation (sans_objet) : dépôt refusé par la garde de statut",
    errSansObjet.code === "ERR_STATUT_INVALIDE", errSansObjet.code);
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  // Montant distinct (450 000) : la paie du point 8 pour ce membre
  // sera calculée depuis ces paramètres stockés (point 8, Admin B).
  await p.preparerContratEmploye(membre.id, { ...PARAMS_A, montant: 450000 });
  await connecter("employe.heic@exemple.com", "motdepasse123");
  const errHeic = await attendErreur(p.televerserContratEmployeSigne(depotHeic));
  check("dépôt d'une PHOTO iPhone (.heic, image/heic) dès « a_signer » : ACCEPTÉ (cause racine corrigée)",
    errHeic.levee === false, errHeic.code ?? "");
  const packHeic = await p.getMonPackEmploye();
  check("après dépôt HEIC : statut « signe_depose » + document au pack",
    packHeic.contrat_statut === "signe_depose" &&
    packHeic.contrat_document?.nom_fichier === "IMG_7243.heic",
    packHeic.contrat_statut);
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  await p.validerContratEmploye(membre.id);
  await connecter("employe.heic@exemple.com", "motdepasse123");
  const errApresValidation = await attendErreur(p.televerserContratEmployeSigne({
    ...depotHeic, nom_fichier: "IMG_7244.heic",
  }));
  check("contrat VALIDÉ : tout nouveau dépôt est refusé par la garde (message traduit côté page)",
    errApresValidation.code === "ERR_STATUT_INVALIDE", errApresValidation.code);

  console.log("== Point 8 : périmètre PAIES de la vue Finances (démo) ==");
  // Trois membres payés le même mois (Admin A semé, Admin B promu,
  // Super Admin lui-même) : chaque Admin ne doit voir QUE sa paie —
  // lignes, historique ET totaux ; le Super Admin voit tout ; le
  // talon d'un autre reste refusé. Miroir réel :
  // scripts/test-finances-reel.cjs (fournisseur réel contraint).
  const MOIS8 = "2026-11";
  const PETIT_PDF8 = "data:application/pdf;base64," + Buffer.from("%PDF-1.4 piece").toString("base64");
  const PETITE_PHOTO8 = "data:image/jpeg;base64," + Buffer.from("photo-employe").toString("base64");
  async function completerEtPayer(email, mdp, membreId, montant, contratDejaValide = false) {
    if (!contratDejaValide) {
      await connecter(SUPER_ADMIN_DEMO_EMAIL);
      await p.preparerContratEmploye(membreId, { ...PARAMS_A, montant });
    }
    await connecter(email, mdp);
    const dos = await p.getMonDossierEmploye();
    await p.mettreAJourDossierEmploye({
      telephone: "+257 79 11 22 33",
      adresse: "6ème Avenue N° 47, Buhomba",
      adresse_ville: "Bujumbura",
      adresse_code_postal: null,
      adresse_pays: "Burundi",
    });
    await p.mettreAJourDossierEmploye({
      paiement_moyen: "mobile_money",
      paiement_titulaire: "Titulaire Test",
      paiement_operateur: "EcoCash",
      paiement_numero_mobile: "+257 79 11 22 33",
    });
    await p.televerserPhotoDossierEmploye({
      type: "autre", entite_type: "compte", entite_id: dos.compte_id,
      nom_fichier: "photo.jpg", taille_octets: 1200,
      mime_type: "image/jpeg", contenu: PETITE_PHOTO8,
    });
    await p.televerserPieceDossierEmploye({
      type: "piece_identite", entite_type: "compte", entite_id: dos.compte_id,
      nom_fichier: "piece.pdf", taille_octets: 900,
      mime_type: "application/pdf", contenu: PETIT_PDF8,
    });
    if (!contratDejaValide) {
      await p.televerserContratEmployeSigne({
        type: "contrat", entite_type: "compte", entite_id: membreId,
        nom_fichier: "contrat-signe.pdf", taille_octets: 900,
        mime_type: "application/pdf", contenu: PETIT_PDF8,
      });
      await connecter(SUPER_ADMIN_DEMO_EMAIL);
      await p.validerContratEmploye(membreId);
    } else {
      await connecter(SUPER_ADMIN_DEMO_EMAIL);
    }
    return p.emettrePaieEmploye(membreId, MOIS8);
  }
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const membres8 = await p.listerEquipeAdmins();
  const membreA = membres8.find((m) => m.email === ADMIN_DEMO_EMAIL);
  const membreSuper = membres8.find((m) => m.email === SUPER_ADMIN_DEMO_EMAIL);
  // Admin B = l'employé du point 7 : la démo ne modélise qu'UN profil
  // client promouvable (tout signUp promu retombe sur le même id) —
  // un second signUp écraserait son pack. Son contrat est déjà
  // « valide » (point 7) : on complète son dossier, paie directe.
  const membreB = membre;
  const packB8 = await p.getPackEmploye(membreB.id);
  check("préparation point 8 : trois membres (A semé, B = employé du point 7, Super) ; contrat de B déjà validé",
    !!membreA && !!membreB && !!membreSuper && packB8.contrat_statut === "valide",
    packB8.contrat_statut);
  const paieA = await completerEtPayer(ADMIN_DEMO_EMAIL, "motdepasse", membreA.id, 500000);
  const paieB = await completerEtPayer("employe.heic@exemple.com", "motdepasse123", membreB.id, 450000, true);
  const paieSuper = await completerEtPayer(SUPER_ADMIN_DEMO_EMAIL, "motdepasse", membreSuper.id, 900000);
  check("préparation point 8 : trois paies émises pour le même mois",
    paieA.montant === 500000 && paieB.montant === 450000 && paieSuper.montant === 900000);

  await connecter("employe.heic@exemple.com", "motdepasse123");
  const vueB = await p.getVueFinancesPlateforme(MOIS8);
  check("Admin B : SA seule ligne de paie (ni A, ni Super)",
    vueB.lignes_paie.length === 1 && vueB.lignes_paie[0].compte_id === membreB.id,
    JSON.stringify(vueB.lignes_paie.map((l) => l.compte_id)));
  check("Admin B : historique = SES paies seulement",
    vueB.historique_paies.length === 1 &&
    vueB.historique_paies.every((x) => x.profil_id === membreB.id),
    JSON.stringify(vueB.historique_paies.map((x) => x.profil_id)));
  const totB = vueB.totaux.find((t) => t.devise === "BIF");
  check("Admin B : totaux du mois = SES 450 000 BIF seulement",
    !!totB && totB.paie_emise === 450000, JSON.stringify(vueB.totaux));
  await connecter(ADMIN_DEMO_EMAIL);
  const vueA = await p.getVueFinancesPlateforme(MOIS8);
  check("Admin A : SA seule ligne + SON historique + SES totaux (500 000 BIF)",
    vueA.lignes_paie.length === 1 && vueA.lignes_paie[0].compte_id === membreA.id &&
    vueA.historique_paies.length === 1 &&
    vueA.historique_paies.every((x) => x.profil_id === membreA.id) &&
    vueA.totaux.find((t) => t.devise === "BIF")?.paie_emise === 500000,
    JSON.stringify(vueA.historique_paies.map((x) => x.profil_id)));
  await connecter("employe.heic@exemple.com", "motdepasse123");
  const errTalonA = await attendErreur(p.genererTalonPaie(paieA.id));
  const errTalonSuper = await attendErreur(p.genererTalonPaie(paieSuper.id));
  const talonB = await p.genererTalonPaie(paieB.id);
  check("Admin B : talon d'un AUTRE (A ou Super) refusé, le sien OK",
    errTalonA.code === "ERR_TALON_INTROUVABLE" &&
    errTalonSuper.code === "ERR_TALON_INTROUVABLE" &&
    typeof talonB.contenuBase64 === "string" && talonB.contenuBase64.length > 100,
    `${errTalonA.code} / ${errTalonSuper.code}`);
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const vueSuper8 = await p.getVueFinancesPlateforme(MOIS8);
  check("Super Admin : lignes de A, B et lui-même ; historique COMPLET (3 paies) ; totaux = 1 850 000 BIF",
    [membreA.id, membreB.id, membreSuper.id].every((id) =>
      vueSuper8.lignes_paie.some((l) => l.compte_id === id)) &&
    vueSuper8.historique_paies.length === 3 &&
    [paieA.id, paieB.id, paieSuper.id].every((id) =>
      vueSuper8.historique_paies.some((x) => x.id === id)) &&
    vueSuper8.totaux.find((t) => t.devise === "BIF")?.paie_emise === 1850000,
    JSON.stringify(vueSuper8.totaux));

  console.log("== Point 9 : journal — lu/archivé + pagination (démo) ==");
  const sqlLecture = lire("supabase/module-journal-lecture.sql");
  check("SQL latéral : table journal_lecture + RLS Super Admin ; journal_audit JAMAIS écrit par le module",
    sqlLecture.includes("create table if not exists public.journal_lecture") &&
    sqlLecture.includes("est_super_admin()") &&
    sqlLecture.includes("references public.journal_audit(id)") &&
    !/update\s+public\.journal_audit|delete\s+from\s+public\.journal_audit|insert\s+into\s+public\.journal_audit/i.test(sqlLecture));
  check("fournisseurs : les 4 actions d'état existent (interface + réel + démo)",
    ["marquerEntreesAuditLues", "archiverEntreeAudit", "desarchiverEntreeAudit", "archiverEntreesAuditLues"].every(
      (m) => lire("lib/data/real.ts").includes(m) && lire("lib/data/demo.ts").includes(m) &&
        lire("lib/data/provider.ts").includes(m)));
  const pageJournal = lire("app/[locale]/console/journal/page.tsx");
  check("page journal : pastille Nouveau, vues principale/archivées, actions de masse, pagination composée",
    pageJournal.includes("journalNewBadge") && pageJournal.includes("journalTabArchived") &&
    pageJournal.includes("journalMarkAllRead") && pageJournal.includes("journalArchiveRead") &&
    pageJournal.includes("paginerListe") && pageJournal.includes("journalPageLabel") &&
    typeof fr.console.journalTabArchived === "string" && typeof en.console.journalTabArchived === "string");

  const { paginerListe, TAILLE_PAGE_JOURNAL } = require(`${BUILD}/format.js`);
  const liste45 = Array.from({ length: 45 }, (_, i) => i + 1);
  const pg1 = paginerListe(liste45, 1);
  const pg3 = paginerListe(liste45, 3);
  check("paginerListe : 45 éléments → 3 pages de 20/20/5",
    TAILLE_PAGE_JOURNAL === 20 && pg1.elements.length === 20 &&
    pg1.elements[0] === 1 && pg3.elements.length === 5 && pg3.totalPages === 3 &&
    pg3.elements[4] === 45);
  check("paginerListe : bornes — page 0 → 1, page 99 → dernière, liste vide → 1 page vide",
    paginerListe(liste45, 0).page === 1 && paginerListe(liste45, 99).page === 3 &&
    paginerListe([], 5).totalPages === 1 && paginerListe([], 5).elements.length === 0);
  const pairsFiltres = liste45.filter((n) => n % 2 === 0);
  check("paginerListe : composition filtre → pagination (22 pairs → page 2 = 2 éléments)",
    paginerListe(pairsFiltres, 2).totalPages === 2 &&
    paginerListe(pairsFiltres, 2).elements.length === 2);

  // Génération d'entrées : cycles retirer/promouvoir sur le membre B
  // (journalise admin_retire / admin_promu à chaque passage).
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  for (let i = 0; i < 13; i++) {
    await p.retirerAdmin(membreB.id);
    await p.promouvoirAdmin(membreB.email);
  }
  const entrees9 = await p.listerJournalAudit();
  check("journal : ≥ 25 entrées, état initial tout non lu / non archivé",
    entrees9.length >= 25 && entrees9.every((e) => e.lu === false && e.archive === false),
    `${entrees9.length} entrées`);
  const cible1 = entrees9[0];
  const cible2 = entrees9[1];
  await p.marquerEntreesAuditLues([cible1.id]);
  let apres9 = await p.listerJournalAudit();
  check("marquer lu (une entrée) : elle seule est lue — persistance fournisseur",
    apres9.find((e) => e.id === cible1.id)?.lu === true &&
    apres9.filter((e) => e.lu).length === 1);
  await p.archiverEntreeAudit(cible1.id);
  apres9 = await p.listerJournalAudit();
  check("archiver : état posé, aucune entrée perdue (le journal est intact)",
    apres9.find((e) => e.id === cible1.id)?.archive === true &&
    apres9.length === entrees9.length);
  await p.marquerEntreesAuditLues([cible2.id]);
  const nbMasse = await p.archiverEntreesAuditLues();
  apres9 = await p.listerJournalAudit();
  check("archivage en masse des lues : seule la lue non archivée bascule (1), les non-lues intactes",
    nbMasse === 1 && apres9.filter((e) => e.archive).length === 2 &&
    apres9.filter((e) => e.lu && !e.archive).length === 0,
    `${nbMasse}`);
  await p.desarchiverEntreeAudit(cible1.id);
  apres9 = await p.listerJournalAudit();
  check("désarchivage : l'entrée revient en liste principale, toujours lue",
    apres9.find((e) => e.id === cible1.id)?.archive === false &&
    apres9.find((e) => e.id === cible1.id)?.lu === true);
  await p.marquerEntreesAuditLues();
  apres9 = await p.listerJournalAudit();
  check("tout marquer comme lu : plus aucune entrée non lue",
    apres9.every((e) => e.lu === true));
  const principales9 = apres9.filter((e) => !e.archive);
  check("vue principale + pagination : page 1 = 20 entrées, page 2 = le reste",
    principales9.length > 20 &&
    paginerListe(principales9, 1).elements.length === 20 &&
    paginerListe(principales9, 2).elements.length === principales9.length - 20,
    `${principales9.length} en principale`);
  await connecter(ADMIN_DEMO_EMAIL);
  const errLuAdmin = await attendErreur(p.marquerEntreesAuditLues());
  const errArchAdmin = await attendErreur(p.archiverEntreeAudit(cible1.id));
  const errListeAdmin9 = await attendErreur(p.listerJournalAudit());
  check("Admin : marquer lu / archiver / lister restent refusés (Super Admin seul)",
    errLuAdmin.code === "ERR_SUPER_ADMIN_REQUIS" &&
    errArchAdmin.code === "ERR_SUPER_ADMIN_REQUIS" &&
    errListeAdmin9.code === "ERR_SUPER_ADMIN_REQUIS",
    `${errLuAdmin.code}/${errArchAdmin.code}/${errListeAdmin9.code}`);

  console.log(`\nRésultat : ${ok} OK, ${ko} KO`);
  process.exit(ko > 0 ? 1 : 0);
})().catch((e) => {
  console.error("ERREUR du test :", e);
  process.exit(1);
});

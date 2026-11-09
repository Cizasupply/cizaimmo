// Test « Réorganisation dossiers + finances Admin » (2026-11-08,
// modèle CONFIRMÉ par le fondateur : « sa paie et les dépenses de
// la plateforme, deux choses différentes » ; un dossier COMPLET ne
// doit plus afficher ses formulaires ouverts) — voir
// docs/reorganisation-dossiers-finances-admin-2026-11-08.md.
//  Lot A — Finances, vue Admin : la boîte de totaux DISPARAÎT (elle
//    ne reste que pour le Super Admin), les deux domaines sont deux
//    blocs séparés : « Ma paie » puis « Mes demandes de dépenses ».
//    Les DONNÉES ne changent pas (fournisseurs intacts — runtime
//    démo : le périmètre Admin est toujours le sien, et le
//    fournisseur continue de renvoyer ses totaux filtrés, que la
//    page ne rend simplement plus).
//  Lot B — Dossiers : section renseignée = LECTURE SEULE (carte
//    d'information), formulaire/téléversement derrière un bouton
//    « Modifier » propre à la section, retour en lecture après
//    enregistrement réussi. Surfaces : Mon dossier employé (photo,
//    pièce, adresse, coordonnées de paiement), DossierBloc client
//    (photo, pièce), page console Dossier (validations DÉJÀ
//    prononcées converties en « Décisions enregistrées » : action +
//    nom du document + date + acteur, depuis le journal et les
//    documents déjà chargés — aucun fournisseur touché), contrat
//    employé validé en ligne de résultat (document + date de
//    dépôt).
//  Lot C — ImmeubleForm : le sélecteur de photos passe à
//    l'activation NATIVE par label (htmlFor + useId, input sr-only)
//    — l'ancien clic programmé sur input display:none était mort
//    sur iOS, comme le bouton contrat corrigé à la passe
//    précédente. Règles photos inchangées (JPG/PNG, 10 Mo).
// Les états d'ouverture React ne sont pas exécutables dans ce
// harnais (lib compilée seule) : ils sont verrouillés STATIQUEMENT
// (patron d'état + conditions de rendu), comme les autres passes
// d'interface ; le runtime couvre les fournisseurs, inchangés.
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

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}
function lire(rel) {
  return fs.readFileSync(path.join(RACINE, rel), "utf8");
}

(async () => {
  const finances = lire("app/[locale]/console/finances-plateforme/page.tsx");
  const monDossier = lire("app/[locale]/console/mon-dossier/page.tsx");
  const dossierBloc = lire("components/DossierBloc.tsx");
  const consoleDossier = lire("app/[locale]/console/comptes/[id]/page.tsx");
  const immeubleForm = lire("components/ImmeubleForm.tsx");
  const msgFr = JSON.parse(lire("messages/fr.json"));
  const msgEn = JSON.parse(lire("messages/en.json"));

  console.log("== Lot A : Finances Admin — totaux supprimés, deux blocs séparés ==");
  check("page : la boîte de totaux est rendue pour le Super Admin SEUL (garde estSuper)",
    finances.includes("SUPER ADMIN SEUL (lot A") &&
    finances.includes("{estSuper ? (") &&
    finances.includes('tf("totalsTitle")'));
  check("page : plus AUCUN libellé de totaux première personne (totalsTitleAdmin hors rendu)",
    !finances.includes('tf("totalsTitleAdmin")'));
  check("page : bloc dépenses Admin = « Mes demandes de dépenses » (clé dédiée, patron par rôle)",
    finances.includes('estSuper ? tf("expensesTitle") : tf("expensesTitleRequestsAdmin")'));
  check("page : ordre des blocs Admin — « Ma paie » AVANT « Mes demandes de dépenses »",
    finances.indexOf('tf("payTitleAdmin")') > -1 &&
    finances.indexOf('tf("expensesTitleRequestsAdmin")') > finances.indexOf('tf("payTitleAdmin")'));
  check("i18n FR/EN : nouvelle clé dépenses Admin, valeurs exactes",
    msgFr.financesPlateforme.expensesTitleRequestsAdmin === "Mes demandes de dépenses" &&
    msgEn.financesPlateforme.expensesTitleRequestsAdmin === "My expense requests");
  check("i18n : libellés Super Admin des totaux INCHANGÉS",
    msgFr.financesPlateforme.totalsTitle === "Totaux du mois" &&
    msgEn.financesPlateforme.totalsTitle === "Monthly totals");
  check("fournisseurs INTACTS : la vue finances renvoie toujours les totaux (filtrés par rôle)",
    lire("lib/data/demo.ts").includes("totaux") &&
    lire("lib/data/real.ts").includes("totaux"));

  console.log("== Lot A (runtime démo) : périmètre Admin inchangé ==");
  const p = new DemoProvider();
  async function connecter(email) {
    try { await p.signOut(); } catch { /* pas de session */ }
    await p.signIn(email, "motdepasse");
  }
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const membres = await p.listerEquipeAdmins();
  const membreAdmin = membres.find((m) => m.email === ADMIN_DEMO_EMAIL);
  check("préparation : membre Admin semé retrouvé", !!membreAdmin);
  await connecter(ADMIN_DEMO_EMAIL);
  const vueAdmin = await p.getVueFinancesPlateforme("2026-11");
  check("Admin : rôle lu « admin », lignes de paie = la sienne seulement",
    vueAdmin.acteur_role === "admin" &&
    vueAdmin.lignes_paie.every((l) => l.compte_id === membreAdmin.id),
    JSON.stringify(vueAdmin.lignes_paie.map((l) => l.compte_id)));
  check("Admin : historique et dépenses limités à ses données (fournisseur inchangé)",
    vueAdmin.historique_paies.every((x) => x.profil_id === membreAdmin.id) &&
    vueAdmin.depenses.every((d) => d.saisi_par === membreAdmin.id));
  check("Admin : le fournisseur renvoie encore ses totaux filtrés (la PAGE ne les rend plus)",
    Array.isArray(vueAdmin.totaux));

  console.log("== Lot B1 : Mon dossier employé — cartes d'information + Modifier ==");
  check("page : état d'ouverture par section (sectionOuverte) + modes d'édition dérivés",
    monDossier.includes("sectionOuverte") &&
    monDossier.includes('sectionOuverte === "photo" || !photoRenseignee') &&
    monDossier.includes('sectionOuverte === "piece" || !pieceRenseignee') &&
    monDossier.includes('sectionOuverte === "adresse" || !adresseRenseignee') &&
    monDossier.includes('sectionOuverte === "paiement" || !paiementRenseigne'));
  check("page : un bouton « Modifier » (common.edit) par section renseignée (≥ 4)",
    (monDossier.match(/tc\("edit"\)/g) ?? []).length >= 4,
    `${(monDossier.match(/tc\("edit"\)/g) ?? []).length}`);
  check("page : retour en lecture seule après enregistrement (setSectionOuverte(null) sur les 3 sauvegardes)",
    (monDossier.match(/setSectionOuverte\(null\)/g) ?? []).length >= 3,
    `${(monDossier.match(/setSectionOuverte\(null\)/g) ?? []).length}`);
  check("page : adresse en LECTURE (valeurs ou « Non renseigné »), formulaire seulement en édition",
    monDossier.includes('t("notProvided")') && monDossier.includes("adresseRenseignee"));
  check("page : coordonnées — le résumé enregistré reste la vue par défaut, formulaire en édition seulement",
    monDossier.includes("paymentPresent") && monDossier.includes("editionPaiement") &&
    monDossier.includes('formPaiement.moyen === "virement"') &&
    monDossier.includes('formPaiement.moyen === "mobile_money"'));
  check("page : contrat VALIDÉ en ligne de résultat (document + date de dépôt), note en repli",
    monDossier.includes('tp("contratResultLine"') && monDossier.includes('tp("contratValidatedNote")'));
  check("i18n FR/EN : ligne de résultat du contrat employé (nom + date)",
    msgFr.packEmploye.contratResultLine.includes("{nom}") &&
    msgFr.packEmploye.contratResultLine.includes("{date}") &&
    msgEn.packEmploye.contratResultLine.includes("{nom}") &&
    msgEn.packEmploye.contratResultLine.includes("{date}") &&
    msgFr.dossierEmploye.notProvided === "Non renseigné" &&
    msgEn.dossierEmploye.notProvided === "Not provided");
  const dossierAdmin = await p.getMonDossierEmploye();
  check("runtime démo : le dossier employé expose les champs de la lecture (photo, pièce, téléphone, coordonnées)",
    "photo_profil_path" in dossierAdmin && "piece_identite" in dossierAdmin &&
    "telephone" in dossierAdmin && "coordonnees_paiement" in dossierAdmin);

  console.log("== Lot B2 : DossierBloc client — pièces reçues en lecture seule ==");
  check("bloc : états d'édition par pièce + nom du document de la pièce en lecture",
    dossierBloc.includes("editionPhoto") && dossierBloc.includes("editionPiece") &&
    dossierBloc.includes("pieceDoc") && dossierBloc.includes("pieceDoc.nom_fichier"));
  check("bloc : « Modifier » / « Annuler » (common) présents, téléversements intacts",
    dossierBloc.includes('tc("edit")') && dossierBloc.includes('tc("cancel")') &&
    dossierBloc.includes("televerserPhotoProfil") && dossierBloc.includes("soumettreDocumentCompte"));
  check("bloc : retour en lecture après envoi (setEdition*(false))",
    dossierBloc.includes("setEditionPhoto(false)") && dossierBloc.includes("setEditionPiece(false)"));
  check("parcours client inchangé : toujours aucun champ adresse dans le bloc dossier",
    !dossierBloc.includes("adresse"));

  console.log("== Lot B3 : page console Dossier — décisions en lignes de résultat ==");
  check("page : bloc « Décisions enregistrées » alimenté par le journal du dossier",
    consoleDossier.includes('t("decisionsTitle")') &&
    consoleDossier.includes("derniereDecision") &&
    consoleDossier.includes('"compte_approuve"') &&
    consoleDossier.includes('"contrat_valide"') &&
    consoleDossier.includes('"contrat_proprietaire_valide"'));
  check("page : la ligne de résultat porte document + date + acteur",
    consoleDossier.includes('t("decisionDocument"') && consoleDossier.includes('t("decisionBy"') &&
    consoleDossier.includes("formatDateTime(d.date, locale)"));
  check("page : les blocs d'action restent réservés aux éléments EN ATTENTE",
    consoleDossier.includes("enAttente ? (") &&
    consoleDossier.includes('compte.statut_contrat === "signe_recu"') &&
    consoleDossier.includes('compte.statut_contrat_proprietaire === "signe_depose"'));
  check("i18n FR/EN : clés des décisions (titre, document, acteur)",
    msgFr.console.decisionsTitle === "Décisions enregistrées" &&
    msgEn.console.decisionsTitle === "Decisions recorded" &&
    msgFr.console.decisionDocument.includes("{nom}") &&
    msgEn.console.decisionBy.includes("{actor}"));

  console.log("== Lot C : ImmeubleForm — sélecteur photos à activation native ==");
  check("formulaire : label htmlFor + useId + input sr-only (patron DocumentUpload)",
    immeubleForm.includes("htmlFor={inputPhotosId}") &&
    immeubleForm.includes("useId") &&
    immeubleForm.includes('className="sr-only"'));
  check("formulaire : le patron MORT a disparu (aucun ref, aucun .click(), aucun display:none/hidden)",
    !immeubleForm.includes("inputPhotosRef") &&
    !immeubleForm.includes(".click()") &&
    !immeubleForm.includes('className="hidden"'));
  check("formulaire : règles photos INCHANGÉES (accept JPG/PNG, multiple, validation jpg/jpeg/png + 10 Mo)",
    immeubleForm.includes('accept=".jpg,.jpeg,.png,image/jpeg,image/png"') &&
    immeubleForm.includes("multiple") &&
    immeubleForm.includes('["jpg", "jpeg", "png"]') &&
    immeubleForm.includes("TAILLE_MAX_DOCUMENT_OCTETS"));

  console.log(`\nRésultat : ${ok} OK, ${ko} KO`);
  process.exit(ko > 0 ? 1 : 0);
})().catch((e) => {
  console.error("ERREUR du test :", e);
  process.exit(1);
});

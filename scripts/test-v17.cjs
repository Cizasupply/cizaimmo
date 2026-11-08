// Test — v1.7 « Passeport photo + autorisation de gestion »
// (2026-11-07, décision du fondateur, étape 2 prioritaire).
//
//  Point 1 — PHOTO DE L'IMMEUBLE = PHOTO DU PASSEPORT : upload d'au
//  moins une photo au formulaire (création + modification), première
//  = principale ; affichée sur la page du bien (bandeau + galerie du
//  passeport), en vignette dans les listes d'immeubles et dans la
//  page Dossier de la console (support : voir d'un coup d'œil de
//  quelle maison on parle). Stockage : chemins dans le bucket privé
//  documents-prives, URLs signées (patron photo de profil / preuve).
//  Point 2 — CAS GESTIONNAIRE : le créateur gestionnaire dépose
//  l'AUTORISATION DE GESTION (document « autorisation ») au lieu du
//  titre, déclare nom + e-mail du propriétaire (obligatoires),
//  l'immeuble part en REVUE plateforme (en_attente → RPC
//  decider_validation_immeuble, motifs prédéfinis au refus) ;
//  concordance automatique si le propriétaire déclaré est déjà
//  rattaché et validé (e-mail du rattachement actif). Le cas
//  propriétaire reste inchangé.
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

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}
const lire = (p) => fs.readFileSync(path.join(RACINE, p), "utf-8");
async function attendErreur(promesse) {
  try {
    await promesse;
    return { levee: false, code: null };
  } catch (e) {
    return { levee: true, code: e instanceof Error ? e.message : String(e) };
  }
}

console.log("== 1. SQL (module-v17) : colonnes, contraintes, RPC ==");
const sql = lire("supabase/module-v17.sql");
check("sql : colonnes photos / origine / déclaré / revue ajoutées",
  sql.includes("add column if not exists photos text[]") &&
  sql.includes("origine_creation") &&
  sql.includes("proprietaire_declare_email") &&
  sql.includes("validation_statut"));
check("sql : contrainte gestionnaire — propriétaire déclaré obligatoire",
  sql.includes("immeubles_gestionnaire_declare_check"));
check("sql : type de document « autorisation » admis",
  sql.includes("documents_type_check_v17") && sql.includes("'autorisation'"));
check("sql : journal — cible « immeuble » admise",
  sql.includes("immeuble_gestion_valide"));
check("sql : RPC de décision de revue (plateforme, motif au refus)",
  sql.includes("function public.decider_validation_immeuble") &&
  sql.includes("ERR_VALIDATION_MOTIF_REQUIS") &&
  sql.includes("ERR_VALIDATION_PAS_EN_ATTENTE"));

console.log("== 2. Providers : types, photos, concordance, décision ==");
const types = lire("lib/data/types.ts");
check("types : Immeuble gagne photos / photos_urls / origine / revue",
  types.includes("photos: string[]") &&
  types.includes("photos_urls: string[]") &&
  types.includes("origine_creation: OrigineCreationImmeuble") &&
  types.includes("validation_statut: StatutValidationImmeuble"));
check("types : document « autorisation » + revue du dossier console",
  types.includes('"contrat" | "autorisation"') || types.includes('| "autorisation"') &&
  types.includes("interface RevueImmeubleGestion") &&
  types.includes("immeubles_en_revue: RevueImmeubleGestion[]"));
const provider = lire("lib/data/provider.ts");
check("provider : photos + décision de revue dans l'interface",
  provider.includes("ajouterPhotoImmeuble(") &&
  provider.includes("retirerPhotoImmeuble(") &&
  provider.includes("deciderValidationImmeuble("));
const real = lire("lib/data/real.ts");
check("réel : URLs signées des photos (patron documents privés)",
  real.includes("enrichirPhotosImmeubles") &&
  real.includes("createSignedUrls"));
check("réel : concordance via les rattachements actifs du gestionnaire",
  real.includes("calculerConcordanceProprietaire") &&
  real.includes('eq("contexte", "proprietaire")'));
check("réel : décision via la RPC base",
  real.includes('rpc("decider_validation_immeuble"'));
check("réel : création gestionnaire sans déclaré refusée",
  real.includes("ERR_PROPRIETAIRE_DECLARE_REQUIS"));
const demo = lire("lib/data/demo.ts");
check("démo : mêmes gardes (déclaré requis, décision, resoumission)",
  demo.includes("ERR_PROPRIETAIRE_DECLARE_REQUIS") &&
  demo.includes("ERR_VALIDATION_MOTIF_REQUIS") &&
  demo.includes('maj.validation_statut = "en_attente"'));

console.log("== 3. Interface : formulaire, pages, console ==");
const form = lire("components/ImmeubleForm.tsx");
check("formulaire : section photos (ajout multiple, principale, retrait)",
  form.includes('t17("photosTitle")') &&
  form.includes("multiple") &&
  form.includes('t17("photoMain")') &&
  form.includes("onRetirerPhotoExistante"));
check("formulaire : au moins une photo exigée à la validation",
  form.includes("photosUrls.length + fichiersPhotos.length === 0") && form.includes('t17("photoRequired")'));
check("formulaire : cas gestionnaire (déclaré + autorisation, pas de titre)",
  form.includes("modeGestionnaire") &&
  form.includes('t17("autorisationLabel")') &&
  form.includes("proprietaire_declare_email") &&
  form.includes('t17("ownerNameRequired")'));
check("formulaire : l'ancien champ texte « lien photo » a disparu",
  !form.includes('name="photo"'));
const nouveau = lire("app/[locale]/immeubles/nouveau/page.tsx");
check("création : rôle lu (getProfil) + photos téléversées après création",
  nouveau.includes("profil?.role === \"gestionnaire\"") &&
  nouveau.includes("ajouterPhotoImmeuble(im.id"));
check("création : gestionnaire → document « autorisation », sinon justificatif",
  nouveau.includes('type: "autorisation" as const') &&
  nouveau.includes('type: "justificatif" as const'));
const modifier = lire("app/[locale]/immeubles/[id]/modifier/page.tsx");
check("modification : photos immédiates + autorisation existante détectée",
  modifier.includes("ajouterPhotoImmeuble(params.id") &&
  modifier.includes("retirerPhotoImmeuble(params.id") &&
  modifier.includes("setAutorisationExistante"));
const detail = lire("app/[locale]/immeubles/[id]/page.tsx");
check("page du bien : photo principale en bandeau + galerie du passeport",
  detail.includes("immeuble.photos_urls[0]") &&
  detail.includes('t17("photoMain")'));
check("page du bien : statut de revue + propriétaire déclaré affichés",
  detail.includes('t17("validationPending")') &&
  detail.includes('t17("declaredOwner")'));
const liste = lire("app/[locale]/immeubles/page.tsx");
check("liste des immeubles : vignette (mobile + tableau)",
  (liste.match(/photos_urls\[0\]/g) || []).length >= 2);
const dossierPage = lire("app/[locale]/console/comptes/[id]/page.tsx");
check("console dossier : vignettes des immeubles du compte",
  dossierPage.includes("i.photo_url"));
check("console dossier : section revue (autorisation, concordance, décision)",
  dossierPage.includes('t17("reviewTitle")') &&
  dossierPage.includes('t17("openAutorisation")') &&
  dossierPage.includes('t17("concordanceAuto")') &&
  dossierPage.includes("deciderValidationImmeuble(r.id"));

console.log("== 4. i18n : namespace v17 + erreurs, parité FR = EN ==");
const fr = JSON.parse(lire("messages/fr.json"));
const en = JSON.parse(lire("messages/en.json"));
check("i18n : namespace v17 présent FR + EN",
  fr.v17 && en.v17 &&
  typeof fr.v17.photosTitle === "string" &&
  typeof en.v17.photosTitle === "string" &&
  typeof fr.v17.reviewTitle === "string");
check("i18n : type de document « autorisation » traduit",
  typeof fr.documents.types.autorisation === "string" &&
  typeof en.documents.types.autorisation === "string");
check("i18n : erreurs v1.7 traduites (crud + console)",
  typeof fr.crud.errors.ERR_PROPRIETAIRE_DECLARE_REQUIS === "string" &&
  typeof en.crud.errors.ERR_PROPRIETAIRE_DECLARE_REQUIS === "string" &&
  typeof fr.console.errors.ERR_VALIDATION_MOTIF_REQUIS === "string" &&
  typeof en.console.errors.ERR_VALIDATION_MOTIF_REQUIS === "string");
function aplatir(obj, prefixe = "", sortie = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const cle = prefixe ? `${prefixe}.${k}` : k;
    if (v && typeof v === "object") aplatir(v, cle, sortie);
    else sortie[cle] = v;
  }
  return sortie;
}
const clesFr = Object.keys(aplatir(fr)).sort();
const clesEn = Object.keys(aplatir(en)).sort();
check("i18n : parité stricte des clés FR = EN",
  JSON.stringify(clesFr) === JSON.stringify(clesEn),
  `FR=${clesFr.length} EN=${clesEn.length}`);

const INPUT_BASE = {
  adresse: "1, avenue du Test", ville: "Bujumbura", pays: "Burundi",
  type: "immeuble", etages: null, photo_url: null, notes: null,
  type_propriete: "pleine", valeur_estimee: null, devise_valeur: "USD",
  date_estimation: null, mode_acquisition: null,
};
const PHOTO_1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";
const PHOTO_2 = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";

(async () => {
  console.log("== 5. Démo : cas PROPRIÉTAIRE inchangé + photos du passeport ==");
  const { DemoProvider } = require(`${BUILD}/data/demo.js`);
  const {
    GESTIONNAIRE_DEMO_EMAIL,
    SUPER_ADMIN_DEMO_EMAIL,
  } = require(`${BUILD}/data/demo-seed.js`);
  const p = new DemoProvider();
  async function connecter(email) {
    try { await p.signOut(); } catch { /* pas de session */ }
    await p.signIn(email, "motdepasse");
  }
  await connecter("demo@cizaimmo.com");

  const imProprio = await p.creerImmeuble({ ...INPUT_BASE, nom: "Résidence Test Proprio" });
  check("propriétaire : origine proprietaire, déjà valide, aucune revue",
    imProprio.origine_creation === "proprietaire" &&
    imProprio.validation_statut === "valide" &&
    imProprio.proprietaire_declare_nom === null);
  const avec1 = await p.ajouterPhotoImmeuble(imProprio.id, {
    nom_fichier: "facade.png", contenu: PHOTO_1, mime_type: "image/png",
  });
  check("photos : première photo = principale (photos + photos_urls alignés)",
    avec1.photos.length === 1 && avec1.photos_urls[0] === PHOTO_1);
  const avec2 = await p.ajouterPhotoImmeuble(imProprio.id, {
    nom_fichier: "cour.jpg", contenu: PHOTO_2, mime_type: "image/jpeg",
  });
  check("photos : ajout d'une deuxième photo",
    avec2.photos.length === 2 && avec2.photos_urls[1] === PHOTO_2);
  const apresRetrait = await p.retirerPhotoImmeuble(imProprio.id, 0);
  check("photos : retrait de la principale → la suivante devient principale",
    apresRetrait.photos.length === 1 && apresRetrait.photos_urls[0] === PHOTO_2);

  console.log("== 6. Démo : cas GESTIONNAIRE — déclaré, revue, concordance ==");
  await connecter(GESTIONNAIRE_DEMO_EMAIL);
  const eSans = await attendErreur(
    p.creerImmeuble({ ...INPUT_BASE, nom: "Bloc Sans Déclaré" })
  );
  check("gestionnaire : création sans propriétaire déclaré refusée",
    eSans.levee && eSans.code === "ERR_PROPRIETAIRE_DECLARE_REQUIS", eSans.code);

  const imGest = await p.creerImmeuble({
    ...INPUT_BASE,
    nom: "Bloc Géré Test",
    proprietaire_declare_nom: "Amina Niyonzima",
    proprietaire_declare_email: "demo@cizaimmo.com",
  });
  check("gestionnaire : immeuble en attente de validation plateforme",
    imGest.origine_creation === "gestionnaire" &&
    imGest.validation_statut === "en_attente");
  check("gestionnaire : concordance AUTOMATIQUE (propriétaire déjà rattaché et validé)",
    imGest.proprietaire_concordance === true);
  const imGest2 = await p.creerImmeuble({
    ...INPUT_BASE,
    nom: "Bloc Géré Inconnu",
    proprietaire_declare_nom: "Personne Inconnue",
    proprietaire_declare_email: "inconnu@exemple.com",
  });
  check("gestionnaire : propriétaire non rattaché → concordance manuelle",
    imGest2.proprietaire_concordance === false &&
    imGest2.validation_statut === "en_attente");

  const docAuto = await p.televerserDocument({
    type: "autorisation", entite_type: "immeuble", entite_id: imGest.id,
    nom_fichier: "autorisation.pdf", taille_octets: 1200,
    mime_type: "application/pdf", contenu: "data:application/pdf;base64,JVBERi0=",
  });
  check("gestionnaire : autorisation déposée comme document du bien",
    docAuto.type === "autorisation" && docAuto.entite_id === imGest.id);

  console.log("== 7. Démo : décision plateforme (refus motivé, resoumission, validation) ==");
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const eMotif = await attendErreur(p.deciderValidationImmeuble(imGest.id, false));
  check("revue : refus sans motif refusé (ERR_VALIDATION_MOTIF_REQUIS)",
    eMotif.levee && eMotif.code === "ERR_VALIDATION_MOTIF_REQUIS", eMotif.code);
  await p.deciderValidationImmeuble(imGest.id, false, "Autorisation insuffisante");
  const refuse = await p.getImmeuble(imGest.id);
  check("revue : refus motivé enregistré",
    refuse !== null &&
    refuse.validation_statut === "refuse" &&
    refuse.validation_motif === "Autorisation insuffisante");

  await connecter(GESTIONNAIRE_DEMO_EMAIL);
  const resoumis = await p.modifierImmeuble(imGest.id, {
    ...INPUT_BASE,
    nom: "Bloc Géré Test",
    proprietaire_declare_nom: "Amina Niyonzima",
    proprietaire_declare_email: "demo@cizaimmo.com",
  });
  check("revue : correction du gestionnaire → resoumission automatique",
    resoumis.validation_statut === "en_attente" && resoumis.validation_motif === null);

  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  await p.deciderValidationImmeuble(imGest.id, true);
  const valide = await p.getImmeuble(imGest.id);
  check("revue : validation plateforme effective",
    valide !== null && valide.validation_statut === "valide");
  const eEncore = await attendErreur(p.deciderValidationImmeuble(imGest.id, true));
  check("revue : seconde décision impossible (ERR_VALIDATION_PAS_EN_ATTENTE)",
    eEncore.levee && eEncore.code === "ERR_VALIDATION_PAS_EN_ATTENTE", eEncore.code);
  const journal = await p.listerJournalAudit();
  check("revue : décisions journalisées (immeuble_gestion_valide / refuse)",
    journal.some((e) => e.action === "immeuble_gestion_valide" && e.cible_id === imGest.id) &&
    journal.some((e) => e.action === "immeuble_gestion_refuse" && e.cible_id === imGest.id));

  console.log("== 8. Démo : dossier console — vignette + revue ==");
  const comptes = await p.listerComptesPlateforme();
  const compteProprio = comptes.find((c) => c.email === "demo@cizaimmo.com");
  const dossier = await p.listerDossier(compteProprio.id);
  check("dossier : la vignette du bien est exposée (photo_url signé/démo)",
    dossier.immeubles_possedes.length > 0 &&
    typeof dossier.immeubles_possedes[0].photo_url === "string" &&
    dossier.immeubles_possedes[0].photo_url.length > 0,
    JSON.stringify(dossier.immeubles_possedes[0]));
  check("dossier : immeubles_en_revue est un tableau (forme stable)",
    Array.isArray(dossier.immeubles_en_revue));

  console.log(`\nv1.7 passeport photo + autorisation : ${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => {
  console.error("ÉCHEC du test v1.7 :", e);
  process.exit(1);
});

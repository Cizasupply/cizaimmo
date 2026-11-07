// Test Extension v1.6 — VITRINE VÉRIFIÉE (base d'abord) :
//  A. SQL (statique, supabase/module-v16.sql) : colonnes de modération,
//     RPC demander / valider / retirer, trigger de revalidation,
//     politiques publiques conditionnées à vitrine_statut='approuve'.
//  B. Comportement (fournisseur DÉMO, miroir de la base) :
//     seed : 1 annonce approuvée complète visible au public, 1 annonce
//     en attente à contact divergent + justification (file console) ;
//     demander rejette > 10 photos ; demander rejette un contact
//     divergent sans justification et l'accepte avec ; approbation ->
//     l'annonce paraît au public avec quartier / visites / contact ;
//     refus motivé -> absente du public, motif visible du propriétaire ;
//     modification du prix d'une approuvée -> retour en attente +
//     disparition du public ; retrait -> non_publie.
//  C. Interfaces (statique) : badge « ✓ Vérifié » côté public, page
//     console vitrine, parité FR/EN du namespace v16.
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
const {
  SUPER_ADMIN_DEMO_EMAIL,
  GESTIONNAIRE_DEMO_EMAIL,
} = require(`${BUILD}/data/demo-seed.js`);

const CLIENT_EMAIL = "demo@cizaimmo.com";
const ID_APPROUVEE = "00000000-0000-4000-8000-000000000307"; // A4, Buhomba
const ID_EN_ATTENTE = "00000000-0000-4000-8000-000000000308"; // 201, Bloc Saint-Laurent

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

(async () => {
  console.log("== A. SQL module-v16.sql : la modération vit dans la base ==");
  const sql = lire("supabase/module-v16.sql");

  check("colonne appartements.vitrine_statut (défaut non_publie)",
    sql.includes("vitrine_statut") && sql.includes("'non_publie'"));
  check("contrainte des 4 statuts (non_publie/en_attente/approuve/refuse)",
    sql.includes("'en_attente'") && sql.includes("'approuve'") && sql.includes("'refuse'"));
  check("colonnes de validation (motif, valide_par, valide_le)",
    sql.includes("vitrine_motif_refus") && sql.includes("vitrine_valide_par") && sql.includes("vitrine_valide_le"));
  check("colonnes d'annonce (pieces, meuble, disponible_le, visite_jours, visite_heures)",
    sql.includes("pieces") && sql.includes("meuble") && sql.includes("disponible_le")
      && sql.includes("visite_jours") && sql.includes("visite_heures"));
  check("colonnes contact (nom, telephone, email, justification)",
    sql.includes("contact_nom") && sql.includes("contact_telephone")
      && sql.includes("contact_email") && sql.includes("contact_justification"));
  check("colonne immeubles.quartier",
    /immeubles[\s\S]{0,200}quartier/.test(sql) || sql.includes("add column if not exists quartier"));
  check("RPC demander_publication_vitrine définie",
    sql.includes("function public.demander_publication_vitrine"));
  check("RPC valider_publication_vitrine définie (plateforme)",
    sql.includes("function public.valider_publication_vitrine") && sql.includes("est_admin_plateforme"));
  check("RPC retirer_publication_vitrine définie",
    sql.includes("function public.retirer_publication_vitrine"));
  check("demande : plan Pro/Agence exigé (ERR_VITRINE_PLAN)",
    sql.includes("ERR_VITRINE_PLAN"));
  check("demande : garde d'écriture v1.4 réutilisée (abonnement_permets_ecriture)",
    sql.includes("abonnement_permets_ecriture") && sql.includes("ERR_VITRINE_ECRITURE"));
  check("demande : 1 à 10 photos (ERR_VITRINE_PHOTOS)",
    sql.includes("ERR_VITRINE_PHOTOS") && sql.includes("array_length"));
  check("demande : contact obligatoire (ERR_VITRINE_CONTACT_MANQUANT)",
    sql.includes("ERR_VITRINE_CONTACT_MANQUANT"));
  check("règle contact : justification obligatoire si divergent (ERR_JUSTIFICATION_CONTACT)",
    sql.includes("ERR_JUSTIFICATION_CONTACT"));
  check("validation : statut en_attente exigé (ERR_VITRINE_PAS_EN_ATTENTE)",
    sql.includes("ERR_VITRINE_PAS_EN_ATTENTE"));
  check("refus : motif obligatoire (ERR_VITRINE_MOTIF_REQUIS)",
    sql.includes("ERR_VITRINE_MOTIF_REQUIS"));
  check("trigger de revalidation anti-fraude présent",
    sql.includes("vitrine_revalidation_auto") && sql.includes("before update"));
  check("trigger : surveille prix + photos + contact (is distinct from)",
    sql.includes("is distinct from") && sql.includes("loyer_defaut") && sql.includes("photos"));
  check("trigger : garde « pas de changement de statut dans la même écriture »",
    /new\.vitrine_statut\s*=\s*old\.vitrine_statut/.test(sql));
  check("politique publique appartements : approuve exigé",
    sql.includes("appartements_select_public") && sql.includes("vitrine_statut = 'approuve'"));
  check("politiques publiques immeubles + profils recréées avec approuve",
    sql.includes("immeubles_select_public") && sql.includes("profils_select_vitrine"));
  check("journalisation des décisions (journal_audit)",
    sql.includes("journal_audit") && sql.includes("vitrine_approuvee") && sql.includes("vitrine_refusee"));
  check("migration douce : annonces déjà publiées -> en_attente",
    /set vitrine_statut = 'en_attente'/.test(sql));

  console.log("== B. Démo : seed et parcours complet ==");
  const p = new DemoProvider();
  async function connecter(email, mdp = "motdepasse") {
    try { await p.signOut(); } catch { /* pas de session */ }
    await p.signIn(email, mdp);
  }

  // --- Public sans connexion : seule l'annonce approuvée est visible.
  const publiques0 = await p.listerAnnoncesPubliques();
  const annonceApprouvee = publiques0.find((a) => a.appartement.id === ID_APPROUVEE);
  check("seed : l'annonce approuvée est visible au public", !!annonceApprouvee);
  check("seed : l'annonce en attente est INVISIBLE au public",
    !publiques0.some((a) => a.appartement.id === ID_EN_ATTENTE));
  check("annonce approuvée : quartier + adresse affichés",
    !!annonceApprouvee && annonceApprouvee.quartier === "Buhomba" && annonceApprouvee.adresse.length > 0,
    JSON.stringify(annonceApprouvee && annonceApprouvee.quartier));
  check("annonce approuvée : visites + pièces + meublé portés par l'annonce",
    !!annonceApprouvee && annonceApprouvee.appartement.visite_jours.includes("sam")
      && annonceApprouvee.appartement.pieces === 2 && annonceApprouvee.appartement.meuble === true);
  check("annonce approuvée : contact affiché = contact du dossier (propriétaire)",
    !!annonceApprouvee && annonceApprouvee.contact.email === CLIENT_EMAIL
      && !!annonceApprouvee.contact.telephone,
    JSON.stringify(annonceApprouvee && annonceApprouvee.contact));

  // --- File console : l'annonce en attente, divergent = true.
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const file0 = await p.listerVitrineAValider();
  const aValider = file0.find((a) => a.appartement.id === ID_EN_ATTENTE);
  check("file console : l'annonce en attente seed y figure", !!aValider);
  check("file console : contact divergent détecté (divergent = true)",
    !!aValider && aValider.divergent === true, JSON.stringify(aValider && aValider.divergent));
  check("file console : contact attendu = gestionnaire rattaché (Marc Dubois)",
    !!aValider && aValider.contact_dossier_role === "gestionnaire"
      && aValider.contact_dossier.nom.includes("Marc"),
    JSON.stringify(aValider && aValider.contact_dossier));
  check("file console : justification du contact affichée",
    !!aValider && !!aValider.justification && aValider.justification.length > 0);
  check("file console : propriétaire + Display ID présents",
    !!aValider && aValider.proprietaire_nom.length > 0 && "proprietaire_display_id" in aValider);

  // --- Parcours propriétaire : création d'un appartement de test.
  await connecter(CLIENT_EMAIL);
  const db = p.getDemoDb();
  const buhomba = db.immeubles.find((i) => i.nom === "Immeuble Buhomba");
  const photos = (n) => Array.from({ length: n }, (_, i) => `https://exemple.cizaimmo.com/photos/test-${i + 1}.jpg`);
  const cree = await p.creerAppartement({
    immeuble_id: buhomba.id,
    numero: "V16",
    type: "T2",
    surface_m2: 50,
    loyer_defaut: 400000,
    devise: "BIF",
    charges: 20000,
    etage: 1,
    description: "Appartement de test v1.6.",
    photos: photos(11),
    statut: "vacant",
    vitrine: false,
    valeur_bien: null,
    devise_valeur: null,
    contact_telephone: "+257 79 00 00 01",
  });
  check("création : statut vitrine initial non_publie",
    cree.vitrine_statut === "non_publie", cree.vitrine_statut);

  const ePhotos = await attendErreur(p.demanderPublicationVitrine(cree.id));
  check("demande refusée : plus de 10 photos (ERR_VITRINE_PHOTOS)",
    ePhotos.levee && ePhotos.code === "ERR_VITRINE_PHOTOS", JSON.stringify(ePhotos));

  await p.modifierAppartement(cree.id, {
    photos: photos(3),
    contact_telephone: "+257 00 000 000",
    contact_justification: null,
  });
  const eJustif = await attendErreur(p.demanderPublicationVitrine(cree.id));
  check("demande refusée : contact divergent sans justification (ERR_JUSTIFICATION_CONTACT)",
    eJustif.levee && eJustif.code === "ERR_JUSTIFICATION_CONTACT", JSON.stringify(eJustif));

  await p.modifierAppartement(cree.id, {
    contact_justification: "Numéro de la conciergerie de l'immeuble, joignable sur place.",
  });
  const demande = await p.demanderPublicationVitrine(cree.id);
  check("demande acceptée avec justification -> en_attente",
    demande.vitrine_statut === "en_attente" && demande.vitrine === true,
    JSON.stringify(demande.vitrine_statut));
  const publiques1 = await p.listerAnnoncesPubliques();
  check("en attente : toujours invisible au public",
    !publiques1.some((a) => a.appartement.id === cree.id));

  // --- Validation console : refus sans motif, puis approbation.
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const eMotif = await attendErreur(p.validerPublicationVitrine(cree.id, false));
  check("refus sans motif refusé (ERR_VITRINE_MOTIF_REQUIS)",
    eMotif.levee && eMotif.code === "ERR_VITRINE_MOTIF_REQUIS", JSON.stringify(eMotif));
  const file1 = await p.listerVitrineAValider();
  check("file console : la nouvelle annonce en attente y figure",
    file1.some((a) => a.appartement.id === cree.id));

  const approuvee = await p.validerPublicationVitrine(ID_EN_ATTENTE, true);
  check("approbation de l'annonce seed en attente -> approuve",
    approuvee.vitrine_statut === "approuve", approuvee.vitrine_statut);
  const publiques2 = await p.listerAnnoncesPubliques();
  const annonceSeed = publiques2.find((a) => a.appartement.id === ID_EN_ATTENTE);
  check("après approbation : l'annonce paraît au public",
    !!annonceSeed);
  check("annonce publiée : quartier + visites + contact ANNONCÉ affichés",
    !!annonceSeed && annonceSeed.quartier === "Le Plateau-Mont-Royal"
      && annonceSeed.appartement.visite_jours.includes("mer")
      && annonceSeed.contact.email === "relais@exemple.ca"
      && annonceSeed.appartement.disponible_le === "2026-12-01",
    JSON.stringify(annonceSeed && { q: annonceSeed.quartier, c: annonceSeed.contact }));

  const refusee = await p.validerPublicationVitrine(cree.id, false, "Prix incohérent");
  check("refus motivé -> refuse + motif enregistré",
    refusee.vitrine_statut === "refuse" && refusee.vitrine_motif_refus === "Prix incohérent",
    JSON.stringify(refusee.vitrine_motif_refus));
  const eRevalider = await attendErreur(p.validerPublicationVitrine(cree.id, true));
  check("revalidation d'une annonce refusée refusée (ERR_VITRINE_PAS_EN_ATTENTE)",
    eRevalider.levee && eRevalider.code === "ERR_VITRINE_PAS_EN_ATTENTE", JSON.stringify(eRevalider));

  // --- Côté propriétaire : motif visible, nouvelle demande, approbation.
  await connecter(CLIENT_EMAIL);
  const relu = await p.getAppartement(cree.id);
  check("propriétaire : motif de refus visible sur son annonce",
    !!relu && relu.vitrine_statut === "refuse" && relu.vitrine_motif_refus === "Prix incohérent");
  await p.demanderPublicationVitrine(cree.id);
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  await p.validerPublicationVitrine(cree.id, true);
  const publiques3 = await p.listerAnnoncesPubliques();
  check("approuvée (2e demande) : visible au public",
    publiques3.some((a) => a.appartement.id === cree.id));

  // --- Anti-fraude : modification du prix -> retour en attente.
  await connecter(CLIENT_EMAIL);
  const maj = await p.modifierAppartement(cree.id, { loyer_defaut: 420000 });
  check("prix modifié sur une approuvée -> repasse en_attente",
    maj.vitrine_statut === "en_attente", maj.vitrine_statut);
  const publiques4 = await p.listerAnnoncesPubliques();
  check("après revalidation requise : disparue du public",
    !publiques4.some((a) => a.appartement.id === cree.id));

  // --- Retrait par le propriétaire.
  const retiree = await p.retirerPublicationVitrine(cree.id);
  check("retrait -> non_publie + vitrine false",
    retiree.vitrine_statut === "non_publie" && retiree.vitrine === false,
    JSON.stringify(retiree.vitrine_statut));

  // --- Accès : la file console est refusée aux non-plateforme.
  const eFile = await attendErreur(p.listerVitrineAValider());
  check("file console refusée au client (ERR_ACCES_PLATEFORME)",
    eFile.levee && eFile.code === "ERR_ACCES_PLATEFORME", JSON.stringify(eFile));

  console.log("== C. Interfaces : badge vérifié, console, parité i18n ==");
  const pageListe = lire("app/[locale]/a-louer/page.tsx");
  const pageDetail = lire("app/[locale]/a-louer/[id]/page.tsx");
  const pageConsole = lire("app/[locale]/console/vitrine/page.tsx");
  check("public liste : badge vérifié + cadre photo 4:3",
    pageListe.includes("verifiedBadge") && pageListe.includes("aspect-[4/3]"));
  check("public détail : badge vérifié + galerie 4:3",
    pageDetail.includes("verifiedBadge") && pageDetail.includes("aspect-[4/3]"));
  check("console vitrine : file + validation branchées sur le provider",
    pageConsole.includes("listerVitrineAValider") && pageConsole.includes("validerPublicationVitrine"));
  const fr = JSON.parse(lire("messages/fr.json"));
  const en = JSON.parse(lire("messages/en.json"));
  const clesFr = Object.keys(fr.v16 || {}).sort();
  const clesEn = Object.keys(en.v16 || {}).sort();
  check("i18n : namespace v16 présent FR + EN avec parité stricte",
    clesFr.length > 0 && JSON.stringify(clesFr) === JSON.stringify(clesEn),
    `${clesFr.length} vs ${clesEn.length}`);
  check("i18n : badge « ✓ Vérifié » traduit des deux côtés",
    !!fr.v16 && fr.v16.verifiedBadge === "✓ Vérifié" && !!en.v16 && en.v16.verifiedBadge === "✓ Verified",
    JSON.stringify(fr.v16 && fr.v16.verifiedBadge));

  console.log(`\nRésultat v1.6 : ${ok} OK, ${ko} KO`);
  process.exit(ko > 0 ? 1 : 0);
})().catch((e) => { console.error("ERREUR TEST", e); process.exit(2); });

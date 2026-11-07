// Test Extension v1.5 — SUPPRESSION DE COMPTE PAR LE CLIENT (base d'abord) :
//  A. SQL (statique, supabase/module-v15.sql) : RPC demander / annuler /
//     exécuter, instantané jsonb sur abonnements, anonymisation des
//     factures, garde est_admin_plateforme + acces_admin_actif.
//  B. Comportement (fournisseur DÉMO, miroir de la base) :
//     demande -> lecture seule IMMÉDIATE (écritures refusées) ;
//     annulation -> restauration EXACTE de l'abonnement (instantané) ;
//     exécution refusée avant 30 jours (ERR_DELAI_NON_ECOULE) ;
//     échéance simulée (demande reculée dans le stockage démo) ->
//     exécution : factures anonymisées + compte supprimé + audit conservé.
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

const CLIENT_EMAIL = "demo@cizaimmo.com";

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
  console.log("== A. SQL module-v15.sql : la suppression vit dans la base ==");
  const sql = lire("supabase/module-v15.sql");

  check("RPC demander_suppression_compte définie",
    sql.includes("function public.demander_suppression_compte()"));
  check("RPC annuler_suppression_compte définie",
    sql.includes("function public.annuler_suppression_compte()"));
  check("RPC executer_suppression_compte(cible) définie",
    sql.includes("function public.executer_suppression_compte(cible uuid)"));
  check("instantané : colonne abonnements.instantane_avant_suppression (jsonb)",
    sql.includes("instantane_avant_suppression") && sql.toLowerCase().includes("jsonb"));
  check("instantané pris via to_jsonb (ligne complète de l'abonnement)",
    sql.includes("to_jsonb"));
  check("demande : passage immédiat en lecture_seule (la garde v1.4 refuse ensuite)",
    sql.includes("'lecture_seule'"));
  check("profils.suppression_demandee_le posé par la base",
    sql.includes("suppression_demandee_le"));
  check("exécution : refus avant 30 jours (DELAI_NON_ECOULE)",
    sql.includes("DELAI_NON_ECOULE") && sql.includes("interval '30 days'"));
  check("exécution : Super Admin seulement (SUPER_ADMIN_REQUIS)",
    sql.includes("SUPER_ADMIN_REQUIS"));
  check("double demande refusée (SUPPRESSION_DEJA_DEMANDEE)",
    sql.includes("SUPPRESSION_DEJA_DEMANDEE"));
  check("annulation sans demande refusée (AUCUNE_SUPPRESSION)",
    sql.includes("AUCUNE_SUPPRESSION"));
  check("factures : colonne anonymise + références remplacées par 'ANONYMISE'",
    sql.includes("anonymise") && sql.includes("'ANONYMISE'"));
  check("est_admin_plateforme exige acces_admin_actif (v1.5)",
    sql.includes("acces_admin_actif"));
  check("suppression du compte via le helper commun (auth.users)",
    sql.includes("supprimer_utilisateur_auth") && sql.includes("delete from auth.users"));

  console.log("== B. Comportement démo : demande -> lecture seule -> annulation exacte ==");
  const p = new DemoProvider();
  async function connecter(email, mdp = "motdepasse") {
    try { await p.signOut(); } catch { /* pas de session */ }
    await p.signIn(email, mdp);
  }

  await connecter(CLIENT_EMAIL);
  const profil0 = await p.getProfil();
  check("client principal connecté", !!profil0 && profil0.email === CLIENT_EMAIL, profil0 && profil0.email);

  // S'assurer qu'au moins une facture AVEC référence existe (parcours
  // mobile money standard) pour prouver l'anonymisation plus bas.
  let factures0 = await p.listerFactures();
  if (!factures0.some((f) => f.reference_mobile_money)) {
    const mm = await p.demanderPaiementMobileMoney("ecocash", "+257 79 00 00 00", "pro");
    await p.confirmerPaiementMobileMoney(mm.reference);
    factures0 = await p.listerFactures();
  }
  check("facture avec référence mobile money présente avant suppression",
    factures0.some((f) => f.reference_mobile_money && f.reference_mobile_money !== "ANONYMISE"),
    JSON.stringify(factures0.map((f) => f.reference_mobile_money)));

  const abo0 = await p.getAbonnement();
  const base = {
    statut: abo0.statut, plan: abo0.plan, plan_apres_essai: abo0.plan_apres_essai,
    debut_periode: abo0.debut_periode, fin_periode: abo0.fin_periode,
    trial_ends_at: abo0.trial_ends_at, grace_ends_at: abo0.grace_ends_at,
    echec_paiement: abo0.echec_paiement,
  };
  check("abonnement de base actif ou en essai (écriture possible)",
    base.statut === "actif" || base.statut === "essai", base.statut);

  const profDemande = await p.demanderSuppressionCompte();
  check("demande posée : profils.suppression_demandee_le renseigné",
    !!profDemande.suppression_demandee_le, JSON.stringify(profDemande.suppression_demandee_le));

  const abo1 = await p.getAbonnement();
  check("lecture seule IMMÉDIATE après la demande", abo1.statut === "lecture_seule", abo1.statut);
  check("instantané conservé : statut d'origine = celui de base",
    !!abo1.instantane_avant_suppression && abo1.instantane_avant_suppression.statut === base.statut,
    JSON.stringify(abo1.instantane_avant_suppression && abo1.instantane_avant_suppression.statut));

  const eEcriture = await attendErreur(p.creerImmeuble({
    nom: "Immeuble Interdit V15", adresse: "Rue Test", ville: "Bujumbura", pays: "Burundi",
    devise: "BIF", type: "immeuble", etages: null, photo_url: null, notes: null,
    valeur_bien: null, devise_valeur: null, date_acquisition: null, prix_acquisition: null,
  }));
  check("écriture refusée pendant la suppression (ERR_ABONNEMENT_REQUIS)",
    eEcriture.levee && eEcriture.code === "ERR_ABONNEMENT_REQUIS", JSON.stringify(eEcriture));

  // La lecture reste possible (principe de la lecture seule).
  const immeublesLus = await p.listerImmeubles();
  check("lecture toujours possible pendant la suppression", Array.isArray(immeublesLus));

  const eDouble = await attendErreur(p.demanderSuppressionCompte());
  check("double demande refusée (ERR_SUPPRESSION_DEJA_DEMANDEE)",
    eDouble.levee && eDouble.code === "ERR_SUPPRESSION_DEJA_DEMANDEE", JSON.stringify(eDouble));

  console.log("== C. Annulation : restauration EXACTE depuis l'instantané ==");
  const profAnnule = await p.annulerSuppressionCompte();
  check("annulation : demande effacée", !profAnnule.suppression_demandee_le);
  const abo2 = await p.getAbonnement();
  check("restauration exacte : statut/plan/dates/grâce identiques à la base",
    abo2.statut === base.statut && abo2.plan === base.plan &&
    abo2.plan_apres_essai === base.plan_apres_essai &&
    abo2.debut_periode === base.debut_periode && abo2.fin_periode === base.fin_periode &&
    abo2.trial_ends_at === base.trial_ends_at && abo2.grace_ends_at === base.grace_ends_at &&
    abo2.echec_paiement === base.echec_paiement,
    JSON.stringify({ statut: abo2.statut, plan: abo2.plan, fin: abo2.fin_periode }));
  check("restauration : instantané purgé", !abo2.instantane_avant_suppression);

  const eAnnule2 = await attendErreur(p.annulerSuppressionCompte());
  check("annulation sans demande refusée (ERR_AUCUNE_SUPPRESSION)",
    eAnnule2.levee && eAnnule2.code === "ERR_AUCUNE_SUPPRESSION", JSON.stringify(eAnnule2));

  console.log("== D. Exécution : refus avant 30 j, puis exécution après échéance simulée ==");
  await p.demanderSuppressionCompte();
  const clientId = profil0.id;

  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  let file = await p.listerSuppressionsEnAttente();
  const ligne = file.find((s) => s.compte_id === clientId);
  check("file console : la demande du client est listée", !!ligne);
  check("file console : échéance = demande + 30 jours, non exécutable",
    !!ligne && ligne.executable === false &&
    new Date(ligne.echeance_le).getTime() - new Date(ligne.suppression_demandee_le).getTime() === 30 * 24 * 3600 * 1000,
    JSON.stringify(ligne));

  const eTot = await attendErreur(p.executerSuppressionCompte(clientId));
  check("exécution avant 30 jours REFUSÉE par la base (ERR_DELAI_NON_ECOULE)",
    eTot.levee && eTot.code === "ERR_DELAI_NON_ECOULE", JSON.stringify(eTot));

  // Échéance simulée : on recule la demande de 31 jours dans le
  // stockage démo (horloge relative, comme les autres simulations).
  const db = p.getDemoDb();
  db.profil.suppression_demandee_le = new Date(Date.now() - 31 * 24 * 3600 * 1000).toISOString();
  globalThis.window.localStorage.setItem("cizaimmo-demo-db-v1", JSON.stringify(db));

  file = await p.listerSuppressionsEnAttente();
  const ligne2 = file.find((s) => s.compte_id === clientId);
  check("après échéance simulée : la demande devient exécutable",
    !!ligne2 && ligne2.executable === true, JSON.stringify(ligne2));

  await p.executerSuppressionCompte(clientId);
  check("exécution après échéance : aucune erreur", true);

  const comptes = await p.listerComptesPlateforme();
  check("compte supprimé : absent de la file console",
    !comptes.some((c) => c.id === clientId || c.email === CLIENT_EMAIL));

  const dbApres = p.getDemoDb();
  const facturesApres = (dbApres.factures || []).filter((f) => f.owner_id === clientId);
  check("factures conservées mais ANONYMISÉES (comptabilité)",
    facturesApres.length > 0 &&
    facturesApres.every((f) => f.anonymise === true) &&
    facturesApres.every((f) => !f.reference_mobile_money || f.reference_mobile_money === "ANONYMISE") &&
    facturesApres.every((f) => typeof f.montant === "number"),
    JSON.stringify(facturesApres.map((f) => ({ a: f.anonymise, r: f.reference_mobile_money }))));

  const audit = await p.listerJournalAudit();
  check("audit conservé : suppression_executee journalisée",
    audit.some((a) => a.action === "suppression_executee" && a.cible_id === clientId),
    JSON.stringify(audit.map((a) => a.action).slice(0, 8)));
  check("audit conservé : suppression_demandee journalisée (signée par le client)",
    audit.some((a) => a.action === "suppression_demandee"));

  console.log(`\n=== v1.5 Suppression : ${ok} OK, ${ko} KO ===`);
  process.exit(ko > 0 ? 1 : 0);
})().catch((e) => {
  console.error("ERREUR FATALE", e);
  process.exit(1);
});

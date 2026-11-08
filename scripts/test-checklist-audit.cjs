// Test — Checklist de vérification avant approbation + registre
// d'audit enrichi (2026-11-07, demande du fondateur).
//
//  1. CHECKLIST : l'Admin doit cocher photo / pièce / infos (et
//     l'alerte anti-fraude si le compte est signalé) avant de
//     pouvoir approuver. Bouton grisé tant qu'incomplet (front),
//     garde équivalente DANS la base (approuver_compte lève
//     CHECKLIST_INCOMPLETE), coches consignées (qui + quand) via la
//     RPC enregistrer_checklist_dossier. Le REFUS reste libre.
//     Ici : contenu statique du module SQL et des providers, puis
//     comportement réel du fournisseur démo.
//  2. AUDIT ENRICHI : chaque entrée du journal consigne le NOM de
//     l'acteur (snapshot), son rôle et l'horodatage complet ;
//     l'affichage console montre « Nom — rôle — jour à heure ».
//     Ici : colonne + trigger de complétion, helper d'écriture,
//     formatDateTime (runtime) et affichages.
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

console.log("== 1. SQL : table, RPC, garde d'approbation, audit enrichi ==");
const sql = lire("supabase/module-checklist-audit.sql");
check("sql : table dossier_checklists créée",
  sql.includes("create table if not exists public.dossier_checklists"));
for (const col of ["photo_verifiee", "piece_coherente", "infos_verifiees", "antifraude_examinee", "acteur_id", "cible_id"]) {
  check(`sql : colonne checklist ${col}`, sql.includes(col));
}
check("sql : politiques plateforme (select + insert acteur = session)",
  sql.includes("dossier_checklists_select_plateforme") &&
  sql.includes("dossier_checklists_insert_plateforme") &&
  sql.includes("est_admin_plateforme()"));
check("sql : RPC enregistrer_checklist_dossier créée",
  sql.includes("create or replace function public.enregistrer_checklist_dossier("));
check("sql : RPC rôle vérifié + erreurs nommées",
  sql.includes("ADMIN_PLATEFORME_REQUIS") && sql.includes("COMPTE_INTROUVABLE") &&
  sql.includes("COMPTE_NON_EN_ATTENTE"));
check("sql : approuver_compte recréée avec la garde CHECKLIST_INCOMPLETE",
  sql.includes("create or replace function public.approuver_compte(cible uuid)") &&
  sql.includes("CHECKLIST_INCOMPLETE"));
check("sql : garde — photo + pièce + infos exigées",
  sql.includes("not v_check.photo_verifiee") &&
  sql.includes("not v_check.piece_coherente") &&
  sql.includes("not v_check.infos_verifiees"));
check("sql : garde — anti-fraude exigée seulement si « a_verifier »",
  sql.includes("v_grille_statut") && sql.includes("'a_verifier'") &&
  sql.includes("not v_check.antifraude_examinee"));
check("sql : journal_audit gagne acteur_nom",
  sql.includes("alter table public.journal_audit") && sql.includes("acteur_nom text"));
check("sql : trigger de complétion du nom (point d'écriture commun)",
  sql.includes("journal_audit_completer_acteur") &&
  sql.includes("trg_journal_audit_completer_acteur") &&
  sql.includes("before insert on public.journal_audit"));
check("sql : grants authenticated (RPC + approbation)",
  sql.includes("grant execute on function public.enregistrer_checklist_dossier(uuid, boolean, boolean, boolean, boolean) to authenticated") &&
  sql.includes("grant execute on function public.approuver_compte(uuid) to authenticated"));

console.log("== 2. Providers : consignation, garde, journal enrichi ==");
const real = lire("lib/data/real.ts");
check("real : enregistrerChecklistDossier appelle la RPC",
  real.includes('rpc("enregistrer_checklist_dossier"'));
check("real : approuverCompte mappe CHECKLIST_INCOMPLETE -> ERR_CHECKLIST_INCOMPLETE",
  real.includes('includes("CHECKLIST_INCOMPLETE")') && real.includes('err("ERR_CHECKLIST_INCOMPLETE")'));
check("real : journaliserAudit écrit acteur_nom (snapshot de l'acteur)",
  real.includes("acteur_nom: acteur.nom"));
check("real : acteurPlateforme expose le nom du profil",
  real.includes("nom: profil.nom"));
check("real : listerDossier relit la checklist consignée",
  real.includes('from("dossier_checklists")') && real.includes("checklist,"));
check("real : l'approbation verse les cases cochées au journal",
  real.includes("checklist_photo_verifiee") && real.includes("checklist_antifraude_examinee"));
const demo = lire("lib/data/demo.ts");
check("demo : enregistrerChecklistDossier consigné (acteur + horodatage)",
  demo.includes("async enregistrerChecklistDossier") &&
  demo.includes("acteur_nom: acteur.nom"));
check("demo : approuverCompte garde ERR_CHECKLIST_INCOMPLETE",
  demo.includes('throw err("ERR_CHECKLIST_INCOMPLETE")'));
check("demo : garde anti-fraude seulement si « a_verifier »",
  demo.includes('grilleStatutCible === "a_verifier" && !chk.antifraude_examinee'));
check("demo : journaliserAudit fige acteur_nom dans l'entrée",
  demo.includes("acteur_nom: acteurNom"));
check("demo : listerDossier expose la checklist",
  demo.includes("checklist: db.plateforme.checklistsDossiers?.[compteId] ?? null"));
const provider = lire("lib/data/provider.ts");
check("provider : enregistrerChecklistDossier dans l'interface",
  provider.includes("enregistrerChecklistDossier("));
const types = lire("lib/data/types.ts");
check("types : ChecklistDossier + acteur_nom + checklist du DossierCompte",
  types.includes("interface ChecklistDossier") &&
  types.includes("acteur_nom: string | null") &&
  types.includes("checklist: ChecklistDossier | null"));

console.log("== 3. Console : bouton grisé, refus libre, affichage enrichi ==");
const page = lire("app/[locale]/console/comptes/[id]/page.tsx");
check("page dossier : bouton Approuver désactivé sans checklist complète",
  page.includes("disabled={occupe || !checklistComplete}"));
check("page dossier : les 4 cases rendues (clés i18n)",
  page.includes('t("checklistPhoto")') && page.includes('t("checklistPiece")') &&
  page.includes('t("checklistInfos")') && page.includes('t("checklistAntifraude")'));
check("page dossier : case anti-fraude conditionnée à « a_verifier »",
  page.includes('compte.grille_statut === "a_verifier"') && page.includes("aVerifier"));
check("page dossier : bascule consignée via le provider",
  page.includes("enregistrerChecklistDossier(dossier.compte.id, prochain)"));
check("page dossier : consignation affichée (qui + quand)",
  page.includes('t("checklistBy"'));
check("page dossier : le refus n'est PAS conditionné à la checklist",
  page.includes("refuserCompte(compte.id, motif)") &&
  !page.includes("disabled={occupe || !checklistComplete}\n              onClick={() => agir(() => getDataProvider().refuserCompte"));
check("page dossier : historique = nom — rôle — jour + heure",
  page.includes("e.acteur_nom ?? e.acteur_email") && page.includes("formatDateTime(e.created_at, locale)"));
const journalPage = lire("app/[locale]/console/journal/page.tsx");
check("page journal : acteur = nom (repli e-mail) + date/heure complète",
  journalPage.includes("e.acteur_nom ?? e.acteur_email") &&
  journalPage.includes("formatDateTime(e.created_at, locale)"));

console.log("== 4. i18n : clés checklist + erreur, parité FR = EN ==");
const fr = JSON.parse(lire("messages/fr.json"));
const en = JSON.parse(lire("messages/en.json"));
for (const cle of ["checklistTitle", "checklistPhoto", "checklistPiece", "checklistInfos", "checklistAntifraude", "checklistHint", "checklistBy"]) {
  check(`i18n : console.${cle} présent FR + EN`,
    typeof fr.console[cle] === "string" && typeof en.console[cle] === "string");
}
check("i18n : ERR_CHECKLIST_INCOMPLETE traduit FR + EN",
  typeof fr.console.errors.ERR_CHECKLIST_INCOMPLETE === "string" &&
  typeof en.console.errors.ERR_CHECKLIST_INCOMPLETE === "string");
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

console.log("== 5. Runtime : formatDateTime ==");
const { formatDateTime } = require(`${BUILD}/format.js`);
const frDt = formatDateTime("2026-11-07T17:30:00", "fr");
check("formatDateTime FR : jour + « à 17 h 30 »",
  frDt.includes("2026") && frDt.includes("17 h 30"), frDt);
const enDt = formatDateTime("2026-11-07T17:30:00", "en");
check("formatDateTime EN : date + heure locale",
  enDt.includes("2026") && enDt.includes("5:30"), enDt);
check("formatDateTime : null -> tiret", formatDateTime(null, "fr") === "—");

(async () => {
  console.log("== 6. Démo (comportement) : garde, consignation, journal ==");
  const { DemoProvider } = require(`${BUILD}/data/demo.js`);
  const { SUPER_ADMIN_DEMO_EMAIL } = require(`${BUILD}/data/demo-seed.js`);
  const p = new DemoProvider();
  p.envoyerEmailAlerteFn = async () => ({ envoye: true });
  async function connecter(email) {
    try { await p.signOut(); } catch { /* pas de session */ }
    await p.signIn(email, "motdepasse");
  }
  await connecter(SUPER_ADMIN_DEMO_EMAIL);

  // — Compte SANS signal anti-fraude (client-demo-6, en attente).
  const ID6 = "client-demo-6";
  const dossier6 = await p.listerDossier(ID6);
  check("démo : aucune checklist au départ", dossier6.checklist === null);
  const e1 = await attendErreur(p.approuverCompte(ID6));
  check("démo : approbation refusée sans checklist (ERR_CHECKLIST_INCOMPLETE)",
    e1.levee && e1.code === "ERR_CHECKLIST_INCOMPLETE", e1.code);
  await p.enregistrerChecklistDossier(ID6, {
    photo_verifiee: true, piece_coherente: true,
    infos_verifiees: false, antifraude_examinee: false,
  });
  const e2 = await attendErreur(p.approuverCompte(ID6));
  check("démo : approbation encore refusée avec checklist partielle",
    e2.levee && e2.code === "ERR_CHECKLIST_INCOMPLETE", e2.code);
  await p.enregistrerChecklistDossier(ID6, {
    photo_verifiee: true, piece_coherente: true,
    infos_verifiees: true, antifraude_examinee: false,
  });
  const dossier6b = await p.listerDossier(ID6);
  check("démo : checklist consignée relue (acteur nommé + horodatage)",
    dossier6b.checklist !== null &&
    dossier6b.checklist.infos_verifiees === true &&
    dossier6b.checklist.acteur_nom === "Ciza Misigaro" &&
    typeof dossier6b.checklist.updated_at === "string",
    JSON.stringify(dossier6b.checklist));
  await p.approuverCompte(ID6);
  const comptes = await p.listerComptesPlateforme();
  const c6 = comptes.find((c) => c.id === ID6);
  check("démo : approbation effective après checklist complète (essai démarré)",
    c6 && c6.abonnement && c6.abonnement.statut === "essai",
    c6 && c6.abonnement && c6.abonnement.statut);
  const journal = await p.listerJournalAudit();
  const appro = journal.find((e) => e.action === "compte_approuve" && e.cible_id === ID6);
  check("démo : journal d'approbation enrichi (nom + rôle)",
    !!appro && appro.acteur_nom === "Ciza Misigaro" && appro.acteur_role === "super_admin",
    appro && `${appro.acteur_nom}/${appro.acteur_role}`);
  check("démo : cases cochées versées au détail de l'approbation",
    !!appro && appro.details &&
    appro.details.checklist_photo_verifiee === true &&
    appro.details.checklist_infos_verifiees === true,
    appro && JSON.stringify(appro.details));

  // — Compte SIGNALÉ « a_verifier » (client-demo-7, en attente).
  const ID7 = "client-demo-7";
  await p.enregistrerChecklistDossier(ID7, {
    photo_verifiee: true, piece_coherente: true,
    infos_verifiees: true, antifraude_examinee: false,
  });
  const e3 = await attendErreur(p.approuverCompte(ID7));
  check("démo : compte signalé — anti-fraude manquante = approbation refusée",
    e3.levee && e3.code === "ERR_CHECKLIST_INCOMPLETE", e3.code);
  await p.enregistrerChecklistDossier(ID7, {
    photo_verifiee: true, piece_coherente: true,
    infos_verifiees: true, antifraude_examinee: true,
  });
  await p.approuverCompte(ID7);
  const c7 = (await p.listerComptesPlateforme()).find((c) => c.id === ID7);
  check("démo : compte signalé approuvé une fois l'anti-fraude examinée",
    c7 && c7.abonnement && c7.abonnement.statut === "essai",
    c7 && c7.abonnement && c7.abonnement.statut);

  // — Enrichissement sur une AUTRE action plateforme (grille).
  await p.reattribuerGrille(ID6, "internationale");
  const journal2 = await p.listerJournalAudit();
  const grille = journal2.find((e) => e.action === "grille_reattribuee" && e.cible_id === ID6);
  check("démo : autre action journalisée avec le nom de l'acteur",
    !!grille && grille.acteur_nom === "Ciza Misigaro",
    grille && grille.acteur_nom);

  console.log("== 7. Démo : le REFUS reste libre (aucune checklist) ==");
  store.clear();
  const p2 = new DemoProvider();
  p2.envoyerEmailAlerteFn = async () => ({ envoye: true });
  try { await p2.signOut(); } catch { /* pas de session */ }
  await p2.signIn(SUPER_ADMIN_DEMO_EMAIL, "motdepasse");
  const refus = await attendErreur(p2.refuserCompte(ID6, "informations_insuffisantes"));
  check("démo : refus possible SANS aucune checklist cochée", !refus.levee, refus.code);
  const c6r = (await p2.listerComptesPlateforme()).find((c) => c.id === ID6);
  check("démo : compte refusé (abonnement annulé)",
    c6r && c6r.abonnement && c6r.abonnement.statut === "annule",
    c6r && c6r.abonnement && c6r.abonnement.statut);

  console.log(`\nChecklist + audit enrichi : ${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => {
  console.error("ÉCHEC du test checklist/audit :", e);
  process.exit(1);
});

// Test — Renfort « suppression de compte : confirmation par mot de
// passe » (2026-11-07, règle du fondateur).
//
// Avant ce renfort, un simple dialogue de confirmation suffisait
// pour poser une demande de suppression de compte (v1.5). Règle
// nouvelle : le client saisit le mot de passe de son compte dans le
// dialogue, il est VÉRIFIÉ (ré-authentification Supabase Auth en
// réel) AVANT l'appel à la RPC demander_suppression_compte — mot de
// passe faux → erreur dans le dialogue, AUCUN appel RPC, le compte
// ne change pas d'état. La rétractation (annulation) ne demande
// toujours PAS le mot de passe.
//
//  A. Statique : signature provider, ordre vérification -> RPC dans
//     real.ts, garde démo, dialogue partagé (champ password, erreur
//     en place), les deux points d'entrée branchés, clés i18n.
//  B. Comportement (fournisseur DÉMO) : mot de passe vide/blanc
//     refusé SANS changement d'état ; mot de passe saisi -> demande
//     posée ; annulation sans mot de passe -> restauration.
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
/** Corps d'une méthode : du marqueur de départ au prochain « \n  async » ou « \n  private ». */
function corpsMethode(src, marqueur) {
  const debut = src.indexOf(marqueur);
  if (debut < 0) return "";
  const reste = src.slice(debut + marqueur.length);
  const fin = reste.search(/\n  (async|private|public) [a-zA-Z]/);
  return fin < 0 ? reste : reste.slice(0, fin);
}

(async () => {
  console.log("== A. Statique : provider, ordre vérification -> RPC, dialogue, i18n ==");
  const provider = lire("lib/data/provider.ts");
  check("provider : signature demanderSuppressionCompte(motDePasse: string)",
    provider.includes("demanderSuppressionCompte(motDePasse: string): Promise<Profil>;"));
  check("provider : annulerSuppressionCompte SANS mot de passe (inchangée)",
    provider.includes("annulerSuppressionCompte(): Promise<Profil>;"));

  const real = lire("lib/data/real.ts");
  const corpsReel = corpsMethode(real, "async demanderSuppressionCompte(motDePasse: string)");
  check("real : méthode de demande présente", corpsReel.length > 0);
  check("real : ré-authentification signInWithPassword (Supabase Auth)",
    corpsReel.includes("auth.signInWithPassword"));
  check("real : vérification faite avec l'e-mail de la session",
    corpsReel.includes("email: session.email"));
  check("real : mot de passe faux -> ERR_MOT_DE_PASSE_INCORRECT",
    corpsReel.includes('err("ERR_MOT_DE_PASSE_INCORRECT")'));
  const idxVerif = corpsReel.indexOf("signInWithPassword");
  const idxRpc = corpsReel.indexOf('rpc("demander_suppression_compte")');
  check("real : ORDRE vérification AVANT l'appel RPC",
    idxVerif >= 0 && idxRpc > idxVerif, `verif=${idxVerif} rpc=${idxRpc}`);
  check("real : RPC demander_suppression_compte inchangée",
    idxRpc >= 0);

  const demo = lire("lib/data/demo.ts");
  const corpsDemo = corpsMethode(demo, "async demanderSuppressionCompte(motDePasse: string)");
  check("demo : méthode de demande avec mot de passe", corpsDemo.length > 0);
  check("demo : mot de passe vide refusé (ERR_MOT_DE_PASSE_INCORRECT)",
    corpsDemo.includes('err("ERR_MOT_DE_PASSE_INCORRECT")'));
  const idxGarde = corpsDemo.indexOf("ERR_MOT_DE_PASSE_INCORRECT");
  const idxEtat = corpsDemo.indexOf("suppression_demandee_le = maintenant");
  check("demo : ORDRE garde mot de passe AVANT tout changement d'état",
    idxGarde >= 0 && idxEtat > idxGarde, `garde=${idxGarde} etat=${idxEtat}`);

  const dialogue = lire("components/SuppressionCompteDialog.tsx");
  check("dialogue : champ mot de passe (type=password)",
    dialogue.includes('type="password"'));
  check("dialogue : autoComplete current-password",
    dialogue.includes('autoComplete="current-password"'));
  check("dialogue : appelle le provider avec le mot de passe saisi",
    dialogue.includes("demanderSuppressionCompte(motDePasse)"));
  check("dialogue : erreur mot de passe affichée DANS le dialogue",
    dialogue.includes("ERR_MOT_DE_PASSE_INCORRECT") && dialogue.includes("setErreurMdp"));
  check("dialogue : confirmation impossible sans mot de passe",
    dialogue.includes("disabled={enCours || !motDePasse}"));

  for (const page of ["app/[locale]/parametres/page.tsx", "app/[locale]/abonnement/page.tsx"]) {
    const src = lire(page);
    check(`${page} : dialogue partagé monté pour la suppression`,
      src.includes("SuppressionCompteDialog") && src.includes("aConfirmerSuppression"));
    check(`${page} : AUCUN appel direct sans mot de passe`,
      !src.includes("demanderSuppressionCompte("));
  }

  const fr = JSON.parse(lire("messages/fr.json"));
  const en = JSON.parse(lire("messages/en.json"));
  for (const cle of ["deletionPasswordText", "deletionPasswordLabel"]) {
    check(`v15 FR : ${cle}`, typeof fr.v15?.[cle] === "string" && fr.v15[cle].length > 0);
    check(`v15 EN : ${cle}`, typeof en.v15?.[cle] === "string" && en.v15[cle].length > 0);
    check(`v15 : ${cle} réellement traduite`, fr.v15?.[cle] !== en.v15?.[cle]);
  }
  check("v15.errors FR : ERR_MOT_DE_PASSE_INCORRECT",
    typeof fr.v15?.errors?.ERR_MOT_DE_PASSE_INCORRECT === "string" &&
    fr.v15.errors.ERR_MOT_DE_PASSE_INCORRECT.length > 0);
  check("v15.errors EN : ERR_MOT_DE_PASSE_INCORRECT",
    typeof en.v15?.errors?.ERR_MOT_DE_PASSE_INCORRECT === "string" &&
    en.v15.errors.ERR_MOT_DE_PASSE_INCORRECT.length > 0);

  console.log("== B. Comportement démo : refus sans mot de passe, aucun changement d'état ==");
  const p = new DemoProvider();
  try { await p.signOut(); } catch { /* pas de session */ }
  await p.signIn(CLIENT_EMAIL, "motdepasse");
  const profil0 = await p.getProfil();
  check("client démo connecté, aucune suppression en cours",
    !!profil0 && !profil0.suppression_demandee_le);
  const abo0 = await p.getAbonnement();
  const statut0 = abo0.statut;

  const eVide = await attendErreur(p.demanderSuppressionCompte(""));
  check("mot de passe VIDE refusé (ERR_MOT_DE_PASSE_INCORRECT)",
    eVide.levee && eVide.code === "ERR_MOT_DE_PASSE_INCORRECT", JSON.stringify(eVide));
  const eBlanc = await attendErreur(p.demanderSuppressionCompte("   "));
  check("mot de passe BLANC refusé (ERR_MOT_DE_PASSE_INCORRECT)",
    eBlanc.levee && eBlanc.code === "ERR_MOT_DE_PASSE_INCORRECT", JSON.stringify(eBlanc));

  const profilApresRefus = await p.getProfil();
  check("après refus : AUCUNE demande posée",
    !profilApresRefus.suppression_demandee_le);
  const aboApresRefus = await p.getAbonnement();
  check("après refus : abonnement inchangé (pas de lecture seule)",
    aboApresRefus.statut === statut0, aboApresRefus.statut);

  const profDemande = await p.demanderSuppressionCompte("mot-de-passe-demo");
  check("mot de passe saisi : demande posée",
    !!profDemande.suppression_demandee_le);
  const abo1 = await p.getAbonnement();
  check("demande posée : lecture seule immédiate (flux v1.5 inchangé)",
    abo1.statut === "lecture_seule", abo1.statut);

  const profAnnule = await p.annulerSuppressionCompte();
  check("rétractation SANS mot de passe : demande effacée",
    !profAnnule.suppression_demandee_le);
  const abo2 = await p.getAbonnement();
  check("rétractation : abonnement restauré",
    abo2.statut === statut0, abo2.statut);

  console.log(`\nRenfort suppression + mot de passe : ${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => {
  console.error("Erreur inattendue du test :", e);
  process.exit(1);
});

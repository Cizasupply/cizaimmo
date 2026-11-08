// Test « Guide d'utilisation joint à la bienvenue » (2026-11-08) —
// le guide PDF validé par le fondateur (v3 FR + traduction EN
// fidèle) est joint EN PLUS du contrat, dans la langue du compte :
// - propriétaire : e-mail de bienvenue (option C) -> [contrat
//   propriétaire, guide] ;
// - gestionnaire : e-mail de décision (v1.3) -> [contrat
//   gestionnaire, guide] ;
// - repli NON BLOQUANT : guide illisible -> l'e-mail part avec le
//   contrat seul, l'approbation n'en dépend jamais ;
// - page « Mon contrat » : lien de téléchargement du guide
//   (propriétaires ET gestionnaires), langue de l'interface ;
// - fichiers : public/guides/*.pdf présents, %PDF, poids sains,
//   identiques aux fichiers finaux validés du dossier du goal.
// Fournisseur démo. localStorage simulé en mémoire ; fetch stubé
// pour servir les fichiers statiques de public/guides/ depuis le
// disque (comme le ferait le serveur de l'app).
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
const GOAL_FILES = "/home/hatch/workspace/goals/lancer-cizaimmo-en-saas/files";

// fetch stubé : les /guides/*.pdf sont servis depuis public/guides/
// (miroir du serveur statique) ; tout le reste répond 404 propre.
const fetchReel = globalThis.fetch;
function installerFetchGuides() {
  globalThis.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/guides/")) {
      const nom = u.split("/").pop();
      try {
        const buf = fs.readFileSync(path.join(RACINE, "public", "guides", nom));
        return {
          ok: true,
          arrayBuffer: async () =>
            buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
        };
      } catch {
        return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
      }
    }
    return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
  };
}
function installerFetchEnPanne() {
  globalThis.fetch = async () => {
    throw new Error("réseau simulé en panne");
  };
}

const { DemoProvider } = require(`${BUILD}/data/demo.js`);
const { SUPER_ADMIN_DEMO_EMAIL } = require(`${BUILD}/data/demo-seed.js`);
const GUIDE = require(`${BUILD}/guide.js`);

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}
function lire(rel) {
  return fs.readFileSync(path.join(RACINE, rel), "utf8");
}
function estPdfBase64(b64) {
  return (
    typeof b64 === "string" &&
    Buffer.from(b64, "base64").toString("latin1").startsWith("%PDF")
  );
}

(async () => {
  console.log("== Fichiers du guide : présence, format, poids ==");
  for (const langue of ["fr", "en"]) {
    const nom = `cizaimmo-guide-utilisation-${langue}.pdf`;
    const cheminPublic = path.join(RACINE, "public", "guides", nom);
    const contenu = fs.readFileSync(cheminPublic);
    check(`public/guides/${nom} : vrai PDF`, contenu.toString("latin1").startsWith("%PDF"));
    check(`public/guides/${nom} : poids sain (40–300 Ko)`,
      contenu.length > 40000 && contenu.length < 300000, `${contenu.length} octets`);
    const finalGoal = fs.readFileSync(path.join(GOAL_FILES, nom));
    check(`public/guides/${nom} : identique au fichier final validé`,
      contenu.equals(finalGoal));
  }

  console.log("== Helper lib/guide.ts : noms, chemins, chargement ==");
  check("nom de fichier FR", GUIDE.nomFichierGuide("fr") === "cizaimmo-guide-utilisation-fr.pdf");
  check("nom de fichier EN", GUIDE.nomFichierGuide("en") === "cizaimmo-guide-utilisation-en.pdf");
  check("chemin public EN", GUIDE.cheminGuide("en") === "/guides/cizaimmo-guide-utilisation-en.pdf");
  installerFetchGuides();
  const guideFr = await GUIDE.chargerGuidePdf("fr");
  check("chargement FR : pièce jointe nommée + PDF",
    !!guideFr && guideFr.nom === "cizaimmo-guide-utilisation-fr.pdf" && estPdfBase64(guideFr.contenuBase64));
  const avecGuide = await GUIDE.piecesJointesAvecGuide(
    [{ nom: "contrat.pdf", contenuBase64: "AAAA" }], "en"
  );
  check("ajout au contrat : ordre [contrat, guide EN]",
    Array.isArray(avecGuide) && avecGuide.length === 2 &&
    avecGuide[0].nom === "contrat.pdf" &&
    avecGuide[1].nom === "cizaimmo-guide-utilisation-en.pdf");
  installerFetchEnPanne();
  const sansGuide = await GUIDE.chargerGuidePdf("fr");
  check("repli : fetch en panne -> guide null (jamais d'exception)", sansGuide === null);
  const piecesRepli = await GUIDE.piecesJointesAvecGuide(
    [{ nom: "contrat.pdf", contenuBase64: "AAAA" }], "fr"
  );
  check("repli : la liste d'origine est retournée telle quelle",
    Array.isArray(piecesRepli) && piecesRepli.length === 1 && piecesRepli[0].nom === "contrat.pdf");
  const aucune = await GUIDE.piecesJointesAvecGuide(undefined, "fr");
  check("repli : aucune pièce + guide illisible -> undefined", aucune === undefined);
  globalThis.fetch = fetchReel;

  console.log("== Statique : câblage des deux flux + page contrat ==");
  for (const rel of ["lib/data/real.ts", "lib/data/demo.ts"]) {
    const src = lire(rel);
    const appels = (src.match(/piecesJointesAvecGuide\(/g) || []).length;
    check(`${rel} : guide joint aux DEUX flux (décision + bienvenue)`,
      appels >= 2 && src.includes('from "../guide"'), `${appels} appels`);
  }
  const pageContrat = lire("app/[locale]/contrat/page.tsx");
  check("page /contrat : lien guide présent pour les deux rôles",
    (pageContrat.match(/LienGuideUtilisation/g) || []).length >= 3 &&
    pageContrat.includes("SectionContratProprietaire"));
  check("composant lien : chemin selon la langue de l'interface",
    lire("components/LienGuideUtilisation.tsx").includes("cheminGuide") &&
    lire("components/LienGuideUtilisation.tsx").includes("guideDownload"));
  const fr = JSON.parse(lire("messages/fr.json"));
  const en = JSON.parse(lire("messages/en.json"));
  check("i18n : dossier.guideDownload FR + EN",
    fr.dossier.guideDownload === "Guide d'utilisation (PDF)" &&
    en.dossier.guideDownload === "User guide (PDF)");

  console.log("== Flux démo : approbations avec le guide en pièce jointe ==");
  installerFetchGuides();
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
  async function inscrireEtApprouver(donnees) {
    await p.signOut();
    await p.signUp(donnees);
    const profil = await p.getProfil();
    await connecter(SUPER_ADMIN_DEMO_EMAIL);
    await p.enregistrerChecklistDossier(profil.id, {
      photo_verifiee: true, piece_coherente: true,
      infos_verifiees: true, antifraude_examinee: true,
    });
    emails.length = 0;
    await p.approuverCompte(profil.id);
    return profil;
  }

  // 1) Propriétaire FR : bienvenue = [contrat propriétaire, guide FR].
  const proprio = await inscrireEtApprouver({
    nom: "Propriétaire Guide", email: "proprio.guide@exemple.com", motDePasse: "motdepasse123",
    pays: "Burundi", devisePrincipale: "BIF", langue: "fr", paysIp: "BI",
    telephone: "+257 79 33 33 33", intention: "proprietaire",
  });
  const mailProprio = emails.find((m) => m.destinataire === "proprio.guide@exemple.com");
  check("propriétaire FR : bienvenue avec 2 pièces jointes",
    !!mailProprio && Array.isArray(mailProprio.piecesJointes) &&
    mailProprio.piecesJointes.length === 2,
    mailProprio && JSON.stringify((mailProprio.piecesJointes || []).map((x) => x.nom)));
  check("propriétaire FR : [contrat propriétaire, guide FR], guide = vrai PDF",
    !!mailProprio &&
    mailProprio.piecesJointes[0].nom === `contrat-proprietaire-${proprio.display_id}.pdf` &&
    mailProprio.piecesJointes[1].nom === "cizaimmo-guide-utilisation-fr.pdf" &&
    estPdfBase64(mailProprio.piecesJointes[1].contenuBase64));

  // 2) Gestionnaire EN : décision = [contrat gestionnaire, guide EN].
  const gest = await inscrireEtApprouver({
    nom: "Manager Guide", email: "manager.guide@exemple.com", motDePasse: "motdepasse123",
    pays: "Canada", devisePrincipale: "CAD", langue: "en", paysIp: "CA",
    telephone: "+1 514 000 0000", intention: "gestionnaire",
  });
  const mailGest = emails.find((m) => m.destinataire === "manager.guide@exemple.com");
  check("gestionnaire EN : décision avec 2 pièces jointes",
    !!mailGest && Array.isArray(mailGest.piecesJointes) &&
    mailGest.piecesJointes.length === 2,
    mailGest && JSON.stringify((mailGest.piecesJointes || []).map((x) => x.nom)));
  check("gestionnaire EN : [contrat gestionnaire, guide EN], guide = vrai PDF",
    !!mailGest &&
    mailGest.piecesJointes[0].nom === `contrat-gestionnaire-${gest.display_id}.pdf` &&
    mailGest.piecesJointes[1].nom === "cizaimmo-guide-utilisation-en.pdf" &&
    estPdfBase64(mailGest.piecesJointes[1].contenuBase64));

  // 3) Repli : guide illisible -> la bienvenue part avec le contrat seul.
  installerFetchEnPanne();
  const proprio2 = await inscrireEtApprouver({
    nom: "Propriétaire Repli", email: "proprio.repli@exemple.com", motDePasse: "motdepasse123",
    pays: "Burundi", devisePrincipale: "BIF", langue: "fr", paysIp: "BI",
    telephone: "+257 79 44 44 44", intention: "proprietaire",
  });
  const mailRepli = emails.find((m) => m.destinataire === "proprio.repli@exemple.com");
  check("repli : bienvenue envoyée avec le contrat seul (non bloquant)",
    !!mailRepli && Array.isArray(mailRepli.piecesJointes) &&
    mailRepli.piecesJointes.length === 1 &&
    mailRepli.piecesJointes[0].nom === `contrat-proprietaire-${proprio2.display_id}.pdf`,
    mailRepli && JSON.stringify((mailRepli.piecesJointes || []).map((x) => x.nom)));
  globalThis.fetch = fetchReel;

  console.log(`\nRésultat : ${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => {
  console.error("ERREUR FATALE", e);
  process.exit(1);
});

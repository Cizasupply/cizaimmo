// Test « Guide employé branché » (2026-11-08, branchement validé
// par le fondateur — « Les deux » emplacements, comme le guide
// client) :
// - pièce jointe à l'e-mail de mise à disposition du contrat
//   employé PRÉPARÉ par le Super Admin : [contrat employé, guide
//   employé], dans la langue du compte de l'employé ;
// - repli NON BLOQUANT : guide illisible -> l'e-mail part avec le
//   contrat seul, la préparation n'en dépend jamais ;
// - page console « Mon dossier employé » : lien de téléchargement
//   du guide (composant LienGuideEmploye), langue de l'interface ;
// - fichiers : public/guides/cizaimmo-guide-employe-*.pdf présents,
//   %PDF, poids sains, identiques aux fichiers finaux validés du
//   dossier du goal.
// Fournisseur démo pour le flux fonctionnel. localStorage simulé
// en mémoire ; fetch stubé pour servir les fichiers statiques de
// public/guides/ depuis le disque (comme le ferait le serveur de
// l'app).
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

const PARAMS = {
  voie: "travail", type: "CDI", duree: null, montant: 500000,
  devise: "BIF",
  modalites_paiement: "Virement bancaire, au plus tard le 5 du mois suivant.",
  lieu: "Bujumbura, Burundi (bureau de l'Employeur), avec déplacements possibles dans le pays",
  horaires: "Du lundi au vendredi, de 8 h à 17 h",
  date_debut: "2026-11-09", periode_essai: "trois (3) mois",
};

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
  console.log("== Fichiers du guide employé : présence, format, poids ==");
  for (const langue of ["fr", "en"]) {
    const nom = `cizaimmo-guide-employe-${langue}.pdf`;
    const cheminPublic = path.join(RACINE, "public", "guides", nom);
    const contenu = fs.readFileSync(cheminPublic);
    check(`public/guides/${nom} : vrai PDF`, contenu.toString("latin1").startsWith("%PDF"));
    check(`public/guides/${nom} : poids sain (40–300 Ko)`,
      contenu.length > 40000 && contenu.length < 300000, `${contenu.length} octets`);
    const finalGoal = fs.readFileSync(path.join(GOAL_FILES, nom));
    check(`public/guides/${nom} : identique au fichier final validé`,
      contenu.equals(finalGoal));
  }

  console.log("== Helper lib/guide.ts : noms, chemins, chargement, repli ==");
  check("nom de fichier FR", GUIDE.nomFichierGuideEmploye("fr") === "cizaimmo-guide-employe-fr.pdf");
  check("nom de fichier EN", GUIDE.nomFichierGuideEmploye("en") === "cizaimmo-guide-employe-en.pdf");
  check("chemin public EN", GUIDE.cheminGuideEmploye("en") === "/guides/cizaimmo-guide-employe-en.pdf");
  check("guide client inchangé (noms)", GUIDE.nomFichierGuide("fr") === "cizaimmo-guide-utilisation-fr.pdf");
  installerFetchGuides();
  const guideFr = await GUIDE.chargerGuideEmployePdf("fr");
  check("chargement FR : pièce jointe nommée + PDF",
    !!guideFr && guideFr.nom === "cizaimmo-guide-employe-fr.pdf" && estPdfBase64(guideFr.contenuBase64));
  const avecGuide = await GUIDE.piecesJointesAvecGuideEmploye(
    [{ nom: "contrat-employe.pdf", contenuBase64: "AAAA" }], "en"
  );
  check("ajout au contrat : ordre [contrat, guide employé EN]",
    Array.isArray(avecGuide) && avecGuide.length === 2 &&
    avecGuide[0].nom === "contrat-employe.pdf" &&
    avecGuide[1].nom === "cizaimmo-guide-employe-en.pdf");
  installerFetchEnPanne();
  const sansGuide = await GUIDE.chargerGuideEmployePdf("fr");
  check("repli : fetch en panne -> guide null (jamais d'exception)", sansGuide === null);
  const piecesRepli = await GUIDE.piecesJointesAvecGuideEmploye(
    [{ nom: "contrat-employe.pdf", contenuBase64: "AAAA" }], "fr"
  );
  check("repli : la liste d'origine est retournée telle quelle",
    Array.isArray(piecesRepli) && piecesRepli.length === 1 && piecesRepli[0].nom === "contrat-employe.pdf");
  const aucune = await GUIDE.piecesJointesAvecGuideEmploye(undefined, "fr");
  check("repli : aucune pièce + guide illisible -> undefined", aucune === undefined);
  globalThis.fetch = fetchReel;

  console.log("== Statique : câblage des deux fournisseurs + page Mon dossier employé ==");
  for (const rel of ["lib/data/real.ts", "lib/data/demo.ts"]) {
    const src = lire(rel);
    const debut = src.indexOf("async preparerContratEmploye(");
    const fin = src.indexOf("async genererContratEmploye(", debut);
    const corps = debut >= 0 && fin > debut ? src.slice(debut, fin) : "";
    check(`${rel} : guide employé joint DANS preparerContratEmploye`,
      corps.includes("piecesJointesAvecGuideEmploye("),
      `indices ${debut}..${fin}`);
    check(`${rel} : import du helper employé`,
      src.includes("piecesJointesAvecGuideEmploye") && src.includes('from "../guide"'));
  }
  check("démo : la langue du membre promu vient du compte lié (pas de « fr » codé en dur)",
    lire("lib/data/demo.ts").includes("langueLiee") &&
    lire("lib/data/demo.ts").includes("clientLie?.langue"));
  const pageMonDossier = lire("app/[locale]/console/mon-dossier/page.tsx");
  check("page Mon dossier employé : lien guide présent (composant rendu)",
    pageMonDossier.includes("LienGuideEmploye"));
  const compo = lire("components/LienGuideEmploye.tsx");
  check("composant lien : chemin selon la langue de l'interface + clé i18n",
    compo.includes("cheminGuideEmploye") &&
    compo.includes('useTranslations("dossierEmploye")') &&
    compo.includes('t("guideDownload")'));
  const fr = JSON.parse(lire("messages/fr.json"));
  const en = JSON.parse(lire("messages/en.json"));
  check("i18n : dossierEmploye.guideDownload FR + EN",
    fr.dossierEmploye.guideDownload === "Guide employé (PDF)" &&
    en.dossierEmploye.guideDownload === "Employee guide (PDF)");

  console.log("== Flux démo : contrat préparé -> e-mail [contrat, guide employé] ==");
  // Un contexte FRAIS par scénario (base re-seedée) : le harnais
  // démo n'a qu'un profil local et la résolution d'un membre promu
  // y est pensée pour un employé à la fois (patron du test pack
  // employé) — empiler plusieurs promus dans la même base
  // mélangerait leurs résolutions.
  function nouveauContexte() {
    store.clear();
    const p = new DemoProvider();
    const emails = [];
    p.envoyerEmailAlerteFn = async (m) => {
      emails.push(m);
      return { envoye: true };
    };
    return { p, emails };
  }
  async function connecter(p, email, mdp = "motdepasse") {
    try { await p.signOut(); } catch { /* pas de session */ }
    await p.signIn(email, mdp);
  }
  async function inscrireEtPromouvoir(p, donnees) {
    await p.signOut();
    await p.signUp(donnees);
    await connecter(p, SUPER_ADMIN_DEMO_EMAIL);
    await p.promouvoirAdmin(donnees.email);
    const membres = await p.listerEquipeAdmins();
    const membre = membres.find((m) => m.email === donnees.email);
    const pack = await p.getPackEmploye(membre.id);
    return { membre, displayId: pack.display_id };
  }

  // 1) Employé FR : mise à disposition = [contrat employé, guide employé FR].
  installerFetchGuides();
  {
    const { p, emails } = nouveauContexte();
    const empFr = await inscrireEtPromouvoir(p, {
      nom: "Employée Guide", email: "employe.guide@exemple.com", motDePasse: "motdepasse123",
      pays: "Burundi", devisePrincipale: "BIF", langue: "fr", paysIp: "BI",
      telephone: "+257 79 55 55 55", intention: "proprietaire",
    });
    emails.length = 0;
    await p.preparerContratEmploye(empFr.membre.id, PARAMS);
    const mailFr = emails.find((m) => m.destinataire === "employe.guide@exemple.com");
    check("employé FR : mise à disposition avec 2 pièces jointes",
      !!mailFr && Array.isArray(mailFr.piecesJointes) &&
      mailFr.piecesJointes.length === 2,
      mailFr && JSON.stringify((mailFr.piecesJointes || []).map((x) => x.nom)));
    check("employé FR : [contrat employé, guide employé FR], guide = vrai PDF",
      !!mailFr &&
      mailFr.piecesJointes[0].nom === `contrat-employe-${empFr.displayId}.pdf` &&
      mailFr.piecesJointes[1].nom === "cizaimmo-guide-employe-fr.pdf" &&
      estPdfBase64(mailFr.piecesJointes[1].contenuBase64));
  }

  // 2) Employé EN : le guide joint suit la langue du compte (EN).
  {
    const { p, emails } = nouveauContexte();
    const empEn = await inscrireEtPromouvoir(p, {
      nom: "Employee Guide", email: "employee.guide@exemple.com", motDePasse: "motdepasse123",
      pays: "Canada", devisePrincipale: "CAD", langue: "en", paysIp: "CA",
      telephone: "+1 514 000 1111", intention: "proprietaire",
    });
    emails.length = 0;
    await p.preparerContratEmploye(empEn.membre.id, PARAMS);
    const mailEn = emails.find((m) => m.destinataire === "employee.guide@exemple.com");
    check("employé EN : [contrat employé, guide employé EN]",
      !!mailEn && Array.isArray(mailEn.piecesJointes) &&
      mailEn.piecesJointes.length === 2 &&
      mailEn.piecesJointes[0].nom === `contrat-employe-${empEn.displayId}.pdf` &&
      mailEn.piecesJointes[1].nom === "cizaimmo-guide-employe-en.pdf" &&
      estPdfBase64(mailEn.piecesJointes[1].contenuBase64),
      mailEn && JSON.stringify((mailEn.piecesJointes || []).map((x) => x.nom)));
  }

  // 3) Repli : guide illisible -> la mise à disposition part avec le contrat seul.
  installerFetchEnPanne();
  {
    const { p, emails } = nouveauContexte();
    const empRepli = await inscrireEtPromouvoir(p, {
      nom: "Employé Repli", email: "employe.repli@exemple.com", motDePasse: "motdepasse123",
      pays: "Burundi", devisePrincipale: "BIF", langue: "fr", paysIp: "BI",
      telephone: "+257 79 66 66 66", intention: "proprietaire",
    });
    emails.length = 0;
    await p.preparerContratEmploye(empRepli.membre.id, PARAMS);
    const mailRepli = emails.find((m) => m.destinataire === "employe.repli@exemple.com");
    check("repli : mise à disposition envoyée avec le contrat seul (non bloquant)",
      !!mailRepli && Array.isArray(mailRepli.piecesJointes) &&
      mailRepli.piecesJointes.length === 1 &&
      mailRepli.piecesJointes[0].nom === `contrat-employe-${empRepli.displayId}.pdf`,
      mailRepli && JSON.stringify((mailRepli.piecesJointes || []).map((x) => x.nom)));
  }
  globalThis.fetch = fetchReel;

  console.log(`\nRésultat : ${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => {
  console.error("ERREUR FATALE", e);
  process.exit(1);
});

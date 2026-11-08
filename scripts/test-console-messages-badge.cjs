// Test « Boîte de réception console + badge » (2026-11-07, demande du
// fondateur après un test RÉEL) : un message cliente (« Bonjour
// test », Kaneza) était bien arrivé dans le fil plateforme de son
// Dossier, mais RIEN ne le signalait dans la console — le dossier
// était NON assigné (admin_responsable_id NULL), donc invisible
// dans « Mes dossiers » (réservé aux assignés) et dans « Messages
// supervisés » (fils rattachement seulement).
//  A. Statique : méthodes provider (interface + réel + démo),
//     entrée « Messages » + pastille dans ConsoleShell, page boîte
//     de réception, bloc Vue d'ensemble, ancre #messages du Dossier,
//     clés i18n FR/EN.
//  B. Comportement (fournisseur DÉMO, miroir de la base) — LE cas
//     de régression : cliente NON assignée envoie « Bonjour test »
//     -> le compteur plateforme vaut 1 pour le Super Admin ET pour
//     un Admin non responsable ; la conversation apparaît dans la
//     boîte de réception avec non_lus = 1 et responsable NULL ; une
//     réponse plateforme ne gonfle pas le compteur ; l'ouverture du
//     fil façon Dossier (listerMessages + marquerLu) fait retomber
//     le compteur à 0 ; tri par dernier message décroissant.
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
  ADMIN_DEMO_EMAIL,
} = require(`${BUILD}/data/demo-seed.js`);

const CLIENT_EMAIL = "demo@cizaimmo.com";
const AUTRE_CLIENT_ID = "client-demo-2";

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
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log("== A. Statique : provider, console, pages, i18n ==");
  const provider = lire("lib/data/provider.ts");
  check("interface : listerConversationsPlateforme + compterMessagesPlateformeNonLus déclarées",
    provider.includes("listerConversationsPlateforme(): Promise<Conversation[]>") &&
    provider.includes("compterMessagesPlateformeNonLus(): Promise<number>"));
  const reel = lire("lib/data/real.ts");
  check("réel : les deux méthodes sont implémentées",
    reel.includes("async listerConversationsPlateforme()") &&
    reel.includes("async compterMessagesPlateformeNonLus()"));
  check("réel : comptage réservé aux messages du client (expediteur = proprietaire_id, lu_par_plateforme)",
    reel.includes("m.expediteur_id === l.proprietaire_id && !m.lu_par_plateforme"));
  check("réel : la boîte ne filtre PAS sur admin_responsable_id (assignés ou non)",
    reel.includes('.eq("type", "plateforme")') &&
    !/listerConversationsPlateforme[\s\S]{0,600}admin_responsable_id/.test(reel));
  const demo = lire("lib/data/demo.ts");
  check("démo : les deux méthodes sont implémentées (miroir)",
    demo.includes("async listerConversationsPlateforme()") &&
    demo.includes("async compterMessagesPlateformeNonLus()") &&
    demo.includes("m.expediteur_id === conv.proprietaire_id && !m.lu_par_plateforme"));

  const shell = lire("components/ConsoleShell.tsx");
  check("ConsoleShell : entrée « Messages » vers /console/messages",
    shell.includes('{ key: "messages", href: "/console/messages" }'));
  check("ConsoleShell : pastille compteur (compterMessagesPlateformeNonLus, affichée si > 0)",
    shell.includes("compterMessagesPlateformeNonLus()") &&
    shell.includes("nonLusMessages > 0"));

  const pageBoite = lire("app/[locale]/console/messages/page.tsx");
  check("page boîte de réception : liste TOUTES les conversations plateforme",
    pageBoite.includes("listerConversationsPlateforme()"));
  check("page boîte de réception : clic -> Dossier du client, ancre #messages",
    pageBoite.includes("/console/comptes/${c.proprietaire_id}#messages"));
  check("page boîte de réception : responsable ou « Non assigné », pastille de non-lus",
    pageBoite.includes("admin_responsable_nom") &&
    pageBoite.includes('t15("unassigned")') &&
    pageBoite.includes('t15("unread"'));

  const dossier = lire("app/[locale]/console/comptes/[id]/page.tsx");
  check("Dossier : la section du fil porte l'ancre id=\"messages\"",
    dossier.includes('<section id="messages"'));

  const accueil = lire("app/[locale]/console/page.tsx");
  check("Vue d'ensemble : bloc notification (listerConversationsPlateforme + titre + lien boîte)",
    accueil.includes("listerConversationsPlateforme()") &&
    accueil.includes('t("unreadMessagesTitle")') &&
    accueil.includes("/console/messages") &&
    accueil.includes('t("viewInbox")'));

  const fr = JSON.parse(lire("messages/fr.json"));
  const en = JSON.parse(lire("messages/en.json"));
  const cles = ["messages", "messagesTitle", "messagesSubtitle", "messagesEmpty",
    "unreadMessagesTitle", "unreadMessagesNone", "viewInbox"];
  check("i18n : les 7 clés console existent en FR ET en EN",
    cles.every((k) => typeof fr.console[k] === "string" && typeof en.console[k] === "string"),
    cles.filter((k) => !(k in fr.console) || !(k in en.console)).join(","));

  console.log("== B. Régression : message d'une cliente NON assignée ==");
  const p = new DemoProvider();
  async function connecter(email, mdp = "motdepasse") {
    try { await p.signOut(); } catch { /* pas de session */ }
    await p.signIn(email, mdp);
  }

  // La cliente principale démo démarre NON assignée (graine :
  // admin_responsable_id = null) — exactement le cas réel de Kaneza.
  await connecter(CLIENT_EMAIL);
  const conv = await p.getConversationPlateforme();
  check("précondition : le fil plateforme est créé SANS responsable (admin_responsable_id NULL)",
    conv.type === "plateforme" && conv.admin_responsable_id === null,
    JSON.stringify(conv.admin_responsable_id));
  await p.envoyerMessage(conv.id, "Bonjour test");

  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const totalSuper = await p.compterMessagesPlateformeNonLus();
  check("Super Admin : le compteur plateforme vaut 1 (message de la cliente non assignée)",
    totalSuper === 1, String(totalSuper));
  const boite = await p.listerConversationsPlateforme();
  const vue = boite.find((c) => c.id === conv.id);
  check("Super Admin : la conversation NON assignée apparaît dans la boîte de réception",
    !!vue, JSON.stringify(boite.map((c) => c.id)));
  check("boîte : non_lus = 1, responsable NULL, aperçu = « Bonjour test »",
    !!vue && vue.non_lus === 1 && vue.admin_responsable_id === null &&
    vue.dernier_message === "Bonjour test",
    JSON.stringify(vue && { n: vue.non_lus, r: vue.admin_responsable_id, d: vue.dernier_message }));

  await connecter(ADMIN_DEMO_EMAIL);
  const totalAdmin = await p.compterMessagesPlateformeNonLus();
  check("Admin NON responsable : le compteur vaut aussi 1 (l'assignation n'est pas une restriction)",
    totalAdmin === 1, String(totalAdmin));

  // Une réponse de la plateforme ne doit PAS gonfler le compteur.
  await p.envoyerMessage(conv.id, "Bonjour, bien reçu — on regarde.");
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const totalApresReponse = await p.compterMessagesPlateformeNonLus();
  check("réponse plateforme : le compteur reste à 1 (seuls les messages du client comptent)",
    totalApresReponse === 1, String(totalApresReponse));

  // Ouverture du fil façon Dossier : lecture + marquerLu -> 0.
  const comptes = await p.listerComptesPlateforme();
  const client = comptes.find((c) => c.email === CLIENT_EMAIL);
  const fil = await p.getConversationPlateforme(client.id);
  await p.listerMessages(fil.id);
  await p.marquerLu(fil.id);
  const totalApresLecture = await p.compterMessagesPlateformeNonLus();
  check("ouverture du fil dans le Dossier : le compteur retombe à 0",
    totalApresLecture === 0, String(totalApresLecture));
  const boiteApres = await p.listerConversationsPlateforme();
  const vueApres = boiteApres.find((c) => c.id === conv.id);
  check("boîte après lecture : non_lus de la conversation = 0",
    !!vueApres && (vueApres.non_lus ?? 0) === 0,
    JSON.stringify(vueApres && vueApres.non_lus));

  console.log("== C. Tri de la boîte + garde d'accès ==");
  // Fil vide d'un autre client créé AVANT le nouveau message de la
  // cliente principale : la boîte trie par dernier message, donc le
  // fil avec le message le plus récent passe devant le fil vide.
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const filVide = await p.getConversationPlateforme(AUTRE_CLIENT_ID);
  check("fil vide créé pour un second client (aperçu null, 0 non-lu)",
    !!filVide && filVide.dernier_message == null);
  await pause(10);
  await connecter(CLIENT_EMAIL);
  await p.envoyerMessage(conv.id, "Deuxième message");
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const boiteTriee = await p.listerConversationsPlateforme();
  check("tri : le fil au message le plus récent est en premier (devant le fil vide plus ancien)",
    boiteTriee.length >= 2 && boiteTriee[0].id === conv.id &&
    boiteTriee.some((c) => c.id === filVide.id),
    JSON.stringify(boiteTriee.map((c) => c.id)));
  const totalFinal = await p.compterMessagesPlateformeNonLus();
  check("compteur final : 1 (le deuxième message de la cliente)",
    totalFinal === 1, String(totalFinal));

  await connecter(CLIENT_EMAIL);
  const eClient = await attendErreur(p.listerConversationsPlateforme());
  check("garde : un client ne peut pas lire la boîte plateforme (ERR_ACCES_PLATEFORME)",
    eClient.levee && eClient.code === "ERR_ACCES_PLATEFORME", JSON.stringify(eClient));

  console.log(`\n=== Console Messages + badge : ${ok} OK, ${ko} KO ===`);
  process.exit(ko > 0 ? 1 : 0);
})().catch((e) => {
  console.error("ERREUR FATALE", e);
  process.exit(1);
});

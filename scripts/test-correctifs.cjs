// Test Correctifs 1 + 2 — lien locataire (spec §2, §14) et branchement
// de l'envoi e-mail des alertes (spec §10, critères 6/7).
// Harness compilé par scripts/run-tests.sh (TEST_BUILD_DIR) ou manuel :
//   npx tsc --outDir .test-build --module commonjs --target es2020 \
//     --esModuleInterop --skipLibCheck --moduleResolution node --rootDir lib \
//     lib/data/demo.ts lib/data/demo-seed.ts lib/data/types.ts \
//     lib/data/helpers.ts lib/data/provider.ts lib/email.ts \
//     lib/module4.ts lib/loyers.ts lib/format.ts lib/abonnement.ts \
//     lib/countries.ts lib/indivision.ts lib/whatsapp.ts lib/taux.ts
// Puis : node scripts/test-correctifs.cjs
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  },
};
globalThis.document = { cookie: "" };

// Harness compilé : TEST_BUILD_DIR (scripts/run-tests.sh) ou /tmp/m7test (manuel).
const BUILD = process.env.TEST_BUILD_DIR || "/tmp/m7test";

const { DemoProvider } = require(`${BUILD}/data/demo.js`);
const email = require(`${BUILD}/email.js`);

const CLE_DB = "cizaimmo-demo-db-v1";
const CLE_SESSION = "cizaimmo-demo-session-v1";

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}

/** Base démo neuve (seed) + session propriétaire. */
async function nouveauFournisseur() {
  store.delete(CLE_DB);
  store.delete(CLE_SESSION);
  const p = new DemoProvider();
  await p.signIn("demo@cizaimmo.com", "motdepasse");
  return p;
}

function lireDb() {
  return JSON.parse(store.get(CLE_DB));
}
function ecrireDb(db) {
  store.set(CLE_DB, JSON.stringify(db));
}

(async () => {
  // Sans configuration, envoyerEmailAlerte ne doit rien envoyer.
  delete process.env.EMAIL_API_URL;
  delete process.env.EMAIL_API_KEY;

  console.log("== Correctif 1 — lien locataire (spec §2, §14) ==");
  const p = await nouveauFournisseur();
  const locataires = await p.listerLocataires();
  const jeanClaude = locataires.find((l) => l.nom === "Jean-Claude Hakizimana");
  check("locataire de test présent dans la seed", Boolean(jeanClaude));
  const autresNoms = locataires
    .filter((l) => l.id !== jeanClaude.id)
    .map((l) => l.nom);

  // Jeton valide -> données du bon locataire uniquement.
  const lien = await p.genererLienLocataire(jeanClaude.id);
  check("lien généré : jeton + expiration 30 j + URL /locataire/<jeton>",
    Boolean(lien.token) && Boolean(lien.expireLe) && lien.url.endsWith(`/locataire/${lien.token}`),
    lien.url);
  const acces = await p.getLocataireParToken(lien.token);
  check("jeton valide -> accès retourné", acces !== null);
  check("bon locataire uniquement", acces?.locataire.id === jeanClaude.id);
  check("bail en cours présent (450 000 BIF)", acces?.bail !== null && acces?.bail.loyer_mensuel === 450000 && acces?.bail.devise === "BIF");
  check("caution du bail présente", acces?.bail?.caution === 450000);
  check("échéances du bail uniquement (oct. + nov. 2026)",
    acces?.echeances.length === 2 &&
    acces.echeances.every((e) => e.bail_id === acces.bail.id),
    `echeances=${acces?.echeances.length}`);
  check("reçus du locataire uniquement (2 reçus)",
    acces?.recus.length === 2 &&
    acces.recus.every((r) => r.locataire_id === jeanClaude.id),
    `recus=${acces?.recus.length}`);
  check("paiements des échéances du locataire uniquement",
    acces?.paiements.length === 2 &&
    acces.paiements.every((pay) => acces.echeances.some((e) => e.id === pay.echeance_id)),
    `paiements=${acces?.paiements.length}`);
  const texteAcces = JSON.stringify(acces);
  check("aucune donnée d'un autre locataire n'est retournée",
    autresNoms.every((nom) => !texteAcces.includes(nom)),
    autresNoms.filter((nom) => texteAcces.includes(nom)).join(", "));

  // Jeton expiré -> refus, sans aucune donnée.
  const dbExpire = lireDb();
  const idx = dbExpire.locataires.findIndex((l) => l.id === jeanClaude.id);
  dbExpire.locataires[idx].lien_expire_le = "2020-01-01T00:00:00.000Z";
  ecrireDb(dbExpire);
  check("jeton expiré -> refus (null)",
    (await p.getLocataireParToken(lien.token)) === null);

  // Jeton révoqué -> refus, sans aucune donnée.
  const lien2 = await p.genererLienLocataire(jeanClaude.id);
  check("nouveau lien généré après expiration", Boolean(lien2.token) && lien2.token !== lien.token);
  await p.revoquerLienLocataire(jeanClaude.id);
  check("jeton révoqué -> refus (null)",
    (await p.getLocataireParToken(lien2.token)) === null);

  // Jeton inconnu -> refus, sans aucune donnée.
  check("jeton inconnu -> refus (null)",
    (await p.getLocataireParToken("jeton-inexistant-0123456789abcdef")) === null);
  check("jeton vide -> refus (null)",
    (await p.getLocataireParToken("")) === null);

  console.log("== Correctif 2 — envoi e-mail des alertes (spec §10) ==");
  // Envoi réel sans configuration : rien ne part, statut non_configuré.
  const sansConfig = await email.envoyerEmailAlerte({
    destinataire: "test@exemple.bi",
    sujet: "Test",
    texte: "Test",
  });
  check("envoyerEmailAlerte sans configuration -> non_configuré, rien envoyé",
    sansConfig.envoye === false && sansConfig.raison === "non_configuré");

  // Fournisseur simulé (stub) : l'envoi est déclenché pour une alerte de
  // retard et le statut est persisté.
  const p2 = await nouveauFournisseur();
  const envoyes = [];
  p2.envoyerEmailAlerteFn = async (m) => {
    envoyes.push(m);
    return { envoye: true, raison: "ok" };
  };
  const alertes = await p2.genererAlertes();
  const retard = alertes.filter((a) => a.type === "loyer_en_retard");
  check("au moins une alerte de retard générée", retard.length >= 1, `retard=${retard.length}`);
  check("alerte de retard : e-mail envoyé (statut persisté)",
    retard.every((a) => a.email_statut === "envoye"),
    retard.map((a) => a.email_statut).join(","));
  check("e-mail adressé au propriétaire (demo@cizaimmo.com)",
    envoyes.length >= 1 && envoyes.every((m) => m.destinataire === "demo@cizaimmo.com"),
    `envoyes=${envoyes.length}`);
  check("e-mail porte le message de l'alerte",
    envoyes.some((m) => m.texte.includes("Loyer en retard")));
  const relues = await p2.listerAlertes();
  check("statut e-mail persisté en lecture (listerAlertes)",
    relues.filter((a) => a.type === "loyer_en_retard").every((a) => a.email_statut === "envoye"));

  // Idempotence : la régénération ne renvoie pas les mêmes alertes.
  const nbAvant = envoyes.length;
  await p2.genererAlertes();
  check("pas de renvoi à la régénération (dedup_key)", envoyes.length === nbAvant,
    `avant=${nbAvant} après=${envoyes.length}`);

  // Sans configuration (stub « non configuré ») : statut non_configuré,
  // rien n'est envoyé. Le stub simule le fournisseur : il reçoit la
  // demande mais ne transmet rien (comme le vrai envoyerEmailAlerte
  // sans EMAIL_API_URL / EMAIL_API_KEY — vérifié directement ci-dessus).
  const p3 = await nouveauFournisseur();
  p3.envoyerEmailAlerteFn = async () => {
    // Fournisseur non configuré : aucune transmission.
    return { envoye: false, raison: "non_configuré" };
  };
  const alertes3 = await p3.genererAlertes();
  const retard3 = alertes3.filter((a) => a.type === "loyer_en_retard");
  check("sans configuration : statut non_configuré",
    retard3.length >= 1 && retard3.every((a) => a.email_statut === "non_configuré"));
  check("sans configuration : l'alerte est quand même créée et affichée",
    retard3.length >= 1);

  // Canal e-mail coupé dans les Paramètres : « desactive », aucun envoi.
  const p4 = await nouveauFournisseur();
  const envoyes4 = [];
  p4.envoyerEmailAlerteFn = async (m) => {
    envoyes4.push(m);
    return { envoye: true, raison: "ok" };
  };
  await p4.sauvegarderPreferencesNotifications({ canal_email: false });
  const alertes4 = await p4.genererAlertes();
  const retard4 = alertes4.filter((a) => a.type === "loyer_en_retard");
  check("canal e-mail coupé : statut desactive",
    retard4.length >= 1 && retard4.every((a) => a.email_statut === "desactive"));
  check("canal e-mail coupé : aucun envoi tenté", envoyes4.length === 0,
    `envoyes=${envoyes4.length}`);

  // Type coupé dans les Paramètres : pas d'alerte, donc pas d'e-mail.
  const p5 = await nouveauFournisseur();
  const envoyes5 = [];
  p5.envoyerEmailAlerteFn = async (m) => {
    envoyes5.push(m);
    return { envoye: true, raison: "ok" };
  };
  await p5.sauvegarderPreferencesNotifications({ types_coupes: ["loyer_en_retard"] });
  const alertes5 = await p5.genererAlertes();
  check("type coupé : aucune alerte de retard créée",
    alertes5.filter((a) => a.type === "loyer_en_retard").length === 0);
  check("type coupé : aucun e-mail de retard envoyé",
    envoyes5.filter((m) => m.texte.includes("Loyer en retard")).length === 0);

  // Échec d'envoi : signalé (« echec »), sans bloquer la génération.
  const p6 = await nouveauFournisseur();
  p6.envoyerEmailAlerteFn = async () => ({
    envoye: false,
    raison: "echec",
    detail: "HTTP 500",
  });
  const alertes6 = await p6.genererAlertes();
  const retard6 = alertes6.filter((a) => a.type === "loyer_en_retard");
  check("échec d'envoi : statut echec persisté",
    retard6.length >= 1 && retard6.every((a) => a.email_statut === "echec"));
  check("échec d'envoi : les alertes sont quand même générées",
    alertes6.length >= 1);

  console.log(`\nCorrectifs : ${ok} OK, ${ko} KO`);
  process.exit(ko === 0 ? 0 : 1);
})();

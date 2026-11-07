// Test — Correctif e-mails (2026-11-07) :
// (a) middleware.ts : le matcher doit EXCLURE « auth », sinon next-intl
//     réécrit /auth/callback en /fr/auth/callback → 404 sur les liens de
//     confirmation d'inscription et de réinitialisation de mot de passe.
// (b) Gabarit e-mail premium centralisé (lib/email.ts) : bandeau marine
//     + filet or, bloc d'aide (contacts), avis de confidentialité FR/EN,
//     signature Ciza Group — appliqué à l'envoi réel (fetch stubé).
// Compilation préalable via scripts/run-tests.sh (TEST_BUILD_DIR).
const fs = require("fs");
const path = require("path");
const BUILD = process.env.TEST_BUILD_DIR || "/tmp/m7test";

const email = require(`${BUILD}/email.js`);

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}

const AVIS_FR = "Avis de confidentialité : ce courriel est confidentiel et destiné uniquement à la personne à laquelle il est adressé. Si vous l'avez reçu par erreur, veuillez le supprimer et nous en aviser à infos@cizagroup.com.";
const AVIS_EN = "Confidentiality notice: this email is confidential and intended solely for the addressee. If you received it in error, please delete it and notify us at infos@cizagroup.com.";
const COPYRIGHT_FR = "© 2026 CizaImmo — une division de Ciza Group · cizaimmo.com";

console.log("== (a) Middleware : le matcher exclut « auth » ==");
(() => {
  const source = fs.readFileSync(path.join(__dirname, "..", "middleware.ts"), "utf-8");
  const m = source.match(/matcher:\s*\[\s*"([^"]+)"/);
  check("matcher trouvé dans middleware.ts", Boolean(m));
  const motif = m ? m[1] : "";
  check("le matcher exclut « auth » (api|auth|_next…)", motif.includes("api|auth|_next"), motif);

  // Simulation du matcher : le middleware s'applique si le chemin
  // (sans le « / » initial) ne commence par AUCUN préfixe exclu et ne
  // contient pas d'extension de fichier.
  const dedans = motif.match(/\(\?!([^)]*)\)/);
  const tokens = dedans ? dedans[1].split("|") : [];
  const exclu = (chemin) => {
    const nu = chemin.replace(/^\//, "");
    return tokens.some((t) =>
      t.includes("\\.") ? /.*\..*/.test(nu) : nu.startsWith(t)
    );
  };
  check("/auth/callback : middleware NON appliqué (plus de 404)", exclu("/auth/callback"));
  check("/api/taux/publics : middleware non appliqué", exclu("/api/taux/publics"));
  check("/dashboard : middleware appliqué", !exclu("/dashboard"));
  check("/fr/connexion : middleware appliqué", !exclu("/fr/connexion"));
  check("/favicon.ico : middleware non appliqué (fichier)", exclu("/favicon.ico"));
})();

console.log("== (b) Gabarit HTML — FR ==");
(() => {
  const html = email.gabaritEmailHtml("<p>Corps métier de test</p>", "fr");
  check("bandeau marine #1B2A4A", html.includes("#1B2A4A"));
  check("filet or #D4AF37", html.includes("#D4AF37"));
  check("marque « CizaImmo » dans l'en-tête", html.includes("CizaImmo"));
  check("slogan présent", html.includes("Vos biens, gérés simplement."));
  check("corps métier inchangé, enveloppé", html.includes("<p>Corps métier de test</p>"));
  check("bloc d'aide FR (contacts)", html.includes("Un problème de connexion ou une question ?"));
  check("contact infos@cizagroup.com", html.includes("infos@cizagroup.com"));
  check("WhatsApp +1 514 502 9503", html.includes("+1 514 502 9503"));
  check("avis de confidentialité FR exact", html.includes(AVIS_FR));
  check("pas d'avis EN en mode FR seul", !html.includes(AVIS_EN));
  check("ligne © Ciza Group", html.includes(COPYRIGHT_FR));
})();

console.log("== (b) Gabarit HTML — EN et bilingue ==");
(() => {
  const htmlEn = email.gabaritEmailHtml("<p>Body</p>", "en");
  check("avis de confidentialité EN exact", htmlEn.includes(AVIS_EN));
  check("bloc d'aide EN", htmlEn.includes("Having trouble signing in, or a question?"));
  check("pas d'avis FR en mode EN seul", !htmlEn.includes(AVIS_FR));
  const htmlBi = email.gabaritEmailHtml("<p>Corps</p>");
  check("bilingue (langue inconnue) : avis FR présent", htmlBi.includes(AVIS_FR));
  check("bilingue (langue inconnue) : avis EN présent", htmlBi.includes(AVIS_EN));
  check("bilingue : aide FR + EN", htmlBi.includes("Un problème de connexion") && htmlBi.includes("Having trouble signing in"));
})();

console.log("== (b) Gabarit texte — cohérent avec le HTML ==");
(() => {
  const texte = email.gabaritEmailTexte("Loyer en retard : 450 000 BIF.", "fr");
  check("texte métier conservé en tête", texte.startsWith("Loyer en retard : 450 000 BIF."));
  check("aide FR dans la version texte", texte.includes("Un problème de connexion ou une question ?"));
  check("avis FR dans la version texte", texte.includes(AVIS_FR));
  check("© dans la version texte", texte.includes(COPYRIGHT_FR));
})();

console.log("== (b) Envoi réel : le gabarit est appliqué au point d'envoi ==");
(async () => {
  const ancienneUrl = process.env.EMAIL_API_URL;
  const ancienneCle = process.env.EMAIL_API_KEY;
  const ancienFetch = globalThis.fetch;
  process.env.EMAIL_API_URL = "https://fournisseur.test/emails";
  process.env.EMAIL_API_KEY = "cle-de-test";
  let charge = null;
  globalThis.fetch = async (url, options) => {
    charge = { url, corps: JSON.parse(options.body) };
    return { ok: true, status: 200 };
  };
  try {
    const res = await email.envoyerEmailAlerte({
      destinataire: "proprio@exemple.com",
      sujet: "CizaImmo — loyer en retard",
      texte: "Le loyer de novembre est en retard.",
      langue: "fr",
    });
    check("envoi retourné « ok »", res.raison === "ok", JSON.stringify(res));
    check("le fournisseur reçoit un HTML", Boolean(charge && charge.corps.html));
    check("HTML envoyé : bandeau marine + filet or",
      charge.corps.html.includes("#1B2A4A") && charge.corps.html.includes("#D4AF37"));
    check("HTML envoyé : avis de confidentialité FR", charge.corps.html.includes(AVIS_FR));
    check("HTML envoyé : corps métier présent", charge.corps.html.includes("Le loyer de novembre est en retard."));
    check("texte envoyé : avis + contacts aussi",
      charge.corps.text.includes(AVIS_FR) && charge.corps.text.includes("+1 514 502 9503"));
    check("sujet inchangé (pas de gabarit sur le sujet)", charge.corps.subject === "CizaImmo — loyer en retard");
  } finally {
    globalThis.fetch = ancienFetch;
    if (ancienneUrl === undefined) delete process.env.EMAIL_API_URL; else process.env.EMAIL_API_URL = ancienneUrl;
    if (ancienneCle === undefined) delete process.env.EMAIL_API_KEY; else process.env.EMAIL_API_KEY = ancienneCle;
  }

  console.log("");
  console.log(`Gabarit e-mail + middleware : ${ok} OK, ${ko} KO`);
  process.exit(ko > 0 ? 1 : 0);
})();

// Test Extension v1.2 — Admin / Super Admin + Finances dynamiques +
// anti-fraude tarifaire + approbation manuelle des comptes.
// Fournisseur démo + fonctions pures. localStorage simulé en mémoire.
// Compilation préalable via scripts/run-tests.sh (TEST_BUILD_DIR).
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  },
};
globalThis.document = { cookie: "" };

const BUILD = process.env.TEST_BUILD_DIR || "/tmp/m7test";

const { DemoProvider } = require(`${BUILD}/data/demo.js`);
const { SUPER_ADMIN_DEMO_EMAIL, ADMIN_DEMO_EMAIL, GESTIONNAIRE_DEMO_EMAIL } = require(`${BUILD}/data/demo-seed.js`);
const G = require(`${BUILD}/grille.js`);
const T = require(`${BUILD}/tarifs.js`);
const AV = require(`${BUILD}/avis.js`);

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

(async () => {
  const p = new DemoProvider();
  const SEED = T.PARAMETRES_FINANCE_DEFAUT.pays_grille_afrique;
  async function connecter(email) {
    try { await p.signOut(); } catch { /* pas de session */ }
    await p.signIn(email, "motdepasse");
  }
  async function compteParEmail(email) {
    const comptes = await p.listerComptesPlateforme();
    return comptes.find((c) => c.email === email);
  }

  console.log("== Anti-fraude : matrice d'attribution (fonctions pures) ==");
  const a1 = G.attribuerGrille({ paysDeclare: "Burundi", paysIp: "BI" }, SEED);
  check("concordance afrique (BI + BI) -> afrique / ok", a1.grille === "afrique" && a1.statut === "ok", JSON.stringify(a1));
  const a2 = G.attribuerGrille({ paysDeclare: "Canada", paysIp: "CA" }, SEED);
  check("concordance internationale (CA + CA) -> internationale / ok", a2.grille === "internationale" && a2.statut === "ok", JSON.stringify(a2));
  const a3 = G.attribuerGrille({ paysDeclare: "Burundi", paysIp: "CA" }, SEED);
  check("contradiction (déclaré Burundi, IP Canada) -> internationale / a_verifier", a3.grille === "internationale" && a3.statut === "a_verifier", JSON.stringify(a3));
  const a4 = G.attribuerGrille({ paysDeclare: "Burundi", paysIp: null }, SEED);
  check("IP absente -> pays déclaré (afrique) / ok", a4.grille === "afrique" && a4.statut === "ok", JSON.stringify(a4));
  const a5 = G.attribuerGrille({ paysDeclare: "Burundi", paysIp: "KE" }, SEED);
  check("déclaré Burundi + IP Kenya (deux éligibles) -> afrique / ok", a5.grille === "afrique" && a5.statut === "ok", JSON.stringify(a5));
  check("revérification au paiement : grille afrique + paiement CA -> a_verifier", G.evaluerPaysPaiement("afrique", "CA", SEED) === "a_verifier");
  check("revérification au paiement : grille afrique + paiement KE -> ok", G.evaluerPaysPaiement("afrique", "KE", SEED) === "ok");
  check("revérification au paiement : pas de signal -> ok", G.evaluerPaysPaiement("afrique", null, SEED) === "ok");
  check("préfixe mobile money +257 -> BI", G.paysDepuisTelephone("+257 79 12 34 56") === "BI");
  check("préfixe ambigu +1 -> null (pas de faux signal)", G.paysDepuisTelephone("+1 514 555 0100") === null);

  console.log("== Avis par modèle (fonctions pures) ==");
  const avisFr = AV.rendreAvis("retard_paiement", { nom: "Jean Bosco", plan: "Pro", date: "2026-11-15" }, "fr");
  check("avis FR : variables {nom} {plan} {date} remplies", avisFr.corps.includes("Jean Bosco") && avisFr.corps.includes("Pro") && avisFr.corps.includes("2026-11-15") && !avisFr.corps.includes("{nom}"), avisFr.corps.slice(0, 80));
  const avisEn = AV.rendreAvis("fin_essai", { nom: "Sarah", plan: "Agence", date: "2026-12-01" }, "en");
  check("avis EN : rendu anglais sans gabarit résiduel", avisEn.corps.includes("Sarah") && !avisEn.corps.includes("{plan}"));
  check("modèle inscription_refusee présent (ajout n°3)", AV.MODELES_AVIS.includes("inscription_refusee"));
  check("motifs de refus prédéfinis (4)", AV.MOTIFS_REFUS.length === 4 && AV.libellerMotif("doublon", "fr").length > 0);

  console.log("== Prix dynamiques + conversion mini-grille (fonctions pures) ==");
  const prixSeed = T.construirePrixPlans(T.TARIFS_SEED);
  check("seed : Pro Afrique 5,99 / Agence Internationale 29,99", prixSeed.pro.afrique === 5.99 && prixSeed.agence.internationale === 29.99);
  const taux = await p.listerTaux();
  const convBif = T.convertirPrixAffichage(5.99, "BIF", taux);
  check("conversion BIF : arrondi à la centaine supérieure", convBif !== null && convBif.montant % 100 === 0 && convBif.montant >= 5.99 * 2900, JSON.stringify(convBif));
  check("conversion BIF : date du taux fournie", convBif !== null && convBif.dateTaux === "2026-11-05", JSON.stringify(convBif));
  const convEur = T.convertirPrixAffichage(5.99, "EUR", taux);
  check("changement de devise -> montants différents (EUR ≠ BIF)", convEur !== null && convEur.devise === "EUR" && convEur.montant !== convBif.montant, JSON.stringify(convEur));
  const convUsd = T.convertirPrixAffichage(5.99, "USD", taux);
  check("USD : montant d'origine, pas de date de taux", convUsd !== null && convUsd.montant === 5.99 && convUsd.dateTaux === null, JSON.stringify(convUsd));
  const convSansTaux = T.convertirPrixAffichage(5.99, "BIF", []);
  check("sans taux : null (repli USD, jamais de taux inventé)", convSansTaux === null);
  const paramsDefaut = await p.getParametresFinance();
  check("paramètres : délai d'approbation affiché par défaut « 24 h ouvrées »", paramsDefaut.delai_approbation_affiche === "24 h ouvrées", paramsDefaut.delai_approbation_affiche);
  check("paramètres : liste des pays grille Afrique dynamique (BI présent)", paramsDefaut.pays_grille_afrique.includes("BI") && paramsDefaut.pays_grille_afrique.length >= 10);

  console.log("== Connexion prioritaire : rôles plateforme ==");
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  let profil = await p.getProfil();
  check("Super Admin démo -> rôle super_admin (console)", profil && profil.role === "super_admin", profil?.role);
  await connecter(ADMIN_DEMO_EMAIL);
  profil = await p.getProfil();
  check("Admin démo -> rôle admin (console)", profil && profil.role === "admin", profil?.role);
  const admins = await p.listerAdmins();
  check("listerAdmins : fondateur + employée", admins.length >= 2 && admins.some((a) => a.role === "super_admin"), JSON.stringify(admins.map((a) => a.role)));

  console.log("== Suspension : connexion bloquée, données conservées ==");
  const principal = await compteParEmail("demo@cizaimmo.com");
  check("compte principal visible dans la console", !!principal);
  await p.suspendreCompte(principal.id);
  const eSusp = await attendErreur(p.signIn("demo@cizaimmo.com", "motdepasse"));
  check("connexion d'un compte suspendu -> ERR_COMPTE_SUSPENDU", eSusp.levee && eSusp.code === "ERR_COMPTE_SUSPENDU", JSON.stringify(eSusp));
  await connecter(ADMIN_DEMO_EMAIL);
  await p.reactiverCompte(principal.id);
  await connecter("demo@cizaimmo.com");
  const aboRest = await p.getAbonnement();
  check("réactivation : statut pré-suspension restauré (essai)", aboRest && aboRest.statut === "essai", aboRest?.statut);

  console.log("== Approbation manuelle : inscription -> attente -> essai ==");
  await p.signOut().catch(() => undefined);
  await p.signUp({ nom: "Attente Test", email: "attente@exemple.com", motDePasse: "motdepasse123", pays: "France", devisePrincipale: "EUR", langue: "fr", paysIp: "FR" });
  let abo = await p.getAbonnement();
  check("inscription -> abonnement en_attente SANS dates d'essai", abo && abo.statut === "en_attente" && abo.trial_ends_at === null, JSON.stringify(abo?.statut));
  const eBloc = await attendErreur(p.creerImmeuble({ nom: "Bloqué", adresse: "a", ville: "v", pays: "France", devise: "EUR", type: "immeuble", etages: null, photo_url: null, notes: null, valeur_bien: null, devise_valeur: null, date_acquisition: null, prix_acquisition: null }));
  check("en attente : aucune création de données (ERR_ABONNEMENT_REQUIS)", eBloc.levee && eBloc.code === "ERR_ABONNEMENT_REQUIS", JSON.stringify(eBloc));
  await connecter(ADMIN_DEMO_EMAIL);
  const cibleAttente = await compteParEmail("attente@exemple.com");
  const avant = Date.now();
  // Checklist de vérification (2026-11-07) : revue consignée avant
  // toute approbation — sinon ERR_CHECKLIST_INCOMPLETE.
  await p.enregistrerChecklistDossier(cibleAttente.id, {
    photo_verifiee: true, piece_coherente: true,
    infos_verifiees: true, antifraude_examinee: true,
  });
  await p.approuverCompte(cibleAttente.id);
  await connecter("attente@exemple.com");
  abo = await p.getAbonnement();
  const ecartJours = abo && abo.trial_ends_at ? (new Date(abo.trial_ends_at).getTime() - avant) / 86400000 : 0;
  check("approbation par un Admin -> essai démarré À l'approbation (+30 j)", abo && abo.statut === "essai" && ecartJours > 29 && ecartJours < 31, `${abo?.statut} / ${ecartJours}`);
  await connecter(ADMIN_DEMO_EMAIL);
  let journal = await p.listerJournalAudit();
  check("audit : décision d'approbation journalisée", journal.some((e) => e.action === "compte_approuve" && e.cible_email === "attente@exemple.com"));

  console.log("== Refus : connexion impossible, motif prédéfini ==");
  await p.signOut().catch(() => undefined);
  await p.signUp({ nom: "Refus Test", email: "refus@exemple.com", motDePasse: "motdepasse123", pays: "Canada", devisePrincipale: "CAD", langue: "fr", paysIp: "CA" });
  await connecter(ADMIN_DEMO_EMAIL);
  const cibleRefus = await compteParEmail("refus@exemple.com");
  await p.refuserCompte(cibleRefus.id, "doublon");
  const eRefus = await attendErreur(p.signIn("refus@exemple.com", "motdepasse123"));
  check("compte refusé -> connexion impossible (ERR_COMPTE_REFUSE)", eRefus.levee && eRefus.code === "ERR_COMPTE_REFUSE", JSON.stringify(eRefus));
  await connecter(ADMIN_DEMO_EMAIL);
  journal = await p.listerJournalAudit();
  check("audit : refus journalisé avec motif", journal.some((e) => e.action === "compte_refuse" && e.cible_email === "refus@exemple.com" && e.details && e.details.motif === "doublon"));

  console.log("== Anti-fraude : grille verrouillée après attribution ==");
  await p.signOut().catch(() => undefined);
  await p.signUp({ nom: "Fraude Test", email: "fraude@exemple.com", motDePasse: "motdepasse123", pays: "Burundi", devisePrincipale: "BIF", langue: "fr", paysIp: "CA" });
  await connecter(ADMIN_DEMO_EMAIL);
  const cibleFraude = await compteParEmail("fraude@exemple.com");
  check("contradiction à l'inscription -> grille internationale + a_verifier", cibleFraude && cibleFraude.abonnement?.grille === "internationale" && cibleFraude.grille_statut === "a_verifier", JSON.stringify({ g: cibleFraude?.abonnement?.grille, s: cibleFraude?.grille_statut }));
  // Compte signalé « a_verifier » : la case anti-fraude est requise.
  await p.enregistrerChecklistDossier(cibleFraude.id, {
    photo_verifiee: true, piece_coherente: true,
    infos_verifiees: true, antifraude_examinee: true,
  });
  await p.approuverCompte(cibleFraude.id);
  await connecter("fraude@exemple.com");
  await p.modifierProfil({ pays: "Canada" });
  abo = await p.getAbonnement();
  check("changement de pays dans les paramètres : grille INCHANGÉE (internationale)", abo && abo.grille === "internationale", abo?.grille);
  await connecter(ADMIN_DEMO_EMAIL);
  await p.reattribuerGrille(cibleFraude.id, "afrique");
  const apresReattr = await compteParEmail("fraude@exemple.com");
  check("réattribution console -> afrique + statut ok", apresReattr && apresReattr.abonnement?.grille === "afrique" && apresReattr.grille_statut === "ok", JSON.stringify({ g: apresReattr?.abonnement?.grille, s: apresReattr?.grille_statut }));
  journal = await p.listerJournalAudit();
  check("audit : réattribution de grille journalisée", journal.some((e) => e.action === "grille_reattribuee" && e.cible_email === "fraude@exemple.com"));

  console.log("== Anti-fraude : signal (c) pays du premier paiement ==");
  await p.signOut().catch(() => undefined);
  await p.signUp({ nom: "Paiement Test", email: "paiement@exemple.com", motDePasse: "motdepasse123", pays: "Canada", devisePrincipale: "CAD", langue: "fr", paysIp: "CA" });
  await connecter(ADMIN_DEMO_EMAIL);
  const ciblePaiement = await compteParEmail("paiement@exemple.com");
  await p.enregistrerChecklistDossier(ciblePaiement.id, {
    photo_verifiee: true, piece_coherente: true,
    infos_verifiees: true, antifraude_examinee: true,
  });
  await p.approuverCompte(ciblePaiement.id);
  await connecter("paiement@exemple.com");
  const mm = await p.demanderPaiementMobileMoney("ecocash", "+257 79 12 34 56", "pro");
  await p.confirmerPaiementMobileMoney(mm.reference);
  await connecter(ADMIN_DEMO_EMAIL);
  const apresPaiement = await compteParEmail("paiement@exemple.com");
  check("paiement mobile money +257 sur grille internationale -> pays_paiement BI + a_verifier", apresPaiement && apresPaiement.pays_paiement === "BI" && apresPaiement.grille_statut === "a_verifier", JSON.stringify({ pp: apresPaiement?.pays_paiement, s: apresPaiement?.grille_statut }));

  console.log("== Avis envoyé depuis la console : enregistré + journalisé ==");
  const comptes = await p.listerComptesPlateforme();
  const cibleAvis = comptes.find((c) => c.abonnement?.statut === "actif");
  check("cible d'avis : un compte actif du registre", !!cibleAvis, JSON.stringify(comptes.map((c) => c.email)));
  const avis = await p.envoyerAvis(cibleAvis.id, "retard_paiement");
  check("avis créé depuis le modèle (destinataire + modèle)", avis && avis.modele === "retard_paiement" && avis.destinataire_id === cibleAvis.id, JSON.stringify(avis?.modele));
  check("avis : statut d'envoi honnête (envoye/non_configuré/echec)", ["envoye", "non_configuré", "echec"].includes(avis.statut_envoi), avis.statut_envoi);
  journal = await p.listerJournalAudit();
  check("audit : avis_envoye journalisé", journal.some((e) => e.action === "avis_envoye" && e.cible_email === cibleAvis.email));

  console.log("== Finances dynamiques : la console change le front ==");
  const tarifsAvant = await p.getTarifsPlateforme();
  const eAdmin = await attendErreur(p.mettreAJourTarifs(tarifsAvant, paramsDefaut));
  check("un Admin simple ne peut PAS modifier les finances (ERR_SUPER_ADMIN_REQUIS)", eAdmin.levee && eAdmin.code === "ERR_SUPER_ADMIN_REQUIS", JSON.stringify(eAdmin));
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const modif = tarifsAvant.map((l) => (l.grille === "afrique" && l.plan === "pro" ? { ...l, prix_mensuel: 7.5 } : l));
  await p.mettreAJourTarifs(modif, paramsDefaut);
  const tarifsApres = await p.getTarifsPlateforme();
  check("prix modifié à la source : Pro Afrique = 7,50", T.construirePrixPlans(tarifsApres).pro.afrique === 7.5, JSON.stringify(T.construirePrixPlans(tarifsApres).pro));
  check("la grille construite (page tarifs + mini-grille) reflète le nouveau prix", T.prixDepuisTarifs(tarifsApres, "pro", "afrique") === 7.5 && T.prixDepuisTarifs(tarifsApres, "pro", "internationale") === 14.99);
  journal = await p.listerJournalAudit();
  check("audit : tarifs_modifies journalisé", journal.some((e) => e.action === "tarifs_modifies"));
  await p.mettreAJourTarifs(tarifsAvant, paramsDefaut); // restauration du seed

  console.log("== Gestionnaire multi-rattachements : contextes STRICTEMENT séparés ==");
  await connecter(GESTIONNAIRE_DEMO_EMAIL);
  const rattachements = await p.listerMesRattachements();
  check("Marc Dubois : 2 rattachements actifs (propriétaire + Ciza Group)", rattachements.filter((r) => r.statut === "actif").length === 2, JSON.stringify(rattachements.map((r) => r.contexte)));
  let contexte = await p.getContexteActif();
  check("contexte par défaut : propriétaire (Bloc Saint-Laurent)", contexte && contexte.contexte === "proprietaire", contexte?.contexte);
  let immeubles = await p.listerImmeubles();
  check("contexte propriétaire : SEUL Bloc Saint-Laurent visible", immeubles.length === 1 && immeubles[0].nom.includes("Saint-Laurent"), JSON.stringify(immeubles.map((i) => i.nom)));
  const rattCg = rattachements.find((r) => r.contexte === "cizagroup");
  await p.definirContexteActif(rattCg.id);
  immeubles = await p.listerImmeubles();
  check("contexte Ciza Group : SEULE la Résidence Ciza visible (aucune donnée cliente)", immeubles.length === 1 && immeubles[0].nom.includes("Ciza"), JSON.stringify(immeubles.map((i) => i.nom)));
  const rattProp = rattachements.find((r) => r.contexte === "proprietaire");
  await p.definirContexteActif(rattProp.id);
  immeubles = await p.listerImmeubles();
  check("retour contexte propriétaire : Saint-Laurent, rien du parc Ciza Group", immeubles.length === 1 && immeubles[0].nom.includes("Saint-Laurent"), JSON.stringify(immeubles.map((i) => i.nom)));

  console.log("== Supervision : ouverture journalisée ==");
  await connecter(ADMIN_DEMO_EMAIL);
  const supervision = await p.ouvrirSupervision(rattCg.id);
  check("supervision : résumé du parc Ciza Group du gestionnaire", supervision && supervision.immeubles.some((i) => i.nom.includes("Ciza")), JSON.stringify(supervision?.immeubles?.map((i) => i.nom)));
  journal = await p.listerJournalAudit();
  check("audit : supervision_ouverte journalisée", journal.some((e) => e.action === "supervision_ouverte"));

  console.log(`\nRésultat : ${ok} OK, ${ko} KO`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error("ERREUR TEST", e); process.exit(2); });

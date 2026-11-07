// Test Extension v1.4 — la BASE est la source de vérité :
//  A. SQL (statique, supabase/module-v14.sql) : fonction de garde
//     abonnement_permets_ecriture + politiques d'ÉCRITURE des tables
//     métier branchées dessus (résolution sur le propriétaire des
//     données), colonne plan_apres_essai, handle_new_user Starter,
//     fonction d'approbation approuver_compte (essai Starter forcé).
//  B. Front (statique) : inscription SANS choix de plan (encadré
//     essai Starter FR/EN), page Abonnement avec le choix du pack de
//     fin d'essai, clés i18n nouvelles présentes des deux côtés.
//  C. Comportement (fournisseur DÉMO, miroir de la base) :
//     inscription -> en_attente Starter ; approbation -> essai
//     Starter + limite 1 bloc ; definirPlanApresEssai pendant l'essai
//     (plan inchangé, choix persisté, visible dans la vue console).
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
};
globalThis.document = { cookie: "" };

const BUILD = process.env.TEST_BUILD_DIR || "/tmp/m7test";
const RACINE = path.join(__dirname, "..");

const { DemoProvider } = require(`${BUILD}/data/demo.js`);
const { SUPER_ADMIN_DEMO_EMAIL } = require(`${BUILD}/data/demo-seed.js`);
const { limiteBlocs } = require(`${BUILD}/data/types.js`);

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
/** Segment d'une politique : de « create policy NOM » au « ; » final. */
function segmentPolitique(sql, nom) {
  const i = sql.indexOf(`create policy ${nom} `);
  if (i < 0) return "";
  const j = sql.indexOf(";", i);
  return sql.slice(i, j < 0 ? undefined : j);
}

(async () => {
  console.log("== A. SQL module-v14.sql : la garde d'écriture vit dans la base ==");
  const sql = lire("supabase/module-v14.sql");

  check("fonction public.abonnement_permets_ecriture définie",
    sql.includes("create or replace function public.abonnement_permets_ecriture(p_owner uuid)"));
  check("garde : SECURITY DEFINER + STABLE + search_path verrouillé",
    /abonnement_permets_ecriture\(p_owner uuid\)\s*returns boolean language sql security definer stable set search_path = public/.test(sql));
  check("garde : actif sans échec -> vrai",
    sql.includes("a.statut = 'actif' and not a.echec_paiement then true"));
  check("garde : actif + échec + grâce en cours (grace_ends_at > now()) -> vrai",
    sql.includes("a.grace_ends_at is not null and a.grace_ends_at > now() then true"));
  check("garde : essai non expiré (trial_ends_at > now()) -> vrai",
    sql.includes("a.trial_ends_at is not null and a.trial_ends_at > now() then true"));
  check("garde : repli faux (coalesce ..., false) — en_attente/suspendu/lecture_seule/annule/aucun",
    sql.includes("), false);") && sql.includes("order by a.created_at desc"));

  check("colonne plan_apres_essai : défaut 'starter'",
    sql.includes("add column if not exists plan_apres_essai text not null default 'starter'"));
  check("colonne plan_apres_essai : CHECK starter/pro/agence",
    sql.includes("check (plan_apres_essai in ('starter', 'pro', 'agence'))"));

  console.log("== A2. Politiques d'écriture branchées (12) — lectures intactes ==");
  const politiques = [
    "immeubles_insert_owner", "immeubles_update", "immeubles_delete_owner",
    "appartements_insert", "appartements_update", "appartements_delete_owner",
    "locataires_write_owner", "baux_write", "loyers_write",
    "paiements_write", "depenses_write", "documents_write",
  ];
  for (const nom of politiques) {
    const seg = segmentPolitique(sql, nom);
    check(`politique ${nom} : recréée + garde branchée`,
      seg.length > 0 && seg.includes("public.abonnement_permets_ecriture("), seg.slice(0, 80));
  }
  const nbPolicies = (sql.match(/create policy /g) || []).length;
  check("exactement 12 politiques recréées (aucune autre table touchée)",
    nbPolicies === 12, `trouvé ${nbPolicies}`);
  check("aucune politique de LECTURE (for select) dans le module",
    !sql.toLowerCase().includes("for select"));
  check("résolution propriétaire : helpers par immeuble/appartement/bail/échéance",
    ["proprietaire_immeuble(p_immeuble_id uuid)", "proprietaire_par_appartement(p_appartement_id uuid)",
     "proprietaire_par_bail(p_bail_id uuid)", "proprietaire_par_echeance(p_loyer_id uuid)"]
      .every((s) => sql.includes(`function public.${s}`)));
  check("baux : garde via proprietaire_par_appartement(baux.appartement_id)",
    segmentPolitique(sql, "baux_write").includes("proprietaire_par_appartement(baux.appartement_id)"));
  check("loyers : garde via proprietaire_par_bail(loyers.bail_id)",
    segmentPolitique(sql, "loyers_write").includes("proprietaire_par_bail(loyers.bail_id)"));
  check("paiements : garde via proprietaire_par_echeance(paiements.echeance_id)",
    segmentPolitique(sql, "paiements_write").includes("proprietaire_par_echeance(paiements.echeance_id)"));
  check("depenses : garde via le propriétaire de l'immeuble (pas le rédacteur)",
    segmentPolitique(sql, "depenses_write").includes("proprietaire_immeuble(immeuble_id)"));
  check("documents : entite_type 'compte' hors garde (dossier pendant l'attente)",
    segmentPolitique(sql, "documents_write").includes("entite_type = 'compte' or public.abonnement_permets_ecriture(owner_id)"));

  console.log("== A3. Essai Starter dans la base : naissance + approbation ==");
  check("handle_new_user redéfini (reprise v1.3)",
    sql.includes("create or replace function public.handle_new_user()") &&
    sql.includes("nextval('public.display_id_seq')"));
  check("handle_new_user : abonnement naît starter / en_attente / plan_apres_essai starter",
    sql.includes("values (new.id, 'starter', v_grille, 'en_attente', now(), null, null, 'starter')"));
  check("fonction public.approuver_compte(cible uuid) définie",
    sql.includes("create or replace function public.approuver_compte(cible uuid)"));
  const segApprobation = sql.slice(sql.indexOf("create or replace function public.approuver_compte"));
  check("approuver_compte : contrôle plateforme interne (ADMIN_PLATEFORME_REQUIS)",
    segApprobation.includes("if not public.est_admin_plateforme() then") &&
    segApprobation.includes("raise exception 'ADMIN_PLATEFORME_REQUIS'"));
  check("approuver_compte : refuse un compte non en attente (COMPTE_NON_EN_ATTENTE)",
    segApprobation.includes("raise exception 'COMPTE_NON_EN_ATTENTE'"));
  check("approuver_compte : durée dynamique (parametres_finance.jours_essai)",
    segApprobation.includes("select p.jours_essai into v_jours") &&
    segApprobation.includes("from public.parametres_finance p"));
  check("approuver_compte : force plan = 'starter' et plan_apres_essai = 'starter'",
    segApprobation.includes("plan = 'starter',") && segApprobation.includes("plan_apres_essai = 'starter',"));
  check("approuver_compte : execute réservé aux connectés (revoke public + grant authenticated)",
    sql.includes("revoke all on function public.approuver_compte(uuid) from public;") &&
    sql.includes("grant execute on function public.approuver_compte(uuid) to authenticated;"));

  console.log("== B. Front : inscription sans plan, encadré Starter FR/EN ==");
  const pageInscription = lire("app/[locale]/inscription/page.tsx");
  check("inscription : encadré essai (trialNote) présent",
    pageInscription.includes('t("trialNote")'));
  check("inscription : AUCUN plan transmis à signUp",
    !/signUp\(\{[^}]*\bplan\b/.test(pageInscription));
  const fr = JSON.parse(lire("messages/fr.json"));
  const en = JSON.parse(lire("messages/en.json"));
  check("FR : trialNote annonce le pack Starter inclus + choix à la fin",
    fr.auth.trialNote.includes("pack Starter inclus") &&
    fr.auth.trialNote.includes("À la fin de l'essai, vous choisirez le pack"));
  check("EN : trialNote annonce le Starter pack + choix à la fin",
    en.auth.trialNote.includes("Starter pack included") &&
    en.auth.trialNote.includes("you will choose the pack"));
  check("FR/EN : landing + page tarifs alignées (Starter, plus de « fonctions Pro »)",
    fr.landing.pricing.trial.includes("Starter") && en.landing.pricing.trial.includes("Starter") &&
    fr.pricingPage.trialText.includes("Starter") && en.pricingPage.trialText.includes("Starter"));

  console.log("== B2. Page Abonnement : choix du pack de fin d'essai ==");
  const pageAbonnement = lire("app/[locale]/abonnement/page.tsx");
  check("abonnement : section trialPackTitle pendant l'essai",
    pageAbonnement.includes('ts("trialPackTitle")') &&
    pageAbonnement.includes('abonnement.statut === "essai"'));
  check("abonnement : enregistrement via definirPlanApresEssai",
    pageAbonnement.includes("definirPlanApresEssai(packApresEssai)"));
  check("i18n : subscription.trialPack* présent FR + EN",
    ["trialPackTitle", "trialPackText", "trialPackSave", "trialPackSaved"]
      .every((k) => typeof fr.subscription[k] === "string" && typeof en.subscription[k] === "string"));
  check("i18n : console.planAfterTrialLabel présent FR + EN",
    typeof fr.console.planAfterTrialLabel === "string" &&
    typeof en.console.planAfterTrialLabel === "string");
  const pageComptes = lire("app/[locale]/console/comptes/page.tsx");
  const pageDossier = lire("app/[locale]/console/comptes/[id]/page.tsx");
  check("console : liste + dossier affichent le pack après l'essai si différent",
    pageComptes.includes("plan_apres_essai") && pageDossier.includes("plan_apres_essai"));

  console.log("== B3. Couche données : réel via RPC base, démo en miroir ==");
  const reel = lire("lib/data/real.ts");
  check("réel : approbation via la RPC approuver_compte de la base",
    reel.includes('rpc("approuver_compte"'));
  check("réel : secours d'inscription en Starter",
    reel.includes('plan: "starter",') && reel.includes('plan_apres_essai: "starter",'));
  const demoSrc = lire("lib/data/demo.ts");
  check("démo : approbation force plan + plan_apres_essai à starter",
    (demoSrc.match(/plan_apres_essai = "starter"/g) || []).length >= 2);
  check("démo + réel : definirPlanApresEssai implémenté des deux côtés",
    demoSrc.includes("async definirPlanApresEssai") && reel.includes("async definirPlanApresEssai"));

  console.log("== C. Comportement démo : inscription -> essai Starter -> choix du pack ==");
  check("limiteBlocs : l'essai suit le plan (Starter = 1 bloc, plus de Pro offert)",
    limiteBlocs("starter", "essai") === 1 && limiteBlocs("pro", "actif") === 5 &&
    limiteBlocs("starter", "en_attente") === 0);

  const p = new DemoProvider();
  await p.signUp({
    nom: "Base Verite", email: "baseverite@exemple.bi", motDePasse: "motdepasse123",
    pays: "Burundi", devisePrincipale: "BIF", langue: "fr",
    telephone: "+257 79 00 00 00", intention: "proprietaire",
  });
  let abo = await p.getAbonnement();
  check("inscription : abonnement en_attente, plan starter, plan_apres_essai starter, sans dates",
    abo && abo.statut === "en_attente" && abo.plan === "starter" &&
    abo.plan_apres_essai === "starter" && abo.trial_ends_at === null,
    JSON.stringify(abo && { s: abo.statut, p: abo.plan, pae: abo.plan_apres_essai }));
  const eAttente = await attendErreur(p.creerImmeuble({
    nom: "Bloqué", adresse: "a", ville: "v", pays: "Burundi", devise: "BIF",
    type: "immeuble", etages: null, photo_url: null, notes: null,
    valeur_bien: null, devise_valeur: null, date_acquisition: null, prix_acquisition: null,
  }));
  check("en attente : écriture refusée (garde démo, miroir de la base)",
    eAttente.levee && eAttente.code === "ERR_ABONNEMENT_REQUIS", JSON.stringify(eAttente));

  // Approbation par le Super Admin démo (geste console).
  await p.signIn(SUPER_ADMIN_DEMO_EMAIL, "motdepasse");
  const comptes = await p.listerComptesPlateforme();
  const cible = comptes.find((c) => c.email === "baseverite@exemple.bi");
  check("console : le compte en attente est visible, plan starter",
    !!cible && cible.abonnement?.plan === "starter");
  await p.approuverCompte(cible.id);
  await p.signOut();
  await p.signIn("baseverite@exemple.bi", "motdepasse123");

  abo = await p.getAbonnement();
  const ecartJours = abo?.trial_ends_at
    ? (new Date(abo.trial_ends_at).getTime() - Date.now()) / 86400000 : 0;
  check("approbation : essai démarré, plan STARTER forcé, +30 jours",
    abo && abo.statut === "essai" && abo.plan === "starter" && ecartJours > 29 && ecartJours < 31,
    JSON.stringify(abo && { s: abo.statut, p: abo.plan }));
  check("approbation : plan_apres_essai repart à starter",
    abo && abo.plan_apres_essai === "starter");
  const lim = await p.getLimiteBlocs();
  check("essai Starter : limite de blocs = 1", lim.autorises === 1, JSON.stringify(lim));

  const db = p.getDemoDb();
  const eIndivision = await attendErreur(
    p.inviterCoproprietaire(db.immeubles[0].id, {
      nom: "Copro Test", email: "copro@exemple.bi", telephone: null, part: 50,
    })
  );
  check("essai Starter : indivision refusée (fonction Pro/Agence)",
    eIndivision.levee && eIndivision.code === "ERR_INDIVISION_PLAN", JSON.stringify(eIndivision));

  const maj = await p.definirPlanApresEssai("pro");
  check("definirPlanApresEssai('pro') : choix enregistré, plan et statut inchangés",
    maj.plan_apres_essai === "pro" && maj.plan === "starter" && maj.statut === "essai",
    JSON.stringify({ p: maj.plan, pae: maj.plan_apres_essai, s: maj.statut }));
  abo = await p.getAbonnement();
  check("choix persisté à la relecture", abo && abo.plan_apres_essai === "pro");

  await p.signIn(SUPER_ADMIN_DEMO_EMAIL, "motdepasse");
  const apres = (await p.listerComptesPlateforme()).find((c) => c.email === "baseverite@exemple.bi");
  check("console : vue du compte = essai Starter + pack après l'essai « pro »",
    apres && apres.abonnement?.plan === "starter" && apres.abonnement?.plan_apres_essai === "pro",
    JSON.stringify(apres?.abonnement));

  console.log(`\nTOTAL v1.4 : ${ok} OK, ${ko} KO`);
  process.exit(ko > 0 ? 1 : 0);
})().catch((e) => {
  console.error("ERREUR FATALE", e);
  process.exit(1);
});

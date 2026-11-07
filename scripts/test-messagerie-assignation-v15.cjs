// Test Extension v1.5 — MESSAGERIE DIRECTE SUPERVISÉE + ASSIGNATION :
//  A. SQL (statique, supabase/module-v15.sql) : tables conversations /
//     messages_directs, RLS (plateforme LECTURE SEULE sur les fils
//     rattachement — aucune policy delete), RPC assignation / équipe /
//     consultation journalisée.
//  B. Comportement (fournisseur DÉMO, miroir de la base) :
//     fil plateforme client <-> admin responsable (routage, non-lus) ;
//     fil rattachement entre participants seuls, envoi plateforme
//     REFUSÉ (ERR_SUPERVISION_LECTURE_SEULE), consultation journalisée ;
//     assignation + charge + responsable affiché ; accès Admin coupé
//     -> garde plateforme refuse ; retrait du rôle Admin -> rôle
//     client d'origine restauré + dossiers désassignés ;
//     « Mes dossiers » filtrés sur l'Admin responsable.
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
  GESTIONNAIRE_DEMO_EMAIL,
} = require(`${BUILD}/data/demo-seed.js`);

const CLIENT_EMAIL = "demo@cizaimmo.com";
const PETIT_PDF = Buffer.from("%PDF-1.4 document de test").toString("base64");

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
  console.log("== A. SQL module-v15.sql : messagerie + assignation dans la base ==");
  const sql = lire("supabase/module-v15.sql");

  check("table conversations créée (types plateforme/rattachement)",
    sql.includes("create table if not exists public.conversations") &&
    sql.includes("'plateforme'") && sql.includes("'rattachement'"));
  check("table messages_directs créée",
    sql.includes("create table if not exists public.messages_directs"));
  check("RLS activée sur les deux tables",
    (sql.match(/enable row level security/g) || []).length >= 2);
  check("insertion messages : la plateforme n'écrit que sur les fils 'plateforme'",
    sql.includes("public.est_participant_conversation(conversation_id)") &&
    sql.includes("public.type_conversation(conversation_id) = 'plateforme'") &&
    sql.includes("and public.est_admin_plateforme()"));
  check("supervision : AUCUNE policy delete sur conversations/messages_directs",
    !/create policy [a-z_]+ on public\.(conversations|messages_directs)\s+for delete/.test(sql));
  check("RPC journaliser_consultation_messages (audit 'consultation_messages')",
    sql.includes("function public.journaliser_consultation_messages") &&
    sql.includes("'consultation_messages'"));
  check("RPC assigner_dossier(cible, admin_id) + colonne profils.admin_responsable_id",
    sql.includes("function public.assigner_dossier(cible uuid, admin_id uuid)") &&
    sql.includes("admin_responsable_id"));
  check("charge : lister_charge_admins définie",
    sql.includes("function public.lister_charge_admins()"));
  check("équipe : basculer_acces_admin + retirer_role_admin définies",
    sql.includes("function public.basculer_acces_admin(cible uuid, actif boolean)") &&
    sql.includes("function public.retirer_role_admin(cible uuid)"));
  check("retrait du rôle : retour au rôle d'origine (role_avant_admin)",
    sql.includes("role_avant_admin"));

  console.log("== B. Assignation : responsable, charge, Mes dossiers ==");
  const p = new DemoProvider();
  async function connecter(email, mdp = "motdepasse") {
    try { await p.signOut(); } catch { /* pas de session */ }
    await p.signIn(email, mdp);
  }
  async function compteParEmail(email) {
    const comptes = await p.listerComptesPlateforme();
    return comptes.find((c) => c.email === email) || null;
  }

  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const equipe0 = await p.listerEquipeAdmins();
  const admin = equipe0.find((m) => m.email === ADMIN_DEMO_EMAIL);
  check("équipe : l'Admin démo est listé avec accès actif",
    !!admin && admin.role === "admin" && admin.acces_admin_actif === true,
    JSON.stringify(admin));
  const client = await compteParEmail(CLIENT_EMAIL);
  check("client principal présent dans la file console", !!client);

  const eAssignFaux = await attendErreur(p.assignerDossier(client.id, "id-inexistant-v15"));
  check("assignation vers un non-Admin refusée (ERR_ADMIN_INTROUVABLE)",
    eAssignFaux.levee && eAssignFaux.code === "ERR_ADMIN_INTROUVABLE", JSON.stringify(eAssignFaux));

  await p.assignerDossier(client.id, admin.id);
  const clientApres = await compteParEmail(CLIENT_EMAIL);
  check("responsable affiché sur le dossier (id + nom résolu)",
    clientApres.admin_responsable_id === admin.id && !!clientApres.admin_responsable_nom,
    JSON.stringify({ id: clientApres.admin_responsable_id, nom: clientApres.admin_responsable_nom }));

  const equipe1 = await p.listerEquipeAdmins();
  const admin1 = equipe1.find((m) => m.id === admin.id);
  check("charge : l'Admin compte 1 dossier assigné",
    !!admin1 && admin1.dossiers_assignes >= 1, JSON.stringify(admin1 && admin1.dossiers_assignes));

  await connecter(ADMIN_DEMO_EMAIL);
  const mesDossiers = await p.listerMesDossiers();
  check("Mes dossiers (Admin) : le dossier assigné est présent",
    mesDossiers.some((c) => c.id === client.id));
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const mesDossiersSuper = await p.listerMesDossiers();
  check("Mes dossiers (Super Admin) : le dossier de l'Admin n'y est pas",
    !mesDossiersSuper.some((c) => c.id === client.id));

  console.log("== C. Fil plateforme : routage vers le responsable + non-lus ==");
  await connecter(CLIENT_EMAIL);
  const conv = await p.getConversationPlateforme();
  check("fil plateforme créé, routé vers l'Admin responsable",
    conv.type === "plateforme" && conv.admin_responsable_id === admin.id,
    JSON.stringify({ type: conv.type, resp: conv.admin_responsable_id }));
  await p.envoyerMessage(conv.id, "Bonjour, j'ai une question sur mon abonnement.");
  const convsClient = await p.listerConversations();
  const vueClient = convsClient.find((c) => c.id === conv.id);
  check("client : son propre message n'est pas « non lu »",
    !!vueClient && (vueClient.non_lus || 0) === 0, JSON.stringify(vueClient && vueClient.non_lus));

  await connecter(ADMIN_DEMO_EMAIL);
  const convsAdmin = await p.listerConversations();
  const vueAdmin = convsAdmin.find((c) => c.id === conv.id);
  check("admin responsable : le fil remonte avec 1 non-lu",
    !!vueAdmin && (vueAdmin.non_lus || 0) >= 1, JSON.stringify(vueAdmin && vueAdmin.non_lus));
  await p.envoyerMessage(conv.id, "Bonjour, je vous réponds : c'est réglé.");
  await p.marquerLu(conv.id);
  const convsAdmin2 = await p.listerConversations();
  const vueAdmin2 = convsAdmin2.find((c) => c.id === conv.id);
  check("admin : après marquerLu, 0 non-lu",
    !!vueAdmin2 && (vueAdmin2.non_lus || 0) === 0, JSON.stringify(vueAdmin2 && vueAdmin2.non_lus));

  await connecter(CLIENT_EMAIL);
  const convsClient2 = await p.listerConversations();
  const vueClient2 = convsClient2.find((c) => c.id === conv.id);
  check("client : la réponse de l'Admin compte 1 non-lu",
    !!vueClient2 && (vueClient2.non_lus || 0) >= 1, JSON.stringify(vueClient2 && vueClient2.non_lus));
  const messages = await p.listerMessages(conv.id);
  check("historique du fil : 2 messages, du plus ancien au plus récent",
    messages.length === 2 && messages[0].corps.includes("question") && messages[1].corps.includes("réglé"),
    JSON.stringify(messages.map((m) => m.corps)));
  const eVide = await attendErreur(p.envoyerMessage(conv.id, "   "));
  check("message vide refusé (ERR_MESSAGE_VIDE)",
    eVide.levee && eVide.code === "ERR_MESSAGE_VIDE", JSON.stringify(eVide));

  console.log("== D. Fil rattachement : participants seuls, plateforme en lecture seule ==");
  // Couple seedé (chemin éprouvé par le test v1.3) : le propriétaire
  // principal démo <-> Marc Dubois, gestionnaire seedé CIM-000002 au
  // contrat déjà valide. (En mono-base démo, une demande vers un
  // gestionnaire fraîchement inscrit est impossible par construction :
  // tous les signUps partagent l'id du profil principal.)
  // La graine contient une demande propriétaire -> Marc en attente :
  // Marc la REFUSE d'abord (libère la voie, comme au test v1.3).
  await connecter(CLIENT_EMAIL);
  const demandesInitiales = await p.listerDemandesRattachement();
  const demandeGraine = demandesInitiales.find(
    (d) => d.gestionnaire_display_id === "CIM-000002" && d.statut === "en_attente_gestionnaire");
  check("demande seedée en attente retrouvée", !!demandeGraine);
  await connecter(GESTIONNAIRE_DEMO_EMAIL);
  if (demandeGraine) await p.repondreDemandeRattachement(demandeGraine.id, false);

  await connecter(CLIENT_EMAIL);
  const demande = await p.demanderRattachementParDisplayId("CIM-000002");
  check("demande adressée au gestionnaire seedé Marc (CIM-000002)",
    demande.gestionnaire_display_id === "CIM-000002" && !!demande.gestionnaire_id,
    JSON.stringify(demande.gestionnaire_display_id));
  await connecter(GESTIONNAIRE_DEMO_EMAIL);
  await p.repondreDemandeRattachement(demande.id, true);
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const validee = await p.validerRattachementAdmin(demande.id, true);
  check("rattachement actif après triple validation",
    validee.statut === "actif" && !!validee.rattachement_id, JSON.stringify(validee.statut));
  const ratt = (await p.listerRattachements()).find((r) => r.id === validee.rattachement_id);

  await connecter(CLIENT_EMAIL);
  const convR = await p.getConversationRattachement(validee.rattachement_id);
  check("fil rattachement créé entre les deux participants",
    convR.type === "rattachement" && convR.proprietaire_id === client.id &&
    !!ratt && convR.gestionnaire_id === ratt.gestionnaire_id, JSON.stringify(convR.type));
  await p.envoyerMessage(convR.id, "Bonjour, pouvez-vous passer voir l'immeuble ?");

  await connecter(GESTIONNAIRE_DEMO_EMAIL);
  const convsGest = await p.listerConversations();
  const vueGest = convsGest.find((c) => c.id === convR.id);
  // NB modèle de données (brief) : seuls deux drapeaux existent
  // (lu_par_client / lu_par_plateforme) — propriétaire et gestionnaire
  // partagent le côté « client », donc pas de badge non-lu distinct
  // entre eux ; on vérifie la VISIBILITÉ du fil et la lecture des messages.
  check("gestionnaire : le fil rattachement remonte dans ses conversations",
    !!vueGest, JSON.stringify(vueGest && vueGest.id));
  const messagesGest = await p.listerMessages(convR.id);
  check("gestionnaire : il lit le message du propriétaire",
    messagesGest.length === 1 && messagesGest[0].corps.includes("immeuble"),
    JSON.stringify(messagesGest.map((m) => m.corps)));
  await p.envoyerMessage(convR.id, "Bien sûr, je passe demain matin.");

  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const supervisees = await p.listerConversationsSupervisees();
  check("supervision : le fil rattachement est visible par la plateforme",
    supervisees.some((c) => c.id === convR.id));
  const eSupervision = await attendErreur(p.envoyerMessage(convR.id, "Message plateforme interdit"));
  check("supervision LECTURE SEULE : envoi plateforme refusé (ERR_SUPERVISION_LECTURE_SEULE)",
    eSupervision.levee && eSupervision.code === "ERR_SUPERVISION_LECTURE_SEULE",
    JSON.stringify(eSupervision));
  const messagesSupervises = await p.listerMessages(convR.id);
  check("supervision : lecture des 2 messages des participants",
    messagesSupervises.length === 2, JSON.stringify(messagesSupervises.length));
  await p.journaliserConsultationMessages(convR.id);
  const audit = await p.listerJournalAudit();
  check("consultation supervisée JOURNALISÉE (action consultation_messages)",
    audit.some((a) => a.action === "consultation_messages" &&
      (a.cible_id === convR.id || a.cible_id === client.id)),
    JSON.stringify(audit.map((a) => a.action).slice(0, 10)));

  console.log("== E. Accès Admin coupé, puis retrait du rôle ==");
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  await p.basculerAccesAdmin(admin.id, false);
  await connecter(ADMIN_DEMO_EMAIL);
  const eAcces = await attendErreur(p.listerComptesPlateforme());
  check("accès Admin coupé : la garde plateforme refuse (miroir est_admin_plateforme)",
    eAcces.levee, JSON.stringify(eAcces));
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  await p.basculerAccesAdmin(admin.id, true);
  await connecter(ADMIN_DEMO_EMAIL);
  const comptesApresRetour = await p.listerComptesPlateforme();
  check("accès rétabli : l'Admin relit la file console", Array.isArray(comptesApresRetour));

  // Retrait du rôle : promotion d'un compte client SEEDÉ du registre
  // (id distinct — en mono-base démo, un signUp remplacerait le profil
  // principal au lieu de créer un compte séparé) -> assignation -> retrait.
  await connecter(SUPER_ADMIN_DEMO_EMAIL);
  const employeAvant = await compteParEmail("sarah.t.demo@exemple.com");
  check("compte client seedé disponible pour la promotion", !!employeAvant,
    JSON.stringify(employeAvant && employeAvant.email));
  await p.promouvoirAdmin("sarah.t.demo@exemple.com");
  const equipe2 = await p.listerEquipeAdmins();
  check("promotion : l'employée rejoint l'équipe",
    equipe2.some((m) => m.email === "sarah.t.demo@exemple.com" && m.role === "admin"));
  await p.assignerDossier(client.id, employeAvant.id);
  await p.retirerRoleAdmin(employeAvant.id);
  const equipe3 = await p.listerEquipeAdmins();
  check("retrait : l'employée quitte l'équipe",
    !equipe3.some((m) => m.email === "sarah.t.demo@exemple.com"));
  const clientFinal = await compteParEmail(CLIENT_EMAIL);
  check("retrait : les dossiers de l'ex-Admin sont désassignés",
    !!clientFinal && clientFinal.admin_responsable_id === null,
    JSON.stringify(clientFinal && clientFinal.admin_responsable_id));
  const employeFinal = await compteParEmail("sarah.t.demo@exemple.com");
  check("retrait : le compte redevient client (rôle d'origine 'proprietaire')",
    !!employeFinal && employeFinal.role === "proprietaire", JSON.stringify(employeFinal && employeFinal.role));

  console.log(`\n=== v1.5 Messagerie + Assignation : ${ok} OK, ${ko} KO ===`);
  process.exit(ko > 0 ? 1 : 0);
})().catch((e) => {
  console.error("ERREUR FATALE", e);
  process.exit(1);
});

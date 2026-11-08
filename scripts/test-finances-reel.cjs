// ============================================================================
// FINANCES PLATEFORME — FOURNISSEUR RÉEL contre un FAUX client
// PostgREST contraint au schéma LIVE (2026-11-08).
//
// POURQUOI : la page console « Paie & Dépenses » tombait en erreur en
// production (« Une erreur est survenue. Réessayez. ») alors que les
// tests démo passaient : le fournisseur DÉMO ne connaît pas les vrais
// noms de colonnes. Le fournisseur réel ordonnait les dépenses par
// « created_at » — colonne INEXISTANTE sur depenses_plateforme (le
// timestamp s'appelle « cree_le », module-finances-plateforme.sql) —
// PostgREST répond 42703, le fournisseur jette, la page affiche le
// bandeau d'erreur. Ce test exécute le VRAI fournisseur (compilé)
// contre un double qui VALIDE chaque colonne (select / filtres /
// tris / insert / update) contre le schéma reconstruit depuis les
// modules SQL du dépôt (ceux appliqués au live, module coordonnées
// inclus) : toute référence à une colonne absente fait échouer la
// requête comme en production.
//
// Couvre aussi : émission de paie réelle (instantané coordonnées) et
// génération du TALON DE PAIE (données d'entrée capturées, accès
// employé limité à ses propres paies).
// ============================================================================
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const RACINE = path.join(__dirname, "..");
let ok = 0;
let ko = 0;
function check(nom, cond) {
  if (cond) { ok++; console.log("  OK  " + nom); }
  else { ko++; console.log("  KO  " + nom); }
}

// ---------------------------------------------------------------------------
// 1. Schéma LIVE reconstruit depuis les modules SQL du dépôt.
// ---------------------------------------------------------------------------
function construireSchema() {
  const schema = {};
  const dirSql = path.join(RACINE, "supabase");
  const fichiers = fs.readdirSync(dirSql).filter((f) => f.endsWith(".sql")).sort();
  const MOTS_STRUCTURE = new Set([
    "primary", "foreign", "unique", "check", "constraint", "references",
  ]);
  for (const f of fichiers) {
    const sql = fs.readFileSync(path.join(dirSql, f), "utf8");
    // CREATE TABLE : colonnes = premier mot de chaque ligne du bloc.
    const reCreate = /create table if not exists public\.(\w+) \(([\s\S]*?)\n\);/g;
    let m;
    while ((m = reCreate.exec(sql)) !== null) {
      const table = m[1];
      schema[table] = schema[table] || new Set();
      for (const ligneBrute of m[2].split("\n")) {
        const ligne = ligneBrute.replace(/--.*$/, "").trim();
        if (!ligne) continue;
        const premier = ligne.split(/[\s(]/)[0].toLowerCase();
        if (MOTS_STRUCTURE.has(premier)) continue;
        if (/^[a-z_][a-z0-9_]*$/.test(premier)) schema[table].add(premier);
      }
    }
    // ALTER TABLE ... ADD COLUMN (y compris les alters à colonnes
    // multiples : « add column if not exists a ..., add column ... »).
    const reAlterTable = /alter table public\.(\w+)([\s\S]*?);/g;
    while ((m = reAlterTable.exec(sql)) !== null) {
      const tableAlter = m[1];
      const corps = m[2];
      const reCol = /add column if not exists (\w+)/g;
      let mc;
      while ((mc = reCol.exec(corps)) !== null) {
        schema[tableAlter] = schema[tableAlter] || new Set();
        schema[tableAlter].add(mc[1]);
      }
    }
  }
  return schema;
}
const SCHEMA = construireSchema();
check("schéma : depenses_plateforme a « cree_le »", SCHEMA.depenses_plateforme?.has("cree_le"));
check("schéma : depenses_plateforme n'a PAS « created_at »", !SCHEMA.depenses_plateforme?.has("created_at"));
check("schéma : paies_employes a paiement_destination (module coordonnées)", SCHEMA.paies_employes?.has("paiement_destination"));
check("schéma : profils a paiement_numero_mobile", SCHEMA.profils?.has("paiement_numero_mobile"));

// ---------------------------------------------------------------------------
// 2. Faux client PostgREST (valide les colonnes comme la vraie base).
// ---------------------------------------------------------------------------
let compteurId = 0;
function nouvelId() {
  compteurId += 1;
  return `00000000-0000-4000-8000-${String(compteurId).padStart(12, "0")}`;
}

class RequeteFausse {
  constructor(client, table) {
    this.client = client;
    this.table = table;
    this.mode = "select";
    this.colonnesSelect = "*";
    this.filtres = [];
    this.tris = [];
    this.limiteN = null;
    this.ligneInsert = null;
    this.patchUpdate = null;
    this.retourApresEcriture = false;
  }
  select(cols) {
    if (this.mode === "insert" || this.mode === "update") {
      this.retourApresEcriture = true;
      return this;
    }
    this.colonnesSelect = typeof cols === "string" ? cols : "*";
    return this;
  }
  insert(ligne) { this.mode = "insert"; this.ligneInsert = ligne; return this; }
  update(patch) { this.mode = "update"; this.patchUpdate = patch; return this; }
  delete() { this.mode = "delete"; return this; }
  eq(c, v) { this.filtres.push(["eq", c, v]); return this; }
  neq(c, v) { this.filtres.push(["neq", c, v]); return this; }
  in(c, v) { this.filtres.push(["in", c, v]); return this; }
  gte(c, v) { this.filtres.push(["gte", c, v]); return this; }
  lte(c, v) { this.filtres.push(["lte", c, v]); return this; }
  lt(c, v) { this.filtres.push(["lt", c, v]); return this; }
  gt(c, v) { this.filtres.push(["gt", c, v]); return this; }
  order(c, opts) { this.tris.push([c, opts?.ascending !== false]); return this; }
  limit(n) { this.limiteN = n; return this; }
  maybeSingle() { return this.executer().then((r) => r.error ? r : { data: (r.data ?? [])[0] ?? null, error: null }); }
  single() {
    return this.executer().then((r) => {
      if (r.error) return r;
      const lignes = r.data ?? [];
      if (lignes.length !== 1) {
        return { data: null, error: { message: "JSON object requested, multiple (or no) rows returned", code: "PGRST116" } };
      }
      return { data: lignes[0], error: null };
    });
  }
  then(onF, onR) { return this.executer().then(onF, onR); }

  erreurColonne(col) {
    return {
      data: null,
      error: {
        message: `column ${this.table}.${col} does not exist`,
        code: "42703",
      },
    };
  }

  validerColonnes() {
    const cols = SCHEMA[this.table];
    if (!cols) return `relation "public.${this.table}" does not exist`;
    if (this.colonnesSelect !== "*") {
      for (const c of this.colonnesSelect.split(",").map((s) => s.trim()).filter(Boolean)) {
        if (!cols.has(c)) return c;
      }
    }
    for (const [, c] of this.filtres) if (!cols.has(c)) return c;
    for (const [c] of this.tris) if (!cols.has(c)) return c;
    if (this.mode === "insert" && this.ligneInsert) {
      for (const c of Object.keys(this.ligneInsert)) if (!cols.has(c)) return c;
    }
    if (this.mode === "update" && this.patchUpdate) {
      for (const c of Object.keys(this.patchUpdate)) if (!cols.has(c)) return c;
    }
    return null;
  }

  appliquerFiltres(lignes) {
    return lignes.filter((l) =>
      this.filtres.every(([op, c, v]) => {
        const val = l[c];
        switch (op) {
          case "eq": return val === v;
          case "neq": return val !== v;
          case "in": return Array.isArray(v) && v.includes(val);
          case "gte": return val >= v;
          case "lte": return val <= v;
          case "lt": return val < v;
          case "gt": return val > v;
          default: return true;
        }
      })
    );
  }

  async executer() {
    const mauvaise = this.validerColonnes();
    if (mauvaise) {
      if (mauvaise.startsWith("relation")) {
        return { data: null, error: { message: mauvaise, code: "42P01" } };
      }
      return this.erreurColonne(mauvaise);
    }
    const table = (this.client.donnees[this.table] ??= []);
    if (this.mode === "insert") {
      const ligne = { ...this.ligneInsert };
      const cols = SCHEMA[this.table];
      if (cols.has("id") && !ligne.id) ligne.id = nouvelId();
      const maintenant = new Date().toISOString();
      for (const c of ["cree_le", "created_at", "emis_le", "saisi_le"]) {
        if (cols.has(c) && ligne[c] === undefined) ligne[c] = maintenant;
      }
      table.push(ligne);
      return { data: this.retourApresEcriture ? [structuredClone(ligne)] : null, error: null };
    }
    if (this.mode === "update") {
      const touchees = this.appliquerFiltres(table);
      for (const l of touchees) Object.assign(l, this.patchUpdate);
      return { data: this.retourApresEcriture ? touchees.map((l) => structuredClone(l)) : null, error: null };
    }
    if (this.mode === "delete") {
      const gardees = table.filter((l) => !this.appliquerFiltres([l]).length);
      this.client.donnees[this.table] = gardees;
      return { data: null, error: null };
    }
    let lignes = this.appliquerFiltres(table).map((l) => structuredClone(l));
    for (const [c, asc] of [...this.tris].reverse()) {
      lignes.sort((a, b) => {
        const va = a[c] ?? "";
        const vb = b[c] ?? "";
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return asc ? cmp : -cmp;
      });
    }
    if (this.limiteN !== null) lignes = lignes.slice(0, this.limiteN);
    // Projection des colonnes demandées (comme PostgREST).
    if (this.colonnesSelect !== "*") {
      const demandees = this.colonnesSelect.split(",").map((s) => s.trim()).filter(Boolean);
      lignes = lignes.map((l) => {
        const out = {};
        for (const c of demandees) out[c] = l[c] ?? null;
        return out;
      });
    }
    return { data: lignes, error: null };
  }
}

function creerFauxClient(donnees, utilisateur) {
  const client = {
    donnees,
    utilisateur,
    auth: {
      getSession: async () => ({
        data: {
          session: client.utilisateur
            ? { user: { id: client.utilisateur.id, email: client.utilisateur.email } }
            : null,
        },
        error: null,
      }),
      getUser: async () => ({
        data: { user: client.utilisateur ? { id: client.utilisateur.id, email: client.utilisateur.email } : null },
        error: null,
      }),
    },
    from(table) { return new RequeteFausse(client, table); },
    storage: {
      from() {
        return {
          createSignedUrl: async (p) => ({ data: { signedUrl: `https://faux.test/signe/${p}` }, error: null }),
          upload: async () => ({ data: {}, error: null }),
          remove: async () => ({ data: [], error: null }),
        };
      },
    },
    __setUtilisateur(u) { client.utilisateur = u; },
  };
  return client;
}

// ---------------------------------------------------------------------------
// 3. Compilation du fournisseur réel (tsconfig dédié, cache par mtime).
// ---------------------------------------------------------------------------
const BUILD_REEL = path.join(RACINE, ".test-build-reel");
function compilerReel() {
  const cible = path.join(BUILD_REEL, "lib", "data", "real.js");
  const source = path.join(RACINE, "lib", "data", "real.ts");
  if (fs.existsSync(cible) && fs.statSync(cible).mtimeMs >= fs.statSync(source).mtimeMs) return;
  const tsconfig = {
    extends: "./tsconfig.json",
    compilerOptions: {
      outDir: ".test-build-reel",
      rootDir: ".",
      module: "commonjs",
      target: "es2020",
      moduleResolution: "node",
      noEmit: false,
      declaration: false,
      sourceMap: false,
      incremental: false,
    },
    files: ["lib/data/real.ts"],
  };
  fs.writeFileSync(path.join(RACINE, "tsconfig.reel-test.json"), JSON.stringify(tsconfig, null, 2));
  try {
    execSync("npx tsc -p tsconfig.reel-test.json", { cwd: RACINE, stdio: "pipe", timeout: 240000 });
  } finally {
    fs.unlinkSync(path.join(RACINE, "tsconfig.reel-test.json"));
  }
}

// ---------------------------------------------------------------------------
// 4. Données d'essai (lignes profils complétées depuis le schéma).
// ---------------------------------------------------------------------------
function ligneProfil(surcharges) {
  const ligne = {};
  for (const c of SCHEMA.profils) ligne[c] = null;
  return { ...ligne, ...surcharges };
}

async function principal() {
  compilerReel();

  // Injection du faux client dans le module supabase compilé.
  const moduleSupabase = require(path.join(BUILD_REEL, "lib", "supabase.js"));
  const { RealProvider } = require(path.join(BUILD_REEL, "lib", "data", "real.js"));
  // Capture des données d'entrée de la génération du talon.
  const moduleTalon = require(path.join(BUILD_REEL, "lib", "talon-paie.js"));
  const generationOriginale = moduleTalon.genererTalonPaiePdf;
  let donneesTalonCapturees = null;
  moduleTalon.genererTalonPaiePdf = async (donnees) => {
    donneesTalonCapturees = donnees;
    return generationOriginale(donnees);
  };

  const SUPER_ID = "11111111-1111-4111-8111-111111111111";
  const ADMIN_ID = "22222222-2222-4222-8222-222222222222";
  const superAdmin = { id: SUPER_ID, email: "super@faux.test" };
  const donnees = {
    profils: [
      ligneProfil({
        id: SUPER_ID, email: "super@faux.test", nom: "John Assu", role: "super_admin",
        display_id: "CIM-000001", langue: "fr", suspendu: false,
        acces_admin_actif: true, created_at: "2026-11-01T00:00:00Z",
      }),
      ligneProfil({
        id: ADMIN_ID, email: "admin@faux.test", nom: "Aline Uwase", role: "admin",
        display_id: "CIM-000003", langue: "fr", suspendu: false,
        acces_admin_actif: true, created_at: "2026-11-02T00:00:00Z",
        telephone: "+257 79 00 00 00",
        photo_profil_path: `${ADMIN_ID}/photo.jpg`,
        adresse: "6e Avenue 47", adresse_ville: "Bujumbura", adresse_pays: "Burundi",
        statut_contrat_employe: "valide",
        charte_acceptee_le: "2026-11-08T10:00:00Z",
        contrat_employe_voie: "travail", contrat_employe_type: "CDI",
        contrat_employe_montant: 500000, contrat_employe_devise: "BIF",
        contrat_employe_modalites: "Mensuel",
        paiement_moyen: "mobile_money", paiement_titulaire: "Aline Uwase",
        paiement_operateur: "EcoCash", paiement_numero_mobile: "+257 79 00 00 00",
      }),
    ],
    documents: [
      {
        id: "33333333-3333-4333-8333-333333333333", owner_id: ADMIN_ID,
        entite_type: "compte", entite_id: ADMIN_ID, type: "piece_identite",
        nom_fichier: "cni.pdf", storage_path: `${ADMIN_ID}/cni.pdf`,
        created_at: "2026-11-08T09:00:00Z",
      },
    ],
    paies_employes: [],
    depenses_plateforme: [
      {
        id: "44444444-4444-4444-8444-444444444444", date: "2026-12-05",
        libelle: "Hébergement annuel", categorie: "hebergement_services",
        montant: 120, devise: "USD", justificatif_path: null,
        saisi_par: SUPER_ID, statut: "en_attente", motif_refus: null,
        valide_par: null, valide_le: null, cree_le: "2026-12-05T10:00:00Z",
      },
      {
        id: "55555555-5555-4555-8555-555555555555", date: "2026-11-12",
        libelle: "Forfait internet", categorie: "communication",
        montant: 45, devise: "USD", justificatif_path: null,
        saisi_par: SUPER_ID, statut: "validee", motif_refus: null,
        valide_par: SUPER_ID, valide_le: "2026-11-13T10:00:00Z",
        cree_le: "2026-11-12T10:00:00Z",
      },
    ],
    journal_audit: [],
  };
  const fauxClient = creerFauxClient(donnees, superAdmin);
  moduleSupabase.getSupabaseBrowserClient = () => fauxClient;
  const provider = new RealProvider();

  // --- NON-RÉGRESSION DU BUG : la vue Finances charge (mois de la capture).
  let vue = null;
  let erreurVue = null;
  try {
    vue = await provider.getVueFinancesPlateforme("2026-12");
  } catch (e) {
    erreurVue = e;
  }
  check("vue Finances décembre 2026 : aucun rejet (bug créé_at corrigé)", !erreurVue);
  if (erreurVue) console.log("    rejet :", erreurVue.message);
  check("vue décembre : la dépense de décembre est listée", !!vue && vue.depenses.length === 1 && vue.depenses[0].libelle === "Hébergement annuel");
  check("vue décembre : created_at alimenté depuis cree_le", !!vue && vue.depenses[0].created_at === "2026-12-05T10:00:00Z");
  check("vue décembre : 2 lignes de paie (plateforme)", !!vue && vue.lignes_paie.length === 2);
  const ligneAdmin = vue?.lignes_paie.find((l) => l.compte_id === ADMIN_ID);
  check("vue : coordonnées de l'Admin exposées (mobile money)", !!ligneAdmin && ligneAdmin.coordonnees_paiement?.operateur === "EcoCash");
  check("vue : aucun blocage pour l'Admin (dossier+contrat+coordonnées)", !!ligneAdmin && ligneAdmin.blocages.length === 0);

  const vueNov = await provider.getVueFinancesPlateforme("2026-11");
  check("vue novembre : dépense de novembre seulement", vueNov.depenses.length === 1 && vueNov.depenses[0].libelle === "Forfait internet");

  // --- Émission réelle + instantané coordonnées.
  const paie = await provider.emettrePaieEmploye(ADMIN_ID, "2026-12");
  check("émission réelle : moyen copié", paie.paiement_moyen === "mobile_money");
  check(
    "émission réelle : destination instantanée composée",
    paie.paiement_destination === "Mobile money — EcoCash +257 79 00 00 00 — Aline Uwase"
  );
  let erreurDoublon = null;
  try {
    await provider.emettrePaieEmploye(ADMIN_ID, "2026-12");
  } catch (e) { erreurDoublon = e; }
  check("émission réelle : doublon refusé", erreurDoublon?.message === "ERR_PAIE_DEJA_EMISE");

  // --- TALON DE PAIE : données d'entrée de la génération (Super Admin).
  const talon = await provider.genererTalonPaie(paie.id);
  check("talon : un PDF base64 est retourné", typeof talon.contenuBase64 === "string" && talon.contenuBase64.length > 100);
  check("talon : nom de fichier (Display ID + mois)", talon.nomFichier === "talon-paie-CIM-000003-2026-12.pdf");
  check("talon : données d'entrée = montant instantané", donneesTalonCapturees?.montant === 500000 && donneesTalonCapturees?.devise === "BIF");
  check("talon : données d'entrée = destination instantanée", donneesTalonCapturees?.destination === "Mobile money — EcoCash +257 79 00 00 00 — Aline Uwase");
  check("talon : identité employé (nom + Display ID)", donneesTalonCapturees?.employeNom === "Aline Uwase" && donneesTalonCapturees?.employeDisplayId === "CIM-000003");
  check("talon : langue = langue du compte de l'employé", donneesTalonCapturees?.langue === "fr");
  check("talon : émis par le Super Admin", donneesTalonCapturees?.emisParNom === "John Assu");

  // --- TALON : accès employé limité à SES paies.
  const paieSuper = await provider.emettrePaieEmploye(SUPER_ID, "2026-12").catch(() => null);
  // Le Super Admin n'a ni dossier complet ni contrat : émission
  // attendue en échec — on insère directement une paie pour lui afin
  // de tester le refus d'accès croisé.
  if (!paieSuper) {
    donnees.paies_employes.push({
      id: "66666666-6666-4666-8666-666666666666", profil_id: SUPER_ID,
      mois: "2026-12", montant: 900000, devise: "BIF", modalites: "Mensuel",
      reference: null, statut: "emise", emis_par: SUPER_ID,
      emis_le: "2026-12-01T08:00:00Z", cree_le: "2026-12-01T08:00:00Z",
      paiement_moyen: "especes", paiement_destination: "Espèces — John Assu",
    });
  }
  const idPaieSuper = paieSuper?.id ?? "66666666-6666-4666-8666-666666666666";
  fauxClient.__setUtilisateur({ id: ADMIN_ID, email: "admin@faux.test" });
  const talonPropre = await provider.genererTalonPaie(paie.id);
  check("talon : l'employé télécharge SON talon", !!talonPropre.contenuBase64);
  let erreurAcces = null;
  try {
    await provider.genererTalonPaie(idPaieSuper);
  } catch (e) { erreurAcces = e; }
  check("talon : la paie d'un AUTRE est refusée à l'employé", erreurAcces?.message === "ERR_TALON_INTROUVABLE");
  let erreurInconnu = null;
  try {
    await provider.genererTalonPaie("99999999-9999-4999-8999-999999999999");
  } catch (e) { erreurInconnu = e; }
  check("talon : paie inexistante refusée proprement", erreurInconnu?.message === "ERR_TALON_INTROUVABLE");

  console.log(`\nFinances (fournisseur réel, faux PostgREST contraint) : ${ok} OK, ${ko} KO`);
  process.exit(ko > 0 ? 1 : 0);
}

principal().catch((e) => {
  console.error("ERREUR FATALE du test :", e);
  process.exit(1);
});

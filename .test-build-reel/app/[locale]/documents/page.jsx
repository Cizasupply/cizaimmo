"use strict";
"use client";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DocumentsPage;
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const navigation_1 = require("next/navigation");
const AppShell_1 = __importDefault(require("@/components/AppShell"));
const DocumentList_1 = __importDefault(require("@/components/DocumentList"));
const DocumentUpload_1 = __importStar(require("@/components/DocumentUpload"));
const EmptyState_1 = __importDefault(require("@/components/EmptyState"));
const Field_1 = __importDefault(require("@/components/Field"));
const Pagination_1 = __importDefault(require("@/components/Pagination"));
const data_1 = require("@/lib/data");
const data_2 = require("@/lib/data");
const translateError_1 = require("@/lib/translateError");
async function fichierVersDataUrl(fichier) {
    return new Promise((resolve, reject) => {
        const lecteur = new FileReader();
        lecteur.onload = () => resolve(String(lecteur.result));
        lecteur.onerror = () => reject(new Error("lecture"));
        lecteur.readAsDataURL(fichier);
    });
}
function DocumentsPage() {
    const t = (0, next_intl_1.useTranslations)("crud");
    const td = (0, next_intl_1.useTranslations)("documents");
    const tp = (0, next_intl_1.useTranslations)("pages");
    const tc = (0, next_intl_1.useTranslations)("crud.common");
    const locale = (0, next_intl_1.useLocale)();
    const router = (0, navigation_1.useRouter)();
    const [documents, setDocuments] = (0, react_1.useState)([]);
    const [immeubles, setImmeubles] = (0, react_1.useState)([]);
    const [appartements, setAppartements] = (0, react_1.useState)([]);
    const [locataires, setLocataires] = (0, react_1.useState)([]);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const [message, setMessage] = (0, react_1.useState)(null);
    const [recherche, setRecherche] = (0, react_1.useState)("");
    const [typeFiltre, setTypeFiltre] = (0, react_1.useState)("");
    const [entiteType, setEntiteType] = (0, react_1.useState)("");
    const [page, setPage] = (0, react_1.useState)(1);
    const [pageSize, setPageSize] = (0, react_1.useState)(20);
    const [aAjouter, setAAjouter] = (0, react_1.useState)(false);
    const [fichier, setFichier] = (0, react_1.useState)(null);
    const [typeDoc, setTypeDoc] = (0, react_1.useState)("autre");
    const [entiteTypeForm, setEntiteTypeForm] = (0, react_1.useState)("immeuble");
    const [entiteId, setEntiteId] = (0, react_1.useState)("");
    const [erreurForm, setErreurForm] = (0, react_1.useState)(null);
    const [envoi, setEnvoi] = (0, react_1.useState)(false);
    async function charger() {
        setChargement(true);
        setErreur(null);
        try {
            const p = (0, data_1.getDataProvider)();
            const session = await p.getSession();
            if (!session) {
                router.push(`/${locale}/connexion`);
                return;
            }
            const [docs, ims, apts, locs] = await Promise.all([
                p.listerDocuments(),
                p.listerImmeubles(true),
                p.listerAppartements({ inclureArchives: true }),
                p.listerLocataires(),
            ]);
            setDocuments(docs);
            setImmeubles(ims);
            setAppartements(apts);
            setLocataires(locs);
        }
        catch (e) {
            setErreur((0, translateError_1.messageErreur)(t, e));
        }
        finally {
            setChargement(false);
        }
    }
    (0, react_1.useEffect)(() => {
        charger();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const nomEntite = (d) => {
        switch (d.entite_type) {
            case "immeuble":
                return immeubles.find((i) => i.id === d.entite_id)?.nom ?? "—";
            case "appartement": {
                const a = appartements.find((x) => x.id === d.entite_id);
                return a ? `${a.numero} — ${immeubles.find((i) => i.id === a.immeuble_id)?.nom ?? ""}` : "—";
            }
            case "locataire":
                return locataires.find((l) => l.id === d.entite_id)?.nom ?? "—";
            default:
                return d.entite_id.slice(0, 8);
        }
    };
    const filtres = (0, react_1.useMemo)(() => {
        const q = recherche.trim().toLowerCase();
        return documents
            .filter((d) => !typeFiltre || d.type === typeFiltre)
            .filter((d) => !entiteType || d.entite_type === entiteType)
            .filter((d) => !q || d.nom_fichier.toLowerCase().includes(q));
    }, [documents, recherche, typeFiltre, entiteType]);
    const pageDocs = (0, react_1.useMemo)(() => filtres.slice((page - 1) * pageSize, page * pageSize), [filtres, page, pageSize]);
    const entitesForm = entiteTypeForm === "immeuble"
        ? immeubles.map((i) => ({ id: i.id, label: i.nom }))
        : entiteTypeForm === "appartement"
            ? appartements.map((a) => ({ id: a.id, label: `${a.numero} — ${immeubles.find((i) => i.id === a.immeuble_id)?.nom ?? ""}` }))
            : entiteTypeForm === "locataire"
                ? locataires.map((l) => ({ id: l.id, label: l.nom }))
                : [];
    async function handleTeleverser(e) {
        e.preventDefault();
        setErreurForm(null);
        if (!fichier) {
            setErreurForm(td("errorNoFile"));
            return;
        }
        if ((0, DocumentUpload_1.fichierValide)(fichier)) {
            setErreurForm(td("errorFormat"));
            return;
        }
        if (!entiteId) {
            setErreurForm(td("errorNoEntity"));
            return;
        }
        setEnvoi(true);
        try {
            const p = (0, data_1.getDataProvider)();
            const contenu = await fichierVersDataUrl(fichier);
            const doc = await p.televerserDocument({
                type: typeDoc,
                entite_type: entiteTypeForm,
                entite_id: entiteId,
                nom_fichier: fichier.name,
                contenu,
                taille_octets: fichier.size,
                mime_type: fichier.type,
            });
            setAAjouter(false);
            setFichier(null);
            setEntiteId("");
            setMessage(doc.contenu_non_conserve ? td("uploadedButNotKept") : tc("created"));
            await charger();
        }
        catch (err) {
            setErreurForm((0, translateError_1.messageErreur)(t, err));
        }
        finally {
            setEnvoi(false);
        }
    }
    return (<AppShell_1.default title={tp("documents.title")}>
      {message ? (<p role="status" className="mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-800">
          {message}
        </p>) : null}
      {erreur ? (<div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {erreur}
          <button type="button" onClick={charger} className="ml-3 font-bold underline">
            {tc("retry")}
          </button>
        </div>) : null}

      {chargement ? (<div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (<div key={i} className="h-16 animate-pulse rounded-2xl bg-white shadow-sm"/>))}
          <p className="text-sm text-slate-500">{tc("loading")}</p>
        </div>) : documents.length === 0 && !aAjouter ? (<EmptyState_1.default title={td("emptyTitle")} text={td("emptyText")} actionLabel={td("upload")} onAction={() => setAAjouter(true)}/>) : (<>
          <div className="mb-4">
            <button type="button" onClick={() => setAAjouter((v) => !v)} className="rounded-full border border-navy bg-white px-5 py-2.5 text-sm font-semibold text-navy hover:bg-navy/5">
              {td("upload")}
            </button>
          </div>

          {aAjouter ? (<form onSubmit={handleTeleverser} noValidate className="mb-4 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <DocumentUpload_1.default fichier={fichier} onFichierChange={setFichier}/>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field_1.default id="doc-type" label={td("type")} value={typeDoc} onChange={(v) => setTypeDoc(v)}>
                  {data_2.TYPES_DOCUMENT.map((ty) => (<option key={ty} value={ty}>{td(`types.${ty}`)}</option>))}
                </Field_1.default>
                <Field_1.default id="doc-entite-type" label={td("linkedTo")} value={entiteTypeForm} onChange={(v) => { setEntiteTypeForm(v); setEntiteId(""); }}>
                  <option value="immeuble">{td("entityBuilding")}</option>
                  <option value="appartement">{td("entityApartment")}</option>
                  <option value="locataire">{td("entityTenant")}</option>
                </Field_1.default>
              </div>
              <Field_1.default id="doc-entite" label={td("entity")} value={entiteId} onChange={setEntiteId}>
                <option value="">{td("chooseEntity")}</option>
                {entitesForm.map((en) => (<option key={en.id} value={en.id}>{en.label}</option>))}
              </Field_1.default>
              {erreurForm ? (<p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{erreurForm}</p>) : null}
              <button type="submit" disabled={envoi} className="w-full rounded-full bg-gold px-6 py-3 text-base font-bold text-navy hover:bg-gold-light disabled:opacity-50 sm:w-auto">
                {envoi ? tc("saving") : td("uploadButton")}
              </button>
            </form>) : null}

          <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
            <label className="block text-sm font-semibold text-slate-900">
              {tc("search")}
              <input value={recherche} onChange={(e) => { setRecherche(e.target.value); setPage(1); }} placeholder={td("searchPlaceholder")} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base font-normal outline-none focus:border-gold"/>
            </label>
            <label className="block text-sm font-semibold text-slate-900">
              {td("type")}
              <select value={typeFiltre} onChange={(e) => { setTypeFiltre(e.target.value); setPage(1); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-normal outline-none focus:border-gold">
                <option value="">{tc("all")}</option>
                {data_2.TYPES_DOCUMENT.map((ty) => (<option key={ty} value={ty}>{td(`types.${ty}`)}</option>))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-900">
              {td("linkedTo")}
              <select value={entiteType} onChange={(e) => { setEntiteType(e.target.value); setPage(1); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-normal outline-none focus:border-gold">
                <option value="">{tc("all")}</option>
                <option value="immeuble">{td("entityBuilding")}</option>
                <option value="appartement">{td("entityApartment")}</option>
                <option value="locataire">{td("entityTenant")}</option>
                <option value="bail">{td("entityLease")}</option>
                <option value="depense">{td("entityExpense")}</option>
              </select>
            </label>
          </div>

          {filtres.length === 0 ? (<p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600 shadow-sm">{tc("noResults")}</p>) : (<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <DocumentList_1.default documents={pageDocs} onChange={charger} showEntity nomEntite={nomEntite}/>
              <Pagination_1.default page={page} pageSize={pageSize} total={filtres.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} perPageLabel={tc("perPage")} showingLabel={(from, to, total) => tc("showing", { from, to, total })}/>
            </div>)}
        </>)}
    </AppShell_1.default>);
}

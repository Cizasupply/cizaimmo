"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DocumentList;
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const ConfirmDialog_1 = __importDefault(require("@/components/ConfirmDialog"));
const format_1 = require("@/lib/format");
const data_1 = require("@/lib/data");
const translateError_1 = require("@/lib/translateError");
const next_intl_2 = require("next-intl");
const DocumentUpload_1 = require("@/components/DocumentUpload");
/**
 * Liste des documents liés à une entité (fiche immeuble / appartement /
 * locataire, page Documents) : téléchargement (lien signé en réel),
 * renommage, suppression avec confirmation nommant l'élément.
 * En démo, un document dont le contenu n'a pas pu être conservé (fichier
 * trop gros pour localStorage) l'affiche honnêtement au lieu de prétendre
 * le conserver.
 */
function DocumentList({ documents, onChange, showEntity = false, nomEntite, }) {
    const t = (0, next_intl_1.useTranslations)("documents");
    const tc = (0, next_intl_1.useTranslations)("crud.common");
    const locale = (0, next_intl_2.useLocale)();
    const [aRenommer, setARenommer] = (0, react_1.useState)(null);
    const [nouveauNom, setNouveauNom] = (0, react_1.useState)("");
    const [aSupprimer, setASupprimer] = (0, react_1.useState)(null);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const [action, setAction] = (0, react_1.useState)(null);
    function typeLabel(type) {
        return t(`types.${type}`);
    }
    /** Pastille discrète par type de document (palette de l'app, sans arc-en-ciel). */
    function couleurTypeDocument(type) {
        switch (type) {
            case "bail":
                return "bg-green-100 text-green-800";
            case "justificatif":
                return "bg-amber-100 text-amber-800";
            case "autorisation":
                return "bg-indigo-100 text-indigo-800";
            case "facture":
                return "bg-orange-100 text-orange-800";
            case "piece_identite":
            case "autre":
            default:
                return "bg-slate-100 text-slate-700";
        }
    }
    async function telecharger(doc) {
        setErreur(null);
        setAction(doc.id);
        try {
            const { url, nomFichier } = await (0, data_1.getDataProvider)().telechargerDocument(doc.id);
            const a = document.createElement("a");
            a.href = url;
            a.download = nomFichier;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            document.body.appendChild(a);
            a.click();
            a.remove();
        }
        catch (e) {
            setErreur((0, translateError_1.messageErreur)(t, e));
        }
        finally {
            setAction(null);
        }
    }
    async function confirmerRenommage() {
        if (!aRenommer || !nouveauNom.trim())
            return;
        setErreur(null);
        try {
            await (0, data_1.getDataProvider)().renommerDocument(aRenommer.id, nouveauNom.trim());
            setARenommer(null);
            onChange();
        }
        catch (e) {
            setErreur((0, translateError_1.messageErreur)(t, e));
        }
    }
    async function confirmerSuppression() {
        if (!aSupprimer)
            return;
        setErreur(null);
        try {
            await (0, data_1.getDataProvider)().supprimerDocument(aSupprimer.id);
            setASupprimer(null);
            onChange();
        }
        catch (e) {
            setErreur((0, translateError_1.messageErreur)(t, e));
        }
    }
    if (documents.length === 0) {
        return <p className="mt-2 text-slate-600">{t("empty")}</p>;
    }
    return (<div>
      {erreur ? (<p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {erreur}
        </p>) : null}
      <ul className="divide-y divide-slate-200">
        {documents.map((doc) => (<li key={doc.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-navy" title={doc.nom_fichier}>{doc.nom_fichier}</p>
              <p className="break-words text-sm text-slate-600">
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${couleurTypeDocument(doc.type)}`}>
                  {typeLabel(doc.type)}
                </span>
                {showEntity && nomEntite ? ` · ${nomEntite(doc)}` : ""}
                {` · ${(0, format_1.formatDate)(doc.created_at.slice(0, 10), locale)}`}
                {doc.taille_octets !== null && doc.taille_octets !== undefined ? ` · ${(0, DocumentUpload_1.tailleMo)(doc.taille_octets)}` : ""}
              </p>
              {doc.contenu_non_conserve ? (<p className="text-sm font-medium text-amber-700">{t("demoContentNotKept")}</p>) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button type="button" disabled={doc.contenu_non_conserve || action === doc.id} onClick={() => telecharger(doc)} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy disabled:opacity-40">
                {t("download")}
              </button>
              <button type="button" onClick={() => {
                setARenommer(doc);
                setNouveauNom(doc.nom_fichier);
            }} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy">
                {t("rename")}
              </button>
              <button type="button" onClick={() => setASupprimer(doc)} className="rounded-full border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700">
                {tc("delete")}
              </button>
            </div>
          </li>))}
      </ul>

      {aRenommer ? (<div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-navy">{t("renameTitle")}</h2>
            <label htmlFor="nouveau-nom" className="mt-4 block text-sm font-semibold text-slate-900">
              {t("fileName")}
            </label>
            <input id="nouveau-nom" value={nouveauNom} onChange={(e) => setNouveauNom(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-gold"/>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setARenommer(null)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-navy">
                {tc("cancel")}
              </button>
              <button type="button" onClick={confirmerRenommage} className="rounded-full border border-navy bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-navy/5">
                {tc("save")}
              </button>
            </div>
          </div>
        </div>) : null}

      {aSupprimer ? (<ConfirmDialog_1.default title={t("confirmDelete", { name: aSupprimer.nom_fichier })} text={t("confirmDeleteText")} confirmLabel={tc("delete")} cancelLabel={tc("cancel")} onConfirm={confirmerSuppression} onCancel={() => setASupprimer(null)}/>) : null}
    </div>);
}

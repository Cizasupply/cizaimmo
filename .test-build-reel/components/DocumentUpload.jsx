"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fichierValide = fichierValide;
exports.tailleMo = tailleMo;
exports.default = DocumentUpload;
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const data_1 = require("@/lib/data");
/**
 * Sélecteur de fichier pour un document (spec §6, §8) : PDF, JPG, PNG
 * et HEIC/HEIF (format photo natif de l'iPhone — correctif 2026-11-08 :
 * un contrat signé photographié à l'iPhone était IMPOSSIBLE à déposer,
 * le fichier .heic était grisé dans le sélecteur iOS puis refusé ici),
 * 10 Mo maximum — la limite est affichée AVANT l'envoi. Le fichier choisi
 * est rendu à l'appelant (File) ; c'est l'appelant qui le téléverse via
 * le fournisseur (démo : métadonnées + contenu si < 1 Mo ; réel : Storage
 * privé). Aucun envoi n'est fait ici. La liste d'extensions est la même
 * que celle des fournisseurs (EXTENSIONS_DOCUMENT_ACCEPTEES, lib/data).
 *
 * OUVERTURE DU SÉLECTEUR — correctif 2026-11-08 (point 7, symptôme
 * fondateur : « quand tu cliques sur le bouton, il ne réagissait
 * pas ») : le bouton est un <label htmlFor> lié à l'input par un id
 * stable (useId), JAMAIS un clic scripté (ref.click()) sur un input
 * en display:none — iOS Safari IGNORE le clic programmé sur un
 * input fichier display:none : aucun sélecteur, aucune erreur, un
 * bouton parfaitement mort sur iPhone (le bureau l'honore, d'où le
 * faux positif des tests bureau). L'activation par label est
 * NATIVE : elle ouvre le sélecteur partout, iPhone compris, et
 * l'input n'est plus en display:none (sr-only).
 */
function fichierValide(fichier) {
    const extension = fichier.name.split(".").pop()?.toLowerCase() ?? "";
    if (!data_1.EXTENSIONS_DOCUMENT_ACCEPTEES.includes(extension))
        return "format";
    if (fichier.size > data_1.TAILLE_MAX_DOCUMENT_OCTETS)
        return "tropGros";
    return null;
}
function tailleMo(octets) {
    return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}
function DocumentUpload({ fichier, onFichierChange, label, }) {
    const t = (0, next_intl_1.useTranslations)("documents");
    // Id stable et unique par instance (plusieurs sélecteurs peuvent
    // coexister sur la même page : photo, pièce, contrat…).
    const inputId = `fichier-${(0, react_1.useId)().replace(/:/g, "")}`;
    const [erreur, setErreur] = (0, react_1.useState)(null);
    function choisir(f) {
        if (!f) {
            setErreur(null);
            onFichierChange(null);
            return;
        }
        const probleme = fichierValide(f);
        if (probleme === "format") {
            setErreur(t("errorFormat"));
            return;
        }
        if (probleme === "tropGros") {
            setErreur(t("errorTooBig", { max: "10 Mo" }));
            return;
        }
        setErreur(null);
        onFichierChange(f);
    }
    return (<div>
      <p className="text-sm font-semibold text-slate-900">{label ?? t("uploadLabel")}</p>
      <p className="mt-1 text-sm text-slate-600">{t("uploadHint")}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label htmlFor={inputId} className="cursor-pointer rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy hover:border-gold">
          {fichier ? t("changeFile") : t("chooseFile")}
        </label>
        {fichier ? (<span className="text-sm text-slate-700">
            {fichier.name} ({tailleMo(fichier.size)})
            <button type="button" onClick={() => choisir(null)} className="ml-2 font-semibold text-navy underline">
              {t("removeFile")}
            </button>
          </span>) : null}
      </div>
      <input id={inputId} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,image/jpeg,image/png,image/heic,image/heif" className="sr-only" onChange={(e) => choisir(e.target.files?.[0] ?? null)}/>
      {erreur ? (<p role="alert" className="mt-2 text-sm font-medium text-red-600">
          {erreur}
        </p>) : null}
    </div>);
}

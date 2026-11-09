"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DossierBloc;
/**
 * Bloc « Complétez votre dossier » (v1.3) — affiché sur l'écran
 * d'attente d'approbation : téléversement de la photo de profil et de
 * la pièce d'identité (bucket privé, via le fournisseur), états
 * visibles (manquant / reçu). L'examen du compte commence quand le
 * dossier est complet ; un dossier incomplet n'empêche pas l'Admin de
 * décider, mais la console le signale.
 */
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const data_1 = require("@/lib/data");
const DocumentUpload_1 = __importDefault(require("@/components/DocumentUpload"));
function fichierVersDataUrl(fichier) {
    return new Promise((resolve, reject) => {
        const lecteur = new FileReader();
        lecteur.onload = () => resolve(lecteur.result);
        lecteur.onerror = () => reject(new Error("lecture"));
        lecteur.readAsDataURL(fichier);
    });
}
function LigneDossier({ recu, children, }) {
    const t = (0, next_intl_1.useTranslations)("dossier");
    return (<div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${recu ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
          {recu ? `✓ ${t("received")}` : t("missing")}
        </span>
      </div>
      <div className="mt-2">{children}</div>
    </div>);
}
function DossierBloc({ profil }) {
    const t = (0, next_intl_1.useTranslations)("dossier");
    const [photoRecue, setPhotoRecue] = (0, react_1.useState)(Boolean(profil.photo_profil_path));
    const [pieceRecue, setPieceRecue] = (0, react_1.useState)(false);
    const [fichierPhoto, setFichierPhoto] = (0, react_1.useState)(null);
    const [fichierPiece, setFichierPiece] = (0, react_1.useState)(null);
    const [occupe, setOccupe] = (0, react_1.useState)(null);
    const [message, setMessage] = (0, react_1.useState)(null);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const chargerEtats = (0, react_1.useCallback)(async () => {
        try {
            const docs = await (0, data_1.getDataProvider)().listerDocuments();
            setPieceRecue(docs.some((d) => d.entite_type === "compte" &&
                d.type === "piece_identite" &&
                d.entite_id === profil.id));
        }
        catch {
            // États inconnus : les puces restent « manquant », sans bloquer.
        }
    }, [profil.id]);
    (0, react_1.useEffect)(() => {
        chargerEtats();
    }, [chargerEtats]);
    async function envoyer(kind) {
        const fichier = kind === "photo" ? fichierPhoto : fichierPiece;
        if (!fichier)
            return;
        setOccupe(kind);
        setMessage(null);
        setErreur(null);
        try {
            const contenu = await fichierVersDataUrl(fichier);
            const provider = (0, data_1.getDataProvider)();
            if (kind === "photo") {
                await provider.televerserPhotoProfil({
                    type: "autre",
                    entite_type: "compte",
                    entite_id: profil.id,
                    nom_fichier: fichier.name,
                    taille_octets: fichier.size,
                    mime_type: fichier.type || null,
                    contenu,
                });
                setPhotoRecue(true);
                setFichierPhoto(null);
            }
            else {
                await provider.soumettreDocumentCompte("piece_identite", {
                    type: "piece_identite",
                    entite_type: "compte",
                    entite_id: profil.id,
                    nom_fichier: fichier.name,
                    taille_octets: fichier.size,
                    mime_type: fichier.type || null,
                    contenu,
                });
                setPieceRecue(true);
                setFichierPiece(null);
            }
            setMessage(t("uploadDone"));
        }
        catch (e) {
            const code = e instanceof Error ? e.message : "";
            setErreur(code === "ERR_DOCUMENT_DOUBLON"
                ? t("errorDuplicate")
                : code === "ERR_DOCUMENT_FORMAT"
                    ? t("errorFormat")
                    : code === "ERR_DOCUMENT_TROP_GROS"
                        ? t("errorTooBig")
                        : t("errorGeneric"));
        }
        finally {
            setOccupe(null);
        }
    }
    return (<div className="text-left">
      <h2 className="text-base font-bold text-navy">{t("title")}</h2>
      <p className="mt-1 text-sm text-slate-600">{t("intro")}</p>
      <div className="mt-3 space-y-3">
        <LigneDossier recu={photoRecue}>
          <DocumentUpload_1.default fichier={fichierPhoto} onFichierChange={setFichierPhoto} label={t("photoLabel")}/>
          {fichierPhoto ? (<button type="button" disabled={occupe !== null} onClick={() => envoyer("photo")} className="mt-2 rounded-full bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-light disabled:opacity-50">
              {occupe === "photo" ? t("sending") : t("send")}
            </button>) : null}
        </LigneDossier>
        <LigneDossier recu={pieceRecue}>
          <DocumentUpload_1.default fichier={fichierPiece} onFichierChange={setFichierPiece} label={t("idLabel")}/>
          {fichierPiece ? (<button type="button" disabled={occupe !== null} onClick={() => envoyer("piece")} className="mt-2 rounded-full bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-light disabled:opacity-50">
              {occupe === "piece" ? t("sending") : t("send")}
            </button>) : null}
        </LigneDossier>
      </div>
      {message ? (<p role="status" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
          {message}
        </p>) : null}
      {erreur ? (<p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {erreur}
        </p>) : null}
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{t("reviewNote")}</p>
    </div>);
}

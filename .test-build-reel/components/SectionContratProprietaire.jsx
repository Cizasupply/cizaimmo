"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SectionContratProprietaire;
/**
 * Espace propriétaire (option C, 2026-11-08) — « Mon contrat de
 * service ». Déclinaison NON BLOQUANTE de la section contrat
 * gestionnaire (v1.3) : le contrat, déjà signé et cacheté côté
 * entreprise, est téléchargé, signé, puis redéposé ; un Admin le
 * valide ou le refuse (avec motif). Aucun état ne verrouille quoi
 * que ce soit — l'accès et l'essai courent depuis l'approbation.
 */
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const DocumentUpload_1 = __importDefault(require("@/components/DocumentUpload"));
const data_1 = require("@/lib/data");
function fichierVersDataUrl(fichier) {
    return new Promise((resolve, reject) => {
        const lecteur = new FileReader();
        lecteur.onload = () => resolve(lecteur.result);
        lecteur.onerror = () => reject(new Error("lecture"));
        lecteur.readAsDataURL(fichier);
    });
}
const COULEUR_STATUT = {
    sans_objet: "bg-slate-200 text-slate-700",
    a_signer: "bg-amber-100 text-amber-800",
    signe_depose: "bg-sky-100 text-sky-800",
    valide: "bg-green-100 text-green-800",
    refuse: "bg-red-100 text-red-800",
};
function SectionContratProprietaire() {
    const t = (0, next_intl_1.useTranslations)("contratProp");
    const [profil, setProfil] = (0, react_1.useState)(null);
    const [statut, setStatut] = (0, react_1.useState)("sans_objet");
    const [motif, setMotif] = (0, react_1.useState)(null);
    const [displayId, setDisplayId] = (0, react_1.useState)(null);
    const [nomFichier, setNomFichier] = (0, react_1.useState)("");
    const [contenuBase64, setContenuBase64] = (0, react_1.useState)(null);
    const [fichierSigne, setFichierSigne] = (0, react_1.useState)(null);
    const [occupe, setOccupe] = (0, react_1.useState)(false);
    const [message, setMessage] = (0, react_1.useState)(null);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const charger = (0, react_1.useCallback)(async () => {
        const provider = (0, data_1.getDataProvider)();
        const [p, contrat] = await Promise.all([
            provider.getProfil(),
            provider.getMonContratProprietaire(),
        ]);
        setProfil(p);
        setStatut(contrat.statut);
        setMotif(contrat.motif);
        setDisplayId(contrat.display_id);
        setNomFichier(contrat.nomFichier);
        setContenuBase64(contrat.contenuBase64);
    }, []);
    (0, react_1.useEffect)(() => {
        charger().catch(() => undefined);
    }, [charger]);
    function telecharger() {
        if (!contenuBase64)
            return;
        const octets = Uint8Array.from(atob(contenuBase64), (c) => c.charCodeAt(0));
        const blob = new Blob([octets], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nomFichier || "contrat-proprietaire.pdf";
        a.click();
        URL.revokeObjectURL(url);
    }
    async function envoyerContratSigne() {
        if (!fichierSigne || !profil)
            return;
        setOccupe(true);
        setMessage(null);
        setErreur(null);
        try {
            const contenu = await fichierVersDataUrl(fichierSigne);
            await (0, data_1.getDataProvider)().televerserContratProprietaireSigne({
                type: "contrat",
                entite_type: "compte",
                entite_id: profil.id,
                nom_fichier: fichierSigne.name,
                taille_octets: fichierSigne.size,
                mime_type: fichierSigne.type || null,
                contenu,
            });
            setFichierSigne(null);
            setMessage(t("sentMsg"));
            await charger();
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
            setOccupe(false);
        }
    }
    const depotOuvert = statut === "a_signer" || statut === "signe_depose" || statut === "refuse";
    return (<section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {message ? (<p role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
          {message}
        </p>) : null}
      {erreur ? (<p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {erreur}
        </p>) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-navy">{t("title")}</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${COULEUR_STATUT[statut]}`}>
          {t(`status.${statut}`)}
        </span>
      </div>
      {displayId ? (<p className="mt-2 text-sm text-slate-600">
          {t("yourDisplayId")} :{" "}
          <strong className="whitespace-nowrap font-bold tracking-wide text-navy">{displayId}</strong>
        </p>) : null}
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {t(`explain.${statut}`)}
      </p>
      <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
        ✓ {t("nonBlockingNote")}
      </p>
      {statut === "refuse" && motif ? (<p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {t("refusalReason")} : {motif}
        </p>) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={telecharger} disabled={!contenuBase64} className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:bg-gold-light disabled:opacity-50">
          ⬇ {t("downloadContract")}
        </button>
      </div>
      {depotOuvert ? (<div className="mt-5 border-t border-slate-100 pt-4">
          <DocumentUpload_1.default fichier={fichierSigne} onFichierChange={setFichierSigne} label={t("uploadSignedLabel")}/>
          {fichierSigne ? (<button type="button" disabled={occupe} onClick={envoyerContratSigne} className="mt-2 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy-dark hover:brightness-105 disabled:opacity-50">
              {occupe ? t("sending") : t("sendSigned")}
            </button>) : null}
        </div>) : null}
    </section>);
}

"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ContratPage;
/**
 * Espace gestionnaire (v1.3) — « Mon contrat » + demandes de
 * rattachement reçues.
 *
 * Le contrat de collaboration est généré par CizaImmo (cachet officiel
 * apposé électroniquement côté entreprise) : le gestionnaire le
 * télécharge, le signe, puis téléverse le contrat SIGNÉ. Un Admin le
 * valide → statut « valide » → fonctions gestionnaire débloquées.
 * Tant que le contrat n'est pas validé, les demandes de rattachement
 * ne peuvent pas être acceptées (verrou appliqué aussi côté données).
 */
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const AppShell_1 = __importDefault(require("@/components/AppShell"));
const DiscussionRattachement_1 = __importDefault(require("@/components/DiscussionRattachement"));
const SectionContratProprietaire_1 = __importDefault(require("@/components/SectionContratProprietaire"));
const LienGuideUtilisation_1 = __importDefault(require("@/components/LienGuideUtilisation"));
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
const COULEUR_CONTRAT = {
    sans_objet: "bg-slate-200 text-slate-700",
    a_signer: "bg-amber-100 text-amber-800",
    signe_recu: "bg-sky-100 text-sky-800",
    valide: "bg-green-100 text-green-800",
};
function ContratPage() {
    const t = (0, next_intl_1.useTranslations)("dossier");
    const [profil, setProfil] = (0, react_1.useState)(null);
    const [statut, setStatut] = (0, react_1.useState)("sans_objet");
    const [displayId, setDisplayId] = (0, react_1.useState)(null);
    const [nomFichier, setNomFichier] = (0, react_1.useState)("");
    const [contenuBase64, setContenuBase64] = (0, react_1.useState)(null);
    const [demandes, setDemandes] = (0, react_1.useState)([]);
    const [fichierSigne, setFichierSigne] = (0, react_1.useState)(null);
    const [occupe, setOccupe] = (0, react_1.useState)(false);
    const [message, setMessage] = (0, react_1.useState)(null);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const charger = (0, react_1.useCallback)(async () => {
        const provider = (0, data_1.getDataProvider)();
        const [p, contrat, liste] = await Promise.all([
            provider.getProfil(),
            provider.getMonContrat(),
            provider.listerDemandesRattachement(),
        ]);
        setProfil(p);
        setStatut(contrat.statut);
        setDisplayId(contrat.display_id);
        setNomFichier(contrat.nomFichier);
        setContenuBase64(contrat.contenuBase64);
        // Demandes REÇUES : celles dont je suis le gestionnaire destinataire.
        setDemandes(liste.filter((d) => p
            ? d.gestionnaire_email.toLowerCase() === p.email.toLowerCase()
            : false));
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
        a.download = nomFichier || "contrat-gestionnaire.pdf";
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
            await (0, data_1.getDataProvider)().televerserContratSigne({
                type: "contrat",
                entite_type: "compte",
                entite_id: profil.id,
                nom_fichier: fichierSigne.name,
                taille_octets: fichierSigne.size,
                mime_type: fichierSigne.type || null,
                contenu,
            });
            setFichierSigne(null);
            setMessage(t("contractSentMsg"));
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
    async function repondre(demande, accepter) {
        setOccupe(true);
        setMessage(null);
        setErreur(null);
        try {
            await (0, data_1.getDataProvider)().repondreDemandeRattachement(demande.id, accepter);
            setMessage(accepter ? t("requestAcceptedMsg") : t("requestRefusedMsg"));
            await charger();
        }
        catch (e) {
            const code = e instanceof Error ? e.message : "";
            setErreur(code === "ERR_CONTRAT_NON_VALIDE" ? t("lockMessage") : t("errorGeneric"));
        }
        finally {
            setOccupe(false);
        }
    }
    const verrouille = statut !== "valide";
    // Option C : un compte à intention PROPRIÉTAIRE voit ici son contrat
    // de service (non bloquant) — pas la section gestionnaire ni le
    // verrou « fonctions débloquées », qui ne le concernent pas.
    if (profil?.type_intention === "proprietaire") {
        return (<AppShell_1.default title={t("contractTitle")}>
        <SectionContratProprietaire_1.default />
        <LienGuideUtilisation_1.default />
      </AppShell_1.default>);
    }
    return (<AppShell_1.default title={t("contractTitle")}>
      {message ? (<p role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
          {message}
        </p>) : null}
      {erreur ? (<p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {erreur}
        </p>) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-navy">{t("contractTitle")}</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${COULEUR_CONTRAT[statut]}`}>
            {t(`contractStatus.${statut}`)}
          </span>
        </div>
        {displayId ? (<p className="mt-2 text-sm text-slate-600">
            {t("yourDisplayId")} :{" "}
            <strong className="whitespace-nowrap font-bold tracking-wide text-navy">{displayId}</strong>
          </p>) : null}
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {t(`contractExplain.${statut}`)}
        </p>
        {verrouille ? (<p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            🔒 {t("lockMessage")}
          </p>) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={telecharger} disabled={!contenuBase64} className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:bg-gold-light disabled:opacity-50">
            ⬇ {t("downloadContract")}
          </button>
        </div>
        {statut === "a_signer" || statut === "signe_recu" ? (<div className="mt-5 border-t border-slate-100 pt-4">
            <DocumentUpload_1.default fichier={fichierSigne} onFichierChange={setFichierSigne} label={t("uploadSignedLabel")}/>
            {fichierSigne ? (<button type="button" disabled={occupe} onClick={envoyerContratSigne} className="mt-2 rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy-dark hover:brightness-105 disabled:opacity-50">
                {occupe ? t("sending") : t("sendSigned")}
              </button>) : null}
          </div>) : null}
      </section>

      <LienGuideUtilisation_1.default />

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-navy">{t("requestsTitle")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("requestsText")}</p>
        {demandes.length === 0 ? (<p className="mt-3 text-sm text-slate-500">{t("noRequests")}</p>) : (<ul className="mt-4 space-y-3">
            {demandes.map((d) => (<li key={d.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-navy">{d.proprietaire_nom}</p>
                    <p className="text-xs text-slate-500">
                      {t("requestFrom")} · {new Date(d.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                    {t(`requestStatus.${d.statut}`)}
                  </span>
                </div>
                {d.statut === "en_attente_gestionnaire" ? (<div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={occupe} onClick={() => repondre(d, true)} className="rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
                      ✓ {t("accept")}
                    </button>
                    <button type="button" disabled={occupe} onClick={() => repondre(d, false)} className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
                      ✕ {t("refuse")}
                    </button>
                  </div>) : null}
                {d.statut === "en_attente_admin" ? (<p className="mt-2 text-xs font-medium text-amber-700">{t("waitingAdmin")}</p>) : null}
                {d.statut === "actif" && d.rattachement_id ? (<DiscussionRattachement_1.default rattachementId={d.rattachement_id}/>) : null}
              </li>))}
          </ul>)}
      </section>
    </AppShell_1.default>);
}

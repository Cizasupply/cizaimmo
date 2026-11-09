"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = RattachementDisplayId;
/**
 * Rattachement par Display ID (v1.3) — côté PROPRIÉTAIRE.
 *
 * Le propriétaire saisit le Display ID de son gestionnaire : la
 * recherche ne retourne QUE le nom (confirmation), jamais d'autre
 * donnée. La demande part ensuite en triple validation : le
 * gestionnaire accepte → un Admin valide → le rattachement devient
 * actif, SANS immeuble ; le propriétaire assigne alors ses immeubles
 * (mécanisme existant : immeuble_ids du rattachement).
 */
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const data_1 = require("@/lib/data");
const DiscussionRattachement_1 = __importDefault(require("@/components/DiscussionRattachement"));
function RattachementDisplayId() {
    const t = (0, next_intl_1.useTranslations)("dossier");
    const [saisie, setSaisie] = (0, react_1.useState)("");
    const [trouve, setTrouve] = (0, react_1.useState)(null);
    const [introuvable, setIntrouvable] = (0, react_1.useState)(false);
    const [demandes, setDemandes] = (0, react_1.useState)([]);
    const [immeubles, setImmeubles] = (0, react_1.useState)([]);
    const [selections, setSelections] = (0, react_1.useState)({});
    const [occupe, setOccupe] = (0, react_1.useState)(false);
    const [message, setMessage] = (0, react_1.useState)(null);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const charger = (0, react_1.useCallback)(async () => {
        const provider = (0, data_1.getDataProvider)();
        const [liste, ims] = await Promise.all([
            provider.listerDemandesRattachement(),
            provider.listerImmeubles(),
        ]);
        const profil = await provider.getProfil();
        // Mes demandes ENVOYÉES seulement (je suis le propriétaire).
        const miennes = profil
            ? liste.filter((d) => d.proprietaire_id === profil.id)
            : liste;
        setDemandes(miennes);
        setImmeubles(ims.filter((i) => i.statut === "actif"));
        const sel = {};
        for (const d of miennes) {
            if (d.rattachement_id) {
                sel[d.rattachement_id] = d.rattachement_immeuble_ids ?? [];
            }
        }
        setSelections(sel);
    }, []);
    (0, react_1.useEffect)(() => {
        charger().catch(() => undefined);
    }, [charger]);
    async function rechercher() {
        if (!saisie.trim())
            return;
        setOccupe(true);
        setErreur(null);
        setMessage(null);
        setIntrouvable(false);
        setTrouve(null);
        try {
            const resultat = await (0, data_1.getDataProvider)().rechercherCompteParDisplayId(saisie);
            if (resultat)
                setTrouve(resultat);
            else
                setIntrouvable(true);
        }
        catch {
            setErreur(t("errorGeneric"));
        }
        finally {
            setOccupe(false);
        }
    }
    async function envoyerDemande() {
        if (!trouve)
            return;
        setOccupe(true);
        setErreur(null);
        try {
            await (0, data_1.getDataProvider)().demanderRattachementParDisplayId(trouve.display_id);
            setMessage(t("requestSentMsg"));
            setTrouve(null);
            setSaisie("");
            await charger();
        }
        catch (e) {
            const code = e instanceof Error ? e.message : "";
            setErreur(code === "ERR_DEMANDE_EXISTANTE"
                ? t("errorRequestExists")
                : code === "ERR_INTROUVABLE"
                    ? t("notFound")
                    : t("errorGeneric"));
        }
        finally {
            setOccupe(false);
        }
    }
    async function assigner(demande) {
        if (!demande.rattachement_id)
            return;
        setOccupe(true);
        setErreur(null);
        setMessage(null);
        try {
            await (0, data_1.getDataProvider)().assignerImmeublesRattachement(demande.rattachement_id, selections[demande.rattachement_id] ?? []);
            setMessage(t("assignedMsg"));
            await charger();
        }
        catch {
            setErreur(t("errorGeneric"));
        }
        finally {
            setOccupe(false);
        }
    }
    const envoyees = demandes;
    return (<div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-52 flex-1">
          <span className="block text-sm font-semibold text-slate-900">
            {t("managerDisplayIdLabel")}
          </span>
          <input value={saisie} onChange={(e) => setSaisie(e.target.value)} placeholder="CIM-000002" className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base uppercase text-slate-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"/>
        </label>
        <button type="button" disabled={occupe || !saisie.trim()} onClick={rechercher} className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-navy hover:border-gold disabled:opacity-50">
          {t("search")}
        </button>
      </div>
      {introuvable ? (<p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {t("notFound")}
        </p>) : null}
      {trouve ? (<div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-green-50 px-4 py-3">
          <p className="text-sm text-green-900">
            {t("foundManager")} : <strong>{trouve.nom}</strong> ({trouve.display_id})
          </p>
          <button type="button" disabled={occupe} onClick={envoyerDemande} className="rounded-full bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-light disabled:opacity-50">
            {t("sendRequest")}
          </button>
        </div>) : null}
      {message ? (<p role="status" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
          {message}
        </p>) : null}
      {erreur ? (<p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {erreur}
        </p>) : null}

      {envoyees.length > 0 ? (<ul className="mt-4 space-y-3">
          {envoyees.map((d) => (<li key={d.id} className="rounded-xl border border-slate-200 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-navy">
                  {d.gestionnaire_nom} · {d.gestionnaire_display_id}
                </p>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                  {t(`requestStatus.${d.statut}`)}
                </span>
              </div>
              {d.statut === "en_attente_gestionnaire" ? (<p className="mt-1 text-xs text-slate-500">{t("waitingManager")}</p>) : null}
              {d.statut === "en_attente_admin" ? (<p className="mt-1 text-xs font-medium text-amber-700">{t("waitingAdmin")}</p>) : null}
              {d.statut === "actif" && d.rattachement_id ? (<div className="mt-3">
                  <p className="text-sm font-semibold text-slate-900">{t("assignBuildings")}</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {immeubles.map((i) => {
                        const coches = selections[d.rattachement_id] ?? [];
                        return (<label key={i.id} className="flex items-center gap-2 text-base text-slate-900">
                          <input type="checkbox" checked={coches.includes(i.id)} onChange={(e) => setSelections((anciennes) => ({
                                ...anciennes,
                                [d.rattachement_id]: e.target.checked
                                    ? [...coches, i.id]
                                    : coches.filter((x) => x !== i.id),
                            }))} className="h-5 w-5 shrink-0 accent-[#1B2A4A]"/>
                          {i.nom}
                        </label>);
                    })}
                  </div>
                  <button type="button" disabled={occupe} onClick={() => assigner(d)} className="mt-3 rounded-full bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-light disabled:opacity-50">
                    {t("saveAssignment")}
                  </button>
                  {/* v1.5 : discussion directe propriétaire ↔ gestionnaire. */}
                  <DiscussionRattachement_1.default rattachementId={d.rattachement_id}/>
                </div>) : null}
            </li>))}
        </ul>) : null}
    </div>);
}

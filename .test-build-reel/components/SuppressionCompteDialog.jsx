"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SuppressionCompteDialog;
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const Field_1 = __importDefault(require("@/components/Field"));
const data_1 = require("@/lib/data");
/**
 * Dialogue de confirmation de la suppression de compte (v1.5),
 * partagé par les deux points d'entrée client : page Paramètres
 * (section « Supprimer mon compte ») et page Abonnement.
 *
 * Renfort fondateur (2026-11-07) : la confirmation exige la saisie
 * du mot de passe du compte. Le provider le VÉRIFIE (ré-
 * authentification Supabase Auth en réel) AVANT d'appeler la RPC
 * demander_suppression_compte : mot de passe faux →
 * ERR_MOT_DE_PASSE_INCORRECT, l'erreur s'affiche ICI, dans le
 * dialogue, le dialogue reste ouvert et le compte ne change pas
 * d'état. Toute autre erreur est transmise à la page (onErreur),
 * qui la présente comme avant et ferme le dialogue.
 */
function SuppressionCompteDialog({ onSucces, onErreur, onCancel, }) {
    const t15 = (0, next_intl_1.useTranslations)("v15");
    const tc = (0, next_intl_1.useTranslations)("crud.common");
    const [motDePasse, setMotDePasse] = (0, react_1.useState)("");
    const [erreurMdp, setErreurMdp] = (0, react_1.useState)(null);
    const [enCours, setEnCours] = (0, react_1.useState)(false);
    async function confirmer(e) {
        e.preventDefault();
        if (enCours || !motDePasse)
            return;
        setEnCours(true);
        setErreurMdp(null);
        try {
            const maj = await (0, data_1.getDataProvider)().demanderSuppressionCompte(motDePasse);
            onSucces(maj);
        }
        catch (err) {
            if (err instanceof Error && err.message === "ERR_MOT_DE_PASSE_INCORRECT") {
                // Mot de passe faux : erreur dans le dialogue, AUCUN appel à
                // la RPC n'a eu lieu côté provider, le compte est inchangé.
                setErreurMdp(t15("errors.ERR_MOT_DE_PASSE_INCORRECT"));
                setMotDePasse("");
                setEnCours(false);
                return;
            }
            onErreur(err);
        }
    }
    return (<div role="dialog" aria-modal="true" aria-label={t15("deletionConfirmTitle")} className="fixed inset-0 z-50 flex items-end justify-center bg-navy-dark/60 p-4 sm:items-center" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-navy">{t15("deletionConfirmTitle")}</h2>
        <p className="mt-2 text-base text-slate-700">{t15("deletionConfirmText")}</p>
        <form onSubmit={confirmer} className="mt-4">
          <Field_1.default id="suppression-mot-de-passe" label={t15("deletionPasswordLabel")} type="password" value={motDePasse} onChange={(v) => {
            setMotDePasse(v);
            setErreurMdp(null);
        }} error={erreurMdp} required autoComplete="current-password"/>
          <p className="mt-2 text-sm text-slate-600">{t15("deletionPasswordText")}</p>
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={onCancel} disabled={enCours} className="flex-1 rounded-full border border-slate-300 px-4 py-2.5 text-base font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {tc("cancel")}
            </button>
            <button type="submit" disabled={enCours || !motDePasse} className="flex-1 rounded-full bg-red-600 px-4 py-2.5 text-base font-bold text-white hover:bg-red-700 disabled:opacity-50">
              {t15("deletionConfirmButton")}
            </button>
          </div>
        </form>
      </div>
    </div>);
}

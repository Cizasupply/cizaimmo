"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ConsoleSuppressionsPage;
/**
 * Console — Suppressions en attente (v1.5, Super Admin uniquement) :
 * demandes de suppression déposées par les clients. Le bouton
 * « Exécuter » reste DÉSACTIVÉ tant que l'échéance (demande + 30 j)
 * n'est pas atteinte — et la base refuse de toute façon avant.
 */
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const ConfirmDialog_1 = __importDefault(require("@/components/ConfirmDialog"));
const FilMessages_1 = require("@/components/FilMessages");
const data_1 = require("@/lib/data");
const format_1 = require("@/lib/format");
function ConsoleSuppressionsPage() {
    const t = (0, next_intl_1.useTranslations)("v15");
    const tc = (0, next_intl_1.useTranslations)("console");
    const tcom = (0, next_intl_1.useTranslations)("common");
    const locale = (0, next_intl_1.useLocale)();
    const [profil, setProfil] = (0, react_1.useState)(null);
    const [liste, setListe] = (0, react_1.useState)([]);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    const [aConfirmer, setAConfirmer] = (0, react_1.useState)(null);
    const [message, setMessage] = (0, react_1.useState)(null);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const recharger = (0, react_1.useCallback)(async () => {
        const provider = (0, data_1.getDataProvider)();
        const [moi, demandes] = await Promise.all([
            provider.getProfil(),
            provider.listerSuppressionsEnAttente().catch(() => []),
        ]);
        setProfil(moi);
        setListe(demandes);
    }, []);
    (0, react_1.useEffect)(() => {
        recharger()
            .catch((e) => setErreur((0, FilMessages_1.erreurV15)(t, e)))
            .finally(() => setChargement(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recharger]);
    async function executer() {
        if (!aConfirmer)
            return;
        const cible = aConfirmer;
        setAConfirmer(null);
        setMessage(null);
        setErreur(null);
        try {
            await (0, data_1.getDataProvider)().executerSuppressionCompte(cible.compte_id);
            setMessage(t("deletionExecutedMsg"));
            await recharger();
        }
        catch (e) {
            setErreur((0, FilMessages_1.erreurV15)(t, e));
        }
    }
    if (!chargement && profil && profil.role !== "super_admin") {
        return (<div>
        <h1 className="text-2xl font-semibold text-navy md:text-3xl">{t("deletionsTitle")}</h1>
        <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">
          {t("superOnly")}
        </p>
      </div>);
    }
    return (<div>
      <h1 className="text-2xl font-semibold text-navy md:text-3xl">{t("deletionsTitle")}</h1>
      <p className="mt-1 text-sm text-slate-600">{t("deletionsSubtitle")}</p>

      {message ? (<p role="status" className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
          {message}
        </p>) : null}
      {erreur ? (<p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {erreur}
        </p>) : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-cream text-xs font-semibold uppercase tracking-wide text-navy">
              <th className="px-4 py-3">{t("colName")}</th>
              <th className="px-4 py-3">{t("colDisplayId")}</th>
              <th className="px-4 py-3">{t("colEmail")}</th>
              <th className="px-4 py-3">{t("colRequested")}</th>
              <th className="px-4 py-3">{t("colDeadline")}</th>
              <th className="px-4 py-3">{tc("colAction")}</th>
            </tr>
          </thead>
          <tbody>
            {liste.map((s) => (<tr key={s.compte_id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-semibold text-navy">{s.nom}</td>
                <td className="whitespace-nowrap px-4 py-3 font-bold tracking-wide text-navy">
                  {s.display_id ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{s.email}</td>
                <td className="px-4 py-3 text-slate-600">
                  {(0, format_1.formatDate)(s.suppression_demandee_le, locale)}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {(0, format_1.formatDate)(s.echeance_le, locale)}
                </td>
                <td className="px-4 py-3">
                  <button type="button" disabled={!s.executable} onClick={() => setAConfirmer(s)} className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
                    {t("executeDeletion")}
                  </button>
                  {!s.executable ? (<span className="mt-1 block text-xs text-slate-500">
                      {t("notYetExecutable", { date: (0, format_1.formatDate)(s.echeance_le, locale) })}
                    </span>) : null}
                </td>
              </tr>))}
          </tbody>
        </table>
        {!chargement && liste.length === 0 ? (<p className="p-6 text-sm text-slate-500">{t("deletionsEmpty")}</p>) : null}
        {chargement ? (<p className="p-6 text-sm text-slate-500">{tc("loading")}</p>) : null}
      </div>

      {aConfirmer ? (<ConfirmDialog_1.default title={t("executeConfirmTitle")} text={t("executeConfirmText")} confirmLabel={t("executeDeletion")} cancelLabel={tcom("cancel")} onConfirm={executer} onCancel={() => setAConfirmer(null)}/>) : null}
    </div>);
}

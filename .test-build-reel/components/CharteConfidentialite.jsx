"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CharteConfidentialite;
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const data_1 = require("@/lib/data");
/**
 * Portail de la charte de confidentialité (pack employé, 2026-11-08) :
 * à la PREMIÈRE connexion console d'un compte plateforme (Admin ou
 * Super Admin) sans acceptation enregistrée, la charte validée par le
 * fondateur s'affiche en modale ; l'acceptation — case cochée puis
 * bouton — est horodatée EN BASE (profils.charte_acceptee_le) et ne se
 * représente plus ensuite. NON bloquant au sens technique : si la
 * lecture du pack échoue, la console continue sans le portail.
 */
function CharteConfidentialite() {
    const t = (0, next_intl_1.useTranslations)("packEmploye");
    const [pack, setPack] = (0, react_1.useState)(null);
    const [coche, setCoche] = (0, react_1.useState)(false);
    const [occupe, setOccupe] = (0, react_1.useState)(false);
    const [echec, setEchec] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        let actif = true;
        (0, data_1.getDataProvider)()
            .getMonPackEmploye()
            .then((p) => {
            if (actif)
                setPack(p);
        })
            .catch(() => undefined);
        return () => {
            actif = false;
        };
    }, []);
    if (!pack || pack.charte_acceptee_le)
        return null;
    const items = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => t(`charteItem${i}`));
    async function accepter() {
        setOccupe(true);
        setEchec(false);
        try {
            const p = await (0, data_1.getDataProvider)().accepterCharteEmploye();
            setPack(p);
        }
        catch {
            setEchec(true);
            setOccupe(false);
        }
    }
    return (<div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-navy-dark/80 p-4 sm:items-center">
      <div className="w-full max-w-2xl rounded-2xl border border-gold/40 bg-white p-5 shadow-2xl sm:p-7">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-dark">
          CizaImmo — Ciza Group
        </p>
        <h2 className="mt-1 text-xl font-bold text-navy">{t("charteTitle")}</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          {t("charteIntro")}
        </p>
        <p className="mt-3 text-sm font-semibold text-navy">
          {t("charteBefore")}
        </p>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
          {items.map((item, i) => (<li key={i}>{item}</li>))}
        </ol>
        <p className="mt-3 rounded-xl bg-cream p-3 text-sm leading-relaxed text-slate-700">
          {t("charteUnderstand")}
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm font-semibold text-navy">
          <input type="checkbox" checked={coche} onChange={(e) => setCoche(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#D4AF37]"/>
          <span>{t("charteCheckbox")}</span>
        </label>
        <p className="mt-2 text-xs text-slate-500">{t("charteNote")}</p>
        {echec ? (<p className="mt-2 text-sm font-semibold text-red-700">
            {t("errorGeneric")}
          </p>) : null}
        <button type="button" disabled={!coche || occupe} onClick={accepter} className="mt-4 w-full rounded-xl bg-gold px-4 py-3 text-sm font-bold text-navy transition hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto">
          {t("charteAccept")}
        </button>
      </div>
    </div>);
}

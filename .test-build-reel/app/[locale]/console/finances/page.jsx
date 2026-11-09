"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ConsoleFinancesPage;
/**
 * Console — Paramètres Finances (Super Admin uniquement, v1.2) :
 * RIEN N'EST CODÉ EN DUR. Les 6 prix, la remise annuelle, les jours
 * d'essai et de grâce, les pénalités, la liste dynamique des pays
 * éligibles à la grille Afrique et le délai d'approbation affiché
 * vivent dans la base et sont lus par tout le front (public compris)
 * SANS redéploiement. Toute modification est journalisée.
 */
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const data_1 = require("@/lib/data");
const PLANS = ["starter", "pro", "agence"];
const GRILLES = ["afrique", "internationale"];
function ConsoleFinancesPage() {
    const t = (0, next_intl_1.useTranslations)("console");
    const [lignes, setLignes] = (0, react_1.useState)([]);
    const [prix, setPrix] = (0, react_1.useState)({});
    const [parametres, setParametres] = (0, react_1.useState)(null);
    const [paysTexte, setPaysTexte] = (0, react_1.useState)("");
    const [message, setMessage] = (0, react_1.useState)(null);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const [occupe, setOccupe] = (0, react_1.useState)(false);
    const [charge, setCharge] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        let actif = true;
        (async () => {
            try {
                const provider = (0, data_1.getDataProvider)();
                const [tarifs, params] = await Promise.all([
                    provider.getTarifsPlateforme(),
                    provider.getParametresFinance(),
                ]);
                if (!actif)
                    return;
                const initial = {};
                for (const tarif of tarifs) {
                    initial[`${tarif.grille}:${tarif.plan}`] = String(tarif.prix_mensuel);
                }
                setLignes(tarifs);
                setPrix(initial);
                setParametres(params);
                setPaysTexte(params.pays_grille_afrique.join(", "));
            }
            catch {
                if (actif)
                    setErreur(t("errors.generic"));
            }
            finally {
                if (actif)
                    setCharge(true);
            }
        })();
        return () => {
            actif = false;
        };
    }, [t]);
    async function enregistrer(e) {
        e.preventDefault();
        if (!parametres)
            return;
        setOccupe(true);
        setMessage(null);
        setErreur(null);
        try {
            // On repart des lignes chargées (identifiants conservés) en ne
            // changeant que les prix saisis.
            const tarifs = lignes.map((ligne) => ({
                ...ligne,
                prix_mensuel: Number(prix[`${ligne.grille}:${ligne.plan}`] ?? ligne.prix_mensuel),
            }));
            await (0, data_1.getDataProvider)().mettreAJourTarifs(tarifs, {
                ...parametres,
                pays_grille_afrique: paysTexte
                    .split(/[,\s;]+/)
                    .map((c) => c.trim().toUpperCase())
                    .filter(Boolean),
                delai_approbation_affiche: parametres.delai_approbation_affiche.trim(),
            });
            setMessage(t("financeSavedMsg"));
        }
        catch (err) {
            const code = err instanceof Error ? err.message : "";
            setErreur(code.startsWith("ERR_")
                ? t(`errors.${code}`)
                : t("errors.generic"));
        }
        finally {
            setOccupe(false);
        }
    }
    const champNombre = (label, valeur, onChange, extra) => (<label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <span className="mt-1 flex items-center gap-2">
        <input type="number" min={0} value={Number.isFinite(valeur) ? valeur : 0} onChange={(e) => onChange(Number(e.target.value))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/>
        <span className="text-sm text-slate-500">{extra}</span>
      </span>
    </label>);
    return (<div>
      <h1 className="text-2xl font-semibold text-navy md:text-3xl">{t("financesTitle")}</h1>
      <p className="mt-1 max-w-2xl text-sm text-slate-600">{t("financesSubtitle")}</p>

      {message ? (<p role="status" className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">{message}</p>) : null}
      {erreur ? (<p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{erreur}</p>) : null}

      {!charge ? (<p className="mt-6 text-sm text-slate-500">{t("loading")}</p>) : parametres ? (<form onSubmit={enregistrer} className="mt-6 space-y-6">
          {GRILLES.map((grille) => (<section key={grille} className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-navy">
                {grille === "afrique" ? t("grid.afrique") : t("grid.internationale")}
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                {PLANS.map((plan) => (<label key={plan} className="block">
                    <span className="text-sm font-semibold text-slate-700">{t(`plan.${plan}`)}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <input type="number" min={0} step="0.01" required value={prix[`${grille}:${plan}`] ?? ""} onChange={(e) => setPrix({ ...prix, [`${grille}:${plan}`]: e.target.value })} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/>
                      <span className="text-sm text-slate-500">USD / {t("perMonth")}</span>
                    </span>
                  </label>))}
              </div>
            </section>))}

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-navy">{t("financeParamsTitle")}</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {champNombre(t("annualDiscount"), parametres.remise_annuelle_pct, (n) => setParametres({ ...parametres, remise_annuelle_pct: n }), "%")}
              {champNombre(t("trialDays"), parametres.jours_essai, (n) => setParametres({ ...parametres, jours_essai: n }), t("daysUnit"))}
              {champNombre(t("graceDays"), parametres.jours_grace, (n) => setParametres({ ...parametres, jours_grace: n }), t("daysUnit"))}
              <label className="flex items-center gap-3 pt-6">
                <input type="checkbox" checked={parametres.penalites_retard_actives} onChange={(e) => setParametres({ ...parametres, penalites_retard_actives: e.target.checked })} className="h-5 w-5 accent-[#1B2A4A]"/>
                <span className="text-sm font-semibold text-slate-700">{t("latePenalties")}</span>
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">{t("approvalDelay")}</span>
                <input type="text" value={parametres.delai_approbation_affiche} onChange={(e) => setParametres({ ...parametres, delai_approbation_affiche: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/>
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">{t("africaCountries")}</span>
                <textarea value={paysTexte} onChange={(e) => setPaysTexte(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/>
                <span className="mt-1 block text-xs text-slate-500">{t("africaCountriesHint")}</span>
              </label>
            </div>
          </section>

          <button type="submit" disabled={occupe} className="rounded-full bg-gold px-6 py-3 text-sm font-bold text-navy hover:bg-gold-light disabled:opacity-50">
            {t("saveFinances")}
          </button>
          <p className="text-xs text-slate-400">{t("financesNote")}</p>
        </form>) : null}
    </div>);
}

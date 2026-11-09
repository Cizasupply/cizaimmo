"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = GrilleTarifsPublique;
/**
 * Grilles tarifaires PUBLIQUES dynamiques (extension v1.2) : les prix
 * viennent de la couche data (base en mode réel, seed en démo) — un
 * changement de prix dans la console se reflète ici sans redéploiement.
 * Le rendu initial utilise le repli seed (mêmes valeurs) puis se met à
 * jour dès la lecture de la source.
 */
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const data_1 = require("@/lib/data");
const tarifs_1 = require("@/lib/tarifs");
const abonnement_1 = require("@/lib/abonnement");
const types_1 = require("@/lib/data/types");
const PLANS = ["starter", "pro", "agence"];
function GrilleTarifsPublique({ africaTitle, africaNote, internationalTitle, internationalNote, }) {
    const t = (0, next_intl_1.useTranslations)("landing.pricing");
    const locale = (0, next_intl_1.useLocale)();
    const [prix, setPrix] = (0, react_1.useState)(() => (0, tarifs_1.construirePrixPlans)(tarifs_1.TARIFS_SEED));
    (0, react_1.useEffect)(() => {
        let actif = true;
        (0, data_1.getDataProvider)()
            .getTarifsPlateforme()
            .then((tarifs) => {
            if (actif)
                setPrix((0, tarifs_1.construirePrixPlans)(tarifs));
        })
            .catch(() => undefined);
        return () => {
            actif = false;
        };
    }, []);
    function libelleGestionnaires(plan) {
        const max = abonnement_1.GESTIONNAIRES_MAX[plan];
        if (max === 0)
            return t("managersNone");
        if (!Number.isFinite(max))
            return t("managersUnlimited");
        return t("managers", { count: max });
    }
    function libelleBlocs(plan) {
        const max = types_1.LIMITE_BLOCS[plan];
        if (!Number.isFinite(max))
            return t("blocksUnlimited");
        return t("blocks", { count: max });
    }
    function carte(plan, grille) {
        return (<div key={`${grille}-${plan}`} className="rounded-2xl bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold text-navy">
          {plan === "starter" ? "Starter" : plan === "pro" ? "Pro" : "Agence"}
        </h3>
        <p className="mt-1 text-sm font-semibold text-slate-600">{libelleBlocs(plan)}</p>
        <p className="mt-4 text-3xl font-bold text-navy">
          ${prix[plan][grille].toFixed(2)}
          <span className="text-base font-normal text-slate-500"> {t("perMonth")}</span>
        </p>
        <ul className="mt-4 space-y-2 text-sm text-slate-700">
          <li>✓ {t("fullManagement")}</li>
          <li>✓ {t("reports")}</li>
          <li>✓ {libelleGestionnaires(plan)}</li>
          <li>
            {abonnement_1.VITRINE_PAR_PLAN[plan] ? "✓ " : "— "}
            {abonnement_1.VITRINE_PAR_PLAN[plan] ? t("vitrineYes") : t("vitrineNo")}
          </li>
          <li>
            {abonnement_1.INDIVISION_PAR_PLAN[plan] ? "✓ " : "— "}
            {abonnement_1.INDIVISION_PAR_PLAN[plan] ? t("indivisionYes") : t("indivisionNo")}
          </li>
        </ul>
        <link_1.default href={`/${locale}/inscription`} className="mt-6 flex min-h-11 items-center justify-center rounded-full bg-navy px-5 py-3 text-center text-base font-bold text-white hover:bg-navy-light">
          {t("cta")}
        </link_1.default>
      </div>);
    }
    return (<>
      <section aria-labelledby="grille-afrique" className="mt-10">
        <h2 id="grille-afrique" className="text-2xl font-bold text-navy">
          {africaTitle}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{africaNote}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => carte(plan, "afrique"))}
        </div>
      </section>

      <section aria-labelledby="grille-internationale" className="mt-10">
        <h2 id="grille-internationale" className="text-2xl font-bold text-navy">
          {internationalTitle}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{internationalNote}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {PLANS.map((plan) => carte(plan, "internationale"))}
        </div>
      </section>
    </>);
}

"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MiniGrilleTarifs;
/**
 * Mini-grille tarifaire de l'ACCUEIL PUBLIC (ajout fondateur n°1,
 * v1.2) : les 3 plans avec un SÉLECTEUR DE DEVISE visible (12 devises)
 * pour que chaque visiteur voie le coût réel dans sa monnaie. Prix
 * DYNAMIQUES (base/seed via la couche data), convertis avec les taux
 * automatiques (~1×/jour) et leur DATE affichée — jamais « en direct ».
 * Devises sans centimes : arrondi supérieur lisible (BIF à la centaine).
 * Regarder un prix ici ne change RIEN à la grille du compte (anti-
 * fraude : la grille est attribuée à l'inscription, verrouillée).
 */
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const data_1 = require("@/lib/data");
const tarifs_1 = require("@/lib/tarifs");
const abonnement_1 = require("@/lib/abonnement");
const format_1 = require("@/lib/format");
const DeviseAffichage_1 = require("@/components/DeviseAffichage");
const PLANS = ["starter", "pro", "agence"];
function MiniGrilleTarifs() {
    const t = (0, next_intl_1.useTranslations)("landing");
    const locale = (0, next_intl_1.useLocale)();
    const [prix, setPrix] = (0, react_1.useState)(() => (0, tarifs_1.construirePrixPlans)(tarifs_1.TARIFS_SEED));
    const [taux, setTaux] = (0, react_1.useState)([]);
    // Devise partagée avec le sélecteur du héros (contexte de la
    // page d'accueil) ; repli local si la grille est rendue seule.
    const ctxDevise = (0, DeviseAffichage_1.useDeviseAffichage)();
    const [deviseLocale, setDeviseLocale] = (0, react_1.useState)("USD");
    const devise = ctxDevise ? ctxDevise.devise : deviseLocale;
    const setDevise = ctxDevise ? ctxDevise.setDevise : setDeviseLocale;
    (0, react_1.useEffect)(() => {
        let actif = true;
        const provider = (0, data_1.getDataProvider)();
        provider
            .getTarifsPlateforme()
            .then((tarifs) => {
            if (actif)
                setPrix((0, tarifs_1.construirePrixPlans)(tarifs));
        })
            .catch(() => undefined);
        // Taux du convertisseur PUBLIC : la table taux_change est protégée
        // par RLS (un visiteur anonyme n'y lit rien) — la route publique
        // interroge Frankfurter + ER-API et retourne des taux datés.
        fetch("/api/taux/publics")
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error("taux_indisponible"))))
            .then((data) => {
            if (actif && Array.isArray(data.taux))
                setTaux(data.taux);
        })
            .catch(() => undefined); // Sans taux : affichage USD, jamais inventé.
        return () => {
            actif = false;
        };
    }, []);
    function libelleGestionnaires(plan) {
        const max = abonnement_1.GESTIONNAIRES_MAX[plan];
        if (max === 0)
            return t("pricing.managersNone");
        if (!Number.isFinite(max))
            return t("pricing.managersUnlimited");
        return t("pricing.managers", { count: max });
    }
    function lignePrix(montantUsd) {
        const conversion = (0, tarifs_1.convertirPrixAffichage)(montantUsd, devise, taux);
        if (!conversion) {
            return { texte: (0, format_1.formatMoney)(montantUsd, "USD", locale), dateTaux: null };
        }
        return {
            texte: (0, format_1.formatMoney)(conversion.montant, conversion.devise, locale),
            dateTaux: conversion.dateTaux,
        };
    }
    const conversions = PLANS.map((plan) => ({
        plan,
        afrique: lignePrix(prix[plan].afrique),
        internationale: lignePrix(prix[plan].internationale),
    }));
    const deviseEstUsd = devise === "USD";
    const dateTauxAffichee = !deviseEstUsd
        ? conversions[0]?.afrique.dateTaux ?? conversions[0]?.internationale.dateTaux
        : null;
    const conversionDisponible = deviseEstUsd || conversions.every((c) => c.afrique.dateTaux !== null);
    return (<div>
      <p className="mt-8 text-center text-base font-semibold text-navy">
        {t("pricing.currencyInvite")}
      </p>
      <div className="mx-auto mt-3 max-w-xs">
        <label className="sr-only" htmlFor="mini-grille-devise">
          {t("pricing.currencyLabel")}
        </label>
        <select id="mini-grille-devise" value={devise} onChange={(e) => setDevise(e.target.value)} className="min-h-12 w-full rounded-full border-2 border-gold bg-white px-5 py-3 text-center text-base font-bold text-navy shadow-lg">
          {data_1.DEVISES.map((d) => (<option key={d} value={d}>
              {DeviseAffichage_1.LIBELLES_DEVISE[d]}
            </option>))}
        </select>
      </div>
      {!deviseEstUsd ? (<p className="mt-3 text-center text-sm text-slate-600">
          {dateTauxAffichee
                ? t("pricing.rateDate", { date: (0, format_1.formatDate)(dateTauxAffichee, locale) })
                : t("pricing.rateUnavailable")}
        </p>) : null}
      {!conversionDisponible && !deviseEstUsd ? (<p className="mt-1 text-center text-xs text-slate-500">{t("pricing.rateFallbackUsd")}</p>) : null}

      <div className="mt-8 grid gap-6 text-left md:grid-cols-3">
        {conversions.map(({ plan, afrique, internationale }) => {
            // Design « Marine & Or » (2026-11-08) : cartes blanches
            // bordées au patron, prix marine gras ; le pack Pro est
            // mis en avant en marine/or (visuel uniquement, aucun
            // libellé ajouté, mécanique des prix inchangée).
            const vedette = plan === "pro";
            return (<div key={plan} className={vedette
                    ? "rounded-2xl bg-navy p-6 text-white shadow-sm ring-1 ring-gold"
                    : "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"}>
            <h3 className={vedette ? "text-xl font-bold text-gold" : "text-xl font-bold text-navy"}>
              {plan === "starter" ? "Starter" : plan === "pro" ? "Pro" : "Agence"}
            </h3>
            <p className={vedette ? "mt-2 text-slate-300" : "mt-2 text-slate-600"}>
              {plan === "agence"
                    ? t("pricing.blocksUnlimited")
                    : t("pricing.blocks", { count: plan === "starter" ? 1 : 5 })}
            </p>
            <p className="mt-4 text-2xl font-bold">
              {afrique.texte}
              <span className={vedette ? "text-sm font-normal text-slate-300" : "text-sm font-normal text-slate-500"}>
                {" "}
                {t("pricing.perMonth")} · {t("pricing.gridAfrique")}
              </span>
            </p>
            <p className="mt-1 text-2xl font-bold">
              {internationale.texte}
              <span className={vedette ? "text-sm font-normal text-slate-300" : "text-sm font-normal text-slate-500"}>
                {" "}
                {t("pricing.perMonth")} · {t("pricing.gridInternationale")}
              </span>
            </p>
            <ul className={vedette ? "mt-4 space-y-2 text-sm text-slate-200" : "mt-4 space-y-2 text-sm text-slate-600"}>
              <li>✓ {t("pricing.fullManagement")}</li>
              <li>✓ {t("pricing.reports")}</li>
              <li>✓ {libelleGestionnaires(plan)}</li>
              <li>
                {abonnement_1.VITRINE_PAR_PLAN[plan] ? "✓ " : "— "}
                {abonnement_1.VITRINE_PAR_PLAN[plan] ? t("pricing.vitrineYes") : t("pricing.vitrineNo")}
              </li>
              <li>
                {abonnement_1.INDIVISION_PAR_PLAN[plan] ? "✓ " : "— "}
                {abonnement_1.INDIVISION_PAR_PLAN[plan] ? t("pricing.indivisionYes") : t("pricing.indivisionNo")}
              </li>
            </ul>
            <link_1.default href={`/${locale}/inscription`} className={vedette
                    ? "mt-6 block min-h-12 rounded-full bg-gold px-5 py-3 text-center font-semibold text-navy hover:bg-gold-light"
                    : "mt-6 block min-h-12 rounded-full border border-navy bg-white px-5 py-3 text-center font-semibold text-navy hover:bg-navy hover:text-white"}>
              {t("pricing.cta")}
            </link_1.default>
          </div>);
        })}
      </div>
    </div>);
}

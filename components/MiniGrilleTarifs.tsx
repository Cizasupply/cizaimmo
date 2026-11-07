"use client";

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

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DEVISES, getDataProvider } from "@/lib/data";
import type { Devise, Plan, PrixPlans, TauxChange } from "@/lib/data";
import { TARIFS_SEED, construirePrixPlans, convertirPrixAffichage } from "@/lib/tarifs";
import { GESTIONNAIRES_MAX, VITRINE_PAR_PLAN, INDIVISION_PAR_PLAN } from "@/lib/abonnement";
import { formatDate, formatMoney } from "@/lib/format";

const PLANS: Plan[] = ["starter", "pro", "agence"];

const LIBELLES_DEVISE: Record<Devise, string> = {
  USD: "$ USD",
  EUR: "€ EUR",
  GBP: "£ GBP",
  CAD: "$ CAD",
  BIF: "BIF",
  XAF: "XAF",
  XOF: "XOF",
  KES: "KES",
  TZS: "TZS",
  RWF: "RWF",
  UGX: "UGX",
  BRL: "R$ BRL",
};

export default function MiniGrilleTarifs() {
  const t = useTranslations("landing");
  const locale = useLocale();
  const [prix, setPrix] = useState<PrixPlans>(() => construirePrixPlans(TARIFS_SEED));
  const [taux, setTaux] = useState<TauxChange[]>([]);
  const [devise, setDevise] = useState<Devise>("USD");

  useEffect(() => {
    let actif = true;
    const provider = getDataProvider();
    provider
      .getTarifsPlateforme()
      .then((tarifs) => {
        if (actif) setPrix(construirePrixPlans(tarifs));
      })
      .catch(() => undefined);
    provider
      .listerTaux()
      .then((liste) => {
        if (actif) setTaux(liste);
      })
      .catch(() => undefined); // Sans taux lisibles : affichage USD, jamais inventé.
    return () => {
      actif = false;
    };
  }, []);

  function libelleGestionnaires(plan: Plan): string {
    const max = GESTIONNAIRES_MAX[plan];
    if (max === 0) return t("pricing.managersNone");
    if (!Number.isFinite(max)) return t("pricing.managersUnlimited");
    return t("pricing.managers", { count: max });
  }

  function lignePrix(montantUsd: number) {
    const conversion = convertirPrixAffichage(montantUsd, devise, taux);
    if (!conversion) {
      return { texte: formatMoney(montantUsd, "USD", locale), dateTaux: null as string | null };
    }
    return {
      texte: formatMoney(conversion.montant, conversion.devise, locale),
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
  const conversionDisponible =
    deviseEstUsd || conversions.every((c) => c.afrique.dateTaux !== null);

  return (
    <div>
      <p className="mt-8 text-center text-base font-semibold text-white">
        {t("pricing.currencyInvite")}
      </p>
      <div className="mx-auto mt-3 max-w-xs">
        <label className="sr-only" htmlFor="mini-grille-devise">
          {t("pricing.currencyLabel")}
        </label>
        <select
          id="mini-grille-devise"
          value={devise}
          onChange={(e) => setDevise(e.target.value as Devise)}
          className="w-full rounded-full border-2 border-gold bg-white px-5 py-3 text-center text-base font-bold text-navy shadow-lg"
        >
          {DEVISES.map((d) => (
            <option key={d} value={d}>
              {LIBELLES_DEVISE[d]}
            </option>
          ))}
        </select>
      </div>
      {!deviseEstUsd ? (
        <p className="mt-3 text-center text-sm text-slate-300">
          {dateTauxAffichee
            ? t("pricing.rateDate", { date: formatDate(dateTauxAffichee, locale) })
            : t("pricing.rateUnavailable")}
        </p>
      ) : null}
      {!conversionDisponible && !deviseEstUsd ? (
        <p className="mt-1 text-center text-xs text-slate-400">{t("pricing.rateFallbackUsd")}</p>
      ) : null}

      <div className="mt-8 grid gap-6 text-left md:grid-cols-3">
        {conversions.map(({ plan, afrique, internationale }) => (
          <div key={plan} className="rounded-2xl border border-navy-light bg-navy p-6">
            <h3 className="text-xl font-bold text-gold">
              {plan === "starter" ? "Starter" : plan === "pro" ? "Pro" : "Agence"}
            </h3>
            <p className="mt-2 text-slate-300">
              {plan === "agence"
                ? t("pricing.blocksUnlimited")
                : t("pricing.blocks", { count: plan === "starter" ? 1 : 5 })}
            </p>
            <p className="mt-4 text-2xl font-bold">
              {afrique.texte}
              <span className="text-sm font-normal text-slate-300">
                {" "}
                {t("pricing.perMonth")} · {t("pricing.gridAfrique")}
              </span>
            </p>
            <p className="mt-1 text-2xl font-bold">
              {internationale.texte}
              <span className="text-sm font-normal text-slate-300">
                {" "}
                {t("pricing.perMonth")} · {t("pricing.gridInternationale")}
              </span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              <li>✓ {t("pricing.fullManagement")}</li>
              <li>✓ {t("pricing.reports")}</li>
              <li>✓ {libelleGestionnaires(plan)}</li>
              <li>
                {VITRINE_PAR_PLAN[plan] ? "✓ " : "— "}
                {VITRINE_PAR_PLAN[plan] ? t("pricing.vitrineYes") : t("pricing.vitrineNo")}
              </li>
              <li>
                {INDIVISION_PAR_PLAN[plan] ? "✓ " : "— "}
                {INDIVISION_PAR_PLAN[plan] ? t("pricing.indivisionYes") : t("pricing.indivisionNo")}
              </li>
            </ul>
            <Link
              href={`/${locale}/inscription`}
              className="mt-6 block rounded-full bg-gold px-5 py-2.5 text-center font-semibold text-navy-dark hover:bg-gold-light"
            >
              {t("pricing.cta")}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

/**
 * Grilles tarifaires PUBLIQUES dynamiques (extension v1.2) : les prix
 * viennent de la couche data (base en mode réel, seed en démo) — un
 * changement de prix dans la console se reflète ici sans redéploiement.
 * Le rendu initial utilise le repli seed (mêmes valeurs) puis se met à
 * jour dès la lecture de la source.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type { Grille, Plan, PrixPlans } from "@/lib/data";
import { TARIFS_SEED, construirePrixPlans } from "@/lib/tarifs";
import {
  GESTIONNAIRES_MAX,
  VITRINE_PAR_PLAN,
  INDIVISION_PAR_PLAN,
} from "@/lib/abonnement";
import { LIMITE_BLOCS } from "@/lib/data/types";

const PLANS: Plan[] = ["starter", "pro", "agence"];

export default function GrilleTarifsPublique({
  africaTitle,
  africaNote,
  internationalTitle,
  internationalNote,
}: {
  africaTitle: string;
  africaNote: string;
  internationalTitle: string;
  internationalNote: string;
}) {
  const t = useTranslations("landing.pricing");
  const locale = useLocale();
  const [prix, setPrix] = useState<PrixPlans>(() => construirePrixPlans(TARIFS_SEED));

  useEffect(() => {
    let actif = true;
    getDataProvider()
      .getTarifsPlateforme()
      .then((tarifs) => {
        if (actif) setPrix(construirePrixPlans(tarifs));
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, []);

  function libelleGestionnaires(plan: Plan): string {
    const max = GESTIONNAIRES_MAX[plan];
    if (max === 0) return t("managersNone");
    if (!Number.isFinite(max)) return t("managersUnlimited");
    return t("managers", { count: max });
  }

  function libelleBlocs(plan: Plan): string {
    const max = LIMITE_BLOCS[plan];
    if (!Number.isFinite(max)) return t("blocksUnlimited");
    return t("blocks", { count: max });
  }

  function carte(plan: Plan, grille: Grille) {
    return (
      <div key={`${grille}-${plan}`} className="rounded-2xl bg-white p-6 shadow-sm">
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
            {VITRINE_PAR_PLAN[plan] ? "✓ " : "— "}
            {VITRINE_PAR_PLAN[plan] ? t("vitrineYes") : t("vitrineNo")}
          </li>
          <li>
            {INDIVISION_PAR_PLAN[plan] ? "✓ " : "— "}
            {INDIVISION_PAR_PLAN[plan] ? t("indivisionYes") : t("indivisionNo")}
          </li>
        </ul>
        <Link
          href={`/${locale}/inscription`}
          className="mt-6 flex min-h-11 items-center justify-center rounded-full bg-navy px-5 py-3 text-center text-base font-bold text-white hover:bg-navy-light"
        >
          {t("cta")}
        </Link>
      </div>
    );
  }

  return (
    <>
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
    </>
  );
}

"use client";

/**
 * Console — Supervision d'un gestionnaire (extension v1.2) : ouvrir le
 * tableau d'un gestionnaire RATTACHÉ, en LECTURE SEULE, sous un bandeau
 * « SUPERVISION » bien visible. L'ouverture est journalisée dans
 * l'audit (ouvrirSupervision) avant tout affichage.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type { SupervisionGestionnaire } from "@/lib/data";

export default function SupervisionPage() {
  const t = useTranslations("console");
  const locale = useLocale();
  const params = useParams<{ rattachementId: string }>();
  const id = params?.rattachementId;
  const [supervision, setSupervision] = useState<SupervisionGestionnaire | null>(null);
  const [erreur, setErreur] = useState(false);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    let actif = true;
    if (!id) return;
    getDataProvider()
      .ouvrirSupervision(id)
      .then((s) => {
        if (actif) setSupervision(s);
      })
      .catch(() => {
        if (actif) setErreur(true);
      })
      .finally(() => {
        if (actif) setCharge(true);
      });
    return () => {
      actif = false;
    };
  }, [id]);

  return (
    <div>
      <Link href={`/${locale}/console/gestionnaires`} className="text-sm font-semibold text-navy underline">
        ← {t("backToManagers")}
      </Link>

      <div className="mt-4 rounded-2xl border-2 border-gold bg-gold/15 p-5">
        <p className="text-lg font-extrabold uppercase tracking-wide text-yellow-800">
          👁 {t("supervisionBanner")}
        </p>
        <p className="mt-1 text-sm text-yellow-900">{t("supervisionText")}</p>
      </div>

      {erreur ? (
        <p role="alert" className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {t("supervisionError")}
        </p>
      ) : !charge ? (
        <p className="mt-6 text-sm text-slate-500">{t("loading")}</p>
      ) : supervision ? (
        <div className="mt-6">
          <h1 className="text-2xl font-bold text-navy">
            {supervision.rattachement.gestionnaire_nom ?? supervision.rattachement.gestionnaire_email}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {supervision.rattachement.gestionnaire_email} ·{" "}
            {supervision.rattachement.contexte === "cizagroup"
              ? t("contextCizaGroup")
              : `${t("contextOwner")} : ${supervision.rattachement.proprietaire_nom ?? supervision.rattachement.proprietaire_id ?? ""}`}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {supervision.immeubles.length === 0 ? (
              <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 md:col-span-2">
                {t("noBuildings")}
              </p>
            ) : null}
            {supervision.immeubles.map((imm) => (
              <article key={imm.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="font-bold text-navy">{imm.nom}</h2>
                <p className="text-sm text-slate-500">{imm.ville}</p>
                <p className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-navy/10 px-2 py-1 text-navy">
                    {t("apartmentsCount", { count: imm.nb_appartements })}
                  </span>
                  <span className="rounded-full bg-green-100 px-2 py-1 text-green-800">
                    {t("tenantsCount", { count: imm.nb_locataires_actifs })}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                    {imm.devise_principale}
                  </span>
                </p>
              </article>
            ))}
          </div>
          <p className="mt-6 text-xs text-slate-400">{t("supervisionReadOnly")}</p>
        </div>
      ) : null}
    </div>
  );
}

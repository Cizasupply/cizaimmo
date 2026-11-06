"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import ImmeubleForm from "@/components/ImmeubleForm";
import { getDataProvider, limiteBlocs } from "@/lib/data";
import type { Abonnement, ImmeubleInput } from "@/lib/data";

export default function NouvelImmeublePage() {
  const t = useTranslations("crud");
  const locale = useLocale();
  const router = useRouter();
  const [abonnement, setAbonnement] = useState<Abonnement | null>(null);
  const [nbActifs, setNbActifs] = useState(0);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    (async () => {
      const p = getDataProvider();
      const session = await p.getSession();
      if (!session) {
        router.push(`/${locale}/connexion`);
        return;
      }
      const [abo, ims] = await Promise.all([p.getAbonnement(), p.listerImmeubles()]);
      setAbonnement(abo);
      setNbActifs(ims.filter((i) => i.statut === "actif").length);
      setChargement(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limite = abonnement ? limiteBlocs(abonnement.plan, abonnement.statut) : null;
  const limiteAtteinte = limite !== null && Number.isFinite(limite) && nbActifs >= limite;

  async function handleSubmit(input: ImmeubleInput) {
    const im = await getDataProvider().creerImmeuble(input);
    router.push(`/${locale}/immeubles/${im.id}`);
  }

  return (
    <AppShell title={t("buildings.formTitleNew")}>
      <Link href={`/${locale}/immeubles`} className="mb-4 inline-block font-semibold text-navy underline">
        ← {t("buildings.backToList")}
      </Link>
      {chargement ? (
        <p className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>
      ) : limiteAtteinte && abonnement ? (
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h2 className="text-lg font-bold text-navy">{t("buildings.limitReached")}</h2>
          <p className="mt-2 text-base text-slate-700">
            {t("buildings.limitText", {
              plan: abonnement.plan,
              limit: String(limite),
              used: String(nbActifs),
            })}
          </p>
          <Link href={`/${locale}/immeubles`} className="mt-6 inline-block rounded-full bg-navy px-6 py-3 text-base font-bold text-white">
            {t("common.back")}
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <ImmeubleForm onSubmit={handleSubmit} submitLabel={t("common.create")} />
        </div>
      )}
    </AppShell>
  );
}

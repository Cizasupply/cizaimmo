"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import LocataireForm from "@/components/LocataireForm";
import { getDataProvider } from "@/lib/data";
import type { LocataireInput } from "@/lib/data";

export default function NouveauLocatairePage() {
  const t = useTranslations("crud");
  const locale = useLocale();
  const router = useRouter();
  const [pret, setPret] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await getDataProvider().getSession();
      if (!session) router.push(`/${locale}/connexion`);
      else setPret(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(input: LocataireInput) {
    const loc = await getDataProvider().creerLocataire(input);
    router.push(`/${locale}/locataires/${loc.id}`);
  }

  return (
    <AppShell
      title={t("tenants.formTitleNew")}
      retourHref={`/${locale}/locataires`}
      retourLabel={t("tenants.backToList")}
    >
      {pret ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LocataireForm onSubmit={handleSubmit} submitLabel={t("common.create")} />
        </div>
      ) : (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>
      )}
    </AppShell>
  );
}

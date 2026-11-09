"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import LocataireForm from "@/components/LocataireForm";
import { getDataProvider } from "@/lib/data";
import type { Locataire, LocataireInput } from "@/lib/data";

export default function ModifierLocatairePage({ params }: { params: { id: string } }) {
  const t = useTranslations("crud");
  const locale = useLocale();
  const router = useRouter();
  const [locataire, setLocataire] = useState<Locataire | null>(null);
  const [chargement, setChargement] = useState(true);
  const [introuvable, setIntrouvable] = useState(false);

  useEffect(() => {
    (async () => {
      const p = getDataProvider();
      const session = await p.getSession();
      if (!session) {
        router.push(`/${locale}/connexion`);
        return;
      }
      const loc = await p.getLocataire(params.id);
      if (!loc) setIntrouvable(true);
      else setLocataire(loc);
      setChargement(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleSubmit(input: LocataireInput) {
    await getDataProvider().modifierLocataire(params.id, input);
    router.push(`/${locale}/locataires/${params.id}`);
  }

  return (
    <AppShell
      title={t("tenants.formTitleEdit")}
      retourHref={`/${locale}/locataires/${params.id}`}
      retourLabel={t("common.back")}
    >
      {chargement ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>
      ) : introuvable || !locataire ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p role="alert" className="text-red-700">{t("errors.ERR_NOT_FOUND")}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LocataireForm initial={locataire} onSubmit={handleSubmit} submitLabel={t("common.save")} />
        </div>
      )}
    </AppShell>
  );
}

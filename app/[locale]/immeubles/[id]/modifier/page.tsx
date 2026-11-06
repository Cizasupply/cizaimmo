"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import ImmeubleForm from "@/components/ImmeubleForm";
import { getDataProvider } from "@/lib/data";
import type { Immeuble, ImmeubleInput } from "@/lib/data";

export default function ModifierImmeublePage({ params }: { params: { id: string } }) {
  const t = useTranslations("crud");
  const locale = useLocale();
  const router = useRouter();
  const [immeuble, setImmeuble] = useState<Immeuble | null>(null);
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
      const im = await p.getImmeuble(params.id);
      if (!im) setIntrouvable(true);
      else setImmeuble(im);
      setChargement(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleSubmit(input: ImmeubleInput) {
    await getDataProvider().modifierImmeuble(params.id, input);
    router.push(`/${locale}/immeubles/${params.id}`);
  }

  return (
    <AppShell title={t("buildings.formTitleEdit")}>
      <Link href={`/${locale}/immeubles/${params.id}`} className="mb-4 inline-block font-semibold text-navy underline">
        ← {t("common.back")}
      </Link>
      {chargement ? (
        <p className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>
      ) : introuvable || !immeuble ? (
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p role="alert" className="text-red-700">{t("errors.ERR_NOT_FOUND")}</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <ImmeubleForm initial={immeuble} onSubmit={handleSubmit} submitLabel={t("common.save")} />
        </div>
      )}
    </AppShell>
  );
}

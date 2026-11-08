"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import AppartementForm from "@/components/AppartementForm";
import EmptyState from "@/components/EmptyState";
import { getDataProvider } from "@/lib/data";
import { contactDossierPourImmeuble, type ContactDossier } from "@/lib/contactDossier";
import type { AppartementInput, Immeuble } from "@/lib/data";

function NouvelAppartementContenu() {
  const t = useTranslations("crud");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedImmeubleId = searchParams.get("immeuble") ?? undefined;
  const lot = searchParams.get("lot") === "1";

  const [immeubles, setImmeubles] = useState<Immeuble[]>([]);
  const [contactDossier, setContactDossier] = useState<ContactDossier | null>(null);
  const [chargement, setChargement] = useState(true);
  const [mode, setMode] = useState<"single" | "bulk">(lot ? "bulk" : "single");

  useEffect(() => {
    (async () => {
      const p = getDataProvider();
      const session = await p.getSession();
      if (!session) {
        router.push(`/${locale}/connexion`);
        return;
      }
      setImmeubles(await p.listerImmeubles());
      // v1.6 : contact attendu du dossier — pour l'immeuble
      // présélectionné s'il y en a un, sinon le contact du compte
      // (le contrôle qui fait foi reste celui de la demande de
      // publication, dans la base).
      setContactDossier(await contactDossierPourImmeuble(p, preselectedImmeubleId ?? null));
      setChargement(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSingle(input: AppartementInput) {
    const apt = await getDataProvider().creerAppartement(input);
    router.push(`/${locale}/appartements/${apt.id}`);
  }

  async function handleBulk(
    immeubleId: string,
    items: Omit<AppartementInput, "immeuble_id">[]
  ) {
    await getDataProvider().creerAppartementsEnLot(immeubleId, items);
    router.push(`/${locale}/immeubles/${immeubleId}`);
  }

  return (
    <AppShell title={mode === "bulk" ? t("apartments.bulkTitle") : t("apartments.formTitleNew")}>
      <Link href={`/${locale}/appartements`} className="mb-4 inline-block font-semibold text-navy underline">
        ← {t("apartments.backToList")}
      </Link>
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setMode("single")}
          className={
            "rounded-full px-4 py-2 text-sm font-bold " +
            (mode === "single" ? "bg-navy text-white" : "border border-slate-300 text-navy")
          }
        >
          {t("apartments.add")}
        </button>
        <button
          type="button"
          onClick={() => setMode("bulk")}
          className={
            "rounded-full px-4 py-2 text-sm font-bold " +
            (mode === "bulk" ? "bg-navy text-white" : "border border-slate-300 text-navy")
          }
        >
          {t("apartments.addBulk")}
        </button>
      </div>
      {chargement ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>
      ) : immeubles.length === 0 ? (
        <EmptyState
          title={t("buildings.emptyTitle")}
          text={t("buildings.emptyText")}
          actionLabel={t("buildings.addFirst")}
          actionHref={`/${locale}/immeubles/nouveau`}
        />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <AppartementForm
            immeubles={immeubles}
            preselectedImmeubleId={preselectedImmeubleId}
            mode={mode}
            onSubmitSingle={handleSingle}
            onSubmitBulk={handleBulk}
            submitLabel={t("common.create")}
            contactDossier={contactDossier}
          />
        </div>
      )}
    </AppShell>
  );
}

export default function NouvelAppartementPage() {
  return (
    <Suspense fallback={null}>
      <NouvelAppartementContenu />
    </Suspense>
  );
}

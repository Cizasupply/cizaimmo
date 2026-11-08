"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import AppartementForm from "@/components/AppartementForm";
import { getDataProvider } from "@/lib/data";
import { contactDossierPourImmeuble, type ContactDossier } from "@/lib/contactDossier";
import type { Appartement, AppartementInput, Immeuble } from "@/lib/data";

export default function ModifierAppartementPage({ params }: { params: { id: string } }) {
  const t = useTranslations("crud");
  const locale = useLocale();
  const router = useRouter();
  const [appartement, setAppartement] = useState<Appartement | null>(null);
  const [immeubles, setImmeubles] = useState<Immeuble[]>([]);
  const [contactDossier, setContactDossier] = useState<ContactDossier | null>(null);
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
      const [apt, ims] = await Promise.all([
        p.getAppartement(params.id),
        p.listerImmeubles(),
      ]);
      if (!apt) setIntrouvable(true);
      else {
        setAppartement(apt);
        // v1.6 : contact attendu du dossier pour l'immeuble de
        // l'appartement (gestionnaire rattaché ou propriétaire).
        setContactDossier(await contactDossierPourImmeuble(p, apt.immeuble_id));
      }
      setImmeubles(ims);
      setChargement(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleSubmit(input: AppartementInput) {
    const { immeuble_id: _immeuble, ...patch } = input;
    await getDataProvider().modifierAppartement(params.id, patch);
    router.push(`/${locale}/appartements/${params.id}`);
  }

  return (
    <AppShell title={t("apartments.formTitleEdit")}>
      <Link href={`/${locale}/appartements/${params.id}`} className="mb-4 inline-block font-semibold text-navy underline">
        ← {t("common.back")}
      </Link>
      {chargement ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>
      ) : introuvable || !appartement ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p role="alert" className="text-red-700">{t("errors.ERR_NOT_FOUND")}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <AppartementForm
            immeubles={immeubles}
            preselectedImmeubleId={appartement.immeuble_id}
            initial={appartement}
            mode="single"
            onSubmitSingle={handleSubmit}
            submitLabel={t("common.save")}
            contactDossier={contactDossier}
          />
        </div>
      )}
    </AppShell>
  );
}

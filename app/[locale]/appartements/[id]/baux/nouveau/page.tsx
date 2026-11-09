"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import BailForm from "@/components/BailForm";
import { getDataProvider } from "@/lib/data";
import type { Appartement, BailInput, Immeuble, Locataire } from "@/lib/data";

export default function NouveauBailAppartementPage({ params }: { params: { id: string } }) {
  const t = useTranslations("crud");
  const locale = useLocale();
  const router = useRouter();
  const [appartements, setAppartements] = useState<Appartement[]>([]);
  const [immeubles, setImmeubles] = useState<Immeuble[]>([]);
  const [locataires, setLocataires] = useState<Locataire[]>([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    (async () => {
      const p = getDataProvider();
      const session = await p.getSession();
      if (!session) {
        router.push(`/${locale}/connexion`);
        return;
      }
      const [apts, ims, locs] = await Promise.all([
        p.listerAppartements(),
        p.listerImmeubles(),
        p.listerLocataires(),
      ]);
      setAppartements(apts);
      setImmeubles(ims);
      setLocataires(locs);
      setChargement(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const appartement = appartements.find((a) => a.id === params.id);

  async function handleSubmit(input: BailInput, fichierBail?: File | null) {
    const p = getDataProvider();
    const bail = await p.creerBail(input);
    if (fichierBail) {
      const contenu = await new Promise<string>((resolve, reject) => {
        const lecteur = new FileReader();
        lecteur.onload = () => resolve(String(lecteur.result));
        lecteur.onerror = () => reject(new Error("lecture"));
        lecteur.readAsDataURL(fichierBail);
      });
      await p.televerserDocument({
        type: "bail",
        entite_type: "bail",
        entite_id: bail.id,
        nom_fichier: fichierBail.name,
        contenu,
        taille_octets: fichierBail.size,
        mime_type: fichierBail.type,
      });
    }
    router.push(`/${locale}/appartements/${params.id}`);
  }

  return (
    <AppShell
      title={
        appartement
          ? t("leases.formTitleFromApartment", { number: appartement.numero })
          : t("leases.formTitle")
      }
      retourHref={`/${locale}/appartements/${params.id}`}
      retourLabel={t("common.back")}
    >
      {chargement ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <BailForm
            appartements={appartements}
            immeubles={immeubles}
            locataires={locataires}
            preselectedAppartementId={params.id}
            onSubmit={handleSubmit}
            submitLabel={t("common.create")}
          />
        </div>
      )}
    </AppShell>
  );
}

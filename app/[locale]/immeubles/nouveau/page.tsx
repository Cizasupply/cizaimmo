"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import ImmeubleForm from "@/components/ImmeubleForm";
import { getDataProvider, limiteBlocs } from "@/lib/data";
import type { Abonnement, ImmeubleInput } from "@/lib/data";

/** Lit un fichier en data URL (patron des téléversements de documents). */
function lireEnDataUrl(fichier: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(lecteur.result as string);
    lecteur.onerror = () => reject(new Error("lecture"));
    lecteur.readAsDataURL(fichier);
  });
}

export default function NouvelImmeublePage() {
  const t = useTranslations("crud");
  const locale = useLocale();
  const router = useRouter();
  const [abonnement, setAbonnement] = useState<Abonnement | null>(null);
  const [nbActifs, setNbActifs] = useState(0);
  const [chargement, setChargement] = useState(true);
  // v1.3 : preuve de propriété optionnelle, téléversée après création.
  const [fichierPreuve, setFichierPreuve] = useState<File | null>(null);
  // v1.7 : photos du bien stagées + cas gestionnaire (autorisation).
  const [fichiersPhotos, setFichiersPhotos] = useState<File[]>([]);
  const [fichierAutorisation, setFichierAutorisation] = useState<File | null>(null);
  const [modeGestionnaire, setModeGestionnaire] = useState(false);

  useEffect(() => {
    (async () => {
      const p = getDataProvider();
      const session = await p.getSession();
      if (!session) {
        router.push(`/${locale}/connexion`);
        return;
      }
      const [abo, ims, profil] = await Promise.all([
        p.getAbonnement(),
        p.listerImmeubles(),
        p.getProfil(),
      ]);
      setAbonnement(abo);
      setNbActifs(ims.filter((i) => i.statut === "actif").length);
      // v1.7 : le rôle du créateur décide du justificatif demandé —
      // gestionnaire = autorisation de gestion + propriétaire déclaré.
      setModeGestionnaire(profil?.role === "gestionnaire");
      setChargement(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limite = abonnement ? limiteBlocs(abonnement.plan, abonnement.statut) : null;
  const limiteAtteinte = limite !== null && Number.isFinite(limite) && nbActifs >= limite;

  async function handleSubmit(input: ImmeubleInput) {
    const provider = getDataProvider();
    const im = await provider.creerImmeuble(input);
    // v1.7 : photos du bien — téléversées après la création (la
    // première devient la photo du passeport). Un échec unitaire ne
    // bloque pas la création : les photos s'ajoutent aussi en édition.
    for (const fichier of fichiersPhotos) {
      try {
        const contenu = await lireEnDataUrl(fichier);
        await provider.ajouterPhotoImmeuble(im.id, {
          nom_fichier: fichier.name,
          taille_octets: fichier.size,
          mime_type: fichier.type || null,
          contenu,
        });
      } catch {
        // Création conservée ; photo ajoutable plus tard.
      }
    }
    // v1.7 : créateur gestionnaire — l'autorisation de gestion
    // remplace la preuve de propriété (document « autorisation »).
    // v1.3 : preuve de propriété (optionnelle) — document
    // « justificatif » rattaché à l'immeuble. Un échec de téléversement
    // ne bloque pas la création : le document peut être ajouté plus
    // tard depuis la page Documents.
    const justificatif = modeGestionnaire
      ? fichierAutorisation
        ? { fichier: fichierAutorisation, type: "autorisation" as const }
        : null
      : fichierPreuve
        ? { fichier: fichierPreuve, type: "justificatif" as const }
        : null;
    if (justificatif) {
      try {
        const contenu = await lireEnDataUrl(justificatif.fichier);
        await provider.televerserDocument({
          type: justificatif.type,
          entite_type: "immeuble",
          entite_id: im.id,
          nom_fichier: justificatif.fichier.name,
          taille_octets: justificatif.fichier.size,
          mime_type: justificatif.fichier.type || null,
          contenu,
        });
      } catch {
        // Création conservée ; justificatif ajoutable plus tard.
      }
    }
    router.push(`/${locale}/immeubles/${im.id}`);
  }

  return (
    <AppShell title={t("buildings.formTitleNew")}>
      <Link href={`/${locale}/immeubles`} className="mb-4 inline-block font-semibold text-navy underline">
        ← {t("buildings.backToList")}
      </Link>
      {chargement ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>
      ) : limiteAtteinte && abonnement ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-navy">{t("buildings.limitReached")}</h2>
          <p className="mt-2 text-base text-slate-700">
            {t("buildings.limitText", {
              plan: abonnement.plan,
              limit: String(limite),
              used: String(nbActifs),
            })}
          </p>
          <Link href={`/${locale}/immeubles`} className="mt-6 inline-block rounded-full border border-navy bg-white px-6 py-3 text-base font-semibold text-navy hover:bg-navy/5">
            {t("common.back")}
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ImmeubleForm
            onSubmit={handleSubmit}
            submitLabel={t("common.create")}
            fichierPreuve={fichierPreuve}
            onFichierPreuveChange={setFichierPreuve}
            modeGestionnaire={modeGestionnaire}
            fichiersPhotos={fichiersPhotos}
            onFichiersPhotosChange={setFichiersPhotos}
            fichierAutorisation={fichierAutorisation}
            onFichierAutorisationChange={setFichierAutorisation}
          />
        </div>
      )}
    </AppShell>
  );
}

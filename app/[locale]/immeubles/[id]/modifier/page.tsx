"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import ImmeubleForm from "@/components/ImmeubleForm";
import { getDataProvider } from "@/lib/data";
import type { Immeuble, ImmeubleInput } from "@/lib/data";

/** Lit un fichier en data URL (patron des téléversements de documents). */
function lireEnDataUrl(fichier: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(lecteur.result as string);
    lecteur.onerror = () => reject(new Error("lecture"));
    lecteur.readAsDataURL(fichier);
  });
}

export default function ModifierImmeublePage({ params }: { params: { id: string } }) {
  const t = useTranslations("crud");
  const locale = useLocale();
  const router = useRouter();
  const [immeuble, setImmeuble] = useState<Immeuble | null>(null);
  const [chargement, setChargement] = useState(true);
  const [introuvable, setIntrouvable] = useState(false);
  // v1.7 : autorisation de gestion (remplacement stagé) + présence au dossier.
  const [fichierAutorisation, setFichierAutorisation] = useState<File | null>(null);
  const [autorisationExistante, setAutorisationExistante] = useState(false);

  async function charger() {
    const p = getDataProvider();
    const im = await p.getImmeuble(params.id);
    if (!im) {
      setIntrouvable(true);
    } else {
      setImmeuble(im);
      // Une autorisation déjà déposée dispense d'en fournir une autre.
      const docs = await p.listerDocuments({
        entite_type: "immeuble",
        entite_id: im.id,
        type: "autorisation",
      });
      setAutorisationExistante(docs.length > 0);
    }
    setChargement(false);
  }

  useEffect(() => {
    (async () => {
      const p = getDataProvider();
      const session = await p.getSession();
      if (!session) {
        router.push(`/${locale}/connexion`);
        return;
      }
      await charger();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  // v1.7 : ajout de photos IMMÉDIAT en édition (téléversement puis
  // rechargement du bien — la première photo reste la principale).
  async function ajouterPhotos(fichiers: File[]) {
    const provider = getDataProvider();
    for (const fichier of fichiers) {
      try {
        const contenu = await lireEnDataUrl(fichier);
        const maj = await provider.ajouterPhotoImmeuble(params.id, {
          nom_fichier: fichier.name,
          taille_octets: fichier.size,
          mime_type: fichier.type || null,
          contenu,
        });
        setImmeuble(maj);
      } catch {
        // Les autres photos continuent ; l'état affiché reste cohérent.
      }
    }
  }

  async function retirerPhoto(index: number) {
    try {
      const maj = await getDataProvider().retirerPhotoImmeuble(params.id, index);
      setImmeuble(maj);
    } catch {
      // État inchangé.
    }
  }

  async function handleSubmit(input: ImmeubleInput) {
    const provider = getDataProvider();
    await provider.modifierImmeuble(params.id, input);
    // v1.7 : remplacement de l'autorisation de gestion, si un nouveau
    // fichier a été choisi (non bloquant, comme les autres documents).
    if (fichierAutorisation) {
      try {
        const contenu = await lireEnDataUrl(fichierAutorisation);
        await provider.televerserDocument({
          type: "autorisation",
          entite_type: "immeuble",
          entite_id: params.id,
          nom_fichier: fichierAutorisation.name,
          taille_octets: fichierAutorisation.size,
          mime_type: fichierAutorisation.type || null,
          contenu,
        });
      } catch {
        // Modification conservée ; autorisation ajoutable plus tard.
      }
    }
    router.push(`/${locale}/immeubles/${params.id}`);
  }

  const modeGestionnaire = immeuble?.origine_creation === "gestionnaire";
  // Photos affichées : les téléversées (URLs signées) ; à défaut,
  // l'ancien lien photo du bien (lecture seule, non retirable ici).
  const photosAffichees =
    immeuble && immeuble.photos_urls.length > 0
      ? immeuble.photos_urls.filter(Boolean)
      : immeuble?.photo_url
        ? [immeuble.photo_url]
        : [];

  return (
    <AppShell
      title={t("buildings.formTitleEdit")}
      retourHref={`/${locale}/immeubles/${params.id}`}
      retourLabel={t("common.back")}
    >
      {chargement ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>
      ) : introuvable || !immeuble ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p role="alert" className="text-red-700">{t("errors.ERR_NOT_FOUND")}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ImmeubleForm
            initial={immeuble}
            onSubmit={handleSubmit}
            submitLabel={t("common.save")}
            modeGestionnaire={modeGestionnaire}
            photosUrls={photosAffichees}
            onAjouterPhotos={ajouterPhotos}
            onRetirerPhotoExistante={immeuble.photos.length > 0 ? retirerPhoto : undefined}
            fichierAutorisation={fichierAutorisation}
            onFichierAutorisationChange={setFichierAutorisation}
            autorisationExistante={autorisationExistante}
          />
        </div>
      )}
    </AppShell>
  );
}

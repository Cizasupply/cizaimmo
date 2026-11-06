"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { TAILLE_MAX_DOCUMENT_OCTETS } from "@/lib/data";

/**
 * Sélecteur de fichier pour un document (spec §6, §8) : PDF, JPG, PNG,
 * 10 Mo maximum — la limite est affichée AVANT l'envoi. Le fichier choisi
 * est rendu à l'appelant (File) ; c'est l'appelant qui le téléverse via
 * le fournisseur (démo : métadonnées + contenu si < 1 Mo ; réel : Storage
 * privé). Aucun envoi n'est fait ici.
 */
export function fichierValide(fichier: File): string | null {
  const extension = fichier.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["pdf", "jpg", "jpeg", "png"].includes(extension)) return "format";
  if (fichier.size > TAILLE_MAX_DOCUMENT_OCTETS) return "tropGros";
  return null;
}

export function tailleMo(octets: number): string {
  return `${(octets / (1024 * 1024)).toFixed(1)} Mo`;
}

export default function DocumentUpload({
  fichier,
  onFichierChange,
  label,
}: {
  fichier: File | null;
  onFichierChange: (fichier: File | null) => void;
  label?: string;
}) {
  const t = useTranslations("documents");
  const inputRef = useRef<HTMLInputElement>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  function choisir(f: File | null) {
    if (!f) {
      setErreur(null);
      onFichierChange(null);
      return;
    }
    const probleme = fichierValide(f);
    if (probleme === "format") {
      setErreur(t("errorFormat"));
      return;
    }
    if (probleme === "tropGros") {
      setErreur(t("errorTooBig", { max: "10 Mo" }));
      return;
    }
    setErreur(null);
    onFichierChange(f);
  }

  return (
    <div>
      <p className="text-sm font-semibold text-slate-900">{label ?? t("uploadLabel")}</p>
      <p className="mt-1 text-sm text-slate-600">{t("uploadHint")}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy hover:border-gold"
        >
          {fichier ? t("changeFile") : t("chooseFile")}
        </button>
        {fichier ? (
          <span className="text-sm text-slate-700">
            {fichier.name} ({tailleMo(fichier.size)})
            <button
              type="button"
              onClick={() => choisir(null)}
              className="ml-2 font-semibold text-navy underline"
            >
              {t("removeFile")}
            </button>
          </span>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        className="hidden"
        onChange={(e) => choisir(e.target.files?.[0] ?? null)}
      />
      {erreur ? (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600">
          {erreur}
        </p>
      ) : null}
    </div>
  );
}

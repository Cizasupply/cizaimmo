"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatDate } from "@/lib/format";
import { getDataProvider } from "@/lib/data";
import type { Document, TypeDocument } from "@/lib/data";
import { messageErreur } from "@/lib/translateError";
import { useLocale } from "next-intl";
import { tailleMo } from "@/components/DocumentUpload";

/**
 * Liste des documents liés à une entité (fiche immeuble / appartement /
 * locataire, page Documents) : téléchargement (lien signé en réel),
 * renommage, suppression avec confirmation nommant l'élément.
 * En démo, un document dont le contenu n'a pas pu être conservé (fichier
 * trop gros pour localStorage) l'affiche honnêtement au lieu de prétendre
 * le conserver.
 */
export default function DocumentList({
  documents,
  onChange,
  showEntity = false,
  nomEntite,
}: {
  documents: Document[];
  onChange: () => void;
  showEntity?: boolean;
  nomEntite?: (d: Document) => string;
}) {
  const t = useTranslations("documents");
  const tc = useTranslations("crud.common");
  const locale = useLocale();
  const [aRenommer, setARenommer] = useState<Document | null>(null);
  const [nouveauNom, setNouveauNom] = useState("");
  const [aSupprimer, setASupprimer] = useState<Document | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);

  function typeLabel(type: TypeDocument): string {
    return t(`types.${type}`);
  }

  async function telecharger(doc: Document) {
    setErreur(null);
    setAction(doc.id);
    try {
      const { url, nomFichier } = await getDataProvider().telechargerDocument(doc.id);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomFichier;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    } finally {
      setAction(null);
    }
  }

  async function confirmerRenommage() {
    if (!aRenommer || !nouveauNom.trim()) return;
    setErreur(null);
    try {
      await getDataProvider().renommerDocument(aRenommer.id, nouveauNom.trim());
      setARenommer(null);
      onChange();
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    }
  }

  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setErreur(null);
    try {
      await getDataProvider().supprimerDocument(aSupprimer.id);
      setASupprimer(null);
      onChange();
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    }
  }

  if (documents.length === 0) {
    return <p className="mt-2 text-slate-600">{t("empty")}</p>;
  }

  return (
    <div>
      {erreur ? (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {erreur}
        </p>
      ) : null}
      <ul className="divide-y divide-slate-200">
        {documents.map((doc) => (
          <li key={doc.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-navy">{doc.nom_fichier}</p>
              <p className="text-sm text-slate-600">
                {typeLabel(doc.type)}
                {showEntity && nomEntite ? ` · ${nomEntite(doc)}` : ""}
                {` · ${formatDate(doc.created_at.slice(0, 10), locale)}`}
                {doc.taille_octets !== null && doc.taille_octets !== undefined ? ` · ${tailleMo(doc.taille_octets)}` : ""}
              </p>
              {doc.contenu_non_conserve ? (
                <p className="text-sm font-medium text-amber-700">{t("demoContentNotKept")}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                disabled={doc.contenu_non_conserve || action === doc.id}
                onClick={() => telecharger(doc)}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy disabled:opacity-40"
              >
                {t("download")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setARenommer(doc);
                  setNouveauNom(doc.nom_fichier);
                }}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy"
              >
                {t("rename")}
              </button>
              <button
                type="button"
                onClick={() => setASupprimer(doc)}
                className="rounded-full border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700"
              >
                {tc("delete")}
              </button>
            </div>
          </li>
        ))}
      </ul>

      {aRenommer ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-navy">{t("renameTitle")}</h2>
            <label htmlFor="nouveau-nom" className="mt-4 block text-sm font-semibold text-slate-900">
              {t("fileName")}
            </label>
            <input
              id="nouveau-nom"
              value={nouveauNom}
              onChange={(e) => setNouveauNom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-gold"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setARenommer(null)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-navy">
                {tc("cancel")}
              </button>
              <button type="button" onClick={confirmerRenommage} className="rounded-full bg-navy px-4 py-2 text-sm font-bold text-white">
                {tc("save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {aSupprimer ? (
        <ConfirmDialog
          title={t("confirmDelete", { name: aSupprimer.nom_fichier })}
          text={t("confirmDeleteText")}
          confirmLabel={tc("delete")}
          cancelLabel={tc("cancel")}
          onConfirm={confirmerSuppression}
          onCancel={() => setASupprimer(null)}
        />
      ) : null}
    </div>
  );
}

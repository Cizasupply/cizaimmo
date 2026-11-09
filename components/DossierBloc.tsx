"use client";

/**
 * Bloc « Complétez votre dossier » (v1.3) — affiché sur l'écran
 * d'attente d'approbation : téléversement de la photo de profil et de
 * la pièce d'identité (bucket privé, via le fournisseur), états
 * visibles (manquant / reçu). L'examen du compte commence quand le
 * dossier est complet ; un dossier incomplet n'empêche pas l'Admin de
 * décider, mais la console le signale.
 *
 * Réorganisation (2026-11-08, décision du fondateur) : une pièce
 * REÇUE s'affiche en lecture seule (carte d'information : libellé,
 * nom du document pour la pièce) ; le téléversement ne s'ouvre
 * qu'au clic sur « Modifier ». Une pièce manquante présente
 * directement son téléversement.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type { Document as DocumentDossier, Profil } from "@/lib/data";
import DocumentUpload from "@/components/DocumentUpload";

function fichierVersDataUrl(fichier: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(lecteur.result as string);
    lecteur.onerror = () => reject(new Error("lecture"));
    lecteur.readAsDataURL(fichier);
  });
}

function LigneDossier({
  recu,
  children,
}: {
  recu: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations("dossier");
  return (
    // Bordure teintée or (Marine & Or) comme les cartes console —
    // organisation desktop 2026-11-08 ; la structure (écran
    // d'attente centré) ne change pas.
    <div className="rounded-xl border border-gold/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            recu ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
          }`}
        >
          {recu ? `✓ ${t("received")}` : t("missing")}
        </span>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

export default function DossierBloc({ profil }: { profil: Profil }) {
  const t = useTranslations("dossier");
  const tc = useTranslations("common");
  const [photoRecue, setPhotoRecue] = useState(Boolean(profil.photo_profil_path));
  const [pieceDoc, setPieceDoc] = useState<DocumentDossier | null>(null);
  const pieceRecue = pieceDoc !== null;
  const [fichierPhoto, setFichierPhoto] = useState<File | null>(null);
  const [fichierPiece, setFichierPiece] = useState<File | null>(null);
  const [occupe, setOccupe] = useState<"photo" | "piece" | null>(null);
  // Réorganisation dossiers : section reçue = lecture seule tant
  // que « Modifier » n'a pas été cliqué.
  const [editionPhoto, setEditionPhoto] = useState(false);
  const [editionPiece, setEditionPiece] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const chargerEtats = useCallback(async () => {
    try {
      const docs = await getDataProvider().listerDocuments();
      setPieceDoc(
        docs.find(
          (d) =>
            d.entite_type === "compte" &&
            d.type === "piece_identite" &&
            d.entite_id === profil.id
        ) ?? null
      );
    } catch {
      // États inconnus : les puces restent « manquant », sans bloquer.
    }
  }, [profil.id]);

  useEffect(() => {
    chargerEtats();
  }, [chargerEtats]);

  async function envoyer(kind: "photo" | "piece") {
    const fichier = kind === "photo" ? fichierPhoto : fichierPiece;
    if (!fichier) return;
    setOccupe(kind);
    setMessage(null);
    setErreur(null);
    try {
      const contenu = await fichierVersDataUrl(fichier);
      const provider = getDataProvider();
      if (kind === "photo") {
        await provider.televerserPhotoProfil({
          type: "autre",
          entite_type: "compte",
          entite_id: profil.id,
          nom_fichier: fichier.name,
          taille_octets: fichier.size,
          mime_type: fichier.type || null,
          contenu,
        });
        setPhotoRecue(true);
        setFichierPhoto(null);
        // Envoi réussi : retour à la lecture seule.
        setEditionPhoto(false);
      } else {
        await provider.soumettreDocumentCompte("piece_identite", {
          type: "piece_identite",
          entite_type: "compte",
          entite_id: profil.id,
          nom_fichier: fichier.name,
          taille_octets: fichier.size,
          mime_type: fichier.type || null,
          contenu,
        });
        setFichierPiece(null);
        setEditionPiece(false);
        // Relit les états : le nom du document reçu s'affiche en
        // lecture seule.
        void chargerEtats();
      }
      setMessage(t("uploadDone"));
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setErreur(
        code === "ERR_DOCUMENT_DOUBLON"
          ? t("errorDuplicate")
          : code === "ERR_DOCUMENT_FORMAT"
            ? t("errorFormat")
            : code === "ERR_DOCUMENT_TROP_GROS"
              ? t("errorTooBig")
              : t("errorGeneric")
      );
    } finally {
      setOccupe(null);
    }
  }

  return (
    <div className="text-left">
      <h2 className="text-base font-bold text-navy">{t("title")}</h2>
      <p className="mt-1 text-sm text-slate-600">{t("intro")}</p>
      <div className="mt-3 space-y-3">
        <LigneDossier recu={photoRecue}>
          {photoRecue && !editionPhoto ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">{t("photoLabel")}</span>
              <button
                type="button"
                onClick={() => setEditionPhoto(true)}
                className="rounded-full bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-light"
              >
                {tc("edit")}
              </button>
            </div>
          ) : (
            <>
              <DocumentUpload
                fichier={fichierPhoto}
                onFichierChange={setFichierPhoto}
                label={t("photoLabel")}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {fichierPhoto ? (
                  <button
                    type="button"
                    disabled={occupe !== null}
                    onClick={() => envoyer("photo")}
                    className="rounded-full bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-light disabled:opacity-50"
                  >
                    {occupe === "photo" ? t("sending") : t("send")}
                  </button>
                ) : null}
                {photoRecue ? (
                  <button
                    type="button"
                    disabled={occupe !== null}
                    onClick={() => {
                      setFichierPhoto(null);
                      setEditionPhoto(false);
                    }}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy hover:border-gold disabled:opacity-50"
                  >
                    {tc("cancel")}
                  </button>
                ) : null}
              </div>
            </>
          )}
        </LigneDossier>
        <LigneDossier recu={pieceRecue}>
          {pieceRecue && !editionPiece ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0 text-sm text-slate-900">
                <span className="font-semibold">{t("idLabel")}</span>
                {pieceDoc ? (
                  <span className="block break-all text-slate-600">{pieceDoc.nom_fichier}</span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => setEditionPiece(true)}
                className="rounded-full bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-light"
              >
                {tc("edit")}
              </button>
            </div>
          ) : (
            <>
              <DocumentUpload
                fichier={fichierPiece}
                onFichierChange={setFichierPiece}
                label={t("idLabel")}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {fichierPiece ? (
                  <button
                    type="button"
                    disabled={occupe !== null}
                    onClick={() => envoyer("piece")}
                    className="rounded-full bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-light disabled:opacity-50"
                  >
                    {occupe === "piece" ? t("sending") : t("send")}
                  </button>
                ) : null}
                {pieceRecue ? (
                  <button
                    type="button"
                    disabled={occupe !== null}
                    onClick={() => {
                      setFichierPiece(null);
                      setEditionPiece(false);
                    }}
                    className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy hover:border-gold disabled:opacity-50"
                  >
                    {tc("cancel")}
                  </button>
                ) : null}
              </div>
            </>
          )}
        </LigneDossier>
      </div>
      {message ? (
        <p role="status" className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">
          {message}
        </p>
      ) : null}
      {erreur ? (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {erreur}
        </p>
      ) : null}
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{t("reviewNote")}</p>
    </div>
  );
}

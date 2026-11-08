"use client";

/**
 * « Mon dossier employé » (2026-11-08, décision du fondateur) — page
 * console réservée aux rôles admin / super_admin : l'employé voit et
 * complète SON dossier complet (photo de profil, pièce d'identité,
 * téléphone + ADRESSE postale), avec le statut de complétude calculé.
 * Exigence suivie, NON bloquante : rien dans la console n'est
 * conditionné à ce dossier (le Super Admin le suit dans l'Équipe).
 * Les clients n'ont pas accès à cette page (garde du ConsoleShell +
 * ERR_ACCES_PLATEFORME du fournisseur).
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type { DossierEmploye } from "@/lib/data";
import DocumentUpload from "@/components/DocumentUpload";
import Field from "@/components/Field";

function fichierVersDataUrl(fichier: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(lecteur.result as string);
    lecteur.onerror = () => reject(new Error("lecture"));
    lecteur.readAsDataURL(fichier);
  });
}

const CARTE = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const BOUTON_MARINE =
  "rounded-full bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-light disabled:opacity-50";
const BOUTON_OR =
  "rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy-dark shadow-sm transition hover:brightness-105 disabled:opacity-50";

export default function MonDossierEmployePage() {
  const t = useTranslations("dossierEmploye");
  const [dossier, setDossier] = useState<DossierEmploye | null>(null);
  const [chargement, setChargement] = useState(true);
  const [fichierPhoto, setFichierPhoto] = useState<File | null>(null);
  const [fichierPiece, setFichierPiece] = useState<File | null>(null);
  const [occupe, setOccupe] = useState<"photo" | "piece" | "form" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [form, setForm] = useState({
    telephone: "",
    adresse: "",
    adresse_ville: "",
    adresse_code_postal: "",
    adresse_pays: "",
  });

  const charger = useCallback(async () => {
    try {
      const d = await getDataProvider().getMonDossierEmploye();
      setDossier(d);
      setForm({
        telephone: d.telephone ?? "",
        adresse: d.adresse ?? "",
        adresse_ville: d.adresse_ville ?? "",
        adresse_code_postal: d.adresse_code_postal ?? "",
        adresse_pays: d.adresse_pays ?? "",
      });
    } catch {
      setErreur(t("errorGeneric"));
    } finally {
      setChargement(false);
    }
  }, [t]);

  useEffect(() => {
    charger();
  }, [charger]);

  function messageErreur(e: unknown): string {
    const code = e instanceof Error ? e.message : "";
    return code === "ERR_DOCUMENT_DOUBLON"
      ? t("errorDuplicate")
      : code === "ERR_DOCUMENT_FORMAT"
        ? t("errorFormat")
        : code === "ERR_DOCUMENT_TROP_GROS"
          ? t("errorTooBig")
          : t("errorGeneric");
  }

  async function envoyer(kind: "photo" | "piece") {
    const fichier = kind === "photo" ? fichierPhoto : fichierPiece;
    if (!fichier || !dossier) return;
    setOccupe(kind);
    setMessage(null);
    setErreur(null);
    try {
      const contenu = await fichierVersDataUrl(fichier);
      const provider = getDataProvider();
      const entree = {
        entite_type: "compte" as const,
        entite_id: dossier.compte_id,
        nom_fichier: fichier.name,
        taille_octets: fichier.size,
        mime_type: fichier.type || null,
        contenu,
      };
      const maj =
        kind === "photo"
          ? await provider.televerserPhotoDossierEmploye({
              ...entree,
              type: "autre",
            })
          : await provider.televerserPieceDossierEmploye({
              ...entree,
              type: "piece_identite",
            });
      setDossier(maj);
      if (kind === "photo") setFichierPhoto(null);
      else setFichierPiece(null);
      setMessage(t("savedMsg"));
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(null);
    }
  }

  async function enregistrer() {
    setOccupe("form");
    setMessage(null);
    setErreur(null);
    try {
      const vide = (v: string) => {
        const nettoye = v.trim();
        return nettoye === "" ? null : nettoye;
      };
      const maj = await getDataProvider().mettreAJourDossierEmploye({
        telephone: vide(form.telephone),
        adresse: vide(form.adresse),
        adresse_ville: vide(form.adresse_ville),
        adresse_code_postal: vide(form.adresse_code_postal),
        adresse_pays: vide(form.adresse_pays),
      });
      setDossier(maj);
      setMessage(t("savedMsg"));
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(null);
    }
  }

  async function ouvrirPiece() {
    if (!dossier?.piece_identite) return;
    try {
      const { url } = await getDataProvider().telechargerDocument(
        dossier.piece_identite.id
      );
      window.open(url, "_blank", "noopener");
    } catch {
      setErreur(t("errorGeneric"));
    }
  }

  if (chargement) {
    return <p className="text-sm text-slate-500">…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-navy">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">{t("intro")}</p>
      </div>

      {message ? (
        <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
          {message}
        </p>
      ) : null}
      {erreur ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {erreur}
        </p>
      ) : null}

      {dossier ? (
        <>
          {/* Statut de complétude — calculé, jamais bloquant. */}
          <section
            className={`${CARTE} ${
              dossier.complet
                ? "border-green-200 bg-green-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <p
              className={`text-base font-bold ${
                dossier.complet ? "text-green-800" : "text-amber-800"
              }`}
            >
              {dossier.complet ? `✓ ${t("complete")}` : t("incomplete")}
            </p>
            {!dossier.complet ? (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-amber-900">
                <span className="font-semibold">{t("missingLabel")}</span>
                {dossier.manquants.map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-amber-800"
                  >
                    {t(`elements.${m}`)}
                  </span>
                ))}
              </p>
            ) : null}
          </section>

          {/* Identité : photo + pièce d'identité (bucket privé). */}
          <section className={CARTE}>
            <h2 className="text-base font-bold text-navy">{t("idSection")}</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-navy">{t("photo")}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      dossier.photo_profil_path
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {dossier.photo_profil_path
                      ? `✓ ${t("received")}`
                      : t("missing")}
                  </span>
                </div>
                {dossier.photo_profil_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={dossier.photo_profil_url}
                    alt={t("photo")}
                    className="mt-3 h-28 w-28 rounded-xl border border-slate-200 object-cover"
                  />
                ) : null}
                <div className="mt-3">
                  <DocumentUpload
                    fichier={fichierPhoto}
                    onFichierChange={setFichierPhoto}
                    label={t("uploadPhoto")}
                  />
                  {fichierPhoto ? (
                    <button
                      type="button"
                      disabled={occupe !== null}
                      onClick={() => envoyer("photo")}
                      className={`mt-2 ${BOUTON_MARINE}`}
                    >
                      {t("uploadPhoto")}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-navy">{t("piece")}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      dossier.piece_identite
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {dossier.piece_identite
                      ? `✓ ${t("received")}`
                      : t("missing")}
                  </span>
                </div>
                {dossier.piece_identite ? (
                  <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <span className="break-all font-medium">
                      {dossier.piece_identite.nom_fichier}
                    </span>
                    <button
                      type="button"
                      onClick={ouvrirPiece}
                      className="font-bold text-navy underline"
                    >
                      {t("open")}
                    </button>
                  </p>
                ) : null}
                <div className="mt-3">
                  <DocumentUpload
                    fichier={fichierPiece}
                    onFichierChange={setFichierPiece}
                    label={t("uploadId")}
                  />
                  {fichierPiece ? (
                    <button
                      type="button"
                      disabled={occupe !== null}
                      onClick={() => envoyer("piece")}
                      className={`mt-2 ${BOUTON_MARINE}`}
                    >
                      {t("uploadId")}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          {/* Téléphone + adresse postale. */}
          <section className={CARTE}>
            <h2 className="text-base font-bold text-navy">{t("addressSection")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("addressHint")}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Field
                id="employe-telephone"
                label={t("phone")}
                value={form.telephone}
                onChange={(v) => setForm({ ...form, telephone: v })}
                autoComplete="tel"
              />
              <Field
                id="employe-adresse"
                label={t("address")}
                value={form.adresse}
                onChange={(v) => setForm({ ...form, adresse: v })}
                autoComplete="street-address"
              />
              <Field
                id="employe-ville"
                label={t("city")}
                value={form.adresse_ville}
                onChange={(v) => setForm({ ...form, adresse_ville: v })}
                autoComplete="address-level2"
              />
              <Field
                id="employe-code-postal"
                label={t("postalCode")}
                value={form.adresse_code_postal}
                onChange={(v) => setForm({ ...form, adresse_code_postal: v })}
                autoComplete="postal-code"
              />
              <Field
                id="employe-pays"
                label={t("country")}
                value={form.adresse_pays}
                onChange={(v) => setForm({ ...form, adresse_pays: v })}
                autoComplete="country-name"
              />
            </div>
            <button
              type="button"
              disabled={occupe !== null}
              onClick={enregistrer}
              className={`mt-4 ${BOUTON_OR}`}
            >
              {occupe === "form" ? "…" : t("save")}
            </button>
          </section>
        </>
      ) : null}
    </div>
  );
}

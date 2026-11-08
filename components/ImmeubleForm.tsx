"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Field from "@/components/Field";
import MoneyField from "@/components/MoneyField";
import { DEVISES, TAILLE_MAX_DOCUMENT_OCTETS } from "@/lib/data";
import { PAYS } from "@/lib/countries";
import type { Devise, Immeuble, ImmeubleInput } from "@/lib/data";
import { messageErreur } from "@/lib/translateError";
import DocumentUpload from "@/components/DocumentUpload";

type Errors = Partial<Record<string, string>> & { form?: string };

/** Aperçu local d'un fichier photo stagé (création), URL révoquée au retrait. */
function ApercuFichier({ fichier }: { fichier: File }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(fichier);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [fichier]);
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-20 w-24 rounded-lg object-cover" />
  ) : (
    <div className="h-20 w-24 rounded-lg bg-slate-100" />
  );
}

/**
 * Formulaire immeuble (spec §8) : création et modification.
 * Validation champ par champ, message clair sous le champ, le formulaire
 * n'est jamais vidé en cas d'erreur (valeurs contrôlées).
 *
 * v1.7 : photos du bien (au moins une — la première est la photo du
 * passeport) et, pour un créateur GESTIONNAIRE, autorisation de
 * gestion + propriétaire déclaré au lieu de la preuve de propriété.
 */
export default function ImmeubleForm({
  initial,
  onSubmit,
  submitLabel,
  fichierPreuve,
  onFichierPreuveChange,
  modeGestionnaire = false,
  photosUrls = [],
  fichiersPhotos = [],
  onFichiersPhotosChange,
  onAjouterPhotos,
  onRetirerPhotoExistante,
  fichierAutorisation,
  onFichierAutorisationChange,
  autorisationExistante = false,
}: {
  initial?: Immeuble | null;
  onSubmit: (input: ImmeubleInput) => Promise<void>;
  submitLabel: string;
  /**
   * v1.3 (création seulement) : preuve de propriété OPTIONNELLE
   * (titre/certificat foncier ou acte d'achat) — téléversée par la
   * page après la création, comme document « justificatif » de
   * l'immeuble ; visible dans le Dossier console du propriétaire.
   */
  fichierPreuve?: File | null;
  onFichierPreuveChange?: (fichier: File | null) => void;
  /** v1.7 : le créateur est un gestionnaire (pas le propriétaire). */
  modeGestionnaire?: boolean;
  /** v1.7 : URLs d'affichage des photos déjà attachées au bien (édition). */
  photosUrls?: string[];
  /** v1.7 : fichiers photo stagés (création — téléversés par la page après création). */
  fichiersPhotos?: File[];
  onFichiersPhotosChange?: (fichiers: File[]) => void;
  /** v1.7 (édition) : ajout immédiat — la page téléverse et recharge. */
  onAjouterPhotos?: (fichiers: File[]) => void;
  /** v1.7 (édition) : retrait immédiat d'une photo existante (index). */
  onRetirerPhotoExistante?: (index: number) => void;
  /** v1.7 : autorisation de gestion stagée (créateur gestionnaire). */
  fichierAutorisation?: File | null;
  onFichierAutorisationChange?: (fichier: File | null) => void;
  /** v1.7 (édition) : une autorisation est déjà au dossier. */
  autorisationExistante?: boolean;
}) {
  const t = useTranslations("crud");
  const tf = useTranslations("crud.buildings.fields");
  const tv = useTranslations("crud.validation");
  const tc = useTranslations("crud.common");
  const td = useTranslations("dossier");
  const t16 = useTranslations("v16");
  const t17 = useTranslations("v17");

  const [nom, setNom] = useState(initial?.nom ?? "");
  const [adresse, setAdresse] = useState(initial?.adresse ?? "");
  const [quartier, setQuartier] = useState(initial?.quartier ?? "");
  const [ville, setVille] = useState(initial?.ville ?? "");
  const [pays, setPays] = useState(initial?.pays ?? "");
  const [devise, setDevise] = useState<Devise>(initial?.devise ?? "USD");
  const [type, setType] = useState<ImmeubleInput["type"]>(initial?.type ?? "immeuble");
  const [etages, setEtages] = useState(initial?.etages != null ? String(initial.etages) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  // v1.7 : propriétaire déclaré (créateur gestionnaire).
  const [declareNom, setDeclareNom] = useState(initial?.proprietaire_declare_nom ?? "");
  const [declareEmail, setDeclareEmail] = useState(initial?.proprietaire_declare_email ?? "");
  const [erreurPhoto, setErreurPhoto] = useState<string | null>(null);
  const inputPhotosRef = useRef<HTMLInputElement>(null);
  const [valeur, setValeur] = useState(initial?.valeur_bien != null ? String(initial.valeur_bien) : "");
  const [deviseValeur, setDeviseValeur] = useState<Devise>(initial?.devise_valeur ?? initial?.devise ?? "USD");
  const [dateAcquisition, setDateAcquisition] = useState(initial?.date_acquisition ?? "");
  const [prixAcquisition, setPrixAcquisition] = useState(
    initial?.prix_acquisition != null ? String(initial.prix_acquisition) : ""
  );
  const [dateEstimation, setDateEstimation] = useState(initial?.date_estimation ?? "");
  const [modeAcquisition, setModeAcquisition] = useState(initial?.mode_acquisition ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  function valider(): boolean {
    const next: Errors = {};
    if (!nom.trim()) next.nom = tv("nameRequired");
    if (!adresse.trim()) next.adresse = tv("addressRequired");
    if (!ville.trim()) next.ville = tv("cityRequired");
    if (!pays) next.pays = tv("countryRequired");
    if (valeur.trim() !== "" && !(Number(valeur) > 0)) next.valeur = tv("positiveStrict");
    if (prixAcquisition.trim() !== "" && !(Number(prixAcquisition) >= 0)) {
      next.prixAcquisition = tv("positive");
    }
    if (etages.trim() !== "" && !(Number(etages) >= 0)) next.etages = tv("positive");
    // v1.7 : au moins une photo du bien (existante ou stagée).
    if (photosUrls.length + fichiersPhotos.length === 0) {
      next.photos = t17("photoRequired");
    }
    // v1.7 : créateur gestionnaire — propriétaire déclaré + autorisation.
    if (modeGestionnaire) {
      if (!declareNom.trim()) next.declareNom = t17("ownerNameRequired");
      if (!declareEmail.trim()) next.declareEmail = t17("ownerEmailRequired");
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(declareEmail.trim())) {
        next.declareEmail = t17("ownerEmailInvalid");
      }
      if (!autorisationExistante && !fichierAutorisation) {
        next.autorisation = t17("autorisationRequired");
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  /** v1.7 : sélection de photos — JPG/PNG, 10 Mo max (même limite que les documents). */
  function choisirPhotos(liste: FileList | null) {
    if (!liste || liste.length === 0) return;
    const valides: File[] = [];
    for (const f of Array.from(liste)) {
      const extension = f.name.split(".").pop()?.toLowerCase() ?? "";
      if (!["jpg", "jpeg", "png"].includes(extension) || f.size > TAILLE_MAX_DOCUMENT_OCTETS) {
        setErreurPhoto(t17("photosFormatHint"));
        continue;
      }
      valides.push(f);
    }
    if (valides.length === 0) return;
    setErreurPhoto(null);
    if (onAjouterPhotos) onAjouterPhotos(valides);
    else if (onFichiersPhotosChange) onFichiersPhotosChange([...fichiersPhotos, ...valides]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valider()) return;
    setSaving(true);
    setErrors({});
    try {
      await onSubmit({
        nom: nom.trim(),
        adresse: adresse.trim(),
        quartier: quartier.trim() || null,
        ville: ville.trim(),
        pays,
        devise,
        type,
        etages: etages.trim() === "" ? null : Number(etages),
        // v1.7 : l'ancien lien photo est conservé tel quel ; les
        // photos du bien passent par le téléversement (photos).
        photo_url: initial?.photo_url ?? null,
        // v1.7 : propriétaire déclaré (créateur gestionnaire seulement).
        proprietaire_declare_nom: modeGestionnaire ? declareNom.trim() : undefined,
        proprietaire_declare_email: modeGestionnaire ? declareEmail.trim() : undefined,
        notes: notes.trim() || null,
        valeur_bien: valeur.trim() === "" ? null : Number(valeur),
        devise_valeur: valeur.trim() === "" ? null : deviseValeur,
        date_acquisition: dateAcquisition || null,
        prix_acquisition: prixAcquisition.trim() === "" ? null : Number(prixAcquisition),
        date_estimation: dateEstimation || null,
        mode_acquisition: modeAcquisition || null,
      });
    } catch (err) {
      setErrors({ form: messageErreur(t as unknown as (k: string) => string, err) });
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Field id="nom" label={tf("name")} value={nom} onChange={setNom} error={errors.nom} required />
      <Field id="adresse" label={tf("address")} value={adresse} onChange={setAdresse} error={errors.adresse} required />
      <Field id="quartier" label={t16("district")} value={quartier} onChange={setQuartier} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="ville" label={tf("city")} value={ville} onChange={setVille} error={errors.ville} required />
        <Field id="pays" label={tf("country")} value={pays} onChange={setPays} error={errors.pays} required>
          <option value="">{tv("countryRequired")}</option>
          {PAYS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="devise" label={tf("currency")} value={devise} onChange={(v) => setDevise(v as Devise)} required>
          {DEVISES.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </Field>
        <Field id="type" label={tf("type")} value={type} onChange={(v) => setType(v as ImmeubleInput["type"])}>
          <option value="immeuble">{tf("typeImmeuble")}</option>
          <option value="bloc">{tf("typeBloc")}</option>
          <option value="maison">{tf("typeMaison")}</option>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="etages" label={tf("floors")} type="number" value={etages} onChange={setEtages} error={errors.etages} />
      </div>
      {/* v1.7 : photos du bien — la première est la photo du passeport. */}
      <div className="rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-900">{t17("photosTitle")}</p>
        <p className="mt-1 text-sm text-slate-600">{t17("photosHint")}</p>
        <p className="mt-1 text-sm text-slate-500">{t17("photosFormatHint")}</p>
        {(photosUrls.length > 0 || fichiersPhotos.length > 0) ? (
          <ul className="mt-3 flex flex-wrap gap-3">
            {photosUrls.map((url, idx) => (
              <li key={`existante-${idx}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-20 w-24 rounded-lg object-cover" />
                {idx === 0 && fichiersPhotos.length === 0 ? (
                  <span className="absolute left-1 top-1 rounded-full bg-navy px-2 py-0.5 text-[11px] font-bold text-white">
                    {t17("photoMain")}
                  </span>
                ) : null}
                {onRetirerPhotoExistante ? (
                  <button
                    type="button"
                    onClick={() => onRetirerPhotoExistante(idx)}
                    className="absolute bottom-1 right-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-red-700 shadow"
                  >
                    {t17("photoRemove")}
                  </button>
                ) : null}
              </li>
            ))}
            {fichiersPhotos.map((f, idx) => (
              <li key={`stagee-${idx}`} className="relative">
                <ApercuFichier fichier={f} />
                {idx === 0 && photosUrls.length === 0 ? (
                  <span className="absolute left-1 top-1 rounded-full bg-navy px-2 py-0.5 text-[11px] font-bold text-white">
                    {t17("photoMain")}
                  </span>
                ) : null}
                {onFichiersPhotosChange ? (
                  <button
                    type="button"
                    onClick={() =>
                      onFichiersPhotosChange(fichiersPhotos.filter((_, j) => j !== idx))
                    }
                    className="absolute bottom-1 right-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-red-700 shadow"
                  >
                    {t17("photoRemove")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          onClick={() => inputPhotosRef.current?.click()}
          className="mt-3 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy hover:border-gold"
        >
          {t17("photoAdd")}
        </button>
        <input
          ref={inputPhotosRef}
          type="file"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          multiple
          className="hidden"
          onChange={(e) => {
            choisirPhotos(e.target.files);
            e.target.value = "";
          }}
        />
        {erreurPhoto ? (
          <p role="alert" className="mt-2 text-sm font-medium text-red-600">{erreurPhoto}</p>
        ) : null}
        {errors.photos ? (
          <p role="alert" className="mt-2 text-sm font-medium text-red-600">{errors.photos}</p>
        ) : null}
      </div>
      <MoneyField
        id="valeur"
        label={tf("value")}
        amount={valeur}
        onAmountChange={setValeur}
        currency={deviseValeur}
        onCurrencyChange={setDeviseValeur}
        error={errors.valeur}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="date-acquisition" label={tf("acquisitionDate")} type="date" value={dateAcquisition} onChange={setDateAcquisition} />
        <Field
          id="prix-acquisition"
          label={`${tf("acquisitionPrice")} (${deviseValeur})`}
          type="number"
          value={prixAcquisition}
          onChange={setPrixAcquisition}
          error={errors.prixAcquisition}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="date-estimation" label={tf("estimationDate")} type="date" value={dateEstimation} onChange={setDateEstimation} />
        <Field id="mode-acquisition" label={tf("acquisitionMode")} value={modeAcquisition} onChange={setModeAcquisition}>
          <option value="">{tc("notProvided")}</option>
          <option value="achat">{t("passport.modeAchat")}</option>
          <option value="heritage">{t("passport.modeHeritage")}</option>
          <option value="donation">{t("passport.modeDonation")}</option>
          <option value="autre">{t("passport.modeAutre")}</option>
        </Field>
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-semibold text-slate-900">{tf("notes")}</label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"
        />
      </div>
      {modeGestionnaire ? (
        <div className="rounded-xl border border-gold/60 bg-amber-50/50 p-4">
          <p className="text-sm font-bold text-navy">{t17("managerTitle")}</p>
          <p className="mt-1 text-sm text-slate-600">{t17("managerHint")}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field id="declare-nom" label={t17("ownerName")} value={declareNom} onChange={setDeclareNom} error={errors.declareNom} required />
            <Field id="declare-email" label={t17("ownerEmail")} type="email" value={declareEmail} onChange={setDeclareEmail} error={errors.declareEmail} required />
          </div>
          {onFichierAutorisationChange ? (
            <div className="mt-3">
              <DocumentUpload
                fichier={fichierAutorisation ?? null}
                onFichierChange={onFichierAutorisationChange}
                label={t17("autorisationLabel")}
              />
              <p className="mt-1 text-sm text-slate-600">
                {autorisationExistante ? t17("autorisationOnFile") : t17("autorisationHint")}
              </p>
              {errors.autorisation ? (
                <p role="alert" className="mt-2 text-sm font-medium text-red-600">{errors.autorisation}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : onFichierPreuveChange ? (
        <div className="rounded-xl border border-slate-200 p-4">
          <DocumentUpload
            fichier={fichierPreuve ?? null}
            onFichierChange={onFichierPreuveChange}
            label={td("ownershipProofLabel")}
          />
          <p className="mt-1 text-sm text-slate-600">{td("ownershipProofHint")}</p>
        </div>
      ) : null}
      {errors.form ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{errors.form}</p>
      ) : null}
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-full bg-navy px-6 py-3 text-base font-bold text-white hover:bg-navy-light disabled:opacity-50 sm:w-auto"
      >
        {saving ? tc("saving") : submitLabel}
      </button>
    </form>
  );
}

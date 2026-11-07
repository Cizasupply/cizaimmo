"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Field from "@/components/Field";
import MoneyField from "@/components/MoneyField";
import { DEVISES } from "@/lib/data";
import { PAYS } from "@/lib/countries";
import type { Devise, Immeuble, ImmeubleInput } from "@/lib/data";
import { messageErreur } from "@/lib/translateError";
import DocumentUpload from "@/components/DocumentUpload";

type Errors = Partial<Record<string, string>> & { form?: string };

/**
 * Formulaire immeuble (spec §8) : création et modification.
 * Validation champ par champ, message clair sous le champ, le formulaire
 * n'est jamais vidé en cas d'erreur (valeurs contrôlées).
 */
export default function ImmeubleForm({
  initial,
  onSubmit,
  submitLabel,
  fichierPreuve,
  onFichierPreuveChange,
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
}) {
  const t = useTranslations("crud");
  const tf = useTranslations("crud.buildings.fields");
  const tv = useTranslations("crud.validation");
  const tc = useTranslations("crud.common");
  const td = useTranslations("dossier");

  const [nom, setNom] = useState(initial?.nom ?? "");
  const [adresse, setAdresse] = useState(initial?.adresse ?? "");
  const [ville, setVille] = useState(initial?.ville ?? "");
  const [pays, setPays] = useState(initial?.pays ?? "");
  const [devise, setDevise] = useState<Devise>(initial?.devise ?? "USD");
  const [type, setType] = useState<ImmeubleInput["type"]>(initial?.type ?? "immeuble");
  const [etages, setEtages] = useState(initial?.etages != null ? String(initial.etages) : "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photo_url ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
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
    setErrors(next);
    return Object.keys(next).length === 0;
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
        ville: ville.trim(),
        pays,
        devise,
        type,
        etages: etages.trim() === "" ? null : Number(etages),
        photo_url: photoUrl.trim() || null,
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
        <Field id="photo" label={tf("photoUrl")} value={photoUrl} onChange={setPhotoUrl} placeholder="https://" />
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
      {onFichierPreuveChange ? (
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

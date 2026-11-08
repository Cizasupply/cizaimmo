"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Field from "@/components/Field";
import MoneyField from "@/components/MoneyField";
import DocumentUpload from "@/components/DocumentUpload";
import { CATEGORIES_DEPENSES, type Appartement, type Depense, type DepenseInput, type Devise, type Immeuble } from "@/lib/data";
import { messageErreur } from "@/lib/translateError";

type Errors = Partial<Record<string, string>> & { form?: string };

/**
 * Formulaire dépense (spec §8) : date, immeuble, appartement (optionnel),
 * catégorie OBLIGATOIRE (pour un ROI fiable), libellé, montant strictement
 * positif + devise, fournisseur, justificatif (PDF/JPG/PNG, 10 Mo max).
 * Le justificatif est rendu avec la saisie ; la page le téléverse après
 * la création de la dépense (il est lié à la dépense créée).
 */
export default function DepenseForm({
  immeubles,
  appartements,
  depense,
  onSubmit,
  submitLabel,
}: {
  immeubles: Immeuble[];
  appartements: Appartement[];
  depense?: Depense;
  onSubmit: (input: DepenseInput, justificatif: File | null) => Promise<void>;
  submitLabel: string;
}) {
  const t = useTranslations("crud");
  const tf = useTranslations("crud.expenses.fields");
  const tv = useTranslations("crud.validation");
  const tc = useTranslations("crud.common");
  const td = useTranslations("documents");

  const [date, setDate] = useState(depense?.date ?? new Date().toISOString().slice(0, 10));
  const [immeubleId, setImmeubleId] = useState(depense?.immeuble_id ?? "");
  const [appartementId, setAppartementId] = useState(depense?.appartement_id ?? "");
  const [categorie, setCategorie] = useState(depense?.categorie ?? "");
  const [libelle, setLibelle] = useState(depense?.libelle ?? "");
  const [montant, setMontant] = useState(depense ? String(depense.montant) : "");
  const [devise, setDevise] = useState<Devise>(depense?.devise ?? "USD");
  const [fournisseur, setFournisseur] = useState(depense?.fournisseur ?? "");
  const [justificatif, setJustificatif] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const aptsImmeuble = appartements.filter((a) => !immeubleId || a.immeuble_id === immeubleId);

  function valider(): boolean {
    const next: Errors = {};
    if (!date) next.date = tv("required");
    if (!immeubleId) next.immeuble = tv("required");
    if (!categorie) next.categorie = tv("required");
    if (!libelle.trim()) next.libelle = tv("required");
    if (montant.trim() === "" || !(Number(montant) > 0)) next.montant = tv("positiveStrict");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valider()) return;
    setSaving(true);
    setErrors({});
    try {
      await onSubmit(
        {
          immeuble_id: immeubleId,
          appartement_id: appartementId || null,
          date,
          categorie: categorie as DepenseInput["categorie"],
          libelle: libelle.trim(),
          montant: Number(montant),
          devise,
          fournisseur: fournisseur.trim() || null,
        },
        justificatif
      );
    } catch (err) {
      setErrors({ form: messageErreur(t as unknown as (k: string) => string, err) });
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="dep-date" label={tf("date")} type="date" value={date} onChange={setDate} error={errors.date} required />
        <Field id="dep-immeuble" label={tf("building")} value={immeubleId} onChange={(v) => { setImmeubleId(v); setAppartementId(""); }} error={errors.immeuble} required>
          <option value="">{tv("chooseBuilding")}</option>
          {immeubles.map((i) => (
            <option key={i.id} value={i.id}>{i.nom}</option>
          ))}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="dep-appartement" label={tf("apartment")} value={appartementId} onChange={setAppartementId}>
          <option value="">{tv("optional")}</option>
          {aptsImmeuble.map((a) => (
            <option key={a.id} value={a.id}>{a.numero}</option>
          ))}
        </Field>
        <Field id="dep-categorie" label={tf("category")} value={categorie} onChange={setCategorie} error={errors.categorie} required>
          <option value="">{tv("chooseCategory")}</option>
          {CATEGORIES_DEPENSES.map((c) => (
            <option key={c} value={c}>{t(`expenses.categories.${c}`)}</option>
          ))}
        </Field>
      </div>
      <Field id="dep-libelle" label={tf("label")} value={libelle} onChange={setLibelle} error={errors.libelle} required />
      <MoneyField
        id="dep-montant"
        label={tf("amount")}
        amount={montant}
        onAmountChange={setMontant}
        currency={devise}
        onCurrencyChange={setDevise}
        error={errors.montant}
        required
      />
      <Field id="dep-fournisseur" label={tf("supplier")} value={fournisseur} onChange={setFournisseur} />
      <DocumentUpload fichier={justificatif} onFichierChange={setJustificatif} label={td("uploadLabel")} />
      {depense?.justificatif_url ? (
        <p className="text-sm text-slate-600">{t("expenses.existingReceipt")}</p>
      ) : null}
      {errors.form ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{errors.form}</p>
      ) : null}
      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-full bg-gold px-6 py-3 text-base font-bold text-navy hover:bg-gold-light disabled:opacity-50 sm:w-auto"
      >
        {saving ? tc("saving") : submitLabel}
      </button>
    </form>
  );
}

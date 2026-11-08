"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Field from "@/components/Field";
import type { Locataire, LocataireInput } from "@/lib/data";
import { telephoneValide, emailValide } from "@/lib/data/helpers";
import { messageErreur } from "@/lib/translateError";

type Errors = Partial<Record<string, string>> & { form?: string };

/**
 * Formulaire locataire (spec §8) : nom complet, téléphone international
 * (10 à 15 chiffres), e-mail valide si renseigné, pièce d'identité.
 */
export default function LocataireForm({
  initial,
  onSubmit,
  submitLabel,
}: {
  initial?: Locataire | null;
  onSubmit: (input: LocataireInput) => Promise<void>;
  submitLabel: string;
}) {
  const t = useTranslations("crud");
  const tf = useTranslations("crud.tenants.fields");
  const tv = useTranslations("crud.validation");
  const tc = useTranslations("crud.common");

  const [nom, setNom] = useState(initial?.nom ?? "");
  const [telephone, setTelephone] = useState(initial?.telephone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [pieceType, setPieceType] = useState(initial?.piece_type ?? "");
  const [pieceNumero, setPieceNumero] = useState(initial?.piece_numero ?? "");
  const [adressePrecedente, setAdressePrecedente] = useState(initial?.adresse_precedente ?? "");
  const [contactUrgence, setContactUrgence] = useState(initial?.contact_urgence ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  function valider(): boolean {
    const next: Errors = {};
    if (!nom.trim()) next.nom = tv("nameRequired");
    if (!telephone.trim()) next.telephone = tv("required");
    else if (!telephoneValide(telephone.trim())) next.telephone = tv("invalidPhone");
    if (email.trim() !== "" && !emailValide(email.trim())) next.email = tv("invalidEmail");
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
        telephone: telephone.trim(),
        email: email.trim() || null,
        piece_type: pieceType || null,
        piece_numero: pieceNumero.trim() || null,
        adresse_precedente: adressePrecedente.trim() || null,
        contact_urgence: contactUrgence.trim() || null,
        notes: notes.trim() || null,
      });
    } catch (err) {
      setErrors({ form: messageErreur(t as unknown as (k: string) => string, err) });
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Field id="nom" label={tf("fullName")} value={nom} onChange={setNom} error={errors.nom} required autoComplete="name" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="telephone" label={tf("phone")} type="tel" value={telephone} onChange={setTelephone} error={errors.telephone} required autoComplete="tel" placeholder="+257 79 12 34 56" />
        <Field id="email" label={tf("email")} type="email" value={email} onChange={setEmail} error={errors.email} autoComplete="email" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="piece-type" label={tf("idType")} value={pieceType} onChange={setPieceType}>
          <option value="">—</option>
          <option value="cni">{tf("idTypeCni")}</option>
          <option value="passeport">{tf("idTypePassport")}</option>
          <option value="permis">{tf("idTypePermit")}</option>
          <option value="autre">{tf("idTypeOther")}</option>
        </Field>
        <Field id="piece-numero" label={tf("idNumber")} value={pieceNumero} onChange={setPieceNumero} />
      </div>
      <Field id="adresse-precedente" label={tf("previousAddress")} value={adressePrecedente} onChange={setAdressePrecedente} />
      <Field id="contact-urgence" label={tf("emergencyContact")} type="tel" value={contactUrgence} onChange={setContactUrgence} />
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

"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Field from "@/components/Field";
import MoneyField from "@/components/MoneyField";
import DocumentUpload from "@/components/DocumentUpload";
import { formatMoney } from "@/lib/format";
import type {
  Appartement,
  BailInput,
  CautionStatut,
  Devise,
  Immeuble,
  Locataire,
} from "@/lib/data";
import { messageErreur } from "@/lib/translateError";

type Errors = Partial<Record<string, string>> & { form?: string };

/**
 * Formulaire bail (spec §8) : appartement, locataire, dates, loyer + devise,
 * caution (suivie séparément, jamais dans les revenus ni le ROI),
 * jour d'exigibilité 1–28, charges incluses, document signé.
 * Règles : fin postérieure au début, aucun chevauchement avec un bail actif
 * du même appartement (vérifié aussi côté fournisseur), écart de loyer signalé.
 */
export default function BailForm({
  appartements,
  immeubles,
  locataires,
  preselectedAppartementId,
  preselectedLocataireId,
  onSubmit,
  submitLabel,
}: {
  appartements: Appartement[];
  immeubles: Immeuble[];
  locataires: Locataire[];
  preselectedAppartementId?: string;
  preselectedLocataireId?: string;
  onSubmit: (input: BailInput, fichierBail?: File | null) => Promise<void>;
  submitLabel: string;
}) {
  const t = useTranslations("crud");
  const tf = useTranslations("crud.leases.fields");
  const tv = useTranslations("crud.validation");
  const tc = useTranslations("crud.common");
  const locale = useLocale();

  const [appartementId, setAppartementId] = useState(preselectedAppartementId ?? "");
  const [locataireId, setLocataireId] = useState(preselectedLocataireId ?? "");
  const [debut, setDebut] = useState("");
  const [fin, setFin] = useState("");
  const [loyer, setLoyer] = useState("");
  const [devise, setDevise] = useState<Devise>("USD");
  const [caution, setCaution] = useState("");
  const [deviseCaution, setDeviseCaution] = useState<Devise>("USD");
  const [cautionRecueLe, setCautionRecueLe] = useState("");
  const [cautionStatut, setCautionStatut] = useState<CautionStatut>("en_attente");
  const [jourExigibilite, setJourExigibilite] = useState("1");
  const [chargesIncluses, setChargesIncluses] = useState(false);
  const [docUrl, setDocUrl] = useState("");
  const [fichierBail, setFichierBail] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const appartement = appartements.find((a) => a.id === appartementId);
  const nomImmeuble = (id: string) => immeubles.find((i) => i.id === id)?.nom ?? "";
  const loyerDiffere =
    appartement && loyer.trim() !== "" && Number(loyer) > 0 && Number(loyer) !== appartement.loyer_defaut;

  function valider(): boolean {
    const next: Errors = {};
    if (!appartementId) next.appartement = tv("chooseApartment");
    if (!locataireId) next.locataire = tv("chooseTenant");
    if (!debut) next.debut = tv("required");
    if (fin && debut && fin <= debut) next.fin = tv("endAfterStart");
    if (loyer.trim() === "" || !(Number(loyer) > 0)) next.loyer = tv("positiveStrict");
    const jour = Number(jourExigibilite);
    if (!Number.isInteger(jour) || jour < 1 || jour > 28) next.jour = tv("dueDayRange");
    if (caution.trim() !== "" && !(Number(caution) >= 0)) next.caution = tv("positive");
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
          appartement_id: appartementId,
          locataire_id: locataireId,
          debut,
          fin: fin || null,
          loyer_mensuel: Number(loyer),
          devise,
          caution: caution.trim() === "" ? null : Number(caution),
          devise_caution: caution.trim() === "" ? null : deviseCaution,
          caution_recue_le: cautionRecueLe || null,
          caution_statut: cautionStatut,
          jour_exigibilite: Number(jourExigibilite),
          charges_incluses: chargesIncluses,
          doc_url: docUrl.trim() || null,
        },
        fichierBail
      );
    } catch (err) {
      setErrors({ form: messageErreur(t as unknown as (k: string) => string, err) });
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Field
        id="appartement"
        label={tf("apartment")}
        value={appartementId}
        onChange={setAppartementId}
        error={errors.appartement}
        required
      >
        <option value="">{tv("chooseApartment")}</option>
        {appartements.map((a) => (
          <option key={a.id} value={a.id}>
            {a.numero} — {nomImmeuble(a.immeuble_id)} ({formatMoney(a.loyer_defaut, a.devise, locale)})
          </option>
        ))}
      </Field>
      <Field
        id="locataire"
        label={tf("tenant")}
        value={locataireId}
        onChange={setLocataireId}
        error={errors.locataire}
        required
      >
        <option value="">{tv("chooseTenant")}</option>
        {locataires.map((l) => (
          <option key={l.id} value={l.id}>
            {l.nom} — {l.telephone}
          </option>
        ))}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="debut" label={tf("start")} type="date" value={debut} onChange={setDebut} error={errors.debut} required />
        <Field id="fin" label={tf("end")} type="date" value={fin} onChange={setFin} error={errors.fin} />
      </div>
      <MoneyField
        id="loyer"
        label={tf("monthlyRent")}
        amount={loyer}
        onAmountChange={setLoyer}
        currency={devise}
        onCurrencyChange={setDevise}
        error={errors.loyer}
        required
      />
      {loyerDiffere && appartement ? (
        <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          {t("leases.rentDiffWarning", {
            rent: formatMoney(Number(loyer), devise, locale),
            defaultRent: formatMoney(appartement.loyer_defaut, appartement.devise, locale),
          })}
        </p>
      ) : null}
      <MoneyField
        id="caution"
        label={tf("deposit")}
        amount={caution}
        onAmountChange={setCaution}
        currency={deviseCaution}
        onCurrencyChange={setDeviseCaution}
        error={errors.caution}
      />
      <p className="text-sm text-slate-600">{t("leases.depositNote")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="caution-recue" label={tf("depositReceivedOn")} type="date" value={cautionRecueLe} onChange={setCautionRecueLe} />
        <Field id="caution-statut" label={tf("depositStatus")} value={cautionStatut} onChange={(v) => setCautionStatut(v as CautionStatut)}>
          <option value="en_attente">{tf("depositStatusPending")}</option>
          <option value="recue">{tf("depositStatusReceived")}</option>
          <option value="restituee">{tf("depositStatusReturned")}</option>
          <option value="retenue_partielle">{tf("depositStatusPartial")}</option>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="jour" label={tf("dueDay")} type="number" value={jourExigibilite} onChange={setJourExigibilite} error={errors.jour} required />
        <Field id="doc" label={tf("document")} value={docUrl} onChange={setDocUrl} placeholder="https://" />
      </div>
      {/* Bail signé : téléversement (PDF/JPG/PNG, 10 Mo max) — lié au bail
          créé, dans le stockage privé ; le champ lien reste possible. */}
      <DocumentUpload fichier={fichierBail} onFichierChange={setFichierBail} label={tf("signedDocument")} />
      <label className="flex items-center gap-2 text-base text-slate-900">
        <input
          type="checkbox"
          checked={chargesIncluses}
          onChange={(e) => setChargesIncluses(e.target.checked)}
          className="h-5 w-5 accent-[#1B2A4A]"
        />
        {tf("chargesIncluded")}
      </label>
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

"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DepenseForm;
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const Field_1 = __importDefault(require("@/components/Field"));
const MoneyField_1 = __importDefault(require("@/components/MoneyField"));
const DocumentUpload_1 = __importDefault(require("@/components/DocumentUpload"));
const data_1 = require("@/lib/data");
const translateError_1 = require("@/lib/translateError");
/**
 * Formulaire dépense (spec §8) : date, immeuble, appartement (optionnel),
 * catégorie OBLIGATOIRE (pour un ROI fiable), libellé, montant strictement
 * positif + devise, fournisseur, justificatif (PDF/JPG/PNG, 10 Mo max).
 * Le justificatif est rendu avec la saisie ; la page le téléverse après
 * la création de la dépense (il est lié à la dépense créée).
 */
function DepenseForm({ immeubles, appartements, depense, onSubmit, submitLabel, }) {
    const t = (0, next_intl_1.useTranslations)("crud");
    const tf = (0, next_intl_1.useTranslations)("crud.expenses.fields");
    const tv = (0, next_intl_1.useTranslations)("crud.validation");
    const tc = (0, next_intl_1.useTranslations)("crud.common");
    const td = (0, next_intl_1.useTranslations)("documents");
    const [date, setDate] = (0, react_1.useState)(depense?.date ?? new Date().toISOString().slice(0, 10));
    const [immeubleId, setImmeubleId] = (0, react_1.useState)(depense?.immeuble_id ?? "");
    const [appartementId, setAppartementId] = (0, react_1.useState)(depense?.appartement_id ?? "");
    const [categorie, setCategorie] = (0, react_1.useState)(depense?.categorie ?? "");
    const [libelle, setLibelle] = (0, react_1.useState)(depense?.libelle ?? "");
    const [montant, setMontant] = (0, react_1.useState)(depense ? String(depense.montant) : "");
    const [devise, setDevise] = (0, react_1.useState)(depense?.devise ?? "USD");
    const [fournisseur, setFournisseur] = (0, react_1.useState)(depense?.fournisseur ?? "");
    const [justificatif, setJustificatif] = (0, react_1.useState)(null);
    const [errors, setErrors] = (0, react_1.useState)({});
    const [saving, setSaving] = (0, react_1.useState)(false);
    const aptsImmeuble = appartements.filter((a) => !immeubleId || a.immeuble_id === immeubleId);
    function valider() {
        const next = {};
        if (!date)
            next.date = tv("required");
        if (!immeubleId)
            next.immeuble = tv("required");
        if (!categorie)
            next.categorie = tv("required");
        if (!libelle.trim())
            next.libelle = tv("required");
        if (montant.trim() === "" || !(Number(montant) > 0))
            next.montant = tv("positiveStrict");
        setErrors(next);
        return Object.keys(next).length === 0;
    }
    async function handleSubmit(e) {
        e.preventDefault();
        if (!valider())
            return;
        setSaving(true);
        setErrors({});
        try {
            await onSubmit({
                immeuble_id: immeubleId,
                appartement_id: appartementId || null,
                date,
                categorie: categorie,
                libelle: libelle.trim(),
                montant: Number(montant),
                devise,
                fournisseur: fournisseur.trim() || null,
            }, justificatif);
        }
        catch (err) {
            setErrors({ form: (0, translateError_1.messageErreur)(t, err) });
            setSaving(false);
        }
    }
    return (<form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field_1.default id="dep-date" label={tf("date")} type="date" value={date} onChange={setDate} error={errors.date} required/>
        <Field_1.default id="dep-immeuble" label={tf("building")} value={immeubleId} onChange={(v) => { setImmeubleId(v); setAppartementId(""); }} error={errors.immeuble} required>
          <option value="">{tv("chooseBuilding")}</option>
          {immeubles.map((i) => (<option key={i.id} value={i.id}>{i.nom}</option>))}
        </Field_1.default>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field_1.default id="dep-appartement" label={tf("apartment")} value={appartementId} onChange={setAppartementId}>
          <option value="">{tv("optional")}</option>
          {aptsImmeuble.map((a) => (<option key={a.id} value={a.id}>{a.numero}</option>))}
        </Field_1.default>
        <Field_1.default id="dep-categorie" label={tf("category")} value={categorie} onChange={setCategorie} error={errors.categorie} required>
          <option value="">{tv("chooseCategory")}</option>
          {data_1.CATEGORIES_DEPENSES.map((c) => (<option key={c} value={c}>{t(`expenses.categories.${c}`)}</option>))}
        </Field_1.default>
      </div>
      <Field_1.default id="dep-libelle" label={tf("label")} value={libelle} onChange={setLibelle} error={errors.libelle} required/>
      <MoneyField_1.default id="dep-montant" label={tf("amount")} amount={montant} onAmountChange={setMontant} currency={devise} onCurrencyChange={setDevise} error={errors.montant} required/>
      <Field_1.default id="dep-fournisseur" label={tf("supplier")} value={fournisseur} onChange={setFournisseur}/>
      <DocumentUpload_1.default fichier={justificatif} onFichierChange={setJustificatif} label={td("uploadLabel")}/>
      {depense?.justificatif_url ? (<p className="text-sm text-slate-600">{t("expenses.existingReceipt")}</p>) : null}
      {errors.form ? (<p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{errors.form}</p>) : null}
      <button type="submit" disabled={saving} className="w-full rounded-full bg-gold px-6 py-3 text-base font-bold text-navy hover:bg-gold-light disabled:opacity-50 sm:w-auto">
        {saving ? tc("saving") : submitLabel}
      </button>
    </form>);
}

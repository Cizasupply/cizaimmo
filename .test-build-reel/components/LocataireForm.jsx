"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LocataireForm;
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const Field_1 = __importDefault(require("@/components/Field"));
const helpers_1 = require("@/lib/data/helpers");
const translateError_1 = require("@/lib/translateError");
/**
 * Formulaire locataire (spec §8) : nom complet, téléphone international
 * (10 à 15 chiffres), e-mail valide si renseigné, pièce d'identité.
 */
function LocataireForm({ initial, onSubmit, submitLabel, }) {
    const t = (0, next_intl_1.useTranslations)("crud");
    const tf = (0, next_intl_1.useTranslations)("crud.tenants.fields");
    const tv = (0, next_intl_1.useTranslations)("crud.validation");
    const tc = (0, next_intl_1.useTranslations)("crud.common");
    const [nom, setNom] = (0, react_1.useState)(initial?.nom ?? "");
    const [telephone, setTelephone] = (0, react_1.useState)(initial?.telephone ?? "");
    const [email, setEmail] = (0, react_1.useState)(initial?.email ?? "");
    const [pieceType, setPieceType] = (0, react_1.useState)(initial?.piece_type ?? "");
    const [pieceNumero, setPieceNumero] = (0, react_1.useState)(initial?.piece_numero ?? "");
    const [adressePrecedente, setAdressePrecedente] = (0, react_1.useState)(initial?.adresse_precedente ?? "");
    const [contactUrgence, setContactUrgence] = (0, react_1.useState)(initial?.contact_urgence ?? "");
    const [notes, setNotes] = (0, react_1.useState)(initial?.notes ?? "");
    const [errors, setErrors] = (0, react_1.useState)({});
    const [saving, setSaving] = (0, react_1.useState)(false);
    function valider() {
        const next = {};
        if (!nom.trim())
            next.nom = tv("nameRequired");
        if (!telephone.trim())
            next.telephone = tv("required");
        else if (!(0, helpers_1.telephoneValide)(telephone.trim()))
            next.telephone = tv("invalidPhone");
        if (email.trim() !== "" && !(0, helpers_1.emailValide)(email.trim()))
            next.email = tv("invalidEmail");
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
                nom: nom.trim(),
                telephone: telephone.trim(),
                email: email.trim() || null,
                piece_type: pieceType || null,
                piece_numero: pieceNumero.trim() || null,
                adresse_precedente: adressePrecedente.trim() || null,
                contact_urgence: contactUrgence.trim() || null,
                notes: notes.trim() || null,
            });
        }
        catch (err) {
            setErrors({ form: (0, translateError_1.messageErreur)(t, err) });
            setSaving(false);
        }
    }
    return (<form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Field_1.default id="nom" label={tf("fullName")} value={nom} onChange={setNom} error={errors.nom} required autoComplete="name"/>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field_1.default id="telephone" label={tf("phone")} type="tel" value={telephone} onChange={setTelephone} error={errors.telephone} required autoComplete="tel" placeholder="+257 79 12 34 56"/>
        <Field_1.default id="email" label={tf("email")} type="email" value={email} onChange={setEmail} error={errors.email} autoComplete="email"/>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field_1.default id="piece-type" label={tf("idType")} value={pieceType} onChange={setPieceType}>
          <option value="">—</option>
          <option value="cni">{tf("idTypeCni")}</option>
          <option value="passeport">{tf("idTypePassport")}</option>
          <option value="permis">{tf("idTypePermit")}</option>
          <option value="autre">{tf("idTypeOther")}</option>
        </Field_1.default>
        <Field_1.default id="piece-numero" label={tf("idNumber")} value={pieceNumero} onChange={setPieceNumero}/>
      </div>
      <Field_1.default id="adresse-precedente" label={tf("previousAddress")} value={adressePrecedente} onChange={setAdressePrecedente}/>
      <Field_1.default id="contact-urgence" label={tf("emergencyContact")} type="tel" value={contactUrgence} onChange={setContactUrgence}/>
      <div>
        <label htmlFor="notes" className="block text-sm font-semibold text-slate-900">{tf("notes")}</label>
        <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"/>
      </div>
      {errors.form ? (<p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{errors.form}</p>) : null}
      <button type="submit" disabled={saving} className="w-full rounded-full bg-gold px-6 py-3 text-base font-bold text-navy hover:bg-gold-light disabled:opacity-50 sm:w-auto">
        {saving ? tc("saving") : submitLabel}
      </button>
    </form>);
}

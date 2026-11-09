"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = BailForm;
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const Field_1 = __importDefault(require("@/components/Field"));
const MoneyField_1 = __importDefault(require("@/components/MoneyField"));
const DocumentUpload_1 = __importDefault(require("@/components/DocumentUpload"));
const format_1 = require("@/lib/format");
const translateError_1 = require("@/lib/translateError");
/**
 * Formulaire bail (spec §8) : appartement, locataire, dates, loyer + devise,
 * caution (suivie séparément, jamais dans les revenus ni le ROI),
 * jour d'exigibilité 1–28, charges incluses, document signé.
 * Règles : fin postérieure au début, aucun chevauchement avec un bail actif
 * du même appartement (vérifié aussi côté fournisseur), écart de loyer signalé.
 */
function BailForm({ appartements, immeubles, locataires, preselectedAppartementId, preselectedLocataireId, onSubmit, submitLabel, }) {
    const t = (0, next_intl_1.useTranslations)("crud");
    const tf = (0, next_intl_1.useTranslations)("crud.leases.fields");
    const tv = (0, next_intl_1.useTranslations)("crud.validation");
    const tc = (0, next_intl_1.useTranslations)("crud.common");
    const locale = (0, next_intl_1.useLocale)();
    const [appartementId, setAppartementId] = (0, react_1.useState)(preselectedAppartementId ?? "");
    const [locataireId, setLocataireId] = (0, react_1.useState)(preselectedLocataireId ?? "");
    const [debut, setDebut] = (0, react_1.useState)("");
    const [fin, setFin] = (0, react_1.useState)("");
    const [loyer, setLoyer] = (0, react_1.useState)("");
    const [devise, setDevise] = (0, react_1.useState)("USD");
    const [caution, setCaution] = (0, react_1.useState)("");
    const [deviseCaution, setDeviseCaution] = (0, react_1.useState)("USD");
    const [cautionRecueLe, setCautionRecueLe] = (0, react_1.useState)("");
    const [cautionStatut, setCautionStatut] = (0, react_1.useState)("en_attente");
    const [jourExigibilite, setJourExigibilite] = (0, react_1.useState)("1");
    const [chargesIncluses, setChargesIncluses] = (0, react_1.useState)(false);
    const [docUrl, setDocUrl] = (0, react_1.useState)("");
    const [fichierBail, setFichierBail] = (0, react_1.useState)(null);
    const [errors, setErrors] = (0, react_1.useState)({});
    const [saving, setSaving] = (0, react_1.useState)(false);
    const appartement = appartements.find((a) => a.id === appartementId);
    const nomImmeuble = (id) => immeubles.find((i) => i.id === id)?.nom ?? "";
    const loyerDiffere = appartement && loyer.trim() !== "" && Number(loyer) > 0 && Number(loyer) !== appartement.loyer_defaut;
    function valider() {
        const next = {};
        if (!appartementId)
            next.appartement = tv("chooseApartment");
        if (!locataireId)
            next.locataire = tv("chooseTenant");
        if (!debut)
            next.debut = tv("required");
        if (fin && debut && fin <= debut)
            next.fin = tv("endAfterStart");
        if (loyer.trim() === "" || !(Number(loyer) > 0))
            next.loyer = tv("positiveStrict");
        const jour = Number(jourExigibilite);
        if (!Number.isInteger(jour) || jour < 1 || jour > 28)
            next.jour = tv("dueDayRange");
        if (caution.trim() !== "" && !(Number(caution) >= 0))
            next.caution = tv("positive");
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
            }, fichierBail);
        }
        catch (err) {
            setErrors({ form: (0, translateError_1.messageErreur)(t, err) });
            setSaving(false);
        }
    }
    return (<form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Field_1.default id="appartement" label={tf("apartment")} value={appartementId} onChange={setAppartementId} error={errors.appartement} required>
        <option value="">{tv("chooseApartment")}</option>
        {appartements.map((a) => (<option key={a.id} value={a.id}>
            {a.numero} — {nomImmeuble(a.immeuble_id)} ({(0, format_1.formatMoney)(a.loyer_defaut, a.devise, locale)})
          </option>))}
      </Field_1.default>
      <Field_1.default id="locataire" label={tf("tenant")} value={locataireId} onChange={setLocataireId} error={errors.locataire} required>
        <option value="">{tv("chooseTenant")}</option>
        {locataires.map((l) => (<option key={l.id} value={l.id}>
            {l.nom} — {l.telephone}
          </option>))}
      </Field_1.default>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field_1.default id="debut" label={tf("start")} type="date" value={debut} onChange={setDebut} error={errors.debut} required/>
        <Field_1.default id="fin" label={tf("end")} type="date" value={fin} onChange={setFin} error={errors.fin}/>
      </div>
      <MoneyField_1.default id="loyer" label={tf("monthlyRent")} amount={loyer} onAmountChange={setLoyer} currency={devise} onCurrencyChange={setDevise} error={errors.loyer} required/>
      {loyerDiffere && appartement ? (<p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          {t("leases.rentDiffWarning", {
                rent: (0, format_1.formatMoney)(Number(loyer), devise, locale),
                defaultRent: (0, format_1.formatMoney)(appartement.loyer_defaut, appartement.devise, locale),
            })}
        </p>) : null}
      <MoneyField_1.default id="caution" label={tf("deposit")} amount={caution} onAmountChange={setCaution} currency={deviseCaution} onCurrencyChange={setDeviseCaution} error={errors.caution}/>
      <p className="text-sm text-slate-600">{t("leases.depositNote")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field_1.default id="caution-recue" label={tf("depositReceivedOn")} type="date" value={cautionRecueLe} onChange={setCautionRecueLe}/>
        <Field_1.default id="caution-statut" label={tf("depositStatus")} value={cautionStatut} onChange={(v) => setCautionStatut(v)}>
          <option value="en_attente">{tf("depositStatusPending")}</option>
          <option value="recue">{tf("depositStatusReceived")}</option>
          <option value="restituee">{tf("depositStatusReturned")}</option>
          <option value="retenue_partielle">{tf("depositStatusPartial")}</option>
        </Field_1.default>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field_1.default id="jour" label={tf("dueDay")} type="number" value={jourExigibilite} onChange={setJourExigibilite} error={errors.jour} required/>
        <Field_1.default id="doc" label={tf("document")} value={docUrl} onChange={setDocUrl} placeholder="https://"/>
      </div>
      {/* Bail signé : téléversement (PDF/JPG/PNG, 10 Mo max) — lié au bail
            créé, dans le stockage privé ; le champ lien reste possible. */}
      <DocumentUpload_1.default fichier={fichierBail} onFichierChange={setFichierBail} label={tf("signedDocument")}/>
      <label className="flex items-center gap-2 text-base text-slate-900">
        <input type="checkbox" checked={chargesIncluses} onChange={(e) => setChargesIncluses(e.target.checked)} className="h-5 w-5 accent-[#1B2A4A]"/>
        {tf("chargesIncluded")}
      </label>
      {errors.form ? (<p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{errors.form}</p>) : null}
      <button type="submit" disabled={saving} className="w-full rounded-full bg-gold px-6 py-3 text-base font-bold text-navy hover:bg-gold-light disabled:opacity-50 sm:w-auto">
        {saving ? tc("saving") : submitLabel}
      </button>
    </form>);
}

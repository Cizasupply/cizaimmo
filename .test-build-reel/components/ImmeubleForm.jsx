"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ImmeubleForm;
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const Field_1 = __importDefault(require("@/components/Field"));
const MoneyField_1 = __importDefault(require("@/components/MoneyField"));
const data_1 = require("@/lib/data");
const countries_1 = require("@/lib/countries");
const translateError_1 = require("@/lib/translateError");
const DocumentUpload_1 = __importDefault(require("@/components/DocumentUpload"));
/** Aperçu local d'un fichier photo stagé (création), URL révoquée au retrait. */
function ApercuFichier({ fichier }) {
    const [url, setUrl] = (0, react_1.useState)("");
    (0, react_1.useEffect)(() => {
        const u = URL.createObjectURL(fichier);
        setUrl(u);
        return () => URL.revokeObjectURL(u);
    }, [fichier]);
    return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className="h-20 w-24 rounded-lg object-cover"/>) : (<div className="h-20 w-24 rounded-lg bg-slate-100"/>);
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
function ImmeubleForm({ initial, onSubmit, submitLabel, fichierPreuve, onFichierPreuveChange, modeGestionnaire = false, photosUrls = [], fichiersPhotos = [], onFichiersPhotosChange, onAjouterPhotos, onRetirerPhotoExistante, fichierAutorisation, onFichierAutorisationChange, autorisationExistante = false, }) {
    const t = (0, next_intl_1.useTranslations)("crud");
    const tf = (0, next_intl_1.useTranslations)("crud.buildings.fields");
    const tv = (0, next_intl_1.useTranslations)("crud.validation");
    const tc = (0, next_intl_1.useTranslations)("crud.common");
    const td = (0, next_intl_1.useTranslations)("dossier");
    const t16 = (0, next_intl_1.useTranslations)("v16");
    const t17 = (0, next_intl_1.useTranslations)("v17");
    const [nom, setNom] = (0, react_1.useState)(initial?.nom ?? "");
    const [adresse, setAdresse] = (0, react_1.useState)(initial?.adresse ?? "");
    const [quartier, setQuartier] = (0, react_1.useState)(initial?.quartier ?? "");
    const [ville, setVille] = (0, react_1.useState)(initial?.ville ?? "");
    const [pays, setPays] = (0, react_1.useState)(initial?.pays ?? "");
    const [devise, setDevise] = (0, react_1.useState)(initial?.devise ?? "USD");
    const [type, setType] = (0, react_1.useState)(initial?.type ?? "immeuble");
    const [etages, setEtages] = (0, react_1.useState)(initial?.etages != null ? String(initial.etages) : "");
    const [notes, setNotes] = (0, react_1.useState)(initial?.notes ?? "");
    // v1.7 : propriétaire déclaré (créateur gestionnaire).
    const [declareNom, setDeclareNom] = (0, react_1.useState)(initial?.proprietaire_declare_nom ?? "");
    const [declareEmail, setDeclareEmail] = (0, react_1.useState)(initial?.proprietaire_declare_email ?? "");
    const [erreurPhoto, setErreurPhoto] = (0, react_1.useState)(null);
    const inputPhotosRef = (0, react_1.useRef)(null);
    const [valeur, setValeur] = (0, react_1.useState)(initial?.valeur_bien != null ? String(initial.valeur_bien) : "");
    const [deviseValeur, setDeviseValeur] = (0, react_1.useState)(initial?.devise_valeur ?? initial?.devise ?? "USD");
    const [dateAcquisition, setDateAcquisition] = (0, react_1.useState)(initial?.date_acquisition ?? "");
    const [prixAcquisition, setPrixAcquisition] = (0, react_1.useState)(initial?.prix_acquisition != null ? String(initial.prix_acquisition) : "");
    const [dateEstimation, setDateEstimation] = (0, react_1.useState)(initial?.date_estimation ?? "");
    const [modeAcquisition, setModeAcquisition] = (0, react_1.useState)(initial?.mode_acquisition ?? "");
    const [errors, setErrors] = (0, react_1.useState)({});
    const [saving, setSaving] = (0, react_1.useState)(false);
    function valider() {
        const next = {};
        if (!nom.trim())
            next.nom = tv("nameRequired");
        if (!adresse.trim())
            next.adresse = tv("addressRequired");
        if (!ville.trim())
            next.ville = tv("cityRequired");
        if (!pays)
            next.pays = tv("countryRequired");
        if (valeur.trim() !== "" && !(Number(valeur) > 0))
            next.valeur = tv("positiveStrict");
        if (prixAcquisition.trim() !== "" && !(Number(prixAcquisition) >= 0)) {
            next.prixAcquisition = tv("positive");
        }
        if (etages.trim() !== "" && !(Number(etages) >= 0))
            next.etages = tv("positive");
        // v1.7 : au moins une photo du bien (existante ou stagée).
        if (photosUrls.length + fichiersPhotos.length === 0) {
            next.photos = t17("photoRequired");
        }
        // v1.7 : créateur gestionnaire — propriétaire déclaré + autorisation.
        if (modeGestionnaire) {
            if (!declareNom.trim())
                next.declareNom = t17("ownerNameRequired");
            if (!declareEmail.trim())
                next.declareEmail = t17("ownerEmailRequired");
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
    function choisirPhotos(liste) {
        if (!liste || liste.length === 0)
            return;
        const valides = [];
        for (const f of Array.from(liste)) {
            const extension = f.name.split(".").pop()?.toLowerCase() ?? "";
            if (!["jpg", "jpeg", "png"].includes(extension) || f.size > data_1.TAILLE_MAX_DOCUMENT_OCTETS) {
                setErreurPhoto(t17("photosFormatHint"));
                continue;
            }
            valides.push(f);
        }
        if (valides.length === 0)
            return;
        setErreurPhoto(null);
        if (onAjouterPhotos)
            onAjouterPhotos(valides);
        else if (onFichiersPhotosChange)
            onFichiersPhotosChange([...fichiersPhotos, ...valides]);
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
        }
        catch (err) {
            setErrors({ form: (0, translateError_1.messageErreur)(t, err) });
            setSaving(false);
        }
    }
    return (<form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Field_1.default id="nom" label={tf("name")} value={nom} onChange={setNom} error={errors.nom} required/>
      <Field_1.default id="adresse" label={tf("address")} value={adresse} onChange={setAdresse} error={errors.adresse} required/>
      <Field_1.default id="quartier" label={t16("district")} value={quartier} onChange={setQuartier}/>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field_1.default id="ville" label={tf("city")} value={ville} onChange={setVille} error={errors.ville} required/>
        <Field_1.default id="pays" label={tf("country")} value={pays} onChange={setPays} error={errors.pays} required>
          <option value="">{tv("countryRequired")}</option>
          {countries_1.PAYS.map((p) => (<option key={p} value={p}>{p}</option>))}
        </Field_1.default>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field_1.default id="devise" label={tf("currency")} value={devise} onChange={(v) => setDevise(v)} required>
          {data_1.DEVISES.map((d) => (<option key={d} value={d}>{d}</option>))}
        </Field_1.default>
        <Field_1.default id="type" label={tf("type")} value={type} onChange={(v) => setType(v)}>
          <option value="immeuble">{tf("typeImmeuble")}</option>
          <option value="bloc">{tf("typeBloc")}</option>
          <option value="maison">{tf("typeMaison")}</option>
        </Field_1.default>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field_1.default id="etages" label={tf("floors")} type="number" value={etages} onChange={setEtages} error={errors.etages}/>
      </div>
      {/* v1.7 : photos du bien — la première est la photo du passeport. */}
      <div className="rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-900">{t17("photosTitle")}</p>
        <p className="mt-1 text-sm text-slate-600">{t17("photosHint")}</p>
        <p className="mt-1 text-sm text-slate-500">{t17("photosFormatHint")}</p>
        {(photosUrls.length > 0 || fichiersPhotos.length > 0) ? (<ul className="mt-3 flex flex-wrap gap-3">
            {photosUrls.map((url, idx) => (<li key={`existante-${idx}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-20 w-24 rounded-lg object-cover"/>
                {idx === 0 && fichiersPhotos.length === 0 ? (<span className="absolute left-1 top-1 rounded-full bg-navy px-2 py-0.5 text-[11px] font-bold text-white">
                    {t17("photoMain")}
                  </span>) : null}
                {onRetirerPhotoExistante ? (<button type="button" onClick={() => onRetirerPhotoExistante(idx)} className="absolute bottom-1 right-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-red-700 shadow">
                    {t17("photoRemove")}
                  </button>) : null}
              </li>))}
            {fichiersPhotos.map((f, idx) => (<li key={`stagee-${idx}`} className="relative">
                <ApercuFichier fichier={f}/>
                {idx === 0 && photosUrls.length === 0 ? (<span className="absolute left-1 top-1 rounded-full bg-navy px-2 py-0.5 text-[11px] font-bold text-white">
                    {t17("photoMain")}
                  </span>) : null}
                {onFichiersPhotosChange ? (<button type="button" onClick={() => onFichiersPhotosChange(fichiersPhotos.filter((_, j) => j !== idx))} className="absolute bottom-1 right-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-red-700 shadow">
                    {t17("photoRemove")}
                  </button>) : null}
              </li>))}
          </ul>) : null}
        <button type="button" onClick={() => inputPhotosRef.current?.click()} className="mt-3 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy hover:border-gold">
          {t17("photoAdd")}
        </button>
        <input ref={inputPhotosRef} type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" multiple className="hidden" onChange={(e) => {
            choisirPhotos(e.target.files);
            e.target.value = "";
        }}/>
        {erreurPhoto ? (<p role="alert" className="mt-2 text-sm font-medium text-red-600">{erreurPhoto}</p>) : null}
        {errors.photos ? (<p role="alert" className="mt-2 text-sm font-medium text-red-600">{errors.photos}</p>) : null}
      </div>
      <MoneyField_1.default id="valeur" label={tf("value")} amount={valeur} onAmountChange={setValeur} currency={deviseValeur} onCurrencyChange={setDeviseValeur} error={errors.valeur}/>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field_1.default id="date-acquisition" label={tf("acquisitionDate")} type="date" value={dateAcquisition} onChange={setDateAcquisition}/>
        <Field_1.default id="prix-acquisition" label={`${tf("acquisitionPrice")} (${deviseValeur})`} type="number" value={prixAcquisition} onChange={setPrixAcquisition} error={errors.prixAcquisition}/>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field_1.default id="date-estimation" label={tf("estimationDate")} type="date" value={dateEstimation} onChange={setDateEstimation}/>
        <Field_1.default id="mode-acquisition" label={tf("acquisitionMode")} value={modeAcquisition} onChange={setModeAcquisition}>
          <option value="">{tc("notProvided")}</option>
          <option value="achat">{t("passport.modeAchat")}</option>
          <option value="heritage">{t("passport.modeHeritage")}</option>
          <option value="donation">{t("passport.modeDonation")}</option>
          <option value="autre">{t("passport.modeAutre")}</option>
        </Field_1.default>
      </div>
      <div>
        <label htmlFor="notes" className="block text-sm font-semibold text-slate-900">{tf("notes")}</label>
        <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"/>
      </div>
      {modeGestionnaire ? (<div className="rounded-xl border border-gold/60 bg-amber-50/50 p-4">
          <p className="text-sm font-bold text-navy">{t17("managerTitle")}</p>
          <p className="mt-1 text-sm text-slate-600">{t17("managerHint")}</p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field_1.default id="declare-nom" label={t17("ownerName")} value={declareNom} onChange={setDeclareNom} error={errors.declareNom} required/>
            <Field_1.default id="declare-email" label={t17("ownerEmail")} type="email" value={declareEmail} onChange={setDeclareEmail} error={errors.declareEmail} required/>
          </div>
          {onFichierAutorisationChange ? (<div className="mt-3">
              <DocumentUpload_1.default fichier={fichierAutorisation ?? null} onFichierChange={onFichierAutorisationChange} label={t17("autorisationLabel")}/>
              <p className="mt-1 text-sm text-slate-600">
                {autorisationExistante ? t17("autorisationOnFile") : t17("autorisationHint")}
              </p>
              {errors.autorisation ? (<p role="alert" className="mt-2 text-sm font-medium text-red-600">{errors.autorisation}</p>) : null}
            </div>) : null}
        </div>) : onFichierPreuveChange ? (<div className="rounded-xl border border-slate-200 p-4">
          <DocumentUpload_1.default fichier={fichierPreuve ?? null} onFichierChange={onFichierPreuveChange} label={td("ownershipProofLabel")}/>
          <p className="mt-1 text-sm text-slate-600">{td("ownershipProofHint")}</p>
        </div>) : null}
      {errors.form ? (<p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{errors.form}</p>) : null}
      <button type="submit" disabled={saving} className="w-full rounded-full bg-gold px-6 py-3 text-base font-bold text-navy hover:bg-gold-light disabled:opacity-50 sm:w-auto">
        {saving ? tc("saving") : submitLabel}
      </button>
    </form>);
}

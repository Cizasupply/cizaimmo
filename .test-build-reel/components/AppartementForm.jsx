"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AppartementForm;
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const Field_1 = __importDefault(require("@/components/Field"));
const MoneyField_1 = __importDefault(require("@/components/MoneyField"));
const data_1 = require("@/lib/data");
const translateError_1 = require("@/lib/translateError");
function nouvelleLigne() {
    return { numero: "", type: "T1", loyer: "", surface: "" };
}
/**
 * Formulaire appartement (spec §8) : un par un OU en lot (depuis la fiche
 * immeuble). Numéro unique dans l'immeuble, loyer strictement positif.
 */
const JOURS_VISITE = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
function normaliserTelephone(v) {
    return (v ?? "").replace(/[^0-9+]/g, "");
}
function normaliserEmail(v) {
    return (v ?? "").trim().toLowerCase();
}
function AppartementForm({ immeubles, preselectedImmeubleId, initial, mode, onSubmitSingle, onSubmitBulk, submitLabel, contactDossier, }) {
    const t = (0, next_intl_1.useTranslations)("crud");
    const tf = (0, next_intl_1.useTranslations)("crud.apartments.fields");
    const tv = (0, next_intl_1.useTranslations)("crud.validation");
    const tc = (0, next_intl_1.useTranslations)("crud.common");
    const t16 = (0, next_intl_1.useTranslations)("v16");
    const [immeubleId, setImmeubleId] = (0, react_1.useState)(preselectedImmeubleId ?? initial?.immeuble_id ?? immeubles[0]?.id ?? "");
    const [numero, setNumero] = (0, react_1.useState)(initial?.numero ?? "");
    const [type, setType] = (0, react_1.useState)(initial?.type ?? "T1");
    const [surface, setSurface] = (0, react_1.useState)(initial?.surface_m2 != null ? String(initial.surface_m2) : "");
    const [loyer, setLoyer] = (0, react_1.useState)(initial ? String(initial.loyer_defaut) : "");
    const [devise, setDevise] = (0, react_1.useState)(initial?.devise ?? "USD");
    const [charges, setCharges] = (0, react_1.useState)(initial ? String(initial.charges) : "0");
    const [etage, setEtage] = (0, react_1.useState)(initial?.etage != null ? String(initial.etage) : "");
    const [description, setDescription] = (0, react_1.useState)(initial?.description ?? "");
    const [photos, setPhotos] = (0, react_1.useState)((initial?.photos ?? []).join(", "));
    const [statut, setStatut] = (0, react_1.useState)(initial?.statut ?? "vacant");
    const [vitrine, setVitrine] = (0, react_1.useState)(initial?.vitrine ?? false);
    const [valeur, setValeur] = (0, react_1.useState)(initial?.valeur_bien != null ? String(initial.valeur_bien) : "");
    const [deviseValeur, setDeviseValeur] = (0, react_1.useState)(initial?.devise_valeur ?? initial?.devise ?? "USD");
    // --- v1.6 « Vitrine vérifiée » : champs d'annonce publique.
    const [pieces, setPieces] = (0, react_1.useState)(initial?.pieces != null ? String(initial.pieces) : "");
    const [meuble, setMeuble] = (0, react_1.useState)(initial?.meuble ?? false);
    const [disponibleLe, setDisponibleLe] = (0, react_1.useState)(initial?.disponible_le ?? "");
    const [visiteJours, setVisiteJours] = (0, react_1.useState)(initial?.visite_jours ?? []);
    const [visiteHeures, setVisiteHeures] = (0, react_1.useState)(initial?.visite_heures ?? "");
    const [contactNom, setContactNom] = (0, react_1.useState)(initial?.contact_nom ?? "");
    // Pré-remplissage depuis le dossier (v1.6) : sans contact d'annonce
    // déjà saisi, les champs partent du contact attendu — l'utilisateur
    // ne saisit un autre contact que délibérément (justification alors
    // demandée).
    const [contactTelephone, setContactTelephone] = (0, react_1.useState)(initial?.contact_telephone ?? contactDossier?.telephone ?? "");
    const [contactEmail, setContactEmail] = (0, react_1.useState)(initial?.contact_email ?? contactDossier?.email ?? "");
    const [contactJustification, setContactJustification] = (0, react_1.useState)(initial?.contact_justification ?? "");
    // Divergence jugée champ par champ : seulement si le contact
    // ANNONCÉ est renseigné ET que le contact du dossier est connu
    // (le téléphone d'un gestionnaire invité peut être inconnu côté
    // client — la base comparera les deux champs à la demande).
    const contactDivergent = contactDossier != null &&
        ((contactTelephone.trim() !== "" &&
            (contactDossier.telephone ?? "").trim() !== "" &&
            normaliserTelephone(contactTelephone) !== normaliserTelephone(contactDossier.telephone)) ||
            (contactEmail.trim() !== "" &&
                (contactDossier.email ?? "").trim() !== "" &&
                normaliserEmail(contactEmail) !== normaliserEmail(contactDossier.email)));
    const nombrePhotos = photos.split(",").map((p) => p.trim()).filter(Boolean).length;
    const [lignes, setLignes] = (0, react_1.useState)([nouvelleLigne(), nouvelleLigne(), nouvelleLigne()]);
    const [errors, setErrors] = (0, react_1.useState)({});
    const [saving, setSaving] = (0, react_1.useState)(false);
    function parsePhotos() {
        return photos.split(",").map((p) => p.trim()).filter(Boolean);
    }
    function validerSingle() {
        const next = {};
        if (!immeubleId)
            next.immeuble = tv("chooseBuilding");
        if (!numero.trim())
            next.numero = tv("numberRequired");
        if (loyer.trim() === "" || !(Number(loyer) > 0))
            next.loyer = tv("positiveStrict");
        if (surface.trim() !== "" && !(Number(surface) > 0))
            next.surface = tv("positiveStrict");
        if (charges.trim() !== "" && !(Number(charges) >= 0))
            next.charges = tv("positive");
        if (valeur.trim() !== "" && !(Number(valeur) > 0))
            next.valeur = tv("positiveStrict");
        if (pieces.trim() !== "" && !(Number(pieces) > 0))
            next.pieces = tv("positiveStrict");
        if (nombrePhotos > 10)
            next.photos = t16("photosTooMany");
        if (contactDivergent && !contactJustification.trim()) {
            next.justification = t16("justificationRequired");
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    }
    function validerBulk() {
        const next = {};
        if (!immeubleId)
            next.immeuble = tv("chooseBuilding");
        const vus = new Set();
        lignes.forEach((ligne, i) => {
            const cle = ligne.numero.trim().toLowerCase();
            if (!ligne.numero.trim())
                next[`ligne${i}`] = tv("numberRequired");
            else if (vus.has(cle))
                next[`ligne${i}`] = tv("duplicateNumber");
            else
                vus.add(cle);
            if (ligne.loyer.trim() === "" || !(Number(ligne.loyer) > 0)) {
                next[`ligne${i}`] = next[`ligne${i}`] ?? tv("positiveStrict");
            }
        });
        if (lignes.length === 0)
            next.form = tv("selectAtLeastOne");
        setErrors(next);
        return Object.keys(next).length === 0;
    }
    async function handleSubmit(e) {
        e.preventDefault();
        if (mode === "bulk") {
            if (!validerBulk() || !onSubmitBulk)
                return;
            setSaving(true);
            setErrors({});
            try {
                await onSubmitBulk(immeubleId, lignes.map((ligne) => ({
                    numero: ligne.numero.trim(),
                    type: ligne.type,
                    surface_m2: ligne.surface.trim() === "" ? null : Number(ligne.surface),
                    loyer_defaut: Number(ligne.loyer),
                    devise,
                    charges: 0,
                    etage: null,
                    description: null,
                    photos: [],
                    statut: "vacant",
                    vitrine: false,
                    valeur_bien: null,
                    devise_valeur: null,
                })));
            }
            catch (err) {
                setErrors({ form: (0, translateError_1.messageErreur)(t, err) });
                setSaving(false);
            }
            return;
        }
        if (!validerSingle() || !onSubmitSingle)
            return;
        setSaving(true);
        setErrors({});
        try {
            await onSubmitSingle({
                immeuble_id: immeubleId,
                numero: numero.trim(),
                type,
                surface_m2: surface.trim() === "" ? null : Number(surface),
                loyer_defaut: Number(loyer),
                devise,
                charges: charges.trim() === "" ? 0 : Number(charges),
                etage: etage.trim() === "" ? null : Number(etage),
                description: description.trim() || null,
                photos: parsePhotos(),
                statut,
                vitrine,
                valeur_bien: valeur.trim() === "" ? null : Number(valeur),
                devise_valeur: valeur.trim() === "" ? null : deviseValeur,
                pieces: pieces.trim() === "" ? null : Number(pieces),
                meuble,
                disponible_le: disponibleLe || null,
                visite_jours: visiteJours,
                visite_heures: visiteHeures.trim() || null,
                contact_nom: contactNom.trim() || null,
                contact_telephone: contactTelephone.trim() || null,
                contact_email: contactEmail.trim() || null,
                contact_justification: contactJustification.trim() || null,
            });
        }
        catch (err) {
            setErrors({ form: (0, translateError_1.messageErreur)(t, err) });
            setSaving(false);
        }
    }
    function setLigne(i, patch) {
        setLignes((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    }
    return (<form onSubmit={handleSubmit} noValidate className="space-y-4">
      <Field_1.default id="immeuble" label={tf("building")} value={immeubleId} onChange={setImmeubleId} error={errors.immeuble} required>
        <option value="">{tv("chooseBuilding")}</option>
        {immeubles.map((im) => (<option key={im.id} value={im.id}>
            {im.nom} — {im.ville}
          </option>))}
      </Field_1.default>

      {mode === "bulk" ? (<>
          <p className="text-sm text-slate-600">{t("apartments.bulkHint")}</p>
          <div className="space-y-3">
            {lignes.map((ligne, i) => (<div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field_1.default id={`lot-numero-${i}`} label={tf("number")} value={ligne.numero} onChange={(v) => setLigne(i, { numero: v })} error={errors[`ligne${i}`]} required/>
                  <Field_1.default id={`lot-type-${i}`} label={tf("type")} value={ligne.type} onChange={(v) => setLigne(i, { type: v })}>
                    {data_1.TYPES_APPARTEMENT.map((ty) => (<option key={ty} value={ty}>{ty}</option>))}
                  </Field_1.default>
                  <Field_1.default id={`lot-loyer-${i}`} label={tf("defaultRent")} type="number" value={ligne.loyer} onChange={(v) => setLigne(i, { loyer: v })} required/>
                  <Field_1.default id={`lot-surface-${i}`} label={tf("surface")} type="number" value={ligne.surface} onChange={(v) => setLigne(i, { surface: v })}/>
                </div>
                {lignes.length > 1 ? (<button type="button" onClick={() => setLignes((prev) => prev.filter((_, idx) => idx !== i))} className="mt-2 text-sm font-semibold text-red-600 underline">
                    {t("apartments.bulkRemoveRow")}
                  </button>) : null}
              </div>))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setLignes((prev) => [...prev, nouvelleLigne()])} className="rounded-full border border-navy px-4 py-2 text-sm font-bold text-navy hover:bg-navy hover:text-white">
              {t("apartments.bulkAddRow")}
            </button>
            <Field_1.default id="devise-lot" label={tf("defaultRent") + " — devise"} value={devise} onChange={(v) => setDevise(v)}>
              {data_1.DEVISES.map((d) => (<option key={d} value={d}>{d}</option>))}
            </Field_1.default>
          </div>
        </>) : (<>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field_1.default id="numero" label={tf("number")} value={numero} onChange={setNumero} error={errors.numero} required/>
            <Field_1.default id="type" label={tf("type")} value={type} onChange={(v) => setType(v)} required>
              {data_1.TYPES_APPARTEMENT.map((ty) => (<option key={ty} value={ty}>{ty}</option>))}
            </Field_1.default>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field_1.default id="surface" label={tf("surface")} type="number" value={surface} onChange={setSurface} error={errors.surface}/>
            <Field_1.default id="etage" label={tf("floor")} type="number" value={etage} onChange={setEtage}/>
          </div>
          <MoneyField_1.default id="loyer" label={tf("defaultRent")} amount={loyer} onAmountChange={setLoyer} currency={devise} onCurrencyChange={setDevise} error={errors.loyer} required/>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field_1.default id="charges" label={tf("charges")} type="number" value={charges} onChange={setCharges} error={errors.charges}/>
            <Field_1.default id="statut" label={tf("status")} value={statut} onChange={(v) => setStatut(v)} required>
              <option value="vacant">{t("apartments.statusVacant")}</option>
              <option value="occupe">{t("apartments.statusOccupied")}</option>
              <option value="travaux">{t("apartments.statusWorks")}</option>
              <option value="reserve">{t("apartments.statusReserved")}</option>
            </Field_1.default>
          </div>
          <MoneyField_1.default id="valeur" label={tf("value")} amount={valeur} onAmountChange={setValeur} currency={deviseValeur} onCurrencyChange={setDeviseValeur} error={errors.valeur}/>
          <div>
            <Field_1.default id="photos" label={tf("photos")} value={photos} onChange={setPhotos} placeholder="https://…, https://…" error={errors.photos}/>
            <p className={`mt-1 text-sm ${nombrePhotos > 10 ? "font-bold text-red-600" : "text-slate-500"}`}>
              {t16("photosCounter", { count: String(nombrePhotos) })}
            </p>
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-semibold text-slate-900">{tf("description")}</label>
            <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"/>
          </div>
          <label className="flex items-center gap-2 text-base text-slate-900">
            <input type="checkbox" checked={vitrine} onChange={(e) => setVitrine(e.target.checked)} className="h-5 w-5 accent-[#1B2A4A]"/>
            {tf("vitrine")}
          </label>

          <fieldset className="space-y-4 rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-sm font-bold text-navy">{t16("listingSection")}</legend>
            <p className="text-sm text-slate-600">{t16("listingSectionHint")}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field_1.default id="pieces" label={t16("rooms")} type="number" value={pieces} onChange={setPieces} error={errors.pieces}/>
              <Field_1.default id="disponible-le" label={t16("availableOn")} type="date" value={disponibleLe} onChange={setDisponibleLe}/>
            </div>
            <label className="flex items-center gap-2 text-base text-slate-900">
              <input type="checkbox" checked={meuble} onChange={(e) => setMeuble(e.target.checked)} className="h-5 w-5 accent-[#1B2A4A]"/>
              {t16("furnished")}
            </label>
            <div>
              <p className="text-sm font-semibold text-slate-900">{t16("visitDays")}</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {JOURS_VISITE.map((jour) => (<label key={jour} className="flex items-center gap-1.5 text-sm text-slate-900">
                    <input type="checkbox" checked={visiteJours.includes(jour)} onChange={(e) => setVisiteJours((prev) => e.target.checked ? [...prev, jour] : prev.filter((j) => j !== jour))} className="h-4 w-4 accent-[#1B2A4A]"/>
                    {t16(`day_${jour}`)}
                  </label>))}
              </div>
            </div>
            <Field_1.default id="visite-heures" label={t16("visitHours")} value={visiteHeures} onChange={setVisiteHeures} placeholder={t16("visitHoursPlaceholder")}/>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field_1.default id="contact-nom" label={t16("contactName")} value={contactNom} onChange={setContactNom}/>
              <Field_1.default id="contact-telephone" label={t16("contactPhone")} value={contactTelephone} onChange={setContactTelephone}/>
            </div>
            <Field_1.default id="contact-email" label={t16("contactEmail")} type="email" value={contactEmail} onChange={setContactEmail}/>
            {contactDivergent ? (<div>
                <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{t16("justificationHint")}</p>
                <Field_1.default id="contact-justification" label={t16("justificationLabel")} value={contactJustification} onChange={setContactJustification} error={errors.justification} required/>
              </div>) : null}
          </fieldset>
        </>)}

      {errors.form ? (<p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{errors.form}</p>) : null}
      <button type="submit" disabled={saving} className="w-full rounded-full bg-gold px-6 py-3 text-base font-bold text-navy hover:bg-gold-light disabled:opacity-50 sm:w-auto">
        {saving ? tc("saving") : submitLabel}
      </button>
    </form>);
}

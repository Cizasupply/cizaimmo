"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = InscriptionPage;
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const navigation_1 = require("next/navigation");
const next_intl_1 = require("next-intl");
const AuthLayout_1 = __importDefault(require("@/components/AuthLayout"));
const Field_1 = __importDefault(require("@/components/Field"));
const data_1 = require("@/lib/data");
const countries_1 = require("@/lib/countries");
const real_1 = require("@/lib/data/real");
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
function InscriptionPage() {
    const t = (0, next_intl_1.useTranslations)("auth");
    const tc = (0, next_intl_1.useTranslations)("common");
    const locale = (0, next_intl_1.useLocale)();
    const router = (0, navigation_1.useRouter)();
    const [nom, setNom] = (0, react_1.useState)("");
    const [email, setEmail] = (0, react_1.useState)("");
    const [telephone, setTelephone] = (0, react_1.useState)("");
    // v1.3 : INTENTION déclarée (pas un rôle) — validée par l'Admin.
    const [intention, setIntention] = (0, react_1.useState)("proprietaire");
    const [motDePasse, setMotDePasse] = (0, react_1.useState)("");
    const [pays, setPays] = (0, react_1.useState)("");
    const [devise, setDevise] = (0, react_1.useState)("USD");
    const [langue, setLangue] = (0, react_1.useState)(locale === "en" ? "en" : "fr");
    const [accepte, setAccepte] = (0, react_1.useState)(false);
    const [errors, setErrors] = (0, react_1.useState)({});
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [confirmationRequise, setConfirmationRequise] = (0, react_1.useState)(false);
    // Anti-fraude tarifaire (v1.2) : code pays de l'IP détecté côté
    // serveur (x-vercel-ip-country) — seul le CODE transite, jamais l'IP.
    const [paysIp, setPaysIp] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        let actif = true;
        fetch("/api/inscription/contexte")
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
            if (actif && data && typeof data.pays_ip === "string") {
                setPaysIp(data.pays_ip);
            }
        })
            .catch(() => undefined);
        return () => {
            actif = false;
        };
    }, []);
    async function handleSubmit(e) {
        e.preventDefault();
        const next = {};
        if (!nom.trim())
            next.nom = t("nameRequired");
        if (!email.trim())
            next.email = t("emailRequired");
        else if (!isValidEmail(email.trim()))
            next.email = t("emailInvalid");
        if (!telephone.trim())
            next.telephone = t("phoneRequired");
        else if (telephone.replace(/\D/g, "").length < 8)
            next.telephone = t("phoneInvalid");
        if (!motDePasse)
            next.motDePasse = t("passwordRequired");
        else if (motDePasse.length < 8)
            next.motDePasse = t("passwordTooShort");
        if (!pays)
            next.pays = t("countryRequired");
        if (!accepte)
            next.conditions = t("acceptTermsRequired");
        setErrors(next);
        if (Object.keys(next).length > 0)
            return;
        setLoading(true);
        try {
            const { needsEmailConfirmation } = await (0, data_1.getDataProvider)().signUp({
                nom: nom.trim(),
                email: email.trim(),
                motDePasse,
                pays,
                devisePrincipale: devise,
                langue,
                paysIp,
                telephone: telephone.trim(),
                intention,
            });
            if (needsEmailConfirmation) {
                // E-mail confirmé → le compte passe en revue d'approbation
                // (ajout n°3) ; l'essai démarrera à l'approbation.
                setConfirmationRequise(true);
                setLoading(false);
            }
            else {
                router.push(`/${locale}/dashboard`);
                router.refresh();
            }
        }
        catch (err) {
            const key = err instanceof real_1.AuthError ? err.i18nKey : "genericError";
            setErrors({ form: t(key) });
            setLoading(false);
        }
    }
    if (confirmationRequise) {
        return (<AuthLayout_1.default title={t("confirmEmailTitle")} subtitle={t("confirmEmailText")}>
        <p className="text-base text-slate-700">{t("checkEmail")}</p>
        <link_1.default href={`/${locale}/connexion`} className="mt-6 block w-full rounded-full bg-navy px-6 py-3 text-center text-base font-bold text-white hover:bg-navy-light">
          {t("backToLogin")}
        </link_1.default>
      </AuthLayout_1.default>);
    }
    return (<AuthLayout_1.default title={t("signupTitle")} subtitle={t("signupSubtitle")}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field_1.default id="nom" label={t("name")} value={nom} onChange={setNom} error={errors.nom} required autoComplete="name"/>
        <Field_1.default id="email" label={t("email")} type="email" value={email} onChange={setEmail} error={errors.email} required autoComplete="email"/>
        <Field_1.default id="telephone" label={t("phone")} type="tel" value={telephone} onChange={setTelephone} error={errors.telephone} required autoComplete="tel"/>
        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">{t("intentionLabel")}</legend>
          <div className="mt-2 space-y-2">
            {[
            { valeur: "proprietaire", label: t("intentionOwner") },
            { valeur: "gestionnaire", label: t("intentionManager") },
        ].map((choix) => (<label key={choix.valeur} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-base text-slate-900 ${intention === choix.valeur
                ? "border-gold bg-gold/10 font-semibold"
                : "border-slate-300 bg-white"}`}>
                <input type="radio" name="intention" value={choix.valeur} checked={intention === choix.valeur} onChange={() => setIntention(choix.valeur)} className="h-5 w-5 shrink-0 accent-[#1B2A4A]"/>
                {choix.label}
              </label>))}
          </div>
          <p className="mt-1 text-sm text-slate-600">{t("intentionHint")}</p>
        </fieldset>
        <Field_1.default id="mot-de-passe" label={t("password")} type="password" value={motDePasse} onChange={setMotDePasse} error={errors.motDePasse} required autoComplete="new-password"/>
        <Field_1.default id="pays" label={t("country")} value={pays} onChange={setPays} error={errors.pays} required>
          <option value="">{t("countryPlaceholder")}</option>
          {countries_1.PAYS.map((p) => (<option key={p} value={p}>
              {p}
            </option>))}
        </Field_1.default>
        <Field_1.default id="devise" label={t("currency")} value={devise} onChange={(v) => setDevise(v)} required>
          {data_1.DEVISES.map((d) => (<option key={d} value={d}>
              {d}
            </option>))}
        </Field_1.default>
        <Field_1.default id="langue" label={t("language")} value={langue} onChange={(v) => setLangue(v)} required>
          <option value="fr">Français</option>
          <option value="en">English</option>
        </Field_1.default>

        <div>
          <label className="flex items-start gap-2 text-sm text-slate-900">
            <input type="checkbox" checked={accepte} onChange={(e) => setAccepte(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#1B2A4A]"/>
            <span>{t("acceptTerms")}</span>
          </label>
          {errors.conditions ? (<p role="alert" className="mt-1 text-sm font-medium text-red-600">
              {errors.conditions}
            </p>) : null}
        </div>

        {errors.form ? (<p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {errors.form}
          </p>) : null}

        {/* v1.4 : aucun choix de plan à l'inscription — l'essai est le
            pack Starter ; le client choisira son pack à la fin. */}
        <div className="rounded-xl border border-gold bg-gold/15 px-4 py-3">
          <p className="text-sm font-medium text-slate-800">{t("trialNote")}</p>
        </div>

        <button type="submit" disabled={loading} className="w-full rounded-full bg-navy px-6 py-3 text-base font-bold text-white hover:bg-navy-light disabled:opacity-50">
          {loading ? tc("loading") : t("signupButton")}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        {t("hasAccount")}{" "}
        <link_1.default href={`/${locale}/connexion`} className="font-semibold text-navy underline">
          {t("loginTitle")}
        </link_1.default>
      </p>
    </AuthLayout_1.default>);
}

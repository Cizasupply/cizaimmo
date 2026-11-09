"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ConnexionPage;
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const navigation_1 = require("next/navigation");
const next_intl_1 = require("next-intl");
const AuthLayout_1 = __importDefault(require("@/components/AuthLayout"));
const Field_1 = __importDefault(require("@/components/Field"));
const data_1 = require("@/lib/data");
const demo_seed_1 = require("@/lib/data/demo-seed");
const real_1 = require("@/lib/data/real");
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
function ConnexionPage() {
    const t = (0, next_intl_1.useTranslations)("auth");
    const tc = (0, next_intl_1.useTranslations)("common");
    const locale = (0, next_intl_1.useLocale)();
    const router = (0, navigation_1.useRouter)();
    const [email, setEmail] = (0, react_1.useState)("");
    const [motDePasse, setMotDePasse] = (0, react_1.useState)("");
    const [errors, setErrors] = (0, react_1.useState)({});
    const [loading, setLoading] = (0, react_1.useState)(false);
    const demo = (0, data_1.isDemoMode)();
    async function handleSubmit(e) {
        e.preventDefault();
        const next = {};
        if (!email.trim())
            next.email = t("emailRequired");
        else if (!isValidEmail(email.trim()))
            next.email = t("emailInvalid");
        if (!motDePasse)
            next.motDePasse = t("passwordRequired");
        setErrors(next);
        if (Object.keys(next).length > 0)
            return;
        setLoading(true);
        try {
            const provider = (0, data_1.getDataProvider)();
            await provider.signIn(email, motDePasse);
            // Connexion prioritaire (extension v1.2) : Admin / Super Admin
            // vers la console plateforme ; les autres vers le tableau de bord
            // (l'écran d'attente d'approbation s'affiche là si besoin).
            const profil = await provider.getProfil().catch(() => null);
            const destination = profil?.role === "admin" || profil?.role === "super_admin"
                ? `/${locale}/console`
                : `/${locale}/dashboard`;
            router.push(destination);
            router.refresh();
        }
        catch (err) {
            // Mode réel : AuthError porte la clé i18n. Mode démo : le code
            // d'erreur métier est traduit ici pour les blocages plateforme.
            let key = "genericError";
            if (err instanceof real_1.AuthError)
                key = err.i18nKey;
            else if (err instanceof Error && err.message === "ERR_COMPTE_SUSPENDU")
                key = "accountSuspended";
            else if (err instanceof Error && err.message === "ERR_COMPTE_REFUSE")
                key = "accountRefused";
            setErrors({ form: t(key) });
            setLoading(false);
        }
    }
    async function handleDemo(role) {
        setLoading(true);
        try {
            // Session démo : aucune donnée réelle, tout est étiqueté DÉMO.
            // Le gestionnaire se connecte avec l'e-mail de son invitation :
            // il ne voit que ses immeubles, jamais l'abonnement (spec §2).
            // Admin / Super Admin démo : direction la console plateforme.
            const emailDemo = role === "gestionnaire"
                ? demo_seed_1.GESTIONNAIRE_DEMO_EMAIL
                : role === "super_admin"
                    ? demo_seed_1.SUPER_ADMIN_DEMO_EMAIL
                    : role === "admin"
                        ? demo_seed_1.ADMIN_DEMO_EMAIL
                        : "demo@cizaimmo.com";
            await (0, data_1.getDataProvider)().signIn(emailDemo, "demo-demo");
            router.push(role === "super_admin" || role === "admin"
                ? `/${locale}/console`
                : `/${locale}/dashboard`);
            router.refresh();
        }
        finally {
            setLoading(false);
        }
    }
    return (<AuthLayout_1.default title={t("loginTitle")} subtitle={t("loginSubtitle")}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field_1.default id="email" label={t("email")} type="email" value={email} onChange={setEmail} error={errors.email} required autoComplete="email"/>
        <Field_1.default id="mot-de-passe" label={t("password")} type="password" value={motDePasse} onChange={setMotDePasse} error={errors.motDePasse} required autoComplete="current-password"/>
        {errors.form ? (<p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {errors.form}
          </p>) : null}
        <button type="submit" disabled={loading} className="w-full rounded-full bg-navy px-6 py-3 text-base font-bold text-white hover:bg-navy-light disabled:opacity-50">
          {loading ? tc("loading") : t("loginButton")}
        </button>
      </form>

      <div className="mt-4 text-center">
        <link_1.default href={`/${locale}/mot-de-passe-oublie`} className="text-sm font-semibold text-navy underline">
          {t("forgotLink")}
        </link_1.default>
      </div>

      {demo ? (<div className="mt-6 rounded-xl border border-gold/60 bg-gold/10 p-4">
          <p className="text-sm text-slate-700">{t("demoNote")}</p>
          <button type="button" onClick={() => handleDemo("proprietaire")} disabled={loading} className="mt-3 w-full rounded-full border-2 border-navy px-6 py-2.5 text-base font-bold text-navy hover:bg-navy hover:text-white disabled:opacity-50">
            {t("demoOwner")}
          </button>
          <button type="button" onClick={() => handleDemo("gestionnaire")} disabled={loading} className="mt-3 w-full rounded-full border-2 border-navy px-6 py-2.5 text-base font-bold text-navy hover:bg-navy hover:text-white disabled:opacity-50">
            {t("demoManager")}
          </button>
          <button type="button" onClick={() => handleDemo("super_admin")} disabled={loading} className="mt-3 w-full rounded-full border-2 border-gold bg-navy px-6 py-2.5 text-base font-bold text-white hover:bg-navy-light disabled:opacity-50">
            {t("demoSuperAdmin")}
          </button>
          <button type="button" onClick={() => handleDemo("admin")} disabled={loading} className="mt-3 w-full rounded-full border-2 border-gold bg-navy px-6 py-2.5 text-base font-bold text-white hover:bg-navy-light disabled:opacity-50">
            {t("demoAdmin")}
          </button>
        </div>) : null}

      <p className="mt-6 text-center text-sm text-slate-600">
        {t("noAccount")}{" "}
        <link_1.default href={`/${locale}/inscription`} className="font-semibold text-navy underline">
          {t("signupTitle")}
        </link_1.default>
      </p>
    </AuthLayout_1.default>);
}

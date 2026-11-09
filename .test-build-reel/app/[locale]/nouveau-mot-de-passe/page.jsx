"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = NouveauMotDePassePage;
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const next_intl_1 = require("next-intl");
const AuthLayout_1 = __importDefault(require("@/components/AuthLayout"));
const Field_1 = __importDefault(require("@/components/Field"));
const data_1 = require("@/lib/data");
const real_1 = require("@/lib/data/real");
/**
 * Page d'arrivée du lien de réinitialisation (e-mail Supabase).
 * Le callback /auth/callback a déjà échangé le code contre une session ;
 * ici l'utilisateur choisit simplement son nouveau mot de passe.
 * En mode démo, cette page accepte la saisie sans effet (pas d'e-mail réel).
 */
function NouveauMotDePassePage() {
    const t = (0, next_intl_1.useTranslations)("auth");
    const tc = (0, next_intl_1.useTranslations)("common");
    const locale = (0, next_intl_1.useLocale)();
    const [motDePasse, setMotDePasse] = (0, react_1.useState)("");
    const [errors, setErrors] = (0, react_1.useState)({});
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [fait, setFait] = (0, react_1.useState)(false);
    async function handleSubmit(e) {
        e.preventDefault();
        const next = {};
        if (!motDePasse)
            next.motDePasse = t("passwordRequired");
        else if (motDePasse.length < 8)
            next.motDePasse = t("passwordTooShort");
        setErrors(next);
        if (Object.keys(next).length > 0)
            return;
        setLoading(true);
        try {
            await (0, data_1.getDataProvider)().updatePassword(motDePasse);
            setFait(true);
        }
        catch (err) {
            const key = err instanceof real_1.AuthError ? err.i18nKey : "genericError";
            setErrors({ form: t(key) });
        }
        finally {
            setLoading(false);
        }
    }
    if (fait) {
        return (<AuthLayout_1.default title={t("resetTitle")} subtitle={t("passwordUpdated")}>
        <link_1.default href={`/${locale}/connexion`} className="mt-6 block w-full rounded-full bg-navy px-6 py-3 text-center text-base font-bold text-white hover:bg-navy-light">
          {t("loginButton")}
        </link_1.default>
      </AuthLayout_1.default>);
    }
    return (<AuthLayout_1.default title={t("resetTitle")} subtitle={t("resetSubtitle")}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field_1.default id="nouveau-mot-de-passe" label={t("newPassword")} type="password" value={motDePasse} onChange={setMotDePasse} error={errors.motDePasse} required autoComplete="new-password"/>
        {errors.form ? (<p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {errors.form}
          </p>) : null}
        <button type="submit" disabled={loading} className="w-full rounded-full bg-navy px-6 py-3 text-base font-bold text-white hover:bg-navy-light disabled:opacity-50">
          {loading ? tc("loading") : t("sendResetButton")}
        </button>
      </form>
    </AuthLayout_1.default>);
}

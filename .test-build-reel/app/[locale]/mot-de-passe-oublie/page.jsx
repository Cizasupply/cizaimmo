"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MotDePasseOubliePage;
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const next_intl_1 = require("next-intl");
const AuthLayout_1 = __importDefault(require("@/components/AuthLayout"));
const Field_1 = __importDefault(require("@/components/Field"));
const data_1 = require("@/lib/data");
const real_1 = require("@/lib/data/real");
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
function MotDePasseOubliePage() {
    const t = (0, next_intl_1.useTranslations)("auth");
    const tc = (0, next_intl_1.useTranslations)("common");
    const locale = (0, next_intl_1.useLocale)();
    const [email, setEmail] = (0, react_1.useState)("");
    const [errors, setErrors] = (0, react_1.useState)({});
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [envoye, setEnvoye] = (0, react_1.useState)(false);
    async function handleSubmit(e) {
        e.preventDefault();
        const next = {};
        if (!email.trim())
            next.email = t("emailRequired");
        else if (!isValidEmail(email.trim()))
            next.email = t("emailInvalid");
        setErrors(next);
        if (Object.keys(next).length > 0)
            return;
        setLoading(true);
        try {
            await (0, data_1.getDataProvider)().resetPassword(email);
            setEnvoye(true);
        }
        catch (err) {
            const key = err instanceof real_1.AuthError ? err.i18nKey : "genericError";
            setErrors({ form: t(key) });
        }
        finally {
            setLoading(false);
        }
    }
    if (envoye) {
        return (<AuthLayout_1.default title={t("resetSentTitle")} subtitle={t("resetSentText")}>
        <p className="text-base text-slate-700">{t("checkEmail")}</p>
        <link_1.default href={`/${locale}/connexion`} className="mt-6 block w-full rounded-full bg-navy px-6 py-3 text-center text-base font-bold text-white hover:bg-navy-light">
          {t("backToLogin")}
        </link_1.default>
      </AuthLayout_1.default>);
    }
    return (<AuthLayout_1.default title={t("forgotTitle")} subtitle={t("forgotSubtitle")}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field_1.default id="email" label={t("email")} type="email" value={email} onChange={setEmail} error={errors.email} required autoComplete="email"/>
        {errors.form ? (<p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {errors.form}
          </p>) : null}
        <button type="submit" disabled={loading} className="w-full rounded-full bg-navy px-6 py-3 text-base font-bold text-white hover:bg-navy-light disabled:opacity-50">
          {loading ? tc("loading") : t("resetButton")}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        <link_1.default href={`/${locale}/connexion`} className="font-semibold text-navy underline">
          {t("backToLogin")}
        </link_1.default>
      </p>
    </AuthLayout_1.default>);
}

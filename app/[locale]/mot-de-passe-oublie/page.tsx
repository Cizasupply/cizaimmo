"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import AuthLayout from "@/components/AuthLayout";
import Field from "@/components/Field";
import { getDataProvider } from "@/lib/data";
import { AuthError } from "@/lib/data/real";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export default function MotDePasseOubliePage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ email?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const [envoye, setEnvoye] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email.trim()) next.email = t("emailRequired");
    else if (!isValidEmail(email.trim())) next.email = t("emailInvalid");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await getDataProvider().resetPassword(email);
      setEnvoye(true);
    } catch (err) {
      const key = err instanceof AuthError ? err.i18nKey : "genericError";
      setErrors({ form: t(key as "genericError") });
    } finally {
      setLoading(false);
    }
  }

  if (envoye) {
    return (
      <AuthLayout title={t("resetSentTitle")} subtitle={t("resetSentText")}>
        <p className="text-base text-slate-700">{t("checkEmail")}</p>
        <Link
          href={`/${locale}/connexion`}
          className="mt-6 block w-full rounded-full bg-navy px-6 py-3 text-center text-base font-bold text-white hover:bg-navy-light"
        >
          {t("backToLogin")}
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("forgotTitle")} subtitle={t("forgotSubtitle")}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          id="email"
          label={t("email")}
          type="email"
          value={email}
          onChange={setEmail}
          error={errors.email}
          required
          autoComplete="email"
        />
        {errors.form ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {errors.form}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-navy px-6 py-3 text-base font-bold text-white hover:bg-navy-light disabled:opacity-50"
        >
          {loading ? tc("loading") : t("resetButton")}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        <Link href={`/${locale}/connexion`} className="font-semibold text-navy underline">
          {t("backToLogin")}
        </Link>
      </p>
    </AuthLayout>
  );
}

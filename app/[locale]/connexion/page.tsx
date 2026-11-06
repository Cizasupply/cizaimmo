"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import AuthLayout from "@/components/AuthLayout";
import Field from "@/components/Field";
import { getDataProvider, isDemoMode } from "@/lib/data";
import { AuthError } from "@/lib/data/real";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export default function ConnexionPage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [errors, setErrors] = useState<{ email?: string; motDePasse?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const demo = isDemoMode();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email.trim()) next.email = t("emailRequired");
    else if (!isValidEmail(email.trim())) next.email = t("emailInvalid");
    if (!motDePasse) next.motDePasse = t("passwordRequired");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await getDataProvider().signIn(email, motDePasse);
      router.push(`/${locale}/dashboard`);
      router.refresh();
    } catch (err) {
      const key =
        err instanceof AuthError ? err.i18nKey : "genericError";
      setErrors({ form: t(key as "genericError") });
      setLoading(false);
    }
  }

  async function handleDemo() {
    setLoading(true);
    try {
      // Session démo : aucune donnée réelle, tout est étiqueté DÉMO.
      await getDataProvider().signIn("demo@cizaimmo.com", "demo-demo");
      router.push(`/${locale}/dashboard`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title={t("loginTitle")} subtitle={t("loginSubtitle")}>
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
        <Field
          id="mot-de-passe"
          label={t("password")}
          type="password"
          value={motDePasse}
          onChange={setMotDePasse}
          error={errors.motDePasse}
          required
          autoComplete="current-password"
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
          {loading ? tc("loading") : t("loginButton")}
        </button>
      </form>

      <div className="mt-4 text-center">
        <Link href={`/${locale}/mot-de-passe-oublie`} className="text-sm font-semibold text-navy underline">
          {t("forgotLink")}
        </Link>
      </div>

      {demo ? (
        <div className="mt-6 rounded-xl border border-gold/60 bg-gold/10 p-4">
          <p className="text-sm text-slate-700">{t("demoNote")}</p>
          <button
            type="button"
            onClick={handleDemo}
            disabled={loading}
            className="mt-3 w-full rounded-full border-2 border-navy px-6 py-2.5 text-base font-bold text-navy hover:bg-navy hover:text-white disabled:opacity-50"
          >
            {t("demoButton")}
          </button>
        </div>
      ) : null}

      <p className="mt-6 text-center text-sm text-slate-600">
        {t("noAccount")}{" "}
        <Link href={`/${locale}/inscription`} className="font-semibold text-navy underline">
          {t("signupTitle")}
        </Link>
      </p>
    </AuthLayout>
  );
}

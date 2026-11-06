"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import AuthLayout from "@/components/AuthLayout";
import Field from "@/components/Field";
import { getDataProvider } from "@/lib/data";
import { AuthError } from "@/lib/data/real";

/**
 * Page d'arrivée du lien de réinitialisation (e-mail Supabase).
 * Le callback /auth/callback a déjà échangé le code contre une session ;
 * ici l'utilisateur choisit simplement son nouveau mot de passe.
 * En mode démo, cette page accepte la saisie sans effet (pas d'e-mail réel).
 */
export default function NouveauMotDePassePage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [motDePasse, setMotDePasse] = useState("");
  const [errors, setErrors] = useState<{ motDePasse?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const [fait, setFait] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!motDePasse) next.motDePasse = t("passwordRequired");
    else if (motDePasse.length < 8) next.motDePasse = t("passwordTooShort");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await getDataProvider().updatePassword(motDePasse);
      setFait(true);
    } catch (err) {
      const key = err instanceof AuthError ? err.i18nKey : "genericError";
      setErrors({ form: t(key as "genericError") });
    } finally {
      setLoading(false);
    }
  }

  if (fait) {
    return (
      <AuthLayout title={t("resetTitle")} subtitle={t("passwordUpdated")}>
        <Link
          href={`/${locale}/connexion`}
          className="mt-6 block w-full rounded-full bg-navy px-6 py-3 text-center text-base font-bold text-white hover:bg-navy-light"
        >
          {t("loginButton")}
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("resetTitle")} subtitle={t("resetSubtitle")}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          id="nouveau-mot-de-passe"
          label={t("newPassword")}
          type="password"
          value={motDePasse}
          onChange={setMotDePasse}
          error={errors.motDePasse}
          required
          autoComplete="new-password"
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
          {loading ? tc("loading") : t("sendResetButton")}
        </button>
      </form>
    </AuthLayout>
  );
}

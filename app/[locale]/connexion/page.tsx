"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import AuthLayout from "@/components/AuthLayout";
import Field from "@/components/Field";
import { getDataProvider, isDemoMode } from "@/lib/data";
import {
  ADMIN_DEMO_EMAIL,
  GESTIONNAIRE_DEMO_EMAIL,
  SUPER_ADMIN_DEMO_EMAIL,
} from "@/lib/data/demo-seed";
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
      const provider = getDataProvider();
      await provider.signIn(email, motDePasse);
      // Connexion prioritaire (extension v1.2) : Admin / Super Admin
      // vers la console plateforme ; les autres vers le tableau de bord
      // (l'écran d'attente d'approbation s'affiche là si besoin).
      const profil = await provider.getProfil().catch(() => null);
      const destination =
        profil?.role === "admin" || profil?.role === "super_admin"
          ? `/${locale}/console`
          : `/${locale}/dashboard`;
      router.push(destination);
      router.refresh();
    } catch (err) {
      // Mode réel : AuthError porte la clé i18n. Mode démo : le code
      // d'erreur métier est traduit ici pour les blocages plateforme.
      let key = "genericError";
      if (err instanceof AuthError) key = err.i18nKey;
      else if (err instanceof Error && err.message === "ERR_COMPTE_SUSPENDU") key = "accountSuspended";
      else if (err instanceof Error && err.message === "ERR_COMPTE_REFUSE") key = "accountRefused";
      setErrors({ form: t(key as "genericError") });
      setLoading(false);
    }
  }

  async function handleDemo(
    role: "proprietaire" | "gestionnaire" | "super_admin" | "admin"
  ) {
    setLoading(true);
    try {
      // Session démo : aucune donnée réelle, tout est étiqueté DÉMO.
      // Le gestionnaire se connecte avec l'e-mail de son invitation :
      // il ne voit que ses immeubles, jamais l'abonnement (spec §2).
      // Admin / Super Admin démo : direction la console plateforme.
      const emailDemo =
        role === "gestionnaire"
          ? GESTIONNAIRE_DEMO_EMAIL
          : role === "super_admin"
            ? SUPER_ADMIN_DEMO_EMAIL
            : role === "admin"
              ? ADMIN_DEMO_EMAIL
              : "demo@cizaimmo.com";
      await getDataProvider().signIn(emailDemo, "demo-demo");
      router.push(
        role === "super_admin" || role === "admin"
          ? `/${locale}/console`
          : `/${locale}/dashboard`
      );
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
            onClick={() => handleDemo("proprietaire")}
            disabled={loading}
            className="mt-3 w-full rounded-full border-2 border-navy px-6 py-2.5 text-base font-bold text-navy hover:bg-navy hover:text-white disabled:opacity-50"
          >
            {t("demoOwner")}
          </button>
          <button
            type="button"
            onClick={() => handleDemo("gestionnaire")}
            disabled={loading}
            className="mt-3 w-full rounded-full border-2 border-navy px-6 py-2.5 text-base font-bold text-navy hover:bg-navy hover:text-white disabled:opacity-50"
          >
            {t("demoManager")}
          </button>
          <button
            type="button"
            onClick={() => handleDemo("super_admin")}
            disabled={loading}
            className="mt-3 w-full rounded-full border-2 border-gold bg-navy px-6 py-2.5 text-base font-bold text-white hover:bg-navy-light disabled:opacity-50"
          >
            {t("demoSuperAdmin")}
          </button>
          <button
            type="button"
            onClick={() => handleDemo("admin")}
            disabled={loading}
            className="mt-3 w-full rounded-full border-2 border-gold bg-navy px-6 py-2.5 text-base font-bold text-white hover:bg-navy-light disabled:opacity-50"
          >
            {t("demoAdmin")}
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

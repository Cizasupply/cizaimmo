"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import AuthLayout from "@/components/AuthLayout";
import Field from "@/components/Field";
import { DEVISES, getDataProvider } from "@/lib/data";
import type { Devise, Langue, TypeIntention } from "@/lib/data";
import { PAYS } from "@/lib/countries";
import { AuthError } from "@/lib/data/real";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export default function InscriptionPage() {
  const t = useTranslations("auth");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  // v1.3 : INTENTION déclarée (pas un rôle) — validée par l'Admin.
  const [intention, setIntention] = useState<TypeIntention>("proprietaire");
  const [motDePasse, setMotDePasse] = useState("");
  const [pays, setPays] = useState("");
  const [devise, setDevise] = useState<Devise>("USD");
  const [langue, setLangue] = useState<Langue>(locale === "en" ? "en" : "fr");
  const [accepte, setAccepte] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [confirmationRequise, setConfirmationRequise] = useState(false);
  // Anti-fraude tarifaire (v1.2) : code pays de l'IP détecté côté
  // serveur (x-vercel-ip-country) — seul le CODE transite, jamais l'IP.
  const [paysIp, setPaysIp] = useState<string | null>(null);

  useEffect(() => {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!nom.trim()) next.nom = t("nameRequired");
    if (!email.trim()) next.email = t("emailRequired");
    else if (!isValidEmail(email.trim())) next.email = t("emailInvalid");
    if (!telephone.trim()) next.telephone = t("phoneRequired");
    else if (telephone.replace(/\D/g, "").length < 8) next.telephone = t("phoneInvalid");
    if (!motDePasse) next.motDePasse = t("passwordRequired");
    else if (motDePasse.length < 8) next.motDePasse = t("passwordTooShort");
    if (!pays) next.pays = t("countryRequired");
    if (!accepte) next.conditions = t("acceptTermsRequired");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      const { needsEmailConfirmation } = await getDataProvider().signUp({
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
      } else {
        router.push(`/${locale}/dashboard`);
        router.refresh();
      }
    } catch (err) {
      const key = err instanceof AuthError ? err.i18nKey : "genericError";
      setErrors({ form: t(key as "genericError") });
      setLoading(false);
    }
  }

  if (confirmationRequise) {
    return (
      <AuthLayout title={t("confirmEmailTitle")} subtitle={t("confirmEmailText")}>
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
    <AuthLayout title={t("signupTitle")} subtitle={t("signupSubtitle")}>
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field id="nom" label={t("name")} value={nom} onChange={setNom} error={errors.nom} required autoComplete="name" />
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
          id="telephone"
          label={t("phone")}
          type="tel"
          value={telephone}
          onChange={setTelephone}
          error={errors.telephone}
          required
          autoComplete="tel"
        />
        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">{t("intentionLabel")}</legend>
          <div className="mt-2 space-y-2">
            {(
              [
                { valeur: "proprietaire", label: t("intentionOwner") },
                { valeur: "gestionnaire", label: t("intentionManager") },
              ] as { valeur: TypeIntention; label: string }[]
            ).map((choix) => (
              <label
                key={choix.valeur}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-base text-slate-900 ${
                  intention === choix.valeur
                    ? "border-gold bg-gold/10 font-semibold"
                    : "border-slate-300 bg-white"
                }`}
              >
                <input
                  type="radio"
                  name="intention"
                  value={choix.valeur}
                  checked={intention === choix.valeur}
                  onChange={() => setIntention(choix.valeur)}
                  className="h-5 w-5 shrink-0 accent-[#1B2A4A]"
                />
                {choix.label}
              </label>
            ))}
          </div>
          <p className="mt-1 text-sm text-slate-600">{t("intentionHint")}</p>
        </fieldset>
        <Field
          id="mot-de-passe"
          label={t("password")}
          type="password"
          value={motDePasse}
          onChange={setMotDePasse}
          error={errors.motDePasse}
          required
          autoComplete="new-password"
        />
        <Field id="pays" label={t("country")} value={pays} onChange={setPays} error={errors.pays} required>
          <option value="">{t("countryPlaceholder")}</option>
          {PAYS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Field>
        <Field id="devise" label={t("currency")} value={devise} onChange={(v) => setDevise(v as Devise)} required>
          {DEVISES.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Field>
        <Field id="langue" label={t("language")} value={langue} onChange={(v) => setLangue(v as Langue)} required>
          <option value="fr">Français</option>
          <option value="en">English</option>
        </Field>

        <div>
          <label className="flex items-start gap-2 text-sm text-slate-900">
            <input
              type="checkbox"
              checked={accepte}
              onChange={(e) => setAccepte(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-[#1B2A4A]"
            />
            <span>{t("acceptTerms")}</span>
          </label>
          {errors.conditions ? (
            <p role="alert" className="mt-1 text-sm font-medium text-red-600">
              {errors.conditions}
            </p>
          ) : null}
        </div>

        {errors.form ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {errors.form}
          </p>
        ) : null}

        {/* v1.4 : aucun choix de plan à l'inscription — l'essai est le
            pack Starter ; le client choisira son pack à la fin. */}
        <div className="rounded-xl border border-gold bg-gold/15 px-4 py-3">
          <p className="text-sm font-medium text-slate-800">{t("trialNote")}</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-navy px-6 py-3 text-base font-bold text-white hover:bg-navy-light disabled:opacity-50"
        >
          {loading ? tc("loading") : t("signupButton")}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        {t("hasAccount")}{" "}
        <Link href={`/${locale}/connexion`} className="font-semibold text-navy underline">
          {t("loginTitle")}
        </Link>
      </p>
    </AuthLayout>
  );
}

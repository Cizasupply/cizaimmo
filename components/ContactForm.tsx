"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import Field from "@/components/Field";

/**
 * Formulaire Contact / Démo (client). Voir app/[locale]/contact/page.tsx
 * pour le contrat d'envoi (Web3Forms, sinon bascule honnête vers mailto).
 */
const WEB3FORMS_URL = "https://api.web3forms.com/submit";
const CONTACT_EMAIL = "infos@cizagroup.com";
const WHATSAPP_URL =
  "https://wa.me/15145029503?text=" +
  encodeURIComponent("Bonjour CizaImmo, je souhaite une démonstration.");

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^@]{2,}$/.test(email);
}

export default function ContactForm() {
  const t = useTranslations("contact");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [nbBiens, setNbBiens] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [echec, setEchec] = useState(false);

  const cleWeb3Forms = process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? "";
  const envoiDirectDisponible = cleWeb3Forms.trim().length > 0;

  function mailtoHref(): string {
    const sujet = `CizaImmo — ${t("demoTitle")} — ${nom.trim()}`;
    const corps = [
      `${t("name")} : ${nom.trim()}`,
      `${t("email")} : ${email.trim()}`,
      `${t("phone")} : ${telephone.trim() || "—"}`,
      `${t("propertiesCount")} : ${nbBiens.trim()}`,
      "",
      message.trim(),
    ].join("\n");
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEchec(false);
    const next: Record<string, string> = {};
    if (!nom.trim()) next.nom = t("nameRequired");
    if (!email.trim()) next.email = t("emailRequired");
    else if (!isValidEmail(email.trim())) next.email = t("emailInvalid");
    if (!nbBiens.trim() || Number(nbBiens) < 0 || !Number.isFinite(Number(nbBiens)))
      next.nbBiens = t("propertiesRequired");
    if (!message.trim()) next.message = t("messageRequired");
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    if (!envoiDirectDisponible) {
      // Pas de clé Web3Forms : on ne prétend pas envoyer. L'utilisateur
      // ouvre son application e-mail avec le message déjà rédigé.
      window.location.href = mailtoHref();
      return;
    }

    setEnvoi(true);
    try {
      const reponse = await fetch(WEB3FORMS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: cleWeb3Forms,
          subject: `CizaImmo — Demande de démonstration — ${nom.trim()}`,
          from_name: "CizaImmo — Contact",
          reply_to: email.trim(),
          nom: nom.trim(),
          email: email.trim(),
          telephone: telephone.trim(),
          nombre_biens: nbBiens.trim(),
          message: message.trim(),
        }),
      });
      const resultat = (await reponse.json().catch(() => null)) as { success?: boolean } | null;
      if (reponse.ok && resultat?.success) {
        setEnvoye(true);
      } else {
        setEchec(true);
      }
    } catch {
      setEchec(true);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-5">
          <section className="rounded-2xl bg-white p-6 shadow-sm sm:p-8 lg:col-span-3">
            <h2 className="text-xl font-bold text-navy">{t("demoTitle")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("demoText")}</p>

            {envoye ? (
              <div role="status" className="mt-6 rounded-2xl border border-green-600/40 bg-green-50 p-6">
                <p className="text-lg font-bold text-green-800">{t("sentTitle")}</p>
                <p className="mt-2 text-base text-green-900">{t("sentText")}</p>
                <Link
                  href={`/${locale}`}
                  className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white"
                >
                  {tc("backToHome")}
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
                <Field id="nom" label={t("name")} value={nom} onChange={setNom} error={errors.nom} required autoComplete="name" />
                <Field id="email" label={t("email")} type="email" value={email} onChange={setEmail} error={errors.email} required autoComplete="email" />
                <Field id="telephone" label={t("phone")} type="tel" value={telephone} onChange={setTelephone} autoComplete="tel" />
                <div>
                  <Field
                    id="nbBiens"
                    label={t("propertiesCount")}
                    type="number"
                    value={nbBiens}
                    onChange={setNbBiens}
                    error={errors.nbBiens}
                    required
                  />
                  <p className="mt-1 text-xs text-slate-500">{t("propertiesCountHint")}</p>
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-semibold text-slate-900">
                    {t("message")} <span aria-hidden="true">*</span>
                  </label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    placeholder={t("messagePlaceholder")}
                    aria-invalid={Boolean(errors.message)}
                    aria-describedby={errors.message ? "message-error" : undefined}
                    className={`mt-1 w-full rounded-lg border bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/40 ${errors.message ? "border-red-500" : "border-slate-300"}`}
                  />
                  {errors.message ? (
                    <p id="message-error" role="alert" className="mt-1 text-sm font-medium text-red-600">
                      {errors.message}
                    </p>
                  ) : null}
                </div>

                {!envoiDirectDisponible ? (
                  <p role="note" className="rounded-xl border border-gold/50 bg-amber-50 px-4 py-3 text-sm font-semibold text-navy">
                    {t("mailtoTitle")} — {t("mailtoText")}
                  </p>
                ) : null}

                {echec ? (
                  <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    {t("sendFailed")}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={envoi}
                  className="flex min-h-11 w-full items-center justify-center rounded-full bg-navy px-6 py-3 text-base font-bold text-white hover:bg-navy-light disabled:opacity-60"
                >
                  {envoi ? t("sending") : envoiDirectDisponible ? t("send") : t("mailtoButton")}
                </button>
                <p className="text-xs text-slate-500">{t("noDataNote")}</p>
              </form>
            )}
          </section>

          <aside className="space-y-4 lg:col-span-2">
            <section className="rounded-2xl bg-navy-dark p-6 text-white shadow-sm">
              <h2 className="text-lg font-bold text-gold">{t("whatsappTitle")}</h2>
              <p className="mt-2 text-base text-slate-200">{t("whatsappText")}</p>
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy-dark hover:bg-gold-light"
              >
                {t("whatsappButton")}
              </a>
            </section>
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-navy">{t("emailTitle")}</h2>
              <a href={`mailto:${CONTACT_EMAIL}`} className="mt-2 inline-block text-base font-semibold text-navy underline">
                {t("emailText")}
              </a>
            </section>
          </aside>
    </div>
  );
}

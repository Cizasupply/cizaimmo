import { getTranslations, setRequestLocale } from "next-intl/server";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import ContactForm from "@/components/ContactForm";

/**
 * Page publique Contact / Démo (Module 7, spec §4) : nom, e-mail,
 * téléphone / WhatsApp, nombre de biens, message, demande de
 * démonstration, lien WhatsApp. Aucune donnée de parc n'est demandée.
 *
 * Envoi : Web3Forms via la variable d'environnement publique
 * NEXT_PUBLIC_WEB3FORMS_KEY (même alias que cizagroup.com et
 * cizasupply.com). Si la clé est absente, le formulaire ne prétend
 * pas envoyer : il bascule honnêtement sur un lien mailto vers
 * infos@cizagroup.com, avec le message déjà rédigé.
 */
export default async function ContactPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations("contact");
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 md:py-12">
        <h1 className="text-3xl font-bold text-navy md:text-4xl">{t("title")}</h1>
        <p className="mt-3 max-w-2xl text-base text-slate-600 md:text-lg">{t("subtitle")}</p>
        <ContactForm />
      </main>
      <PublicFooter />
    </div>
  );
}

import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DemoBanner from "@/components/DemoBanner";
import "../globals.css";

const locales = ["fr", "en"];

export const metadata: Metadata = {
  title: "CizaImmo — Vos biens, gérés simplement.",
  description:
    "Plateforme de gestion immobilière : immeubles, locataires, loyers, dépenses et ROI. Division de Ciza Group.",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!locales.includes(locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <DemoBanner />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

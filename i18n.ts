import { getRequestConfig } from "next-intl/server";

const locales = ["fr", "en"];

export default getRequestConfig(async ({ locale }) => {
  const safeLocale = locales.includes(locale as string) ? locale : "fr";
  return {
    locale: safeLocale as string,
    messages: (await import(`./messages/${safeLocale}.json`)).default,
  };
});

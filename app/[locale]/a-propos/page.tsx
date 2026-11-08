import Image from "next/image";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

const items = [
  "item1",
  "item2",
  "item3",
  "item4",
  "item5",
  "item6",
  "item7",
  "item8",
] as const;

/**
 * Page publique « À propos » (2026-11-08) — créée à la demande du
 * fondateur (« Apropos aussi »), qui a VALIDÉ LE TEXTE MOT POUR MOT
 * avant création (namespace i18n « about », FR validé, EN traduction
 * fidèle). Design « Marine & Or premium », même patron que
 * l'accueil : héros marine (bandeau adapté — pas de sélecteur de
 * devise ici), PHOTO DU FONDATEUR en carte encadrée blanche qui
 * chevauche la section crème suivante, avec sa légende sous la
 * photo (« Ciza Misigaro — Fondateur & CEO, Ciza Group », copie
 * déjà publique dans l'app Ciza Group ; photo source
 * fondateur-bureau.jpg de l'app, recopiée optimisée). Sections
 * alternées crème / blanc, titres marine SemiBold + filet or,
 * cartes blanches bordées ; bloc « Notre engagement » mis en
 * valeur en carte marine (le « n'encaisse jamais vos loyers » en
 * gras or via la balise <gras> du message). Boutons : UN SEUL
 * primaire or sur la page (le CTA final, libellé existant
 * landing.ctaTrial -> inscription ; secondaire démo existant
 * contact.demoTitle -> /contact) et en-tête avec masquerEssai
 * (même règle anti-doublon que l'accueil).
 */
export default async function AProposPage({
  params: { locale },
}: {
  params: { locale: string };
}) {
  setRequestLocale(locale);
  const t = await getTranslations("about");
  const tb = await getTranslations("brand");
  const tl = await getTranslations("landing");
  const tc = await getTranslations("contact");

  return (
    <div className="min-h-screen bg-cream text-navy">
      <PublicHeader masquerEssai />

      <main>
        {/* Héros — marine pleine largeur, photo du fondateur en chevauchement */}
        <section className="bg-gradient-to-b from-navy to-navy-dark text-white">
          <div className="mx-auto max-w-4xl px-6 pt-14 text-center md:px-12 md:pt-20">
            <h1 className="text-4xl font-bold leading-tight md:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-4 text-xl font-semibold text-gold">{tb("slogan")}</p>
          </div>
          <div className="relative z-10 mx-auto max-w-2xl px-6">
            <figure className="-mb-20 mt-12 rounded-2xl border border-white/40 bg-white p-2 shadow-2xl md:-mb-28">
              <Image
                src="/fondateur-ceo.jpg"
                alt={t("heroPhotoAlt")}
                width={1125}
                height={883}
                priority
                className="h-auto w-full rounded-xl object-cover"
              />
              <figcaption className="px-2 py-3 text-center text-sm font-semibold text-navy">
                {t("founderCaption")}
              </figcaption>
            </figure>
          </div>
        </section>

        {/* Qui sommes-nous — crème (dégage le chevauchement de la photo) */}
        <section className="bg-cream">
          <div className="mx-auto max-w-4xl px-6 pb-16 pt-36 md:px-12 md:pb-20 md:pt-48">
            <h2 className="text-center text-3xl font-semibold text-navy">
              {t("whoTitle")}
            </h2>
            <span className="mx-auto mt-4 block h-1 w-16 rounded-full bg-gold" />
            <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <p className="text-lg leading-relaxed text-slate-600">{t("whoText")}</p>
            </div>
          </div>
        </section>

        {/* Le problème que nous réglons — blanc */}
        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-6 py-16 md:px-12 md:py-20">
            <h2 className="text-center text-3xl font-semibold text-navy">
              {t("problemTitle")}
            </h2>
            <span className="mx-auto mt-4 block h-1 w-16 rounded-full bg-gold" />
            <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <p className="text-lg leading-relaxed text-slate-600">
                {t("problemText")}
              </p>
            </div>
          </div>
        </section>

        {/* Ce que fait la plateforme — crème, liste en cartes à puces */}
        <section className="bg-cream">
          <div className="mx-auto max-w-4xl px-6 py-16 md:px-12 md:py-20">
            <h2 className="text-center text-3xl font-semibold text-navy">
              {t("platformTitle")}
            </h2>
            <span className="mx-auto mt-4 block h-1 w-16 rounded-full bg-gold" />
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {items.map((k) => (
                <li
                  key={k}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold text-sm font-bold text-navy"
                  >
                    ✓
                  </span>
                  <span className="font-medium text-navy">{t(`items.${k}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Notre engagement — carte marine mise en valeur, puis CTA final */}
        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-6 py-16 md:px-12 md:py-20">
            <div className="rounded-2xl bg-navy p-6 text-white shadow-sm md:p-10">
              <h2 className="text-center text-3xl font-semibold text-white">
                {t("commitmentTitle")}
              </h2>
              <span className="mx-auto mt-4 block h-1 w-16 rounded-full bg-gold" />
              <p className="mx-auto mt-6 max-w-3xl text-center text-lg leading-relaxed text-slate-200">
                {t.rich("commitmentText", {
                  gras: (chunks) => (
                    <strong className="font-bold text-gold">{chunks}</strong>
                  ),
                })}
              </p>
            </div>
            <p className="mt-10 text-center font-semibold text-navy">
              {t("companyLine")
                .split(" · ")
                .map((segment, i) => (
                  <span key={i}>
                    {i > 0 ? " · " : null}
                    {i === 0 ? (
                      segment
                    ) : (
                      <span className="whitespace-nowrap">{segment}</span>
                    )}
                  </span>
                ))}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row">
              <Link
                href="/inscription"
                className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-full bg-gold px-4 py-3 text-center text-[13px] font-semibold tracking-tight text-navy hover:bg-gold-light sm:px-8 sm:text-base sm:tracking-normal"
              >
                {tl("ctaTrial")}
              </Link>
              <Link
                href="/contact"
                className="inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-full border border-navy px-4 py-3 text-center text-[13px] font-semibold tracking-tight text-navy hover:bg-navy hover:text-white sm:px-8 sm:text-base sm:tracking-normal"
              >
                {tc("demoTitle")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

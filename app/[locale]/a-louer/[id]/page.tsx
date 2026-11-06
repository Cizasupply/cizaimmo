"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import { getDataProvider } from "@/lib/data";
import type { AnnoncePublique } from "@/lib/data";
import { lienWhatsApp } from "@/lib/loyers";
import PublicFooter from "@/components/PublicFooter";
import LanguageSwitcher from "@/components/LanguageSwitcher";

/**
 * Fiche PUBLIQUE d'un appartement à louer (Module 6, spec §4, §6).
 * Sans connexion : photos, description, loyer, contact du propriétaire
 * / gestionnaire (lien WhatsApp / e-mail / téléphone). Jamais de
 * coordonnée de locataire ; ni réservation payante, ni encaissement.
 */
export default function AnnoncePubliquePage({ params }: { params: { id: string } }) {
  const t = useTranslations("public");
  const tc = useTranslations("crud.common");
  const locale = useLocale();

  const [annonce, setAnnonce] = useState<AnnoncePublique | null>(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    getDataProvider()
      .getAnnoncePublique(params.id)
      .then((a) => setAnnonce(a))
      .catch(() => setAnnonce(null))
      .finally(() => setChargement(false));
  }, [params.id]);

  const telephoneChiffres = annonce?.contact.telephone
    ? annonce.contact.telephone.replace(/[\s\-().]/g, "")
    : null;
  const lienWa = annonce?.contact.telephone
    ? lienWhatsApp(
        annonce.contact.telephone,
        `${annonce.immeuble_nom} — ${annonce.appartement.numero} : ${t("title")}`
      )
    : null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-navy-dark px-6 py-6 text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xl font-bold tracking-wide">
              <span className="text-white">CIZA</span>
              <span className="text-gold">IMMO</span>
            </p>
            <p className="text-xs text-slate-400">CizaImmo — division de Ciza Group</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/${locale}/a-louer`} className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-500 px-4 py-2 text-sm font-semibold hover:border-gold hover:text-gold">
              {t("backToList")}
            </Link>
            <LanguageSwitcher className="border-slate-500 text-slate-200 hover:border-gold hover:text-gold" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        {chargement ? (
          <p className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm">{tc("loading")}</p>
        ) : !annonce ? (
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <p className="font-bold text-navy">{t("noResults")}</p>
            <Link href={`/${locale}/a-louer`} className="mt-4 inline-block font-semibold text-navy underline">
              {t("backToList")}
            </Link>
          </div>
        ) : (
          <>
            <Link href={`/${locale}/a-louer`} className="mb-4 inline-block font-semibold text-navy underline">
              ← {t("backToList")}
            </Link>
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h1 className="text-2xl font-bold text-navy">
                {annonce.immeuble_nom} — {annonce.appartement.numero} · {annonce.appartement.type}
              </h1>
              <p className="mt-1 text-base text-slate-600">
                {annonce.ville} — {annonce.pays}
              </p>
              <p className="mt-3 text-2xl font-bold text-navy">
                {formatMoney(annonce.appartement.loyer_defaut, annonce.appartement.devise, locale)}
                <span className="text-base font-normal text-slate-500"> / {t("rentPerMonth")}</span>
              </p>
              {annonce.appartement.surface_m2 !== null ? (
                <p className="mt-1 text-sm text-slate-600">{annonce.appartement.surface_m2} m²</p>
              ) : null}
              {annonce.appartement.description ? (
                <div className="mt-4">
                  <h2 className="font-bold text-navy">{t("description")}</h2>
                  <p className="mt-1 text-base text-slate-700">{annonce.appartement.description}</p>
                </div>
              ) : null}
              <div className="mt-4">
                <h2 className="font-bold text-navy">{t("photos")}</h2>
                {annonce.appartement.photos.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-600">{t("noPhotos")}</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {annonce.appartement.photos.map((url) => (
                      <li key={url}>
                        <a href={url} target="_blank" rel="noreferrer" className="break-all font-semibold text-navy underline">{url}</a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-navy">{t("contactTitle")}</h2>
              <p className="mt-1 text-base text-slate-700">{annonce.contact.nom}</p>
              {annonce.contact.email || annonce.contact.telephone ? (
                <div className="mt-3 flex flex-wrap gap-3">
                  {lienWa ? (
                    <a href={lienWa} target="_blank" rel="noreferrer" className="rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white">
                      {t("contactWhatsApp")}
                    </a>
                  ) : null}
                  {annonce.contact.email ? (
                    <a href={`mailto:${annonce.contact.email}`} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-navy">
                      {t("contactEmail")}
                    </a>
                  ) : null}
                  {telephoneChiffres ? (
                    <a href={`tel:${telephoneChiffres}`} className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-bold text-navy">
                      {t("contactPhone")} : {annonce.contact.telephone}
                    </a>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-600">{t("noContact")}</p>
              )}
              <p role="note" className="mt-4 rounded-xl border border-gold/50 bg-amber-50 px-4 py-3 text-sm font-semibold text-navy">
                {t("disclaimer")}
              </p>
            </section>
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

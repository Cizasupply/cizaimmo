"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { getDataProvider, TYPES_APPARTEMENT } from "@/lib/data";
import type { AnnoncePublique, Devise } from "@/lib/data";
import { DEVISES } from "@/lib/data";

/**
 * Page PUBLIQUE « Appartements à louer » (Module 6, spec §4, §6).
 * Sans connexion : liste des appartements publiés (ville, type, loyer,
 * devise, photos), recherche / filtres (ville, type, loyer max, devise).
 * AUCUNE coordonnée de locataire n'apparaît jamais ; ni réservation
 * payante, ni encaissement — le contact se fait avec le propriétaire
 * ou le gestionnaire (voir la fiche publique de chaque appartement).
 */
export default function ALouerPage() {
  const t = useTranslations("public");
  const t16 = useTranslations("v16");
  const tc = useTranslations("crud.common");
  const locale = useLocale();

  const [annonces, setAnnonces] = useState<AnnoncePublique[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState(false);
  const [ville, setVille] = useState("");
  const [rechercheVille, setRechercheVille] = useState("");
  const [type, setType] = useState("");
  const [loyerMax, setLoyerMax] = useState("");
  const [devise, setDevise] = useState<Devise | "">("");

  useEffect(() => {
    getDataProvider()
      .listerAnnoncesPubliques()
      .then((liste) => setAnnonces(liste))
      .catch(() => setErreur(true))
      .finally(() => setChargement(false));
  }, []);

  const villes = useMemo(
    () => Array.from(new Set(annonces.map((a) => a.ville))).sort((a, b) => a.localeCompare(b)),
    [annonces]
  );

  const filtrees = useMemo(() => {
    const loyerMaxNombre = loyerMax.trim() === "" ? null : Number(loyerMax);
    return annonces.filter((a) => {
      if (ville && a.ville !== ville) return false;
      if (rechercheVille.trim() && !a.ville.toLowerCase().includes(rechercheVille.trim().toLowerCase())) return false;
      if (type && a.appartement.type !== type) return false;
      if (devise && a.appartement.devise !== devise) return false;
      // Loyer max : ne s'applique que dans la devise choisie — on ne
      // compare jamais deux devises sans taux daté.
      if (loyerMaxNombre !== null && Number.isFinite(loyerMaxNombre) && devise) {
        if (a.appartement.devise === devise && a.appartement.loyer_defaut > loyerMaxNombre) return false;
      }
      return true;
    });
  }, [annonces, ville, rechercheVille, type, loyerMax, devise]);

  return (
    <div className="min-h-screen bg-slate-50">
      <PublicHeader />

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <h1 className="text-2xl font-bold text-navy md:text-3xl">{t("title")}</h1>
        <p className="mt-2 text-base text-slate-600">{t("subtitle")}</p>
        <p role="note" className="mt-3 rounded-xl border border-gold/50 bg-amber-50 px-4 py-3 text-sm font-semibold text-navy">
          {t("disclaimer")}
        </p>

        {chargement ? (
          <p className="mt-6 rounded-2xl bg-white p-8 text-slate-500 shadow-sm">{tc("loading")}</p>
        ) : erreur ? (
          <p role="alert" className="mt-6 rounded-2xl bg-white p-8 text-red-700 shadow-sm">{tc("loadError")}</p>
        ) : (
          <>
            <div className="mt-6 grid gap-3 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-sm font-semibold text-slate-900">
                {t("searchCity")}
                <input
                  type="search"
                  value={rechercheVille}
                  onChange={(e) => setRechercheVille(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-900">
                {t("city")}
                <select
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"
                >
                  <option value="">{t("allCities")}</option>
                  {villes.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-900">
                {t("filterType")}
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"
                >
                  <option value="">{t("allTypes")}</option>
                  {TYPES_APPARTEMENT.map((ty) => (
                    <option key={ty} value={ty}>{ty}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-semibold text-slate-900">
                  {t("filterMaxRent")}
                  <input
                    type="number"
                    min={0}
                    value={loyerMax}
                    onChange={(e) => setLoyerMax(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-500">{t("maxRentHint")}</span>
                </label>
                <label className="block text-sm font-semibold text-slate-900">
                  {t("filterCurrency")}
                  <select
                    value={devise}
                    onChange={(e) => setDevise(e.target.value as Devise | "")}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"
                  >
                    <option value="">{t("all")}</option>
                    {DEVISES.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <p className="mt-6 text-sm font-semibold text-navy">
              {t("results", { count: String(filtrees.length) })}
            </p>

            {filtrees.length === 0 ? (
              <div className="mt-4 rounded-2xl bg-white p-8 shadow-sm">
                <p className="font-bold text-navy">{t("noResults")}</p>
                <p className="mt-2 text-slate-600">{t("noResultsText")}</p>
              </div>
            ) : (
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {filtrees.map((a) => (
                  <li key={a.appartement.id} className="rounded-2xl bg-white p-6 shadow-sm">
                    <div className="mb-4 aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                      {a.appartement.photos.length > 0 ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.appartement.photos[0]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-400">
                          {t16("noPhoto")}
                        </div>
                      )}
                    </div>
                    <Link href={`/${locale}/a-louer/${a.appartement.id}`} className="block">
                      <p className="text-lg font-bold text-navy underline">
                        {a.immeuble_nom} — {a.appartement.numero} · {a.appartement.type}
                        <span className="ml-2 inline-block rounded-full bg-navy px-2.5 py-1 align-middle text-xs font-bold text-gold no-underline">
                          {t16("verifiedBadge")}
                        </span>
                      </p>
                    </Link>
                    <p className="mt-1 text-sm text-slate-600">
                      {[a.adresse, a.quartier, a.ville].filter(Boolean).join(", ")} — {a.pays}
                    </p>
                    {a.appartement.pieces != null || a.appartement.meuble ? (
                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {a.appartement.pieces != null
                          ? t16("roomsCount", { count: String(a.appartement.pieces) })
                          : null}
                        {a.appartement.pieces != null && a.appartement.meuble ? " · " : null}
                        {a.appartement.meuble ? t16("furnished") : null}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xl font-bold text-navy">
                      {formatMoney(a.appartement.loyer_defaut, a.appartement.devise, locale)}
                      <span className="text-sm font-normal text-slate-500"> / {t("rentPerMonth")}</span>
                    </p>
                    {a.appartement.description ? (
                      <p className="mt-2 text-sm text-slate-700">{a.appartement.description}</p>
                    ) : null}
                    {a.appartement.photos.length > 0 ? (
                      <p className="mt-2 text-sm text-slate-600">
                        {a.appartement.photos.length} photo(s)
                      </p>
                    ) : null}
                    <Link href={`/${locale}/a-louer/${a.appartement.id}`} className="mt-3 inline-block rounded-full bg-navy px-4 py-2 text-sm font-bold text-white">
                      {t("viewDetails")}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

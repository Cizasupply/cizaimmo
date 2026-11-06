"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { formatMoney } from "@/lib/format";
import { getDataProvider, VITRINE_PAR_PLAN } from "@/lib/data";
import type { Appartement, Immeuble, Plan } from "@/lib/data";
import { messageErreur } from "@/lib/translateError";

/**
 * Vitrine « à louer » — gestion (Module 6, spec §4 et §6).
 * Pro et Agence uniquement ; le plan Starter voit la page avec
 * l'indication du plan requis (l'essai = fonctions Pro).
 *
 * Liste des appartements vacants ou bientôt libres : pour chacun,
 * publié / non publié, photos, description publique, loyer affiché
 * et devise. Actions : publier, retirer, prévisualiser la page
 * publique telle que la voit un visiteur. AUCUNE coordonnée de
 * locataire n'apparaît jamais.
 */
export default function VitrinePage() {
  const t = useTranslations("vitrine");
  const tc = useTranslations("crud.common");
  const tErr = useTranslations("crud");
  const locale = useLocale();
  const router = useRouter();

  const [appartements, setAppartements] = useState<Appartement[]>([]);
  const [immeubles, setImmeubles] = useState<Immeuble[]>([]);
  const [plan, setPlan] = useState<Plan | "essai" | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const planAutorise =
    plan !== null && VITRINE_PAR_PLAN[plan === "essai" ? "pro" : plan];

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const p = getDataProvider();
      const session = await p.getSession();
      if (!session) {
        router.push(`/${locale}/connexion`);
        return;
      }
      const [apts, ims, abo] = await Promise.all([
        p.listerAppartements({ inclureArchives: false }),
        p.listerImmeubles(true),
        p.getAbonnement(),
      ]);
      setAppartements(apts);
      setImmeubles(ims);
      setPlan(abo ? (abo.statut === "essai" ? "essai" : abo.plan) : null);
    } catch (e) {
      setErreur(messageErreur(tErr as unknown as (k: string) => string, e));
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const eligibles = useMemo(
    () =>
      appartements.filter(
        (a) => a.statut === "vacant" || a.statut === "reserve"
      ),
    [appartements]
  );

  const nomImmeuble = (id: string) =>
    immeubles.find((i) => i.id === id)?.nom ?? "—";
  const villeImmeuble = (id: string) =>
    immeubles.find((i) => i.id === id)?.ville ?? "—";

  async function basculer(apt: Appartement) {
    setErreur(null);
    try {
      const maj = await getDataProvider().basculerVitrine(apt.id, !apt.vitrine);
      setAppartements((anciens) =>
        anciens.map((a) => (a.id === apt.id ? maj : a))
      );
      setMessage(tc("updated"));
    } catch (e) {
      setErreur(messageErreur(tErr as unknown as (k: string) => string, e));
    }
  }

  return (
    <AppShell title={t("title")}>
      <p className="mb-4 text-base text-slate-600">{t("subtitle")}</p>
      {message ? (
        <p role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">{message}</p>
      ) : null}
      {erreur ? (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erreur}</p>
      ) : null}

      {chargement ? (
        <p className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm">{tc("loading")}</p>
      ) : !planAutorise ? (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="font-bold text-navy">{t("planRequired")}</p>
          <p className="mt-2 text-slate-600">{t("planRequiredText")}</p>
          <Link href={`/${locale}/abonnement`} className="mt-4 inline-block rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white">
            {t("viewPlans")}
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <Link href={`/${locale}/a-louer`} target="_blank" rel="noreferrer" className="rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white">
              {t("goToPublic")}
            </Link>
          </div>
          <p className="mb-4 text-sm text-slate-600">{t("manageHint")}</p>
          {eligibles.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 shadow-sm">
              <p className="font-bold text-navy">{t("empty")}</p>
              <p className="mt-2 text-slate-600">{t("emptyText")}</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {eligibles.map((a) => (
                <li key={a.id} className="rounded-2xl bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-bold text-navy">
                        {nomImmeuble(a.immeuble_id)} — {a.numero} · {a.type}
                      </p>
                      <p className="text-sm text-slate-600">{villeImmeuble(a.immeuble_id)}</p>
                      <p className="mt-2 text-base font-bold text-navy">
                        {t("rentLabel")} : {formatMoney(a.loyer_defaut, a.devise, locale)}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">
                        {t("descriptionLabel")} : {a.description ?? "—"}
                      </p>
                      {a.photos.length > 0 ? (
                        <p className="mt-1 text-sm text-slate-600">
                          {a.photos.length} photo(s)
                        </p>
                      ) : null}
                      <p className="mt-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${a.vitrine ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-700"}`}>
                          {a.vitrine ? t("published") : t("notPublished")}
                        </span>
                        <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                          {a.statut === "vacant" ? t("statusVacant") : t("statusSoonFree")}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => basculer(a)}
                        className="rounded-full bg-navy px-4 py-2 text-sm font-bold text-white"
                      >
                        {a.vitrine ? t("unpublish") : t("publish")}
                      </button>
                      {a.vitrine ? (
                        <Link href={`/${locale}/a-louer/${a.id}`} target="_blank" rel="noreferrer" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-navy">
                          {t("preview")}
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AppShell>
  );
}

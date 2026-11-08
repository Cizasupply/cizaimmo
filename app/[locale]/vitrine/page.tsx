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
  const t16 = useTranslations("v16");
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

  // v1.6 « Vitrine vérifiée » : la publication n'est plus un bascule —
  // le propriétaire DEMANDE, un Admin valide, puis seulement l'annonce
  // approuvée est publique. Le retrait reste libre et immédiat.
  async function demander(apt: Appartement) {
    setErreur(null);
    setMessage(null);
    try {
      const maj = await getDataProvider().demanderPublicationVitrine(apt.id);
      setAppartements((anciens) =>
        anciens.map((a) => (a.id === apt.id ? maj : a))
      );
      setMessage(t16("requestSentMsg"));
    } catch (e) {
      setErreur(messageErreur(tErr as unknown as (k: string) => string, e));
    }
  }

  async function retirer(apt: Appartement) {
    setErreur(null);
    setMessage(null);
    try {
      const maj = await getDataProvider().retirerPublicationVitrine(apt.id);
      setAppartements((anciens) =>
        anciens.map((a) => (a.id === apt.id ? maj : a))
      );
      setMessage(t16("withdrawnMsg"));
    } catch (e) {
      setErreur(messageErreur(tErr as unknown as (k: string) => string, e));
    }
  }

  function pastilleStatut(a: Appartement) {
    switch (a.vitrine_statut) {
      case "en_attente":
        return (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
            {t16("statusPending")}
          </span>
        );
      case "approuve":
        return (
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">
            {t16("statusApproved")}
          </span>
        );
      case "refuse":
        return (
          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
            {t16("statusRefused")}
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
            {t16("statusNotPublished")}
          </span>
        );
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
        <p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{tc("loading")}</p>
      ) : !planAutorise ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="font-bold text-navy">{t("planRequired")}</p>
          <p className="mt-2 text-slate-600">{t("planRequiredText")}</p>
          <Link href={`/${locale}/abonnement`} className="mt-4 inline-block rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:bg-gold-light">
            {t("viewPlans")}
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <Link href={`/${locale}/a-louer`} target="_blank" rel="noreferrer" className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:bg-gold-light">
              {t("goToPublic")}
            </Link>
          </div>
          <p className="mb-4 text-sm text-slate-600">{t("manageHint")}</p>
          {eligibles.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="font-bold text-navy">{t("empty")}</p>
              <p className="mt-2 text-slate-600">{t("emptyText")}</p>
            </div>
          ) : (
            <ul className="space-y-4">
              {eligibles.map((a) => (
                <li key={a.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-lg font-bold text-navy">
                        {nomImmeuble(a.immeuble_id)} — {a.numero} · {a.type}
                      </p>
                      <p className="break-words text-sm text-slate-600">{villeImmeuble(a.immeuble_id)}</p>
                      <p className="mt-2 break-words text-base font-bold text-navy">
                        {t("rentLabel")} : {formatMoney(a.loyer_defaut, a.devise, locale)}
                      </p>
                      <p className="mt-1 break-words text-sm text-slate-700">
                        {t("descriptionLabel")} : {a.description ?? "—"}
                      </p>
                      {a.photos.length > 0 ? (
                        <p className="mt-1 text-sm text-slate-600">
                          {a.photos.length} photo(s)
                        </p>
                      ) : null}
                      <p className="mt-2">
                        {pastilleStatut(a)}
                        <span className="ml-2 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                          {a.statut === "vacant" ? t("statusVacant") : t("statusSoonFree")}
                        </span>
                      </p>
                      {a.vitrine_statut === "refuse" && a.vitrine_motif_refus ? (
                        <p role="note" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                          {t16("refusalReasonLabel")} : {a.vitrine_motif_refus}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {a.vitrine_statut === "non_publie" || a.vitrine_statut === "refuse" ? (
                        <button
                          type="button"
                          onClick={() => demander(a)}
                          className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy hover:bg-gold-light"
                        >
                          {t16("requestPublication")}
                        </button>
                      ) : null}
                      {a.vitrine_statut === "en_attente" || a.vitrine_statut === "approuve" ? (
                        <button
                          type="button"
                          onClick={() => retirer(a)}
                          className="rounded-full border border-navy bg-white px-4 py-2 text-sm font-semibold text-navy hover:bg-navy/5"
                        >
                          {t16("withdrawPublication")}
                        </button>
                      ) : null}
                      {a.vitrine_statut === "approuve" ? (
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

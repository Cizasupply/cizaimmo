"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import Pagination from "@/components/Pagination";
import WhatsAppSendButton from "@/components/WhatsAppSendButton";
import { formatDate, formatMoney } from "@/lib/format";
import { getDataProvider } from "@/lib/data";
import type { EcheanceLoyer, Paiement, Profil, Recu } from "@/lib/data";
import { isoVersMois, lienMailto, lienWhatsApp } from "@/lib/loyers";
import { telechargerRecu } from "@/lib/recu-pdf";
import { messageErreur } from "@/lib/translateError";

function moisAffiche(moisIso: string, locale: string): string {
  const [a, m] = isoVersMois(moisIso).split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(a, m - 1, 1));
}

export default function RecusPage() {
  const t = useTranslations("crud");
  const tp = useTranslations("pages");
  const locale = useLocale();
  const router = useRouter();

  const [profil, setProfil] = useState<Profil | null>(null);
  const [recus, setRecus] = useState<Recu[]>([]);
  const [echeances, setEcheances] = useState<EcheanceLoyer[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [recherche, setRecherche] = useState("");
  const [statutFiltre, setStatutFiltre] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

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
      const [rc, ech, pay, prof] = await Promise.all([
        p.listerRecus(),
        p.listerEcheances(),
        p.listerPaiements(),
        p.getProfil(),
      ]);
      setRecus(rc);
      setEcheances(ech);
      setPaiements(pay);
      setProfil(prof);
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    let liste = recus;
    if (statutFiltre) liste = liste.filter((r) => r.statut === statutFiltre);
    if (q) {
      liste = liste.filter(
        (r) =>
          r.numero.toLowerCase().includes(q) ||
          r.locataire_nom.toLowerCase().includes(q)
      );
    }
    return liste;
  }, [recus, recherche, statutFiltre]);

  const totalPages = Math.max(1, Math.ceil(filtres.length / pageSize));
  const pageCourante = Math.min(page, totalPages);
  const visibles = filtres.slice((pageCourante - 1) * pageSize, pageCourante * pageSize);

  /** Restant dû après ce paiement (cumul chronologique des paiements valides de l'échéance). */
  function restantApres(recu: Recu): number {
    const echeance = echeances.find((e) => e.id === recu.echeance_id);
    if (!echeance) return 0;
    const chronologiques = paiements
      .filter((p) => p.echeance_id === recu.echeance_id && p.statut === "valide")
      .slice()
      .sort((a, b) => a.date_paiement.localeCompare(b.date_paiement));
    let cumul = 0;
    for (const p of chronologiques) {
      cumul +=
        p.devise === echeance.devise ? p.montant : (p.montant_converti ?? p.montant);
      if (p.id === recu.paiement_id) return Math.max(0, echeance.montant_du - cumul);
    }
    return Math.max(0, echeance.montant_du - cumul);
  }

  function moyenLabelCle(m: string): string {
    return m === "especes"
      ? "Cash"
      : m === "virement"
        ? "Transfer"
        : m === "mobile_money"
          ? "MobileMoney"
          : m === "cheque"
            ? "Cheque"
            : "Other";
  }

  function telecharger(recu: Recu) {
    telechargerRecu(
      {
        numero: recu.numero,
        date_emission: recu.date_emission,
        locataire_nom: recu.locataire_nom,
        immeuble_nom: recu.immeuble_nom,
        appartement_numero: recu.appartement_numero,
        mois: recu.mois,
        montant: recu.montant,
        devise: recu.devise,
        date_paiement: recu.date_paiement,
        reference: recu.reference,
        statut: recu.statut,
      },
      {
        restantApres: restantApres(recu),
        emetteurNom: profil?.nom ?? "—",
        moyenLabel: t(`rents.fields.method${moyenLabelCle(recu.moyen)}`),
        langue: locale === "en" ? "en" : "fr",
      }
    );
  }

  function liensRenvoi(recu: Recu) {
    const params = {
      name: recu.locataire_nom,
      numero: recu.numero,
      month: moisAffiche(recu.mois, locale),
      building: recu.immeuble_nom,
      unit: recu.appartement_numero,
      amount: formatMoney(recu.montant, recu.devise, locale),
    };
    return {
      email: lienMailto(
        recu.locataire_email,
        t("receipts.emailSubject", params),
        t("receipts.emailBody", params)
      ),
      whatsapp: lienWhatsApp(
        recu.locataire_telephone,
        t("receipts.whatsappMessage", params)
      ),
      // Même message que le lien wa.me, envoyé par l'API officielle Meta (module 6).
      whatsappMessage: t("receipts.whatsappMessage", params),
      telephone: recu.locataire_telephone,
    };
  }

  return (
    <AppShell title={tp("receipts.title")}>
      {erreur ? (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erreur}</p>
      ) : null}

      {chargement ? (
        <p className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>
      ) : recus.length === 0 ? (
        <EmptyState
          title={t("receipts.emptyTitle")}
          text={t("receipts.emptyText")}
          actionLabel={t("receipts.emptyAction")}
          actionHref={`/${locale}/loyers`}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-center">
            <input
              type="search"
              value={recherche}
              onChange={(e) => { setRecherche(e.target.value); setPage(1); }}
              placeholder={t("receipts.searchPlaceholder")}
              aria-label={t("common.search")}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-gold"
            />
            <select
              value={statutFiltre}
              onChange={(e) => { setStatutFiltre(e.target.value); setPage(1); }}
              aria-label={t("receipts.filterStatus")}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"
            >
              <option value="">{t("common.all")} — {t("receipts.filterStatus")}</option>
              <option value="valide">{t("receipts.statusValid")}</option>
              <option value="annule">{t("receipts.statusCancelled")}</option>
            </select>
          </div>

          {visibles.length === 0 ? (
            <p className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">{t("common.noResults")}</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {visibles.map((r) => {
                  const liens = liensRenvoi(r);
                  return (
                    <article key={r.numero} className="rounded-2xl bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-lg font-bold text-navy">{r.numero}</p>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${r.statut === "valide" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                          {r.statut === "valide" ? t("receipts.statusValid") : t("receipts.statusCancelled")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{r.locataire_nom}</p>
                      <p className="text-sm text-slate-600">
                        {moisAffiche(r.mois, locale)} · {r.immeuble_nom} — {r.appartement_numero}
                      </p>
                      <p className="mt-1 text-base font-bold text-navy">{formatMoney(r.montant, r.devise, locale)}</p>
                      <p className="text-xs text-slate-500">{formatDate(r.date_paiement, locale)}</p>
                      {r.statut === "annule" ? (
                        <p className="mt-1 text-xs font-medium text-red-700">{t("receipts.cancelledNote")}</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
                        <button type="button" onClick={() => telecharger(r)} className="text-sm font-semibold text-navy underline">
                          {t("receipts.download")}
                        </button>
                        {liens.email ? (
                          <a href={liens.email} className="text-sm font-semibold text-navy underline">{t("receipts.resendEmail")}</a>
                        ) : (
                          <span className="text-sm text-slate-400">{t("receipts.noEmail")}</span>
                        )}
                        {liens.whatsapp ? (
                          <>
                            <a href={liens.whatsapp} target="_blank" rel="noreferrer" className="text-sm font-semibold text-navy underline">{t("receipts.resendWhatsApp")}</a>
                            <WhatsAppSendButton to={liens.telephone} message={liens.whatsappMessage} label={t("receipts.resendWhatsAppApi")} />
                          </>
                        ) : (
                          <span className="text-sm text-slate-400">{t("receipts.noPhone")}</span>
                        )}
                        <Link href={`/${locale}/loyers`} className="text-sm font-semibold text-navy underline">
                          {t("receipts.openPayment")}
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto rounded-2xl bg-white shadow-sm md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="px-4 py-3">{t("receipts.colNumber")}</th>
                      <th className="px-4 py-3">{t("receipts.colDate")}</th>
                      <th className="px-4 py-3">{t("receipts.colTenant")}</th>
                      <th className="px-4 py-3">{t("receipts.colMonth")}</th>
                      <th className="px-4 py-3">{t("receipts.colAmount")}</th>
                      <th className="px-4 py-3">{t("receipts.colStatus")}</th>
                      <th className="px-4 py-3">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((r) => {
                      const liens = liensRenvoi(r);
                      return (
                        <tr key={r.numero} className="border-b border-slate-100 align-top hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold text-navy">{r.numero}</td>
                          <td className="px-4 py-3">{formatDate(r.date_paiement, locale)}</td>
                          <td className="px-4 py-3">
                            {r.locataire_nom}
                            <p className="text-xs text-slate-500">{r.immeuble_nom} — {r.appartement_numero}</p>
                          </td>
                          <td className="px-4 py-3">{moisAffiche(r.mois, locale)}</td>
                          <td className="px-4 py-3 font-semibold text-navy">{formatMoney(r.montant, r.devise, locale)}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${r.statut === "valide" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                              {r.statut === "valide" ? t("receipts.statusValid") : t("receipts.statusCancelled")}
                            </span>
                            {r.statut === "annule" ? (
                              <p className="mt-1 max-w-48 text-xs text-red-700">{t("receipts.cancelledNote")}</p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              <button type="button" onClick={() => telecharger(r)} className="font-semibold text-navy underline">
                                {t("receipts.download")}
                              </button>
                              {liens.email ? (
                                <a href={liens.email} className="font-semibold text-navy underline">{t("receipts.resendEmail")}</a>
                              ) : null}
                              {liens.whatsapp ? (
                                <>
                                  <a href={liens.whatsapp} target="_blank" rel="noreferrer" className="font-semibold text-navy underline">{t("receipts.resendWhatsApp")}</a>
                                  <WhatsAppSendButton to={liens.telephone} message={liens.whatsappMessage} label={t("receipts.resendWhatsAppApi")} />
                                </>
                              ) : null}
                              <Link href={`/${locale}/loyers`} className="font-semibold text-navy underline">
                                {t("receipts.openPayment")}
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <Pagination
            page={pageCourante}
            pageSize={pageSize}
            total={filtres.length}
            onPageChange={setPage}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
            perPageLabel={t("common.perPage")}
            showingLabel={(from, to, total) => t("common.showing", { from, to, total })}
          />
        </>
      )}
    </AppShell>
  );
}

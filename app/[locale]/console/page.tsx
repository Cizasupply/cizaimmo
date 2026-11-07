"use client";

/**
 * Console — vue d'ensemble (extension v1.2) : comptes, approbations en
 * attente, signalements anti-fraude, retards de paiement des
 * abonnements, MRR (abonnements actifs, prix DYNAMIQUES) et activité
 * récente du journal d'audit. CizaImmo n'encaisse que ses abonnements :
 * aucun montant de loyer client n'apparaît ici.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type { ComptePlateforme, DemandeRattachement, EntreeAudit } from "@/lib/data";
import { construirePrixPlans } from "@/lib/tarifs";
import { formatDate, formatMoney } from "@/lib/format";

export default function ConsoleAccueilPage() {
  const t = useTranslations("console");
  const locale = useLocale();
  const [comptes, setComptes] = useState<ComptePlateforme[]>([]);
  const [journal, setJournal] = useState<EntreeAudit[]>([]);
  const [demandes, setDemandes] = useState<DemandeRattachement[]>([]);
  const [mrr, setMrr] = useState(0);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    let actif = true;
    (async () => {
      try {
        const provider = getDataProvider();
        const [liste, tarifs, audit, demandesListe] = await Promise.all([
          provider.listerComptesPlateforme(),
          provider.getTarifsPlateforme(),
          provider.listerJournalAudit(),
          provider.listerDemandesRattachement(),
        ]);
        if (!actif) return;
        const prix = construirePrixPlans(tarifs);
        setComptes(liste);
        setDemandes(demandesListe);
        setJournal(audit.slice(0, 5));
        setMrr(
          liste
            .filter((c) => c.abonnement?.statut === "actif")
            .reduce(
              (somme, c) =>
                somme + (c.abonnement ? prix[c.abonnement.plan][c.abonnement.grille] : 0),
              0
            )
        );
      } catch {
        // La garde du shell gère les accès refusés.
      } finally {
        if (actif) setCharge(true);
      }
    })();
    return () => {
      actif = false;
    };
  }, []);

  const enAttente = comptes.filter((c) => c.abonnement?.statut === "en_attente");
  const aVerifier = comptes.filter((c) => c.grille_statut === "a_verifier");
  const enRetard = comptes.filter((c) => c.en_retard);
  const actifs = comptes.filter((c) => c.abonnement?.statut === "actif");
  const enEssai = comptes.filter((c) => c.abonnement?.statut === "essai");

  // KPI v1.3 : dossiers incomplets, contrats signés en attente de
  // validation, demandes de rattachement en attente de l'Admin.
  const dossiersIncomplets = comptes.filter((c) => !c.dossier_complet);
  const contratsEnAttente = comptes.filter((c) => c.statut_contrat === "signe_recu");
  const demandesEnAttenteAdmin = demandes.filter((d) => d.statut === "en_attente_admin");

  const cartes = [
    { label: t("statAccounts"), valeur: comptes.length, couleur: "text-navy" },
    { label: t("statPending"), valeur: enAttente.length, couleur: "text-amber-600" },
    { label: t("statToVerify"), valeur: aVerifier.length, couleur: "text-amber-600" },
    { label: t("statLate"), valeur: enRetard.length, couleur: "text-red-600" },
    { label: t("statActive"), valeur: actifs.length, couleur: "text-green-700" },
    { label: t("statTrials"), valeur: enEssai.length, couleur: "text-navy" },
    { label: t("statIncompleteFiles"), valeur: dossiersIncomplets.length, couleur: "text-amber-600" },
    { label: t("statContractsPending"), valeur: contratsEnAttente.length, couleur: "text-amber-600" },
    { label: t("statLinkRequestsPending"), valeur: demandesEnAttenteAdmin.length, couleur: "text-amber-600" },
    {
      label: t("statMrr"),
      valeur: formatMoney(mrr, "USD", locale),
      couleur: "text-green-700",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy md:text-3xl">{t("overviewTitle")}</h1>
      <p className="mt-1 text-sm text-slate-600">{t("overviewSubtitle")}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cartes.map((c) => (
          <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className={`mt-1 text-2xl font-bold ${c.couleur}`}>{c.valeur}</p>
          </div>
        ))}
      </div>

      {enAttente.length > 0 ? (
        <section className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-bold text-amber-800">{t("reviewQueueTitle")}</h2>
          <ul className="mt-3 space-y-2">
            {enAttente.slice(0, 5).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-navy">{c.nom}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {c.email} · {formatDate(c.created_at, locale)}
                  </span>
                </span>
                {c.grille_statut === "a_verifier" ? (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                    {t("badgeToVerify")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <Link
            href={`/${locale}/console/comptes`}
            className="mt-4 inline-block rounded-full bg-navy px-5 py-2 text-sm font-bold text-white hover:bg-navy-light"
          >
            {t("reviewQueueCta")}
          </Link>
        </section>
      ) : null}

      {enRetard.length > 0 ? (
        <section className="mt-8 rounded-2xl border border-red-200 bg-white p-5">
          <h2 className="font-bold text-red-700">{t("lateTitle")}</h2>
          <ul className="mt-3 space-y-2">
            {enRetard.slice(0, 5).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-red-50 px-4 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-navy">{c.nom}</span>
                  <span className="block truncate text-xs text-slate-500">{c.email}</span>
                </span>
                <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">
                  {t("badgeLate")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-navy">{t("recentActivity")}</h2>
        {!charge ? (
          <p className="mt-3 text-sm text-slate-500">{t("loading")}</p>
        ) : journal.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{t("noActivity")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {journal.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-2 text-sm last:border-0">
                <span className="min-w-0">
                  <span className="font-semibold text-navy">{t(`audit.${e.action}` as "audit.compte_approuve")}</span>{" "}
                  <span className="text-slate-600">
                    — {e.cible_email ?? e.cible_id ?? ""} · {t("byActor", { actor: e.acteur_email })}
                  </span>
                </span>
                <span className="text-xs text-slate-400">{formatDate(e.created_at, locale)}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href={`/${locale}/console/journal`} className="mt-4 inline-block text-sm font-semibold text-navy underline">
          {t("journalCta")}
        </Link>
      </section>
    </div>
  );
}

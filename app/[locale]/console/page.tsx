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
import type { AnnonceAValider, ComptePlateforme, DemandeRattachement, EntreeAudit } from "@/lib/data";
import type { Conversation } from "@/lib/data/types";
import { construirePrixPlans } from "@/lib/tarifs";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

export default function ConsoleAccueilPage() {
  const t = useTranslations("console");
  const t15 = useTranslations("v15");
  const locale = useLocale();
  const [comptes, setComptes] = useState<ComptePlateforme[]>([]);
  const [journal, setJournal] = useState<EntreeAudit[]>([]);
  const [demandes, setDemandes] = useState<DemandeRattachement[]>([]);
  const [vitrineAValider, setVitrineAValider] = useState<AnnonceAValider[]>([]);
  const [filsPlateforme, setFilsPlateforme] = useState<Conversation[]>([]);
  const [mrr, setMrr] = useState(0);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    let actif = true;
    (async () => {
      try {
        const provider = getDataProvider();
        const [liste, tarifs, audit, demandesListe, vitrineListe, filsListe] = await Promise.all([
          provider.listerComptesPlateforme(),
          provider.getTarifsPlateforme(),
          // Lecture du journal réservée au Super Admin
          // (verrouillage 2026-11-08) : repli silencieux pour
          // l'Admin, même patron que les deux appels suivants —
          // sa Vue d'ensemble reste complète, sans le bloc journal.
          provider.listerJournalAudit().catch(() => [] as EntreeAudit[]),
          provider.listerDemandesRattachement(),
          provider.listerVitrineAValider().catch(() => [] as AnnonceAValider[]),
          provider.listerConversationsPlateforme().catch(() => [] as Conversation[]),
        ]);
        if (!actif) return;
        const prix = construirePrixPlans(tarifs);
        setComptes(liste);
        setDemandes(demandesListe);
        setVitrineAValider(vitrineListe);
        setFilsPlateforme(filsListe);
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

  // Notification messages (2026-11-07) : total des messages clients
  // non lus par la plateforme + les 3 fils non lus les plus récents
  // (la boîte de réception arrive déjà triée par dernier message
  // décroissant ; dossiers assignés ou NON inclus).
  const totalMessagesNonLus = filsPlateforme.reduce(
    (somme, c) => somme + (c.non_lus ?? 0),
    0
  );
  const filsNonLusRecents = filsPlateforme
    .filter((c) => (c.non_lus ?? 0) > 0)
    .slice(0, 3);

  // Design « Marine & Or » console (2026-11-07) : chaque carte KPI
  // blanche bordée porte une barre d'accent métier de 4 px, alignée
  // sur la couleur de sa valeur (attente = ambre, retard = rouge,
  // actif/MRR = vert, neutre = marine) — même patron que le tableau
  // de bord client. Correctif mobile 2026-11-08 : la valeur ne coupe
  // jamais en plein milieu (whitespace-nowrap, taille réduite sur
  // mobile, pleine taille dès sm) — même patron que le client.
  const cartes = [
    { label: t("statAccounts"), valeur: comptes.length, couleur: "text-navy", accent: "bg-navy" },
    { label: t("statPending"), valeur: enAttente.length, couleur: "text-amber-600", accent: "bg-amber-500" },
    { label: t("statToVerify"), valeur: aVerifier.length, couleur: "text-amber-600", accent: "bg-amber-500" },
    { label: t("statLate"), valeur: enRetard.length, couleur: "text-red-600", accent: "bg-red-500" },
    { label: t("statActive"), valeur: actifs.length, couleur: "text-green-700", accent: "bg-green-500" },
    { label: t("statTrials"), valeur: enEssai.length, couleur: "text-navy", accent: "bg-navy" },
    { label: t("statIncompleteFiles"), valeur: dossiersIncomplets.length, couleur: "text-amber-600", accent: "bg-amber-500" },
    { label: t("statContractsPending"), valeur: contratsEnAttente.length, couleur: "text-amber-600", accent: "bg-amber-500" },
    { label: t("statLinkRequestsPending"), valeur: demandesEnAttenteAdmin.length, couleur: "text-amber-600", accent: "bg-amber-500" },
    { label: t("statVitrinePending"), valeur: vitrineAValider.length, couleur: "text-amber-600", accent: "bg-amber-500" },
    {
      label: t("statMrr"),
      valeur: formatMoney(mrr, "USD", locale),
      couleur: "text-green-700",
      accent: "bg-green-500",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy md:text-3xl">{t("overviewTitle")}</h1>
      <p className="mt-1 text-sm text-slate-600">{t("overviewSubtitle")}</p>

      {/* Carte « héros » marine (design « Marine & Or » console,
          2026-11-07) : synthèse plateforme construite UNIQUEMENT
          à partir des compteurs déjà calculés par la page —
          dossiers en attente, comptes, messages non lus — chiffres
          en or, aucun nouveau calcul métier.
          Correctif mobile 2026-11-08 (capture annotée du fondateur) :
          en 3 colonnes étroites, les libellés se touchaient (« EN
          ATTENTE D'APPROBATION » collé à « COMPTES CLIENTS ») — les
          3 compteurs s'empilent sur mobile, 3 colonnes dès sm. */}
      <section className="mt-6 rounded-2xl bg-navy p-5 text-white shadow-sm">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-4">
          <div className="min-w-0">
            <p className="text-3xl font-bold text-gold">{enAttente.length}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
              {t("statPending")}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-3xl font-bold text-gold">{comptes.length}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
              {t("statAccounts")}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-3xl font-bold text-gold">{totalMessagesNonLus}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-300">
              {t("unreadMessagesTitle")}
            </p>
          </div>
        </div>
      </section>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cartes.map((c) => (
          <div key={c.label} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 pl-5 shadow-sm">
            <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${c.accent}`} />
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
            <p className={`mt-1 whitespace-nowrap text-xl font-bold sm:text-2xl ${c.couleur}`}>{c.valeur}</p>
          </div>
        ))}
      </div>

      {/* Notification : messages clients non lus (mise en évidence
          ambre dès qu'il y en a ; carte calme à zéro). */}
      <section
        className={`mt-8 rounded-2xl border p-5 ${
          totalMessagesNonLus > 0
            ? "border-amber-300 bg-amber-50"
            : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            className={`font-bold ${
              totalMessagesNonLus > 0 ? "text-amber-800" : "text-navy"
            }`}
          >
            {t("unreadMessagesTitle")}
          </h2>
          <span
            className={`rounded-full px-3 py-1 text-sm font-bold ${
              totalMessagesNonLus > 0
                ? "bg-gold text-navy-dark"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {totalMessagesNonLus}
          </span>
        </div>
        {totalMessagesNonLus === 0 ? (
          <p className="mt-3 text-sm text-slate-500">{t("unreadMessagesNone")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {filsNonLusRecents.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/${locale}/console/comptes/${c.proprietaire_id}#messages`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 hover:bg-amber-100/60"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-navy">
                      {c.proprietaire_nom ?? c.proprietaire_email ?? "—"}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {c.dernier_message ?? ""}
                      {c.dernier_message_le
                        ? ` · ${formatDateTime(c.dernier_message_le, locale)}`
                        : ""}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-gold px-2.5 py-1 text-xs font-bold text-navy-dark">
                    {t15("unread", { count: String(c.non_lus ?? 0) })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          href={`/${locale}/console/messages`}
          className="mt-4 inline-block rounded-full border border-navy bg-white px-5 py-2 text-sm font-semibold text-navy hover:bg-navy/5"
        >
          {t("viewInbox")}
        </Link>
      </section>

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
            className="mt-4 inline-block rounded-full border border-navy bg-white px-5 py-2 text-sm font-semibold text-navy hover:bg-navy/5"
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
        <h2 className="font-semibold text-navy">{t("recentActivity")}</h2>
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
                    — {e.cible_email ?? e.cible_id ?? ""} · {t("byActor", { actor: e.acteur_nom ?? e.acteur_email })}
                  </span>
                </span>
                <span className="text-xs text-slate-400">{formatDateTime(e.created_at, locale)}</span>
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

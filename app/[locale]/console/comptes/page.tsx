"use client";

/**
 * Console — Comptes (extension v1.2) : file de revue FUSIONNÉE
 * (approbations en attente + signalements anti-fraude) et gestion des
 * comptes clients : suspendre/réactiver, avis par modèle prédéfini,
 * réattribution de grille, suppression définitive (Super Admin seul).
 * Toute action est journalisée côté fournisseur.
 */

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type { ComptePlateforme, ModeleAvis, MotifRefus, Profil } from "@/lib/data";
import { MODELES_AVIS, MOTIFS_REFUS, libellerMotif } from "@/lib/avis";
import { nomPaysDepuisCode } from "@/lib/grille";
import { formatDate } from "@/lib/format";

type Filtre = "tous" | "en_attente" | "a_verifier" | "en_retard" | "suspendus";

const COULEUR_STATUT: Record<string, string> = {
  en_attente: "bg-amber-100 text-amber-800",
  essai: "bg-sky-100 text-sky-800",
  actif: "bg-green-100 text-green-800",
  lecture_seule: "bg-slate-200 text-slate-700",
  annule: "bg-slate-200 text-slate-500",
  suspendu: "bg-red-100 text-red-700",
};

export default function ConsoleComptesPage() {
  const t = useTranslations("console");
  const locale = useLocale();
  const [comptes, setComptes] = useState<ComptePlateforme[]>([]);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  // États d'action par compte : avis (modèle choisi), refus (motif), suppression (confirmation).
  const [avisModele, setAvisModele] = useState<Record<string, ModeleAvis>>({});
  const [refusMotif, setRefusMotif] = useState<Record<string, MotifRefus>>({});
  const [refusOuvert, setRefusOuvert] = useState<string | null>(null);
  const [suppressionArmee, setSuppressionArmee] = useState<string | null>(null);

  const recharger = useCallback(async () => {
    const provider = getDataProvider();
    const [liste, moi] = await Promise.all([
      provider.listerComptesPlateforme(),
      provider.getProfil(),
    ]);
    setComptes(liste);
    setProfil(moi);
  }, []);

  useEffect(() => {
    recharger().catch(() => undefined);
  }, [recharger]);

  const estSuper = profil?.role === "super_admin";

  async function agir(id: string, action: () => Promise<void>, succes: string) {
    setOccupe(id);
    setMessage(null);
    setErreur(null);
    try {
      await action();
      setMessage(succes);
      await recharger();
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setErreur(
        code.startsWith("ERR_")
          ? t(`errors.${code}` as "errors.ERR_OPERATION_INTERDITE")
          : t("errors.generic")
      );
    } finally {
      setOccupe(null);
    }
  }

  const filtres: { id: Filtre; label: string; compte: number }[] = [
    { id: "tous", label: t("filterAll"), compte: comptes.length },
    {
      id: "en_attente",
      label: t("filterPending"),
      compte: comptes.filter((c) => c.abonnement?.statut === "en_attente").length,
    },
    {
      id: "a_verifier",
      label: t("filterToVerify"),
      compte: comptes.filter((c) => c.grille_statut === "a_verifier").length,
    },
    {
      id: "en_retard",
      label: t("filterLate"),
      compte: comptes.filter((c) => c.en_retard).length,
    },
    {
      id: "suspendus",
      label: t("filterSuspended"),
      compte: comptes.filter((c) => c.abonnement?.statut === "suspendu" || c.suspendu).length,
    },
  ];

  const visibles = comptes.filter((c) => {
    if (filtre === "en_attente") return c.abonnement?.statut === "en_attente";
    if (filtre === "a_verifier") return c.grille_statut === "a_verifier";
    if (filtre === "en_retard") return c.en_retard;
    if (filtre === "suspendus") return c.abonnement?.statut === "suspendu" || c.suspendu;
    return true;
  });

  function BadgeStatut({ compte }: { compte: ComptePlateforme }) {
    const statut = compte.abonnement?.statut ?? "annule";
    return (
      <span className={`rounded-full px-2 py-1 text-xs font-bold ${COULEUR_STATUT[statut] ?? COULEUR_STATUT.annule}`}>
        {t(`status.${statut}` as "status.actif")}
      </span>
    );
  }

  function Signaux({ compte }: { compte: ComptePlateforme }) {
    return (
      <p className="text-xs text-slate-500">
        {t("declaredCountry")} : <strong className="text-slate-700">{compte.pays_declare ?? "—"}</strong>
        {" · "}
        {t("ipCountry")} :{" "}
        <strong className="text-slate-700">
          {compte.pays_ip ? `${nomPaysDepuisCode(compte.pays_ip)} (${compte.pays_ip})` : t("ipUnknown")}
        </strong>
        {compte.pays_paiement ? (
          <>
            {" · "}
            {t("paymentCountry")} : <strong className="text-slate-700">{compte.pays_paiement}</strong>
          </>
        ) : null}
      </p>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy md:text-3xl">{t("accountsTitle")}</h1>
      <p className="mt-1 text-sm text-slate-600">{t("accountsSubtitle")}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {filtres.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltre(f.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              filtre === f.id
                ? "bg-navy text-white"
                : "border border-slate-300 bg-white text-navy hover:border-gold"
            }`}
          >
            {f.label} ({f.compte})
          </button>
        ))}
      </div>

      {message ? (
        <p role="status" className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
          {message}
        </p>
      ) : null}
      {erreur ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {erreur}
        </p>
      ) : null}

      <div className="mt-6 space-y-4">
        {visibles.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            {t("noAccounts")}
          </p>
        ) : null}
        {visibles.map((compte) => {
          const enAttente = compte.abonnement?.statut === "en_attente";
          const suspendu = compte.abonnement?.statut === "suspendu" || compte.suspendu;
          const modele = avisModele[compte.id] ?? "retard_paiement";
          const motif = refusMotif[compte.id] ?? "informations_insuffisantes";
          return (
            <article
              key={compte.id}
              className={`rounded-2xl border bg-white p-5 ${
                enAttente ? "border-amber-300" : "border-slate-200"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-bold text-navy">{compte.nom}</h2>
                  <p className="truncate text-sm text-slate-500">{compte.email}</p>
                  <Signaux compte={compte} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <BadgeStatut compte={compte} />
                  {compte.grille_statut === "a_verifier" ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                      ⚠ {t("badgeToVerify")}
                    </span>
                  ) : null}
                  {compte.en_retard ? (
                    <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">
                      {t("badgeLate")}
                    </span>
                  ) : null}
                  {compte.motif_refus ? (
                    <span className="rounded-full bg-slate-700 px-2 py-1 text-xs font-bold text-white">
                      {t("badgeRefused")} : {libellerMotif(compte.motif_refus, locale === "en" ? "en" : "fr")}
                    </span>
                  ) : null}
                </div>
              </div>

              <p className="mt-3 text-sm text-slate-600">
                {t("planLabel")} :{" "}
                <strong>{compte.abonnement ? t(`plan.${compte.abonnement.plan}` as "plan.pro") : "—"}</strong>
                {" · "}
                {t("gridLabel")} :{" "}
                <strong>
                  {compte.abonnement ? t(`grid.${compte.abonnement.grille}` as "grid.afrique") : "—"}
                </strong>
                {" · "}
                {t("sinceLabel")} : {formatDate(compte.created_at, locale)}
                {compte.abonnement?.trial_ends_at ? (
                  <>
                    {" · "}
                    {t("trialEndsLabel")} : {formatDate(compte.abonnement.trial_ends_at, locale)}
                  </>
                ) : null}
                {compte.abonnement?.fin_periode ? (
                  <>
                    {" · "}
                    {t("periodEndsLabel")} : {formatDate(compte.abonnement.fin_periode, locale)}
                  </>
                ) : null}
              </p>

              {/* File de revue : approbation / refus / grille (en attente). */}
              {enAttente ? (
                <div className="mt-4 rounded-xl bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-800">{t("reviewTitle")}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={occupe === compte.id}
                      onClick={() =>
                        agir(compte.id, () => getDataProvider().approuverCompte(compte.id), t("approvedMsg"))
                      }
                      className="rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      ✓ {t("approve")}
                    </button>
                    <button
                      type="button"
                      disabled={occupe === compte.id}
                      onClick={() => setRefusOuvert(refusOuvert === compte.id ? null : compte.id)}
                      className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      ✕ {t("refuse")}
                    </button>
                    {compte.abonnement?.grille !== "afrique" ? (
                      <button
                        type="button"
                        disabled={occupe === compte.id}
                        onClick={() =>
                          agir(compte.id, () => getDataProvider().reattribuerGrille(compte.id, "afrique"), t("gridUpdatedMsg"))
                        }
                        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy disabled:opacity-50"
                      >
                        {t("assignGridAfrica")}
                      </button>
                    ) : null}
                    {compte.abonnement?.grille !== "internationale" ? (
                      <button
                        type="button"
                        disabled={occupe === compte.id}
                        onClick={() =>
                          agir(compte.id, () => getDataProvider().reattribuerGrille(compte.id, "internationale"), t("gridUpdatedMsg"))
                        }
                        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy disabled:opacity-50"
                      >
                        {t("assignGridInternational")}
                      </button>
                    ) : null}
                  </div>
                  {refusOuvert === compte.id ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <label className="text-sm font-semibold text-slate-700" htmlFor={`motif-${compte.id}`}>
                        {t("refusalReason")}
                      </label>
                      <select
                        id={`motif-${compte.id}`}
                        value={motif}
                        onChange={(e) =>
                          setRefusMotif({ ...refusMotif, [compte.id]: e.target.value as MotifRefus })
                        }
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      >
                        {MOTIFS_REFUS.map((m) => (
                          <option key={m} value={m}>
                            {libellerMotif(m, locale === "en" ? "en" : "fr")}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={occupe === compte.id}
                        onClick={() =>
                          agir(
                            compte.id,
                            () => getDataProvider().refuserCompte(compte.id, motif),
                            t("refusedMsg")
                          )
                        }
                        className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {t("confirmRefusal")}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Actions de gestion (comptes déjà approuvés). */}
              {!enAttente && compte.abonnement?.statut !== "annule" ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <select
                    aria-label={t("noticeModel")}
                    value={modele}
                    onChange={(e) =>
                      setAvisModele({ ...avisModele, [compte.id]: e.target.value as ModeleAvis })
                    }
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {MODELES_AVIS.filter((m) => m !== "inscription_refusee").map((m) => (
                      <option key={m} value={m}>
                        {t(`notice.${m}` as "notice.retard_paiement")}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={occupe === compte.id}
                    onClick={() =>
                      agir(compte.id, async () => {
                        await getDataProvider().envoyerAvis(compte.id, modele);
                      }, t("noticeSentMsg"))
                    }
                    className="rounded-full bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-light disabled:opacity-50"
                  >
                    {t("sendNotice")}
                  </button>
                  {compte.grille_statut === "a_verifier" ? (
                    <>
                      <button
                        type="button"
                        disabled={occupe === compte.id}
                        onClick={() =>
                          agir(compte.id, () => getDataProvider().reattribuerGrille(compte.id, "afrique"), t("gridUpdatedMsg"))
                        }
                        className="rounded-full border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50"
                      >
                        {t("assignGridAfrica")}
                      </button>
                      <button
                        type="button"
                        disabled={occupe === compte.id}
                        onClick={() =>
                          agir(compte.id, () => getDataProvider().reattribuerGrille(compte.id, "internationale"), t("gridUpdatedMsg"))
                        }
                        className="rounded-full border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50"
                      >
                        {t("assignGridInternational")}
                      </button>
                    </>
                  ) : null}
                  {suspendu ? (
                    <button
                      type="button"
                      disabled={occupe === compte.id}
                      onClick={() =>
                        agir(compte.id, () => getDataProvider().reactiverCompte(compte.id), t("reactivatedMsg"))
                      }
                      className="rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {t("reactivate")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={occupe === compte.id}
                      onClick={() =>
                        agir(compte.id, () => getDataProvider().suspendreCompte(compte.id), t("suspendedMsg"))
                      }
                      className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {t("suspend")}
                    </button>
                  )}
                  {estSuper ? (
                    suppressionArmee === compte.id ? (
                      <button
                        type="button"
                        disabled={occupe === compte.id}
                        onClick={() =>
                          agir(compte.id, async () => {
                            await getDataProvider().supprimerCompteDefinitivement(compte.id);
                            setSuppressionArmee(null);
                          }, t("deletedMsg"))
                        }
                        className="rounded-full bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-50"
                      >
                        {t("confirmDelete")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={occupe === compte.id}
                        onClick={() => setSuppressionArmee(compte.id)}
                        className="rounded-full border border-red-700 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-700 hover:text-white disabled:opacity-50"
                      >
                        {t("deleteForever")}
                      </button>
                    )
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}

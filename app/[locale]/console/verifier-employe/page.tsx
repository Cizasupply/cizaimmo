"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type { VerificationEmploye } from "@/lib/data";
import { formatDate } from "@/lib/format";

/**
 * « Vérifier un employé » (pack employé, 2026-11-08) — vérification
 * d'une carte employé CONTRE LA BASE : saisie (ou collage) du Display
 * ID porté par la carte → identité, photo, rôle, statut du compte,
 * dossier, contrat, charte et émission de la carte, lus en direct.
 * Un compte suspendu (ou un accès console fermé) ressort VISIBLEMENT
 * comme NON VALIDE : la carte ne « passe » plus.
 * Console plateforme (Admin et Super Admin).
 */
export default function PageVerifierEmploye() {
  const t = useTranslations("packEmploye");
  const td = useTranslations("dossierEmploye");
  const locale = useLocale();
  const [saisie, setSaisie] = useState("");
  const [resultat, setResultat] = useState<VerificationEmploye | null>(null);
  const [cherche, setCherche] = useState(false);
  const [introuvable, setIntrouvable] = useState(false);
  const [erreur, setErreur] = useState(false);

  async function verifier(e: React.FormEvent) {
    e.preventDefault();
    const id = saisie.trim();
    if (!id) return;
    setCherche(true);
    setIntrouvable(false);
    setErreur(false);
    setResultat(null);
    try {
      const res = await getDataProvider().verifierEmploye(id);
      if (!res) setIntrouvable(true);
      else setResultat(res);
    } catch {
      setErreur(true);
    } finally {
      setCherche(false);
    }
  }

  const ligne = (libelle: string, valeur: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="font-semibold text-slate-500">{libelle}</span>
      <span className="text-right font-semibold text-navy">{valeur}</span>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="text-xl font-bold text-navy">{t("verifyTitle")}</h1>
      <p className="mt-1 text-sm text-slate-600">{t("verifySubtitle")}</p>

      <form
        onSubmit={verifier}
        className="mt-5 flex gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <input
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder={t("verifyPlaceholder")}
          className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold uppercase tracking-wide text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={cherche || !saisie.trim()}
          className="shrink-0 rounded-xl bg-gold px-5 py-2.5 text-sm font-bold text-navy transition hover:bg-gold-light disabled:opacity-50"
        >
          {t("verifyButton")}
        </button>
      </form>

      {introuvable ? (
        <p className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          {t("verifyNotFound")}
        </p>
      ) : null}
      {erreur ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {t("errorGeneric")}
        </p>
      ) : null}

      {resultat ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div
            className={`px-5 py-3 text-center text-sm font-bold tracking-wide ${
              resultat.valide
                ? "bg-emerald-600 text-white"
                : "bg-red-700 text-white"
            }`}
          >
            {resultat.valide ? t("verifyValid") : t("verifyInvalid")}
          </div>
          <div className="p-5">
            <div className="flex items-center gap-4">
              {resultat.photo_profil_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resultat.photo_profil_url}
                  alt={resultat.nom}
                  className="h-20 w-16 shrink-0 rounded-xl border border-slate-200 object-cover"
                />
              ) : (
                <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-xl bg-navy text-2xl font-bold text-gold">
                  {(resultat.nom || "?").trim().charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-navy">
                  {resultat.nom}
                </p>
                <p className="whitespace-nowrap text-sm font-bold text-gold-dark">
                  {resultat.display_id}
                </p>
                <p className="truncate text-sm text-slate-600">
                  {resultat.email}
                </p>
                <p className="text-sm font-semibold text-slate-700">
                  {resultat.role === "super_admin"
                    ? "Super Admin"
                    : "Admin"}{" "}
                  — CizaImmo
                </p>
              </div>
            </div>
            <div className="mt-4">
              {ligne(
                t("verifyAccountStatus"),
                resultat.statut_compte === "suspendu" ? (
                  <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                    {t("verifyStatusSuspended")}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    {t("verifyStatusActive")}
                  </span>
                )
              )}
              {ligne(
                t("verifyAccess"),
                resultat.acces_console_actif
                  ? t("verifyAccessOpen")
                  : t("verifyAccessClosed")
              )}
              {ligne(
                t("verifyFile"),
                resultat.dossier_complet
                  ? td("complete")
                  : td("incomplete")
              )}
              {ligne(
                t("verifyContract"),
                t(
                  `contratStatus.${resultat.contrat_statut}` as "contratStatus.valide"
                )
              )}
              {ligne(
                t("verifyCharter"),
                resultat.charte_acceptee_le
                  ? `${t("verifyYes")} — ${t("verifyAcceptedOn", {
                      date: formatDate(resultat.charte_acceptee_le, locale),
                    })}`
                  : t("verifyPending")
              )}
              {ligne(
                t("verifyCard"),
                resultat.carte_emise
                  ? t("teamCardIssued")
                  : t("teamCardNotIssued")
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

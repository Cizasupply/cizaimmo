"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import BandeauPage from "@/components/BandeauPage";
import TuileIcone from "@/components/TuileIcone";
import { getDataProvider } from "@/lib/data";
import type { MembreEquipe, Profil, VerificationEmploye } from "@/lib/data";
import { filtrerMembresEmployes } from "@/lib/pack-employe";
import { formatDate } from "@/lib/format";

/**
 * « Vérifier un employé » (pack employé, 2026-11-08) — vérification
 * d'une carte employé CONTRE LA BASE : saisie (ou collage) du Display
 * ID porté par la carte → identité, photo, rôle, statut du compte,
 * dossier, contrat, charte et émission de la carte, lus en direct.
 * Un compte suspendu (ou un accès console fermé) ressort VISIBLEMENT
 * comme NON VALIDE : la carte ne « passe » plus. Verdict en trois
 * états (2026-11-08) : vert seulement si la carte est ÉMISE ; ambre
 * « CARTE NON ÉMISE » si le compte est en règle sans carte émise.
 * SUPER ADMIN UNIQUEMENT (verrouillage 2026-11-08, décision du
 * fondateur : le sous-admin n'en a pas besoin) : entrée de menu
 * superSeul, gardes ERR_SUPER_ADMIN_REQUIS chez les fournisseurs,
 * et refus propre ci-dessous en accès direct par un Admin (même
 * patron que la page Suppressions).
 *
 * LISTE + RECHERCHE (2026-11-08, demande du fondateur : « on
 * sélectionne celui que admin veut voir ») : sous la saisie directe,
 * la liste de TOUS les membres plateforme (fournisseur Équipe,
 * aucun client) avec recherche par nom ou Display ID ; un clic
 * charge la fiche de vérification du membre — même fonction, même
 * verdict, aucun appel divergent.
 */
export default function PageVerifierEmploye() {
  const t = useTranslations("packEmploye");
  const td = useTranslations("dossierEmploye");
  const t15 = useTranslations("v15");
  const locale = useLocale();
  const [profil, setProfil] = useState<Profil | null>(null);
  const [charge, setCharge] = useState(false);
  const [saisie, setSaisie] = useState("");
  const [resultat, setResultat] = useState<VerificationEmploye | null>(null);
  const [cherche, setCherche] = useState(false);
  const [introuvable, setIntrouvable] = useState(false);
  const [erreur, setErreur] = useState(false);
  const [membres, setMembres] = useState<MembreEquipe[]>([]);
  const [recherche, setRecherche] = useState("");

  useEffect(() => {
    let actif = true;
    const provider = getDataProvider();
    provider
      .getProfil()
      .then((moi) => {
        if (actif) setProfil(moi);
      })
      .catch(() => undefined)
      .finally(() => {
        if (actif) setCharge(true);
      });
    provider
      .listerEquipeAdmins()
      .then((liste) => {
        if (actif) setMembres(liste);
      })
      .catch(() => {
        if (actif) setMembres([]);
      });
    return () => {
      actif = false;
    };
  }, []);

  async function lancerVerification(id: string) {
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

  async function verifier(e: React.FormEvent) {
    e.preventDefault();
    const id = saisie.trim();
    if (!id) return;
    await lancerVerification(id);
  }

  function selectionner(membre: MembreEquipe) {
    if (!membre.display_id || cherche) return;
    setSaisie(membre.display_id);
    void lancerVerification(membre.display_id);
  }

  const membresAffiches = filtrerMembresEmployes(membres, recherche);

  const ligne = (libelle: string, valeur: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="font-semibold text-slate-500">{libelle}</span>
      <span className="text-right font-semibold text-navy">{valeur}</span>
    </div>
  );

  // Verrouillage 2026-11-08 : accès direct par un Admin → refus
  // propre (même patron que la page Suppressions).
  if (charge && profil && profil.role !== "super_admin") {
    return (
      <div className="mx-auto w-full max-w-2xl">
        {/* Bandeau de titre marine « Marine & Or » (2026-11-08). */}
        <BandeauPage>
          <h1 className="text-xl font-bold text-white">{t("verifyTitle")}</h1>
        </BandeauPage>
        <p
          role="alert"
          className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700"
        >
          {t15("superOnly")}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl xl:max-w-6xl">
      {/* Bandeau de titre marine « Marine & Or » (2026-11-08). */}
      <BandeauPage>
        <h1 className="text-xl font-bold text-white">{t("verifyTitle")}</h1>
        <p className="mt-1 text-sm text-slate-300">{t("verifySubtitle")}</p>
      </BandeauPage>

      {/* Bureau large (xl) : recherche + liste des employés à
          gauche, fiche de vérification à droite. En dessous de xl,
          pile verticale d'origine, ordre inchangé. */}
      <div className="xl:grid xl:grid-cols-2 xl:items-start xl:gap-5">
      <div className="min-w-0">
      <form
        onSubmit={verifier}
        className="mt-5 flex gap-2 rounded-2xl border border-gold/40 bg-white p-4 shadow-sm"
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

      {/* Liste sélectionnable des employés (2026-11-08) : tous les
          membres plateforme, recherche par nom ou Display ID ; un
          clic charge la fiche de vérification du membre. */}
      <section className="mt-5 rounded-2xl border border-gold/40 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          <TuileIcone nom="verifyEmployee" />{t("verifyListTitle")}
        </h2>
        <p className="mt-1 text-sm text-slate-600">{t("verifyListHint")}</p>
        <input
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
          placeholder={t("verifySearchPlaceholder")}
          className="mt-3 w-full min-w-0 rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
          autoComplete="off"
        />
        {membresAffiches.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100">
            {membresAffiches.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={!m.display_id || cherche}
                  onClick={() => selectionner(m)}
                  className="flex w-full items-center gap-3 py-2.5 text-left disabled:opacity-60"
                >
                  {m.photo_profil_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.photo_profil_url}
                      alt={m.nom}
                      className="h-11 w-11 shrink-0 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy text-base font-bold text-gold">
                      {(m.nom || "?").trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-navy">
                      {m.nom}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {m.role === "super_admin" ? "Super Admin" : "Admin"}
                      {m.display_id ? (
                        <>
                          {" · "}
                          <span className="whitespace-nowrap font-bold text-gold-dark">
                            {m.display_id}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      m.carte_employe_emise
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {m.carte_employe_emise
                      ? t("teamCardIssued")
                      : t("teamCardNotIssued")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-600">{t("verifyListEmpty")}</p>
        )}
      </section>

      </div>

      <div className="mt-4 space-y-4 xl:mt-5 xl:space-y-5 min-w-0">
      {introuvable ? (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          {t("verifyNotFound")}
        </p>
      ) : null}
      {erreur ? (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {t("errorGeneric")}
        </p>
      ) : null}

      {resultat ? (
        <div className="overflow-hidden rounded-2xl border border-gold/40 bg-white shadow-sm">
          <div
            className={`px-5 py-3 text-center text-sm font-bold tracking-wide ${
              resultat.verdict === "valide"
                ? "bg-emerald-600 text-white"
                : resultat.verdict === "carte_non_emise"
                  ? "bg-amber-400 text-navy"
                  : "bg-red-700 text-white"
            }`}
          >
            {resultat.verdict === "valide"
              ? t("verifyValid")
              : resultat.verdict === "carte_non_emise"
                ? t("verifyCardNotIssued")
                : t("verifyInvalid")}
            {resultat.verdict === "carte_non_emise" ? (
              <p className="mt-0.5 text-xs font-semibold normal-case tracking-normal">
                {t("verifyCardNotIssuedHint")}
              </p>
            ) : null}
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
      </div>
    </div>
  );
}

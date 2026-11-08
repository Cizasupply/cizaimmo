"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type {
  PackEmploye,
  ParametresContratEmploye,
  VoieContratEmploye,
} from "@/lib/data";
import { formatDate } from "@/lib/format";

function messageErreur(t: (cle: string) => string, e: unknown): string {
  const code = e instanceof Error ? e.message : "";
  if (code === "ERR_PARAMETRES_CONTRAT") return t("errorParams");
  if (code === "ERR_STATUT_INVALIDE") return t("errorStatus");
  if (code === "ERR_MOTIF_REQUIS") return t("reviewMotifLabel");
  return t("errorGeneric");
}

/** Télécharge un PDF encodé en base64 (contrat généré / signé). */
export function telechargerBase64Pdf(base64: string, nom: string) {
  const octets = atob(base64);
  const tableau = new Uint8Array(octets.length);
  for (let i = 0; i < octets.length; i++) tableau[i] = octets.charCodeAt(i);
  const url = URL.createObjectURL(
    new Blob([tableau], { type: "application/pdf" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = nom;
  a.click();
  URL.revokeObjectURL(url);
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/30";
const labelCls = "text-xs font-semibold text-slate-600";

/**
 * Panneau « Pack employé » du détail d'un membre dans la page Équipe
 * (Super Admin, 2026-11-08) : état charte / contrat / carte, formulaire
 * de PRÉPARATION du contrat d'engagement à deux voies (champs employeur
 * stockés en base, PDF généré et envoyé à l'employé), et revue du
 * contrat signé déposé (Valider / Refuser à motif obligatoire).
 */
export default function PackEmployeAdmin({
  adminId,
  onChanged,
}: {
  adminId: string;
  onChanged?: () => void;
}) {
  const t = useTranslations("packEmploye");
  const locale = useLocale();
  const [pack, setPack] = useState<PackEmploye | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [motif, setMotif] = useState("");
  // Formulaire de préparation (champs employeur).
  const [voie, setVoie] = useState<VoieContratEmploye>("travail");
  const [type, setType] = useState("CDI");
  const [duree, setDuree] = useState("");
  const [montant, setMontant] = useState("");
  const [devise, setDevise] = useState("BIF");
  const [modalites, setModalites] = useState("");
  const [lieu, setLieu] = useState("");
  const [horaires, setHoraires] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [periodeEssai, setPeriodeEssai] = useState("");

  const charger = useCallback(async () => {
    try {
      const p = await getDataProvider().getPackEmploye(adminId);
      setPack(p);
      if (p.contrat_parametres) {
        const par = p.contrat_parametres;
        setVoie(par.voie);
        setType(par.type);
        setDuree(par.duree ?? "");
        setMontant(par.montant != null ? String(par.montant) : "");
        setDevise(par.devise);
        setModalites(par.modalites_paiement);
        setLieu(par.lieu);
        setHoraires(par.horaires);
        setDateDebut(par.date_debut);
        setPeriodeEssai(par.periode_essai ?? "");
      }
    } catch {
      setPack(null);
    }
  }, [adminId]);

  useEffect(() => {
    void charger();
  }, [charger]);

  if (!pack) return null;

  const statut = pack.contrat_statut;
  const preparable =
    statut === "sans_objet" || statut === "a_signer" || statut === "refuse";

  async function preparer() {
    const parametres: ParametresContratEmploye = {
      voie,
      type,
      duree: duree.trim() || null,
      montant: montant.trim() ? Number(montant) : null,
      devise: devise.trim(),
      modalites_paiement: modalites.trim(),
      lieu: lieu.trim(),
      horaires: horaires.trim(),
      date_debut: dateDebut,
      periode_essai: voie === "travail" ? periodeEssai.trim() || null : null,
    };
    setOccupe(true);
    setErreur(null);
    setMessage(null);
    try {
      const p = await getDataProvider().preparerContratEmploye(
        adminId,
        parametres
      );
      setPack(p);
      setMessage(t("prepareDoneMsg"));
      onChanged?.();
    } catch (e) {
      setErreur(messageErreur(t, e));
    } finally {
      setOccupe(false);
    }
  }

  async function telechargerGenere() {
    setOccupe(true);
    try {
      const res = await getDataProvider().genererContratEmploye(adminId);
      telechargerBase64Pdf(res.contenuBase64, res.nomFichier);
    } catch {
      setErreur(t("errorGeneric"));
    } finally {
      setOccupe(false);
    }
  }

  async function ouvrirSigne() {
    if (!pack?.contrat_document) return;
    setOccupe(true);
    try {
      const res = await getDataProvider().telechargerDocument(
        pack.contrat_document.id
      );
      window.open(res.url, "_blank", "noopener");
    } catch {
      setErreur(t("errorGeneric"));
    } finally {
      setOccupe(false);
    }
  }

  async function decider(valider: boolean) {
    setOccupe(true);
    setErreur(null);
    setMessage(null);
    try {
      if (valider) {
        await getDataProvider().validerContratEmploye(adminId);
      } else {
        await getDataProvider().refuserContratEmploye(adminId, motif);
      }
      const p = await getDataProvider().getPackEmploye(adminId);
      setPack(p);
      setMessage(valider ? t("reviewValidatedMsg") : t("reviewRefusedMsg"));
      setMotif("");
      onChanged?.();
    } catch (e) {
      setErreur(messageErreur(t, e));
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-gold/40 bg-cream/60 p-4">
      <p className="text-sm font-bold text-navy">
        {t("contratSectionTitle")} · {t("charteSectionTitle")} ·{" "}
        {t("carteSectionTitle")}
      </p>
      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
          {t("teamCharterLabel")} :{" "}
          {pack.charte_acceptee_le
            ? t("charteAcceptedOn", {
                date: formatDate(pack.charte_acceptee_le, locale),
              })
            : t("chartePending")}
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
          {t("teamContractLabel")} :{" "}
          {t(`contratStatus.${statut}` as "contratStatus.valide")}
          {pack.contrat_parametres
            ? ` — ${t(`contratWay.${pack.contrat_parametres.voie}` as "contratWay.travail")}`
            : ""}
        </span>
        <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
          {t("teamCardLabel")} :{" "}
          {pack.carte_emise ? t("teamCardIssued") : t("teamCardNotIssued")}
        </span>
      </div>
      {statut === "refuse" && pack.contrat_motif ? (
        <p className="mt-2 text-xs font-semibold text-red-700">
          {t("contratMotif", { motif: pack.contrat_motif })}
        </p>
      ) : null}
      {pack.contrat_prepare_le ? (
        <p className="mt-1 text-xs text-slate-500">
          {t("contratPreparedOn", {
            date: formatDate(pack.contrat_prepare_le, locale),
          })}
        </p>
      ) : null}
      {message ? (
        <p className="mt-2 text-sm font-semibold text-emerald-700">{message}</p>
      ) : null}
      {erreur ? (
        <p className="mt-2 text-sm font-semibold text-red-700">{erreur}</p>
      ) : null}

      {statut === "signe_depose" ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-sm font-bold text-navy">{t("reviewTitle")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {pack.contrat_document ? (
              <button
                type="button"
                onClick={ouvrirSigne}
                disabled={occupe}
                className="rounded-lg bg-navy px-3 py-2 text-xs font-bold text-cream disabled:opacity-50"
              >
                {t("reviewOpenSigned")} — {pack.contrat_document.nom_fichier}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => decider(true)}
              disabled={occupe}
              className="rounded-lg bg-gold px-3 py-2 text-xs font-bold text-navy disabled:opacity-50"
            >
              {t("reviewValidate")}
            </button>
          </div>
          <label className={`mt-3 block ${labelCls}`}>
            {t("reviewMotifLabel")}
            <input
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              className={`${inputCls} mt-1`}
            />
          </label>
          <button
            type="button"
            onClick={() => decider(false)}
            disabled={occupe || !motif.trim()}
            className="mt-2 rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {t("reviewRefuse")}
          </button>
        </div>
      ) : null}

      {statut !== "sans_objet" ? (
        <button
          type="button"
          onClick={telechargerGenere}
          disabled={occupe}
          className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-navy ring-1 ring-slate-300 disabled:opacity-50"
        >
          {t("downloadGenerated")}
        </button>
      ) : null}

      {preparable ? (
        <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-sm font-bold text-navy">{t("prepareTitle")}</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <label className={`block sm:col-span-2 ${labelCls}`}>
              {t("prepareWay")}
              <select
                value={voie}
                onChange={(e) => {
                  const v = e.target.value as VoieContratEmploye;
                  setVoie(v);
                  setType(v === "travail" ? "CDI" : "PRESTA_INDET");
                  if (v === "travail") setDevise("BIF");
                }}
                className={`${inputCls} mt-1`}
              >
                <option value="travail">{t("prepareWayWork")}</option>
                <option value="prestation">{t("prepareWayService")}</option>
              </select>
            </label>
            <label className={labelCls}>
              {t("prepareType")}
              {voie === "travail" ? (
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={`${inputCls} mt-1`}
                >
                  <option value="CDI">{t("prepareTypeWorkIndefinite")}</option>
                  <option value="CDD">{t("prepareTypeWorkFixed")}</option>
                </select>
              ) : (
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={`${inputCls} mt-1`}
                >
                  <option value="PRESTA_INDET">
                    {t("prepareTypeWorkIndefinite")}
                  </option>
                  <option value="PRESTA_DET">
                    {t("prepareTypeWorkFixed")}
                  </option>
                </select>
              )}
            </label>
            <label className={labelCls}>
              {t("prepareDuration")}
              <input
                value={duree}
                onChange={(e) => setDuree(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className={labelCls}>
              {t("prepareAmount")}
              <input
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                inputMode="numeric"
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className={labelCls}>
              {t("prepareCurrency")}
              <input
                value={devise}
                onChange={(e) => setDevise(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className={`block sm:col-span-2 ${labelCls}`}>
              {t("preparePayment")}
              <input
                value={modalites}
                onChange={(e) => setModalites(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className={labelCls}>
              {t("preparePlace")}
              <input
                value={lieu}
                onChange={(e) => setLieu(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className={labelCls}>
              {t("prepareHours")}
              <input
                value={horaires}
                onChange={(e) => setHoraires(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
            <label className={labelCls}>
              {t("prepareStart")}
              <input
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                className={`${inputCls} mt-1`}
              />
            </label>
            {voie === "travail" ? (
              <label className={labelCls}>
                {t("prepareTrial")}
                <input
                  value={periodeEssai}
                  onChange={(e) => setPeriodeEssai(e.target.value)}
                  className={`${inputCls} mt-1`}
                />
              </label>
            ) : null}
          </div>
          <button
            type="button"
            onClick={preparer}
            disabled={occupe}
            className="mt-3 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-navy disabled:opacity-50"
          >
            {t("prepareButton")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

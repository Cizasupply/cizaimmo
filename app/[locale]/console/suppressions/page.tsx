"use client";

/**
 * Console — Suppressions en attente (v1.5, Super Admin uniquement) :
 * demandes de suppression déposées par les clients. Le bouton
 * « Exécuter » reste DÉSACTIVÉ tant que l'échéance (demande + 30 j)
 * n'est pas atteinte — et la base refuse de toute façon avant.
 */

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import ConfirmDialog from "@/components/ConfirmDialog";
import { erreurV15 } from "@/components/FilMessages";
import { getDataProvider } from "@/lib/data";
import type { Profil } from "@/lib/data";
import type { SuppressionEnAttente } from "@/lib/data/types";
import { formatDate } from "@/lib/format";

export default function ConsoleSuppressionsPage() {
  const t = useTranslations("v15");
  const tc = useTranslations("console");
  const tcom = useTranslations("common");
  const locale = useLocale();
  const [profil, setProfil] = useState<Profil | null>(null);
  const [liste, setListe] = useState<SuppressionEnAttente[]>([]);
  const [chargement, setChargement] = useState(true);
  const [aConfirmer, setAConfirmer] = useState<SuppressionEnAttente | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const recharger = useCallback(async () => {
    const provider = getDataProvider();
    const [moi, demandes] = await Promise.all([
      provider.getProfil(),
      provider.listerSuppressionsEnAttente().catch(() => [] as SuppressionEnAttente[]),
    ]);
    setProfil(moi);
    setListe(demandes);
  }, []);

  useEffect(() => {
    recharger()
      .catch((e) => setErreur(erreurV15(t as (k: string) => string, e)))
      .finally(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recharger]);

  async function executer() {
    if (!aConfirmer) return;
    const cible = aConfirmer;
    setAConfirmer(null);
    setMessage(null);
    setErreur(null);
    try {
      await getDataProvider().executerSuppressionCompte(cible.compte_id);
      setMessage(t("deletionExecutedMsg"));
      await recharger();
    } catch (e) {
      setErreur(erreurV15(t as (k: string) => string, e));
    }
  }

  if (!chargement && profil && profil.role !== "super_admin") {
    return (
      <div>
        <h1 className="text-2xl font-bold text-navy md:text-3xl">{t("deletionsTitle")}</h1>
        <p role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">
          {t("superOnly")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy md:text-3xl">{t("deletionsTitle")}</h1>
      <p className="mt-1 text-sm text-slate-600">{t("deletionsSubtitle")}</p>

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

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">{t("colName")}</th>
              <th className="px-4 py-3">{t("colDisplayId")}</th>
              <th className="px-4 py-3">{t("colEmail")}</th>
              <th className="px-4 py-3">{t("colRequested")}</th>
              <th className="px-4 py-3">{t("colDeadline")}</th>
              <th className="px-4 py-3">{tc("colAction")}</th>
            </tr>
          </thead>
          <tbody>
            {liste.map((s) => (
              <tr key={s.compte_id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-semibold text-navy">{s.nom}</td>
                <td className="px-4 py-3 font-bold tracking-wide text-navy">
                  {s.display_id ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{s.email}</td>
                <td className="px-4 py-3 text-slate-600">
                  {formatDate(s.suppression_demandee_le, locale)}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {formatDate(s.echeance_le, locale)}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={!s.executable}
                    onClick={() => setAConfirmer(s)}
                    className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    {t("executeDeletion")}
                  </button>
                  {!s.executable ? (
                    <span className="mt-1 block text-xs text-slate-500">
                      {t("notYetExecutable", { date: formatDate(s.echeance_le, locale) })}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!chargement && liste.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">{t("deletionsEmpty")}</p>
        ) : null}
        {chargement ? (
          <p className="p-6 text-sm text-slate-500">{tc("loading")}</p>
        ) : null}
      </div>

      {aConfirmer ? (
        <ConfirmDialog
          title={t("executeConfirmTitle")}
          text={t("executeConfirmText")}
          confirmLabel={t("executeDeletion")}
          cancelLabel={tcom("cancel")}
          onConfirm={executer}
          onCancel={() => setAConfirmer(null)}
        />
      ) : null}
    </div>
  );
}

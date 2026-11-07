"use client";

/**
 * Console — Journal d'audit (extension v1.2) : lecture seule. Qui a
 * fait quoi, quand, sur quel compte : connexions plateforme impossibles
 * à effacer (la table est append-only côté base).
 */

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type { EntreeAudit } from "@/lib/data";
import { formatDate } from "@/lib/format";

export default function ConsoleJournalPage() {
  const t = useTranslations("console");
  const locale = useLocale();
  const [entrees, setEntrees] = useState<EntreeAudit[]>([]);
  const [charge, setCharge] = useState(false);

  useEffect(() => {
    let actif = true;
    getDataProvider()
      .listerJournalAudit()
      .then((liste) => {
        if (actif) setEntrees(liste);
      })
      .catch(() => undefined)
      .finally(() => {
        if (actif) setCharge(true);
      });
    return () => {
      actif = false;
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy md:text-3xl">{t("journalTitle")}</h1>
      <p className="mt-1 text-sm text-slate-600">{t("journalSubtitle")}</p>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">{t("colDate")}</th>
              <th className="px-4 py-3">{t("colActor")}</th>
              <th className="px-4 py-3">{t("colAction")}</th>
              <th className="px-4 py-3">{t("colTarget")}</th>
              <th className="px-4 py-3">{t("colDetails")}</th>
            </tr>
          </thead>
          <tbody>
            {entrees.map((e) => (
              <tr key={e.id} className="border-b border-slate-100 last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                  {formatDate(e.created_at, locale)}
                </td>
                <td className="px-4 py-3">
                  <span className="block font-semibold text-navy">{e.acteur_email}</span>
                  <span className="text-xs text-slate-400">
                    {e.acteur_role === "super_admin" ? t("roleSuperAdmin") : t("roleAdmin")}
                  </span>
                </td>
                <td className="px-4 py-3 font-semibold text-navy">
                  {t(`audit.${e.action}` as "audit.compte_approuve")}
                </td>
                <td className="px-4 py-3 text-slate-600">{e.cible_email ?? e.cible_id ?? "—"}</td>
                <td className="max-w-[260px] truncate px-4 py-3 text-xs text-slate-500">
                  {e.details && Object.keys(e.details).length > 0
                    ? Object.entries(e.details)
                        .map(([k, v]) => `${k}: ${String(v)}`)
                        .join(" · ")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!charge ? (
          <p className="p-6 text-sm text-slate-500">{t("loading")}</p>
        ) : entrees.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">{t("noActivity")}</p>
        ) : null}
      </div>
    </div>
  );
}

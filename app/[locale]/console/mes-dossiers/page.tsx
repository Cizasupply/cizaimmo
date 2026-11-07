"use client";

/**
 * Console — « Mes dossiers » (v1.5, Admin employé) : les dossiers
 * clients dont l'Admin connecté est le responsable (assignation
 * Super Admin). Bloc « Actions en attente » calculé sur CES dossiers
 * + fils plateforme assignés avec messages non lus.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { erreurV15 } from "@/components/FilMessages";
import { getDataProvider } from "@/lib/data";
import type { ComptePlateforme, Profil } from "@/lib/data";
import type { Conversation } from "@/lib/data/types";
import { formatDate } from "@/lib/format";

function suppressionEchue(c: ComptePlateforme): boolean {
  if (!c.suppression_demandee_le) return false;
  return (
    new Date(c.suppression_demandee_le).getTime() + 30 * 24 * 60 * 60 * 1000 <=
    Date.now()
  );
}

export default function ConsoleMesDossiersPage() {
  const t = useTranslations("v15");
  const tc = useTranslations("console");
  const locale = useLocale();
  const [profil, setProfil] = useState<Profil | null>(null);
  const [dossiers, setDossiers] = useState<ComptePlateforme[]>([]);
  const [filsNonLus, setFilsNonLus] = useState<Conversation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const provider = getDataProvider();
      const [moi, mes, conversations] = await Promise.all([
        provider.getProfil(),
        provider.listerMesDossiers(),
        provider.listerConversations().catch(() => [] as Conversation[]),
      ]);
      setProfil(moi);
      setDossiers(mes);
      setFilsNonLus(
        conversations.filter(
          (c) =>
            c.type === "plateforme" &&
            moi !== null &&
            c.admin_responsable_id === moi.id &&
            (c.non_lus ?? 0) > 0
        )
      );
    })()
      .catch((e) => setErreur(erreurV15(t as (k: string) => string, e)))
      .finally(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approbations = dossiers.filter((c) => c.abonnement?.statut === "en_attente");
  const contrats = dossiers.filter((c) => c.statut_contrat === "signe_recu");
  const suppressions = dossiers.filter(suppressionEchue);

  const actions: { label: string; valeur: number; couleur: string }[] = [
    { label: t("pendingApprovals"), valeur: approbations.length, couleur: "text-amber-600" },
    { label: t("pendingContracts"), valeur: contrats.length, couleur: "text-amber-600" },
    { label: t("expiredDeletions"), valeur: suppressions.length, couleur: "text-red-600" },
    { label: t("unreadThreads"), valeur: filsNonLus.length, couleur: "text-navy" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy md:text-3xl">{t("myFilesTitle")}</h1>
      <p className="mt-1 text-sm text-slate-600">{t("myFilesSubtitle")}</p>

      {erreur ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {erreur}
        </p>
      ) : null}

      {/* Actions en attente — calculées sur MES dossiers uniquement. */}
      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          {t("pendingActions")}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {actions.map((a) => (
            <div key={a.label} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {a.label}
              </p>
              <p className={`mt-1 text-2xl font-bold ${a.couleur}`}>{a.valeur}</p>
            </div>
          ))}
        </div>
      </section>

      {filsNonLus.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold text-navy">{t("unreadThreads")}</h2>
          <ul className="mt-3 space-y-2">
            {filsNonLus.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3"
              >
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-semibold text-navy">
                    {c.proprietaire_nom ?? c.proprietaire_email ?? "—"}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {c.dernier_message ?? ""}{" "}
                    {c.dernier_message_le
                      ? `· ${formatDate(c.dernier_message_le, locale)}`
                      : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">
                    {t("unread", { count: String(c.non_lus ?? 0) })}
                  </span>
                  <Link
                    href={`/${locale}/console/comptes/${c.proprietaire_id}`}
                    className="rounded-full border border-navy px-4 py-1.5 text-sm font-bold text-navy hover:bg-navy hover:text-white"
                  >
                    📁 {t("openFile")}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Mes dossiers assignés. */}
      <div className="mt-6 space-y-4">
        {chargement ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            {tc("loading")}
          </p>
        ) : dossiers.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            {t("myFilesEmpty")}
          </p>
        ) : (
          dossiers.map((c) => (
            <article
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="min-w-0">
                <h2 className="truncate font-bold text-navy">{c.nom}</h2>
                <p className="truncate text-sm text-slate-500">
                  {c.email}
                  {c.display_id ? (
                    <>
                      {" · "}
                      <strong className="font-bold tracking-wide text-navy">
                        {c.display_id}
                      </strong>
                    </>
                  ) : null}
                  {" · "}
                  {formatDate(c.created_at, locale)}
                </p>
                <p className="mt-1 flex flex-wrap gap-2">
                  {c.abonnement ? (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                      {tc(`status.${c.abonnement.statut}` as "status.actif")}
                    </span>
                  ) : null}
                  {c.abonnement?.statut === "en_attente" ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                      {t("pendingApprovals")}
                    </span>
                  ) : null}
                  {c.statut_contrat === "signe_recu" ? (
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-bold text-sky-800">
                      {tc("badgeContractToValidate")}
                    </span>
                  ) : null}
                  {suppressionEchue(c) ? (
                    <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">
                      {t("expiredDeletions")}
                    </span>
                  ) : c.suppression_demandee_le ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                      {t("deletionScheduled", {
                        date: formatDate(
                          new Date(
                            new Date(c.suppression_demandee_le).getTime() +
                              30 * 24 * 60 * 60 * 1000
                          ).toISOString(),
                          locale
                        ),
                      })}
                    </span>
                  ) : null}
                </p>
              </div>
              <Link
                href={`/${locale}/console/comptes/${c.id}`}
                className="rounded-full border border-navy px-4 py-2 text-sm font-bold text-navy hover:bg-navy hover:text-white"
              >
                📁 {t("openFile")}
              </Link>
            </article>
          ))
        )}
      </div>
      {profil?.role === "super_admin" ? (
        <p className="mt-4 text-xs text-slate-400">{t("myFilesSubtitle")}</p>
      ) : null}
    </div>
  );
}

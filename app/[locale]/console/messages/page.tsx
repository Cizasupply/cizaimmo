"use client";

/**
 * Console — Boîte de réception plateforme (2026-11-07, demande du
 * fondateur après un message cliente passé inaperçu dans un dossier
 * NON assigné) : TOUS les fils « plateforme », assignés ou non —
 * l'assignation est une responsabilité, pas une restriction
 * d'accès. Tri : dernier message décroissant. Un clic ouvre le
 * Dossier du client, ancré sur son fil (section #messages), où la
 * plateforme peut répondre ; l'ouverture marque le fil comme lu.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { erreurV15 } from "@/components/FilMessages";
import { getDataProvider } from "@/lib/data";
import type { Conversation } from "@/lib/data/types";
import { formatDateTime } from "@/lib/format";

export default function ConsoleMessagesPage() {
  const t = useTranslations("console");
  const t15 = useTranslations("v15");
  const locale = useLocale();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    getDataProvider()
      .listerConversationsPlateforme()
      .then(setConversations)
      .catch((e) => setErreur(erreurV15(t15 as (k: string) => string, e)))
      .finally(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalNonLus = conversations.reduce(
    (somme, c) => somme + (c.non_lus ?? 0),
    0
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy md:text-3xl">
        {t("messagesTitle")}
        {totalNonLus > 0 ? (
          <span className="ml-3 align-middle rounded-full bg-gold px-2.5 py-1 text-sm font-bold text-navy-dark">
            {totalNonLus}
          </span>
        ) : null}
      </h1>
      <p className="mt-1 text-sm text-slate-600">{t("messagesSubtitle")}</p>

      {erreur ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {erreur}
        </p>
      ) : null}

      <div className="mt-6 space-y-3">
        {chargement ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            {t("loading")}
          </p>
        ) : conversations.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            {t("messagesEmpty")}
          </p>
        ) : (
          conversations.map((c) => (
            <Link
              key={c.id}
              href={`/${locale}/console/comptes/${c.proprietaire_id}#messages`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 hover:border-gold"
            >
              <span className="min-w-0">
                <span className="block truncate font-bold text-navy">
                  {c.proprietaire_nom ?? c.proprietaire_email ?? "—"}
                  {c.proprietaire_display_id ? (
                    <strong className="ml-2 text-sm font-bold tracking-wide text-navy">
                      {c.proprietaire_display_id}
                    </strong>
                  ) : null}
                </span>
                <span className="block truncate text-sm text-slate-500">
                  {c.proprietaire_email ?? ""}
                </span>
                <span className="mt-1 block truncate text-sm text-slate-600">
                  {c.dernier_message ?? t15("noMessages")}
                  {c.dernier_message_le
                    ? ` · ${formatDateTime(c.dernier_message_le, locale)}`
                    : ""}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {t15("responsible")} :{" "}
                  {c.admin_responsable_nom ?? (
                    <strong className="font-bold text-amber-700">
                      {t15("unassigned")}
                    </strong>
                  )}
                </span>
              </span>
              {(c.non_lus ?? 0) > 0 ? (
                <span className="shrink-0 rounded-full bg-gold px-2.5 py-1 text-xs font-bold text-navy-dark">
                  {t15("unread", { count: String(c.non_lus ?? 0) })}
                </span>
              ) : null}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

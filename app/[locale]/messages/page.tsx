"use client";

/**
 * Messages (v1.5) — messagerie directe du client : fil plateforme
 * (client ↔ équipe CizaImmo, routé vers l'Admin responsable) et fils
 * des rattachements ACTIFS (propriétaire ↔ gestionnaire, participants
 * seuls). Ouverture d'un fil = messages + marquerLu (dans FilMessages).
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import AppShell from "@/components/AppShell";
import FilMessages, { erreurV15 } from "@/components/FilMessages";
import { getDataProvider } from "@/lib/data";
import type { Conversation } from "@/lib/data/types";
import { formatDate } from "@/lib/format";
import { useLocale } from "next-intl";

export default function MessagesPage() {
  const t = useTranslations("v15");
  const tp = useTranslations("pages");
  const locale = useLocale();
  const [plateforme, setPlateforme] = useState<Conversation | null>(null);
  const [filsRattachement, setFilsRattachement] = useState<Conversation[]>([]);
  const [selection, setSelection] = useState<Conversation | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const provider = getDataProvider();
    const [convPlateforme, toutes] = await Promise.all([
      provider.getConversationPlateforme(),
      provider.listerConversations(),
    ]);
    setPlateforme(convPlateforme);
    setFilsRattachement(toutes.filter((c) => c.type === "rattachement"));
    setSelection((actuelle) => actuelle ?? convPlateforme);
  }, []);

  useEffect(() => {
    charger()
      .catch((e) => setErreur(erreurV15(t as (k: string) => string, e)))
      .finally(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charger]);

  function libelleFil(c: Conversation): string {
    if (c.type === "plateforme") return t("platformThread");
    const noms = [c.proprietaire_nom, c.gestionnaire_nom].filter(Boolean);
    return noms.length > 0 ? noms.join(" ↔ ") : t("discussion");
  }

  const fils: Conversation[] = [
    ...(plateforme ? [plateforme] : []),
    ...filsRattachement.filter((c) => c.id !== plateforme?.id),
  ];

  return (
    <AppShell title={tp("messages.title")}>
      {erreur ? (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {erreur}
        </p>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Liste des fils */}
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            {t("messagesTitle")}
          </h2>
          {chargement ? (
            <p className="px-2 py-4 text-sm text-slate-500">{t("noConversations")}</p>
          ) : fils.length === 0 ? (
            <p className="px-2 py-4 text-sm text-slate-500">{t("noConversations")}</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {fils.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelection(c)}
                    className={`w-full rounded-xl px-3 py-3 text-left ${
                      selection?.id === c.id ? "bg-navy text-white" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-bold">
                        {libelleFil(c)}
                      </span>
                      {c.non_lus && c.non_lus > 0 ? (
                        <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                          {t("unread", { count: String(c.non_lus) })}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={`mt-0.5 block truncate text-xs ${
                        selection?.id === c.id ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {c.type === "plateforme"
                        ? t("platformThreadDesc")
                        : (c.dernier_message ?? t("noMessages"))}
                      {c.dernier_message_le
                        ? ` · ${formatDate(c.dernier_message_le, locale)}`
                        : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {filsRattachement.length === 0 && !chargement ? (
            <p className="px-2 pb-2 pt-3 text-xs text-slate-400">
              {t("noAttachmentThreads")}
            </p>
          ) : null}
        </section>

        {/* Fil sélectionné */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          {selection ? (
            <>
              <h2 className="text-lg font-bold text-navy">{libelleFil(selection)}</h2>
              <p className="mb-4 mt-1 text-sm text-slate-500">
                {selection.type === "plateforme"
                  ? t("platformThreadDesc")
                  : `${t("ownerLabel")} ↔ ${t("managerLabel")}`}
              </p>
              <FilMessages key={selection.id} conversationId={selection.id} />
            </>
          ) : (
            <p className="text-sm text-slate-500">{t("noConversations")}</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}

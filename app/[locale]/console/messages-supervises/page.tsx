"use client";

/**
 * Console — Messages supervisés (v1.5) : fils propriétaire ↔
 * gestionnaire des rattachements actifs. Ouverture d'un fil =
 * journaliserConsultationMessages PUIS listerMessages (via
 * FilMessages) ; affichage LECTURE SEULE, sans zone de saisie.
 */

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import FilMessages, { erreurV15 } from "@/components/FilMessages";
import { getDataProvider } from "@/lib/data";
import type { Conversation } from "@/lib/data/types";
import { formatDate } from "@/lib/format";

export default function ConsoleMessagesSupervisesPage() {
  const t = useTranslations("v15");
  const tc = useTranslations("console");
  const locale = useLocale();
  const [fils, setFils] = useState<Conversation[]>([]);
  const [selection, setSelection] = useState<Conversation | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    getDataProvider()
      .listerConversationsSupervisees()
      .then(setFils)
      .catch((e) => setErreur(erreurV15(t as (k: string) => string, e)))
      .finally(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ouvrir(c: Conversation) {
    setErreur(null);
    try {
      // Consultation journalisée AVANT la lecture des messages.
      await getDataProvider().journaliserConsultationMessages(c.id);
      setSelection(c);
    } catch (e) {
      setErreur(erreurV15(t as (k: string) => string, e));
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy md:text-3xl">{t("supervisedTitle")}</h1>
      <p className="mt-1 text-sm text-slate-600">{t("supervisedSubtitle")}</p>
      <p className="mt-3 inline-block rounded-full bg-slate-700 px-3 py-1 text-xs font-bold text-white">
        🔒 {t("supervisionReadOnly")}
      </p>

      {erreur ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {erreur}
        </p>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          {chargement ? (
            <p className="px-2 py-4 text-sm text-slate-500">{tc("loading")}</p>
          ) : fils.length === 0 ? (
            <p className="px-2 py-4 text-sm text-slate-500">{t("supervisedEmpty")}</p>
          ) : (
            <ul className="space-y-1">
              {fils.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => ouvrir(c)}
                    className={`w-full rounded-xl px-3 py-3 text-left ${
                      selection?.id === c.id ? "bg-navy text-white" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="block truncate text-sm font-bold">
                      {c.proprietaire_nom ?? t("ownerLabel")} ↔{" "}
                      {c.gestionnaire_nom ?? t("managerLabel")}
                    </span>
                    <span
                      className={`mt-0.5 block truncate text-xs ${
                        selection?.id === c.id ? "text-slate-300" : "text-slate-500"
                      }`}
                    >
                      {t("lastMessage")} : {c.dernier_message ?? t("noMessages")}
                      {c.dernier_message_le
                        ? ` · ${formatDate(c.dernier_message_le, locale)}`
                        : ""}
                    </span>
                    {(c.proprietaire_display_id || c.gestionnaire_display_id) ? (
                      <span
                        className={`text-xs ${
                          selection?.id === c.id ? "text-slate-300" : "text-slate-400"
                        }`}
                      >
                        {c.proprietaire_display_id ?? ""} ↔ {c.gestionnaire_display_id ?? ""}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          {selection ? (
            <>
              <h2 className="text-lg font-semibold text-navy">
                {selection.proprietaire_nom ?? t("ownerLabel")} ↔{" "}
                {selection.gestionnaire_nom ?? t("managerLabel")}
              </h2>
              <div className="mt-4">
                <FilMessages
                  key={selection.id}
                  conversationId={selection.id}
                  lectureSeule
                  marquerLuAuto={false}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500">{t("supervisedEmpty")}</p>
          )}
        </section>
      </div>
    </div>
  );
}

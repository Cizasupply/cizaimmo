"use client";

/**
 * Panneau dépliable « Discussion » d'un rattachement ACTIF (v1.5) :
 * ouvre le fil propriétaire ↔ gestionnaire (getConversationRattachement)
 * et rend le composant partagé FilMessages (participant : lecture +
 * envoi). Utilisé côté propriétaire (RattachementDisplayId) et côté
 * gestionnaire (page Contrat).
 */

import { useState } from "react";
import { useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type { Conversation } from "@/lib/data/types";
import FilMessages, { erreurV15 } from "@/components/FilMessages";

export default function DiscussionRattachement({
  rattachementId,
}: {
  rattachementId: string;
}) {
  const t = useTranslations("v15");
  const [ouvert, setOuvert] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function basculer() {
    if (ouvert) {
      setOuvert(false);
      return;
    }
    setOuvert(true);
    if (conversation) return;
    setChargement(true);
    setErreur(null);
    try {
      const conv = await getDataProvider().getConversationRattachement(rattachementId);
      setConversation(conv);
    } catch (e) {
      setErreur(erreurV15(t as (k: string) => string, e));
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={basculer}
        aria-expanded={ouvert}
        className="rounded-full border border-navy px-4 py-1.5 text-sm font-bold text-navy hover:bg-navy hover:text-white"
      >
        💬 {ouvert ? t("hideDiscussion") : t("discussion")}
      </button>
      {ouvert ? (
        <div className="mt-3">
          {chargement ? (
            <p className="text-sm text-slate-500">{t("noMessages")}</p>
          ) : erreur ? (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {erreur}
            </p>
          ) : conversation ? (
            <FilMessages conversationId={conversation.id} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

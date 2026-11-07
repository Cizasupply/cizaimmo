"use client";

/**
 * Console — Admins (Super Admin uniquement, extension v1.2) : créer,
 * promouvoir, suspendre, réactiver, retirer les comptes Admin. Le Super
 * Admin (fondateur) ne peut ni être suspendu ni retiré. En mode réel,
 * « créer » demande une inscription préalable : on PROMEUT un compte
 * existant (les comptes Auth ne se créent pas côté client).
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type { CompteAdmin } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { useLocale } from "next-intl";

export default function ConsoleAdminsPage() {
  const t = useTranslations("console");
  const locale = useLocale();
  const [admins, setAdmins] = useState<CompteAdmin[]>([]);
  const [emailPromotion, setEmailPromotion] = useState("");
  const [emailCreation, setEmailCreation] = useState("");
  const [nomCreation, setNomCreation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);

  const recharger = useCallback(async () => {
    setAdmins(await getDataProvider().listerAdmins());
  }, []);

  useEffect(() => {
    recharger().catch(() => undefined);
  }, [recharger]);

  async function agir(action: () => Promise<void>, succes: string) {
    setOccupe(true);
    setMessage(null);
    setErreur(null);
    try {
      await action();
      setMessage(succes);
      await recharger();
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      if (code === "ERR_PROMOTION_REQUISE") setErreur(t("promotionHint"));
      else if (code.startsWith("ERR_")) {
        setErreur(t(`errors.${code}` as "errors.ERR_OPERATION_INTERDITE"));
      } else setErreur(t("errors.generic"));
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy md:text-3xl">{t("adminsTitle")}</h1>
      <p className="mt-1 text-sm text-slate-600">{t("adminsSubtitle")}</p>

      {message ? (
        <p role="status" className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">{message}</p>
      ) : null}
      {erreur ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{erreur}</p>
      ) : null}

      <div className="mt-6 space-y-3">
        {admins.map((a) => (
          <article key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="min-w-0">
              <h2 className="truncate font-bold text-navy">{a.nom}</h2>
              <p className="truncate text-sm text-slate-500">{a.email}</p>
              <p className="mt-1 flex flex-wrap gap-2">
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${a.role === "super_admin" ? "bg-gold/20 text-yellow-800" : "bg-navy/10 text-navy"}`}>
                  {a.role === "super_admin" ? t("roleSuperAdmin") : t("roleAdmin")}
                </span>
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${a.statut === "actif" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                  {a.statut === "actif" ? t("adminActive") : t("adminSuspended")}
                </span>
                <span className="text-xs text-slate-400">{formatDate(a.created_at, locale)}</span>
              </p>
            </div>
            {a.role === "admin" ? (
              <div className="flex flex-wrap gap-2">
                {a.statut === "actif" ? (
                  <button
                    type="button"
                    disabled={occupe}
                    onClick={() => agir(() => getDataProvider().suspendreAdmin(a.id), t("adminSuspendedMsg"))}
                    className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {t("suspend")}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={occupe}
                    onClick={() => agir(() => getDataProvider().reactiverAdmin(a.id), t("adminReactivatedMsg"))}
                    className="rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {t("reactivate")}
                  </button>
                )}
                <button
                  type="button"
                  disabled={occupe}
                  onClick={() => agir(() => getDataProvider().retirerAdmin(a.id), t("adminRemovedMsg"))}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy disabled:opacity-50"
                >
                  {t("removeAdmin")}
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-navy">{t("promoteTitle")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("promoteText")}</p>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            agir(async () => {
              await getDataProvider().promouvoirAdmin(emailPromotion);
              setEmailPromotion("");
            }, t("adminPromotedMsg"));
          }}
        >
          <input
            type="email"
            required
            value={emailPromotion}
            onChange={(e) => setEmailPromotion(e.target.value)}
            placeholder={t("emailPlaceholder")}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="submit" disabled={occupe} className="rounded-full bg-navy px-5 py-2 text-sm font-bold text-white hover:bg-navy-light disabled:opacity-50">
            {t("promoteButton")}
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-navy">{t("createAdminTitle")}</h2>
        <p className="mt-1 text-sm text-slate-600">{t("createAdminText")}</p>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            agir(async () => {
              await getDataProvider().creerAdmin(emailCreation, nomCreation);
              setEmailCreation("");
              setNomCreation("");
            }, t("adminCreatedMsg"));
          }}
        >
          <input
            type="text"
            value={nomCreation}
            onChange={(e) => setNomCreation(e.target.value)}
            placeholder={t("namePlaceholder")}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="email"
            required
            value={emailCreation}
            onChange={(e) => setEmailCreation(e.target.value)}
            placeholder={t("emailPlaceholder")}
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button type="submit" disabled={occupe} className="rounded-full bg-navy px-5 py-2 text-sm font-bold text-white hover:bg-navy-light disabled:opacity-50">
            {t("createAdminButton")}
          </button>
        </form>
      </section>
    </div>
  );
}

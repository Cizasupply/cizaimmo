"use client";

/**
 * Modale d'assignation d'un dossier client (v1.5) — PARTAGÉE entre la
 * file de revue (console/comptes) et la page Dossier. Liste l'équipe
 * (listerEquipeAdmins : nom, rôle, charge) ; assignerDossier(compteId,
 * adminId) ou désassigner (null). Assignation = responsabilité, pas
 * une restriction d'accès. Réservée au Super Admin côté données.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type { MembreEquipe } from "@/lib/data/types";
import { erreurV15 } from "@/components/FilMessages";

export default function AssignationModale({
  compteId,
  compteNom,
  responsableActuelId,
  onFermer,
  onAssigne,
}: {
  compteId: string;
  compteNom: string;
  responsableActuelId: string | null;
  onFermer: () => void;
  onAssigne: () => void;
}) {
  const t = useTranslations("v15");
  const tc = useTranslations("console");
  const tcom = useTranslations("common");
  const [equipe, setEquipe] = useState<MembreEquipe[]>([]);
  const [chargement, setChargement] = useState(true);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    getDataProvider()
      .listerEquipeAdmins()
      .then((liste) => setEquipe(liste.filter((m) => m.role === "admin")))
      .catch((e) => setErreur(erreurV15(t as (k: string) => string, e)))
      .finally(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function choisir(adminId: string | null) {
    setOccupe(true);
    setErreur(null);
    try {
      await getDataProvider().assignerDossier(compteId, adminId);
      onAssigne();
      onFermer();
    } catch (e) {
      setErreur(erreurV15(t as (k: string) => string, e));
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("assignTitle")}
      className="fixed inset-0 z-50 flex items-end justify-center bg-navy-dark/60 p-4 sm:items-center"
      onClick={onFermer}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-navy">{t("assignTitle")}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {t("responsible")} — <strong>{compteNom}</strong>
        </p>
        {erreur ? (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {erreur}
          </p>
        ) : null}
        {chargement ? (
          <p className="mt-4 text-sm text-slate-500">{tc("loading")}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {equipe.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={occupe}
                  onClick={() => choisir(m.id)}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm disabled:opacity-50 ${
                    responsableActuelId === m.id
                      ? "border-gold bg-gold/10 font-semibold"
                      : "border-slate-200 hover:border-gold"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-semibold text-navy">{m.nom}</span>
                    <span className="block truncate text-xs text-slate-500">{m.email}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-slate-500">
                    {t("assignedFiles", { count: String(m.dossiers_assignes) })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex gap-2">
          {responsableActuelId ? (
            <button
              type="button"
              disabled={occupe}
              onClick={() => choisir(null)}
              className="flex-1 rounded-full border border-red-300 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {t("unassign")}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onFermer}
            className="flex-1 rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {tcom("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}

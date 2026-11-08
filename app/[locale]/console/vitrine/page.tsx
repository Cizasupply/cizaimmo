"use client";

/**
 * Console — Vitrine à valider (v1.6 « Vitrine vérifiée ») : file des
 * annonces « en_attente ». L'Admin compare le contact ANNONCÉ au
 * contact ATTENDU du dossier (gestionnaire rattaché actif de
 * l'immeuble, sinon le propriétaire), lit la justification quand le
 * contact diverge, puis approuve (publication + badge « ✓ Vérifié »)
 * ou refuse avec un motif PRÉDÉFINI obligatoire. La décision et ses
 * gardes vivent dans la base ; cette page ne fait qu'afficher.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type { AnnonceAValider } from "@/lib/data";
import { formatMoney } from "@/lib/format";
import { messageErreur } from "@/lib/translateError";

/**
 * Motifs de refus PRÉDÉFINIS : le libellé AFFICHÉ est traduit (v16),
 * mais la VALEUR envoyée à la base est le libellé français canonique.
 */
const MOTIFS = [
  { valeur: "Photos insuffisantes", cle: "motifPhotos" },
  { valeur: "Prix incohérent", cle: "motifPrice" },
  { valeur: "Contact non justifié", cle: "motifContact" },
  { valeur: "Informations incomplètes", cle: "motifIncomplete" },
  { valeur: "Autre", cle: "motifOther" },
] as const;

function normaliserTelephone(v: string | null | undefined): string {
  return (v ?? "").replace(/[^0-9+]/g, "");
}
function normaliserEmail(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

export default function ConsoleVitrinePage() {
  const t = useTranslations("v16");
  const tc = useTranslations("console");
  const tErr = useTranslations("crud");
  const locale = useLocale();
  const [liste, setListe] = useState<AnnonceAValider[]>([]);
  const [chargement, setChargement] = useState(true);
  const [motifs, setMotifs] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  /** Codes v1.6 connus → namespace v16 ; repli : messageErreur (crud). */
  function traduireErreur(e: unknown): string {
    const code = e instanceof Error ? e.message : "";
    if (code.startsWith("ERR_VITRINE") || code === "ERR_JUSTIFICATION_CONTACT" || code === "ERR_ACCES_PLATEFORME") {
      try {
        return t(`errors.${code}` as "errors.ERR_VITRINE_PHOTOS");
      } catch {
        // repli ci-dessous
      }
    }
    return messageErreur(tErr as unknown as (k: string) => string, e);
  }

  const recharger = useCallback(async () => {
    const demandes = await getDataProvider().listerVitrineAValider();
    setListe(demandes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    recharger()
      .catch((e) => setErreur(traduireErreur(e)))
      .finally(() => setChargement(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recharger]);

  async function approuver(annonce: AnnonceAValider) {
    setMessage(null);
    setErreur(null);
    try {
      await getDataProvider().validerPublicationVitrine(annonce.appartement.id, true);
      setMessage(t("approvedMsg"));
      await recharger();
    } catch (e) {
      setErreur(traduireErreur(e));
    }
  }

  async function refuser(annonce: AnnonceAValider) {
    const motif = motifs[annonce.appartement.id] ?? "";
    if (!motif) {
      setErreur(t("errors.ERR_VITRINE_MOTIF_REQUIS"));
      return;
    }
    setMessage(null);
    setErreur(null);
    try {
      await getDataProvider().validerPublicationVitrine(annonce.appartement.id, false, motif);
      setMessage(t("refusedMsg"));
      await recharger();
    } catch (e) {
      setErreur(traduireErreur(e));
    }
  }

  function ligneContact(
    label: string,
    valeur: string | null,
    different: boolean
  ) {
    return (
      <p className={`mt-1 break-words rounded-lg px-2 py-1 text-sm ${different ? "bg-amber-100 font-bold text-amber-900" : "text-slate-700"}`}>
        <span className="font-semibold text-slate-500">{label} : </span>
        {valeur ?? "—"}
      </p>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-navy md:text-3xl">{t("consoleTitle")}</h1>
      <p className="mt-1 text-sm text-slate-600">{t("consoleSubtitle")}</p>

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

      {chargement ? (
        <p className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{tc("loading")}</p>
      ) : liste.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="font-bold text-navy">{t("consoleEmpty")}</p>
          <p className="mt-2 text-slate-600">{t("consoleEmptyText")}</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {liste.map((annonce) => {
            const a = annonce.appartement;
            const telDifferent =
              normaliserTelephone(annonce.contact_annonce.telephone) !==
              normaliserTelephone(annonce.contact_dossier.telephone);
            const emailDifferent =
              normaliserEmail(annonce.contact_annonce.email) !==
              normaliserEmail(annonce.contact_dossier.email);
            const adresse = [annonce.immeuble_adresse, annonce.immeuble_quartier, annonce.immeuble_ville]
              .filter(Boolean)
              .join(", ");
            return (
              <li key={a.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="grid gap-5 md:grid-cols-[240px_1fr]">
                  <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                    {a.photos.length > 0 ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.photos[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-400">
                        {t("noPhoto")}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="break-words text-lg font-bold text-navy">
                      {annonce.immeuble_nom} — {a.numero} · {a.type}
                    </p>
                    <p className="break-words text-sm text-slate-600">{adresse}</p>
                    <p className="mt-2 text-base font-bold text-navy">
                      {formatMoney(a.loyer_defaut, a.devise, locale)}
                      {a.charges > 0 ? (
                        <span className="ml-2 text-sm font-semibold text-slate-600">
                          + {formatMoney(a.charges, a.devise, locale)} {t("chargesLabel")}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-2 text-sm text-slate-700">
                      {t("ownerLabel")} :{" "}
                      <Link
                        href={`/${locale}/console/comptes/${annonce.proprietaire_id}`}
                        className="font-bold text-navy underline"
                      >
                        {annonce.proprietaire_nom}
                      </Link>
                      {annonce.proprietaire_display_id ? (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                          {annonce.proprietaire_display_id}
                        </span>
                      ) : null}
                    </p>
                    {annonce.divergent ? (
                      <p className="mt-2">
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                          {t("divergentBadge")}
                        </span>
                      </p>
                    ) : null}

                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          {t("contactAnnounced")}
                        </p>
                        {ligneContact(t("nameLabel"), annonce.contact_annonce.nom, false)}
                        {ligneContact(t("phoneLabel"), annonce.contact_annonce.telephone, telDifferent)}
                        {ligneContact(t("emailLabel"), annonce.contact_annonce.email, emailDifferent)}
                      </div>
                      <div className="rounded-xl border border-slate-200 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          {t("contactFile")} (
                          {annonce.contact_dossier_role === "gestionnaire"
                            ? t("contactRoleManager")
                            : t("contactRoleOwner")}
                          )
                        </p>
                        {ligneContact(t("nameLabel"), annonce.contact_dossier.nom, false)}
                        {ligneContact(t("phoneLabel"), annonce.contact_dossier.telephone, telDifferent)}
                        {ligneContact(t("emailLabel"), annonce.contact_dossier.email, emailDifferent)}
                      </div>
                    </div>

                    {annonce.justification ? (
                      <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                          {t("justificationTitle")}
                        </p>
                        <p className="mt-1 break-words text-sm text-amber-900">{annonce.justification}</p>
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => approuver(annonce)}
                        className="rounded-full bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800"
                      >
                        {t("approveButton")}
                      </button>
                      <label className="sr-only" htmlFor={`motif-${a.id}`}>
                        {t("refusalReasonSelectLabel")}
                      </label>
                      <select
                        id={`motif-${a.id}`}
                        value={motifs[a.id] ?? ""}
                        onChange={(e) =>
                          setMotifs((prev) => ({ ...prev, [a.id]: e.target.value }))
                        }
                        className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-gold"
                      >
                        <option value="">{t("refusalReasonPlaceholder")}</option>
                        {MOTIFS.map((m) => (
                          <option key={m.valeur} value={m.valeur}>
                            {t(m.cle)}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => refuser(annonce)}
                        className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700"
                      >
                        {t("refuseButton")}
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

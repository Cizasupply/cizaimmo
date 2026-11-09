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
import BandeauPage from "@/components/BandeauPage";
import ConfirmDialog from "@/components/ConfirmDialog";
import CoordonneesPaiementVue from "@/components/CoordonneesPaiementVue";
import PackEmployeAdmin from "@/components/PackEmployeAdmin";
import TuileIcone from "@/components/TuileIcone";
import { getDataProvider } from "@/lib/data";
import type { CompteAdmin, DossierEmploye } from "@/lib/data";
import type { MembreEquipe } from "@/lib/data/types";
import { formatDate } from "@/lib/format";
import { useLocale } from "next-intl";

export default function ConsoleAdminsPage() {
  const t = useTranslations("console");
  const t15 = useTranslations("v15");
  const td = useTranslations("dossierEmploye");
  const tp = useTranslations("packEmploye");
  const tcom = useTranslations("common");
  const locale = useLocale();
  const [admins, setAdmins] = useState<CompteAdmin[]>([]);
  // v1.5 : vue Équipe (charge, accès console, dernière activité).
  const [equipe, setEquipe] = useState<MembreEquipe[]>([]);
  const [retraitAConfirmer, setRetraitAConfirmer] = useState<CompteAdmin | null>(null);
  const [emailPromotion, setEmailPromotion] = useState("");
  const [emailCreation, setEmailCreation] = useState("");
  const [nomCreation, setNomCreation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  // Dossier employé (2026-11-08) : détail déplié d'un membre.
  const [dossierOuvertId, setDossierOuvertId] = useState<string | null>(null);
  const [dossierDetail, setDossierDetail] = useState<DossierEmploye | null>(null);

  async function basculerDossier(id: string) {
    if (dossierOuvertId === id) {
      setDossierOuvertId(null);
      setDossierDetail(null);
      return;
    }
    try {
      const detail = await getDataProvider().listerDossierEmploye(id);
      setDossierDetail(detail);
      setDossierOuvertId(id);
    } catch {
      setErreur(t("errors.generic"));
    }
  }

  async function ouvrirPieceDetail() {
    if (!dossierDetail?.piece_identite) return;
    try {
      const { url } = await getDataProvider().telechargerDocument(
        dossierDetail.piece_identite.id
      );
      window.open(url, "_blank", "noopener");
    } catch {
      setErreur(t("errors.generic"));
    }
  }

  const recharger = useCallback(async () => {
    const provider = getDataProvider();
    const [liste, membres] = await Promise.all([
      provider.listerAdmins(),
      provider.listerEquipeAdmins().catch(() => [] as MembreEquipe[]),
    ]);
    setAdmins(liste);
    setEquipe(membres);
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
      {/* Bandeau de titre marine « Marine & Or » (2026-11-08). */}
      <BandeauPage>
        <h1 className="text-2xl font-semibold text-white md:text-3xl">{t("adminsTitle")}</h1>
        <p className="mt-1 text-sm text-slate-300">{t("adminsSubtitle")}</p>
      </BandeauPage>

      {message ? (
        <p role="status" className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">{message}</p>
      ) : null}
      {erreur ? (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{erreur}</p>
      ) : null}

      {/* Bureau large (xl) : cartes membres en grille 2 colonnes
          au lieu de rangées pleine largeur ; pile d'origine en
          dessous de xl. */}
      <div className="mt-6 space-y-3 xl:grid xl:grid-cols-2 xl:items-start xl:gap-4 xl:space-y-0">
        {admins.map((a) => {
          // v1.5 : données Équipe du même compte (charge / accès / activité).
          const membre = equipe.find((m) => m.id === a.id);
          const charge = membre?.dossiers_assignes ?? a.dossiers_assignes ?? 0;
          const accesActif = membre?.acces_admin_actif ?? a.acces_admin_actif ?? true;
          return (
          <article key={a.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-white p-5">
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-navy">{a.nom}</h2>
              <p className="truncate text-sm text-slate-500">{a.email}</p>
              <p className="mt-1 flex flex-wrap gap-2">
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${a.role === "super_admin" ? "bg-gold/20 text-yellow-800" : "bg-navy/10 text-navy"}`}>
                  {a.role === "super_admin" ? t("roleSuperAdmin") : t("roleAdmin")}
                </span>
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${a.statut === "actif" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                  {a.statut === "actif" ? t("adminActive") : t("adminSuspended")}
                </span>
                {/* v1.5 : charge + accès console + dernière activité. */}
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                  {t15("teamAssignedFiles")} : {charge}
                </span>
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${accesActif ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                  {t15("teamAccess")} : {accesActif ? t15("teamAccessActive") : t15("teamAccessInactive")}
                </span>
                {/* Dossier employé (2026-11-08) : statut CALCULÉ des
                    4 éléments — suivi, jamais bloquant. */}
                {membre ? (
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${membre.dossier_employe_complet ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                    {td("statusLabel")} : {membre.dossier_employe_complet ? td("complete") : td("incomplete")}
                  </span>
                ) : null}
                {/* Pack employé (2026-11-08) : contrat + charte + carte
                    du membre, dans la même ligne de suivi. */}
                {membre?.contrat_employe_statut ? (
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${membre.contrat_employe_statut === "valide" ? "bg-green-100 text-green-800" : membre.contrat_employe_statut === "refuse" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"}`}>
                    {tp("teamContractLabel")} : {tp(`contratStatus.${membre.contrat_employe_statut}` as "contratStatus.valide")}
                  </span>
                ) : null}
                {membre ? (
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${membre.charte_acceptee_le ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                    {tp("teamCharterLabel")} : {membre.charte_acceptee_le ? tp("charteAcceptedOn", { date: formatDate(membre.charte_acceptee_le, locale) }) : tp("chartePending")}
                  </span>
                ) : null}
                {membre ? (
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${membre.carte_employe_emise ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}`}>
                    {tp("teamCardLabel")} : {membre.carte_employe_emise ? tp("teamCardIssued") : tp("teamCardNotIssued")}
                  </span>
                ) : null}
                <span className="text-xs text-slate-400">
                  {t15("teamLastActivity")} :{" "}
                  {membre?.derniere_activite ? formatDate(membre.derniere_activite, locale) : t15("teamNever")}
                  {" · "}
                  {formatDate(a.created_at, locale)}
                </span>
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
                {/* v1.5 : couper / rétablir l'accès console de l'employé. */}
                <button
                  type="button"
                  disabled={occupe}
                  onClick={() =>
                    agir(
                      () => getDataProvider().basculerAccesAdmin(a.id, !accesActif),
                      t15("accessUpdatedMsg")
                    )
                  }
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy disabled:opacity-50"
                >
                  {accesActif ? t15("revokeAccess") : t15("grantAccess")}
                </button>
                {/* v1.5 : retrait du rôle Admin (rôle client d'origine restauré). */}
                <button
                  type="button"
                  disabled={occupe}
                  onClick={() => setRetraitAConfirmer(a)}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy disabled:opacity-50"
                >
                  {t15("removeRole")}
                </button>
              </div>
            ) : null}
            {/* Dossier employé (2026-11-08) : détail à la demande —
                documents avec liens signés + adresse. */}
            <div className="basis-full">
              <button
                type="button"
                onClick={() => basculerDossier(a.id)}
                className="text-sm font-bold text-navy underline"
              >
                {dossierOuvertId === a.id ? td("hideDetail") : td("viewDetail")}
              </button>
              {dossierOuvertId === a.id && dossierDetail ? (
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-bold text-navy">{td("detailTitle")}</h3>
                  {!dossierDetail.complet ? (
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-amber-900">
                      <span className="font-semibold">{td("missingLabel")}</span>
                      {dossierDetail.manquants.map((m) => (
                        <span key={m} className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-amber-800">
                          {td(`elements.${m}`)}
                        </span>
                      ))}
                    </p>
                  ) : null}
                  <div className="mt-3 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-navy">{td("photo")}</p>
                      {dossierDetail.photo_profil_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={dossierDetail.photo_profil_url}
                          alt={td("photo")}
                          className="mt-1 h-20 w-20 rounded-xl border border-slate-200 object-cover"
                        />
                      ) : (
                        <p>{dossierDetail.photo_profil_path ? `✓ ${td("received")}` : td("missing")}</p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-navy">{td("piece")}</p>
                      {dossierDetail.piece_identite ? (
                        <p className="flex flex-wrap items-center gap-2">
                          <span className="break-all">{dossierDetail.piece_identite.nom_fichier}</span>
                          <button type="button" onClick={ouvrirPieceDetail} className="font-bold text-navy underline">
                            {td("open")}
                          </button>
                        </p>
                      ) : (
                        <p>{td("missing")}</p>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-navy">{td("phone")}</p>
                      <p>{dossierDetail.telephone ?? td("missing")}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-navy">{td("addressSection")}</p>
                      {dossierDetail.adresse ? (
                        <p>
                          {dossierDetail.adresse}
                          {dossierDetail.adresse_ville ? `, ${dossierDetail.adresse_ville}` : ""}
                          {dossierDetail.adresse_code_postal ? `, ${dossierDetail.adresse_code_postal}` : ""}
                          {dossierDetail.adresse_pays ? `, ${dossierDetail.adresse_pays}` : ""}
                        </p>
                      ) : (
                        <p>{td("missing")}</p>
                      )}
                    </div>
                    {/* Coordonnées de paiement de l'employé (2026-11-08) :
                        bloc structuré selon le moyen — visibles par le
                        Super Admin, elles conditionnent l'émission de
                        la paie. */}
                    <div className="min-w-0 md:col-span-2">
                      <p className="font-semibold text-navy">{td("paymentSection")}</p>
                      {dossierDetail.coordonnees_paiement ? (
                        <CoordonneesPaiementVue
                          coordonnees={dossierDetail.coordonnees_paiement}
                        />
                      ) : (
                        <p>{td("paymentMissing")}</p>
                      )}
                    </div>
                  </div>
                  {/* Pack employé : préparation du contrat à deux
                      voies + revue du signé (Super Admin). */}
                  <PackEmployeAdmin adminId={a.id} onChanged={() => void recharger()} />
                </div>
              ) : null}
            </div>
          </article>
          );
        })}
      </div>

      {retraitAConfirmer ? (
        <ConfirmDialog
          title={t15("removeRoleConfirmTitle")}
          text={t15("removeRoleConfirmText")}
          confirmLabel={t15("removeRole")}
          cancelLabel={tcom("cancel")}
          onConfirm={() => {
            const cible = retraitAConfirmer;
            setRetraitAConfirmer(null);
            void agir(
              () => getDataProvider().retirerRoleAdmin(cible.id),
              t15("roleRemovedMsg")
            );
          }}
          onCancel={() => setRetraitAConfirmer(null)}
        />
      ) : null}

      {/* Bureau large (xl) : promotion et création côte à côte. */}
      <div className="mt-8 xl:grid xl:grid-cols-2 xl:items-start xl:gap-6">
      <section className="rounded-2xl border border-gold/40 bg-white p-5 min-w-0">
        <h2 className="font-semibold text-navy"><TuileIcone nom="admins" />{t("promoteTitle")}</h2>
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
          <button type="submit" disabled={occupe} className="rounded-full border border-navy bg-white px-5 py-2 text-sm font-semibold text-navy hover:bg-navy/5 disabled:opacity-50">
            {t("promoteButton")}
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-gold/40 bg-cream p-5 xl:mt-0 min-w-0">
        <h2 className="font-semibold text-navy"><TuileIcone nom="admins" />{t("createAdminTitle")}</h2>
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
          <button type="submit" disabled={occupe} className="rounded-full bg-gold px-5 py-2 text-sm font-bold text-navy hover:bg-gold-light disabled:opacity-50">
            {t("createAdminButton")}
          </button>
        </form>
      </section>
      </div>
    </div>
  );
}

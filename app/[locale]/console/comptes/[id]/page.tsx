"use client";

/**
 * Console — page DOSSIER d'un compte (v1.3) : identité + photo +
 * Display ID + téléphone, documents du dossier (pièce d'identité,
 * contrat signé — liens signés), preuves de propriété, rattachements
 * des deux côtés, demandes (validation Admin), immeubles possédés ou
 * gérés, annonces vitrine, abonnement et journal d'audit du compte.
 * Actions contextuelles selon l'état : approuver/refuser, valider le
 * contrat signé, valider/refuser un rattachement en attente.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type { DossierCompte, MotifRefus, Profil } from "@/lib/data";
import type { Conversation } from "@/lib/data/types";
import AssignationModale from "@/components/AssignationModale";
import FilMessages from "@/components/FilMessages";
import { MOTIFS_REFUS, libellerMotif } from "@/lib/avis";
import { nomPaysDepuisCode } from "@/lib/grille";
import { formatDate } from "@/lib/format";

export default function ConsoleDossierPage({
  params,
}: {
  params: { id: string };
}) {
  const t = useTranslations("console");
  const t15 = useTranslations("v15");
  const locale = useLocale();
  const [dossier, setDossier] = useState<DossierCompte | null>(null);
  // v1.5 : responsable du dossier, modale d'assignation, fil plateforme.
  const [moi, setMoi] = useState<Profil | null>(null);
  const [assignationOuverte, setAssignationOuverte] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [motif, setMotif] = useState<MotifRefus>("informations_insuffisantes");

  const charger = useCallback(async () => {
    try {
      const provider = getDataProvider();
      const [d, profil, conv] = await Promise.all([
        provider.listerDossier(params.id),
        provider.getProfil(),
        provider.getConversationPlateforme(params.id).catch(() => null),
      ]);
      setDossier(d);
      setMoi(profil);
      setConversation(conv);
    } catch {
      setIntrouvable(true);
    }
  }, [params.id]);

  useEffect(() => {
    charger();
  }, [charger]);

  async function agir(action: () => Promise<void>, succes: string) {
    setOccupe(true);
    setMessage(null);
    setErreur(null);
    try {
      await action();
      setMessage(succes);
      await charger();
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setErreur(
        code.startsWith("ERR_")
          ? t(`errors.${code}` as "errors.ERR_OPERATION_INTERDITE")
          : t("errors.generic")
      );
    } finally {
      setOccupe(false);
    }
  }

  async function ouvrirDocument(documentId: string) {
    try {
      const { url } = await getDataProvider().telechargerDocument(documentId);
      window.open(url, "_blank", "noopener");
    } catch {
      setErreur(t("errors.generic"));
    }
  }

  if (introuvable) {
    return (
      <div>
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          {t("fileNotFound")}
        </p>
        <Link href={`/${locale}/console/comptes`} className="mt-4 inline-block text-sm font-semibold text-navy underline">
          ← {t("accountsTitle")}
        </Link>
      </div>
    );
  }
  if (!dossier) {
    return <p className="text-sm text-slate-500">{t("loading")}</p>;
  }

  const { compte } = dossier;
  const enAttente = compte.abonnement?.statut === "en_attente";
  const demandesAdmin = dossier.demandes.filter((d) => d.statut === "en_attente_admin");

  return (
    <div>
      <Link href={`/${locale}/console/comptes`} className="text-sm font-semibold text-navy underline">
        ← {t("accountsTitle")}
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy md:text-3xl">{compte.nom}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {compte.email}
            {compte.display_id ? (
              <>
                {" · "}
                <strong className="font-bold tracking-wide text-navy">{compte.display_id}</strong>
              </>
            ) : null}
            {" · "}
            {t(`intention.${compte.type_intention}` as "intention.proprietaire")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!compte.dossier_complet ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              {t("badgeIncompleteFile")}
            </span>
          ) : (
            <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
              {t("fileComplete")}
            </span>
          )}
          {compte.grille_statut === "a_verifier" ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              ⚠ {t("badgeToVerify")}
            </span>
          ) : null}
        </div>
      </div>

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

      {/* Actions contextuelles selon l'état du compte. */}
      {enAttente ? (
        <section className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-bold text-amber-800">{t("reviewTitle")}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={occupe}
              onClick={() => agir(() => getDataProvider().approuverCompte(compte.id), t("approvedMsg"))}
              className="rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
            >
              ✓ {t("approve")}
            </button>
            <select
              aria-label={t("refusalReason")}
              value={motif}
              onChange={(e) => setMotif(e.target.value as MotifRefus)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {MOTIFS_REFUS.map((m) => (
                <option key={m} value={m}>
                  {libellerMotif(m, locale === "en" ? "en" : "fr")}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={occupe}
              onClick={() => agir(() => getDataProvider().refuserCompte(compte.id, motif), t("refusedMsg"))}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              ✕ {t("confirmRefusal")}
            </button>
          </div>
        </section>
      ) : null}

      {compte.statut_contrat === "signe_recu" ? (
        <section className="mt-5 rounded-2xl border border-sky-300 bg-sky-50 p-5">
          <h2 className="font-bold text-sky-900">{t("contractReviewTitle")}</h2>
          <p className="mt-1 text-sm text-sky-800">{t("contractReviewText")}</p>
          <button
            type="button"
            disabled={occupe}
            onClick={() => agir(() => getDataProvider().validerContrat(compte.id), t("contractValidatedMsg"))}
            className="mt-3 rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
          >
            ✓ {t("validateContract")}
          </button>
        </section>
      ) : null}

      {demandesAdmin.length > 0 ? (
        <section className="mt-5 rounded-2xl border border-amber-300 bg-white p-5">
          <h2 className="font-bold text-navy">{t("linkReviewTitle")}</h2>
          <ul className="mt-3 space-y-2">
            {demandesAdmin.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-4 py-3">
                <span className="text-sm text-slate-700">
                  <strong>{d.proprietaire_nom}</strong> → <strong>{d.gestionnaire_nom}</strong>{" "}
                  ({d.gestionnaire_display_id})
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    disabled={occupe}
                    onClick={() => agir(() => getDataProvider().validerRattachementAdmin(d.id, true).then(() => undefined), t("linkValidatedMsg"))}
                    className="rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    ✓ {t("validate")}
                  </button>
                  <button
                    type="button"
                    disabled={occupe}
                    onClick={() => agir(() => getDataProvider().validerRattachementAdmin(d.id, false).then(() => undefined), t("linkRefusedMsg"))}
                    className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    ✕ {t("refuse")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Identité */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold text-navy">{t("fileIdentity")}</h2>
          <dl className="mt-3 space-y-1.5 text-sm text-slate-600">
            <div className="flex justify-between gap-3">
              <dt className="font-semibold">{t("filePhoto")}</dt>
              <dd>{dossier.photo_profil_path ? `✓ ${t("received")}` : t("missing")}</dd>
            </div>
            {dossier.photo_profil_url ? (
              <div className="pt-2">
                <a href={dossier.photo_profil_url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={dossier.photo_profil_url}
                    alt={t("filePhoto")}
                    className="h-28 w-28 rounded-xl object-cover ring-1 ring-slate-200"
                  />
                </a>
              </div>
            ) : null}
            <div className="flex justify-between gap-3">
              <dt className="font-semibold">{t("phoneLabel")}</dt>
              <dd>{compte.telephone ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-semibold">{t("declaredCountry")}</dt>
              <dd>{compte.pays_declare ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-semibold">{t("ipCountry")}</dt>
              <dd>{compte.pays_ip ? `${nomPaysDepuisCode(compte.pays_ip)} (${compte.pays_ip})` : t("ipUnknown")}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-semibold">{t("sinceLabel")}</dt>
              <dd>{formatDate(compte.created_at, locale)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="font-semibold">{t("contractLabel")}</dt>
              <dd>{t(`contractStatus.${compte.statut_contrat}` as "contractStatus.valide")}</dd>
            </div>
            {/* v1.5 : Admin responsable du dossier (assignation Super Admin). */}
            <div className="flex items-center justify-between gap-3">
              <dt className="font-semibold">{t15("responsible")}</dt>
              <dd className="flex items-center gap-2">
                <span>{compte.admin_responsable_nom ?? t15("unassigned")}</span>
                {moi?.role === "super_admin" ? (
                  <button
                    type="button"
                    onClick={() => setAssignationOuverte(true)}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-navy hover:border-gold"
                  >
                    {t15("assign")}
                  </button>
                ) : null}
              </dd>
            </div>
          </dl>
        </section>

        {/* Abonnement */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold text-navy">{t("fileSubscription")}</h2>
          {compte.abonnement ? (
            <dl className="mt-3 space-y-1.5 text-sm text-slate-600">
              <div className="flex justify-between gap-3">
                <dt className="font-semibold">{t("planLabel")}</dt>
                <dd>{t(`plan.${compte.abonnement.plan}` as "plan.pro")}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-semibold">{t("gridLabel")}</dt>
                <dd>{t(`grid.${compte.abonnement.grille}` as "grid.afrique")}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="font-semibold">{t("filterStatus")}</dt>
                <dd>{t(`status.${compte.abonnement.statut}` as "status.actif")}</dd>
              </div>
              {compte.abonnement.trial_ends_at ? (
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold">{t("trialEndsLabel")}</dt>
                  <dd>{formatDate(compte.abonnement.trial_ends_at, locale)}</dd>
                </div>
              ) : null}
              {compte.abonnement.plan_apres_essai &&
              compte.abonnement.plan_apres_essai !== compte.abonnement.plan ? (
                <div className="flex justify-between gap-3">
                  <dt className="font-semibold">{t("planAfterTrialLabel")}</dt>
                  <dd>{t(`plan.${compte.abonnement.plan_apres_essai}` as "plan.pro")}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-500">—</p>
          )}
        </section>

        {/* Documents */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold text-navy">{t("fileDocuments")}</h2>
          {dossier.documents_compte.length === 0 && dossier.preuves_propriete.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">{t("noDocuments")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {dossier.documents_compte.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <span className="min-w-0 text-sm">
                    <span className="block truncate font-semibold text-navy">{d.nom_fichier}</span>
                    <span className="text-xs text-slate-500">
                      {t(`docType.${d.type}` as "docType.contrat")} · {formatDate(d.created_at, locale)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => ouvrirDocument(d.id)}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-navy hover:border-gold"
                  >
                    {t("openDocument")}
                  </button>
                </li>
              ))}
              {dossier.preuves_propriete.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <span className="min-w-0 text-sm">
                    <span className="block truncate font-semibold text-navy">{d.nom_fichier}</span>
                    <span className="text-xs text-slate-500">
                      {t("ownershipProof")} · {formatDate(d.created_at, locale)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => ouvrirDocument(d.id)}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-navy hover:border-gold"
                  >
                    {t("openDocument")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Rattachements + demandes */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold text-navy">{t("fileLinks")}</h2>
          {dossier.rattachements_comme_proprietaire.length === 0 &&
          dossier.rattachements_comme_gestionnaire.length === 0 &&
          dossier.demandes.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">{t("noLinks")}</p>
          ) : (
            <div className="mt-3 space-y-3 text-sm text-slate-600">
              {dossier.rattachements_comme_gestionnaire.map((r) => (
                <p key={r.id}>
                  {t("managesFor")} : <strong>{r.proprietaire_nom ?? r.proprietaire_id}</strong>{" "}
                  ({r.immeuble_ids.length} {t("buildingsAssigned")})
                  {r.proprietaire_email ? ` · ${r.proprietaire_email}` : ""}
                  {r.proprietaire_telephone ? ` · ${r.proprietaire_telephone}` : ""}
                </p>
              ))}
              {dossier.rattachements_comme_proprietaire.map((r) => (
                <p key={r.id}>
                  {t("managedBy")} : <strong>{r.gestionnaire_nom ?? r.gestionnaire_email}</strong>{" "}
                  ({r.immeuble_ids.length} {t("buildingsAssigned")})
                  {r.gestionnaire_nom && r.gestionnaire_email ? ` · ${r.gestionnaire_email}` : ""}
                  {r.gestionnaire_telephone ? ` · ${r.gestionnaire_telephone}` : ""}
                </p>
              ))}
              {dossier.demandes.map((d) => (
                <p key={d.id}>
                  {d.proprietaire_nom} → {d.gestionnaire_nom} :{" "}
                  <strong>{t(`requestStatus.${d.statut}` as "requestStatus.actif")}</strong>
                </p>
              ))}
            </div>
          )}
        </section>

        {/* Immeubles + annonces */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold text-navy">{t("fileBuildings")}</h2>
          {dossier.immeubles_possedes.length === 0 && dossier.immeubles_geres.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">{t("noBuildings")}</p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
              {dossier.immeubles_possedes.map((i) => (
                <li key={i.id}>
                  🏠 {i.nom} — {i.adresse ? `${i.adresse}, ` : ""}{i.ville}
                </li>
              ))}
              {dossier.immeubles_geres.map((i) => (
                <li key={i.id}>
                  🔑 {i.nom} — {i.adresse ? `${i.adresse}, ` : ""}{i.ville}
                </li>
              ))}
            </ul>
          )}
          {dossier.annonces.length > 0 ? (
            <>
              <h3 className="mt-4 font-bold text-navy">{t("fileListings")}</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                {dossier.annonces.map((a) => (
                  <li key={a.id}>
                    {a.immeuble_nom} — {a.numero}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        {/* Audit */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold text-navy">{t("fileAudit")}</h2>
          {dossier.audit.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">{t("noActivity")}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {dossier.audit.map((e) => (
                <li key={e.id} className="border-b border-slate-100 pb-2 text-sm last:border-0">
                  <span className="font-semibold text-navy">
                    {t(`audit.${e.action}` as "audit.compte_approuve")}
                  </span>{" "}
                  <span className="text-slate-600">
                    — {t("byActor", { actor: e.acteur_email })} · {formatDate(e.created_at, locale)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* v1.5 : fil plateforme du client — la plateforme peut répondre
          (fil « plateforme » ; marquerLu à l'ouverture via FilMessages). */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-bold text-navy">{t15("messagesTitle")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t15("platformThreadDesc")}</p>
        <div className="mt-4">
          {conversation ? (
            <FilMessages conversationId={conversation.id} />
          ) : (
            <p className="text-sm text-slate-500">{t15("noConversations")}</p>
          )}
        </div>
      </section>

      {assignationOuverte ? (
        <AssignationModale
          compteId={compte.id}
          compteNom={compte.nom}
          responsableActuelId={compte.admin_responsable_id}
          onFermer={() => setAssignationOuverte(false)}
          onAssigne={() => {
            setMessage(t15("assignSuccess"));
            void charger();
          }}
        />
      ) : null}
    </div>
  );
}

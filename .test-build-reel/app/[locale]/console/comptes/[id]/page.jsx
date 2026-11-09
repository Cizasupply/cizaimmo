"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ConsoleDossierPage;
/**
 * Console — page DOSSIER d'un compte (v1.3) : identité + photo +
 * Display ID + téléphone, documents du dossier (pièce d'identité,
 * contrat signé — liens signés), preuves de propriété, rattachements
 * des deux côtés, demandes (validation Admin), immeubles possédés ou
 * gérés, annonces vitrine, abonnement et journal d'audit du compte.
 * Actions contextuelles selon l'état : approuver/refuser, valider le
 * contrat signé, valider/refuser un rattachement en attente.
 */
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const data_1 = require("@/lib/data");
const AssignationModale_1 = __importDefault(require("@/components/AssignationModale"));
const FilMessages_1 = __importDefault(require("@/components/FilMessages"));
const avis_1 = require("@/lib/avis");
const grille_1 = require("@/lib/grille");
const format_1 = require("@/lib/format");
/** v1.7 : motifs PRÉDÉFINIS de refus de validation d'un immeuble de
 * gestionnaire (même patron que la vitrine v1.6 : la valeur stockée
 * est le libellé, la clé sert à l'affichage traduit). */
const MOTIFS_VALIDATION_IMMEUBLE = [
    { valeur: "Autorisation insuffisante", cle: "motifAutorisation" },
    { valeur: "Propriétaire non confirmé", cle: "motifProprietaire" },
    { valeur: "Informations incomplètes", cle: "motifInfos" },
    { valeur: "Autre", cle: "motifAutre" },
];
function ConsoleDossierPage({ params, }) {
    const t = (0, next_intl_1.useTranslations)("console");
    const t15 = (0, next_intl_1.useTranslations)("v15");
    const t17 = (0, next_intl_1.useTranslations)("v17");
    const locale = (0, next_intl_1.useLocale)();
    const [dossier, setDossier] = (0, react_1.useState)(null);
    // v1.5 : responsable du dossier, modale d'assignation, fil plateforme.
    const [moi, setMoi] = (0, react_1.useState)(null);
    const [assignationOuverte, setAssignationOuverte] = (0, react_1.useState)(false);
    const [conversation, setConversation] = (0, react_1.useState)(null);
    const [introuvable, setIntrouvable] = (0, react_1.useState)(false);
    const [message, setMessage] = (0, react_1.useState)(null);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const [occupe, setOccupe] = (0, react_1.useState)(false);
    const [motif, setMotif] = (0, react_1.useState)("informations_insuffisantes");
    // Checklist de vérification (2026-11-07) : état local des coches,
    // synchronisé depuis la dernière consignation du dossier ; chaque
    // bascule est consignée dans la base (acteur + horodatage).
    const [checklist, setChecklist] = (0, react_1.useState)({
        photo_verifiee: false,
        piece_coherente: false,
        infos_verifiees: false,
        antifraude_examinee: false,
    });
    // v1.7 : motifs de refus de validation d'immeuble, par immeuble.
    const [motifsRevue, setMotifsRevue] = (0, react_1.useState)({});
    // Option C : motif de refus du contrat PROPRIÉTAIRE signé.
    const [motifContratProp, setMotifContratProp] = (0, react_1.useState)("");
    const charger = (0, react_1.useCallback)(async () => {
        try {
            const provider = (0, data_1.getDataProvider)();
            const [d, profil, conv] = await Promise.all([
                provider.listerDossier(params.id),
                provider.getProfil(),
                provider.getConversationPlateforme(params.id).catch(() => null),
            ]);
            setDossier(d);
            setMoi(profil);
            setConversation(conv);
        }
        catch {
            setIntrouvable(true);
        }
    }, [params.id]);
    (0, react_1.useEffect)(() => {
        charger();
    }, [charger]);
    // Resynchronise les coches quand le dossier (re)chargé change de
    // consignation (autre Admin passé entre-temps, rechargement…).
    const checklistMaj = dossier?.checklist?.updated_at ?? null;
    const dossierId = dossier?.compte.id ?? null;
    (0, react_1.useEffect)(() => {
        const c = dossier?.checklist;
        setChecklist({
            photo_verifiee: c?.photo_verifiee ?? false,
            piece_coherente: c?.piece_coherente ?? false,
            infos_verifiees: c?.infos_verifiees ?? false,
            antifraude_examinee: c?.antifraude_examinee ?? false,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dossierId, checklistMaj]);
    async function basculerChecklist(cle, valeur) {
        if (!dossier)
            return;
        const prochain = { ...checklist, [cle]: valeur };
        setChecklist(prochain);
        try {
            await (0, data_1.getDataProvider)().enregistrerChecklistDossier(dossier.compte.id, prochain);
            await charger();
        }
        catch {
            setErreur(t("errors.generic"));
            await charger();
        }
    }
    async function agir(action, succes) {
        setOccupe(true);
        setMessage(null);
        setErreur(null);
        try {
            await action();
            setMessage(succes);
            await charger();
        }
        catch (e) {
            const code = e instanceof Error ? e.message : "";
            setErreur(code.startsWith("ERR_")
                ? t(`errors.${code}`)
                : t("errors.generic"));
        }
        finally {
            setOccupe(false);
        }
    }
    async function ouvrirDocument(documentId) {
        try {
            const { url } = await (0, data_1.getDataProvider)().telechargerDocument(documentId);
            window.open(url, "_blank", "noopener");
        }
        catch {
            setErreur(t("errors.generic"));
        }
    }
    if (introuvable) {
        return (<div>
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          {t("fileNotFound")}
        </p>
        <link_1.default href={`/${locale}/console/comptes`} className="mt-4 inline-block text-sm font-semibold text-navy underline">
          ← {t("accountsTitle")}
        </link_1.default>
      </div>);
    }
    if (!dossier) {
        return <p className="text-sm text-slate-500">{t("loading")}</p>;
    }
    const { compte } = dossier;
    const enAttente = compte.abonnement?.statut === "en_attente";
    const demandesAdmin = dossier.demandes.filter((d) => d.statut === "en_attente_admin");
    // Checklist : la case anti-fraude n'est requise (et montrée) que
    // pour un compte signalé « à vérifier ». Le refus reste libre.
    const aVerifier = compte.grille_statut === "a_verifier";
    const checklistComplete = checklist.photo_verifiee &&
        checklist.piece_coherente &&
        checklist.infos_verifiees &&
        (!aVerifier || checklist.antifraude_examinee);
    const casesChecklist = [
        { cle: "photo_verifiee", libelle: t("checklistPhoto") },
        { cle: "piece_coherente", libelle: t("checklistPiece") },
        { cle: "infos_verifiees", libelle: t("checklistInfos") },
        ...(aVerifier
            ? [{ cle: "antifraude_examinee", libelle: t("checklistAntifraude") }]
            : []),
    ];
    return (<div>
      <link_1.default href={`/${locale}/console/comptes`} className="text-sm font-semibold text-navy underline">
        ← {t("accountsTitle")}
      </link_1.default>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-navy md:text-3xl">{compte.nom}</h1>
          <p className="mt-1 break-words text-sm text-slate-500">
            {compte.email}
            {compte.display_id ? (<>
                {" · "}
                <strong className="whitespace-nowrap font-bold tracking-wide text-navy">{compte.display_id}</strong>
              </>) : null}
            {" · "}
            {t(`intention.${compte.type_intention}`)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!compte.dossier_complet ? (<span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              {t("badgeIncompleteFile")}
            </span>) : (<span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
              {t("fileComplete")}
            </span>)}
          {compte.grille_statut === "a_verifier" ? (<span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              ⚠ {t("badgeToVerify")}
            </span>) : null}
        </div>
      </div>

      {message ? (<p role="status" className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
          {message}
        </p>) : null}
      {erreur ? (<p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {erreur}
        </p>) : null}

      {/* Actions contextuelles selon l'état du compte. */}
      {enAttente ? (<section className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="font-bold text-amber-800">{t("reviewTitle")}</h2>
          {/* Checklist de vérification (fondateur, 2026-11-07) :
                l'approbation exige toutes les cases requises cochées
                — bouton grisé sinon, et garde équivalente dans la
                base (approuver_compte). Le refus reste libre. */}
          <div className="mt-4 rounded-xl bg-white/70 p-4">
            <h3 className="text-sm font-bold text-amber-900">{t("checklistTitle")}</h3>
            <div className="mt-2 space-y-2">
              {casesChecklist.map(({ cle, libelle }) => (<label key={cle} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={checklist[cle]} disabled={occupe} onChange={(e) => void basculerChecklist(cle, e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-green-700"/>
                  <span>{libelle}</span>
                </label>))}
            </div>
            {dossier.checklist?.updated_at ? (<p className="mt-3 text-xs text-slate-500">
                {t("checklistBy", {
                    actor: dossier.checklist.acteur_nom ?? dossier.checklist.acteur_email ?? "",
                    date: (0, format_1.formatDateTime)(dossier.checklist.updated_at, locale),
                })}
              </p>) : null}
            {!checklistComplete ? (<p className="mt-2 text-xs font-semibold text-amber-700">{t("checklistHint")}</p>) : null}
          </div>
          {/* Verrouillage 2026-11-08 : la DÉCISION (approuver /
                refuser, motifs compris) appartient au Super Admin
                seul. L'Admin instruit le dossier — la checklist
                ci-dessus reste visible et consignable par lui — et
                voit cet encadré à la place des boutons. Garde
                équivalente dans les fournisseurs et dans la base
                (RPC approuver_compte). */}
          {moi?.role === "super_admin" ? (<div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={occupe || !checklistComplete} onClick={() => agir(() => (0, data_1.getDataProvider)().approuverCompte(compte.id), t("approvedMsg"))} className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy hover:bg-gold-light disabled:cursor-not-allowed disabled:opacity-50">
              ✓ {t("approve")}
            </button>
            <select aria-label={t("refusalReason")} value={motif} onChange={(e) => setMotif(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              {avis_1.MOTIFS_REFUS.map((m) => (<option key={m} value={m}>
                  {(0, avis_1.libellerMotif)(m, locale === "en" ? "en" : "fr")}
                </option>))}
            </select>
            <button type="button" disabled={occupe} onClick={() => agir(() => (0, data_1.getDataProvider)().refuserCompte(compte.id, motif), t("refusedMsg"))} className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
              ✕ {t("confirmRefusal")}
            </button>
          </div>) : (<p className="mt-3 rounded-xl bg-white/70 px-4 py-3 text-sm font-semibold text-slate-600">
              {t("decisionSuperAdminOnly")}
            </p>)}
        </section>) : null}

      {compte.statut_contrat === "signe_recu" ? (<section className="mt-5 rounded-2xl border border-sky-300 bg-sky-50 p-5">
          <h2 className="font-bold text-sky-900">{t("contractReviewTitle")}</h2>
          <p className="mt-1 text-sm text-sky-800">{t("contractReviewText")}</p>
          <button type="button" disabled={occupe} onClick={() => agir(() => (0, data_1.getDataProvider)().validerContrat(compte.id), t("contractValidatedMsg"))} className="mt-3 rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
            ✓ {t("validateContract")}
          </button>
        </section>) : null}

      {compte.type_intention === "proprietaire" && compte.statut_contrat_proprietaire === "signe_depose" ? (<section className="mt-5 rounded-2xl border border-sky-300 bg-sky-50 p-5">
          <h2 className="font-bold text-sky-900">{t("ownerContractReviewTitle")}</h2>
          <p className="mt-1 text-sm text-sky-800">{t("ownerContractReviewText")}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={occupe} onClick={() => agir(() => (0, data_1.getDataProvider)().validerContratProprietaire(compte.id), t("ownerContractValidatedMsg"))} className="rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
              ✓ {t("validateOwnerContract")}
            </button>
            <input type="text" aria-label={t("ownerContractReasonLabel")} placeholder={t("ownerContractReasonPlaceholder")} value={motifContratProp} onChange={(e) => setMotifContratProp(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"/>
            <button type="button" disabled={occupe} onClick={() => agir(() => (0, data_1.getDataProvider)().refuserContratProprietaire(compte.id, motifContratProp), t("ownerContractRefusedMsg"))} className="rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
              ✕ {t("refuseOwnerContract")}
            </button>
          </div>
        </section>) : null}

      {demandesAdmin.length > 0 ? (<section className="mt-5 rounded-2xl border border-amber-300 bg-white p-5">
          <h2 className="font-semibold text-navy">{t("linkReviewTitle")}</h2>
          <ul className="mt-3 space-y-2">
            {demandesAdmin.map((d) => (<li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-4 py-3">
                <span className="text-sm text-slate-700">
                  <strong>{d.proprietaire_nom}</strong> → <strong>{d.gestionnaire_nom}</strong>{" "}
                  ({d.gestionnaire_display_id})
                </span>
                <span className="flex gap-2">
                  <button type="button" disabled={occupe} onClick={() => agir(() => (0, data_1.getDataProvider)().validerRattachementAdmin(d.id, true).then(() => undefined), t("linkValidatedMsg"))} className="rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50">
                    ✓ {t("validate")}
                  </button>
                  <button type="button" disabled={occupe} onClick={() => agir(() => (0, data_1.getDataProvider)().validerRattachementAdmin(d.id, false).then(() => undefined), t("linkRefusedMsg"))} className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
                    ✕ {t("refuse")}
                  </button>
                </span>
              </li>))}
          </ul>
        </section>) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Identité — correctif mobile 2026-11-08 (capture annotée du
            fondateur) : la carte débordait horizontalement, valeurs
            coupées au bord droit. La grille passe en colonne unique
            explicite (minmax(0,1fr)) et chaque ligne libellé/valeur
            peut s'enrouler : libellé jamais compressé (shrink-0),
            valeur en min-w-0 + break-words, alignée à droite. */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-navy">{t("fileIdentity")}</h2>
          <dl className="mt-3 space-y-1.5 text-sm text-slate-600">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <dt className="shrink-0 font-semibold">{t("filePhoto")}</dt>
              <dd className="min-w-0 break-words text-right">{dossier.photo_profil_path ? `✓ ${t("received")}` : t("missing")}</dd>
            </div>
            {dossier.photo_profil_url ? (<div className="pt-2">
                <a href={dossier.photo_profil_url} target="_blank" rel="noopener noreferrer">
                  <img src={dossier.photo_profil_url} alt={t("filePhoto")} className="h-28 w-28 rounded-xl object-cover ring-1 ring-slate-200"/>
                </a>
              </div>) : null}
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <dt className="shrink-0 font-semibold">{t("phoneLabel")}</dt>
              <dd className="min-w-0 break-words text-right">{compte.telephone ?? "—"}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <dt className="shrink-0 font-semibold">{t("declaredCountry")}</dt>
              <dd className="min-w-0 break-words text-right">{compte.pays_declare ?? "—"}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <dt className="shrink-0 font-semibold">{t("ipCountry")}</dt>
              <dd className="min-w-0 break-words text-right">{compte.pays_ip ? `${(0, grille_1.nomPaysDepuisCode)(compte.pays_ip)} (${compte.pays_ip})` : t("ipUnknown")}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <dt className="shrink-0 font-semibold">{t("sinceLabel")}</dt>
              <dd className="min-w-0 break-words text-right">{(0, format_1.formatDate)(compte.created_at, locale)}</dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <dt className="shrink-0 font-semibold">{t("contractLabel")}</dt>
              <dd className="min-w-0 break-words text-right">{t(`contractStatus.${compte.statut_contrat}`)}</dd>
            </div>
            {compte.type_intention === "proprietaire" ? (<>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <dt className="shrink-0 font-semibold">{t("ownerContractLabel")}</dt>
                  <dd className="min-w-0 break-words text-right">{t(`ownerContractStatus.${compte.statut_contrat_proprietaire}`)}</dd>
                </div>
                {compte.statut_contrat_proprietaire === "refuse" && compte.motif_contrat_proprietaire ? (<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <dt className="shrink-0 font-semibold">{t("ownerContractMotifLabel")}</dt>
                    <dd className="min-w-0 break-words text-right">{compte.motif_contrat_proprietaire}</dd>
                  </div>) : null}
              </>) : null}
            {/* v1.5 : Admin responsable du dossier (assignation Super Admin). */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <dt className="shrink-0 font-semibold">{t15("responsible")}</dt>
              <dd className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                <span>{compte.admin_responsable_nom ?? t15("unassigned")}</span>
                {moi?.role === "super_admin" ? (<button type="button" onClick={() => setAssignationOuverte(true)} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-navy hover:border-gold">
                    {t15("assign")}
                  </button>) : null}
              </dd>
            </div>
          </dl>
        </section>

        {/* Abonnement */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-navy">{t("fileSubscription")}</h2>
          {compte.abonnement ? (<dl className="mt-3 space-y-1.5 text-sm text-slate-600">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <dt className="shrink-0 font-semibold">{t("planLabel")}</dt>
                <dd className="min-w-0 break-words text-right">{t(`plan.${compte.abonnement.plan}`)}</dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <dt className="shrink-0 font-semibold">{t("gridLabel")}</dt>
                <dd className="min-w-0 break-words text-right">{t(`grid.${compte.abonnement.grille}`)}</dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <dt className="shrink-0 font-semibold">{t("filterStatus")}</dt>
                <dd className="min-w-0 break-words text-right">{t(`status.${compte.abonnement.statut}`)}</dd>
              </div>
              {compte.abonnement.trial_ends_at ? (<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <dt className="shrink-0 font-semibold">{t("trialEndsLabel")}</dt>
                  <dd className="min-w-0 break-words text-right">{(0, format_1.formatDate)(compte.abonnement.trial_ends_at, locale)}</dd>
                </div>) : null}
              {compte.abonnement.plan_apres_essai &&
                compte.abonnement.plan_apres_essai !== compte.abonnement.plan ? (<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <dt className="shrink-0 font-semibold">{t("planAfterTrialLabel")}</dt>
                  <dd className="min-w-0 break-words text-right">{t(`plan.${compte.abonnement.plan_apres_essai}`)}</dd>
                </div>) : null}
            </dl>) : (<p className="mt-3 text-sm text-slate-500">—</p>)}
        </section>

        {/* Documents */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-navy">{t("fileDocuments")}</h2>
          {dossier.documents_compte.length === 0 && dossier.preuves_propriete.length === 0 ? (<p className="mt-3 text-sm text-slate-500">{t("noDocuments")}</p>) : (<ul className="mt-3 space-y-2">
              {dossier.documents_compte.map((d) => (<li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block truncate font-semibold text-navy">{d.nom_fichier}</span>
                    <span className="text-xs text-slate-500">
                      {t(`docType.${d.type}`)} · {(0, format_1.formatDate)(d.created_at, locale)}
                    </span>
                  </span>
                  <button type="button" onClick={() => ouvrirDocument(d.id)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-navy hover:border-gold">
                    {t("openDocument")}
                  </button>
                </li>))}
              {dossier.preuves_propriete.map((d) => (<li key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="block truncate font-semibold text-navy">{d.nom_fichier}</span>
                    <span className="text-xs text-slate-500">
                      {t("ownershipProof")} · {(0, format_1.formatDate)(d.created_at, locale)}
                    </span>
                  </span>
                  <button type="button" onClick={() => ouvrirDocument(d.id)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-navy hover:border-gold">
                    {t("openDocument")}
                  </button>
                </li>))}
            </ul>)}
        </section>

        {/* Rattachements + demandes */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-navy">{t("fileLinks")}</h2>
          {dossier.rattachements_comme_proprietaire.length === 0 &&
            dossier.rattachements_comme_gestionnaire.length === 0 &&
            dossier.demandes.length === 0 ? (<p className="mt-3 text-sm text-slate-500">{t("noLinks")}</p>) : (<div className="mt-3 space-y-3 text-sm text-slate-600">
              {dossier.rattachements_comme_gestionnaire.map((r) => (<p key={r.id} className="break-words">
                  {t("managesFor")} : <strong>{r.proprietaire_nom ?? r.proprietaire_id}</strong>{" "}
                  ({r.immeuble_ids.length} {t("buildingsAssigned")})
                  {r.proprietaire_email ? ` · ${r.proprietaire_email}` : ""}
                  {r.proprietaire_telephone ? ` · ${r.proprietaire_telephone}` : ""}
                </p>))}
              {dossier.rattachements_comme_proprietaire.map((r) => (<p key={r.id} className="break-words">
                  {t("managedBy")} : <strong>{r.gestionnaire_nom ?? r.gestionnaire_email}</strong>{" "}
                  ({r.immeuble_ids.length} {t("buildingsAssigned")})
                  {r.gestionnaire_nom && r.gestionnaire_email ? ` · ${r.gestionnaire_email}` : ""}
                  {r.gestionnaire_telephone ? ` · ${r.gestionnaire_telephone}` : ""}
                </p>))}
              {dossier.demandes.map((d) => (<p key={d.id} className="break-words">
                  {d.proprietaire_nom} → {d.gestionnaire_nom} :{" "}
                  <strong>{t(`requestStatus.${d.statut}`)}</strong>
                </p>))}
            </div>)}
        </section>

        {/* Immeubles + annonces */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-navy">{t("fileBuildings")}</h2>
          {dossier.immeubles_possedes.length === 0 && dossier.immeubles_geres.length === 0 ? (<p className="mt-3 text-sm text-slate-500">{t("noBuildings")}</p>) : (<ul className="mt-3 space-y-1.5 text-sm text-slate-600">
              {dossier.immeubles_possedes.map((i) => (<li key={i.id} className="flex items-center gap-2">
                  {/* v1.7 : vignette — la photo du passeport du bien. */}
                  {i.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.photo_url} alt="" className="h-9 w-11 shrink-0 rounded object-cover"/>) : (<span aria-hidden>🏠</span>)}
                  <span className="min-w-0 break-words">{i.nom} — {i.adresse ? `${i.adresse}, ` : ""}{i.ville}</span>
                </li>))}
              {dossier.immeubles_geres.map((i) => (<li key={i.id} className="flex items-center gap-2">
                  {i.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.photo_url} alt="" className="h-9 w-11 shrink-0 rounded object-cover"/>) : (<span aria-hidden>🔑</span>)}
                  <span className="min-w-0 break-words">{i.nom} — {i.adresse ? `${i.adresse}, ` : ""}{i.ville}</span>
                </li>))}
            </ul>)}
          {dossier.annonces.length > 0 ? (<>
              <h3 className="mt-4 font-semibold text-navy">{t("fileListings")}</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                {dossier.annonces.map((a) => (<li key={a.id}>
                    {a.immeuble_nom} — {a.numero}
                  </li>))}
              </ul>
            </>) : null}
        </section>

        {/* v1.7 : revue des immeubles créés par ce gestionnaire —
            autorisation de gestion + propriétaire déclaré. */}
        {dossier.immeubles_en_revue.length > 0 ? (<section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-navy">{t17("reviewTitle")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t17("reviewHint")}</p>
            <ul className="mt-3 space-y-3">
              {dossier.immeubles_en_revue.map((r) => (<li key={r.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start gap-3">
                    {r.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.photo_url} alt="" className="h-16 w-20 shrink-0 rounded-lg object-cover"/>) : null}
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="break-words font-bold text-navy">
                        {r.nom} — {r.adresse ? `${r.adresse}, ` : ""}{r.ville}
                      </p>
                      <p className="mt-0.5 break-words text-slate-600">
                        {t17("declaredOwnerLabel")} :{" "}
                        <strong>{r.proprietaire_declare_nom ?? "—"}</strong>
                        {r.proprietaire_declare_email ? ` · ${r.proprietaire_declare_email}` : ""}
                      </p>
                      <p className="mt-0.5">
                        {r.proprietaire_concordance ? (<span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                            {t17("concordanceAuto")}
                          </span>) : (<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                            {t17("concordanceManual")}
                          </span>)}{" "}
                        {r.validation_statut === "en_attente" ? (<span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                            {t17("statusEnAttente")}
                          </span>) : r.validation_statut === "refuse" ? (<span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                            {t17("statusRefuse")}
                            {r.validation_motif ? ` — ${r.validation_motif}` : ""}
                          </span>) : (<span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                            {t17("statusValide")}
                          </span>)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {r.autorisation ? (<button type="button" onClick={() => ouvrirDocument(r.autorisation.id)} className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-navy hover:border-gold">
                            {t17("openAutorisation")}
                          </button>) : (<span className="text-xs font-semibold text-red-700">
                            {t17("noAutorisation")}
                          </span>)}
                        {r.validation_statut === "en_attente" ? (<>
                            <button type="button" disabled={occupe} onClick={() => agir(() => (0, data_1.getDataProvider)().deciderValidationImmeuble(r.id, true), t17("validatedMsg"))} className="rounded-full border border-navy bg-white px-3 py-1.5 text-xs font-semibold text-navy hover:bg-navy/5 disabled:opacity-50">
                              {t17("validateBuilding")}
                            </button>
                            <label className="sr-only" htmlFor={`motif-revue-${r.id}`}>
                              {t17("motifLabel")}
                            </label>
                            <select id={`motif-revue-${r.id}`} value={motifsRevue[r.id] ?? ""} onChange={(e) => setMotifsRevue((m) => ({ ...m, [r.id]: e.target.value }))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs">
                              <option value="">{t17("motifLabel")}</option>
                              {MOTIFS_VALIDATION_IMMEUBLE.map((m) => (<option key={m.valeur} value={m.valeur}>
                                  {t17(m.cle)}
                                </option>))}
                            </select>
                            <button type="button" disabled={occupe || !(motifsRevue[r.id] ?? "")} onClick={() => agir(() => (0, data_1.getDataProvider)().deciderValidationImmeuble(r.id, false, motifsRevue[r.id]), t17("refusedMsg"))} className="rounded-full border border-red-300 bg-white px-3 py-1.5 text-xs font-bold text-red-700 disabled:opacity-50">
                              {t17("refuseBuilding")}
                            </button>
                          </>) : null}
                      </div>
                    </div>
                  </div>
                </li>))}
            </ul>
          </section>) : null}

        {/* Audit */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-navy">{t("fileAudit")}</h2>
          {dossier.audit.length === 0 ? (<p className="mt-3 text-sm text-slate-500">{t("noActivity")}</p>) : (<ul className="mt-3 space-y-2">
              {dossier.audit.map((e) => (<li key={e.id} className="break-words border-b border-slate-100 pb-2 text-sm last:border-0">
                  <span className="font-semibold text-navy">
                    {(0, format_1.actionAuditConnue)(e.action)
                    ? t(`audit.${e.action}`)
                    : t("audit.actionInconnue")}
                  </span>{" "}
                  {/* Audit enrichi : nom de l'acteur (repli e-mail
                    pour les entrées anciennes), rôle, jour ET heure. */}
                  <span className="text-slate-600">
                    — {e.acteur_nom ?? e.acteur_email} —{" "}
                    {e.acteur_role === "super_admin"
                    ? t("roleSuperAdmin")
                    : e.acteur_role === "admin"
                        ? t("roleAdmin")
                        : e.acteur_role}{" "}
                    — {(0, format_1.formatDateTime)(e.created_at, locale)}
                  </span>
                </li>))}
            </ul>)}
        </section>
      </div>

      {/* v1.5 : fil plateforme du client — la plateforme peut répondre
            (fil « plateforme » ; marquerLu à l'ouverture via FilMessages).
            Ancre #messages : cible des liens de la boîte de réception
            console et de la Vue d'ensemble (2026-11-07). */}
      <section id="messages" className="mt-6 scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-navy">{t15("messagesTitle")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t15("platformThreadDesc")}</p>
        <div className="mt-4">
          {conversation ? (<FilMessages_1.default conversationId={conversation.id}/>) : (<p className="text-sm text-slate-500">{t15("noConversations")}</p>)}
        </div>
      </section>

      {assignationOuverte ? (<AssignationModale_1.default compteId={compte.id} compteNom={compte.nom} responsableActuelId={compte.admin_responsable_id} onFermer={() => setAssignationOuverte(false)} onAssigne={() => {
                setMessage(t15("assignSuccess"));
                void charger();
            }}/>) : null}
    </div>);
}

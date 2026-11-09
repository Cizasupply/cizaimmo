"use client";

/**
 * Console — Finances de la plateforme (2026-11-08, décision VALIDÉE
 * par le fondateur) : paie des employés + dépenses de fonctionnement
 * supervisées, pour CizaImmo seulement.
 *
 *  - PAIE : émise par le Super Admin DEPUIS le dossier employé —
 *    montant, devise et modalités copiés du contrat d'engagement en
 *    base ; dossier incomplet = émission impossible, manquants
 *    listés ; une seule paie par employé et par mois.
 *  - DÉPENSES : saisies par l'Admin ou le Super Admin (justificatif
 *    optionnel, bucket privé), VALIDÉES par le Super Admin seul —
 *    celui qui saisit ne valide pas, pas même les siennes.
 *  - L'Admin ne voit ici que SA ligne de paie, SES dépenses et SON
 *    historique (le fournisseur filtre par rôle ; la RLS double en
 *    réel pour la validation).
 *  - PRÉSENTATION PAR RÔLE (2026-11-08) : la vue Admin porte des
 *    libellés à la première personne (« Ma paie et mes dépenses »,
 *    « Ma paie », « Mon historique de paies ») pour ne pas laisser
 *    croire à une vue plateforme — la vue Super Admin garde les
 *    libellés plateforme inchangés.
 *  - LOT A (2026-11-08, modèle du fondateur : « sa paie et les
 *    dépenses de la plateforme, deux choses différentes ») : chez
 *    l'Admin, les deux domaines sont nettement SÉPARÉS — bloc
 *    « Ma paie » puis bloc « Mes demandes de dépenses » — et la
 *    boîte de totaux DISPARAÎT (aucun total ne mélange paie et
 *    dépenses chez l'employé ; le fournisseur continue de renvoyer
 *    ses totaux filtrés, la page ne les rend simplement pas). Les
 *    totaux plateforme restent affichés pour le Super Admin seul.
 *  - Totaux du mois PAR DEVISE — aucune conversion inventée.
 */

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type {
  DepensePlateforme,
  LignePaieEmploye,
  VueFinancesPlateforme,
} from "@/lib/data";
import { DEVISES } from "@/lib/data";
import BandeauPage from "@/components/BandeauPage";
import ConfirmDialog from "@/components/ConfirmDialog";
import CoordonneesPaiementVue from "@/components/CoordonneesPaiementVue";
import DocumentUpload from "@/components/DocumentUpload";
import Field from "@/components/Field";
import { telechargerBase64Pdf } from "@/components/PackEmployeAdmin";
import { formatDate, formatMoney, formatReferencePaie } from "@/lib/format";
import { moisCourant } from "@/lib/finances-plateforme";
import {
  CATEGORIES_DEPENSE_PLATEFORME,
  type CategorieDepensePlateforme,
  type StatutDepensePlateforme,
} from "@/lib/finances-plateforme";

function fichierVersDataUrl(fichier: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(lecteur.result as string);
    lecteur.onerror = () => reject(new Error("lecture"));
    lecteur.readAsDataURL(fichier);
  });
}

// Organisation desktop « ultra premium » (2026-11-08) : bordure
// des cartes teintée OR à 40 % (système Marine & Or) plutôt que le
// slate très pâle — le blanc des cartes est cassé en restant discret.
// Même traitement sur les autres pages console de la passe.
const CARTE = "rounded-2xl border border-gold/40 bg-white p-5 shadow-sm";
const BOUTON_MARINE =
  "rounded-full bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-light disabled:opacity-50";
const BOUTON_OR =
  "rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy-dark shadow-sm transition hover:brightness-105 disabled:opacity-50";
const SELECT =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-navy";

export default function FinancesPlateformePage() {
  const tf = useTranslations("financesPlateforme");
  const te = useTranslations("console");
  const tde = useTranslations("dossierEmploye");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [mois, setMois] = useState(moisCourant());
  const [vue, setVue] = useState<VueFinancesPlateforme | null>(null);
  const [chargement, setChargement] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [talonEnCours, setTalonEnCours] = useState<string | null>(null);
  // Émission de paie : référence par employé + confirmation.
  const [references, setReferences] = useState<Record<string, string>>({});
  const [aEmettre, setAEmettre] = useState<LignePaieEmploye | null>(null);
  // Saisie de dépense.
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    libelle: "",
    categorie: "hebergement_services" as CategorieDepensePlateforme,
    montant: "",
    devise: "USD",
  });
  const [fichierJustificatif, setFichierJustificatif] = useState<File | null>(null);
  // Filtre + refus de dépense.
  const [filtreStatut, setFiltreStatut] = useState<"" | StatutDepensePlateforme>("");
  const [refusId, setRefusId] = useState<string | null>(null);
  const [motifRefus, setMotifRefus] = useState("");

  const charger = useCallback(async () => {
    try {
      const v = await getDataProvider().getVueFinancesPlateforme(mois);
      setVue(v);
    } catch {
      setErreur(tf("errorGeneric"));
    } finally {
      setChargement(false);
    }
  }, [mois, tf]);

  useEffect(() => {
    setChargement(true);
    charger();
  }, [charger]);

  function messageErreur(e: unknown): string {
    const code = e instanceof Error ? e.message : "";
    if (code.startsWith("ERR_")) {
      try {
        return te(`errors.${code}` as "errors.ERR_INTROUVABLE");
      } catch {
        return tf("errorGeneric");
      }
    }
    return tf("errorGeneric");
  }

  async function agir(action: () => Promise<void>, succes: string) {
    setOccupe(true);
    setMessage(null);
    setErreur(null);
    try {
      await action();
      setMessage(succes);
      await charger();
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(false);
    }
  }

  // Talon de paie (2026-11-08) : le Super Admin télécharge le talon
  // de chaque paie depuis l'historique — PDF régénéré à la demande
  // depuis les instantanés de la paie.
  async function telechargerTalon(paieId: string) {
    setTalonEnCours(paieId);
    setErreur(null);
    try {
      const res = await getDataProvider().genererTalonPaie(paieId);
      telechargerBase64Pdf(res.contenuBase64, res.nomFichier);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setTalonEnCours(null);
    }
  }

  async function confirmerEmission() {
    if (!aEmettre) return;
    const ligne = aEmettre;
    setAEmettre(null);
    await agir(
      async () => {
        await getDataProvider().emettrePaieEmploye(
          ligne.compte_id,
          mois,
          references[ligne.compte_id] ?? null
        );
      },
      tf("issuedMsg")
    );
  }

  async function ajouterDepense() {
    await agir(async () => {
      let justificatif = null;
      if (fichierJustificatif) {
        justificatif = {
          nom_fichier: fichierJustificatif.name,
          contenu: await fichierVersDataUrl(fichierJustificatif),
          mime_type: fichierJustificatif.type || null,
          taille_octets: fichierJustificatif.size,
        };
      }
      await getDataProvider().saisirDepensePlateforme({
        date: form.date,
        libelle: form.libelle,
        categorie: form.categorie,
        montant: Number(form.montant),
        devise: form.devise,
        justificatif,
      });
      setForm({ ...form, libelle: "", montant: "" });
      setFichierJustificatif(null);
    }, tf("expenseAddedMsg"));
  }

  async function validerDepense(dep: DepensePlateforme) {
    await agir(
      () => getDataProvider().validerDepensePlateforme(dep.id).then(() => undefined),
      tf("validatedMsg")
    );
  }

  async function refuserDepense(dep: DepensePlateforme) {
    await agir(async () => {
      await getDataProvider().refuserDepensePlateforme(dep.id, motifRefus);
      setRefusId(null);
      setMotifRefus("");
    }, tf("refusedMsg"));
  }

  if (chargement && !vue) {
    return <p className="text-sm text-slate-500">…</p>;
  }

  const estSuper = vue?.acteur_role === "super_admin";
  const depensesVisibles = (vue?.depenses ?? []).filter(
    (d) => !filtreStatut || d.statut === filtreStatut
  );

  return (
    <div className="space-y-5">
      {/* Bandeau de titre marine « Marine & Or » (2026-11-08). */}
      <BandeauPage>
        <h1 className="text-xl font-bold text-white md:text-2xl">
          {estSuper ? tf("title") : tf("titleAdmin")}
        </h1>
        <p className="mt-1 text-sm text-slate-300">
          {estSuper ? tf("subtitle") : tf("subtitleAdmin")}
        </p>
      </BandeauPage>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-semibold text-navy">
          {tf("monthLabel")}
          <input
            type="month"
            value={mois}
            onChange={(e) => setMois(e.target.value || moisCourant())}
            className={`ml-2 ${SELECT}`}
          />
        </label>
      </div>

      {message ? (
        <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
          {message}
        </p>
      ) : null}
      {erreur ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {erreur}
        </p>
      ) : null}

      {/* ---- Totaux du mois, par devise — SUPER ADMIN SEUL (lot A,
          2026-11-08) : chez l'employé, aucun total ne mélange sa
          paie et les dépenses ; la boîte n'existe que dans la vue
          plateforme du Super Admin. ---- */}
      {estSuper ? (
      <section className={CARTE}>
        <h2 className="text-base font-bold text-navy">
          {tf("totalsTitle")}
        </h2>
        {vue && vue.totaux.length > 0 ? (
          // Équilibrage bureau (2026-11-08) : une seule devise =
          // sa carte prend la pleine largeur (ses 3 tuiles xl
          // remplissent la rangée) au lieu d'un tiers de grille
          // avec un grand vide à droite.
          <div
            className={
              vue.totaux.length === 1
                ? "mt-3 grid gap-3"
                : "mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            }
          >
            {vue.totaux.map((t) => (
              <div key={t.devise} className="rounded-xl border border-slate-200 p-3 min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {t.devise}
                </p>
                {/* Bureau large (xl) : bande de statistiques — les
                    3 métriques de la devise deviennent des tuiles
                    (libellé au-dessus, montant en avant) au lieu de
                    lignes étirées. En dessous de xl : lignes
                    libellé/valeur d'origine, inchangées. */}
                <dl className="mt-2 space-y-1 text-sm xl:grid xl:grid-cols-3 xl:gap-2 xl:space-y-0">
                  <div className="flex justify-between gap-2 xl:flex-col xl:justify-start xl:gap-0.5 xl:rounded-lg xl:bg-slate-50 xl:p-2.5 min-w-0">
                    <dt className="text-slate-600">{tf("totalsPay")}</dt>
                    <dd className="font-bold text-navy xl:text-base whitespace-nowrap">
                      {formatMoney(t.paie_emise, t.devise, locale)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 xl:flex-col xl:justify-start xl:gap-0.5 xl:rounded-lg xl:bg-slate-50 xl:p-2.5 min-w-0">
                    <dt className="text-slate-600">{tf("totalsValidated")}</dt>
                    <dd className="font-bold text-navy xl:text-base whitespace-nowrap">
                      {formatMoney(t.depenses_validees, t.devise, locale)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2 xl:flex-col xl:justify-start xl:gap-0.5 xl:rounded-lg xl:bg-slate-50 xl:p-2.5 min-w-0">
                    <dt className="text-slate-600">{tf("totalsPending")}</dt>
                    <dd className="font-semibold text-amber-700 xl:text-base whitespace-nowrap">
                      {formatMoney(t.depenses_en_attente, t.devise, locale)}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">{tf("totalsEmpty")}</p>
        )}
      </section>
      ) : null}

      {/* ---- Bloc PAIE (lot A : domaine 1, nettement séparé des
          demandes de dépenses ci-dessous) ---- */}
      <section className={CARTE}>
        <h2 className="text-base font-bold text-navy">
          {estSuper ? tf("payTitle") : tf("payTitleAdmin")}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          {estSuper ? tf("payIntro") : tf("payIntroAdmin")}
        </p>
        {/* Bureau large (xl) — ÉQUILIBRAGE (captures bureau du
            fondateur, 2026-11-08) :
            - Vue Admin : sa ligne de paie et son historique se
              placent CÔTE À CÔTE (grille 12 colonnes : paie 7/12,
              historique 5/12, hauteurs équilibrées) au lieu d'être
              empilés avec la carte paie en demi-cellule et un grand
              vide à droite.
            - Vue Super Admin : grille 2 colonnes pleine largeur
              (inchangée), historique dessous ; si UNE seule ligne
              de paie existe, elle occupe la pleine largeur de la
              grille (xl:col-span-2) au lieu de laisser une
              demi-cellule vide béante.
            En dessous de xl : pile verticale d'origine, inchangée. */}
        <div
          className={
            estSuper ? "" : "xl:grid xl:grid-cols-12 xl:items-start xl:gap-6"
          }
        >
          <div className={estSuper ? "" : "min-w-0 xl:col-span-7"}>
            <div
              className={
                estSuper
                  ? "mt-4 space-y-3 xl:grid xl:grid-cols-2 xl:gap-3 xl:space-y-0"
                  : "mt-4 space-y-3"
              }
            >
              {(vue?.lignes_paie ?? []).map((ligne) => (
                <article
                  key={ligne.compte_id}
                  className={`min-w-0 rounded-xl border border-slate-200 p-4${
                    estSuper && (vue?.lignes_paie.length ?? 0) === 1
                      ? " xl:col-span-2"
                      : ""
                  }`}
                >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-navy">{ligne.nom}</h3>
                  <p className="truncate text-sm text-slate-500">
                    {ligne.email}
                    {ligne.display_id ? ` · ${ligne.display_id}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    <span className="font-semibold">{tf("colContract")} : </span>
                    {ligne.contrat_prepare && ligne.contrat_montant !== null ? (
                      <>
                        {formatMoney(
                          ligne.contrat_montant,
                          ligne.contrat_devise ?? "USD",
                          locale
                        )}
                        {ligne.contrat_modalites
                          ? ` · ${ligne.contrat_modalites}`
                          : ""}
                      </>
                    ) : (
                      tf("contractNone")
                    )}
                  </p>
                  {/* Coordonnées de paiement du membre (2026-11-08) :
                      bloc structuré selon le moyen ; absentes = la
                      paie ne peut pas partir (blocage « coordonnees »). */}
                  {ligne.coordonnees_paiement ? (
                    <div className="mt-1">
                      <span className="text-sm font-semibold text-slate-700">
                        {tf("payCoordinatesLabel")} :{" "}
                      </span>
                      <CoordonneesPaiementVue
                        coordonnees={ligne.coordonnees_paiement}
                      />
                    </div>
                  ) : null}
                </div>
                {/* Correctif captures 2026-11-08 : le bloc ne doit
                    JAMAIS imposer sa largeur (ancien shrink-0) — la
                    destination composée (« Virement — BCB, agence
                    Rohero — compte …, SWIFT … — Nom ») se replie sur
                    plusieurs lignes (break-words + min-w-0), le
                    montant reste sur UNE ligne, aucun défilement
                    horizontal de la page. */}
                <div className="min-w-0 text-right">
                  {ligne.paie ? (
                    <>
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">
                        ✓ {tf("statusIssued")}
                      </span>
                      <p className="mt-1.5 whitespace-nowrap text-sm font-bold text-navy">
                        {formatMoney(
                          ligne.paie.montant,
                          ligne.paie.devise,
                          locale
                        )}
                      </p>
                      <p className="break-words text-xs text-slate-500">
                        {formatDate(ligne.paie.emis_le, locale)}
                        {ligne.paie.reference
                          ? ` · ${formatReferencePaie(ligne.paie.reference, locale)}`
                          : ""}
                      </p>
                      {ligne.paie.paiement_destination ? (
                        <p className="break-words text-xs text-slate-500">
                          {tf("payDestinationLabel")} :{" "}
                          {ligne.paie.paiement_destination}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                      {ligne.blocages.length > 0
                        ? tf("statusBlocked")
                        : tf("statusToIssue")}
                    </span>
                  )}
                </div>
              </div>
              {!ligne.paie && ligne.blocages.length > 0 ? (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-amber-900">
                  {ligne.blocages.map((b) => (
                    <span
                      key={b}
                      className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-800"
                    >
                      {b === "dossier"
                        ? tf("blockDossier")
                        : b === "contrat"
                          ? tf("blockContrat")
                          : b === "montant"
                            ? tf("blockMontant")
                            : b === "coordonnees"
                              ? tf("blockCoordonnees")
                              : tf("blockDejaEmise")}
                    </span>
                  ))}
                  {!ligne.dossier_complet ? (
                    <span className="text-xs">
                      {tf("missingLabel")}{" "}
                      {ligne.dossier_manquants
                        .map((m) => tde(`elements.${m}` as "elements.photo"))
                        .join(", ")}
                    </span>
                  ) : null}
                </p>
              ) : null}
              {estSuper && !ligne.paie && ligne.blocages.length === 0 ? (
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <Field
                      id={`ref-paie-${ligne.compte_id}`}
                      label={tf("referenceLabel")}
                      value={references[ligne.compte_id] ?? ""}
                      onChange={(v) =>
                        setReferences({ ...references, [ligne.compte_id]: v })
                      }
                      placeholder={tf("referencePlaceholder")}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={occupe}
                    onClick={() => setAEmettre(ligne)}
                    className={BOUTON_OR}
                  >
                    {tf("issueButton")}
                  </button>
                </div>
              ) : null}
            </article>
              ))}
            </div>
          </div>

          <div className={estSuper ? "" : "min-w-0 xl:col-span-5"}>
            {/* Historique des paies émises. */}
            <h3
              className={
                estSuper
                  ? "mt-6 text-sm font-bold uppercase tracking-wide text-slate-500"
                  : "mt-6 text-sm font-bold uppercase tracking-wide text-slate-500 xl:mt-4"
              }
            >
          {estSuper ? tf("historyTitle") : tf("historyTitleAdmin")}
        </h3>
        {vue && vue.historique_paies.length > 0 ? (
          <ul className="mt-2 divide-y divide-slate-100">
            {vue.historique_paies.map((p) => (
              <li key={p.id} className="py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="font-semibold text-navy">
                      {p.employe_nom ?? p.profil_id}
                    </span>{" "}
                    <span className="break-words text-slate-500">
                      · {p.mois} · {formatDate(p.emis_le, locale)}
                      {p.reference
                        ? ` · ${formatReferencePaie(p.reference, locale)}`
                        : ""}
                    </span>
                  </span>
                  <span className="whitespace-nowrap font-bold text-navy">
                    {formatMoney(p.montant, p.devise, locale)}
                  </span>
                </div>
                {p.paiement_destination ? (
                  <p className="mt-0.5 break-words text-xs text-slate-500">
                    {tf("payDestinationLabel")} : {p.paiement_destination}
                  </p>
                ) : null}
                {estSuper ? (
                  <button
                    type="button"
                    disabled={talonEnCours !== null}
                    onClick={() => telechargerTalon(p.id)}
                    className="mt-0.5 font-semibold text-navy underline decoration-gold decoration-2 underline-offset-2 disabled:opacity-50"
                  >
                    {talonEnCours === p.id ? "…" : tf("payStubDownload")}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-600">{tf("historyEmpty")}</p>
        )}
          </div>
        </div>
      </section>

      {/* ---- Bloc DÉPENSES (lot A : domaine 2 — chez l'Admin, ses
          DEMANDES de dépenses : soumises par lui, validées par le
          Super Admin ; chez le Super Admin, les dépenses de
          fonctionnement de la plateforme) ---- */}
      <section className={CARTE}>
        <h2 className="text-base font-bold text-navy">
          {estSuper ? tf("expensesTitle") : tf("expensesTitleRequestsAdmin")}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          {estSuper ? tf("expensesIntroSuper") : tf("expensesIntroAdmin")}
        </p>

        {/* Bureau large (xl) — ÉQUILIBRAGE (2026-11-08) : liste à
            gauche, formulaire de saisie en colonne droite ANCRÉE
            comme un panneau latéral assumé (fond crème, bordure
            or/40, sticky). Proportions par rôle : Admin = liste
            3/5, formulaire 2/5 (grille 5 colonnes) ; Super Admin =
            liste 2/3, formulaire 1/3 (grille 3 colonnes, inchangé).
            L'ordre DOM reste formulaire PUIS liste — la lecture
            mobile est strictement inchangée, xl:order-* n'échange
            que la présentation bureau. La grille est en
            items-stretch : la colonne liste épouse la hauteur du
            panneau, et l'état vide se centre verticalement au lieu
            de flotter en haut d'un vaste blanc. */}
        <div
          className={`mt-4 xl:grid xl:items-stretch xl:gap-6 ${
            estSuper ? "xl:grid-cols-3" : "xl:grid-cols-5"
          }`}
        >
          <div
            className={
              estSuper
                ? "xl:order-2 xl:col-span-1 min-w-0"
                : "xl:order-2 xl:col-span-2 min-w-0"
            }
          >
            {/* Formulaire de saisie (plateforme) : une colonne dans
            la colonne latérale xl, deux colonnes en md comme
            avant ; en xl, le formulaire EST le panneau latéral
            (fond crème + bordure or/40 + padding), sticky. */}
            <form
              className="grid gap-3 md:grid-cols-2 xl:sticky xl:top-6 xl:grid-cols-1 xl:rounded-2xl xl:border xl:border-gold/40 xl:bg-cream xl:p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void ajouterDepense();
          }}
        >
          <Field
            id="dep-date"
            label={tf("formDate")}
            type="date"
            value={form.date}
            onChange={(v) => setForm({ ...form, date: v })}
            required
          />
          <Field
            id="dep-libelle"
            label={tf("formLabel")}
            value={form.libelle}
            onChange={(v) => setForm({ ...form, libelle: v })}
            placeholder={tf("formLabelPlaceholder")}
            required
          />
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-navy">
              {tf("formCategory")}
            </span>
            <select
              value={form.categorie}
              onChange={(e) =>
                setForm({
                  ...form,
                  categorie: e.target.value as CategorieDepensePlateforme,
                })
              }
              className={`w-full ${SELECT}`}
            >
              {CATEGORIES_DEPENSE_PLATEFORME.map((c) => (
                <option key={c} value={c}>
                  {tf(`categories.${c}` as "categories.autre")}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <Field
              id="dep-montant"
              label={tf("formAmount")}
              type="number"
              value={form.montant}
              onChange={(v) => setForm({ ...form, montant: v })}
              required
            />
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-navy">
                {tf("formCurrency")}
              </span>
              <select
                value={form.devise}
                onChange={(e) => setForm({ ...form, devise: e.target.value })}
                className={`w-full ${SELECT}`}
              >
                {DEVISES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="md:col-span-2 xl:col-span-1">
            <DocumentUpload
              fichier={fichierJustificatif}
              onFichierChange={setFichierJustificatif}
              label={tf("formReceipt")}
            />
          </div>
          <div className="md:col-span-2 xl:col-span-1">
            <button type="submit" disabled={occupe} className={BOUTON_MARINE}>
              {tf("formSubmit")}
            </button>
          </div>
        </form>
          </div>

          <div
            className={
              estSuper
                ? "xl:order-1 xl:col-span-2 min-w-0 xl:flex xl:flex-col"
                : "xl:order-1 xl:col-span-3 min-w-0 xl:flex xl:flex-col"
            }
          >
        {/* Filtre par statut + liste du mois. */}
        <div className="mt-6 flex flex-wrap items-center gap-2 xl:mt-0">
          <label className="text-sm font-semibold text-navy">
            {tf("filterStatusLabel")}
            <select
              value={filtreStatut}
              onChange={(e) =>
                setFiltreStatut(e.target.value as "" | StatutDepensePlateforme)
              }
              className={`ml-2 ${SELECT}`}
            >
              <option value="">{tf("filterAll")}</option>
              <option value="en_attente">{tf("statusDepense.en_attente")}</option>
              <option value="validee">{tf("statusDepense.validee")}</option>
              <option value="refusee">{tf("statusDepense.refusee")}</option>
            </select>
          </label>
        </div>
        {depensesVisibles.length > 0 ? (
          <ul className="mt-3 space-y-3">
            {depensesVisibles.map((dep) => (
              <li
                key={dep.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-navy">{dep.libelle}</p>
                    <p className="text-sm text-slate-500">
                      {formatDate(dep.date, locale)} ·{" "}
                      {tf(`categories.${dep.categorie}` as "categories.autre")} ·{" "}
                      {tf("byLabel", { nom: dep.saisi_par_nom ?? "" })}
                      {dep.justificatif_url ? (
                        <>
                          {" · "}
                          <a
                            href={dep.justificatif_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-navy underline"
                          >
                            {tf("receiptOpen")}
                          </a>
                        </>
                      ) : null}
                    </p>
                    {dep.statut === "refusee" && dep.motif_refus ? (
                      <p className="mt-1 text-sm font-semibold text-red-700">
                        {dep.motif_refus}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="whitespace-nowrap font-bold text-navy">
                      {formatMoney(dep.montant, dep.devise, locale)}
                    </p>
                    <span
                      className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        dep.statut === "validee"
                          ? "bg-green-100 text-green-800"
                          : dep.statut === "refusee"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {tf(
                        `statusDepense.${dep.statut}` as "statusDepense.en_attente"
                      )}
                    </span>
                  </div>
                </div>
                {estSuper && dep.statut === "en_attente" ? (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={occupe}
                        onClick={() => validerDepense(dep)}
                        className="rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {tf("validateButton")}
                      </button>
                      <button
                        type="button"
                        disabled={occupe}
                        onClick={() => {
                          setRefusId(refusId === dep.id ? null : dep.id);
                          setMotifRefus("");
                        }}
                        className="rounded-full border border-red-300 bg-white px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {tf("refuseButton")}
                      </button>
                    </div>
                    {refusId === dep.id ? (
                      <div className="rounded-xl bg-red-50 p-3">
                        <Field
                          id={`motif-${dep.id}`}
                          label={tf("refuseMotifLabel")}
                          value={motifRefus}
                          onChange={setMotifRefus}
                          placeholder={tf("refuseMotifPlaceholder")}
                        />
                        <button
                          type="button"
                          disabled={occupe || !motifRefus.trim()}
                          onClick={() => refuserDepense(dep)}
                          className="mt-2 rounded-full bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          {tf("refuseConfirm")}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-slate-600 xl:flex xl:flex-1 xl:items-center xl:justify-center">
            {tf("expensesEmpty")}
          </p>
        )}
          </div>
        </div>
      </section>

      {aEmettre ? (
        <ConfirmDialog
          title={tf("issueConfirmTitle")}
          text={tf("issueConfirmText", {
            nom: aEmettre.nom,
            mois,
            montant:
              aEmettre.contrat_montant !== null
                ? formatMoney(
                    aEmettre.contrat_montant,
                    aEmettre.contrat_devise ?? "USD",
                    locale
                  )
                : "",
          })}
          confirmLabel={tf("issueButton")}
          cancelLabel={tc("cancel")}
          danger={false}
          onConfirm={confirmerEmission}
          onCancel={() => setAEmettre(null)}
        />
      ) : null}
    </div>
  );
}

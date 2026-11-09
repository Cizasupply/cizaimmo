"use client";

/**
 * « Mon dossier employé » (2026-11-08, décision du fondateur) — page
 * console réservée aux rôles admin / super_admin : l'employé voit et
 * complète SON dossier complet (photo de profil, pièce d'identité,
 * téléphone + ADRESSE postale), avec le statut de complétude calculé.
 * Exigence suivie, NON bloquante : rien dans la console n'est
 * conditionné à ce dossier (le Super Admin le suit dans l'Équipe).
 * Les clients n'ont pas accès à cette page (garde du ConsoleShell +
 * ERR_ACCES_PLATEFORME du fournisseur).
 *
 * Réorganisation (2026-11-08, décision du fondateur) : chaque
 * section renseignée s'affiche en LECTURE SEULE (carte
 * d'information) — photo sans téléversement ouvert, pièce en
 * lecture, adresse et coordonnées en valeurs — et le formulaire
 * ne s'ouvre qu'au clic sur « Modifier » ; enregistrement réussi
 * = retour à la lecture. Le contrat VALIDÉ s'affiche en ligne de
 * résultat (document + date), jamais en formulaire.
 */

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getDataProvider } from "@/lib/data";
import type { DossierEmploye, PackEmploye, PaieEmploye } from "@/lib/data";
import BandeauPage from "@/components/BandeauPage";
import DocumentUpload from "@/components/DocumentUpload";
import Field from "@/components/Field";
import CarteEmploye from "@/components/CarteEmploye";
import { telechargerBase64Pdf } from "@/components/PackEmployeAdmin";
import { formatDate, formatMoney, formatReferencePaie } from "@/lib/format";
import {
  MOYENS_PAIEMENT_EMPLOYE,
  instantaneDestinationPaiement,
  type MoyenPaiementEmploye,
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
// slate très pâle — même traitement sur les pages console de la passe.
const CARTE = "rounded-2xl border border-gold/40 bg-white p-5 shadow-sm";
const BOUTON_MARINE =
  "rounded-full bg-navy px-4 py-2 text-sm font-bold text-white hover:bg-navy-light disabled:opacity-50";
const BOUTON_OR =
  "rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy-dark shadow-sm transition hover:brightness-105 disabled:opacity-50";

export default function MonDossierEmployePage() {
  const t = useTranslations("dossierEmploye");
  const tp = useTranslations("packEmploye");
  const tf = useTranslations("financesPlateforme");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [dossier, setDossier] = useState<DossierEmploye | null>(null);
  const [pack, setPack] = useState<PackEmploye | null>(null);
  const [paies, setPaies] = useState<PaieEmploye[]>([]);
  const [fichierContrat, setFichierContrat] = useState<File | null>(null);
  const [occupePack, setOccupePack] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [fichierPhoto, setFichierPhoto] = useState<File | null>(null);
  const [fichierPiece, setFichierPiece] = useState<File | null>(null);
  const [occupe, setOccupe] = useState<"photo" | "piece" | "form" | "paiement" | null>(null);
  // Réorganisation dossiers (2026-11-08, décision du fondateur) :
  // chaque section RENSEIGNÉE s'affiche en LECTURE SEULE (carte
  // d'information) ; son formulaire / téléversement ne s'ouvre
  // qu'au clic sur « Modifier ». sectionOuverte = la section en
  // cours d'édition (null = toutes en lecture). Une section NON
  // renseignée présente directement son formulaire (rien à
  // protéger, l'action d'apport reste immédiate).
  const [sectionOuverte, setSectionOuverte] = useState<
    "photo" | "piece" | "adresse" | "paiement" | null
  >(null);
  const [talonEnCours, setTalonEnCours] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [form, setForm] = useState({
    telephone: "",
    adresse: "",
    adresse_ville: "",
    adresse_code_postal: "",
    adresse_pays: "",
  });
  // Coordonnées de paiement (2026-11-08) : formulaire séparé — les
  // champs affichés dépendent du moyen choisi (virement / mobile).
  const [formPaiement, setFormPaiement] = useState({
    moyen: "" as "" | MoyenPaiementEmploye,
    titulaire: "",
    banque: "",
    agence: "",
    numero_compte: "",
    iban: "",
    swift: "",
    operateur: "",
    numero_mobile: "",
  });

  const charger = useCallback(async () => {
    try {
      const d = await getDataProvider().getMonDossierEmploye();
      setDossier(d);
      // Pack employé (contrat / charte / carte) : chargé à part — un
      // échec ici ne casse pas le dossier.
      getDataProvider()
        .getMonPackEmploye()
        .then(setPack)
        .catch(() => undefined);
      // Finances de la plateforme : MES paies émises (lecture seule).
      getDataProvider()
        .listerMesPaies()
        .then(setPaies)
        .catch(() => undefined);
      setForm({
        telephone: d.telephone ?? "",
        adresse: d.adresse ?? "",
        adresse_ville: d.adresse_ville ?? "",
        adresse_code_postal: d.adresse_code_postal ?? "",
        adresse_pays: d.adresse_pays ?? "",
      });
      setFormPaiement({
        moyen: d.paiement_moyen ?? "",
        // Titulaire prérempli avec le nom de l'employé tant qu'aucun
        // titulaire n'a été enregistré.
        titulaire: d.paiement_titulaire ?? d.nom,
        banque: d.paiement_banque ?? "",
        agence: d.paiement_agence ?? "",
        numero_compte: d.paiement_numero_compte ?? "",
        iban: d.paiement_iban ?? "",
        swift: d.paiement_swift ?? "",
        operateur: d.paiement_operateur ?? "",
        numero_mobile: d.paiement_numero_mobile ?? "",
      });
    } catch {
      setErreur(t("errorGeneric"));
    } finally {
      setChargement(false);
    }
  }, [t]);

  useEffect(() => {
    charger();
  }, [charger]);

  function messageErreur(e: unknown): string {
    const code = e instanceof Error ? e.message : "";
    return code === "ERR_DOCUMENT_DOUBLON"
      ? t("errorDuplicate")
      : code === "ERR_DOCUMENT_FORMAT"
        ? t("errorFormat")
        : code === "ERR_DOCUMENT_TROP_GROS"
          ? t("errorTooBig")
          : code === "ERR_COORDONNEES_PAIEMENT_INVALIDES"
            ? t("errorInvalidPayment")
            : code === "ERR_STATUT_INVALIDE"
              ? t("errorContractStatus")
              : t("errorGeneric");
  }

  async function envoyer(kind: "photo" | "piece") {
    const fichier = kind === "photo" ? fichierPhoto : fichierPiece;
    if (!fichier || !dossier) return;
    setOccupe(kind);
    setMessage(null);
    setErreur(null);
    try {
      const contenu = await fichierVersDataUrl(fichier);
      const provider = getDataProvider();
      const entree = {
        entite_type: "compte" as const,
        entite_id: dossier.compte_id,
        nom_fichier: fichier.name,
        taille_octets: fichier.size,
        mime_type: fichier.type || null,
        contenu,
      };
      const maj =
        kind === "photo"
          ? await provider.televerserPhotoDossierEmploye({
              ...entree,
              type: "autre",
            })
          : await provider.televerserPieceDossierEmploye({
              ...entree,
              type: "piece_identite",
            });
      setDossier(maj);
      if (kind === "photo") setFichierPhoto(null);
      else setFichierPiece(null);
      // Enregistrement réussi : retour à la lecture seule.
      setSectionOuverte(null);
      setMessage(t("savedMsg"));
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(null);
    }
  }

  async function enregistrer() {
    setOccupe("form");
    setMessage(null);
    setErreur(null);
    try {
      const vide = (v: string) => {
        const nettoye = v.trim();
        return nettoye === "" ? null : nettoye;
      };
      const maj = await getDataProvider().mettreAJourDossierEmploye({
        telephone: vide(form.telephone),
        adresse: vide(form.adresse),
        adresse_ville: vide(form.adresse_ville),
        adresse_code_postal: vide(form.adresse_code_postal),
        adresse_pays: vide(form.adresse_pays),
      });
      setDossier(maj);
      setSectionOuverte(null);
      setMessage(t("savedMsg"));
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(null);
    }
  }

  // Coordonnées de paiement : enregistrement SÉPARÉ du reste du
  // dossier (elles ne touchent ni sa complétude ni la carte — elles
  // ne conditionnent que l'émission de la paie).
  async function enregistrerPaiement() {
    setOccupe("paiement");
    setMessage(null);
    setErreur(null);
    try {
      const vide = (v: string) => {
        const nettoye = v.trim();
        return nettoye === "" ? null : nettoye;
      };
      const maj = await getDataProvider().mettreAJourDossierEmploye({
        paiement_moyen: formPaiement.moyen === "" ? null : formPaiement.moyen,
        paiement_titulaire: vide(formPaiement.titulaire),
        paiement_banque: vide(formPaiement.banque),
        paiement_agence: vide(formPaiement.agence),
        paiement_numero_compte: vide(formPaiement.numero_compte),
        paiement_iban: vide(formPaiement.iban),
        paiement_swift: vide(formPaiement.swift),
        paiement_operateur: vide(formPaiement.operateur),
        paiement_numero_mobile: vide(formPaiement.numero_mobile),
      });
      setDossier(maj);
      setFormPaiement({
        moyen: maj.paiement_moyen ?? "",
        titulaire: maj.paiement_titulaire ?? maj.nom,
        banque: maj.paiement_banque ?? "",
        agence: maj.paiement_agence ?? "",
        numero_compte: maj.paiement_numero_compte ?? "",
        iban: maj.paiement_iban ?? "",
        swift: maj.paiement_swift ?? "",
        operateur: maj.paiement_operateur ?? "",
        numero_mobile: maj.paiement_numero_mobile ?? "",
      });
      setSectionOuverte(null);
      setMessage(t("savedMsg"));
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupe(null);
    }
  }

  // Talon de paie (2026-11-08) : PDF régénéré à la demande depuis la
  // paie émise (le fournisseur refuse toute paie qui n'est pas la
  // mienne — ERR_TALON_INTROUVABLE).
  async function telechargerTalon(paieId: string) {
    setTalonEnCours(paieId);
    setMessage(null);
    setErreur(null);
    try {
      const res = await getDataProvider().genererTalonPaie(paieId);
      telechargerBase64Pdf(res.contenuBase64, res.nomFichier);
    } catch {
      setErreur(tf("errorGeneric"));
    } finally {
      setTalonEnCours(null);
    }
  }

  async function telechargerMonContrat() {
    if (!dossier) return;
    setOccupePack(true);
    setMessage(null);
    setErreur(null);
    try {
      const res = await getDataProvider().genererContratEmploye(
        dossier.compte_id
      );
      telechargerBase64Pdf(res.contenuBase64, res.nomFichier);
    } catch {
      setErreur(tp("errorGeneric"));
    } finally {
      setOccupePack(false);
    }
  }

  async function envoyerContratSigne() {
    if (!fichierContrat || !dossier) return;
    setOccupePack(true);
    setMessage(null);
    setErreur(null);
    try {
      const contenu = await fichierVersDataUrl(fichierContrat);
      await getDataProvider().televerserContratEmployeSigne({
        entite_type: "compte",
        entite_id: dossier.compte_id,
        nom_fichier: fichierContrat.name,
        taille_octets: fichierContrat.size,
        mime_type: fichierContrat.type || null,
        contenu,
        type: "contrat",
      });
      const p = await getDataProvider().getMonPackEmploye();
      setPack(p);
      setFichierContrat(null);
      setMessage(tp("contratSavedMsg"));
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setOccupePack(false);
    }
  }

  async function ouvrirPiece() {
    if (!dossier?.piece_identite) return;
    try {
      const { url } = await getDataProvider().telechargerDocument(
        dossier.piece_identite.id
      );
      window.open(url, "_blank", "noopener");
    } catch {
      setErreur(t("errorGeneric"));
    }
  }

  if (chargement) {
    return <p className="text-sm text-slate-500">…</p>;
  }

  // Réorganisation dossiers (2026-11-08) : une section est en
  // ÉDITION si elle a été ouverte par « Modifier » OU si elle n'est
  // pas encore renseignée (formulaire d'apport direct) ; renseignée
  // et non ouverte = LECTURE SEULE.
  const photoRenseignee = Boolean(dossier?.photo_profil_path);
  const pieceRenseignee = Boolean(dossier?.piece_identite);
  const adresseRenseignee = Boolean(
    dossier &&
      (dossier.telephone ||
        dossier.adresse ||
        dossier.adresse_ville ||
        dossier.adresse_code_postal ||
        dossier.adresse_pays)
  );
  const paiementRenseigne = Boolean(dossier?.coordonnees_paiement);
  const editionPhoto = sectionOuverte === "photo" || !photoRenseignee;
  const editionPiece = sectionOuverte === "piece" || !pieceRenseignee;
  const editionAdresse = sectionOuverte === "adresse" || !adresseRenseignee;
  const editionPaiement = sectionOuverte === "paiement" || !paiementRenseigne;

  return (
    <div className="space-y-5">
      {/* Bandeau de titre marine « Marine & Or » (2026-11-08). */}
      <BandeauPage>
        <h1 className="text-xl font-bold text-white">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-300">{t("subtitle")}</p>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">{t("intro")}</p>
      </BandeauPage>

      {message ? (
        <p className="rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
          {message}
        </p>
      ) : null}
      {erreur ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {erreur}
        </p>
      ) : null}

      {dossier ? (
        <>
          {/* Statut de complétude — calculé, jamais bloquant. */}
          <section
            className={`${CARTE} ${
              dossier.complet
                ? "border-green-200 bg-green-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <p
              className={`text-base font-bold ${
                dossier.complet ? "text-green-800" : "text-amber-800"
              }`}
            >
              {dossier.complet ? `✓ ${t("complete")}` : t("incomplete")}
            </p>
            {!dossier.complet ? (
              <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-amber-900">
                <span className="font-semibold">{t("missingLabel")}</span>
                {dossier.manquants.map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-amber-800"
                  >
                    {t(`elements.${m}`)}
                  </span>
                ))}
              </p>
            ) : null}
          </section>

          {/* Progression du pack employé : Dossier → Charte → Contrat → Carte. */}
          {pack ? (
            <section className={`${CARTE} min-w-0`}>
              <h2 className="text-base font-bold text-navy">
                {tp("progressTitle")}
              </h2>
              <ol className="mt-3 grid gap-2 sm:grid-cols-4">
                {pack.progression.map((etape) => (
                  <li
                    key={etape.etape}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${
                      etape.etat === "faite"
                        ? "border-green-200 bg-green-50 text-green-800"
                        : etape.etat === "en_cours"
                          ? "border-gold/60 bg-cream text-navy"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}
                  >
                    <span className="mr-1.5">
                      {etape.etat === "faite"
                        ? "✓"
                        : etape.etat === "en_cours"
                          ? "●"
                          : "○"}
                    </span>
                    {tp(
                      etape.etape === "dossier"
                        ? "stepDossier"
                        : etape.etape === "charte"
                          ? "stepCharte"
                          : etape.etape === "contrat"
                            ? "stepContrat"
                            : "stepCarte"
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {/* Bureau large (xl) : Identité | Adresse en grille
              2 colonnes au lieu de cartes pleine largeur. En
              dessous de xl, pile verticale d'origine — ordre DOM
              et espacements mobiles inchangés. */}
          <div className="space-y-5 xl:grid xl:grid-cols-2 xl:items-start xl:gap-5 xl:space-y-0">
          {/* Identité : photo + pièce d'identité (bucket privé). */}
          <section className={`${CARTE} min-w-0`}>
            <h2 className="text-base font-bold text-navy">{t("idSection")}</h2>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-navy">{t("photo")}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      dossier.photo_profil_path
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {dossier.photo_profil_path
                      ? `✓ ${t("received")}`
                      : t("missing")}
                  </span>
                </div>
                {dossier.photo_profil_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={dossier.photo_profil_url}
                    alt={t("photo")}
                    className="mt-3 h-28 w-28 rounded-xl border border-slate-200 object-cover"
                  />
                ) : null}
                {editionPhoto ? (
                  <div className="mt-3">
                    <DocumentUpload
                      fichier={fichierPhoto}
                      onFichierChange={setFichierPhoto}
                      label={t("uploadPhoto")}
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {fichierPhoto ? (
                        <button
                          type="button"
                          disabled={occupe !== null}
                          onClick={() => envoyer("photo")}
                          className={BOUTON_MARINE}
                        >
                          {t("uploadPhoto")}
                        </button>
                      ) : null}
                      {photoRenseignee ? (
                        <button
                          type="button"
                          disabled={occupe !== null}
                          onClick={() => {
                            setFichierPhoto(null);
                            setSectionOuverte(null);
                          }}
                          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy hover:border-gold disabled:opacity-50"
                        >
                          {tc("cancel")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setSectionOuverte("photo")}
                      className={BOUTON_MARINE}
                    >
                      {tc("edit")}
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 p-3 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-navy">{t("piece")}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      dossier.piece_identite
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {dossier.piece_identite
                      ? `✓ ${t("received")}`
                      : t("missing")}
                  </span>
                </div>
                {dossier.piece_identite ? (
                  <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <span className="break-all font-medium">
                      {dossier.piece_identite.nom_fichier}
                    </span>
                    <button
                      type="button"
                      onClick={ouvrirPiece}
                      className="font-bold text-navy underline"
                    >
                      {t("open")}
                    </button>
                  </p>
                ) : null}
                {editionPiece ? (
                  <div className="mt-3">
                    <DocumentUpload
                      fichier={fichierPiece}
                      onFichierChange={setFichierPiece}
                      label={t("uploadId")}
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {fichierPiece ? (
                        <button
                          type="button"
                          disabled={occupe !== null}
                          onClick={() => envoyer("piece")}
                          className={BOUTON_MARINE}
                        >
                          {t("uploadId")}
                        </button>
                      ) : null}
                      {pieceRenseignee ? (
                        <button
                          type="button"
                          disabled={occupe !== null}
                          onClick={() => {
                            setFichierPiece(null);
                            setSectionOuverte(null);
                          }}
                          className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy hover:border-gold disabled:opacity-50"
                        >
                          {tc("cancel")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => setSectionOuverte("piece")}
                      className={BOUTON_MARINE}
                    >
                      {tc("edit")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Téléphone + adresse postale : lecture seule si
              renseignés, formulaire derrière « Modifier ». */}
          <section className={`${CARTE} min-w-0`}>
            <h2 className="text-base font-bold text-navy">{t("addressSection")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("addressHint")}</p>
            {editionAdresse ? (
              <>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Field
                    id="employe-telephone"
                    label={t("phone")}
                    value={form.telephone}
                    onChange={(v) => setForm({ ...form, telephone: v })}
                    autoComplete="tel"
                  />
                  <Field
                    id="employe-adresse"
                    label={t("address")}
                    value={form.adresse}
                    onChange={(v) => setForm({ ...form, adresse: v })}
                    autoComplete="street-address"
                  />
                  <Field
                    id="employe-ville"
                    label={t("city")}
                    value={form.adresse_ville}
                    onChange={(v) => setForm({ ...form, adresse_ville: v })}
                    autoComplete="address-level2"
                  />
                  <Field
                    id="employe-code-postal"
                    label={t("postalCode")}
                    value={form.adresse_code_postal}
                    onChange={(v) => setForm({ ...form, adresse_code_postal: v })}
                    autoComplete="postal-code"
                  />
                  <Field
                    id="employe-pays"
                    label={t("country")}
                    value={form.adresse_pays}
                    onChange={(v) => setForm({ ...form, adresse_pays: v })}
                    autoComplete="country-name"
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={occupe !== null}
                    onClick={enregistrer}
                    className={BOUTON_OR}
                  >
                    {occupe === "form" ? "…" : t("save")}
                  </button>
                  {adresseRenseignee ? (
                    <button
                      type="button"
                      disabled={occupe !== null}
                      onClick={() => setSectionOuverte(null)}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy hover:border-gold disabled:opacity-50"
                    >
                      {tc("cancel")}
                    </button>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <dl className="mt-3 space-y-1.5 text-sm text-slate-600">
                  {(
                    [
                      [t("phone"), dossier.telephone],
                      [t("address"), dossier.adresse],
                      [t("city"), dossier.adresse_ville],
                      [t("postalCode"), dossier.adresse_code_postal],
                      [t("country"), dossier.adresse_pays],
                    ] as [string, string | null][]
                  ).map(([libelle, valeur]) => (
                    <div
                      key={libelle}
                      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                    >
                      <dt className="shrink-0 font-semibold">{libelle}</dt>
                      <dd className="min-w-0 break-words text-right">
                        {valeur ?? t("notProvided")}
                      </dd>
                    </div>
                  ))}
                </dl>
                <button
                  type="button"
                  onClick={() => setSectionOuverte("adresse")}
                  className={`mt-4 ${BOUTON_MARINE}`}
                >
                  {tc("edit")}
                </button>
              </>
            )}
          </section>
          </div>

          {/* Bureau large (xl) : Coordonnées | (Charte + Contrat
              empilés). Sans pack, la section Coordonnées reste
              pleine largeur comme avant. */}
          <div className={pack ? "space-y-5 xl:grid xl:grid-cols-2 xl:items-start xl:gap-5 xl:space-y-0" : undefined}>
          {/* Coordonnées de paiement (2026-11-08) : où l'employé
              reçoit son salaire — coordonnées bancaires complètes
              structurées selon le moyen. Elles ne conditionnent QUE
              l'émission de la paie (ni le dossier, ni la carte). */}
          <section className={`${CARTE} min-w-0`}>
            <h2 className="text-base font-bold text-navy">{t("paymentSection")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("paymentIntro")}</p>
            {dossier.coordonnees_paiement ? (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                ✓ {t("paymentPresent")} :{" "}
                {instantaneDestinationPaiement(dossier.coordonnees_paiement)}
              </p>
            ) : (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
                {t("paymentMissing")}
              </p>
            )}
            {editionPaiement ? (
              <>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="min-w-0">
                <label
                  htmlFor="employe-paiement-moyen"
                  className="block text-sm font-semibold text-slate-900"
                >
                  {t("paymentMethod")}
                </label>
                <select
                  id="employe-paiement-moyen"
                  value={formPaiement.moyen}
                  onChange={(e) =>
                    setFormPaiement({
                      ...formPaiement,
                      moyen: e.target.value as "" | MoyenPaiementEmploye,
                    })
                  }
                  className="mt-1 w-full min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/40"
                >
                  <option value="">{t("paymentMethodNone")}</option>
                  {MOYENS_PAIEMENT_EMPLOYE.map((m) => (
                    <option key={m} value={m}>
                      {t(`paymentMethods.${m}`)}
                    </option>
                  ))}
                </select>
              </div>
              <Field
                id="employe-paiement-titulaire"
                label={t("paymentHolder")}
                value={formPaiement.titulaire}
                onChange={(v) => setFormPaiement({ ...formPaiement, titulaire: v })}
                autoComplete="name"
              />
              {formPaiement.moyen === "virement" ? (
                <>
                  <Field
                    id="employe-paiement-banque"
                    label={t("paymentBank")}
                    value={formPaiement.banque}
                    onChange={(v) => setFormPaiement({ ...formPaiement, banque: v })}
                  />
                  <Field
                    id="employe-paiement-agence"
                    label={t("paymentAgency")}
                    value={formPaiement.agence}
                    onChange={(v) => setFormPaiement({ ...formPaiement, agence: v })}
                  />
                  <Field
                    id="employe-paiement-compte"
                    label={t("paymentAccountNumber")}
                    value={formPaiement.numero_compte}
                    onChange={(v) =>
                      setFormPaiement({ ...formPaiement, numero_compte: v })
                    }
                  />
                  <Field
                    id="employe-paiement-iban"
                    label={t("paymentIban")}
                    value={formPaiement.iban}
                    onChange={(v) => setFormPaiement({ ...formPaiement, iban: v })}
                  />
                  <Field
                    id="employe-paiement-swift"
                    label={t("paymentSwift")}
                    value={formPaiement.swift}
                    onChange={(v) => setFormPaiement({ ...formPaiement, swift: v })}
                  />
                </>
              ) : null}
              {formPaiement.moyen === "mobile_money" ? (
                <>
                  <Field
                    id="employe-paiement-operateur"
                    label={t("paymentOperator")}
                    value={formPaiement.operateur}
                    onChange={(v) =>
                      setFormPaiement({ ...formPaiement, operateur: v })
                    }
                  />
                  <Field
                    id="employe-paiement-mobile"
                    label={t("paymentMobileNumber")}
                    value={formPaiement.numero_mobile}
                    onChange={(v) =>
                      setFormPaiement({ ...formPaiement, numero_mobile: v })
                    }
                    autoComplete="tel"
                  />
                </>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={occupe !== null}
                onClick={enregistrerPaiement}
                className={BOUTON_OR}
              >
                {occupe === "paiement" ? "…" : t("save")}
              </button>
              {paiementRenseigne ? (
                <button
                  type="button"
                  disabled={occupe !== null}
                  onClick={() => setSectionOuverte(null)}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy hover:border-gold disabled:opacity-50"
                >
                  {tc("cancel")}
                </button>
              ) : null}
            </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setSectionOuverte("paiement")}
                className={`mt-4 ${BOUTON_MARINE}`}
              >
                {tc("edit")}
              </button>
            )}
          </section>

          {pack ? (
            <div className="space-y-5">
              {/* Charte de confidentialité : statut de l'acceptation datée. */}
              <section className={`${CARTE} min-w-0`}>
                <h2 className="text-base font-bold text-navy">
                  {tp("charteSectionTitle")}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  {pack.charte_acceptee_le
                    ? `✓ ${tp("charteAcceptedOn", {
                        date: formatDate(pack.charte_acceptee_le, locale),
                      })}`
                    : tp("chartePending")}
                </p>
              </section>

              {/* Contrat d'engagement : téléchargement + dépôt du signé. */}
              <section className={`${CARTE} min-w-0`}>
                <h2 className="text-base font-bold text-navy">
                  {tp("contratSectionTitle")}
                </h2>
                {pack.contrat_statut === "sans_objet" ? (
                  <p className="mt-2 text-sm text-slate-600">
                    {tp("contratNotPrepared")}
                  </p>
                ) : (
                  <>
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-700">
                      <span className="rounded-full bg-cream px-2.5 py-0.5 text-xs font-bold text-navy">
                        {tp(
                          `contratStatus.${pack.contrat_statut}` as "contratStatus.valide"
                        )}
                      </span>
                      {pack.contrat_parametres ? (
                        <span>
                          {tp(
                            `contratWay.${pack.contrat_parametres.voie}` as "contratWay.travail"
                          )}
                        </span>
                      ) : null}
                      {pack.contrat_prepare_le ? (
                        <span className="text-slate-500">
                          {tp("contratPreparedOn", {
                            date: formatDate(pack.contrat_prepare_le, locale),
                          })}
                        </span>
                      ) : null}
                    </p>
                    {pack.contrat_statut === "refuse" && pack.contrat_motif ? (
                      <p className="mt-2 text-sm font-semibold text-red-700">
                        {tp("contratMotif", { motif: pack.contrat_motif })}
                      </p>
                    ) : null}
                    <div className="mt-3">
                      <button
                        type="button"
                        disabled={occupePack}
                        onClick={telechargerMonContrat}
                        className={BOUTON_MARINE}
                      >
                        {tp("contratDownload")}
                      </button>
                    </div>
                    {pack.contrat_statut === "a_signer" ||
                    pack.contrat_statut === "refuse" ? (
                      <div className="mt-4">
                        <DocumentUpload
                          fichier={fichierContrat}
                          onFichierChange={setFichierContrat}
                          label={tp("contratUploadSigned")}
                        />
                        {fichierContrat ? (
                          <button
                            type="button"
                            disabled={occupePack}
                            onClick={envoyerContratSigne}
                            className={`mt-2 ${BOUTON_OR}`}
                          >
                            {tp("contratSendSigned")}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {pack.contrat_document && pack.contrat_statut !== "valide" ? (
                      <p className="mt-3 text-sm text-slate-600">
                        {tp("contratStatus.signe_depose")} :{" "}
                        <span className="break-all font-medium">
                          {pack.contrat_document.nom_fichier}
                        </span>
                      </p>
                    ) : null}
                    {/* Contrat VALIDÉ = RÉSULTAT, pas formulaire
                        (réorganisation 2026-11-08, lot B3) : la ligne
                        de résultat nomme le document validé et sa date
                        de dépôt ; aucun nouveau dépôt n'est proposé. */}
                    {pack.contrat_statut === "valide" ? (
                      pack.contrat_document ? (
                        <p className="mt-2 text-sm font-semibold text-green-700">
                          ✓{" "}
                          {tp("contratResultLine", {
                            nom: pack.contrat_document.nom_fichier,
                            date: formatDate(pack.contrat_document.created_at, locale),
                          })}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm font-semibold text-green-700">
                          {tp("contratValidatedNote")}
                        </p>
                      )
                    ) : null}
                  </>
                )}
              </section>
            </div>
          ) : null}
          </div>

          {/* Bureau large (xl) : Carte employé à côté de « Ma paie ».
              Sans pack, « Ma paie » reste pleine largeur. */}
          <div className={pack ? "space-y-5 xl:grid xl:grid-cols-2 xl:items-start xl:gap-5 xl:space-y-0" : undefined}>
          {pack ? (
            <>
              {/* Carte employé à code-barres (dossier complet + contrat validé). */}
              <section className={`${CARTE} min-w-0`}>
                <h2 className="text-base font-bold text-navy">
                  {tp("carteSectionTitle")}
                </h2>
                {pack.carte_emise ? (
                  <div className="mt-3 xl:flex xl:justify-center">
                    <CarteEmploye pack={pack} />
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-sm font-semibold text-amber-800">
                      {tp("carteNotIssued")}
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                      {pack.carte_blocages.map((b) => (
                        <li key={b}>
                          {b === "dossier"
                            ? tp("carteBlockDossier")
                            : tp("carteBlockContrat")}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
            </>
          ) : null}

          {/* Ma paie : paies émises par la plateforme (lecture seule,
              mes données uniquement — finances de la plateforme). */}
          <section className={`${CARTE} min-w-0`}>
            <h2 className="text-base font-bold text-navy">{tf("myPayTitle")}</h2>
            <p className="mt-1 text-sm text-slate-600">{tf("myPayIntro")}</p>
            {paies.length > 0 ? (
              <ul className="mt-3 divide-y divide-slate-100">
                {paies.map((p) => (
                  <li key={p.id} className="py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        <span className="font-semibold text-navy">{p.mois}</span>{" "}
                        <span className="text-slate-500">
                          · {tf("colIssuedOn")} {formatDate(p.emis_le, locale)}
                          {p.reference
                            ? ` · ${formatReferencePaie(p.reference, locale)}`
                            : ""}
                          {p.modalites ? ` · ${p.modalites}` : ""}
                        </span>
                      </span>
                      <span className="whitespace-nowrap font-bold text-navy">
                        {formatMoney(p.montant, p.devise, locale)}
                      </span>
                    </div>
                    {p.paiement_destination ? (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {tf("payDestinationLabel")} : {p.paiement_destination}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled={talonEnCours !== null}
                      onClick={() => telechargerTalon(p.id)}
                      className="mt-1 font-semibold text-navy underline decoration-gold decoration-2 underline-offset-2 disabled:opacity-50"
                    >
                      {talonEnCours === p.id ? "…" : tf("payStubDownload")}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-600">{tf("myPayEmpty")}</p>
            )}
          </section>
          </div>
        </>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import ConfirmDialog from "@/components/ConfirmDialog";
import { formatDate, formatMoney, formatPct } from "@/lib/format";
import { getDataProvider } from "@/lib/data";
import type {
  Activite,
  Alerte,
  Appartement,
  Bail,
  Depense,
  Document,
  EcheanceLoyer,
  Immeuble,
  Locataire,
  Paiement,
  Profil,
} from "@/lib/data";
import { roiAppartement } from "@/lib/module4";
import { messageErreur } from "@/lib/translateError";

const STATUTS = ["occupe", "vacant", "travaux", "reserve"] as const;

export default function AppartementDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations("crud");
  const locale = useLocale();
  const router = useRouter();

  const [appartement, setAppartement] = useState<Appartement | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [immeuble, setImmeuble] = useState<Immeuble | null>(null);
  const [baux, setBaux] = useState<Bail[]>([]);
  const [locataires, setLocataires] = useState<Locataire[]>([]);
  const [echeances, setEcheances] = useState<EcheanceLoyer[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activites, setActivites] = useState<Activite[]>([]);
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [aArchiver, setAArchiver] = useState(false);
  const [aCloturer, setACloturer] = useState<Bail | null>(null);

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const p = getDataProvider();
      const session = await p.getSession();
      if (!session) {
        router.push(`/${locale}/connexion`);
        return;
      }
      const apt = await p.getAppartement(params.id);
      if (!apt) {
        setErreur(t("errors.ERR_NOT_FOUND"));
        setChargement(false);
        return;
      }
      const [im, bx, locs, dep, prof] = await Promise.all([
        p.getImmeuble(apt.immeuble_id),
        p.listerBaux({ appartementId: apt.id }),
        p.listerLocataires(),
        p.listerDepenses({ appartementId: apt.id }),
        p.getProfil(),
      ]);
      const ech = await Promise.all(bx.map((b) => p.listerEcheances(b.id)));
      const pay = await Promise.all(
        ech.flat().map((e) => p.listerPaiements(e.id))
      );
      const docsApt = await p.listerDocuments({ entite_type: "appartement", entite_id: apt.id });
      const docsBaux = (
        await Promise.all(
          bx.map((b) => p.listerDocuments({ entite_type: "bail", entite_id: b.id }))
        )
      ).flat();
      const act = await p.listerActivites(apt.immeuble_id);
      const alr = await p.listerAlertes();
      setAppartement(apt);
      setProfil(prof);
      setImmeuble(im);
      setBaux(bx);
      setLocataires(locs);
      setEcheances(ech.flat());
      setPaiements(pay.flat());
      setDepenses(dep);
      setDocuments([...docsApt, ...docsBaux]);
      setActivites(act);
      setAlertes(alr);
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const bailEnCours = baux.find((b) => b.statut === "actif");
  const locataireEnCours = bailEnCours
    ? locataires.find((l) => l.id === bailEnCours.locataire_id)
    : undefined;
  const estCoproprietaire = profil?.role === "coproprietaire";
  const cleStatut = (s: string) =>
    s === "occupe" ? "statusOccupied" : s === "vacant" ? "statusVacant" : s === "travaux" ? "statusWorks" : "statusReserved";

  /** ROI de l'appartement sur l'année en cours (valeur propre, sinon celle de l'immeuble). */
  const roi = useMemo(() => {
    if (!appartement) return null;
    const annee = new Date().getFullYear();
    return roiAppartement({
      appartement,
      immeuble: immeuble ?? undefined,
      baux,
      echeances,
      paiements,
      depenses,
      periodeDebut: `${annee}-01-01`,
      periodeFin: new Date().toISOString().slice(0, 10),
    });
  }, [appartement, immeuble, baux, echeances, paiements, depenses]);

  const travaux = useMemo(
    () => depenses.filter((d) => d.categorie === "reparation" || d.categorie === "entretien"),
    [depenses]
  );
  const alertesAppartement = useMemo(() => {
    const bailIds = new Set(baux.map((b) => b.id));
    const echIds = new Set(echeances.map((e) => e.id));
    return alertes.filter((a) => {
      if (a.entite_type === "appartement") return a.entite_id === appartement?.id;
      if (a.entite_type === "bail") return a.entite_id !== null && bailIds.has(a.entite_id);
      if (a.entite_type === "loyer") return a.entite_id !== null && echIds.has(a.entite_id);
      return false;
    });
  }, [alertes, baux, echeances, appartement]);
  const activitesAppartement = useMemo(() => {
    const bailIds = new Set(baux.map((b) => b.id));
    const echIds = new Set(echeances.map((e) => e.id));
    return activites.filter((a) => {
      if (a.entite_type === "appartement") return a.entite_id === appartement?.id;
      if (a.entite_type === "bail") return a.entite_id !== null && bailIds.has(a.entite_id);
      if (a.entite_type === "loyer") return a.entite_id !== null && echIds.has(a.entite_id);
      if (a.entite_type === "depense") return depenses.some((d) => d.id === a.entite_id);
      return false;
    });
  }, [activites, baux, echeances, depenses, appartement]);
  const libelleModeAcquisition = (mode: string | null) => {
    if (!mode) return t("common.notProvided");
    if (mode === "achat") return t("passport.modeAchat");
    if (mode === "heritage") return t("passport.modeHeritage");
    if (mode === "donation") return t("passport.modeDonation");
    return t("passport.modeAutre");
  };

  async function changerStatut(nouveau: string) {
    if (!appartement || nouveau === appartement.statut) return;
    try {
      await getDataProvider().changerStatutAppartement(
        appartement.id,
        nouveau as (typeof STATUTS)[number]
      );
      setMessage(t("common.updated"));
      charger();
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    }
  }

  async function basculerVitrine() {
    if (!appartement) return;
    try {
      await getDataProvider().basculerVitrine(appartement.id, !appartement.vitrine);
      setMessage(t("common.updated"));
      charger();
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    }
  }

  async function archiver() {
    if (!appartement) return;
    try {
      await getDataProvider().archiverAppartement(appartement.id);
      setAArchiver(false);
      setMessage(t("common.archivedDone"));
      charger();
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    }
  }

  async function cloturerBail() {
    if (!aCloturer) return;
    try {
      await getDataProvider().cloturerBail(aCloturer.id);
      setACloturer(null);
      setMessage(t("leases.closed"));
      charger();
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    }
  }

  if (chargement) {
    return (
      <AppShell title={t("apartments.title")}>
        <p className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>
      </AppShell>
    );
  }

  if (!appartement) {
    return (
      <AppShell title={t("apartments.title")}>
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p role="alert" className="text-red-700">{erreur ?? t("errors.ERR_NOT_FOUND")}</p>
          <Link href={`/${locale}/appartements`} className="mt-4 inline-block font-semibold text-navy underline">
            {t("common.back")}
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={`${appartement.numero} · ${appartement.type}`}>
      <Link href={`/${locale}/appartements`} className="mb-4 inline-block font-semibold text-navy underline">
        ← {t("apartments.backToList")}
      </Link>
      {message ? (
        <p role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">{message}</p>
      ) : null}
      {erreur ? (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erreur}</p>
      ) : null}

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-base text-slate-600">
              {immeuble ? (
                <Link href={`/${locale}/immeubles/${immeuble.id}`} className="font-semibold text-navy underline">
                  {immeuble.nom}
                </Link>
              ) : null}
              {immeuble ? ` — ${immeuble.ville}` : null}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <dt className="text-sm text-slate-500">{t("apartments.fields.defaultRent")}</dt>
                <dd className="text-lg font-bold text-navy">{formatMoney(appartement.loyer_defaut, appartement.devise, locale)}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">{t("apartments.fields.surface")}</dt>
                <dd className="text-lg font-bold text-navy">{appartement.surface_m2 !== null ? `${appartement.surface_m2} m²` : "—"}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">{t("apartments.fields.floor")}</dt>
                <dd className="text-lg font-bold text-navy">{appartement.etage !== null ? appartement.etage : "—"}</dd>
              </div>
              <div>
                <dt className="text-sm text-slate-500">{t("apartments.fields.status")}</dt>
                <dd className="text-lg font-bold text-navy">{t(`apartments.${cleStatut(appartement.statut)}`)}</dd>
              </div>
            </dl>
            {appartement.description ? <p className="mt-3 text-base text-slate-700">{appartement.description}</p> : null}
            <p className="mt-2 text-sm text-slate-600">
              {appartement.vitrine ? t("apartments.vitrinePublished") : t("apartments.vitrineNotPublished")}
              {appartement.valeur_bien ? ` · ${t("apartments.fields.value")} : ${formatMoney(appartement.valeur_bien, appartement.devise_valeur ?? appartement.devise, locale)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!estCoproprietaire ? (
              <>
                <Link href={`/${locale}/appartements/${appartement.id}/modifier`} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-navy">
                  {t("common.edit")}
                </Link>
                <button type="button" onClick={basculerVitrine} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-navy">
                  {appartement.vitrine ? t("apartments.removeVitrine") : t("apartments.publishVitrine")}
                </button>
                {!appartement.archive ? (
                  <button type="button" onClick={() => setAArchiver(true)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-navy">
                    {t("common.archive")}
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!estCoproprietaire ? (
            <>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                {t("apartments.changeStatus")}
                <select
                  value={appartement.statut}
                  onChange={(e) => changerStatut(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-gold"
                >
                  {STATUTS.map((s) => (
                    <option key={s} value={s}>{t(`apartments.${cleStatut(s)}`)}</option>
                  ))}
                </select>
              </label>
              {!bailEnCours ? (
                <Link href={`/${locale}/appartements/${appartement.id}/baux/nouveau`} className="rounded-full bg-navy px-4 py-2 text-sm font-bold text-white">
                  {t("apartments.newLease")}
                </Link>
              ) : null}
            </>
          ) : null}
        </div>
      </div>

      {/* Bail en cours */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-navy">{t("apartments.detailCurrentLease")}</h2>
        {bailEnCours && locataireEnCours ? (
          <div className="mt-3">
            <p className="text-base">
              <Link href={`/${locale}/locataires/${locataireEnCours.id}`} className="font-bold text-navy underline">
                {locataireEnCours.nom}
              </Link>
              {" — "}
              {formatMoney(bailEnCours.loyer_mensuel, bailEnCours.devise, locale)} / {t("rents.month").toLowerCase()}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {formatDate(bailEnCours.debut, locale)} → {bailEnCours.fin ? formatDate(bailEnCours.fin, locale) : "—"}
              {" · "}
              {t("leases.fields.dueDay")} : {bailEnCours.jour_exigibilite}
              {" · "}
              {t("leases.fields.deposit")} : {bailEnCours.caution !== null ? formatMoney(bailEnCours.caution, bailEnCours.devise_caution ?? bailEnCours.devise, locale) : t("common.notProvided")}
              {" ("}{t(`leases.fields.${bailEnCours.caution_statut === "recue" ? "depositStatusReceived" : bailEnCours.caution_statut === "restituee" ? "depositStatusReturned" : bailEnCours.caution_statut === "retenue_partielle" ? "depositStatusPartial" : "depositStatusPending"}`)}{")"}
            </p>
            {!estCoproprietaire ? (
              <button type="button" onClick={() => setACloturer(bailEnCours)} className="mt-3 rounded-full border border-red-300 px-4 py-2 text-sm font-bold text-red-700">
                {t("leases.close")}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-slate-600">{t("apartments.noLease")}</p>
        )}
      </section>

      {/* Passeport du bien (spec §6 suite) — construit au module 6 : la fiche
          appartement n'en avait pas. Identité, acquisition (héritée de
          l'immeuble), valeur + ROI, travaux, historique complet, documents. */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-navy">{t("passport.title")}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <h3 className="font-bold text-navy">{t("passport.identity")}</h3>
            <p className="mt-1 text-sm text-slate-700">
              {appartement.numero} · {appartement.type}
              {appartement.surface_m2 !== null ? ` — ${appartement.surface_m2} m²` : ""}
              {appartement.etage !== null ? ` — ${t("apartments.fields.floor")} ${appartement.etage}` : ""}
              <br />
              {immeuble ? `${immeuble.nom} — ${immeuble.adresse}, ${immeuble.ville}` : ""}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {t("passport.statusLabel")} : {t(`apartments.${cleStatut(appartement.statut)}`)}
            </p>
            {appartement.photos.length === 0 ? (
              <p className="mt-1 text-sm text-slate-600">{t("passport.noPhotos")}</p>
            ) : (
              <ul className="mt-1 space-y-1 text-sm">
                {appartement.photos.map((url) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer" className="break-all font-semibold text-navy underline">{url}</a>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="font-bold text-navy">{t("passport.acquisition")}</h3>
            {immeuble ? (
              <p className="mt-1 text-sm text-slate-700">
                {t("passport.inheritedAcquisition")}<br />
                {t("passport.acquisitionDate")} : {formatDate(immeuble.date_acquisition, locale)}<br />
                {t("passport.acquisitionPrice")} : {immeuble.prix_acquisition !== null ? formatMoney(immeuble.prix_acquisition, immeuble.devise_valeur ?? immeuble.devise, locale) : t("common.notProvided")}<br />
                {t("passport.acquisitionMode")} : {libelleModeAcquisition(immeuble.mode_acquisition)}
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-600">{t("common.notProvided")}</p>
            )}
          </div>
          <div>
            <h3 className="font-bold text-navy">{t("passport.value")}</h3>
            <p className="mt-1 text-sm text-slate-700">
              {t("passport.valueLabel")} : {appartement.valeur_bien
                ? formatMoney(appartement.valeur_bien, appartement.devise_valeur ?? appartement.devise, locale)
                : immeuble?.valeur_bien
                  ? formatMoney(immeuble.valeur_bien, immeuble.devise_valeur ?? immeuble.devise, locale)
                  : t("buildings.roiMissing")}
              <br />
              {t("passport.estimationDate")} : {formatDate(immeuble?.date_estimation ?? null, locale)}<br />
              {t("passport.roiLabel")} : {roi !== null ? formatPct(roi, locale) : "—"}
            </p>
          </div>
        </div>
        <h3 className="mt-6 font-bold text-navy">{t("passport.works")}</h3>
        {travaux.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">{t("passport.noWorks")}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {travaux.map((d) => (
              <li key={d.id}>
                {formatDate(d.date, locale)} — {d.libelle} : {formatMoney(d.montant, d.devise, locale)}
                {d.justificatif_url ? (
                  <>
                    {" · "}
                    <a href={d.justificatif_url} target="_blank" rel="noreferrer" className="font-semibold text-navy underline">{t("passport.worksReceipt")}</a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <h3 className="mt-6 font-bold text-navy">{t("passport.history")}</h3>
        <h4 className="mt-3 text-sm font-bold text-navy">{t("passport.historyLeases")}</h4>
        {baux.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">{t("leases.noHistory")}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {baux.map((b) => {
              const loc = locataires.find((l) => l.id === b.locataire_id);
              return (
                <li key={b.id}>
                  {loc?.nom ?? "—"} : {formatDate(b.debut, locale)} → {b.fin ? formatDate(b.fin, locale) : "—"} · {formatMoney(b.loyer_mensuel, b.devise, locale)} · {b.statut === "actif" ? t("leases.active") : t("leases.ended")}
                </li>
              );
            })}
          </ul>
        )}
        <h4 className="mt-3 text-sm font-bold text-navy">{t("passport.historyPayments")}</h4>
        {paiements.filter((p) => p.statut === "valide").length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">{t("rents.empty")}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {paiements.filter((p) => p.statut === "valide").slice(0, 20).map((p) => (
              <li key={p.id}>
                {formatDate(p.date_paiement, locale)} — {formatMoney(p.montant, p.devise, locale)} · {p.recu_numero ?? ""}
              </li>
            ))}
          </ul>
        )}
        <h4 className="mt-3 text-sm font-bold text-navy">{t("passport.historyAlerts")}</h4>
        {alertesAppartement.length === 0 && activitesAppartement.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">{t("passport.noHistory")}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {alertesAppartement.map((a) => (
              <li key={a.id}>{formatDate(a.created_at, locale)} — {a.message}</li>
            ))}
            {activitesAppartement.slice(0, 20).map((a) => (
              <li key={a.id}>{formatDate(a.created_at, locale)} — {a.description}</li>
            ))}
          </ul>
        )}
        <h3 className="mt-6 font-bold text-navy">{t("passport.documentsInPassport")}</h3>
        {documents.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">{t("passport.noDocuments")}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {documents.map((d) => (
              <li key={d.id}>{d.nom_fichier} ({d.type}) — {formatDate(d.created_at, locale)}</li>
            ))}
          </ul>
        )}
      </section>

      {/* Historique des baux */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-navy">{t("apartments.detailLeaseHistory")}</h2>
        {baux.length === 0 ? (
          <p className="mt-2 text-slate-600">{t("leases.noHistory")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {baux.map((b) => {
              const loc = locataires.find((l) => l.id === b.locataire_id);
              return (
                <li key={b.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <span>
                    {loc?.nom ?? "—"} — {formatDate(b.debut, locale)} → {b.fin ? formatDate(b.fin, locale) : "—"}
                  </span>
                  <span className="font-bold text-navy">
                    {formatMoney(b.loyer_mensuel, b.devise, locale)} · {b.statut === "actif" ? t("leases.active") : t("leases.ended")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Loyers (module 3 : lecture des échéances déjà présentes) */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-navy">{t("apartments.detailRents")}</h2>
        {echeances.length === 0 ? (
          <p className="mt-2 text-slate-600">{t("rents.empty")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {echeances.map((e) => {
              const paye = paiements
                .filter((p) => p.echeance_id === e.id && p.statut === "valide")
                .reduce((s, p) => s + p.montant, 0);
              return (
                <li key={e.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <span>{formatDate(e.mois, locale)}</span>
                  <span className="font-bold text-navy">
                    {formatMoney(e.montant_du, e.devise, locale)} · {t(`rents.${e.statut === "paye" ? "statusPaid" : e.statut === "partiel" ? "statusPartial" : e.statut === "en_retard" ? "statusLate" : e.statut === "du" ? "statusDue" : "statusUpcoming"}`)}
                    {paye > 0 ? ` (${formatMoney(paye, e.devise, locale)} ${t("rents.statusPaid").toLowerCase()})` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Dépenses liées */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-navy">{t("apartments.detailExpenses")}</h2>
        {depenses.length === 0 ? (
          <p className="mt-2 text-slate-600">{t("expenses.empty")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {depenses.map((d) => (
              <li key={d.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                <span>{formatDate(d.date, locale)} — {d.libelle}</span>
                <span className="font-bold text-navy">{formatMoney(d.montant, d.devise, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Photos */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-navy">{t("apartments.detailPhotos")}</h2>
        {appartement.photos.length === 0 ? (
          <p className="mt-2 text-slate-600">{t("apartments.noPhotos")}</p>
        ) : (
          <ul className="mt-3 space-y-1">
            {appartement.photos.map((url) => (
              <li key={url}>
                <a href={url} target="_blank" rel="noreferrer" className="break-all font-semibold text-navy underline">{url}</a>
              </li>
            ))}
          </ul>
        )}
      </section>

      {aArchiver ? (
        <ConfirmDialog
          title={t("common.confirmArchive", { name: appartement.numero })}
          text={t("common.confirmArchiveText")}
          confirmLabel={t("common.archive")}
          cancelLabel={t("common.cancel")}
          danger={false}
          onConfirm={archiver}
          onCancel={() => setAArchiver(false)}
        />
      ) : null}
      {aCloturer ? (
        <ConfirmDialog
          title={t("leases.closeConfirm")}
          text={t("leases.closeConfirmText")}
          confirmLabel={t("leases.close")}
          cancelLabel={t("common.cancel")}
          danger={false}
          onConfirm={cloturerBail}
          onCancel={() => setACloturer(null)}
        />
      ) : null}
    </AppShell>
  );
}

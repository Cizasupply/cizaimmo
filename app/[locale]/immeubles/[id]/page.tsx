"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import ConfirmDialog from "@/components/ConfirmDialog";
import DocumentList from "@/components/DocumentList";
import IndivisionSection from "@/components/IndivisionSection";
import { formatDate, formatMoney, formatPct } from "@/lib/format";
import { bailActif, statsImmeuble } from "@/lib/parc";
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
import { messageErreur } from "@/lib/translateError";

export default function ImmeubleDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations("crud");
  const locale = useLocale();
  const router = useRouter();

  const [immeuble, setImmeuble] = useState<Immeuble | null>(null);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [appartements, setAppartements] = useState<Appartement[]>([]);
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
  const [aArchiver, setAArchiver] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
      const im = await p.getImmeuble(params.id);
      if (!im) {
        setErreur(t("errors.ERR_NOT_FOUND"));
        setChargement(false);
        return;
      }
      const [apts, bx, locs, ech, pay, dep, docs, prof, act, alr] = await Promise.all([
        p.listerAppartements({ immeubleId: im.id, inclureArchives: true }),
        p.listerBaux(),
        p.listerLocataires(),
        p.listerEcheances(),
        p.listerPaiements(),
        p.listerDepenses({ immeubleId: im.id }),
        p.listerDocuments({ entite_type: "immeuble", entite_id: im.id }),
        p.getProfil(),
        p.listerActivites(im.id),
        p.listerAlertes(),
      ]);
      setImmeuble(im);
      setAppartements(apts);
      setBaux(bx);
      setLocataires(locs);
      setEcheances(ech);
      setPaiements(pay);
      setDepenses(dep);
      setDocuments(docs);
      setProfil(prof);
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

  const stats = useMemo(
    () =>
      immeuble
        ? statsImmeuble(immeuble, appartements, baux, echeances, paiements, depenses)
        : null,
    [immeuble, appartements, baux, echeances, paiements, depenses]
  );

  const nomLocataire = (aptId: string) => {
    const bail = bailActif(baux, aptId);
    if (!bail) return null;
    return locataires.find((l) => l.id === bail.locataire_id)?.nom ?? null;
  };

  const estCoproprietaire = profil?.role === "coproprietaire";
  const bauxImmeuble = useMemo(
    () =>
      baux.filter((b) => appartements.some((a) => a.id === b.appartement_id)),
    [baux, appartements]
  );
  const echeanceIdsImmeuble = useMemo(
    () =>
      new Set(
        echeances
          .filter((e) => bauxImmeuble.some((b) => b.id === e.bail_id))
          .map((e) => e.id)
      ),
    [echeances, bauxImmeuble]
  );
  const paiementsImmeuble = useMemo(
    () =>
      paiements.filter(
        (p) => p.statut === "valide" && echeanceIdsImmeuble.has(p.echeance_id)
      ),
    [paiements, echeanceIdsImmeuble]
  );
  const alertesImmeuble = useMemo(() => {
    const aptIds = new Set(appartements.map((a) => a.id));
    const bailIds = new Set(bauxImmeuble.map((b) => b.id));
    return alertes.filter((a) => {
      if (a.entite_type === "immeuble") return a.entite_id === immeuble?.id;
      if (a.entite_type === "appartement") return a.entite_id !== null && aptIds.has(a.entite_id);
      if (a.entite_type === "bail") return a.entite_id !== null && bailIds.has(a.entite_id);
      if (a.entite_type === "loyer") return a.entite_id !== null && echeanceIdsImmeuble.has(a.entite_id);
      return false;
    });
  }, [alertes, appartements, bauxImmeuble, echeanceIdsImmeuble, immeuble]);
  const libelleModeAcquisition = (mode: string | null) => {
    if (!mode) return t("common.notProvided");
    if (mode === "achat") return t("passport.modeAchat");
    if (mode === "heritage") return t("passport.modeHeritage");
    if (mode === "donation") return t("passport.modeDonation");
    return t("passport.modeAutre");
  };

  async function archiver() {
    if (!immeuble) return;
    try {
      await getDataProvider().archiverImmeuble(immeuble.id);
      setAArchiver(false);
      setMessage(t("common.archivedDone"));
      charger();
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    }
  }

  if (chargement) {
    return (
      <AppShell title={t("buildings.title")}>
        <p className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>
      </AppShell>
    );
  }

  if (!immeuble) {
    return (
      <AppShell title={t("buildings.title")}>
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p role="alert" className="text-red-700">{erreur ?? t("errors.ERR_NOT_FOUND")}</p>
          <Link href={`/${locale}/immeubles`} className="mt-4 inline-block font-semibold text-navy underline">
            {t("common.back")}
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={immeuble.nom}>
      <Link href={`/${locale}/immeubles`} className="mb-4 inline-block font-semibold text-navy underline">
        ← {t("buildings.backToList")}
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
              {immeuble.adresse}, {immeuble.ville} — {immeuble.pays}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {t("buildings.fields.type")} : {t(`buildings.fields.${immeuble.type === "immeuble" ? "typeImmeuble" : immeuble.type === "bloc" ? "typeBloc" : "typeMaison"}`)}
              {immeuble.etages !== null ? ` · ${immeuble.etages} ${t("buildings.fields.floors").toLowerCase()}` : ""}
              {immeuble.statut === "archive" ? ` · ${t("common.archived")}` : ""}
            </p>
            {immeuble.notes ? <p className="mt-2 text-base text-slate-700">{immeuble.notes}</p> : null}
          </div>
          <div className="flex gap-2">
            {!estCoproprietaire ? (
              <Link href={`/${locale}/immeubles/${immeuble.id}/modifier`} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-navy">
                {t("common.edit")}
              </Link>
            ) : null}
            {!estCoproprietaire && immeuble.statut === "actif" ? (
              <button type="button" onClick={() => setAArchiver(true)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-navy">
                {t("common.archive")}
              </button>
            ) : null}
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-sm text-slate-500">{t("buildings.statsApartments")}</dt>
            <dd className="text-xl font-bold text-navy">{stats?.nbAppartements ?? 0}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-sm text-slate-500">{t("buildings.statsOccupancy")}</dt>
            <dd className="text-xl font-bold text-navy">
              {stats?.occupation !== null && stats?.occupation !== undefined ? formatPct(stats.occupation, locale) : "—"}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-sm text-slate-500">{t("buildings.statsMonthlyRent")}</dt>
            <dd className="text-xl font-bold text-navy">{formatMoney(stats?.loyersMois ?? 0, immeuble.devise, locale)}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-sm text-slate-500">{t("buildings.statsValue")}</dt>
            <dd className="text-xl font-bold text-navy">
              {immeuble.valeur_bien ? formatMoney(immeuble.valeur_bien, immeuble.devise_valeur ?? immeuble.devise, locale) : t("common.notProvided")}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-sm text-slate-500">{t("passport.roiLabel")}</dt>
            <dd className="text-xl font-bold text-navy">
              {stats?.roi !== null && stats?.roi !== undefined ? formatPct(stats.roi, locale) : t("buildings.roiMissing")}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-4">
            <dt className="text-sm text-slate-500">{t("passport.marginLabel")}</dt>
            <dd className="text-xl font-bold text-navy">
              {stats?.marge !== null && stats?.marge !== undefined ? formatPct(stats.marge, locale) : "—"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Appartements */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-navy">{t("buildings.detailApartments")}</h2>
          {!estCoproprietaire ? (
            <div className="flex gap-2">
              <Link href={`/${locale}/appartements/nouveau?immeuble=${immeuble.id}`} className="rounded-full bg-navy px-4 py-2 text-sm font-bold text-white">
                {t("apartments.add")}
              </Link>
              <Link href={`/${locale}/appartements/nouveau?immeuble=${immeuble.id}&lot=1`} className="rounded-full border border-navy px-4 py-2 text-sm font-bold text-navy">
                {t("apartments.addBulk")}
              </Link>
            </div>
          ) : null}
        </div>
        {appartements.length === 0 ? (
          <p className="mt-4 text-slate-600">
            {t("buildings.noApartments")} {t("buildings.noApartmentsHint")}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {appartements.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <Link href={`/${locale}/appartements/${a.id}`} className="font-bold text-navy underline">
                    {a.numero} · {a.type}
                  </Link>
                  <p className="text-sm text-slate-600">
                    {formatMoney(a.loyer_defaut, a.devise, locale)} — {t(`apartments.${a.statut === "occupe" ? "statusOccupied" : a.statut === "vacant" ? "statusVacant" : a.statut === "travaux" ? "statusWorks" : "statusReserved"}`)}
                    {nomLocataire(a.id) ? ` · ${nomLocataire(a.id)}` : ""}
                    {a.archive ? ` · ${t("common.archived")}` : ""}
                  </p>
                </div>
                <Link href={`/${locale}/appartements/${a.id}`} className="text-sm font-semibold text-navy underline">
                  {t("common.view")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Dépenses */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-navy">{t("buildings.detailExpenses")}</h2>
        {depenses.length === 0 ? (
          <p className="mt-2 text-slate-600">{t("expenses.empty")}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {depenses.map((d) => (
              <li key={d.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                <span>{formatDate(d.date, locale)} — {d.libelle} ({d.categorie})</span>
                <span className="font-bold text-navy">{formatMoney(d.montant, d.devise, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Documents (module 4 : vrais documents, stockage privé) */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-navy">{t("buildings.detailDocuments")}</h2>
        <DocumentList documents={documents} onChange={charger} />
        <Link href="/documents" className="mt-3 inline-block text-sm font-semibold text-navy underline">
          {t("buildings.detailDocumentsAll")}
        </Link>
      </section>

      {/* Passeport du bien (spec §6 suite) — complet : identité, acquisition,
          valeur (+ date d'estimation, ROI), travaux (avec justificatifs),
          historique complet (baux, paiements, alertes, fil), documents. */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-navy">{t("passport.title")}</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <h3 className="font-bold text-navy">{t("passport.identity")}</h3>
            <p className="mt-1 text-sm text-slate-700">
              {immeuble.nom}<br />{immeuble.adresse}, {immeuble.ville} — {immeuble.pays}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {t("passport.statusLabel")} : {immeuble.statut === "actif" ? t("common.active") : t("common.archived")}
            </p>
            {immeuble.photo_url ? (
              <p className="mt-1 text-sm">
                <a href={immeuble.photo_url} target="_blank" rel="noreferrer" className="break-all font-semibold text-navy underline">{t("passport.photos")}</a>
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-600">{t("passport.noPhotos")}</p>
            )}
            <p className="mt-2 text-sm font-semibold text-navy">{t("passport.attachedApartments")} : {appartements.length}</p>
            <ul className="mt-1 space-y-1 text-sm text-slate-700">
              {appartements.map((a) => (
                <li key={a.id}>
                  <Link href={`/${locale}/appartements/${a.id}`} className="font-semibold text-navy underline">
                    {a.numero} · {a.type}
                  </Link>
                  {" — "}{formatMoney(a.loyer_defaut, a.devise, locale)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-navy">{t("passport.acquisition")}</h3>
            <p className="mt-1 text-sm text-slate-700">
              {t("passport.acquisitionDate")} : {formatDate(immeuble.date_acquisition, locale)}<br />
              {t("passport.acquisitionPrice")} : {immeuble.prix_acquisition !== null ? formatMoney(immeuble.prix_acquisition, immeuble.devise_valeur ?? immeuble.devise, locale) : t("common.notProvided")}<br />
              {t("passport.acquisitionMode")} : {libelleModeAcquisition(immeuble.mode_acquisition)}
            </p>
          </div>
          <div>
            <h3 className="font-bold text-navy">{t("passport.value")}</h3>
            <p className="mt-1 text-sm text-slate-700">
              {t("passport.valueLabel")} : {immeuble.valeur_bien ? formatMoney(immeuble.valeur_bien, immeuble.devise_valeur ?? immeuble.devise, locale) : t("buildings.roiMissing")}<br />
              {t("passport.estimationDate")} : {formatDate(immeuble.date_estimation, locale)}<br />
              {t("passport.roiLabel")} : {stats?.roi !== null && stats?.roi !== undefined ? formatPct(stats.roi, locale) : "—"}
            </p>
          </div>
        </div>
        <h3 className="mt-6 font-bold text-navy">{t("passport.works")}</h3>
        {depenses.filter((d) => d.categorie === "reparation" || d.categorie === "entretien").length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">{t("passport.noWorks")}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {depenses.filter((d) => d.categorie === "reparation" || d.categorie === "entretien").map((d) => (
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
        {bauxImmeuble.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">{t("leases.noHistory")}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {bauxImmeuble.map((b) => {
              const loc = locataires.find((l) => l.id === b.locataire_id);
              const apt = appartements.find((a) => a.id === b.appartement_id);
              return (
                <li key={b.id}>
                  {apt?.numero ?? "—"} — {loc?.nom ?? "—"} : {formatDate(b.debut, locale)} → {b.fin ? formatDate(b.fin, locale) : "—"} · {formatMoney(b.loyer_mensuel, b.devise, locale)} · {b.statut === "actif" ? t("leases.active") : t("leases.ended")}
                </li>
              );
            })}
          </ul>
        )}
        <h4 className="mt-3 text-sm font-bold text-navy">{t("passport.historyPayments")}</h4>
        {paiementsImmeuble.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">{t("rents.empty")}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {paiementsImmeuble.slice(0, 20).map((p) => (
              <li key={p.id}>
                {formatDate(p.date_paiement, locale)} — {formatMoney(p.montant, p.devise, locale)} · {p.recu_numero ?? ""}
              </li>
            ))}
          </ul>
        )}
        <h4 className="mt-3 text-sm font-bold text-navy">{t("passport.historyAlerts")}</h4>
        {alertesImmeuble.length === 0 && activites.length === 0 ? (
          <p className="mt-1 text-sm text-slate-600">{t("passport.noHistory")}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {alertesImmeuble.map((a) => (
              <li key={a.id}>{formatDate(a.created_at, locale)} — {a.message}</li>
            ))}
            {activites.slice(0, 20).map((a) => (
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

      {/* Indivision familiale (spec §6 suite) */}
      <IndivisionSection immeuble={immeuble} />

      {aArchiver ? (
        <ConfirmDialog
          title={t("common.confirmArchive", { name: immeuble.nom })}
          text={t("common.confirmArchiveText")}
          confirmLabel={t("common.archive")}
          cancelLabel={t("common.cancel")}
          danger={false}
          onConfirm={archiver}
          onCancel={() => setAArchiver(false)}
        />
      ) : null}
    </AppShell>
  );
}

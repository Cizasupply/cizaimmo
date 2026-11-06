"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import ConfirmDialog from "@/components/ConfirmDialog";
import DocumentList from "@/components/DocumentList";
import { formatDate, formatMoney } from "@/lib/format";
import { getDataProvider } from "@/lib/data";
import type {
  Appartement,
  Bail,
  Document,
  EcheanceLoyer,
  Immeuble,
  Locataire,
  Paiement,
} from "@/lib/data";
import { messageErreur } from "@/lib/translateError";

export default function LocataireDetailPage({ params }: { params: { id: string } }) {
  const t = useTranslations("crud");
  const locale = useLocale();
  const router = useRouter();

  const [locataire, setLocataire] = useState<Locataire | null>(null);
  const [baux, setBaux] = useState<Bail[]>([]);
  const [appartements, setAppartements] = useState<Appartement[]>([]);
  const [immeubles, setImmeubles] = useState<Immeuble[]>([]);
  const [echeances, setEcheances] = useState<EcheanceLoyer[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lienUrl, setLienUrl] = useState<string | null>(null);
  const [copie, setCopie] = useState(false);
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
      const loc = await p.getLocataire(params.id);
      if (!loc) {
        setErreur(t("errors.ERR_NOT_FOUND"));
        setChargement(false);
        return;
      }
      const [bx, apts, ims] = await Promise.all([
        p.listerBaux({ locataireId: loc.id }),
        p.listerAppartements({ inclureArchives: true }),
        p.listerImmeubles(true),
      ]);
      const ech = await Promise.all(bx.map((b) => p.listerEcheances(b.id)));
      const pay = await Promise.all(ech.flat().map((e) => p.listerPaiements(e.id)));
      const docs = await p.listerDocuments({ entite_type: "locataire", entite_id: loc.id });
      setLocataire(loc);
      setBaux(bx);
      setAppartements(apts);
      setImmeubles(ims);
      setEcheances(ech.flat());
      setPaiements(pay.flat());
      setDocuments(docs);
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

  const bailActif = baux.find((b) => b.statut === "actif");
  // Lien affiché : celui qui vient d'être généré, ou celui déjà actif
  // (reconstitué depuis le jeton stocké) — le lien reste copiable même
  // s'il a été généré lors d'une visite précédente.
  const lienAffiche =
    lienUrl ??
    (locataire?.lien_token && typeof window !== "undefined"
      ? `${window.location.origin}/locataire/${locataire.lien_token}`
      : null);
  const appartementDe = (bail?: Bail) =>
    bail ? appartements.find((a) => a.id === bail.appartement_id) : undefined;
  const immeubleDe = (apt?: Appartement) =>
    apt ? immeubles.find((i) => i.id === apt.immeuble_id) : undefined;

  async function genererLien() {
    if (!locataire) return;
    try {
      const lien = await getDataProvider().genererLienLocataire(locataire.id);
      setLienUrl(lien.url);
      setMessage(t("tenants.linkGenerated"));
      charger();
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    }
  }

  async function revoquerLien() {
    if (!locataire) return;
    try {
      await getDataProvider().revoquerLienLocataire(locataire.id);
      setLienUrl(null);
      setMessage(t("tenants.linkRevoked"));
      charger();
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    }
  }

  async function copierLien() {
    if (!lienAffiche) return;
    try {
      await navigator.clipboard.writeText(lienAffiche);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch {
      // Presse-papiers indisponible : le lien reste affiché et copiable à la main.
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
      <AppShell title={t("tenants.title")}>
        <p className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>
      </AppShell>
    );
  }

  if (!locataire) {
    return (
      <AppShell title={t("tenants.title")}>
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <p role="alert" className="text-red-700">{erreur ?? t("errors.ERR_NOT_FOUND")}</p>
          <Link href={`/${locale}/locataires`} className="mt-4 inline-block font-semibold text-navy underline">
            {t("common.back")}
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={locataire.nom}>
      <Link href={`/${locale}/locataires`} className="mb-4 inline-block font-semibold text-navy underline">
        ← {t("tenants.backToList")}
      </Link>
      {message ? (
        <p role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">{message}</p>
      ) : null}
      {erreur ? (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erreur}</p>
      ) : null}

      {/* Coordonnées */}
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-navy">{t("tenants.detailContact")}</h2>
            <dl className="mt-3 space-y-1 text-base">
              <div className="flex gap-2"><dt className="w-40 shrink-0 text-slate-500">{t("tenants.fields.phone")}</dt><dd className="font-semibold text-navy">{locataire.telephone}</dd></div>
              <div className="flex gap-2"><dt className="w-40 shrink-0 text-slate-500">{t("tenants.fields.email")}</dt><dd>{locataire.email ?? t("common.notProvided")}</dd></div>
              <div className="flex gap-2"><dt className="w-40 shrink-0 text-slate-500">{t("tenants.fields.idType")}</dt><dd>{locataire.piece_type ?? t("common.notProvided")}{locataire.piece_numero ? ` — ${locataire.piece_numero}` : ""}</dd></div>
              <div className="flex gap-2"><dt className="w-40 shrink-0 text-slate-500">{t("tenants.fields.previousAddress")}</dt><dd>{locataire.adresse_precedente ?? t("common.notProvided")}</dd></div>
              <div className="flex gap-2"><dt className="w-40 shrink-0 text-slate-500">{t("tenants.fields.emergencyContact")}</dt><dd>{locataire.contact_urgence ?? t("common.notProvided")}</dd></div>
              {locataire.notes ? (
                <div className="flex gap-2"><dt className="w-40 shrink-0 text-slate-500">{t("tenants.fields.notes")}</dt><dd>{locataire.notes}</dd></div>
              ) : null}
            </dl>
          </div>
          <Link href={`/${locale}/locataires/${locataire.id}/modifier`} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-navy">
            {t("common.edit")}
          </Link>
        </div>
        {bailActif ? (
          <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-base">
            {t("tenants.currentApartment")} :{" "}
            {(() => {
              const apt = appartementDe(bailActif);
              return apt ? `${apt.numero} — ${immeubleDe(apt)?.nom ?? ""}` : "—";
            })()}
            {" · "}
            {t("tenants.leaseEnds", { date: bailActif.fin ? formatDate(bailActif.fin, locale) : "—" })}
          </p>
        ) : (
          <p className="mt-4 text-slate-600">{t("tenants.noActiveLease")}</p>
        )}
        <Link href={`/${locale}/locataires/${locataire.id}/baux/nouveau`} className="mt-4 inline-block rounded-full bg-navy px-4 py-2 text-sm font-bold text-white">
          {t("tenants.newLease")}
        </Link>
      </section>

      {/* Lien lecture seule */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-navy">{t("tenants.tenantLink")}</h2>
        <p className="mt-2 text-sm text-slate-600">{t("tenants.tenantLinkHint")}</p>
        {locataire.lien_token ? (
          <div className="mt-3">
            <p className="text-sm font-semibold text-navy">
              {t("tenants.linkValidUntil", { date: formatDate(locataire.lien_expire_le, locale) })}
            </p>
            {lienAffiche ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-slate-50 px-3 py-2 text-sm">{lienAffiche}</code>
                <button type="button" onClick={copierLien} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-navy">
                  {copie ? t("common.copied") : t("common.copy")}
                </button>
              </div>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={genererLien} className="rounded-full border border-navy px-4 py-2 text-sm font-bold text-navy">
                {t("tenants.regenerateLink")}
              </button>
              <button type="button" onClick={revoquerLien} className="rounded-full border border-red-300 px-4 py-2 text-sm font-bold text-red-700">
                {t("tenants.revokeLink")}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-slate-600">{t("tenants.linkNone")}</p>
            <button type="button" onClick={genererLien} className="mt-3 rounded-full bg-navy px-4 py-2 text-sm font-bold text-white">
              {t("tenants.generateLink")}
            </button>
          </div>
        )}
      </section>

      {/* Baux */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-navy">{t("tenants.detailLeases")}</h2>
        {baux.length === 0 ? (
          <p className="mt-2 text-slate-600">{t("leases.noHistory")}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {baux.map((b) => {
              const apt = appartementDe(b);
              return (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                  <span>
                    {apt ? (
                      <Link href={`/${locale}/appartements/${apt.id}`} className="font-bold text-navy underline">
                        {apt.numero} — {immeubleDe(apt)?.nom ?? ""}
                      </Link>
                    ) : "—"}
                    {" — "}
                    {formatDate(b.debut, locale)} → {b.fin ? formatDate(b.fin, locale) : "—"}
                    {" · "}
                    {formatMoney(b.loyer_mensuel, b.devise, locale)}
                    {" · "}
                    {b.statut === "actif" ? t("leases.active") : t("leases.ended")}
                  </span>
                  {b.statut === "actif" ? (
                    <button type="button" onClick={() => setACloturer(b)} className="font-semibold text-red-700 underline">
                      {t("leases.close")}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Historique loyers / reçus (module 3 : lecture des échéances déjà présentes) */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-navy">{t("tenants.detailRentHistory")}</h2>
        {echeances.length === 0 ? (
          <p className="mt-2 text-slate-600">{t("tenants.detailRentHistoryEmpty")}</p>
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

      {/* Documents (module 4 : vrais documents, stockage privé) */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-navy">{t("tenants.detailDocuments")}</h2>
        <DocumentList documents={documents} onChange={charger} />
        <Link href="/documents" className="mt-3 inline-block text-sm font-semibold text-navy underline">
          {t("tenants.detailDocumentsAll")}
        </Link>
      </section>

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

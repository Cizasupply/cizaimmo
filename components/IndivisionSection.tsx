"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDate, formatMoney } from "@/lib/format";
import { getDataProvider, INDIVISION_PAR_PLAN } from "@/lib/data";
import type {
  Coproprietaire,
  CoproprietaireInput,
  Devise,
  Immeuble,
  Profil,
  TauxChange,
} from "@/lib/data";
import { repartirResultatNet } from "@/lib/indivision";
import { messageErreur } from "@/lib/translateError";

interface LigneFormulaire extends CoproprietaireInput {
  cle: string;
  id?: string;
  statut?: Coproprietaire["statut"];
}

function moisCourantIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Section Indivision familiale (Module 6, spec §6 suite, §2, §13).
 * Affichée sur la fiche immeuble.
 *
 * - Propriétaire (plan Pro / Agence) : déclare les co-propriétaires et
 *   leurs parts — la somme doit faire exactement 100 % (validée avant
 *   enregistrement, refus sinon) ; chaque modification de part est
 *   tracée dans le fil d'actualité du bien.
 * - Co-propriétaire : lecture seule, sa part et sa répartition.
 * - Plan Starter : la section s'affiche avec l'indication du plan requis.
 *
 * RÈGLE DURE : CizaImmo calcule et affiche la répartition, mais
 * n'encaisse ni ne distribue AUCUN argent entre co-propriétaires.
 */
export default function IndivisionSection({ immeuble }: { immeuble: Immeuble }) {
  const t = useTranslations("indivision");
  const tc = useTranslations("crud.common");
  const tErr = useTranslations("crud");
  const locale = useLocale();

  const [profil, setProfil] = useState<Profil | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [coproprietaires, setCoproprietaires] = useState<Coproprietaire[]>([]);
  const [lignes, setLignes] = useState<LigneFormulaire[]>([]);
  const [taux, setTaux] = useState<TauxChange[]>([]);
  const [revenus, setRevenus] = useState(0);
  const [depensesTotal, setDepensesTotal] = useState(0);
  const [mois, setMois] = useState(moisCourantIso());
  /**
   * Sélecteur mois/année LOCALISÉ (remplace <input type="month">, dont la
   * langue est choisie par le navigateur, pas par l'application). Les noms
   * de mois viennent de Intl.DateTimeFormat avec la locale de l'app ; les
   * deux listes produisent la même valeur « AAAA-MM » que le champ natif.
   */
  const [anneeSel, moisSel] = mois.split("-").map(Number);
  const nomsMois = useMemo(() => {
    const format = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fr-FR", {
      month: "long",
    });
    return Array.from({ length: 12 }, (_, i) => {
      const nom = format.format(new Date(2026, i, 1));
      return nom.charAt(0).toUpperCase() + nom.slice(1);
    });
  }, [locale]);
  const annees = useMemo(() => {
    const anneeCourante = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, i) => anneeCourante - 5 + i);
  }, []);

  function changerMois(annee: number, moisNum: number) {
    setMois(`${annee}-${String(moisNum).padStart(2, "0")}`);
  }
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);

  const estProprietaire = profil?.role === "proprietaire";
  const estCoproprietaire = profil?.role === "coproprietaire";
  const planAutorise =
    plan === null ? false : INDIVISION_PAR_PLAN[(plan === "essai" ? "pro" : plan) as "starter" | "pro" | "agence"];

  async function charger() {
    setChargement(true);
    setErreur(null);
    try {
      const p = getDataProvider();
      const [prof, abo, copros, tx] = await Promise.all([
        p.getProfil(),
        p.getAbonnement(),
        p.listerCoproprietaires(immeuble.id),
        p.listerTaux(),
      ]);
      setProfil(prof);
      setPlan(abo ? (abo.statut === "essai" ? "essai" : abo.plan) : null);
      setCoproprietaires(copros);
      setLignes(
        copros.map((c) => ({
          cle: c.id,
          id: c.id,
          nom: c.nom,
          email: c.email,
          telephone: c.telephone,
          part: c.part,
          statut: c.statut,
        }))
      );
      setTaux(tx);
      await chargerPeriode(p, mois);
    } catch (e) {
      setErreur(messageErreur(tErr as unknown as (k: string) => string, e));
    } finally {
      setChargement(false);
    }
  }

  async function chargerPeriode(
    p: ReturnType<typeof getDataProvider>,
    moisChoisi: string
  ) {
    const [apts, baux, echs, pays, deps] = await Promise.all([
      p.listerAppartements({ immeubleId: immeuble.id, inclureArchives: true }),
      p.listerBaux(),
      p.listerEcheances(),
      p.listerPaiements(),
      p.listerDepenses({ immeubleId: immeuble.id }),
    ]);
    const aptIds = new Set(apts.map((a) => a.id));
    const bauxImm = baux.filter((b) => aptIds.has(b.appartement_id));
    const echIds = new Set(
      echs.filter((e) => bauxImm.some((b) => b.id === e.bail_id)).map((e) => e.id)
    );
    const revenusMois = pays
      .filter(
        (pay) =>
          pay.statut === "valide" &&
          echIds.has(pay.echeance_id) &&
          pay.date_paiement.slice(0, 7) === moisChoisi &&
          pay.devise === immeuble.devise
      )
      .reduce((s, pay) => s + pay.montant, 0);
    const depensesMois = deps
      .filter((d) => d.date.slice(0, 7) === moisChoisi && d.devise === immeuble.devise)
      .reduce((s, d) => s + d.montant, 0);
    setRevenus(revenusMois);
    setDepensesTotal(depensesMois);
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [immeuble.id]);

  useEffect(() => {
    if (!chargement) {
      const p = getDataProvider();
      chargerPeriode(p, mois).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mois]);

  const somme = useMemo(
    () =>
      Math.round(
        lignes.reduce((s, l) => s + (Number.isFinite(l.part) ? l.part : 0), 0) * 100
      ) / 100,
    [lignes]
  );

  const repartition = useMemo(
    () =>
      repartirResultatNet({
        revenus,
        depenses: depensesTotal,
        devise: immeuble.devise,
        coproprietaires,
        devise_cible: profil?.devise_principale ?? null,
        taux,
      }),
    [revenus, depensesTotal, immeuble.devise, coproprietaires, profil, taux]
  );

  const maLigne = useMemo(
    () =>
      estCoproprietaire && profil
        ? repartition.lignes.find(
            (l) => l.email.trim().toLowerCase() === profil.email.trim().toLowerCase()
          )
        : undefined,
    [estCoproprietaire, profil, repartition]
  );

  function majLigne(cle: string, patch: Partial<LigneFormulaire>) {
    setLignes((anciennes) =>
      anciennes.map((l) => (l.cle === cle ? { ...l, ...patch } : l))
    );
  }

  function ajouterLigne() {
    setLignes((anciennes) => [
      ...anciennes,
      {
        cle: `nouveau-${Date.now()}`,
        nom: "",
        email: "",
        telephone: null,
        part: 0,
        statut: "invite",
      },
    ]);
  }

  function retirerLigne(cle: string) {
    setLignes((anciennes) => anciennes.filter((l) => l.cle !== cle));
  }

  async function enregistrer(e: React.FormEvent) {
    e.preventDefault();
    setErreur(null);
    setMessage(null);
    setEnregistrement(true);
    try {
      const maj = await getDataProvider().definirParts(
        immeuble.id,
        lignes.map((l) => ({
          nom: l.nom,
          email: l.email,
          telephone: l.telephone,
          part: Number(l.part),
        }))
      );
      setCoproprietaires(maj);
      setLignes(
        maj.map((c) => ({
          cle: c.id,
          id: c.id,
          nom: c.nom,
          email: c.email,
          telephone: c.telephone,
          part: c.part,
          statut: c.statut,
        }))
      );
      setMessage(t("partsSaved"));
    } catch (err) {
      setErreur(messageErreur(tErr as unknown as (k: string) => string, err));
    } finally {
      setEnregistrement(false);
    }
  }

  async function retirer(id: string) {
    setErreur(null);
    try {
      await getDataProvider().retirerCoproprietaire(id);
      setCoproprietaires((anciens) => anciens.filter((c) => c.id !== id));
      setLignes((anciennes) => anciennes.filter((l) => l.id !== id));
      setMessage(t("removedDone"));
    } catch (err) {
      setErreur(messageErreur(tErr as unknown as (k: string) => string, err));
    }
  }

  async function accepter(id: string) {
    setErreur(null);
    try {
      const maj = await getDataProvider().accepterInvitationCoproprietaire(id);
      setCoproprietaires((anciens) => anciens.map((c) => (c.id === id ? maj : c)));
      setLignes((anciennes) =>
        anciennes.map((l) => (l.id === id ? { ...l, statut: "actif" } : l))
      );
      setMessage(t("acceptedDone"));
    } catch (err) {
      setErreur(messageErreur(tErr as unknown as (k: string) => string, err));
    }
  }

  if (chargement) {
    return (
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-navy">{t("title")}</h2>
        <p className="mt-2 text-slate-500">{tc("loading")}</p>
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-navy">{t("title")}</h2>
      <p className="mt-2 text-sm text-slate-600">{t("subtitle")}</p>
      <p role="note" className="mt-3 rounded-xl border border-gold/50 bg-amber-50 px-4 py-3 text-sm font-semibold text-navy">
        {t("hardRule")}
      </p>
      {estCoproprietaire ? (
        <p role="note" className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-semibold text-navy">
          {t("readOnlyNote")}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="mt-3 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">{message}</p>
      ) : null}
      {erreur ? (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erreur}</p>
      ) : null}

      {!planAutorise && estProprietaire ? (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-bold text-navy">{t("planRequired")}</p>
          <p className="mt-1 text-sm text-slate-600">{t("planRequiredText")}</p>
        </div>
      ) : null}

      {/* Répartition des revenus de la période */}
      <div className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-bold text-navy">{t("yourShareTitle")}</h3>
          <label className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
            {t("periodLabel")}
            <select
              value={moisSel}
              onChange={(e) => changerMois(anneeSel, Number(e.target.value))}
              aria-label={t("monthLabel")}
              className="min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-gold"
            >
              {nomsMois.map((nom, i) => (
                <option key={i + 1} value={i + 1}>{nom}</option>
              ))}
            </select>
            <select
              value={anneeSel}
              onChange={(e) => changerMois(Number(e.target.value), moisSel)}
              aria-label={t("yearLabel")}
              className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-gold"
            >
              {annees.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">{t("revenues")}</dt>
            <dd className="font-bold text-navy">{formatMoney(revenus, immeuble.devise, locale)}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">{t("expenses")}</dt>
            <dd className="font-bold text-navy">{formatMoney(depensesTotal, immeuble.devise, locale)}</dd>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <dt className="text-xs text-slate-500">{t("netResult")}</dt>
            <dd className="font-bold text-navy">{formatMoney(repartition.resultat_net, immeuble.devise, locale)}</dd>
          </div>
        </dl>
        {coproprietaires.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">{t("noCoproprietaires")}</p>
        ) : !repartition.parts_completes ? (
          <p role="alert" className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            {t("incompleteWarning")} ({t("totalLabel")} : {repartition.somme_parts} %)
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {repartition.lignes.map((ligne) => {
              const estMoi =
                estCoproprietaire &&
                profil?.email.trim().toLowerCase() === ligne.email.trim().toLowerCase();
              return (
                <li
                  key={ligne.coproprietaire_id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-sm ${estMoi ? "border-gold bg-amber-50" : "border-slate-200"}`}
                >
                  <span>
                    <strong className="text-navy">{ligne.nom}</strong>
                    {estMoi ? ` — ${t("yourShare")}` : ""} · {ligne.part} %
                  </span>
                  <span className="text-right">
                    <span className="font-bold text-navy">
                      {formatMoney(ligne.montant, ligne.devise, locale)}
                    </span>
                    {ligne.montant_converti !== null && ligne.devise_convertie ? (
                      <span className="block text-xs text-slate-500">
                        ≈ {formatMoney(ligne.montant_converti, ligne.devise_convertie, locale)}
                        {" · "}
                        {t("convertedNote", {
                          date: formatDate(ligne.date_taux?.slice(0, 10) ?? null, locale),
                          manual: ligne.source_taux === "manuel" ? " (manuel)" : "",
                        })}
                      </span>
                    ) : ligne.devise_convertie === null && profil && profil.devise_principale !== immeuble.devise ? (
                      <span className="block text-xs text-slate-500">{t("rateUnavailable")}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {estCoproprietaire && maLigne ? (
          <p className="mt-3 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">
            {t("yourAmount")} : {formatMoney(maLigne.montant, maLigne.devise, locale)}
          </p>
        ) : null}
      </div>

      {/* Gestion des parts (propriétaire, plan autorisé) */}
      {estProprietaire && planAutorise ? (
        <form onSubmit={enregistrer} noValidate className="mt-6 border-t border-slate-100 pt-4">
          <h3 className="font-bold text-navy">{t("inviteTitle")}</h3>
          <p className="mt-1 text-sm text-slate-600">{t("shareHint")}</p>
          <div className="mt-3 space-y-4">
            {lignes.map((l) => (
              <div key={l.cle} className="rounded-xl border border-slate-200 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-900">
                    {t("formName")}
                    <input
                      type="text"
                      value={l.nom}
                      onChange={(e) => majLigne(l.cle, { nom: e.target.value })}
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-slate-900">
                    {t("formEmail")}
                    <input
                      type="email"
                      value={l.email}
                      onChange={(e) => majLigne(l.cle, { email: e.target.value })}
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-slate-900">
                    {t("formPhone")}
                    <input
                      type="tel"
                      value={l.telephone ?? ""}
                      onChange={(e) => majLigne(l.cle, { telephone: e.target.value || null })}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-slate-900">
                    {t("formShare")}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={Number.isFinite(l.part) ? String(l.part) : ""}
                      onChange={(e) => majLigne(l.cle, { part: Number(e.target.value) })}
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold"
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${l.statut === "actif" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>
                    {l.statut === "actif" ? t("statusActive") : t("statusInvited")}
                  </span>
                  {l.id && l.statut === "invite" ? (
                    <button type="button" onClick={() => accepter(l.id!)} className="text-sm font-semibold text-navy underline">
                      {t("accept")}
                    </button>
                  ) : null}
                  {l.id ? (
                    <button type="button" onClick={() => retirer(l.id!)} className="text-sm font-semibold text-red-700 underline">
                      {t("remove")}
                    </button>
                  ) : (
                    <button type="button" onClick={() => retirerLigne(l.cle)} className="text-sm font-semibold text-red-700 underline">
                      {t("remove")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={ajouterLigne} className="rounded-full border border-navy px-4 py-2 text-sm font-bold text-navy">
              {t("addCoOwner")}
            </button>
            <button type="submit" disabled={enregistrement} className="rounded-full bg-navy px-6 py-2.5 text-sm font-bold text-white hover:bg-navy-light disabled:opacity-50">
              {enregistrement ? tc("saving") : t("saveParts")}
            </button>
            <span className={`text-sm font-bold ${Math.abs(somme - 100) < 0.01 ? "text-green-700" : "text-red-700"}`}>
              {t("totalLabel")} : {somme} %
            </span>
          </div>
        </form>
      ) : null}

      {/* Lecture seule (co-propriétaire) : liste des parts du bien */}
      {estCoproprietaire ? (
        <ul className="mt-4 space-y-2">
          {coproprietaires.map((c) => (
            <li key={c.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm">
              <span>{c.nom}</span>
              <span className="font-bold text-navy">{c.part} %</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

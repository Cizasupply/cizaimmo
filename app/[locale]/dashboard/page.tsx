"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import { formatDate, formatMoney, formatPct } from "@/lib/format";
import { getDataProvider } from "@/lib/data";
import type {
  Activite,
  Alerte,
  Appartement,
  Bail,
  Depense,
  Devise,
  EcheanceLoyer,
  Immeuble,
  Locataire,
  Paiement,
  Profil,
  TauxChange,
} from "@/lib/data";
import { DEVISES } from "@/lib/data";
import { moisCourant } from "@/lib/parc";
import { calculerIndicateurs, convertirMontant, urlActivite } from "@/lib/module4";
import { totalPayeValide } from "@/lib/loyers";
import { messageErreur } from "@/lib/translateError";

function moisAffiche(moisIso: string, locale: string): string {
  const [a, m] = moisIso.slice(0, 7).split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fr-FR", { month: "short" }).format(new Date(a, m - 1, 1));
}

export default function DashboardPage() {
  const t = useTranslations("crud");
  const td = useTranslations("dashboard");
  const tp = useTranslations("pages");
  const tc = useTranslations("crud.common");
  const locale = useLocale();
  const router = useRouter();

  const [profil, setProfil] = useState<Profil | null>(null);
  const [immeubles, setImmeubles] = useState<Immeuble[]>([]);
  const [appartements, setAppartements] = useState<Appartement[]>([]);
  const [locataires, setLocataires] = useState<Locataire[]>([]);
  const [baux, setBaux] = useState<Bail[]>([]);
  const [echeances, setEcheances] = useState<EcheanceLoyer[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [activites, setActivites] = useState<Activite[]>([]);
  const [alertes, setAlertes] = useState<Alerte[]>([]);
  const [taux, setTaux] = useState<TauxChange[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [deviseAffichage, setDeviseAffichage] = useState<Devise>("USD");
  const [filtreImmeubleFeed, setFiltreImmeubleFeed] = useState("");

  const moisIso = moisCourant();

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
      const [prof, ims, apts, locs, bx, ech, pay, deps, acts, tx] = await Promise.all([
        p.getProfil(),
        p.listerImmeubles(true),
        p.listerAppartements({ inclureArchives: true }),
        p.listerLocataires(),
        p.listerBaux(),
        p.listerEcheances(),
        p.listerPaiements(),
        p.listerDepenses(),
        p.listerActivites(),
        p.listerTaux(),
      ]);
      setProfil(prof);
      if (prof) setDeviseAffichage(prof.devise_principale);
      setImmeubles(ims);
      setAppartements(apts);
      setLocataires(locs);
      setBaux(bx);
      setEcheances(ech);
      setPaiements(pay);
      setDepenses(deps);
      setActivites(acts);
      setTaux(tx);
      // Génération idempotente des alertes (retard, fin de bail, vacance…).
      try {
        const al = await p.genererAlertes();
        setAlertes(al);
      } catch {
        setAlertes(await p.listerAlertes());
      }
    } catch (e) {
      setErreur(messageErreur(t as unknown as (k: string) => string, e));
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const indicateurs = useMemo(
    () =>
      calculerIndicateurs({
        immeubles,
        appartements,
        baux,
        echeances,
        paiements,
        depenses,
        moisIso,
      }),
    [immeubles, appartements, baux, echeances, paiements, depenses, moisIso]
  );

  const bailDe = (bailId: string) => baux.find((b) => b.id === bailId);
  const locataireDe = (bail?: Bail) => (bail ? locataires.find((l) => l.id === bail.locataire_id) : undefined);
  const appartementDe = (bail?: Bail) => (bail ? appartements.find((a) => a.id === bail.appartement_id) : undefined);
  const immeubleDe = (apt?: Appartement) => (apt ? immeubles.find((i) => i.id === apt.immeuble_id) : undefined);

  /** Totaux convertis dans la devise d'affichage, avec date du taux. */
  function totauxConvertis(groupes: { devise: Devise; total: number }[]): {
    lignes: { devise: Devise; total: number; converti: number | null; dateTaux: string | null; source: string | null }[];
    totalConverti: number | null;
  } {
    let totalConverti: number | null = 0;
    const lignes = groupes.map(({ devise, total }) => {
      if (devise === deviseAffichage) return { devise, total, converti: total, dateTaux: null, source: null };
      const conv = convertirMontant(total, devise, deviseAffichage, taux);
      if (!conv) {
        totalConverti = null;
        return { devise, total, converti: null, dateTaux: null, source: null };
      }
      if (totalConverti !== null) totalConverti += conv.montant;
      return { devise, total, converti: conv.montant, dateTaux: conv.taux.date_taux, source: conv.taux.source };
    });
    return { lignes, totalConverti };
  }

  const collectesConv = useMemo(
    () => totauxConvertis(indicateurs.collectes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [indicateurs, deviseAffichage, taux]
  );
  const attendusConv = useMemo(
    () => totauxConvertis(indicateurs.attendus),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [indicateurs, deviseAffichage, taux]
  );
  const retardsConv = useMemo(
    () => totauxConvertis(indicateurs.enRetard),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [indicateurs, deviseAffichage, taux]
  );

  const feed = useMemo(() => {
    if (!filtreImmeubleFeed) return activites;
    const aptIds = new Set(appartements.filter((a) => a.immeuble_id === filtreImmeubleFeed).map((a) => a.id));
    return activites.filter((a) => {
      if (a.entite_type === "immeuble") return a.entite_id === filtreImmeubleFeed;
      if (a.entite_type === "appartement") return a.entite_id ? aptIds.has(a.entite_id) : false;
      return true;
    });
  }, [activites, filtreImmeubleFeed, appartements]);

  // Graphique SVG fait main : collecte des 6 derniers mois, en devise d'affichage.
  const serieGraphique = useMemo(() => {
    return indicateurs.collecte6Mois.map((m) => {
      const converti = (groupes: { devise: Devise; total: number }[]): number => {
        let somme = 0;
        for (const g of groupes) {
          if (g.devise === deviseAffichage) somme += g.total;
          else {
            const c = convertirMontant(g.total, g.devise, deviseAffichage, taux);
            if (c) somme += c.montant;
          }
        }
        return somme;
      };
      return { mois: m.mois, collecte: converti(m.collectes), attendu: converti(m.attendus) };
    });
  }, [indicateurs, deviseAffichage, taux]);
  const maxGraphique = Math.max(1, ...serieGraphique.map((s) => Math.max(s.collecte, s.attendu)));

  const alertesActives = alertes.filter((a) => a.statut === "active");

  function iconeActivite(type: Activite["type"]): string {
    return type === "paiement" ? "💰" : type === "depense" ? "🧾" : type === "bail" ? "📄" : type === "document" ? "📎" : type === "alerte" ? "🔔" : "🏠";
  }

  return (
    <AppShell title={tp("dashboard.title")}>
      {erreur ? (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {erreur}
          <button type="button" onClick={charger} className="ml-3 font-bold underline">
            {tc("retry")}
          </button>
        </div>
      ) : null}

      {chargement ? (
        <div className="space-y-3" aria-busy="true">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
            ))}
          </div>
          <div className="h-48 animate-pulse rounded-2xl bg-white shadow-sm" />
          <p className="text-sm text-slate-500">{tc("loading")}</p>
        </div>
      ) : immeubles.filter((i) => i.statut === "actif").length === 0 ? (
        <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-lg font-bold text-navy">{td("starterTitle")}</h2>
          <p className="mt-2 text-slate-600">{td("starterText")}</p>
          <ol className="mt-4 space-y-3">
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">1</span>
              <p className="text-base text-slate-800">{td("starterStep1")}</p>
            </li>
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">2</span>
              <p className="text-base text-slate-800">{td("starterStep2")}</p>
            </li>
            <li className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-bold text-white">3</span>
              <p className="text-base text-slate-800">{td("starterStep3")}</p>
            </li>
          </ol>
          <Link href="/immeubles/nouveau" className="mt-6 inline-block rounded-full bg-navy px-6 py-3 text-base font-bold text-white hover:bg-navy-light">
            {td("starterCta")}
          </Link>
        </div>
      ) : (
        <>
          {/* Convertisseur intégré */}
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              {td("displayCurrency")}
              <select
                value={deviseAffichage}
                onChange={(e) => setDeviseAffichage(e.target.value as Devise)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-gold"
              >
                {DEVISES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>
            <p className="text-sm text-slate-600">{td("converterNote")}</p>
          </div>

          {/* 4 chiffres clés */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-600">{td("occupancy")}</p>
              <p className="mt-1 text-2xl font-bold text-navy">
                {indicateurs.occupation === null ? "—" : formatPct(indicateurs.occupation, locale)}
              </p>
              <p className="text-sm text-slate-600">{td("occupiedCount", { occupied: indicateurs.nbOccupes, total: indicateurs.nbLouables })}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-600">{td("collectedMonth")}</p>
              {collectesConv.lignes.map((l) => (
                <p key={l.devise} className="mt-1 text-lg font-bold text-navy">
                  {formatMoney(l.total, l.devise, locale)}
                  {l.converti !== null && l.devise !== deviseAffichage ? (
                    <span className="block text-sm font-normal text-slate-600">
                      ≈ {formatMoney(l.converti, deviseAffichage, locale)}
                      {l.dateTaux ? ` · ${td("rateDate", { date: formatDate(l.dateTaux.slice(0, 10), locale) })}${l.source === "manuel" ? ` · ${td("manualRate")}` : ""}` : ""}
                    </span>
                  ) : null}
                </p>
              ))}
              <p className="text-sm text-slate-600">
                {td("expectedMonth")}: {attendusConv.lignes.map((l) => formatMoney(l.total, l.devise, locale)).join(" + ") || "—"}
              </p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-600">{td("lateAmount")}</p>
              {retardsConv.lignes.length === 0 ? (
                <p className="mt-1 text-2xl font-bold text-navy">0</p>
              ) : (
                retardsConv.lignes.map((l) => (
                  <p key={l.devise} className="mt-1 text-lg font-bold text-red-700">
                    {formatMoney(l.total, l.devise, locale)}
                    {l.converti !== null && l.devise !== deviseAffichage ? (
                      <span className="block text-sm font-normal text-slate-600">
                        ≈ {formatMoney(l.converti, deviseAffichage, locale)}
                        {l.dateTaux ? ` · ${td("rateDate", { date: formatDate(l.dateTaux.slice(0, 10), locale) })}` : ""}
                      </span>
                    ) : null}
                  </p>
                ))
              )}
              <p className="text-sm text-slate-600">{td("lateCount", { count: indicateurs.retards.length })}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-slate-600">{td("vacant")}</p>
              <p className="mt-1 text-2xl font-bold text-navy">{indicateurs.nbVacants}</p>
              <p className="text-sm text-slate-600">{td("vacantHint")}</p>
            </div>
          </div>

          {alertesActives.length > 0 ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <p className="font-bold text-amber-900">{td("activeAlerts", { count: alertesActives.length })}</p>
              <Link href="/alertes" className="text-sm font-semibold text-navy underline">{td("viewAlerts")}</Link>
            </div>
          ) : null}

          {/* Actions rapides */}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/loyers" className="rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-light">{td("quickDeclare")}</Link>
            <Link href="/depenses" className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-navy hover:border-gold">{td("quickExpense")}</Link>
            <Link href="/immeubles/nouveau" className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-navy hover:border-gold">{td("quickBuilding")}</Link>
          </div>

          {/* Retards */}
          <section className="mt-6 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold text-navy">{td("lateList")}</h2>
            {indicateurs.retards.length === 0 ? (
              <p className="mt-2 text-slate-600">{td("noLate")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {indicateurs.retards.slice(0, 5).map((e) => {
                  const bail = bailDe(e.bail_id);
                  const loc = locataireDe(bail);
                  const apt = appartementDe(bail);
                  const imm = immeubleDe(apt);
                  const paye = totalPayeValide(paiements.filter((p) => p.echeance_id === e.id), e.devise);
                  return (
                    <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                      <div>
                        <p className="font-semibold text-navy">{loc?.nom ?? "—"} — {apt?.numero ?? "—"} ({imm?.nom ?? "—"})</p>
                        <p className="text-sm text-slate-600">{e.mois.slice(0, 7)} · {td("remaining")}: {formatMoney(e.montant_du - paye, e.devise, locale)}</p>
                      </div>
                      <Link href="/loyers" className="shrink-0 text-sm font-semibold text-navy underline">{td("open")}</Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Fins de bail + dépenses du mois */}
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold text-navy">{td("leasesEnding")}</h2>
              {indicateurs.finsDeBail60j.length === 0 ? (
                <p className="mt-2 text-slate-600">{td("noLeaseEnding")}</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {indicateurs.finsDeBail60j.map((b) => {
                    const loc = locataireDe(b);
                    const apt = appartementDe(b);
                    return (
                      <li key={b.id} className="py-2">
                        <p className="font-semibold text-navy">{loc?.nom ?? "—"} — {apt?.numero ?? "—"}</p>
                        <p className="text-sm text-slate-600">{td("leaseEndsOn", { date: formatDate(b.fin, locale) })}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <section className="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold text-navy">{td("expensesMonth")}</h2>
              {indicateurs.depensesMois.length === 0 ? (
                <p className="mt-2 text-slate-600">{td("noExpenseMonth")}</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {indicateurs.depensesMois.slice(0, 5).map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                      <p className="font-semibold text-navy">{d.libelle}</p>
                      <p className="shrink-0 text-sm font-semibold">{formatMoney(d.montant, d.devise, locale)}</p>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/depenses" className="mt-2 inline-block text-sm font-semibold text-navy underline">{td("viewExpenses")}</Link>
            </section>
          </div>

          {/* Graphique collecte 6 mois */}
          <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold text-navy">{td("collectionChart")}</h2>
            <p className="text-sm text-slate-600">{td("chartInCurrency", { currency: deviseAffichage })}</p>
            <div className="mt-4 overflow-x-auto">
              <svg viewBox="0 0 360 170" className="w-full min-w-[320px]" role="img" aria-label={td("collectionChart")}>
                {[0, 1, 2, 3].map((i) => (
                  <line key={i} x1="0" x2="360" y1={30 + i * 30} y2={30 + i * 30} stroke="#e2e8f0" strokeWidth="1" />
                ))}
                {serieGraphique.map((s, i) => {
                  const x = 20 + i * 56;
                  const hAttendu = Math.round((s.attendu / maxGraphique) * 110);
                  const hCollecte = Math.round((s.collecte / maxGraphique) * 110);
                  return (
                    <g key={s.mois}>
                      <rect x={x} y={140 - hAttendu} width="20" height={hAttendu} fill="#cbd5e1" rx="2" />
                      <rect x={x + 22} y={140 - hCollecte} width="20" height={hCollecte} fill="#1B2A4A" rx="2" />
                      <text x={x + 21} y="158" textAnchor="middle" fontSize="10" fill="#475569">{moisAffiche(s.mois, locale)}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              <span className="mr-4"><span className="inline-block h-3 w-3 rounded-sm bg-navy align-middle" /> {td("chartCollected")}</span>
              <span><span className="inline-block h-3 w-3 rounded-sm bg-slate-300 align-middle" /> {td("chartExpected")}</span>
            </p>
          </section>

          {/* Fil d'actualité */}
          <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-navy">{td("feedTitle")}</h2>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                {td("feedFilterBuilding")}
                <select
                  value={filtreImmeubleFeed}
                  onChange={(e) => setFiltreImmeubleFeed(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-gold"
                >
                  <option value="">{tc("all")}</option>
                  {immeubles.filter((i) => i.statut === "actif").map((i) => (
                    <option key={i.id} value={i.id}>{i.nom}</option>
                  ))}
                </select>
              </label>
            </div>
            {feed.length === 0 ? (
              <p className="mt-2 text-slate-600">{td("feedEmpty")}</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {feed.slice(0, 20).map((a) => {
                  const url = urlActivite(a);
                  const contenu = (
                    <>
                      <span aria-hidden="true" className="mr-2">{iconeActivite(a.type)}</span>
                      <span className="font-medium text-navy">{a.description}</span>
                      <span className="block text-sm text-slate-500 sm:inline sm:ml-2">{formatDate(a.created_at.slice(0, 10), locale)}</span>
                    </>
                  );
                  return (
                    <li key={a.id} className="py-2">
                      {url ? (
                        <Link href={url} className="block rounded-lg px-2 py-1 hover:bg-slate-50">{contenu}</Link>
                      ) : (
                        <span className="block px-2 py-1">{contenu}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}

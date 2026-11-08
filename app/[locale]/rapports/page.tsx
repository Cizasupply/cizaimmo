"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { formatDate, formatMoney, formatPct } from "@/lib/format";
import { getDataProvider } from "@/lib/data";
import type {
  Appartement,
  Bail,
  Depense,
  Devise,
  EcheanceLoyer,
  Immeuble,
  Paiement,
  TauxChange,
} from "@/lib/data";
import { DEVISES } from "@/lib/data";
import { calculerRapport, convertirMontant, roiAppartement } from "@/lib/module4";
import { buildRapportWorkbook, telechargerWorkbook } from "@/lib/exports";
import { telechargerRapportPdf } from "@/lib/rapport-pdf";
import { messageErreur } from "@/lib/translateError";

function debutAnnee(): string {
  return `${new Date().getFullYear()}-01-01`;
}
function aujourdhuiIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Couleur du taux d'occupation : vert ≥ 80 %, ambre 50–79 %, rouge < 50 % (même règle que la page Immeubles). */
function couleurOccupation(occupation: number | null | undefined): string {
  if (occupation === null || occupation === undefined) return "text-slate-500";
  if (occupation >= 0.8) return "text-green-700";
  if (occupation >= 0.5) return "text-amber-700";
  return "text-red-700";
}

/** Montant / pourcentage signé : vert si ≥ 0, rouge si négatif. */
function couleurSigne(valeur: number | null | undefined): string {
  if (valeur === null || valeur === undefined) return "text-navy";
  return valeur >= 0 ? "text-green-700" : "text-red-700";
}

export default function RapportsPage() {
  const t = useTranslations("crud");
  const tr = useTranslations("reports");
  const tp = useTranslations("pages");
  const tc = useTranslations("crud.common");
  const locale = useLocale();
  const router = useRouter();

  const [immeubles, setImmeubles] = useState<Immeuble[]>([]);
  const [appartements, setAppartements] = useState<Appartement[]>([]);
  const [baux, setBaux] = useState<Bail[]>([]);
  const [echeances, setEcheances] = useState<EcheanceLoyer[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [taux, setTaux] = useState<TauxChange[]>([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  const [periodeDebut, setPeriodeDebut] = useState(debutAnnee());
  const [periodeFin, setPeriodeFin] = useState(aujourdhuiIso());
  const [immeubleId, setImmeubleId] = useState("");
  const [deviseAffichage, setDeviseAffichage] = useState<Devise>("USD");

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
      const [ims, apts, bx, ech, pay, deps, tx, prof] = await Promise.all([
        p.listerImmeubles(true),
        p.listerAppartements({ inclureArchives: true }),
        p.listerBaux(),
        p.listerEcheances(),
        p.listerPaiements(),
        p.listerDepenses(),
        p.listerTaux(),
        p.getProfil(),
      ]);
      setImmeubles(ims);
      setAppartements(apts);
      setBaux(bx);
      setEcheances(ech);
      setPaiements(pay);
      setDepenses(deps);
      setTaux(tx);
      if (prof) setDeviseAffichage(prof.devise_principale);
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

  const rapport = useMemo(
    () =>
      calculerRapport({
        immeubles,
        appartements,
        baux,
        echeances,
        paiements,
        depenses,
        periodeDebut,
        periodeFin,
        immeubleId: immeubleId || null,
      }),
    [immeubles, appartements, baux, echeances, paiements, depenses, periodeDebut, periodeFin, immeubleId]
  );

  // Évolution mensuelle (revenus déclarés vs dépenses) sur la période.
  const serieMensuelle = useMemo(() => {
    const mois: string[] = [];
    const [a1, m1] = periodeDebut.slice(0, 7).split("-").map(Number);
    const [a2, m2] = periodeFin.slice(0, 7).split("-").map(Number);
    let a = a1;
    let m = m1;
    while (a < a2 || (a === a2 && m <= m2)) {
      mois.push(`${a}-${String(m).padStart(2, "0")}`);
      m += 1;
      if (m > 12) { m = 1; a += 1; }
      if (mois.length > 24) break;
    }
    return mois.map((moisStr) => {
      const revenus = paiements
        .filter((p) => p.statut === "valide" && p.date_paiement.slice(0, 7) === moisStr)
        .reduce((s, p) => s + (p.devise === deviseAffichage ? p.montant : convertirMontant(p.montant, p.devise, deviseAffichage, taux)?.montant ?? 0), 0);
      const dep = depenses
        .filter((d) => d.date.slice(0, 7) === moisStr)
        .reduce((s, d) => s + (d.devise === deviseAffichage ? d.montant : convertirMontant(d.montant, d.devise, deviseAffichage, taux)?.montant ?? 0), 0);
      return { mois: moisStr, revenus, depenses: dep };
    });
  }, [paiements, depenses, periodeDebut, periodeFin, deviseAffichage, taux]);

  const maxSerie = Math.max(1, ...serieMensuelle.map((s) => Math.max(s.revenus, s.depenses)));

  // Taux utilisés, en clair, pour le rapport multi-devises.
  const tauxUtilises = useMemo(() => {
    const paires = new Set<string>();
    for (const p of paiements) if (p.devise !== deviseAffichage) paires.add(`${p.devise}->${deviseAffichage}`);
    for (const d of depenses) if (d.devise !== deviseAffichage) paires.add(`${d.devise}->${deviseAffichage}`);
    return Array.from(paires).map((paire) => {
      const [src, dst] = paire.split("->") as [Devise, Devise];
      const conv = convertirMontant(1, src, dst, taux);
      if (!conv) return `${src} → ${dst} : ${tr("rateMissing")}`;
      return `${src} → ${dst} : ${conv.taux.taux} (${tr("rateDate", { date: formatDate(conv.taux.date_taux.slice(0, 10), locale) })}${conv.taux.source === "manuel" ? `, ${tr("manualRate")}` : ""})`;
    });
  }, [paiements, depenses, deviseAffichage, taux, tr, locale]);

  const aptsRoi = useMemo(() => {
    if (!immeubleId) return [];
    const imm = immeubles.find((i) => i.id === immeubleId);
    return appartements
      .filter((a) => a.immeuble_id === immeubleId && !a.archive)
      .map((a) => ({
        appartement: a,
        roi: roiAppartement({ appartement: a, immeuble: imm, baux, echeances, paiements, depenses, periodeDebut, periodeFin }),
      }));
  }, [immeubleId, immeubles, appartements, baux, echeances, paiements, depenses, periodeDebut, periodeFin]);

  function exporterExcel() {
    const devises = Array.from(new Set([...rapport.revenusParDevise.map((r) => r.devise), ...rapport.depensesParDevise.map((r) => r.devise)]));
    const wb = buildRapportWorkbook(rapport, {
      periode: `${periodeDebut} → ${periodeFin}`,
      dateExport: aujourdhuiIso(),
      devises,
      tauxUtilises,
    });
    telechargerWorkbook(wb, `cizaimmo-rapport-${periodeDebut.slice(0, 7)}-${periodeFin.slice(0, 7)}.xlsx`);
  }

  function exporterPdf() {
    telechargerRapportPdf({
      rapport,
      tauxUtilises,
      dateExport: aujourdhuiIso(),
      langue: locale === "en" ? "en" : "fr",
    });
  }

  return (
    <AppShell title={tp("reports.title")}>
      {erreur ? (
        <div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {erreur}
          <button type="button" onClick={charger} className="ml-3 font-bold underline">
            {tc("retry")}
          </button>
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="block text-sm font-semibold text-slate-900">
          {tr("periodFrom")}
          <input type="date" value={periodeDebut} onChange={(e) => setPeriodeDebut(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base font-normal outline-none focus:border-gold" />
        </label>
        <label className="block text-sm font-semibold text-slate-900">
          {tr("periodTo")}
          <input type="date" value={periodeFin} onChange={(e) => setPeriodeFin(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base font-normal outline-none focus:border-gold" />
        </label>
        <label className="block text-sm font-semibold text-slate-900">
          {tr("building")}
          <select value={immeubleId} onChange={(e) => setImmeubleId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-normal outline-none focus:border-gold">
            <option value="">{tr("wholePortfolio")}</option>
            {immeubles.filter((i) => i.statut === "actif").map((i) => (
              <option key={i.id} value={i.id}>{i.nom}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-900">
          {tr("displayCurrency")}
          <select value={deviseAffichage} onChange={(e) => setDeviseAffichage(e.target.value as Devise)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-normal outline-none focus:border-gold">
            {DEVISES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
      </div>

      {chargement ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white shadow-sm" />
          ))}
          <p className="text-sm text-slate-500">{tc("loading")}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rapport.revenusParDevise.map((r) => {
              const dep = rapport.depensesParDevise.find((d) => d.devise === r.devise)?.total ?? 0;
              const roi = rapport.roiParc.find((x) => x.devise === r.devise);
              const marge = rapport.margeParc.find((x) => x.devise === r.devise)?.marge ?? null;
              return (
                <div key={r.devise} className="min-w-0 break-words rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-bold text-navy">{r.devise}</p>
                  <p className="mt-2 text-sm text-slate-600">{tr("income")}: <span className="break-all font-semibold text-green-700">{formatMoney(r.total, r.devise, locale)}</span></p>
                  <p className="text-sm text-slate-600">{tr("expenses")}: <span className="break-all font-semibold text-navy">{formatMoney(dep, r.devise, locale)}</span></p>
                  <p className="text-sm text-slate-600">{tr("netResult")}: <span className={`break-all font-semibold ${couleurSigne(r.total - dep)}`}>{formatMoney(r.total - dep, r.devise, locale)}</span></p>
                  <p className="mt-2 text-sm text-slate-600">
                    ROI: <span className={`font-bold ${roi?.roi === null || roi?.roi === undefined ? "text-navy" : couleurSigne(roi.roi)}`}>{roi?.roi === null || roi?.roi === undefined ? tr("valueToEnter") : formatPct(roi.roi, locale)}</span>
                  </p>
                  <p className="text-sm text-slate-600">
                    {tr("netMargin")}: <span className={`font-bold ${marge === null ? "text-navy" : couleurSigne(marge)}`}>{marge === null ? "—" : formatPct(marge, locale)}</span>
                  </p>
                </div>
              );
            })}
            {rapport.revenusParDevise.length === 0 ? (
              <p className="rounded-2xl border border-slate-200 bg-white p-4 text-slate-600 shadow-sm sm:col-span-2">{tr("noData")}</p>
            ) : null}
          </div>

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold text-navy">{tr("byBuilding")}</h2>
            {/* Cartes — téléphone : le tableau 7 colonnes ne tient pas à 390 px. */}
            <div className="mt-3 space-y-3 md:hidden">
              {rapport.lignes.map((l) => (
                <article key={l.immeuble_id} className="rounded-xl border border-slate-200 p-3">
                  <p className="break-words font-bold text-navy">{l.immeuble_nom}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="min-w-0"><dt className="text-slate-500">{tr("income")}</dt><dd className="break-all font-semibold text-green-700">{formatMoney(l.revenus, l.devise, locale)}</dd></div>
                    <div className="min-w-0"><dt className="text-slate-500">{tr("expenses")}</dt><dd className="break-all font-semibold text-navy">{formatMoney(l.depenses, l.devise, locale)}</dd></div>
                    <div className="min-w-0"><dt className="text-slate-500">{tr("netResult")}</dt><dd className={`break-all font-semibold ${couleurSigne(l.resultatNet)}`}>{formatMoney(l.resultatNet, l.devise, locale)}</dd></div>
                    <div className="min-w-0"><dt className="text-slate-500">ROI</dt><dd className={`font-bold ${l.roi === null ? "text-navy" : couleurSigne(l.roi)}`}>{l.roi === null ? tr("valueToEnter") : formatPct(l.roi, locale)}</dd></div>
                    <div className="min-w-0"><dt className="text-slate-500">{tr("netMargin")}</dt><dd className={`font-bold ${l.marge === null ? "text-navy" : couleurSigne(l.marge)}`}>{l.marge === null ? "—" : formatPct(l.marge, locale)}</dd></div>
                    <div className="min-w-0"><dt className="text-slate-500">{tr("occupancy")}</dt><dd className={`font-bold ${couleurOccupation(l.occupation)}`}>{l.occupation === null ? "—" : formatPct(l.occupation, locale)}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
            {/* Tableau — ordinateur. */}
            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-600">
                    <th className="px-2 py-2">{tr("building")}</th>
                    <th className="px-2 py-2 text-right">{tr("income")}</th>
                    <th className="px-2 py-2 text-right">{tr("expenses")}</th>
                    <th className="px-2 py-2 text-right">{tr("netResult")}</th>
                    <th className="px-2 py-2 text-right">ROI</th>
                    <th className="px-2 py-2 text-right">{tr("netMargin")}</th>
                    <th className="px-2 py-2 text-right">{tr("occupancy")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rapport.lignes.map((l) => (
                    <tr key={l.immeuble_id} className="border-b border-slate-100">
                      <td className="px-2 py-2 font-semibold text-navy">{l.immeuble_nom}</td>
                      <td className="px-2 py-2 text-right font-semibold text-green-700">{formatMoney(l.revenus, l.devise, locale)}</td>
                      <td className="px-2 py-2 text-right">{formatMoney(l.depenses, l.devise, locale)}</td>
                      <td className={`px-2 py-2 text-right font-semibold ${couleurSigne(l.resultatNet)}`}>{formatMoney(l.resultatNet, l.devise, locale)}</td>
                      <td className={`px-2 py-2 text-right font-bold ${l.roi === null ? "text-navy" : couleurSigne(l.roi)}`}>{l.roi === null ? tr("valueToEnter") : formatPct(l.roi, locale)}</td>
                      <td className={`px-2 py-2 text-right ${l.marge === null ? "" : couleurSigne(l.marge)}`}>{l.marge === null ? "—" : formatPct(l.marge, locale)}</td>
                      <td className={`px-2 py-2 text-right font-bold ${couleurOccupation(l.occupation)}`}>{l.occupation === null ? "—" : formatPct(l.occupation, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-slate-600">{tr("roiNote")}</p>
          </section>

          {immeubleId && aptsRoi.length > 0 ? (
            <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold text-navy">{tr("byApartment")}</h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {aptsRoi.map(({ appartement, roi }) => (
                  <li key={appartement.id} className="flex justify-between gap-2 py-2">
                    <span className="min-w-0 break-words font-semibold text-navy">{appartement.numero}</span>
                    <span className={`shrink-0 text-sm font-semibold ${roi === null ? "text-slate-600" : couleurSigne(roi)}`}>{roi === null ? tr("valueToEnter") : `ROI ${formatPct(roi, locale)}`}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold text-navy">{tr("evolution")}</h2>
            <p className="text-sm text-slate-600">{tr("evolutionInCurrency", { currency: deviseAffichage })}</p>
            <div className="mt-4 overflow-x-auto">
              <svg viewBox={`0 0 ${Math.max(360, serieMensuelle.length * 60)} 170`} className="w-full min-w-[320px]" role="img" aria-label={tr("evolution")}>
                {[0, 1, 2, 3].map((i) => (
                  <line key={i} x1="0" x2={Math.max(360, serieMensuelle.length * 60)} y1={30 + i * 30} y2={30 + i * 30} stroke="#e2e8f0" strokeWidth="1" />
                ))}
                {serieMensuelle.map((s, i) => {
                  const x = 20 + i * 56;
                  const hRev = Math.round((s.revenus / maxSerie) * 110);
                  const hDep = Math.round((s.depenses / maxSerie) * 110);
                  return (
                    <g key={s.mois}>
                      <rect x={x} y={140 - hRev} width="20" height={hRev} fill="#1B2A4A" rx="2" />
                      <rect x={x + 22} y={140 - hDep} width="20" height={hDep} fill="#D4AF37" rx="2" />
                      <text x={x + 21} y="158" textAnchor="middle" fontSize="10" fill="#475569">{s.mois.slice(5, 7)}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              <span className="mr-4"><span className="inline-block h-3 w-3 rounded-sm bg-navy align-middle" /> {tr("income")}</span>
              <span><span className="inline-block h-3 w-3 rounded-sm bg-[#D4AF37] align-middle" /> {tr("expenses")}</span>
            </p>
          </section>

          <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="text-lg font-bold text-navy">{tr("ratesUsed")}</h2>
            {tauxUtilises.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600">{tr("noConversion")}</p>
            ) : (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {tauxUtilises.map((tx, i) => (
                  <li key={i} className="break-words">{tx}</li>
                ))}
              </ul>
            )}
          </section>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={exporterPdf} className="rounded-full bg-navy px-5 py-2.5 text-sm font-bold text-white hover:bg-navy-light">
              {tr("exportPdf")}
            </button>
            <button type="button" onClick={exporterExcel} className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-navy hover:border-gold">
              {tr("exportExcel")}
            </button>
          </div>
        </>
      )}
    </AppShell>
  );
}

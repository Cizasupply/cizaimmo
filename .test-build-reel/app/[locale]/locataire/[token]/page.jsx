"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LocataireLienPage;
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const next_intl_1 = require("next-intl");
const format_1 = require("@/lib/format");
const data_1 = require("@/lib/data");
const loyers_1 = require("@/lib/loyers");
const recu_pdf_1 = require("@/lib/recu-pdf");
const PublicFooter_1 = __importDefault(require("@/components/PublicFooter"));
const LanguageSwitcher_1 = __importDefault(require("@/components/LanguageSwitcher"));
/**
 * Page PUBLIQUE du lien locataire (Correctif 1, spec §2, §14).
 * Sans connexion : le jeton dans l'adresse suffit. Affiche UNIQUEMENT
 * les données de ce locataire — son bail en cours, l'historique de ses
 * loyers (statuts recalculés) et ses reçus téléchargeables (PDF).
 * Aucun autre locataire, aucun autre bien, aucun montant global, aucun
 * accès à l'abonnement. Jeton expiré, révoqué ou inconnu -> page neutre
 * (« Ce lien n'est plus valide »), SANS aucune donnée.
 */
function moisAffiche(moisIso, locale) {
    const [a, m] = (0, loyers_1.isoVersMois)(moisIso).split("-").map(Number);
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fr-FR", {
        month: "long",
        year: "numeric",
    }).format(new Date(a, m - 1, 1));
}
function LocataireLienPage({ params }) {
    const t = (0, next_intl_1.useTranslations)("tenantLink");
    const tc = (0, next_intl_1.useTranslations)("crud");
    const locale = (0, next_intl_1.useLocale)();
    const [acces, setAcces] = (0, react_1.useState)(null);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        (0, data_1.getDataProvider)()
            .getLocataireParToken(params.token)
            .then((a) => setAcces(a))
            .catch(() => setAcces(null))
            .finally(() => setChargement(false));
    }, [params.token]);
    function statutLoyerCle(statut) {
        return statut === "paye"
            ? "statusPaid"
            : statut === "partiel"
                ? "statusPartial"
                : statut === "en_retard"
                    ? "statusLate"
                    : statut === "du"
                        ? "statusDue"
                        : "statusUpcoming";
    }
    function statutCautionCle(statut) {
        return statut === "recue"
            ? "depositStatusReceived"
            : statut === "restituee"
                ? "depositStatusReturned"
                : statut === "retenue_partielle"
                    ? "depositStatusPartial"
                    : "depositStatusPending";
    }
    function moyenLabelCle(m) {
        return m === "especes"
            ? "methodCash"
            : m === "virement"
                ? "methodTransfer"
                : m === "mobile_money"
                    ? "methodMobileMoney"
                    : m === "cheque"
                        ? "methodCheque"
                        : "methodOther";
    }
    /** Restant dû après ce paiement (cumul chronologique des paiements valides de l'échéance). */
    function restantApres(recu) {
        if (!acces)
            return 0;
        const echeance = acces.echeances.find((e) => e.id === recu.echeance_id);
        if (!echeance)
            return 0;
        const chronologiques = acces.paiements
            .filter((p) => p.echeance_id === recu.echeance_id && p.statut === "valide")
            .slice()
            .sort((a, b) => a.date_paiement.localeCompare(b.date_paiement));
        let cumul = 0;
        for (const p of chronologiques) {
            cumul +=
                p.devise === echeance.devise ? p.montant : (p.montant_converti ?? p.montant);
            if (p.id === recu.paiement_id)
                return Math.max(0, echeance.montant_du - cumul);
        }
        return Math.max(0, echeance.montant_du - cumul);
    }
    function telecharger(recu) {
        if (!acces)
            return;
        (0, recu_pdf_1.telechargerRecu)({
            numero: recu.numero,
            date_emission: recu.date_emission,
            locataire_nom: recu.locataire_nom,
            immeuble_nom: recu.immeuble_nom,
            appartement_numero: recu.appartement_numero,
            mois: recu.mois,
            montant: recu.montant,
            devise: recu.devise,
            date_paiement: recu.date_paiement,
            reference: recu.reference,
            statut: recu.statut,
        }, {
            restantApres: restantApres(recu),
            emetteurNom: acces.emetteurNom,
            moyenLabel: tc(`rents.fields.${moyenLabelCle(recu.moyen)}`),
            langue: locale === "en" ? "en" : "fr",
        });
    }
    const bail = acces?.bail ?? null;
    return (<div className="min-h-screen bg-slate-50">
      <header className="bg-navy-dark px-6 py-6 text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xl font-bold tracking-wide">
              <span className="text-white">CIZA</span>
              <span className="text-gold">IMMO</span>
            </p>
            <p className="text-xs text-slate-400">CizaImmo — division de Ciza Group</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <link_1.default href={`/${locale}`} className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-500 px-4 py-2 text-sm font-semibold hover:border-gold hover:text-gold">
              {t("backHome")}
            </link_1.default>
            <LanguageSwitcher_1.default className="border-slate-500 text-slate-200 hover:border-gold hover:text-gold"/>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        {chargement ? (<p className="rounded-2xl bg-white p-8 text-slate-500 shadow-sm">{tc("common.loading")}</p>) : !acces ? (<div className="rounded-2xl bg-white p-8 shadow-sm">
            <p className="text-lg font-bold text-navy">{t("invalidTitle")}</p>
            <p className="mt-2 text-base text-slate-600">{t("invalidText")}</p>
            <link_1.default href={`/${locale}`} className="mt-4 inline-block font-semibold text-navy underline">
              {t("backHome")}
            </link_1.default>
          </div>) : (<>
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h1 className="text-2xl font-bold text-navy">{t("leaseTitle")}</h1>
              <p className="mt-1 text-base font-semibold text-navy">{acces.locataire.nom}</p>
              <p className="mt-1 text-sm text-slate-600">{t("subtitle")}</p>
              {acces.locataire.lien_expire_le ? (<p className="mt-2 text-sm text-slate-500">
                  {t("validUntil", { date: (0, format_1.formatDate)(acces.locataire.lien_expire_le, locale) })}
                </p>) : null}
            </div>

            {/* Bail en cours */}
            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-navy">{t("leaseTitle")}</h2>
              {!bail ? (<p className="mt-2 text-slate-600">{t("noActiveLease")}</p>) : (<dl className="mt-3 space-y-1 text-base">
                  <div className="flex gap-2">
                    <dt className="w-44 shrink-0 text-slate-500">{t("apartment")}</dt>
                    <dd className="min-w-0 break-words font-semibold text-navy">
                      {acces.appartementNumero ?? "—"}
                      {acces.immeubleNom ? ` — ${acces.immeubleNom}` : ""}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-44 shrink-0 text-slate-500">{tc("leases.fields.start")}</dt>
                    <dd className="min-w-0 break-words font-semibold text-navy">{(0, format_1.formatDate)(bail.debut, locale)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-44 shrink-0 text-slate-500">{tc("leases.fields.end")}</dt>
                    <dd className="min-w-0 break-words font-semibold text-navy">{bail.fin ? (0, format_1.formatDate)(bail.fin, locale) : "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-44 shrink-0 text-slate-500">{tc("leases.fields.monthlyRent")}</dt>
                    <dd className="min-w-0 break-words font-semibold text-navy">{(0, format_1.formatMoney)(bail.loyer_mensuel, bail.devise, locale)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-44 shrink-0 text-slate-500">{tc("leases.fields.dueDay")}</dt>
                    <dd className="min-w-0 break-words font-semibold text-navy">{bail.jour_exigibilite}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-44 shrink-0 text-slate-500">{tc("leases.fields.deposit")}</dt>
                    <dd className="min-w-0 break-words font-semibold text-navy">
                      {bail.caution !== null
                    ? `${(0, format_1.formatMoney)(bail.caution, bail.devise_caution ?? bail.devise, locale)} · ${tc(`leases.fields.${statutCautionCle(bail.caution_statut)}`)}`
                    : tc("common.notProvided")}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-44 shrink-0 text-slate-500">{tc("leases.fields.chargesIncluded")}</dt>
                    <dd className="min-w-0 break-words font-semibold text-navy">{bail.charges_incluses ? tc("common.yes") : tc("common.no")}</dd>
                  </div>
                </dl>)}
            </section>

            {/* Historique des loyers */}
            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-navy">{t("rentHistoryTitle")}</h2>
              {acces.echeances.length === 0 ? (<p className="mt-2 text-slate-600">{t("rentHistoryEmpty")}</p>) : (<ul className="mt-3 space-y-2">
                  {acces.echeances.map((e) => {
                    const paye = acces.paiements
                        .filter((p) => p.echeance_id === e.id && p.statut === "valide")
                        .reduce((s, p) => s + (p.devise === e.devise ? p.montant : (p.montant_converti ?? p.montant)), 0);
                    return (<li key={e.id} className="flex flex-wrap justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                        <span className="font-semibold text-navy">{moisAffiche(e.mois, locale)}</span>
                        <span className="font-bold text-navy">
                          {(0, format_1.formatMoney)(e.montant_du, e.devise, locale)} · {tc(`rents.${statutLoyerCle(e.statut)}`)}
                          {paye > 0 ? ` (${(0, format_1.formatMoney)(paye, e.devise, locale)} ${tc("rents.statusPaid").toLowerCase()})` : ""}
                        </span>
                      </li>);
                })}
                </ul>)}
            </section>

            {/* Reçus */}
            <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-navy">{t("receiptsTitle")}</h2>
              {acces.recus.length === 0 ? (<p className="mt-2 text-slate-600">{t("receiptsEmpty")}</p>) : (<ul className="mt-3 space-y-2">
                  {acces.recus.map((r) => (<li key={r.numero} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm">
                      <span>
                        <span className="font-bold text-navy">{r.numero}</span>
                        {" — "}
                        {moisAffiche(r.mois, locale)}
                        {" · "}
                        {(0, format_1.formatMoney)(r.montant, r.devise, locale)}
                        {r.statut === "annule" ? (<span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                            {t("cancelled")}
                          </span>) : null}
                      </span>
                      <button type="button" onClick={() => telecharger(r)} className="font-semibold text-navy underline">
                        {t("downloadReceipt")}
                      </button>
                    </li>))}
                </ul>)}
            </section>
          </>)}
      </main>
      <PublicFooter_1.default />
    </div>);
}

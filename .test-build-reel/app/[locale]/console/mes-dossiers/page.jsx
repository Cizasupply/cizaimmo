"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ConsoleMesDossiersPage;
/**
 * Console — « Mes dossiers » (v1.5, Admin employé) : les dossiers
 * clients dont l'Admin connecté est le responsable (assignation
 * Super Admin). Bloc « Actions en attente » calculé sur CES dossiers
 * + fils plateforme assignés avec messages non lus.
 */
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const FilMessages_1 = require("@/components/FilMessages");
const data_1 = require("@/lib/data");
const format_1 = require("@/lib/format");
function suppressionEchue(c) {
    if (!c.suppression_demandee_le)
        return false;
    return (new Date(c.suppression_demandee_le).getTime() + 30 * 24 * 60 * 60 * 1000 <=
        Date.now());
}
function ConsoleMesDossiersPage() {
    const t = (0, next_intl_1.useTranslations)("v15");
    const tc = (0, next_intl_1.useTranslations)("console");
    const locale = (0, next_intl_1.useLocale)();
    const [profil, setProfil] = (0, react_1.useState)(null);
    const [dossiers, setDossiers] = (0, react_1.useState)([]);
    const [filsNonLus, setFilsNonLus] = (0, react_1.useState)([]);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        (async () => {
            const provider = (0, data_1.getDataProvider)();
            const [moi, mes, conversations] = await Promise.all([
                provider.getProfil(),
                provider.listerMesDossiers(),
                provider.listerConversations().catch(() => []),
            ]);
            setProfil(moi);
            setDossiers(mes);
            setFilsNonLus(conversations.filter((c) => c.type === "plateforme" &&
                moi !== null &&
                c.admin_responsable_id === moi.id &&
                (c.non_lus ?? 0) > 0));
        })()
            .catch((e) => setErreur((0, FilMessages_1.erreurV15)(t, e)))
            .finally(() => setChargement(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const approbations = dossiers.filter((c) => c.abonnement?.statut === "en_attente");
    const contrats = dossiers.filter((c) => c.statut_contrat === "signe_recu");
    const suppressions = dossiers.filter(suppressionEchue);
    // Design « Marine & Or » console (2026-11-07) : barre d'accent
    // métier de 4 px alignée sur la couleur de chaque valeur (même
    // patron que les KPI de la Vue d'ensemble et du tableau de bord).
    const actions = [
        { label: t("pendingApprovals"), valeur: approbations.length, couleur: "text-amber-600", accent: "bg-amber-500" },
        { label: t("pendingContracts"), valeur: contrats.length, couleur: "text-amber-600", accent: "bg-amber-500" },
        { label: t("expiredDeletions"), valeur: suppressions.length, couleur: "text-red-600", accent: "bg-red-500" },
        { label: t("unreadThreads"), valeur: filsNonLus.length, couleur: "text-navy", accent: "bg-navy" },
    ];
    return (<div>
      <h1 className="text-2xl font-semibold text-navy md:text-3xl">{t("myFilesTitle")}</h1>
      <p className="mt-1 text-sm text-slate-600">{t("myFilesSubtitle")}</p>

      {erreur ? (<p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {erreur}
        </p>) : null}

      {/* Actions en attente — calculées sur MES dossiers uniquement. */}
      <section className="mt-6">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
          {t("pendingActions")}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {actions.map((a) => (<div key={a.label} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 pl-5 shadow-sm">
              <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${a.accent}`}/>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {a.label}
              </p>
              <p className={`mt-1 whitespace-nowrap text-xl font-bold sm:text-2xl ${a.couleur}`}>{a.valeur}</p>
            </div>))}
        </div>
      </section>

      {filsNonLus.length > 0 ? (<section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-navy">{t("unreadThreads")}</h2>
          <ul className="mt-3 space-y-2">
            {filsNonLus.map((c) => (<li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-3">
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-semibold text-navy">
                    {c.proprietaire_nom ?? c.proprietaire_email ?? "—"}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {c.dernier_message ?? ""}{" "}
                    {c.dernier_message_le
                    ? `· ${(0, format_1.formatDate)(c.dernier_message_le, locale)}`
                    : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">
                    {t("unread", { count: String(c.non_lus ?? 0) })}
                  </span>
                  <link_1.default href={`/${locale}/console/comptes/${c.proprietaire_id}`} className="rounded-full border border-navy px-4 py-1.5 text-sm font-bold text-navy hover:bg-navy hover:text-white">
                    📁 {t("openFile")}
                  </link_1.default>
                </span>
              </li>))}
          </ul>
        </section>) : null}

      {/* Mes dossiers assignés. */}
      <div className="mt-6 space-y-4">
        {chargement ? (<p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            {tc("loading")}
          </p>) : dossiers.length === 0 ? (<p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            {t("myFilesEmpty")}
          </p>) : (dossiers.map((c) => (<article key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-navy">{c.nom}</h2>
                <p className="truncate text-sm text-slate-500">
                  {c.email}
                  {c.display_id ? (<>
                      {" · "}
                      <strong className="whitespace-nowrap font-bold tracking-wide text-navy">
                        {c.display_id}
                      </strong>
                    </>) : null}
                  {" · "}
                  {(0, format_1.formatDate)(c.created_at, locale)}
                </p>
                <p className="mt-1 flex flex-wrap gap-2">
                  {c.abonnement ? (<span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                      {tc(`status.${c.abonnement.statut}`)}
                    </span>) : null}
                  {c.abonnement?.statut === "en_attente" ? (<span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                      {t("pendingApprovals")}
                    </span>) : null}
                  {c.statut_contrat === "signe_recu" ? (<span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-bold text-sky-800">
                      {tc("badgeContractToValidate")}
                    </span>) : null}
                  {suppressionEchue(c) ? (<span className="rounded-full bg-red-600 px-2 py-1 text-xs font-bold text-white">
                      {t("expiredDeletions")}
                    </span>) : c.suppression_demandee_le ? (<span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-800">
                      {t("deletionScheduled", {
                    date: (0, format_1.formatDate)(new Date(new Date(c.suppression_demandee_le).getTime() +
                        30 * 24 * 60 * 60 * 1000).toISOString(), locale),
                })}
                    </span>) : null}
                </p>
              </div>
              <link_1.default href={`/${locale}/console/comptes/${c.id}`} className="rounded-full border border-navy px-4 py-2 text-sm font-bold text-navy hover:bg-navy hover:text-white">
                📁 {t("openFile")}
              </link_1.default>
            </article>)))}
      </div>
      {profil?.role === "super_admin" ? (<p className="mt-4 text-xs text-slate-400">{t("myFilesSubtitle")}</p>) : null}
    </div>);
}

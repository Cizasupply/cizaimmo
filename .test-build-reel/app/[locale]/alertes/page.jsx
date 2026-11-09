"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AlertesPage;
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const next_intl_1 = require("next-intl");
const navigation_1 = require("next/navigation");
const AppShell_1 = __importDefault(require("@/components/AppShell"));
const EmptyState_1 = __importDefault(require("@/components/EmptyState"));
const WhatsAppSendButton_1 = __importDefault(require("@/components/WhatsAppSendButton"));
const format_1 = require("@/lib/format");
const data_1 = require("@/lib/data");
const module4_1 = require("@/lib/module4");
const translateError_1 = require("@/lib/translateError");
function couleurUrgence(urgence) {
    return urgence === "haute"
        ? "bg-red-100 text-red-800"
        : urgence === "moyenne"
            ? "bg-amber-100 text-amber-800"
            : "bg-slate-100 text-slate-700";
}
/** Bordure gauche de la carte, même code couleur que l'urgence. */
function bordureUrgence(urgence) {
    return urgence === "haute"
        ? "border-l-4 border-l-red-400"
        : urgence === "moyenne"
            ? "border-l-4 border-l-amber-400"
            : "border-l-4 border-l-slate-300";
}
/** Pastille type d'alerte : retard = rouge, fin de bail / vacance / bail démarrant = ambre, info = neutre. */
function couleurType(type) {
    return type === "loyer_en_retard"
        ? "bg-red-100 text-red-800"
        : type === "fin_de_bail" || type === "vacance_prolongee" || type === "bail_demarrant"
            ? "bg-amber-100 text-amber-800"
            : "bg-slate-100 text-slate-700";
}
/** Pastille « Non traitée » : rouge si urgence haute, ambre sinon. */
function couleurNonTraitee(urgence) {
    return urgence === "haute" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800";
}
/** Statut d'envoi (e-mail / WhatsApp) : envoyé = vert, échec = rouge, sinon neutre. */
function couleurStatutEnvoi(statut) {
    return statut === "envoye"
        ? "font-semibold text-green-700"
        : statut === "echec"
            ? "font-semibold text-red-700"
            : "text-slate-600";
}
function AlertesPage() {
    const t = (0, next_intl_1.useTranslations)("crud");
    const ta = (0, next_intl_1.useTranslations)("alerts");
    const tp = (0, next_intl_1.useTranslations)("pages");
    const tc = (0, next_intl_1.useTranslations)("crud.common");
    const locale = (0, next_intl_1.useLocale)();
    const router = (0, navigation_1.useRouter)();
    const [alertes, setAlertes] = (0, react_1.useState)([]);
    const [telephoneProprietaire, setTelephoneProprietaire] = (0, react_1.useState)(null);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const [message, setMessage] = (0, react_1.useState)(null);
    async function charger() {
        setChargement(true);
        setErreur(null);
        try {
            const p = (0, data_1.getDataProvider)();
            const session = await p.getSession();
            if (!session) {
                router.push(`/${locale}/connexion`);
                return;
            }
            // Génération idempotente, puis lecture.
            const liste = await p.genererAlertes();
            setAlertes(liste);
            const prof = await p.getProfil();
            setTelephoneProprietaire(prof?.telephone ?? null);
        }
        catch (e) {
            setErreur((0, translateError_1.messageErreur)(t, e));
        }
        finally {
            setChargement(false);
        }
    }
    (0, react_1.useEffect)(() => {
        charger();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const actives = (0, react_1.useMemo)(() => alertes.filter((a) => a.statut === "active"), [alertes]);
    const traitees = (0, react_1.useMemo)(() => alertes.filter((a) => a.statut === "traitee"), [alertes]);
    async function traiter(id) {
        try {
            await (0, data_1.getDataProvider)().marquerAlerteTraitee(id);
            setMessage(ta("treatedDone"));
            await charger();
        }
        catch (e) {
            setErreur((0, translateError_1.messageErreur)(t, e));
        }
    }
    async function persisterStatutWhatsApp(alerte, statut) {
        try {
            const maj = await (0, data_1.getDataProvider)().marquerAlerteWhatsApp(alerte.id, statut);
            setAlertes((anciens) => anciens.map((a) => (a.id === maj.id ? maj : a)));
            setMessage(statut === "envoye"
                ? ta("whatsappSent")
                : statut === "non_configuré"
                    ? ta("whatsappNotConfigured")
                    : ta("whatsappFailed"));
        }
        catch {
            // Le statut d'envoi ne doit pas casser l'écran : l'échec est affiché, pas bloquant.
            setMessage(ta("whatsappFailed"));
        }
    }
    function libelleType(type) {
        return ta(`types.${type}`);
    }
    function carte(alerte) {
        const url = (0, module4_1.urlAlerte)(alerte);
        return (<article key={alerte.id} className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${bordureUrgence(alerte.urgence)}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${couleurUrgence(alerte.urgence)}`}>
            {ta(`urgency.${alerte.urgence}`)}
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${couleurType(alerte.type)}`}>{libelleType(alerte.type)}</span>
          {alerte.statut === "active" ? (<span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${couleurNonTraitee(alerte.urgence)}`}>
              {ta("untreated")}
            </span>) : null}
          <span className="text-sm text-slate-500">{(0, format_1.formatDate)(alerte.created_at.slice(0, 10), locale)}</span>
        </div>
        <p className="mt-2 break-words text-base font-medium text-navy">{alerte.message}</p>
        <p className="mt-1 text-sm text-slate-600">
          {ta("emailStatus")}:{" "}
          <span className={couleurStatutEnvoi(alerte.email_statut)}>
            {alerte.email_statut === "envoye"
                ? ta("emailSent")
                : alerte.email_statut === "echec"
                    ? ta("emailFailed")
                    : alerte.email_statut === "desactive"
                        ? ta("emailDisabled")
                        : ta("emailNotConfigured")}
          </span>
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {ta("whatsappStatus")}:{" "}
          <span className={couleurStatutEnvoi(alerte.whatsapp_statut)}>
            {alerte.whatsapp_statut === "envoye"
                ? ta("whatsappSent")
                : alerte.whatsapp_statut === "echec"
                    ? ta("whatsappFailed")
                    : alerte.whatsapp_statut === "desactive"
                        ? ta("whatsappDisabled")
                        : ta("whatsappNotConfigured")}
          </span>
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {url ? (<link_1.default href={url} className="text-sm font-semibold text-navy underline">{ta("openItem")}</link_1.default>) : null}
          {alerte.statut === "active" &&
                (alerte.type === "loyer_en_retard" || alerte.type === "fin_de_bail") ? (<WhatsAppSendButton_1.default to={telephoneProprietaire} message={alerte.message} label={ta("sendWhatsApp")} onResult={(statut) => persisterStatutWhatsApp(alerte, statut)}/>) : null}
          {alerte.statut === "active" ? (<button type="button" onClick={() => traiter(alerte.id)} className="rounded-full border border-navy bg-white px-4 py-1.5 text-sm font-semibold text-navy hover:bg-navy/5">
              {ta("markTreated")}
            </button>) : (<span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-800">
              {ta("treatedOn", { date: (0, format_1.formatDate)(alerte.traitee_le?.slice(0, 10), locale) })}
            </span>)}
        </div>
      </article>);
    }
    return (<AppShell_1.default title={tp("alerts.title")}>
      {message ? (<p role="status" className="mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-800">
          {message}
        </p>) : null}
      {erreur ? (<div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {erreur}
          <button type="button" onClick={charger} className="ml-3 font-bold underline">
            {tc("retry")}
          </button>
        </div>) : null}

      {chargement ? (<div className="space-y-3" aria-busy="true">
          {[0, 1].map((i) => (<div key={i} className="h-24 animate-pulse rounded-2xl bg-white shadow-sm"/>))}
          <p className="text-sm text-slate-500">{tc("loading")}</p>
        </div>) : alertes.length === 0 ? (<EmptyState_1.default title={ta("emptyTitle")} text={ta("emptyText")} actionLabel={ta("goToDashboard")} actionHref="/dashboard"/>) : (<>
          <section aria-labelledby="actives-titre">
            <h2 id="actives-titre" className="text-lg font-semibold text-navy">
              {ta("activeTitle", { count: actives.length })}
            </h2>
            {actives.length === 0 ? (<p className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 text-slate-600 shadow-sm">{ta("noActive")}</p>) : (<div className="mt-3 space-y-3">{actives.map(carte)}</div>)}
          </section>
          <section aria-labelledby="traitees-titre" className="mt-6">
            <h2 id="traitees-titre" className="text-lg font-semibold text-navy">
              {ta("treatedTitle", { count: traitees.length })}
            </h2>
            {traitees.length === 0 ? (<p className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 text-slate-600 shadow-sm">{ta("noTreated")}</p>) : (<div className="mt-3 space-y-3">{traitees.map(carte)}</div>)}
          </section>
          <p className="mt-6 text-sm text-slate-600">
            {ta("manageHint")}{" "}
            <link_1.default href="/parametres" className="font-semibold text-navy underline">{ta("goToSettings")}</link_1.default>
          </p>
        </>)}
    </AppShell_1.default>);
}

"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ConsoleMessagesPage;
/**
 * Console — Boîte de réception plateforme (2026-11-07, demande du
 * fondateur après un message cliente passé inaperçu dans un dossier
 * NON assigné) : TOUS les fils « plateforme », assignés ou non —
 * l'assignation est une responsabilité, pas une restriction
 * d'accès. Tri : dernier message décroissant. Un clic ouvre le
 * Dossier du client, ancré sur son fil (section #messages), où la
 * plateforme peut répondre ; l'ouverture marque le fil comme lu.
 */
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const FilMessages_1 = require("@/components/FilMessages");
const data_1 = require("@/lib/data");
const format_1 = require("@/lib/format");
function ConsoleMessagesPage() {
    const t = (0, next_intl_1.useTranslations)("console");
    const t15 = (0, next_intl_1.useTranslations)("v15");
    const locale = (0, next_intl_1.useLocale)();
    const [conversations, setConversations] = (0, react_1.useState)([]);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        (0, data_1.getDataProvider)()
            .listerConversationsPlateforme()
            .then(setConversations)
            .catch((e) => setErreur((0, FilMessages_1.erreurV15)(t15, e)))
            .finally(() => setChargement(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const totalNonLus = conversations.reduce((somme, c) => somme + (c.non_lus ?? 0), 0);
    return (<div>
      <h1 className="text-2xl font-semibold text-navy md:text-3xl">
        {t("messagesTitle")}
        {totalNonLus > 0 ? (<span className="ml-3 align-middle rounded-full bg-gold px-2.5 py-1 text-sm font-bold text-navy-dark">
            {totalNonLus}
          </span>) : null}
      </h1>
      <p className="mt-1 text-sm text-slate-600">{t("messagesSubtitle")}</p>

      {erreur ? (<p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {erreur}
        </p>) : null}

      <div className="mt-6 space-y-3">
        {chargement ? (<p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            {t("loading")}
          </p>) : conversations.length === 0 ? (<p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            {t("messagesEmpty")}
          </p>) : (conversations.map((c) => (<link_1.default key={c.id} href={`/${locale}/console/comptes/${c.proprietaire_id}#messages`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 hover:border-gold">
              <span className="min-w-0">
                <span className="block truncate font-bold text-navy">
                  {c.proprietaire_nom ?? c.proprietaire_email ?? "—"}
                  {c.proprietaire_display_id ? (<strong className="ml-2 whitespace-nowrap text-sm font-bold tracking-wide text-navy">
                      {c.proprietaire_display_id}
                    </strong>) : null}
                </span>
                <span className="block truncate text-sm text-slate-500">
                  {c.proprietaire_email ?? ""}
                </span>
                <span className="mt-1 block truncate text-sm text-slate-600">
                  {c.dernier_message ?? t15("noMessages")}
                  {c.dernier_message_le
                ? ` · ${(0, format_1.formatDateTime)(c.dernier_message_le, locale)}`
                : ""}
                </span>
                <span className="mt-1 block text-xs text-slate-500">
                  {t15("responsible")} :{" "}
                  {c.admin_responsable_nom ?? (<strong className="font-bold text-amber-700">
                      {t15("unassigned")}
                    </strong>)}
                </span>
              </span>
              {(c.non_lus ?? 0) > 0 ? (<span className="shrink-0 rounded-full bg-gold px-2.5 py-1 text-xs font-bold text-navy-dark">
                  {t15("unread", { count: String(c.non_lus ?? 0) })}
                </span>) : null}
            </link_1.default>)))}
      </div>
    </div>);
}

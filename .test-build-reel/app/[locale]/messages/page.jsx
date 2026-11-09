"use strict";
"use client";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MessagesPage;
/**
 * Messages (v1.5) — messagerie directe du client : fil plateforme
 * (client ↔ équipe CizaImmo, routé vers l'Admin responsable) et fils
 * des rattachements ACTIFS (propriétaire ↔ gestionnaire, participants
 * seuls). Ouverture d'un fil = messages + marquerLu (dans FilMessages).
 */
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const AppShell_1 = __importDefault(require("@/components/AppShell"));
const FilMessages_1 = __importStar(require("@/components/FilMessages"));
const data_1 = require("@/lib/data");
const format_1 = require("@/lib/format");
const next_intl_2 = require("next-intl");
function MessagesPage() {
    const t = (0, next_intl_1.useTranslations)("v15");
    const tp = (0, next_intl_1.useTranslations)("pages");
    const locale = (0, next_intl_2.useLocale)();
    const [plateforme, setPlateforme] = (0, react_1.useState)(null);
    const [filsRattachement, setFilsRattachement] = (0, react_1.useState)([]);
    const [selection, setSelection] = (0, react_1.useState)(null);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const charger = (0, react_1.useCallback)(async () => {
        const provider = (0, data_1.getDataProvider)();
        const [convPlateforme, toutes] = await Promise.all([
            provider.getConversationPlateforme(),
            provider.listerConversations(),
        ]);
        setPlateforme(convPlateforme);
        setFilsRattachement(toutes.filter((c) => c.type === "rattachement"));
        setSelection((actuelle) => actuelle ?? convPlateforme);
    }, []);
    (0, react_1.useEffect)(() => {
        charger()
            .catch((e) => setErreur((0, FilMessages_1.erreurV15)(t, e)))
            .finally(() => setChargement(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [charger]);
    function libelleFil(c) {
        if (c.type === "plateforme")
            return t("platformThread");
        const noms = [c.proprietaire_nom, c.gestionnaire_nom].filter(Boolean);
        return noms.length > 0 ? noms.join(" ↔ ") : t("discussion");
    }
    const fils = [
        ...(plateforme ? [plateforme] : []),
        ...filsRattachement.filter((c) => c.id !== plateforme?.id),
    ];
    return (<AppShell_1.default title={tp("messages.title")}>
      {erreur ? (<p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {erreur}
        </p>) : null}
      {/* Correctif 2026-11-08 (défaut D) : la grille n'avait pas de
            colonne mobile explicite — la piste implicite se dimensionnait
            au contenu le plus large (max-content) et TOUTE la page
            dépassait l'écran sur mobile. Colonnes en minmax(0,1fr) +
            sections min-w-0 : liste et fil s'empilent dans la largeur
            sur mobile ; bureau inchangé (deux volets côte à côte). */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Liste des fils */}
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="px-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            {t("messagesTitle")}
          </h2>
          {chargement ? (<p className="px-2 py-4 text-sm text-slate-500">{t("noConversations")}</p>) : fils.length === 0 ? (<p className="px-2 py-4 text-sm text-slate-500">{t("noConversations")}</p>) : (<ul className="mt-2 space-y-1">
              {fils.map((c) => (<li key={c.id}>
                  <button type="button" onClick={() => setSelection(c)} className={`w-full rounded-xl px-3 py-3 text-left ${selection?.id === c.id ? "bg-navy text-white" : "hover:bg-slate-50"}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-sm font-bold">
                        {libelleFil(c)}
                      </span>
                      {c.non_lus && c.non_lus > 0 ? (<span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                          {t("unread", { count: String(c.non_lus) })}
                        </span>) : null}
                    </span>
                    <span className={`mt-0.5 block truncate text-xs ${selection?.id === c.id ? "text-slate-300" : "text-slate-500"}`}>
                      {c.type === "plateforme"
                    ? t("platformThreadDesc")
                    : (c.dernier_message ?? t("noMessages"))}
                      {c.dernier_message_le
                    ? ` · ${(0, format_1.formatDate)(c.dernier_message_le, locale)}`
                    : ""}
                    </span>
                  </button>
                </li>))}
            </ul>)}
          {filsRattachement.length === 0 && !chargement ? (<p className="px-2 pb-2 pt-3 text-xs text-slate-400">
              {t("noAttachmentThreads")}
            </p>) : null}
        </section>

        {/* Fil sélectionné */}
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {selection ? (<>
              <h2 className="break-words text-lg font-semibold text-navy">{libelleFil(selection)}</h2>
              <p className="mb-4 mt-1 break-words text-sm text-slate-500">
                {selection.type === "plateforme"
                ? t("platformThreadDesc")
                : `${t("ownerLabel")} ↔ ${t("managerLabel")}`}
              </p>
              <FilMessages_1.default key={selection.id} conversationId={selection.id}/>
            </>) : (<p className="text-sm text-slate-500">{t("noConversations")}</p>)}
        </section>
      </div>
    </AppShell_1.default>);
}

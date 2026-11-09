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
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ConsoleMessagesSupervisesPage;
/**
 * Console — Messages supervisés (v1.5) : fils propriétaire ↔
 * gestionnaire des rattachements actifs. Ouverture d'un fil =
 * journaliserConsultationMessages PUIS listerMessages (via
 * FilMessages) ; affichage LECTURE SEULE, sans zone de saisie.
 */
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const FilMessages_1 = __importStar(require("@/components/FilMessages"));
const data_1 = require("@/lib/data");
const format_1 = require("@/lib/format");
function ConsoleMessagesSupervisesPage() {
    const t = (0, next_intl_1.useTranslations)("v15");
    const tc = (0, next_intl_1.useTranslations)("console");
    const locale = (0, next_intl_1.useLocale)();
    const [fils, setFils] = (0, react_1.useState)([]);
    const [selection, setSelection] = (0, react_1.useState)(null);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    (0, react_1.useEffect)(() => {
        (0, data_1.getDataProvider)()
            .listerConversationsSupervisees()
            .then(setFils)
            .catch((e) => setErreur((0, FilMessages_1.erreurV15)(t, e)))
            .finally(() => setChargement(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    async function ouvrir(c) {
        setErreur(null);
        try {
            // Consultation journalisée AVANT la lecture des messages.
            await (0, data_1.getDataProvider)().journaliserConsultationMessages(c.id);
            setSelection(c);
        }
        catch (e) {
            setErreur((0, FilMessages_1.erreurV15)(t, e));
        }
    }
    return (<div>
      <h1 className="text-2xl font-semibold text-navy md:text-3xl">{t("supervisedTitle")}</h1>
      <p className="mt-1 text-sm text-slate-600">{t("supervisedSubtitle")}</p>
      <p className="mt-3 inline-block rounded-full bg-slate-700 px-3 py-1 text-xs font-bold text-white">
        🔒 {t("supervisionReadOnly")}
      </p>

      {erreur ? (<p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {erreur}
        </p>) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          {chargement ? (<p className="px-2 py-4 text-sm text-slate-500">{tc("loading")}</p>) : fils.length === 0 ? (<p className="px-2 py-4 text-sm text-slate-500">{t("supervisedEmpty")}</p>) : (<ul className="space-y-1">
              {fils.map((c) => (<li key={c.id}>
                  <button type="button" onClick={() => ouvrir(c)} className={`w-full rounded-xl px-3 py-3 text-left ${selection?.id === c.id ? "bg-navy text-white" : "hover:bg-slate-50"}`}>
                    <span className="block truncate text-sm font-bold">
                      {c.proprietaire_nom ?? t("ownerLabel")} ↔{" "}
                      {c.gestionnaire_nom ?? t("managerLabel")}
                    </span>
                    <span className={`mt-0.5 block truncate text-xs ${selection?.id === c.id ? "text-slate-300" : "text-slate-500"}`}>
                      {t("lastMessage")} : {c.dernier_message ?? t("noMessages")}
                      {c.dernier_message_le
                    ? ` · ${(0, format_1.formatDate)(c.dernier_message_le, locale)}`
                    : ""}
                    </span>
                    {(c.proprietaire_display_id || c.gestionnaire_display_id) ? (<span className={`text-xs ${selection?.id === c.id ? "text-slate-300" : "text-slate-400"}`}>
                        {c.proprietaire_display_id ?? ""} ↔ {c.gestionnaire_display_id ?? ""}
                      </span>) : null}
                  </button>
                </li>))}
            </ul>)}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          {selection ? (<>
              <h2 className="text-lg font-semibold text-navy">
                {selection.proprietaire_nom ?? t("ownerLabel")} ↔{" "}
                {selection.gestionnaire_nom ?? t("managerLabel")}
              </h2>
              <div className="mt-4">
                <FilMessages_1.default key={selection.id} conversationId={selection.id} lectureSeule marquerLuAuto={false}/>
              </div>
            </>) : (<p className="text-sm text-slate-500">{t("supervisedEmpty")}</p>)}
        </section>
      </div>
    </div>);
}

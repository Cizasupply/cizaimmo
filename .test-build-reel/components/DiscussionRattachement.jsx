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
exports.default = DiscussionRattachement;
/**
 * Panneau dépliable « Discussion » d'un rattachement ACTIF (v1.5) :
 * ouvre le fil propriétaire ↔ gestionnaire (getConversationRattachement)
 * et rend le composant partagé FilMessages (participant : lecture +
 * envoi). Utilisé côté propriétaire (RattachementDisplayId) et côté
 * gestionnaire (page Contrat).
 */
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const data_1 = require("@/lib/data");
const FilMessages_1 = __importStar(require("@/components/FilMessages"));
function DiscussionRattachement({ rattachementId, }) {
    const t = (0, next_intl_1.useTranslations)("v15");
    const [ouvert, setOuvert] = (0, react_1.useState)(false);
    const [conversation, setConversation] = (0, react_1.useState)(null);
    const [chargement, setChargement] = (0, react_1.useState)(false);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    async function basculer() {
        if (ouvert) {
            setOuvert(false);
            return;
        }
        setOuvert(true);
        if (conversation)
            return;
        setChargement(true);
        setErreur(null);
        try {
            const conv = await (0, data_1.getDataProvider)().getConversationRattachement(rattachementId);
            setConversation(conv);
        }
        catch (e) {
            setErreur((0, FilMessages_1.erreurV15)(t, e));
        }
        finally {
            setChargement(false);
        }
    }
    return (<div className="mt-3 border-t border-slate-100 pt-3">
      <button type="button" onClick={basculer} aria-expanded={ouvert} className="rounded-full border border-navy px-4 py-1.5 text-sm font-bold text-navy hover:bg-navy hover:text-white">
        💬 {ouvert ? t("hideDiscussion") : t("discussion")}
      </button>
      {ouvert ? (<div className="mt-3">
          {chargement ? (<p className="text-sm text-slate-500">{t("noMessages")}</p>) : erreur ? (<p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {erreur}
            </p>) : conversation ? (<FilMessages_1.default conversationId={conversation.id}/>) : null}
        </div>) : null}
    </div>);
}

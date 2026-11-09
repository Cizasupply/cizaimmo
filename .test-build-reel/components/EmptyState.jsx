"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = EmptyState;
const link_1 = __importDefault(require("next/link"));
/**
 * État vide (spec §5) : ce que la page contiendra, pourquoi c'est utile,
 * et un seul bouton d'action. Jamais un écran blanc.
 */
function EmptyState({ title, text, actionLabel, actionHref, onAction, }) {
    return (<div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
      <h2 className="text-lg font-semibold text-navy">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-base text-slate-600">{text}</p>
      {actionHref ? (<link_1.default href={actionHref} className="mt-6 inline-block rounded-full bg-gold px-6 py-3 text-base font-bold text-navy hover:bg-gold-light">
          {actionLabel}
        </link_1.default>) : onAction ? (<button type="button" onClick={onAction} className="mt-6 rounded-full bg-gold px-6 py-3 text-base font-bold text-navy hover:bg-gold-light">
          {actionLabel}
        </button>) : null}
    </div>);
}

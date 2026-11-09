"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ConfirmDialog;
/**
 * Boîte de confirmation (spec §5) : nomme l'élément concerné et ses
 * conséquences avant toute suppression ou archivage.
 */
function ConfirmDialog({ title, text, confirmLabel, cancelLabel, danger = true, onConfirm, onCancel, }) {
    return (<div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 flex items-end justify-center bg-navy-dark/60 p-4 sm:items-center" onClick={onCancel}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-navy">{title}</h2>
        <p className="mt-2 text-base text-slate-700">{text}</p>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 rounded-full border border-slate-300 px-4 py-2.5 text-base font-semibold text-slate-700 hover:bg-slate-50">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} autoFocus className={"flex-1 rounded-full px-4 py-2.5 text-base font-bold text-white " +
            (danger ? "bg-red-600 hover:bg-red-700" : "bg-navy hover:bg-navy-light")}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>);
}

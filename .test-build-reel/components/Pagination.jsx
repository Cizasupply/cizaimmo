"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Pagination;
/**
 * Pagination (spec §7) : 20 / 50 / 100 lignes par page.
 * Les contrôles se replient en colonne sur téléphone.
 */
function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, perPageLabel, showingLabel, }) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, totalPages);
    const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const to = Math.min(total, safePage * pageSize);
    return (<div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-slate-600">{showingLabel(from, to, total)}</p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-semibold text-navy outline-none focus:border-gold">
            {[20, 50, 100].map((n) => (<option key={n} value={n}>
                {n}
              </option>))}
          </select>
          {perPageLabel}
        </label>
        <div className="flex items-center gap-1">
          <button type="button" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-navy disabled:opacity-40" aria-label="Page précédente">
            ‹
          </button>
          <span className="px-2 text-sm font-semibold text-navy">
            {safePage} / {totalPages}
          </span>
          <button type="button" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-navy disabled:opacity-40" aria-label="Page suivante">
            ›
          </button>
        </div>
      </div>
    </div>);
}

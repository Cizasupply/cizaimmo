"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = MoneyField;
const data_1 = require("@/lib/data");
/**
 * Montant + sélecteur de devise OUVERT à côté (spec §8 : le sélecteur reste
 * ouvert et visible dans les formulaires, jamais caché derrière un menu).
 */
function MoneyField({ id, label, amount, onAmountChange, currency, onCurrencyChange, error, required = false, placeholder, }) {
    const describedBy = error ? `${id}-error` : undefined;
    const inputClass = "mt-1 w-full rounded-lg border bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/40 " +
        (error ? "border-red-500" : "border-slate-300");
    return (<div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <div className="flex gap-2">
        <input id={id} type="number" min="0" step="any" inputMode="decimal" value={amount} onChange={(e) => onAmountChange(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={describedBy} placeholder={placeholder} className={inputClass + " min-w-0 flex-1"}/>
        <select id={`${id}-devise`} aria-label={`${label} — devise`} value={currency} onChange={(e) => onCurrencyChange(e.target.value)} className="mt-1 w-24 shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-2.5 text-base font-semibold text-navy outline-none focus:border-gold focus:ring-2 focus:ring-gold/40">
          {data_1.DEVISES.map((d) => (<option key={d} value={d}>
              {d}
            </option>))}
        </select>
      </div>
      {error ? (<p id={`${id}-error`} role="alert" className="mt-1 text-sm font-medium text-red-600">
          {error}
        </p>) : null}
    </div>);
}

"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Field;
/**
 * Champ de formulaire d'authentification (Module 1).
 * Erreur en langage clair SOUS le champ, dans la langue de l'utilisateur
 * (spec §4 : jamais un code technique). Le formulaire ne se vide jamais
 * en cas d'erreur : les valeurs sont contrôlées par la page.
 */
function Field({ id, label, type = "text", value, onChange, error, required = false, autoComplete, placeholder, children, }) {
    const describedBy = error ? `${id}-error` : undefined;
    // Correctif 2026-11-08 (défaut E) : min-w-0 + max-w-full — le
    // contrôle natif des champs date a une largeur intrinsèque WebKit
    // qui débordait de sa colonne sur iOS (« New expense ») ; le champ
    // tient maintenant toujours dans la colonne, comme les autres.
    const inputClass = "mt-1 w-full min-w-0 max-w-full rounded-lg border bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/40 " +
        (error ? "border-red-500" : "border-slate-300");
    return (<div className="min-w-0">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children ? (<select id={id} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={describedBy} className={inputClass}>
          {children}
        </select>) : (<input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={Boolean(error)} aria-describedby={describedBy} autoComplete={autoComplete} placeholder={placeholder} className={inputClass}/>)}
      {error ? (<p id={`${id}-error`} role="alert" className="mt-1 text-sm font-medium text-red-600">
          {error}
        </p>) : null}
    </div>);
}

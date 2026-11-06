"use client";

/**
 * Champ de formulaire d'authentification (Module 1).
 * Erreur en langage clair SOUS le champ, dans la langue de l'utilisateur
 * (spec §4 : jamais un code technique). Le formulaire ne se vide jamais
 * en cas d'erreur : les valeurs sont contrôlées par la page.
 */
export default function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  error,
  required = false,
  autoComplete,
  placeholder,
  children,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  children?: React.ReactNode;
}) {
  const describedBy = error ? `${id}-error` : undefined;
  const inputClass =
    "mt-1 w-full rounded-lg border bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/40 " +
    (error ? "border-red-500" : "border-slate-300");
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-slate-900">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children ? (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={inputClass}
        >
          {children}
        </select>
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className={inputClass}
        />
      )}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

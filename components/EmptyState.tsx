"use client";

import Link from "next/link";

/**
 * État vide (spec §5) : ce que la page contiendra, pourquoi c'est utile,
 * et un seul bouton d'action. Jamais un écran blanc.
 */
export default function EmptyState({
  title,
  text,
  actionLabel,
  actionHref,
  onAction,
}: {
  title: string;
  text: string;
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
      {/* Anneau or de l'état vide centré (système d'organisation
          des pages, 2026-11-08 : tout état vide est centré avec un
          élément visuel simple — même anneau que EtatVideCentre). */}
      <span
        aria-hidden="true"
        className="mx-auto mb-4 block h-12 w-12 rounded-full border-[3px] border-gold/50 bg-gold/10"
      />
      <h2 className="text-lg font-semibold text-navy">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-base text-slate-600">{text}</p>
      {actionHref ? (
        <Link
          href={actionHref}
          className="mt-6 inline-block rounded-full bg-gold px-6 py-3 text-base font-bold text-navy hover:bg-gold-light"
        >
          {actionLabel}
        </Link>
      ) : onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 rounded-full bg-gold px-6 py-3 text-base font-bold text-navy hover:bg-gold-light"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

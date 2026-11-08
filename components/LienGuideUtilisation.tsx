"use client";

/**
 * Page « Mon contrat » — lien de téléchargement du guide
 * d'utilisation CizaImmo (PDF validé par le fondateur le
 * 2026-11-08). Le même guide est joint à l'e-mail de bienvenue /
 * de décision ; ici, le client le retrouve à tout moment, dans la
 * langue de l'interface (fichier statique de public/guides/,
 * servi par lib/guide.ts — cheminGuide).
 * Affiché pour les propriétaires comme pour les gestionnaires.
 */

import { useLocale, useTranslations } from "next-intl";
import { cheminGuide } from "@/lib/guide";

export default function LienGuideUtilisation() {
  const t = useTranslations("dossier");
  const locale = useLocale();
  const langue = locale === "en" ? "en" : "fr";
  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-navy">📖 {t("guideDownload")}</h2>
        <a
          href={cheminGuide(langue)}
          download
          className="rounded-full border border-navy px-5 py-2.5 text-sm font-bold text-navy hover:bg-slate-50"
        >
          ⬇ {t("guideDownload")}
        </a>
      </div>
    </section>
  );
}

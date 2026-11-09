"use client";

/**
 * Page console « Mon dossier employé » — lien de téléchargement du
 * guide employé CizaImmo (PDF validé par le fondateur le
 * 2026-11-08 ; branchement « Les deux » validé le même jour). Le
 * même guide est joint à l'e-mail de mise à disposition du contrat
 * employé préparé ; ici, l'employé le retrouve à tout moment, dans
 * la langue de l'interface (fichier statique de public/guides/,
 * servi par lib/guide.ts — cheminGuideEmploye).
 * Même présentation que le lien du guide d'utilisation de la page
 * « Mon contrat » (LienGuideUtilisation).
 */

import { useLocale, useTranslations } from "next-intl";
import { cheminGuideEmploye } from "@/lib/guide";

export default function LienGuideEmploye() {
  const t = useTranslations("dossierEmploye");
  const locale = useLocale();
  const langue = locale === "en" ? "en" : "fr";
  return (
    <section className="rounded-2xl border border-gold/40 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-navy">📖 {t("guideDownload")}</h2>
        <a
          href={cheminGuideEmploye(langue)}
          download
          className="rounded-full border border-navy px-5 py-2.5 text-sm font-bold text-navy hover:bg-slate-50"
        >
          ⬇ {t("guideDownload")}
        </a>
      </div>
    </section>
  );
}

"use client";

// ============================================================================
// Affichage STRUCTURÉ des coordonnées de paiement d'un employé
// (2026-11-08) : bloc lisible selon le moyen — virement (banque,
// agence, compte, IBAN, SWIFT), mobile money (opérateur, numéro) ou
// espèces (titulaire seul). Utilisé par le détail Équipe (Super
// Admin) et la page Finances. Les libellés viennent du namespace
// dossierEmploye (mêmes mots que le formulaire de l'employé).
// ============================================================================

import { useTranslations } from "next-intl";
import type { CoordonneesPaiement } from "@/lib/finances-plateforme";

export default function CoordonneesPaiementVue({
  coordonnees,
}: {
  coordonnees: CoordonneesPaiement;
}) {
  const t = useTranslations("dossierEmploye");
  const lignes: { libelle: string; valeur: string }[] = [];
  if (coordonnees.moyen === "virement") {
    lignes.push({ libelle: t("paymentBank"), valeur: coordonnees.banque ?? "" });
    if (coordonnees.agence) {
      lignes.push({ libelle: t("paymentAgency"), valeur: coordonnees.agence });
    }
    lignes.push({
      libelle: t("paymentAccountNumber"),
      valeur: coordonnees.numero_compte ?? "",
    });
    if (coordonnees.iban) {
      lignes.push({ libelle: t("paymentIban"), valeur: coordonnees.iban });
    }
    if (coordonnees.swift) {
      lignes.push({ libelle: t("paymentSwift"), valeur: coordonnees.swift });
    }
  } else if (coordonnees.moyen === "mobile_money") {
    lignes.push({
      libelle: t("paymentOperator"),
      valeur: coordonnees.operateur ?? "",
    });
    lignes.push({
      libelle: t("paymentMobileNumber"),
      valeur: coordonnees.numero_mobile ?? "",
    });
  }
  lignes.push({ libelle: t("paymentHolder"), valeur: coordonnees.titulaire });
  return (
    <div className="text-sm text-slate-600">
      <span className="mr-2 inline-block rounded-full bg-navy/10 px-2 py-0.5 text-xs font-semibold text-navy">
        {t(`paymentMethods.${coordonnees.moyen}`)}
      </span>
      {lignes.map((l) => (
        <span key={l.libelle} className="mr-3 inline-block">
          <span className="text-slate-400">{l.libelle} :</span> {l.valeur}
        </span>
      ))}
    </div>
  );
}

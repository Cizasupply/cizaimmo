"use client";

/**
 * Devise d'AFFICHAGE de la page d'accueil publique (2026-11-08,
 * vrai héros) : le sélecteur de devise du héros et celui de la
 * mini-grille tarifaire partagent UN SEUL état (contexte) — le
 * choix fait en haut de page convertit la grille plus bas, et
 * inversement. Aucune mécanique nouvelle : mêmes devises, mêmes
 * libellés, même conversion (la grille garde ses fonctions
 * pures) ; seul le domicile de l'état change. La mini-grille
 * garde un état local de repli si elle est rendue sans le
 * fournisseur (robustesse).
 */

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { DEVISES } from "@/lib/data";
import type { Devise } from "@/lib/data";

export const LIBELLES_DEVISE: Record<Devise, string> = {
  USD: "$ USD",
  EUR: "€ EUR",
  GBP: "£ GBP",
  CAD: "$ CAD",
  BIF: "BIF",
  XAF: "XAF",
  XOF: "XOF",
  KES: "KES",
  TZS: "TZS",
  RWF: "RWF",
  UGX: "UGX",
  BRL: "R$ BRL",
};

interface DeviseContexteValeur {
  devise: Devise;
  setDevise: (d: Devise) => void;
}

const DeviseContexte = createContext<DeviseContexteValeur | null>(null);

export function FournisseurDevise({ children }: { children: ReactNode }) {
  const [devise, setDevise] = useState<Devise>("USD");
  return (
    <DeviseContexte.Provider value={{ devise, setDevise }}>
      {children}
    </DeviseContexte.Provider>
  );
}

export function useDeviseAffichage(): DeviseContexteValeur | null {
  return useContext(DeviseContexte);
}

/**
 * Sélecteur de devise du HÉROS : même contrôle que celui de la
 * mini-grille (12 devises libellées, pastille blanche bordée or),
 * présenté sur fond marine avec son libellé visible. Choisir une
 * devise ici convertit la mini-grille tarifaire plus bas.
 */
export function SelecteurDeviseHero() {
  const t = useTranslations("landing");
  const ctx = useDeviseAffichage();
  const [repli, setRepli] = useState<Devise>("USD");
  const devise = ctx ? ctx.devise : repli;
  const setDevise = ctx ? ctx.setDevise : setRepli;
  return (
    <div className="mx-auto max-w-xs">
      <label
        className="text-sm font-semibold text-slate-300"
        htmlFor="hero-devise"
      >
        {t("pricing.currencyLabel")}
      </label>
      <select
        id="hero-devise"
        value={devise}
        onChange={(e) => setDevise(e.target.value as Devise)}
        className="mt-2 min-h-12 w-full rounded-full border-2 border-gold bg-white px-5 py-3 text-center text-base font-bold text-navy shadow-lg"
      >
        {DEVISES.map((d) => (
          <option key={d} value={d}>
            {LIBELLES_DEVISE[d]}
          </option>
        ))}
      </select>
    </div>
  );
}

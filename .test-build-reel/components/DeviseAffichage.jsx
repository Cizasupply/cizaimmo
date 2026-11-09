"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIBELLES_DEVISE = void 0;
exports.FournisseurDevise = FournisseurDevise;
exports.useDeviseAffichage = useDeviseAffichage;
exports.SelecteurDeviseHero = SelecteurDeviseHero;
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
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const data_1 = require("@/lib/data");
exports.LIBELLES_DEVISE = {
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
const DeviseContexte = (0, react_1.createContext)(null);
function FournisseurDevise({ children }) {
    const [devise, setDevise] = (0, react_1.useState)("USD");
    return (<DeviseContexte.Provider value={{ devise, setDevise }}>
      {children}
    </DeviseContexte.Provider>);
}
function useDeviseAffichage() {
    return (0, react_1.useContext)(DeviseContexte);
}
/**
 * Sélecteur de devise du HÉROS : même contrôle que celui de la
 * mini-grille (12 devises libellées, pastille blanche bordée or),
 * présenté sur fond marine avec son libellé visible. Choisir une
 * devise ici convertit la mini-grille tarifaire plus bas.
 */
function SelecteurDeviseHero() {
    const t = (0, next_intl_1.useTranslations)("landing");
    const ctx = useDeviseAffichage();
    const [repli, setRepli] = (0, react_1.useState)("USD");
    const devise = ctx ? ctx.devise : repli;
    const setDevise = ctx ? ctx.setDevise : setRepli;
    return (<div className="mx-auto max-w-xs">
      <label className="text-sm font-semibold text-slate-300" htmlFor="hero-devise">
        {t("pricing.currencyLabel")}
      </label>
      <select id="hero-devise" value={devise} onChange={(e) => setDevise(e.target.value)} className="mt-2 min-h-12 w-full rounded-full border-2 border-gold bg-white px-5 py-3 text-center text-base font-bold text-navy shadow-lg">
        {data_1.DEVISES.map((d) => (<option key={d} value={d}>
            {exports.LIBELLES_DEVISE[d]}
          </option>))}
      </select>
    </div>);
}

"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LoyersPage;
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const next_intl_1 = require("next-intl");
const navigation_1 = require("next/navigation");
const AppShell_1 = __importDefault(require("@/components/AppShell"));
const WhatsAppSendButton_1 = __importDefault(require("@/components/WhatsAppSendButton"));
const ConfirmDialog_1 = __importDefault(require("@/components/ConfirmDialog"));
const EmptyState_1 = __importDefault(require("@/components/EmptyState"));
const Field_1 = __importDefault(require("@/components/Field"));
const MoneyField_1 = __importDefault(require("@/components/MoneyField"));
const Pagination_1 = __importDefault(require("@/components/Pagination"));
const format_1 = require("@/lib/format");
const data_1 = require("@/lib/data");
const loyers_1 = require("@/lib/loyers");
const recu_pdf_1 = require("@/lib/recu-pdf");
const exports_1 = require("@/lib/exports");
const translateError_1 = require("@/lib/translateError");
const STATUTS = ["a_venir", "du", "partiel", "paye", "en_retard"];
function cleStatut(s) {
    return s === "a_venir"
        ? "statusUpcoming"
        : s === "du"
            ? "statusDue"
            : s === "partiel"
                ? "statusPartial"
                : s === "paye"
                    ? "statusPaid"
                    : "statusLate";
}
function couleurStatut(s) {
    return s === "paye"
        ? "bg-green-100 text-green-800"
        : s === "en_retard"
            ? "bg-red-100 text-red-800"
            : s === "partiel"
                ? "bg-orange-100 text-orange-800"
                : s === "du"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-100 text-slate-700";
}
/** Montant collecté : vert quand > 0, gris sinon (rien encaissé). */
function couleurPaye(paye) {
    return paye > 0 ? "text-green-700" : "text-slate-500";
}
/** Restant dû : rouge si en retard, ambre si dû, vert si soldé. */
function couleurRestant(x) {
    if (x.restant <= 0)
        return "text-green-700";
    return x.echeance.statut === "en_retard" ? "text-red-700" : "text-amber-700";
}
function moisAffiche(moisIso, locale) {
    const [a, m] = (0, loyers_1.isoVersMois)(moisIso).split("-").map(Number);
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fr-FR", {
        month: "long",
        year: "numeric",
    }).format(new Date(a, m - 1, 1));
}
function LoyersPage() {
    const t = (0, next_intl_1.useTranslations)("crud");
    const tp = (0, next_intl_1.useTranslations)("pages");
    const locale = (0, next_intl_1.useLocale)();
    const router = (0, navigation_1.useRouter)();
    const [profil, setProfil] = (0, react_1.useState)(null);
    const [immeubles, setImmeubles] = (0, react_1.useState)([]);
    const [appartements, setAppartements] = (0, react_1.useState)([]);
    const [locataires, setLocataires] = (0, react_1.useState)([]);
    const [baux, setBaux] = (0, react_1.useState)([]);
    const [echeances, setEcheances] = (0, react_1.useState)([]);
    const [paiements, setPaiements] = (0, react_1.useState)([]);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const [message, setMessage] = (0, react_1.useState)(null);
    const [mois, setMois] = (0, react_1.useState)((0, loyers_1.moisActuel)());
    const [recherche, setRecherche] = (0, react_1.useState)("");
    const [immeubleId, setImmeubleId] = (0, react_1.useState)("");
    const [statutFiltre, setStatutFiltre] = (0, react_1.useState)("");
    const [tri, setTri] = (0, react_1.useState)("nom");
    const [page, setPage] = (0, react_1.useState)(1);
    const [pageSize, setPageSize] = (0, react_1.useState)(20);
    const [ouverts, setOuverts] = (0, react_1.useState)(new Set());
    const [aDeclarer, setADeclarer] = (0, react_1.useState)(null);
    const [aCorriger, setACorriger] = (0, react_1.useState)(null);
    const [aAnnuler, setAAnnuler] = (0, react_1.useState)(null);
    const [motifAnnulation, setMotifAnnulation] = (0, react_1.useState)("");
    // --- Formulaire de déclaration ---
    const [montant, setMontant] = (0, react_1.useState)("");
    const [devise, setDevise] = (0, react_1.useState)("BIF");
    const [datePaiement, setDatePaiement] = (0, react_1.useState)("");
    const [moyen, setMoyen] = (0, react_1.useState)("especes");
    const [reference, setReference] = (0, react_1.useState)("");
    const [taux, setTaux] = (0, react_1.useState)("");
    const [dateTaux, setDateTaux] = (0, react_1.useState)("");
    const [confirmeTropPercu, setConfirmeTropPercu] = (0, react_1.useState)(false);
    const [erreurForm, setErreurForm] = (0, react_1.useState)(null);
    const [enregistrement, setEnregistrement] = (0, react_1.useState)(false);
    const moisIso = (0, loyers_1.moisVersIso)(mois);
    /**
     * Sélecteur mois/année LOCALISÉ (remplace <input type="month">, dont la
     * langue est choisie par le navigateur, pas par l'application : il
     * affichait « November » en anglais). Les noms de mois viennent de
     * Intl.DateTimeFormat avec la locale de l'app ; les deux listes
     * produisent la même valeur « AAAA-MM » que le champ natif, donc le
     * filtrage des loyers est inchangé.
     */
    const [anneeSel, moisSel] = mois.split("-").map(Number);
    const nomsMois = (0, react_1.useMemo)(() => {
        const format = new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fr-FR", {
            month: "long",
        });
        return Array.from({ length: 12 }, (_, i) => {
            const nom = format.format(new Date(2026, i, 1));
            return nom.charAt(0).toUpperCase() + nom.slice(1);
        });
    }, [locale]);
    const annees = (0, react_1.useMemo)(() => {
        const anneeCourante = new Date().getFullYear();
        return Array.from({ length: 11 }, (_, i) => anneeCourante - 5 + i);
    }, []);
    function changerMois(annee, moisNum) {
        setMois(`${annee}-${String(moisNum).padStart(2, "0")}`);
        setPage(1);
    }
    async function charger(moisCible) {
        setChargement(true);
        setErreur(null);
        try {
            const p = (0, data_1.getDataProvider)();
            const session = await p.getSession();
            if (!session) {
                router.push(`/${locale}/connexion`);
                return;
            }
            // Génération idempotente du mois, puis lecture de tout le nécessaire.
            const moisIsoCible = (0, loyers_1.moisVersIso)(moisCible);
            const [ech, pay, bx, apts, ims, locs, prof] = await Promise.all([
                p.genererEcheances(moisIsoCible),
                p.listerPaiements(),
                p.listerBaux(),
                p.listerAppartements({ inclureArchives: true }),
                p.listerImmeubles(true),
                p.listerLocataires(),
                p.getProfil(),
            ]);
            setEcheances(ech);
            setPaiements(pay);
            setBaux(bx);
            setAppartements(apts);
            setImmeubles(ims);
            setLocataires(locs);
            setProfil(prof);
        }
        catch (e) {
            setErreur((0, translateError_1.messageErreur)(t, e));
        }
        finally {
            setChargement(false);
        }
    }
    (0, react_1.useEffect)(() => {
        charger(mois);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mois]);
    const bailDe = (bailId) => baux.find((b) => b.id === bailId);
    const locataireDe = (bail) => bail ? locataires.find((l) => l.id === bail.locataire_id) : undefined;
    const appartementDe = (bail) => bail ? appartements.find((a) => a.id === bail.appartement_id) : undefined;
    const immeubleDe = (apt) => apt ? immeubles.find((i) => i.id === apt.immeuble_id) : undefined;
    const enrichies = (0, react_1.useMemo)(() => echeances.map((e) => {
        const bail = bailDe(e.bail_id);
        const payList = paiements.filter((p) => p.echeance_id === e.id);
        const paye = (0, loyers_1.totalPayeValide)(payList, e.devise);
        return {
            echeance: e,
            bail,
            locataire: locataireDe(bail),
            appartement: appartementDe(bail),
            immeuble: immeubleDe(appartementDe(bail)),
            paiements: payList
                .slice()
                .sort((a, b) => b.date_paiement.localeCompare(a.date_paiement)),
            paye,
            restant: Math.max(0, e.montant_du - paye),
            tropPercu: Math.max(0, paye - e.montant_du),
        };
    }), 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [echeances, paiements, baux, locataires, appartements, immeubles]);
    /** Baux actifs couvrant le mois : l'état vide se décide sur eux, pas sur les filtres. */
    const nbBauxActifsMois = (0, react_1.useMemo)(() => {
        const debutMois = moisIso;
        const [a, m] = (0, loyers_1.isoVersMois)(moisIso).split("-").map(Number);
        const finMois = `${a}-${String(m).padStart(2, "0")}-${new Date(a, m, 0).getDate()}`;
        return baux.filter((b) => b.statut === "actif" &&
            b.debut.slice(0, 10) <= finMois &&
            (b.fin ? b.fin.slice(0, 10) : "9999-12-31") >= debutMois).length;
    }, [baux, moisIso]);
    const filtres = (0, react_1.useMemo)(() => {
        const q = recherche.trim().toLowerCase();
        let liste = enrichies;
        if (immeubleId)
            liste = liste.filter((x) => x.immeuble?.id === immeubleId);
        if (statutFiltre)
            liste = liste.filter((x) => x.echeance.statut === statutFiltre);
        if (q) {
            liste = liste.filter((x) => [x.locataire?.nom ?? "", x.appartement?.numero ?? "", x.immeuble?.nom ?? ""]
                .some((v) => v.toLowerCase().includes(q)));
        }
        const copie = [...liste];
        if (tri === "nom")
            copie.sort((a, b) => (a.locataire?.nom ?? "").localeCompare(b.locataire?.nom ?? ""));
        if (tri === "montant")
            copie.sort((a, b) => b.echeance.montant_du - a.echeance.montant_du);
        if (tri === "statut")
            copie.sort((a, b) => a.echeance.statut.localeCompare(b.echeance.statut));
        return copie;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enrichies, recherche, immeubleId, statutFiltre, tri]);
    /** Totaux du mois par devise (on ne mélange jamais deux devises dans une somme). */
    const totaux = (0, react_1.useMemo)(() => {
        const base = immeubleId ? enrichies.filter((x) => x.immeuble?.id === immeubleId) : enrichies;
        const parDevise = new Map();
        for (const x of base) {
            const d = x.echeance.devise;
            const tot = parDevise.get(d) ?? { attendu: 0, collecte: 0, restant: 0, retard: 0 };
            tot.attendu += x.echeance.montant_du;
            tot.collecte += x.paye;
            tot.restant += x.restant;
            if (x.echeance.statut === "en_retard")
                tot.retard += x.restant;
            parDevise.set(d, tot);
        }
        return Array.from(parDevise.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    }, [enrichies, immeubleId]);
    const totalPages = Math.max(1, Math.ceil(filtres.length / pageSize));
    const pageCourante = Math.min(page, totalPages);
    const visibles = filtres.slice((pageCourante - 1) * pageSize, pageCourante * pageSize);
    /** Export Excel du mois, sur les lignes filtrées à l'écran (spec §11). */
    function exporterExcel() {
        const devises = Array.from(new Set(filtres.map((x) => x.echeance.devise)));
        const wb = (0, exports_1.buildLoyersWorkbook)({
            echeances: filtres.map((x) => ({
                echeance: x.echeance,
                bail: x.bail,
                locataire: x.locataire,
                appartement: x.appartement,
                immeuble: x.immeuble,
                paye: x.paye,
                restant: x.restant,
            })),
            paiements: paiements
                .filter((p) => filtres.some((x) => x.echeance.id === p.echeance_id))
                .map((p) => {
                const ech = filtres.find((x) => x.echeance.id === p.echeance_id);
                return { paiement: p, locataireNom: ech?.locataire?.nom ?? "—", mois: ech?.echeance.mois ?? moisIso };
            }),
        }, {
            periode: mois,
            dateExport: new Date().toISOString().slice(0, 10),
            devises,
        });
        (0, exports_1.telechargerWorkbook)(wb, `cizaimmo-loyers-${mois}.xlsx`);
    }
    function basculerOuvert(id) {
        setOuverts((prev) => {
            const next = new Set(prev);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    }
    function ouvrirDeclaration(ech) {
        setADeclarer(ech);
        setACorriger(null);
        setMontant(String(ech.restant > 0 ? ech.restant : ech.echeance.montant_du));
        setDevise(ech.echeance.devise);
        setDatePaiement(new Date().toISOString().slice(0, 10));
        setMoyen("especes");
        setReference("");
        setTaux("");
        setDateTaux("");
        setConfirmeTropPercu(false);
        setErreurForm(null);
    }
    function ouvrirCorrection(paiement, ech) {
        setACorriger({ paiement, ech });
        setADeclarer(null);
        setMontant(String(paiement.montant));
        setDevise(paiement.devise);
        setDatePaiement(paiement.date_paiement.slice(0, 10));
        setMoyen(paiement.moyen);
        setReference(paiement.reference ?? "");
        setTaux(paiement.taux_conversion ? String(paiement.taux_conversion) : "");
        setDateTaux(paiement.date_taux ?? "");
        setConfirmeTropPercu(false);
        setErreurForm(null);
    }
    function fermerFormulaire() {
        setADeclarer(null);
        setACorriger(null);
        setErreurForm(null);
    }
    const echCible = aDeclarer ?? aCorriger?.ech ?? null;
    const montantSaisi = Number(montant);
    const deviseDifferente = Boolean(echCible && devise !== echCible.echeance.devise);
    const tauxSaisi = Number(taux);
    const montantConverti = echCible && deviseDifferente && Number.isFinite(tauxSaisi) && tauxSaisi > 0 && Number.isFinite(montantSaisi)
        ? Math.round(montantSaisi * tauxSaisi)
        : null;
    // Montant imputé sur l'échéance, dans la devise du bail (après conversion éventuelle).
    const montantImpute = echCible && Number.isFinite(montantSaisi)
        ? deviseDifferente
            ? (montantConverti ?? 0)
            : montantSaisi
        : 0;
    const dejaPayeHorsCorrection = echCible
        ? echCible.paye -
            (aCorriger
                ? aCorriger.paiement.devise === echCible.echeance.devise
                    ? aCorriger.paiement.montant
                    : (aCorriger.paiement.montant_converti ?? aCorriger.paiement.montant)
                : 0)
        : 0;
    const totalApres = echCible ? dejaPayeHorsCorrection + montantImpute : 0;
    const depassement = Boolean(echCible) && Number.isFinite(montantSaisi) && montantSaisi > 0 && totalApres > echCible.echeance.montant_du;
    async function soumettreDeclaration() {
        if (!echCible)
            return;
        setErreurForm(null);
        if (!Number.isFinite(montantSaisi) || montantSaisi <= 0) {
            setErreurForm(t("validation.positiveStrict"));
            return;
        }
        if (!datePaiement) {
            setErreurForm(t("validation.required"));
            return;
        }
        if (deviseDifferente && (!Number.isFinite(tauxSaisi) || tauxSaisi <= 0 || !dateTaux)) {
            setErreurForm(t("rents.rateRequired"));
            return;
        }
        if (depassement && !confirmeTropPercu) {
            setErreurForm(t("rents.overpayWarning", {
                total: (0, format_1.formatMoney)(totalApres, echCible.echeance.devise, locale),
                remaining: (0, format_1.formatMoney)(echCible.restant, echCible.echeance.devise, locale),
            }));
            return;
        }
        setEnregistrement(true);
        try {
            const input = {
                montant: montantSaisi,
                devise,
                date_paiement: datePaiement,
                moyen: moyen,
                reference: reference.trim() ? reference.trim() : null,
                taux_conversion: deviseDifferente ? tauxSaisi : null,
                date_taux: deviseDifferente ? dateTaux : null,
                montant_converti: deviseDifferente ? montantConverti : null,
            };
            if (aCorriger) {
                const { recuNumero } = await (0, data_1.getDataProvider)().corrigerPaiement(aCorriger.paiement.id, input);
                setMessage(t("rents.paymentCorrected", { numero: recuNumero }));
            }
            else {
                const { recuNumero } = await (0, data_1.getDataProvider)().declarerPaiement({
                    ...input,
                    echeance_id: echCible.echeance.id,
                });
                setMessage(t("rents.paymentDeclared", { numero: recuNumero }));
            }
            fermerFormulaire();
            charger(mois);
        }
        catch (e) {
            setErreurForm((0, translateError_1.messageErreur)(t, e));
        }
        finally {
            setEnregistrement(false);
        }
    }
    async function confirmerAnnulation() {
        if (!aAnnuler)
            return;
        try {
            const annule = await (0, data_1.getDataProvider)().annulerPaiement(aAnnuler.paiement.id, motifAnnulation.trim() ? motifAnnulation.trim() : undefined);
            setMessage(t("rents.paymentCancelled", { numero: annule.recu_numero ?? "" }));
            setAAnnuler(null);
            setMotifAnnulation("");
            charger(mois);
        }
        catch (e) {
            setErreur((0, translateError_1.messageErreur)(t, e));
            setAAnnuler(null);
        }
    }
    /** Restant dû après un paiement donné (cumul chronologique des paiements valides). */
    function restantApresPaiement(ech, paiement) {
        const chronologiques = ech.paiements
            .filter((p) => p.statut === "valide")
            .slice()
            .sort((a, b) => a.date_paiement.localeCompare(b.date_paiement));
        let cumul = 0;
        for (const p of chronologiques) {
            cumul +=
                p.devise === ech.echeance.devise
                    ? p.montant
                    : (p.montant_converti ?? p.montant);
            if (p.id === paiement.id)
                return Math.max(0, ech.echeance.montant_du - cumul);
        }
        return Math.max(0, ech.echeance.montant_du - cumul);
    }
    function telechargerRecuPaiement(ech, paiement) {
        if (!paiement.recu_numero)
            return;
        (0, recu_pdf_1.telechargerRecu)({
            numero: paiement.recu_numero,
            date_emission: paiement.created_at,
            locataire_nom: ech.locataire?.nom ?? "—",
            immeuble_nom: ech.immeuble?.nom ?? "—",
            appartement_numero: ech.appartement?.numero ?? "—",
            mois: ech.echeance.mois,
            montant: paiement.montant,
            devise: paiement.devise,
            date_paiement: paiement.date_paiement,
            reference: paiement.reference,
            statut: paiement.statut,
        }, {
            restantApres: restantApresPaiement(ech, paiement),
            emetteurNom: profil?.nom ?? "—",
            moyenLabel: t(`rents.fields.method${moyenLabelCle(paiement.moyen)}`),
            langue: locale === "en" ? "en" : "fr",
        });
    }
    function moyenLabelCle(m) {
        return m === "especes"
            ? "Cash"
            : m === "virement"
                ? "Transfer"
                : m === "mobile_money"
                    ? "MobileMoney"
                    : m === "cheque"
                        ? "Cheque"
                        : "Other";
    }
    function liensRelance(ech) {
        const moisLibelle = moisAffiche(ech.echeance.mois, locale);
        const params = {
            name: ech.locataire?.nom ?? "",
            month: moisLibelle,
            building: ech.immeuble?.nom ?? "",
            unit: ech.appartement?.numero ?? "",
            amount: (0, format_1.formatMoney)(ech.echeance.montant_du, ech.echeance.devise, locale),
            remaining: (0, format_1.formatMoney)(ech.restant, ech.echeance.devise, locale),
        };
        return {
            email: (0, loyers_1.lienMailto)(ech.locataire?.email ?? null, t("rents.remindEmailSubject", params), t("rents.remindEmailBody", params)),
            whatsapp: (0, loyers_1.lienWhatsApp)(ech.locataire?.telephone ?? null, t("rents.remindWhatsAppMessage", params)),
            // Même message que le lien wa.me, mais envoyé par l'API officielle Meta
            // (module 6) — le lien wa.me reste disponible en complément.
            whatsappMessage: t("rents.remindWhatsAppMessage", params),
            telephone: ech.locataire?.telephone ?? null,
        };
    }
    function prorataTexte(ech) {
        if (!ech.echeance.prorata || !ech.echeance.prorata_detail || !ech.bail)
            return null;
        const [jours, joursMois] = ech.echeance.prorata_detail.split("/");
        return t("rents.prorata", {
            loyer: (0, format_1.formatMoney)(ech.bail.loyer_mensuel, ech.bail.devise, locale),
            jours,
            joursMois,
        });
    }
    return (<AppShell_1.default title={tp("rents.title")}>
      <p role="note" className="mb-4 rounded-xl border border-gold/50 bg-amber-50 px-4 py-3 text-sm font-semibold text-navy">
        {t("rents.notice")}
      </p>
      {message ? (<p role="status" className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-medium text-green-800">{message}</p>) : null}
      {erreur ? (<p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erreur}</p>) : null}

      {chargement ? (<p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>) : nbBauxActifsMois === 0 ? (<EmptyState_1.default title={t("rents.emptyTitle")} text={t("rents.emptyText")} actionLabel={t("rents.emptyAction")} actionHref={`/${locale}/locataires`}/>) : (<>
          <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:flex-wrap">
            <div role="group" aria-label={t("rents.monthLabel")} className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">{t("rents.monthLabel")}</span>
              <select value={moisSel} onChange={(e) => changerMois(anneeSel, Number(e.target.value))} aria-label={t("rents.monthLabel")} className="min-w-0 max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold">
                {nomsMois.map((nom, i) => (<option key={i + 1} value={i + 1}>{nom}</option>))}
              </select>
              <select value={anneeSel} onChange={(e) => changerMois(Number(e.target.value), moisSel)} aria-label={t("rents.yearLabel")} className="min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold">
                {annees.map((a) => (<option key={a} value={a}>{a}</option>))}
              </select>
            </div>
            <input type="search" value={recherche} onChange={(e) => { setRecherche(e.target.value); setPage(1); }} placeholder={t("rents.searchPlaceholder")} aria-label={t("common.search")} className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-gold"/>
            <select value={immeubleId} onChange={(e) => { setImmeubleId(e.target.value); setPage(1); }} aria-label={t("rents.filterBuilding")} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold">
              <option value="">{t("common.all")} — {t("rents.filterBuilding")}</option>
              {immeubles.map((im) => (<option key={im.id} value={im.id}>{im.nom}</option>))}
            </select>
            <select value={statutFiltre} onChange={(e) => { setStatutFiltre(e.target.value); setPage(1); }} aria-label={t("rents.filterStatus")} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold">
              <option value="">{t("common.all")} — {t("rents.filterStatus")}</option>
              {STATUTS.map((s) => (<option key={s} value={s}>{t(`rents.${cleStatut(s)}`)}</option>))}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              {t("common.sortLabel")}
              <select value={tri} onChange={(e) => setTri(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-gold">
                <option value="nom">{t("common.sortName")}</option>
                <option value="montant">{t("rents.sortAmount")}</option>
                <option value="statut">{t("rents.sortStatus")}</option>
              </select>
            </label>
            <button type="button" onClick={exporterExcel} className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-navy hover:border-gold">
              {t("rents.exportExcel")}
            </button>
          </div>

          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-navy">{t("rents.totalsTitle")} — {moisAffiche(moisIso, locale)}</h2>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {totaux.map(([deviseTot, tot]) => (<div key={deviseTot} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-bold text-navy">{deviseTot}</p>
                  <dl className="mt-1 space-y-1 text-sm text-slate-700">
                    <div className="flex justify-between gap-2"><dt className="min-w-0">{t("rents.totalsExpected")}</dt><dd className="font-semibold whitespace-nowrap text-navy">{(0, format_1.formatMoney)(tot.attendu, deviseTot, locale)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="min-w-0">{t("rents.totalsCollected")}</dt><dd className="font-semibold whitespace-nowrap text-green-700">{(0, format_1.formatMoney)(tot.collecte, deviseTot, locale)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="min-w-0">{t("rents.totalsRemaining")}</dt><dd className={`font-semibold whitespace-nowrap ${tot.retard > 0 ? "text-red-700" : tot.restant > 0 ? "text-amber-700" : "text-green-700"}`}>{(0, format_1.formatMoney)(tot.restant, deviseTot, locale)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="min-w-0">{t("rents.totalsLate")}</dt><dd className={`font-semibold whitespace-nowrap ${tot.retard > 0 ? "text-red-700" : "text-green-700"}`}>{(0, format_1.formatMoney)(tot.retard, deviseTot, locale)}</dd></div>
                  </dl>
                </div>))}
            </div>
          </div>

          {visibles.length === 0 ? (<p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">{t("common.noResults")}</p>) : (<>
              <div className="space-y-3 md:hidden">
                {visibles.map((x) => {
                    const liens = liensRelance(x);
                    const prorata = prorataTexte(x);
                    return (<article key={x.echeance.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-lg font-bold text-navy break-words">{x.locataire?.nom ?? "—"}</p>
                          <p className="text-sm text-slate-600">
                            {x.appartement?.numero ?? "—"} — {x.immeuble?.nom ?? "—"}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${couleurStatut(x.echeance.statut)}`}>
                          {t(`rents.${cleStatut(x.echeance.statut)}`)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">
                        {t("rents.colDue")} : <span className="font-bold text-navy">{(0, format_1.formatMoney)(x.echeance.montant_du, x.echeance.devise, locale)}</span>
                      </p>
                      {prorata ? <p className="text-xs text-slate-500">{prorata}</p> : null}
                      <p className="text-sm text-slate-700 break-words">
                        {t("rents.paidLabel")} : <span className={`font-semibold ${couleurPaye(x.paye)}`}>{(0, format_1.formatMoney)(x.paye, x.echeance.devise, locale)}</span> · {t("rents.remainingLabel")} : <span className={`font-semibold ${couleurRestant(x)}`}>{(0, format_1.formatMoney)(x.restant, x.echeance.devise, locale)}</span>
                      </p>
                      {x.tropPercu > 0 ? <p className="text-sm font-semibold text-amber-700">{t("rents.overpaid", { amount: (0, format_1.formatMoney)(x.tropPercu, x.echeance.devise, locale) })}</p> : null}
                      <p className="text-xs text-slate-500">
                        {x.bail ? t("rents.dueDay", { day: String(x.bail.jour_exigibilite) }) : ""} · {moisAffiche(x.echeance.mois, locale)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => ouvrirDeclaration(x)} className="rounded-full bg-gold px-3 py-1.5 text-sm font-bold text-navy hover:bg-gold-light">
                          {t("rents.declare")}
                        </button>
                        <button type="button" onClick={() => basculerOuvert(x.echeance.id)} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy">
                          {ouverts.has(x.echeance.id) ? t("rents.hidePayments") : t("rents.showPayments")}
                        </button>
                        {x.locataire ? (<link_1.default href={`/${locale}/locataires/${x.locataire.id}`} className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-semibold text-navy">
                            {t("rents.viewLease")}
                          </link_1.default>) : null}
                      </div>
                      {liens.email ? (<a href={liens.email} className="mt-2 inline-block text-sm font-semibold text-navy underline">{t("rents.remindEmail")}</a>) : (<p className="mt-2 text-sm text-slate-400">{t("rents.noEmail")}</p>)}
                      {liens.whatsapp ? (<a href={liens.whatsapp} target="_blank" rel="noreferrer" className="ml-4 mt-2 inline-block text-sm font-semibold text-navy underline">{t("rents.remindWhatsApp")}</a>) : (<p className="ml-4 mt-2 inline-block text-sm text-slate-400">{t("rents.noPhone")}</p>)}
                      <span className="ml-4 mt-2 inline-block">
                        <WhatsAppSendButton_1.default to={liens.telephone} message={liens.whatsappMessage} label={t("rents.remindWhatsAppApi")}/>
                      </span>
                      {ouverts.has(x.echeance.id) ? listePaiements(x) : null}
                    </article>);
                })}
              </div>

              <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-cream font-semibold text-navy">
                      <th className="px-4 py-3">{t("rents.colTenant")}</th>
                      <th className="px-4 py-3">{t("rents.colDue")}</th>
                      <th className="px-4 py-3">{t("rents.colPaidRemaining")}</th>
                      <th className="px-4 py-3">{t("rents.colStatus")}</th>
                      <th className="px-4 py-3">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((x) => {
                    const liens = liensRelance(x);
                    const prorata = prorataTexte(x);
                    return (<tr key={x.echeance.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <p className="font-bold text-navy">{x.locataire?.nom ?? "—"}</p>
                            <p className="text-xs text-slate-500">{x.appartement?.numero ?? "—"} — {x.immeuble?.nom ?? "—"}</p>
                            {prorata ? <p className="text-xs text-slate-500">{prorata}</p> : null}
                            <p className="text-xs text-slate-500">
                              {x.bail ? t("rents.dueDay", { day: String(x.bail.jour_exigibilite) }) : ""} · {moisAffiche(x.echeance.mois, locale)}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-semibold text-navy">{(0, format_1.formatMoney)(x.echeance.montant_du, x.echeance.devise, locale)}</td>
                          <td className="px-4 py-3">
                            <span className={`font-semibold ${couleurPaye(x.paye)}`}>{(0, format_1.formatMoney)(x.paye, x.echeance.devise, locale)}</span> / <span className={`font-semibold ${couleurRestant(x)}`}>{(0, format_1.formatMoney)(x.restant, x.echeance.devise, locale)}</span>
                            {x.tropPercu > 0 ? <p className="text-xs font-semibold text-amber-700">{t("rents.overpaid", { amount: (0, format_1.formatMoney)(x.tropPercu, x.echeance.devise, locale) })}</p> : null}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${couleurStatut(x.echeance.statut)}`}>
                              {t(`rents.${cleStatut(x.echeance.statut)}`)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              <button type="button" onClick={() => ouvrirDeclaration(x)} className="font-semibold text-navy underline">
                                {t("rents.declare")}
                              </button>
                              <button type="button" onClick={() => basculerOuvert(x.echeance.id)} className="font-semibold text-navy underline">
                                {ouverts.has(x.echeance.id) ? t("rents.hidePayments") : t("rents.showPayments")}
                              </button>
                              {x.locataire ? (<link_1.default href={`/${locale}/locataires/${x.locataire.id}`} className="font-semibold text-navy underline">
                                  {t("rents.viewLease")}
                                </link_1.default>) : null}
                              {liens.email ? (<a href={liens.email} className="font-semibold text-navy underline">{t("rents.remindEmail")}</a>) : null}
                              {liens.whatsapp ? (<a href={liens.whatsapp} target="_blank" rel="noreferrer" className="font-semibold text-navy underline">{t("rents.remindWhatsApp")}</a>) : null}
                              <WhatsAppSendButton_1.default to={liens.telephone} message={liens.whatsappMessage} label={t("rents.remindWhatsAppApi")}/>
                            </div>
                            {ouverts.has(x.echeance.id) ? listePaiements(x) : null}
                          </td>
                        </tr>);
                })}
                  </tbody>
                </table>
              </div>
            </>)}

          <Pagination_1.default page={pageCourante} pageSize={pageSize} total={filtres.length} onPageChange={setPage} onPageSizeChange={(n) => { setPageSize(n); setPage(1); }} perPageLabel={t("common.perPage")} showingLabel={(from, to, total) => t("common.showing", { from, to, total })}/>
        </>)}

      {echCible ? (<div role="dialog" aria-modal="true" aria-label={aCorriger ? t("rents.declareTitleCorrect") : t("rents.declareTitle")} className="fixed inset-0 z-50 flex items-end justify-center bg-navy-dark/60 p-4 sm:items-center" onClick={fermerFormulaire}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-navy">{aCorriger ? t("rents.declareTitleCorrect") : t("rents.declareTitle")}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {t("rents.declareFor", { name: echCible.locataire?.nom ?? "—", month: moisAffiche(echCible.echeance.mois, locale) })} — {t("rents.remainingLabel")} : <span className={`font-semibold ${couleurRestant(echCible)}`}>{(0, format_1.formatMoney)(echCible.restant, echCible.echeance.devise, locale)}</span>
            </p>
            <div className="mt-4 space-y-4">
              <MoneyField_1.default id="montant-paiement" label={t("rents.fields.amount")} amount={montant} onAmountChange={setMontant} currency={devise} onCurrencyChange={setDevise} required/>
              {deviseDifferente ? (<div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-semibold">{t("rents.conversionNote")}</p>
                  <p className="mt-1">
                    1 {devise} = {taux ? `${taux} ` : ""}{echCible.echeance.devise}
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field_1.default id="taux" label={t("rents.fields.rate")} type="number" value={taux} onChange={setTaux} required/>
                    <Field_1.default id="date-taux" label={t("rents.fields.rateDate")} type="date" value={dateTaux} onChange={setDateTaux} required/>
                  </div>
                  {montantConverti !== null ? (<p className="mt-2 font-semibold">
                      {t("rents.fields.converted")} : {(0, format_1.formatMoney)(montantConverti, echCible.echeance.devise, locale)}
                    </p>) : null}
                </div>) : null}
              <Field_1.default id="date-paiement" label={t("rents.fields.date")} type="date" value={datePaiement} onChange={setDatePaiement} required/>
              <Field_1.default id="moyen" label={t("rents.fields.method")} value={moyen} onChange={setMoyen} required>
                <option value="especes">{t("rents.fields.methodCash")}</option>
                <option value="virement">{t("rents.fields.methodTransfer")}</option>
                <option value="mobile_money">{t("rents.fields.methodMobileMoney")}</option>
                <option value="cheque">{t("rents.fields.methodCheque")}</option>
                <option value="autre">{t("rents.fields.methodOther")}</option>
              </Field_1.default>
              <Field_1.default id="reference" label={t("rents.fields.reference")} value={reference} onChange={setReference}/>
              {depassement ? (<div className="rounded-xl bg-amber-50 p-3">
                  <p role="alert" className="text-sm font-semibold text-amber-900">
                    {t("rents.overpayWarning", {
                    total: (0, format_1.formatMoney)(totalApres, echCible.echeance.devise, locale),
                    remaining: (0, format_1.formatMoney)(echCible.restant, echCible.echeance.devise, locale),
                })}
                  </p>
                  <label className="mt-2 flex items-start gap-2 text-sm font-medium text-amber-900">
                    <input type="checkbox" checked={confirmeTropPercu} onChange={(e) => setConfirmeTropPercu(e.target.checked)} className="mt-0.5"/>
                    {t("rents.overpayConfirm")}
                  </label>
                </div>) : null}
              {erreurForm ? (<p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{erreurForm}</p>) : null}
              <div className="flex gap-3">
                <button type="button" onClick={fermerFormulaire} className="flex-1 rounded-full border border-slate-300 px-4 py-2.5 text-base font-semibold text-slate-700">
                  {t("common.cancel")}
                </button>
                <button type="button" onClick={soumettreDeclaration} disabled={enregistrement} className="flex-1 rounded-full bg-gold px-4 py-2.5 text-base font-bold text-navy disabled:opacity-50">
                  {enregistrement ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </div>
          </div>
        </div>) : null}

      {aAnnuler ? (<ConfirmDialog_1.default title={t("rents.cancelTitle")} text={t("rents.cancelText", { numero: aAnnuler.paiement.recu_numero ?? "" })} confirmLabel={t("rents.cancelPayment")} cancelLabel={t("common.cancel")} danger onConfirm={confirmerAnnulation} onCancel={() => { setAAnnuler(null); setMotifAnnulation(""); }}/>) : null}
    </AppShell_1.default>);
    function listePaiements(x) {
        return (<div className="mt-3 rounded-xl bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{t("rents.paymentsTitle")}</p>
        {x.paiements.length === 0 ? (<p className="mt-1 text-sm text-slate-500">{t("rents.noPayments")}</p>) : (<ul className="mt-2 space-y-2">
            {x.paiements.map((p) => (<li key={p.id} className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`font-semibold min-w-0 break-words ${p.statut === "annule" ? "text-slate-400 line-through" : "text-green-700"}`}>
                    {(0, format_1.formatMoney)(p.montant, p.devise, locale)} · {(0, format_1.formatDate)(p.date_paiement, locale)}
                  </span>
                  {p.statut === "annule" ? (<span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                      {t("rents.paymentCancelledLabel")}
                    </span>) : null}
                </div>
                <p className="text-xs text-slate-500">
                  {t(`rents.fields.method${moyenLabelCle(p.moyen)}`)}
                  {p.reference ? ` · ${p.reference}` : ""}
                  {p.recu_numero ? ` · ${t("rents.receiptForPayment", { numero: p.recu_numero })}` : ""}
                </p>
                {p.recu_numero ? (<div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    <button type="button" onClick={() => telechargerRecuPaiement(x, p)} className="text-xs font-semibold text-navy underline">
                      {t("rents.downloadReceipt")}
                    </button>
                    {p.statut === "valide" ? (<>
                        <button type="button" onClick={() => ouvrirCorrection(p, x)} className="text-xs font-semibold text-navy underline">
                          {t("rents.correct")}
                        </button>
                        <button type="button" onClick={() => { setAAnnuler({ paiement: p, ech: x }); setMotifAnnulation(""); }} className="text-xs font-semibold text-red-700 underline">
                          {t("rents.cancelPayment")}
                        </button>
                      </>) : null}
                  </div>) : null}
              </li>))}
          </ul>)}
      </div>);
    }
}

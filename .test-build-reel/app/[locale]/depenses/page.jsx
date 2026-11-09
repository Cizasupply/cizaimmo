"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DepensesPage;
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const navigation_1 = require("next/navigation");
const AppShell_1 = __importDefault(require("@/components/AppShell"));
const ConfirmDialog_1 = __importDefault(require("@/components/ConfirmDialog"));
const DepenseForm_1 = __importDefault(require("@/components/DepenseForm"));
const EmptyState_1 = __importDefault(require("@/components/EmptyState"));
const Pagination_1 = __importDefault(require("@/components/Pagination"));
const format_1 = require("@/lib/format");
const data_1 = require("@/lib/data");
const data_2 = require("@/lib/data");
const exports_1 = require("@/lib/exports");
const translateError_1 = require("@/lib/translateError");
function aujourdhuiIso() {
    return new Date().toISOString().slice(0, 10);
}
async function fichierVersDataUrl(fichier) {
    return new Promise((resolve, reject) => {
        const lecteur = new FileReader();
        lecteur.onload = () => resolve(String(lecteur.result));
        lecteur.onerror = () => reject(new Error("lecture"));
        lecteur.readAsDataURL(fichier);
    });
}
/**
 * Pastille discrète par catégorie de dépense (palette de l'app uniquement,
 * texte foncé sur fond clair). Le rouge est réservé aux montants (sorties
 * d'argent) : aucune catégorie n'utilise le rouge.
 */
const COULEURS_CATEGORIES = {
    entretien: "bg-green-100 text-green-800",
    reparation: "bg-orange-100 text-orange-800",
    taxe: "bg-amber-100 text-amber-800",
    assurance: "bg-navy/10 text-navy",
    salaire: "bg-slate-100 text-slate-700",
    autre: "bg-gold/20 text-navy",
};
function DepensesPage() {
    const t = (0, next_intl_1.useTranslations)("crud");
    const te = (0, next_intl_1.useTranslations)("crud.expenses");
    const tp = (0, next_intl_1.useTranslations)("pages");
    const tc = (0, next_intl_1.useTranslations)("crud.common");
    const locale = (0, next_intl_1.useLocale)();
    const router = (0, navigation_1.useRouter)();
    const [depenses, setDepenses] = (0, react_1.useState)([]);
    const [immeubles, setImmeubles] = (0, react_1.useState)([]);
    const [appartements, setAppartements] = (0, react_1.useState)([]);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const [message, setMessage] = (0, react_1.useState)(null);
    const [recherche, setRecherche] = (0, react_1.useState)("");
    const [immeubleId, setImmeubleId] = (0, react_1.useState)("");
    const [categorie, setCategorie] = (0, react_1.useState)("");
    const [periodeDebut, setPeriodeDebut] = (0, react_1.useState)("");
    const [periodeFin, setPeriodeFin] = (0, react_1.useState)("");
    const [tri, setTri] = (0, react_1.useState)("date");
    const [page, setPage] = (0, react_1.useState)(1);
    const [pageSize, setPageSize] = (0, react_1.useState)(20);
    const [aAjouter, setAAjouter] = (0, react_1.useState)(false);
    const [aModifier, setAModifier] = (0, react_1.useState)(null);
    const [aSupprimer, setASupprimer] = (0, react_1.useState)(null);
    async function charger() {
        setChargement(true);
        setErreur(null);
        try {
            const p = (0, data_1.getDataProvider)();
            const session = await p.getSession();
            if (!session) {
                router.push(`/${locale}/connexion`);
                return;
            }
            const [deps, ims, apts] = await Promise.all([
                p.listerDepenses(),
                p.listerImmeubles(true),
                p.listerAppartements({ inclureArchives: true }),
            ]);
            setDepenses(deps);
            setImmeubles(ims);
            setAppartements(apts);
        }
        catch (e) {
            setErreur((0, translateError_1.messageErreur)(t, e));
        }
        finally {
            setChargement(false);
        }
    }
    (0, react_1.useEffect)(() => {
        charger();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const nomImmeuble = (id) => immeubles.find((i) => i.id === id)?.nom ?? "—";
    const nomAppartement = (id) => id ? appartements.find((a) => a.id === id)?.numero ?? "—" : "—";
    const filtrees = (0, react_1.useMemo)(() => {
        const q = recherche.trim().toLowerCase();
        return depenses
            .filter((d) => !immeubleId || d.immeuble_id === immeubleId)
            .filter((d) => !categorie || d.categorie === categorie)
            .filter((d) => !periodeDebut || d.date >= periodeDebut)
            .filter((d) => !periodeFin || d.date <= periodeFin)
            .filter((d) => !q ||
            d.libelle.toLowerCase().includes(q) ||
            (d.fournisseur ?? "").toLowerCase().includes(q) ||
            nomImmeuble(d.immeuble_id).toLowerCase().includes(q))
            .sort((a, b) => tri === "montant"
            ? b.montant - a.montant
            : tri === "libelle"
                ? a.libelle.localeCompare(b.libelle)
                : b.date.localeCompare(a.date));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [depenses, recherche, immeubleId, categorie, periodeDebut, periodeFin, tri, immeubles]);
    const pageDepenses = (0, react_1.useMemo)(() => filtrees.slice((page - 1) * pageSize, page * pageSize), [filtrees, page, pageSize]);
    const totauxParCategorie = (0, react_1.useMemo)(() => {
        const map = new Map();
        for (const d of filtrees) {
            const cle = `${d.categorie}|${d.devise}`;
            map.set(cle, (map.get(cle) ?? 0) + d.montant);
        }
        return Array.from(map.entries()).map(([cle, total]) => {
            const [cat, devise] = cle.split("|");
            return { categorie: cat, devise, total };
        });
    }, [filtrees]);
    const totauxParImmeuble = (0, react_1.useMemo)(() => {
        const map = new Map();
        for (const d of filtrees) {
            const cle = `${d.immeuble_id}|${d.devise}`;
            map.set(cle, (map.get(cle) ?? 0) + d.montant);
        }
        return Array.from(map.entries()).map(([cle, total]) => {
            const [id, devise] = cle.split("|");
            return { immeubleId: id, devise, total };
        });
    }, [filtrees]);
    async function handleCreer(input, justificatif) {
        const p = (0, data_1.getDataProvider)();
        const creee = await p.creerDepense(input);
        if (justificatif) {
            try {
                const contenu = await fichierVersDataUrl(justificatif);
                const doc = await p.televerserDocument({
                    type: "facture",
                    entite_type: "depense",
                    entite_id: creee.id,
                    nom_fichier: justificatif.name,
                    contenu,
                    taille_octets: justificatif.size,
                    mime_type: justificatif.type,
                });
                await p.modifierDepense(creee.id, { justificatif_url: doc.storage_path });
            }
            catch (e) {
                setMessage(te("receiptUploadFailed"));
                void e;
            }
        }
        setAAjouter(false);
        setMessage(tc("created"));
        await charger();
    }
    async function handleModifier(input, justificatif) {
        if (!aModifier)
            return;
        const p = (0, data_1.getDataProvider)();
        await p.modifierDepense(aModifier.id, input);
        if (justificatif) {
            try {
                const contenu = await fichierVersDataUrl(justificatif);
                const doc = await p.televerserDocument({
                    type: "facture",
                    entite_type: "depense",
                    entite_id: aModifier.id,
                    nom_fichier: justificatif.name,
                    contenu,
                    taille_octets: justificatif.size,
                    mime_type: justificatif.type,
                });
                await p.modifierDepense(aModifier.id, { justificatif_url: doc.storage_path });
            }
            catch {
                setMessage(te("receiptUploadFailed"));
            }
        }
        setAModifier(null);
        setMessage(tc("updated"));
        await charger();
    }
    async function confirmerSuppression() {
        if (!aSupprimer)
            return;
        try {
            await (0, data_1.getDataProvider)().supprimerDepense(aSupprimer.id);
            setASupprimer(null);
            setMessage(tc("deletedDone"));
            await charger();
        }
        catch (e) {
            setErreur((0, translateError_1.messageErreur)(t, e));
            setASupprimer(null);
        }
    }
    function exporterExcel() {
        const devises = Array.from(new Set(filtrees.map((d) => d.devise)));
        const wb = (0, exports_1.buildDepensesWorkbook)(filtrees, { immeuble: nomImmeuble, appartement: nomAppartement }, {
            periode: `${periodeDebut || "…"} → ${periodeFin || "…"}`,
            dateExport: aujourdhuiIso(),
            devises,
        });
        (0, exports_1.telechargerWorkbook)(wb, `cizaimmo-depenses-${aujourdhuiIso()}.xlsx`);
    }
    return (<AppShell_1.default title={tp("expenses.title")}>
      {message ? (<p role="status" className="mb-4 rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-800">
          {message}
        </p>) : null}
      {erreur ? (<div role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {erreur}
          <button type="button" onClick={charger} className="ml-3 font-bold underline">
            {tc("retry")}
          </button>
        </div>) : null}

      {chargement ? (<div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (<div key={i} className="h-16 animate-pulse rounded-2xl bg-white shadow-sm"/>))}
          <p className="text-sm text-slate-500">{tc("loading")}</p>
        </div>) : depenses.length === 0 ? (<EmptyState_1.default title={te("emptyTitle")} text={te("emptyText")} actionLabel={te("add")} onAction={() => setAAjouter(true)}/>) : (<>
          <div className="mb-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => setAAjouter(true)} className="rounded-full bg-gold px-5 py-2.5 text-sm font-bold text-navy hover:bg-gold-light">
              {te("add")}
            </button>
            <button type="button" onClick={exporterExcel} className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-navy hover:border-gold">
              {te("exportExcel")}
            </button>
          </div>

          <div className="mb-4 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-sm font-semibold text-slate-900">
              {tc("search")}
              <input value={recherche} onChange={(e) => { setRecherche(e.target.value); setPage(1); }} placeholder={te("searchPlaceholder")} className="mt-1 w-full min-w-0 max-w-full rounded-lg border border-slate-300 px-3 py-2 text-base font-normal outline-none focus:border-gold"/>
            </label>
            <label className="block text-sm font-semibold text-slate-900">
              {te("filterBuilding")}
              <select value={immeubleId} onChange={(e) => { setImmeubleId(e.target.value); setPage(1); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-normal outline-none focus:border-gold">
                <option value="">{tc("all")}</option>
                {immeubles.map((i) => (<option key={i.id} value={i.id}>{i.nom}</option>))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-900">
              {te("filterCategory")}
              <select value={categorie} onChange={(e) => { setCategorie(e.target.value); setPage(1); }} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-normal outline-none focus:border-gold">
                <option value="">{tc("all")}</option>
                {data_2.CATEGORIES_DEPENSES.map((c) => (<option key={c} value={c}>{te(`categories.${c}`)}</option>))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-900">
              {te("periodFrom")}
              <input type="date" value={periodeDebut} onChange={(e) => { setPeriodeDebut(e.target.value); setPage(1); }} className="mt-1 w-full min-w-0 max-w-full rounded-lg border border-slate-300 px-3 py-2 text-base font-normal outline-none focus:border-gold"/>
            </label>
            <label className="block text-sm font-semibold text-slate-900">
              {te("periodTo")}
              <input type="date" value={periodeFin} onChange={(e) => { setPeriodeFin(e.target.value); setPage(1); }} className="mt-1 w-full min-w-0 max-w-full rounded-lg border border-slate-300 px-3 py-2 text-base font-normal outline-none focus:border-gold"/>
            </label>
            <label className="block text-sm font-semibold text-slate-900">
              {tc("sortLabel")}
              <select value={tri} onChange={(e) => setTri(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base font-normal outline-none focus:border-gold">
                <option value="date">{te("sortDate")}</option>
                <option value="montant">{te("sortAmount")}</option>
                <option value="libelle">{te("sortLabel")}</option>
              </select>
            </label>
          </div>

          {totauxParCategorie.length > 0 ? (<div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-navy">{te("totalsByCategory")}</h2>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {totauxParCategorie.map((x) => (<li key={`${x.categorie}-${x.devise}`} className="flex items-center justify-between gap-2">
                      <span className={`inline-block shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${COULEURS_CATEGORIES[x.categorie]}`}>{te(`categories.${x.categorie}`)}</span>
                      <span className="shrink-0 whitespace-nowrap font-semibold text-red-700">{(0, format_1.formatMoney)(x.total, x.devise, locale)}</span>
                    </li>))}
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-navy">{te("totalsByBuilding")}</h2>
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {totauxParImmeuble.map((x) => (<li key={`${x.immeubleId}-${x.devise}`} className="flex justify-between gap-2">
                      <span className="min-w-0 break-words">{nomImmeuble(x.immeubleId)}</span>
                      <span className="shrink-0 whitespace-nowrap font-semibold text-red-700">{(0, format_1.formatMoney)(x.total, x.devise, locale)}</span>
                    </li>))}
                </ul>
              </div>
            </div>) : null}

          {filtrees.length === 0 ? (<p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-600 shadow-sm">{tc("noResults")}</p>) : (<>
              <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-cream font-semibold text-navy">
                      <th className="px-4 py-3">{te("fields.date")}</th>
                      <th className="px-4 py-3">{te("fields.building")}</th>
                      <th className="px-4 py-3">{te("fields.apartment")}</th>
                      <th className="px-4 py-3">{te("fields.category")}</th>
                      <th className="px-4 py-3">{te("fields.label")}</th>
                      <th className="px-4 py-3 text-right">{te("fields.amount")}</th>
                      <th className="px-4 py-3">{te("fields.receipt")}</th>
                      <th className="px-4 py-3">{tc("actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageDepenses.map((d) => (<tr key={d.id} className="border-b border-slate-100">
                        <td className="px-4 py-3">{(0, format_1.formatDate)(d.date, locale)}</td>
                        <td className="px-4 py-3">{nomImmeuble(d.immeuble_id)}</td>
                        <td className="px-4 py-3">{nomAppartement(d.appartement_id)}</td>
                        <td className="px-4 py-3"><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${COULEURS_CATEGORIES[d.categorie]}`}>{te(`categories.${d.categorie}`)}</span></td>
                        <td className="px-4 py-3 font-medium text-navy">
                          {d.libelle}
                          {d.fournisseur ? <span className="block text-xs font-normal text-slate-500">{d.fournisseur}</span> : null}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-red-700">{(0, format_1.formatMoney)(d.montant, d.devise, locale)}</td>
                        <td className="px-4 py-3">{d.justificatif_url ? <span className="font-semibold text-green-700">{te("receiptYes")}</span> : <span className="text-slate-400">—</span>}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setAModifier(d)} className="font-semibold text-navy underline">{tc("edit")}</button>
                            <button type="button" onClick={() => setASupprimer(d)} className="font-semibold text-red-700 underline">{tc("delete")}</button>
                          </div>
                        </td>
                      </tr>))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {pageDepenses.map((d) => (<article key={d.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words font-bold text-navy">{d.libelle}</p>
                        <p className="break-words text-sm text-slate-600">
                          {(0, format_1.formatDate)(d.date, locale)} · {nomImmeuble(d.immeuble_id)}
                          {d.appartement_id ? ` · ${nomAppartement(d.appartement_id)}` : ""}
                        </p>
                        <p className="break-words text-sm text-slate-600"><span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${COULEURS_CATEGORIES[d.categorie]}`}>{te(`categories.${d.categorie}`)}</span></p>
                      </div>
                      <p className="shrink-0 whitespace-nowrap text-right font-bold text-red-700">{(0, format_1.formatMoney)(d.montant, d.devise, locale)}</p>
                    </div>
                    <div className="mt-3 flex gap-4">
                      <button type="button" onClick={() => setAModifier(d)} className="text-sm font-semibold text-navy underline">{tc("edit")}</button>
                      <button type="button" onClick={() => setASupprimer(d)} className="text-sm font-semibold text-red-700 underline">{tc("delete")}</button>
                    </div>
                  </article>))}
              </div>

              <Pagination_1.default page={page} pageSize={pageSize} total={filtrees.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} perPageLabel={tc("perPage")} showingLabel={(from, to, total) => tc("showing", { from, to, total })}/>
            </>)}
        </>)}

      {aAjouter ? (<div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="mx-auto mt-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-navy">{te("formTitleNew")}</h2>
            <div className="mt-4">
              <DepenseForm_1.default immeubles={immeubles} appartements={appartements} onSubmit={handleCreer} submitLabel={tc("create")}/>
            </div>
            <button type="button" onClick={() => setAAjouter(false)} className="mt-4 text-sm font-semibold text-slate-600 underline">
              {tc("cancel")}
            </button>
          </div>
        </div>) : null}

      {aModifier ? (<div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="mx-auto mt-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-navy">{te("formTitleEdit")}</h2>
            <div className="mt-4">
              <DepenseForm_1.default immeubles={immeubles} appartements={appartements} depense={aModifier} onSubmit={handleModifier} submitLabel={tc("save")}/>
            </div>
            <button type="button" onClick={() => setAModifier(null)} className="mt-4 text-sm font-semibold text-slate-600 underline">
              {tc("cancel")}
            </button>
          </div>
        </div>) : null}

      {aSupprimer ? (<ConfirmDialog_1.default title={tc("confirmDelete", { name: aSupprimer.libelle })} text={tc("confirmDeleteText")} confirmLabel={tc("delete")} cancelLabel={tc("cancel")} onConfirm={confirmerSuppression} onCancel={() => setASupprimer(null)}/>) : null}
    </AppShell_1.default>);
}

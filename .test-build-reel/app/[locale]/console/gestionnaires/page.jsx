"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ConsoleGestionnairesPage;
/**
 * Console — Gestionnaires rattachés (extension v1.2) : rattachements
 * Ciza Group / propriétaires, création, retrait, et ouverture de la
 * SUPERVISION (lecture du tableau du gestionnaire, journalisée).
 * Les gestionnaires des clients non rattachés à Ciza Group restent
 * invisibles ici hors statistiques (décision verrouillée).
 */
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const data_1 = require("@/lib/data");
function ConsoleGestionnairesPage() {
    const t = (0, next_intl_1.useTranslations)("console");
    const locale = (0, next_intl_1.useLocale)();
    const [rattachements, setRattachements] = (0, react_1.useState)([]);
    const [comptes, setComptes] = (0, react_1.useState)([]);
    const [immeubles, setImmeubles] = (0, react_1.useState)([]);
    const [email, setEmail] = (0, react_1.useState)("");
    const [contexte, setContexte] = (0, react_1.useState)("proprietaire");
    const [proprietaireId, setProprietaireId] = (0, react_1.useState)("");
    const [immeubleIds, setImmeubleIds] = (0, react_1.useState)([]);
    const [message, setMessage] = (0, react_1.useState)(null);
    const [erreur, setErreur] = (0, react_1.useState)(null);
    const [occupe, setOccupe] = (0, react_1.useState)(false);
    const recharger = (0, react_1.useCallback)(async () => {
        const provider = (0, data_1.getDataProvider)();
        const [liste, comptesListe] = await Promise.all([
            provider.listerRattachements(),
            provider.listerComptesPlateforme(),
        ]);
        setRattachements(liste);
        setComptes(comptesListe);
        // Immeubles proposables : ceux visibles par la session (démo : parc
        // principal ; réel : selon RLS). Liste vide → champ libre masqué.
        provider
            .listerImmeubles(true)
            .then(setImmeubles)
            .catch(() => setImmeubles([]));
    }, []);
    (0, react_1.useEffect)(() => {
        recharger().catch(() => undefined);
    }, [recharger]);
    async function agir(action, succes) {
        setOccupe(true);
        setMessage(null);
        setErreur(null);
        try {
            await action();
            setMessage(succes);
            await recharger();
        }
        catch (e) {
            const code = e instanceof Error ? e.message : "";
            setErreur(code.startsWith("ERR_")
                ? t(`errors.${code}`)
                : t("errors.generic"));
        }
        finally {
            setOccupe(false);
        }
    }
    const proprietaires = comptes.filter((c) => c.role === "proprietaire");
    return (<div>
      <h1 className="text-2xl font-semibold text-navy md:text-3xl">{t("managersTitle")}</h1>
      <p className="mt-1 text-sm text-slate-600">{t("managersSubtitle")}</p>

      {message ? (<p role="status" className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800">{message}</p>) : null}
      {erreur ? (<p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{erreur}</p>) : null}

      <div className="mt-6 space-y-3">
        {rattachements.length === 0 ? (<p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">{t("noManagers")}</p>) : null}
        {rattachements.map((r) => (<article key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-navy">{r.gestionnaire_nom ?? r.gestionnaire_email}</h2>
              <p className="truncate text-sm text-slate-500">{r.gestionnaire_email}</p>
              <p className="mt-1 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-navy/10 px-2 py-1 font-bold text-navy">
                  {r.contexte === "cizagroup" ? t("contextCizaGroup") : t("contextOwner")}
                </span>
                {r.contexte === "proprietaire" ? (<span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                    {r.proprietaire_nom ?? r.proprietaire_id}
                  </span>) : null}
                <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                  {t("buildingsCount", { count: r.immeuble_ids.length })}
                </span>
                <span className={`rounded-full px-2 py-1 font-bold ${r.statut === "actif" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                  {r.statut === "actif" ? t("adminActive") : t("adminSuspended")}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <link_1.default href={`/${locale}/console/supervision/${r.id}`} className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-navy-dark hover:bg-gold/85">
                {t("openSupervision")}
              </link_1.default>
              <button type="button" disabled={occupe} onClick={() => agir(() => (0, data_1.getDataProvider)().retirerRattachement(r.id), t("attachmentRemovedMsg"))} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-navy disabled:opacity-50">
                {t("removeAttachment")}
              </button>
            </div>
          </article>))}
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-navy">{t("createAttachmentTitle")}</h2>
        <form className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2" onSubmit={(e) => {
            e.preventDefault();
            agir(async () => {
                await (0, data_1.getDataProvider)().creerRattachement({
                    gestionnaire_email: email,
                    contexte,
                    proprietaire_id: contexte === "proprietaire" ? proprietaireId || null : null,
                    immeuble_ids: immeubleIds,
                });
                setEmail("");
                setImmeubleIds([]);
            }, t("attachmentCreatedMsg"));
        }}>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">{t("managerEmail")}</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("emailPlaceholder")} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"/>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">{t("contextLabel")}</span>
            <select value={contexte} onChange={(e) => setContexte(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
              <option value="proprietaire">{t("contextOwner")}</option>
              <option value="cizagroup">{t("contextCizaGroup")}</option>
            </select>
          </label>
          {contexte === "proprietaire" ? (<label className="block">
              <span className="text-sm font-semibold text-slate-700">{t("ownerLabel")}</span>
              <select value={proprietaireId} onChange={(e) => setProprietaireId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                <option value="">—</option>
                {proprietaires.map((c) => (<option key={c.id} value={c.id}>
                    {c.nom} ({c.email})
                  </option>))}
              </select>
            </label>) : null}
          {immeubles.length > 0 ? (<fieldset className="md:col-span-2">
              <legend className="text-sm font-semibold text-slate-700">{t("buildingsLabel")}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {immeubles.map((imm) => {
                const coche = immeubleIds.includes(imm.id);
                return (<label key={imm.id} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${coche ? "border-gold bg-gold/15 font-semibold text-navy" : "border-slate-300 text-slate-600"}`}>
                      <input type="checkbox" checked={coche} onChange={(e) => setImmeubleIds(e.target.checked
                        ? [...immeubleIds, imm.id]
                        : immeubleIds.filter((id) => id !== imm.id))} className="h-4 w-4 accent-[#1B2A4A]"/>
                      {imm.nom} — {imm.ville}
                    </label>);
            })}
              </div>
            </fieldset>) : null}
          <div className="md:col-span-2">
            <button type="submit" disabled={occupe} className="rounded-full border border-navy bg-white px-5 py-2 text-sm font-semibold text-navy hover:bg-navy/5 disabled:opacity-50">
              {t("createAttachmentButton")}
            </button>
          </div>
        </form>
      </section>
    </div>);
}

"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = NouvelAppartementPage;
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const next_intl_1 = require("next-intl");
const navigation_1 = require("next/navigation");
const AppShell_1 = __importDefault(require("@/components/AppShell"));
const AppartementForm_1 = __importDefault(require("@/components/AppartementForm"));
const EmptyState_1 = __importDefault(require("@/components/EmptyState"));
const data_1 = require("@/lib/data");
const contactDossier_1 = require("@/lib/contactDossier");
function NouvelAppartementContenu() {
    const t = (0, next_intl_1.useTranslations)("crud");
    const locale = (0, next_intl_1.useLocale)();
    const router = (0, navigation_1.useRouter)();
    const searchParams = (0, navigation_1.useSearchParams)();
    const preselectedImmeubleId = searchParams.get("immeuble") ?? undefined;
    const lot = searchParams.get("lot") === "1";
    const [immeubles, setImmeubles] = (0, react_1.useState)([]);
    const [contactDossier, setContactDossier] = (0, react_1.useState)(null);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    const [mode, setMode] = (0, react_1.useState)(lot ? "bulk" : "single");
    (0, react_1.useEffect)(() => {
        (async () => {
            const p = (0, data_1.getDataProvider)();
            const session = await p.getSession();
            if (!session) {
                router.push(`/${locale}/connexion`);
                return;
            }
            setImmeubles(await p.listerImmeubles());
            // v1.6 : contact attendu du dossier — pour l'immeuble
            // présélectionné s'il y en a un, sinon le contact du compte
            // (le contrôle qui fait foi reste celui de la demande de
            // publication, dans la base).
            setContactDossier(await (0, contactDossier_1.contactDossierPourImmeuble)(p, preselectedImmeubleId ?? null));
            setChargement(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    async function handleSingle(input) {
        const apt = await (0, data_1.getDataProvider)().creerAppartement(input);
        router.push(`/${locale}/appartements/${apt.id}`);
    }
    async function handleBulk(immeubleId, items) {
        await (0, data_1.getDataProvider)().creerAppartementsEnLot(immeubleId, items);
        router.push(`/${locale}/immeubles/${immeubleId}`);
    }
    return (<AppShell_1.default title={mode === "bulk" ? t("apartments.bulkTitle") : t("apartments.formTitleNew")}>
      <link_1.default href={`/${locale}/appartements`} className="mb-4 inline-block font-semibold text-navy underline">
        ← {t("apartments.backToList")}
      </link_1.default>
      <div className="mb-4 flex gap-2">
        <button type="button" onClick={() => setMode("single")} className={"rounded-full px-4 py-2 text-sm font-bold " +
            (mode === "single" ? "bg-navy text-white" : "border border-slate-300 text-navy")}>
          {t("apartments.add")}
        </button>
        <button type="button" onClick={() => setMode("bulk")} className={"rounded-full px-4 py-2 text-sm font-bold " +
            (mode === "bulk" ? "bg-navy text-white" : "border border-slate-300 text-navy")}>
          {t("apartments.addBulk")}
        </button>
      </div>
      {chargement ? (<p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>) : immeubles.length === 0 ? (<EmptyState_1.default title={t("buildings.emptyTitle")} text={t("buildings.emptyText")} actionLabel={t("buildings.addFirst")} actionHref={`/${locale}/immeubles/nouveau`}/>) : (<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <AppartementForm_1.default immeubles={immeubles} preselectedImmeubleId={preselectedImmeubleId} mode={mode} onSubmitSingle={handleSingle} onSubmitBulk={handleBulk} submitLabel={t("common.create")} contactDossier={contactDossier}/>
        </div>)}
    </AppShell_1.default>);
}
function NouvelAppartementPage() {
    return (<react_1.Suspense fallback={null}>
      <NouvelAppartementContenu />
    </react_1.Suspense>);
}

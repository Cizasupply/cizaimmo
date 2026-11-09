"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ModifierAppartementPage;
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const next_intl_1 = require("next-intl");
const navigation_1 = require("next/navigation");
const AppShell_1 = __importDefault(require("@/components/AppShell"));
const AppartementForm_1 = __importDefault(require("@/components/AppartementForm"));
const data_1 = require("@/lib/data");
const contactDossier_1 = require("@/lib/contactDossier");
function ModifierAppartementPage({ params }) {
    const t = (0, next_intl_1.useTranslations)("crud");
    const locale = (0, next_intl_1.useLocale)();
    const router = (0, navigation_1.useRouter)();
    const [appartement, setAppartement] = (0, react_1.useState)(null);
    const [immeubles, setImmeubles] = (0, react_1.useState)([]);
    const [contactDossier, setContactDossier] = (0, react_1.useState)(null);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    const [introuvable, setIntrouvable] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        (async () => {
            const p = (0, data_1.getDataProvider)();
            const session = await p.getSession();
            if (!session) {
                router.push(`/${locale}/connexion`);
                return;
            }
            const [apt, ims] = await Promise.all([
                p.getAppartement(params.id),
                p.listerImmeubles(),
            ]);
            if (!apt)
                setIntrouvable(true);
            else {
                setAppartement(apt);
                // v1.6 : contact attendu du dossier pour l'immeuble de
                // l'appartement (gestionnaire rattaché ou propriétaire).
                setContactDossier(await (0, contactDossier_1.contactDossierPourImmeuble)(p, apt.immeuble_id));
            }
            setImmeubles(ims);
            setChargement(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.id]);
    async function handleSubmit(input) {
        const { immeuble_id: _immeuble, ...patch } = input;
        await (0, data_1.getDataProvider)().modifierAppartement(params.id, patch);
        router.push(`/${locale}/appartements/${params.id}`);
    }
    return (<AppShell_1.default title={t("apartments.formTitleEdit")}>
      <link_1.default href={`/${locale}/appartements/${params.id}`} className="mb-4 inline-block font-semibold text-navy underline">
        ← {t("common.back")}
      </link_1.default>
      {chargement ? (<p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>) : introuvable || !appartement ? (<div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p role="alert" className="text-red-700">{t("errors.ERR_NOT_FOUND")}</p>
        </div>) : (<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <AppartementForm_1.default immeubles={immeubles} preselectedImmeubleId={appartement.immeuble_id} initial={appartement} mode="single" onSubmitSingle={handleSubmit} submitLabel={t("common.save")} contactDossier={contactDossier}/>
        </div>)}
    </AppShell_1.default>);
}

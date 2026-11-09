"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ModifierLocatairePage;
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const next_intl_1 = require("next-intl");
const navigation_1 = require("next/navigation");
const AppShell_1 = __importDefault(require("@/components/AppShell"));
const LocataireForm_1 = __importDefault(require("@/components/LocataireForm"));
const data_1 = require("@/lib/data");
function ModifierLocatairePage({ params }) {
    const t = (0, next_intl_1.useTranslations)("crud");
    const locale = (0, next_intl_1.useLocale)();
    const router = (0, navigation_1.useRouter)();
    const [locataire, setLocataire] = (0, react_1.useState)(null);
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
            const loc = await p.getLocataire(params.id);
            if (!loc)
                setIntrouvable(true);
            else
                setLocataire(loc);
            setChargement(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.id]);
    async function handleSubmit(input) {
        await (0, data_1.getDataProvider)().modifierLocataire(params.id, input);
        router.push(`/${locale}/locataires/${params.id}`);
    }
    return (<AppShell_1.default title={t("tenants.formTitleEdit")}>
      <link_1.default href={`/${locale}/locataires/${params.id}`} className="mb-4 inline-block font-semibold text-navy underline">
        ← {t("common.back")}
      </link_1.default>
      {chargement ? (<p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>) : introuvable || !locataire ? (<div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p role="alert" className="text-red-700">{t("errors.ERR_NOT_FOUND")}</p>
        </div>) : (<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LocataireForm_1.default initial={locataire} onSubmit={handleSubmit} submitLabel={t("common.save")}/>
        </div>)}
    </AppShell_1.default>);
}

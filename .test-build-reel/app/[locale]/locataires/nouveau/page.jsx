"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = NouveauLocatairePage;
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const next_intl_1 = require("next-intl");
const navigation_1 = require("next/navigation");
const AppShell_1 = __importDefault(require("@/components/AppShell"));
const LocataireForm_1 = __importDefault(require("@/components/LocataireForm"));
const data_1 = require("@/lib/data");
function NouveauLocatairePage() {
    const t = (0, next_intl_1.useTranslations)("crud");
    const locale = (0, next_intl_1.useLocale)();
    const router = (0, navigation_1.useRouter)();
    const [pret, setPret] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        (async () => {
            const session = await (0, data_1.getDataProvider)().getSession();
            if (!session)
                router.push(`/${locale}/connexion`);
            else
                setPret(true);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    async function handleSubmit(input) {
        const loc = await (0, data_1.getDataProvider)().creerLocataire(input);
        router.push(`/${locale}/locataires/${loc.id}`);
    }
    return (<AppShell_1.default title={t("tenants.formTitleNew")}>
      <link_1.default href={`/${locale}/locataires`} className="mb-4 inline-block font-semibold text-navy underline">
        ← {t("tenants.backToList")}
      </link_1.default>
      {pret ? (<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LocataireForm_1.default onSubmit={handleSubmit} submitLabel={t("common.create")}/>
        </div>) : (<p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>)}
    </AppShell_1.default>);
}

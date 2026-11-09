"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = NouveauBailLocatairePage;
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const next_intl_1 = require("next-intl");
const navigation_1 = require("next/navigation");
const AppShell_1 = __importDefault(require("@/components/AppShell"));
const BailForm_1 = __importDefault(require("@/components/BailForm"));
const data_1 = require("@/lib/data");
function NouveauBailLocatairePage({ params }) {
    const t = (0, next_intl_1.useTranslations)("crud");
    const locale = (0, next_intl_1.useLocale)();
    const router = (0, navigation_1.useRouter)();
    const [appartements, setAppartements] = (0, react_1.useState)([]);
    const [immeubles, setImmeubles] = (0, react_1.useState)([]);
    const [locataires, setLocataires] = (0, react_1.useState)([]);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        (async () => {
            const p = (0, data_1.getDataProvider)();
            const session = await p.getSession();
            if (!session) {
                router.push(`/${locale}/connexion`);
                return;
            }
            const [apts, ims, locs] = await Promise.all([
                p.listerAppartements(),
                p.listerImmeubles(),
                p.listerLocataires(),
            ]);
            setAppartements(apts);
            setImmeubles(ims);
            setLocataires(locs);
            setChargement(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const locataire = locataires.find((l) => l.id === params.id);
    async function handleSubmit(input, fichierBail) {
        const p = (0, data_1.getDataProvider)();
        const bail = await p.creerBail(input);
        if (fichierBail) {
            const contenu = await new Promise((resolve, reject) => {
                const lecteur = new FileReader();
                lecteur.onload = () => resolve(String(lecteur.result));
                lecteur.onerror = () => reject(new Error("lecture"));
                lecteur.readAsDataURL(fichierBail);
            });
            await p.televerserDocument({
                type: "bail",
                entite_type: "bail",
                entite_id: bail.id,
                nom_fichier: fichierBail.name,
                contenu,
                taille_octets: fichierBail.size,
                mime_type: fichierBail.type,
            });
        }
        router.push(`/${locale}/locataires/${params.id}`);
    }
    return (<AppShell_1.default title={locataire
            ? t("leases.formTitleFromTenant", { name: locataire.nom })
            : t("leases.formTitle")}>
      <link_1.default href={`/${locale}/locataires/${params.id}`} className="mb-4 inline-block font-semibold text-navy underline">
        ← {t("common.back")}
      </link_1.default>
      {chargement ? (<p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>) : (<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <BailForm_1.default appartements={appartements} immeubles={immeubles} locataires={locataires} preselectedLocataireId={params.id} onSubmit={handleSubmit} submitLabel={t("common.create")}/>
        </div>)}
    </AppShell_1.default>);
}

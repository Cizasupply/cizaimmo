"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = NouvelImmeublePage;
const react_1 = require("react");
const link_1 = __importDefault(require("next/link"));
const next_intl_1 = require("next-intl");
const navigation_1 = require("next/navigation");
const AppShell_1 = __importDefault(require("@/components/AppShell"));
const ImmeubleForm_1 = __importDefault(require("@/components/ImmeubleForm"));
const data_1 = require("@/lib/data");
/** Lit un fichier en data URL (patron des téléversements de documents). */
function lireEnDataUrl(fichier) {
    return new Promise((resolve, reject) => {
        const lecteur = new FileReader();
        lecteur.onload = () => resolve(lecteur.result);
        lecteur.onerror = () => reject(new Error("lecture"));
        lecteur.readAsDataURL(fichier);
    });
}
function NouvelImmeublePage() {
    const t = (0, next_intl_1.useTranslations)("crud");
    const locale = (0, next_intl_1.useLocale)();
    const router = (0, navigation_1.useRouter)();
    const [abonnement, setAbonnement] = (0, react_1.useState)(null);
    const [nbActifs, setNbActifs] = (0, react_1.useState)(0);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    // v1.3 : preuve de propriété optionnelle, téléversée après création.
    const [fichierPreuve, setFichierPreuve] = (0, react_1.useState)(null);
    // v1.7 : photos du bien stagées + cas gestionnaire (autorisation).
    const [fichiersPhotos, setFichiersPhotos] = (0, react_1.useState)([]);
    const [fichierAutorisation, setFichierAutorisation] = (0, react_1.useState)(null);
    const [modeGestionnaire, setModeGestionnaire] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        (async () => {
            const p = (0, data_1.getDataProvider)();
            const session = await p.getSession();
            if (!session) {
                router.push(`/${locale}/connexion`);
                return;
            }
            const [abo, ims, profil] = await Promise.all([
                p.getAbonnement(),
                p.listerImmeubles(),
                p.getProfil(),
            ]);
            setAbonnement(abo);
            setNbActifs(ims.filter((i) => i.statut === "actif").length);
            // v1.7 : le rôle du créateur décide du justificatif demandé —
            // gestionnaire = autorisation de gestion + propriétaire déclaré.
            setModeGestionnaire(profil?.role === "gestionnaire");
            setChargement(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const limite = abonnement ? (0, data_1.limiteBlocs)(abonnement.plan, abonnement.statut) : null;
    const limiteAtteinte = limite !== null && Number.isFinite(limite) && nbActifs >= limite;
    async function handleSubmit(input) {
        const provider = (0, data_1.getDataProvider)();
        const im = await provider.creerImmeuble(input);
        // v1.7 : photos du bien — téléversées après la création (la
        // première devient la photo du passeport). Un échec unitaire ne
        // bloque pas la création : les photos s'ajoutent aussi en édition.
        for (const fichier of fichiersPhotos) {
            try {
                const contenu = await lireEnDataUrl(fichier);
                await provider.ajouterPhotoImmeuble(im.id, {
                    nom_fichier: fichier.name,
                    taille_octets: fichier.size,
                    mime_type: fichier.type || null,
                    contenu,
                });
            }
            catch {
                // Création conservée ; photo ajoutable plus tard.
            }
        }
        // v1.7 : créateur gestionnaire — l'autorisation de gestion
        // remplace la preuve de propriété (document « autorisation »).
        // v1.3 : preuve de propriété (optionnelle) — document
        // « justificatif » rattaché à l'immeuble. Un échec de téléversement
        // ne bloque pas la création : le document peut être ajouté plus
        // tard depuis la page Documents.
        const justificatif = modeGestionnaire
            ? fichierAutorisation
                ? { fichier: fichierAutorisation, type: "autorisation" }
                : null
            : fichierPreuve
                ? { fichier: fichierPreuve, type: "justificatif" }
                : null;
        if (justificatif) {
            try {
                const contenu = await lireEnDataUrl(justificatif.fichier);
                await provider.televerserDocument({
                    type: justificatif.type,
                    entite_type: "immeuble",
                    entite_id: im.id,
                    nom_fichier: justificatif.fichier.name,
                    taille_octets: justificatif.fichier.size,
                    mime_type: justificatif.fichier.type || null,
                    contenu,
                });
            }
            catch {
                // Création conservée ; justificatif ajoutable plus tard.
            }
        }
        router.push(`/${locale}/immeubles/${im.id}`);
    }
    return (<AppShell_1.default title={t("buildings.formTitleNew")}>
      <link_1.default href={`/${locale}/immeubles`} className="mb-4 inline-block font-semibold text-navy underline">
        ← {t("buildings.backToList")}
      </link_1.default>
      {chargement ? (<p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>) : limiteAtteinte && abonnement ? (<div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-lg font-semibold text-navy">{t("buildings.limitReached")}</h2>
          <p className="mt-2 text-base text-slate-700">
            {t("buildings.limitText", {
                plan: abonnement.plan,
                limit: String(limite),
                used: String(nbActifs),
            })}
          </p>
          <link_1.default href={`/${locale}/immeubles`} className="mt-6 inline-block rounded-full border border-navy bg-white px-6 py-3 text-base font-semibold text-navy hover:bg-navy/5">
            {t("common.back")}
          </link_1.default>
        </div>) : (<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ImmeubleForm_1.default onSubmit={handleSubmit} submitLabel={t("common.create")} fichierPreuve={fichierPreuve} onFichierPreuveChange={setFichierPreuve} modeGestionnaire={modeGestionnaire} fichiersPhotos={fichiersPhotos} onFichiersPhotosChange={setFichiersPhotos} fichierAutorisation={fichierAutorisation} onFichierAutorisationChange={setFichierAutorisation}/>
        </div>)}
    </AppShell_1.default>);
}

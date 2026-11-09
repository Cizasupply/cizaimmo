"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ModifierImmeublePage;
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
function ModifierImmeublePage({ params }) {
    const t = (0, next_intl_1.useTranslations)("crud");
    const locale = (0, next_intl_1.useLocale)();
    const router = (0, navigation_1.useRouter)();
    const [immeuble, setImmeuble] = (0, react_1.useState)(null);
    const [chargement, setChargement] = (0, react_1.useState)(true);
    const [introuvable, setIntrouvable] = (0, react_1.useState)(false);
    // v1.7 : autorisation de gestion (remplacement stagé) + présence au dossier.
    const [fichierAutorisation, setFichierAutorisation] = (0, react_1.useState)(null);
    const [autorisationExistante, setAutorisationExistante] = (0, react_1.useState)(false);
    async function charger() {
        const p = (0, data_1.getDataProvider)();
        const im = await p.getImmeuble(params.id);
        if (!im) {
            setIntrouvable(true);
        }
        else {
            setImmeuble(im);
            // Une autorisation déjà déposée dispense d'en fournir une autre.
            const docs = await p.listerDocuments({
                entite_type: "immeuble",
                entite_id: im.id,
                type: "autorisation",
            });
            setAutorisationExistante(docs.length > 0);
        }
        setChargement(false);
    }
    (0, react_1.useEffect)(() => {
        (async () => {
            const p = (0, data_1.getDataProvider)();
            const session = await p.getSession();
            if (!session) {
                router.push(`/${locale}/connexion`);
                return;
            }
            await charger();
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.id]);
    // v1.7 : ajout de photos IMMÉDIAT en édition (téléversement puis
    // rechargement du bien — la première photo reste la principale).
    async function ajouterPhotos(fichiers) {
        const provider = (0, data_1.getDataProvider)();
        for (const fichier of fichiers) {
            try {
                const contenu = await lireEnDataUrl(fichier);
                const maj = await provider.ajouterPhotoImmeuble(params.id, {
                    nom_fichier: fichier.name,
                    taille_octets: fichier.size,
                    mime_type: fichier.type || null,
                    contenu,
                });
                setImmeuble(maj);
            }
            catch {
                // Les autres photos continuent ; l'état affiché reste cohérent.
            }
        }
    }
    async function retirerPhoto(index) {
        try {
            const maj = await (0, data_1.getDataProvider)().retirerPhotoImmeuble(params.id, index);
            setImmeuble(maj);
        }
        catch {
            // État inchangé.
        }
    }
    async function handleSubmit(input) {
        const provider = (0, data_1.getDataProvider)();
        await provider.modifierImmeuble(params.id, input);
        // v1.7 : remplacement de l'autorisation de gestion, si un nouveau
        // fichier a été choisi (non bloquant, comme les autres documents).
        if (fichierAutorisation) {
            try {
                const contenu = await lireEnDataUrl(fichierAutorisation);
                await provider.televerserDocument({
                    type: "autorisation",
                    entite_type: "immeuble",
                    entite_id: params.id,
                    nom_fichier: fichierAutorisation.name,
                    taille_octets: fichierAutorisation.size,
                    mime_type: fichierAutorisation.type || null,
                    contenu,
                });
            }
            catch {
                // Modification conservée ; autorisation ajoutable plus tard.
            }
        }
        router.push(`/${locale}/immeubles/${params.id}`);
    }
    const modeGestionnaire = immeuble?.origine_creation === "gestionnaire";
    // Photos affichées : les téléversées (URLs signées) ; à défaut,
    // l'ancien lien photo du bien (lecture seule, non retirable ici).
    const photosAffichees = immeuble && immeuble.photos_urls.length > 0
        ? immeuble.photos_urls.filter(Boolean)
        : immeuble?.photo_url
            ? [immeuble.photo_url]
            : [];
    return (<AppShell_1.default title={t("buildings.formTitleEdit")}>
      <link_1.default href={`/${locale}/immeubles/${params.id}`} className="mb-4 inline-block font-semibold text-navy underline">
        ← {t("common.back")}
      </link_1.default>
      {chargement ? (<p className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-500 shadow-sm">{t("common.loading")}</p>) : introuvable || !immeuble ? (<div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <p role="alert" className="text-red-700">{t("errors.ERR_NOT_FOUND")}</p>
        </div>) : (<div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ImmeubleForm_1.default initial={immeuble} onSubmit={handleSubmit} submitLabel={t("common.save")} modeGestionnaire={modeGestionnaire} photosUrls={photosAffichees} onAjouterPhotos={ajouterPhotos} onRetirerPhotoExistante={immeuble.photos.length > 0 ? retirerPhoto : undefined} fichierAutorisation={fichierAutorisation} onFichierAutorisationChange={setFichierAutorisation} autorisationExistante={autorisationExistante}/>
        </div>)}
    </AppShell_1.default>);
}

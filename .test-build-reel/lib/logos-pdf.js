"use strict";
// ============================================================================
// Logos des documents PDF — chargement partagé (modèle : lib/talon-paie.ts).
//
// Bandeau « Marine & Or » des contrats (correctif captures fondateur
// 2026-11-08, point 6 — consigne « Contrats CizaImmo : logos Ciza Group
// et CizaImmo en avant sur le document ») : logo CizaImmo compact
// recadré (820×260, artwork blanc + or sur TRANSPARENT — le PNG d'écran
// /cizaimmo-logo-v4.png garde un padding transparent qui rendrait le
// logo illisible à cette taille) et logo Ciza Group transparent or.
// Les deux PNG sont TRANSPARENTS : aucun fond blanc parasite sur le
// bandeau marine (vérifié par rastérisation, comme pour la carte et
// le talon).
//
// Chargement « au mieux » côté navigateur : fetch du fichier public +
// FileReader + réduction canvas du logo Ciza Group (source 2000×2000,
// il gonflerait le PDF à plusieurs Mo sans réduction ; la transparence
// PNG est conservée). Hors navigateur ou en cas d'échec : null, et le
// générateur retombe sur son en-tête TEXTE historique — le document
// reste valide et le cycle de signature/dépôt est inchangé.
// ============================================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOGO_CIZAGROUP_URL = exports.LOGO_CIZAIMMO_URL = void 0;
exports.chargerLogosPdf = chargerLogosPdf;
exports.LOGO_CIZAIMMO_URL = "/cizaimmo-logo-compact.png";
exports.LOGO_CIZAGROUP_URL = "/cizagroup-logo-transparent.png";
async function chargerImageDataUrl(url) {
    try {
        if (typeof fetch !== "function" || typeof FileReader === "undefined") {
            return null;
        }
        const reponse = await fetch(url);
        if (!reponse.ok)
            return null;
        const blob = await reponse.blob();
        const dataUrl = await new Promise((resolve) => {
            const lecteur = new FileReader();
            lecteur.onload = () => resolve(typeof lecteur.result === "string" ? lecteur.result : null);
            lecteur.onerror = () => resolve(null);
            lecteur.readAsDataURL(blob);
        });
        if (!dataUrl)
            return null;
        // Allègement : le logo Ciza Group source fait 2000x2000 — embarqué
        // tel quel, il gonflerait le document à plusieurs Mo. On le
        // redimensionne à 512 px max via canvas (la transparence PNG est
        // conservée) ; en cas d'échec, l'original est conservé.
        return (await reduireImageDataUrl(dataUrl, 512)) ?? dataUrl;
    }
    catch {
        return null;
    }
}
function reduireImageDataUrl(dataUrl, maxPx) {
    return new Promise((resolve) => {
        try {
            if (typeof document === "undefined") {
                resolve(null);
                return;
            }
            const image = new Image();
            image.onload = () => {
                try {
                    const echelle = Math.min(1, maxPx / Math.max(image.width, image.height));
                    if (echelle >= 1) {
                        resolve(dataUrl);
                        return;
                    }
                    const canvas = document.createElement("canvas");
                    canvas.width = Math.round(image.width * echelle);
                    canvas.height = Math.round(image.height * echelle);
                    const ctx = canvas.getContext("2d");
                    if (!ctx) {
                        resolve(null);
                        return;
                    }
                    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL("image/png"));
                }
                catch {
                    resolve(null);
                }
            };
            image.onerror = () => resolve(null);
            image.src = dataUrl;
        }
        catch {
            resolve(null);
        }
    });
}
/** Charge les deux logos publics (data URLs) — null par logo en échec. */
async function chargerLogosPdf() {
    return {
        logoCizaImmo: await chargerImageDataUrl(exports.LOGO_CIZAIMMO_URL),
        logoCizaGroup: await chargerImageDataUrl(exports.LOGO_CIZAGROUP_URL),
    };
}

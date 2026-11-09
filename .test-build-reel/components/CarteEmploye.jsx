"use strict";
"use client";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CarteEmploye;
const react_1 = require("react");
const next_intl_1 = require("next-intl");
const code128_1 = require("@/lib/code128");
/**
 * Carte employé à code-barres (pack employé, 2026-11-08) — badge
 * Marine & Or au format carte (85,6 × 54 mm) : photo, nom, rôle
 * « Admin — CizaImmo, division de Ciza Group », Display ID et
 * code-barres Code 128 encodant le Display ID (vérifiable via la page
 * console « Vérifier un employé », qui répond depuis la BASE).
 * Logo de la maison mère CIZA GROUP en haut à droite (2026-11-08,
 * demande du fondateur) : version or sur fond TRANSPARENT, adaptée
 * au fond marine — asset public/cizagroup-logo-transparent.png,
 * copie à l'identique du fichier de marque (aucun fond blanc).
 * Rendu à l'écran + téléchargement PDF + impression.
 */
/** Logo Ciza Group (maison mère), version transparente pour fonds sombres. */
const LOGO_GROUPE_URL = "/cizagroup-logo-transparent.png";
/** Blob -> data URL (photo et logo du PDF). */
function blobVersDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const lecteur = new FileReader();
        lecteur.onload = () => resolve(String(lecteur.result));
        lecteur.onerror = reject;
        lecteur.readAsDataURL(blob);
    });
}
function CarteEmploye({ pack }) {
    const t = (0, next_intl_1.useTranslations)("packEmploye");
    const [occupe, setOccupe] = (0, react_1.useState)(false);
    const displayId = pack.display_id ?? "";
    const modules = (0, react_1.useMemo)(() => {
        if (!displayId)
            return [];
        try {
            return (0, code128_1.encoderCode128B)(displayId).modules;
        }
        catch {
            return [];
        }
    }, [displayId]);
    // Barres : suites de modules pleins/vides fusionnées en segments.
    const segments = (0, react_1.useMemo)(() => {
        const out = [];
        for (const m of modules) {
            const dernier = out[out.length - 1];
            if (dernier && dernier.plein === m)
                dernier.n += 1;
            else
                out.push({ plein: m, n: 1 });
        }
        return out;
    }, [modules]);
    async function telechargerPdf() {
        setOccupe(true);
        try {
            const { jsPDF } = await Promise.resolve().then(() => __importStar(require("jspdf")));
            const doc = new jsPDF({
                orientation: "landscape",
                unit: "mm",
                format: [85.6, 54],
            });
            const W = 85.6;
            const H = 54;
            doc.setFillColor(27, 42, 74);
            doc.rect(0, 0, W, H, "F");
            doc.setFillColor(212, 175, 55);
            doc.rect(0, 0, W, 1.6, "F");
            doc.setFillColor(247, 245, 240);
            doc.rect(0, H - 1.6, W, 1.6, "F");
            // Logo Ciza Group (maison mère) : PNG transparent (or), coin
            // supérieur droit — le canevas source est carré et le visuel
            // réel y est centré ; la taille posée tient compte de cette
            // marge transparente pour un rendu bien visible.
            try {
                const reponseLogo = await fetch(LOGO_GROUPE_URL);
                if (reponseLogo.ok) {
                    const dataUrlLogo = await blobVersDataUrl(await reponseLogo.blob());
                    doc.addImage(dataUrlLogo, "PNG", W - 15, 2.6, 11, 11);
                }
            }
            catch {
                // Best effort : la carte reste générée sans le logo.
            }
            // Photo (best effort : URL signée accessible en CORS).
            let photoOk = false;
            const urlPhoto = pack.dossier.photo_profil_url;
            if (urlPhoto) {
                try {
                    const reponse = await fetch(urlPhoto);
                    if (reponse.ok) {
                        const blob = await reponse.blob();
                        const dataUrl = await blobVersDataUrl(blob);
                        const format = dataUrl.includes("image/png") ? "PNG" : "JPEG";
                        doc.addImage(dataUrl, format, 5, 8, 18, 22, undefined, "FAST");
                        photoOk = true;
                    }
                }
                catch {
                    photoOk = false;
                }
            }
            if (!photoOk) {
                doc.setFillColor(212, 175, 55);
                doc.circle(14, 19, 9, "F");
                doc.setTextColor(27, 42, 74);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.text((pack.nom || "?").trim().charAt(0).toUpperCase(), 14, 22.5, { align: "center" });
            }
            doc.setTextColor(247, 245, 240);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11.5);
            doc.text(doc.splitTextToSize(pack.nom, 40), 26, 13);
            doc.setTextColor(212, 175, 55);
            doc.setFontSize(8.5);
            doc.text(t("carteRole"), 26, 20);
            doc.setTextColor(247, 245, 240);
            doc.setFontSize(7.5);
            doc.text(t("carteDivision"), 26, 24.5);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.text(displayId, 26, 30.5);
            // Code-barres : bande blanche + modules noirs (zones de repos
            // de 10 modules de chaque côté).
            const bx = 5;
            const by = 35;
            const bw = W - 10;
            const bh = 11;
            doc.setFillColor(255, 255, 255);
            doc.rect(bx, by, bw, bh + 4.5, "F");
            const total = modules.length + 20;
            const mw = bw / total;
            doc.setFillColor(20, 20, 20);
            modules.forEach((m, i) => {
                if (m)
                    doc.rect(bx + (i + 10) * mw, by + 1, mw + 0.05, bh - 2, "F");
            });
            doc.setTextColor(27, 42, 74);
            doc.setFontSize(7);
            doc.text(displayId, W / 2, by + bh + 3.2, { align: "center" });
            doc.save(`carte-employe-${displayId}.pdf`);
        }
        finally {
            setOccupe(false);
        }
    }
    return (<div>
      <div className="relative w-full max-w-[430px] overflow-hidden rounded-2xl shadow-lg" style={{ backgroundColor: "#1B2A4A", aspectRatio: "85.6 / 54" }}>
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gold"/>
        {/* Logo Ciza Group (maison mère), or sur transparent — le
            canevas carré contient le visuel centré ; la boîte de
            44 px donne un visuel réel d'environ 30 px de haut. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_GROUPE_URL} alt="Ciza Group" className="absolute right-3 top-2 h-11 w-11 object-contain"/>
        <div className="flex h-full flex-col justify-between p-4 pb-3">
          <div className="flex items-start gap-3 pr-12">
            {pack.dossier.photo_profil_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={pack.dossier.photo_profil_url} alt={pack.nom} className="h-16 w-14 shrink-0 rounded-lg border border-gold/50 object-cover"/>) : (<div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-lg bg-gold text-xl font-bold text-navy">
                {(pack.nom || "?").trim().charAt(0).toUpperCase()}
              </div>)}
            <div className="min-w-0">
              <p className="truncate text-base font-bold text-cream">
                {pack.nom}
              </p>
              <p className="text-xs font-semibold text-gold">
                {t("carteRole")}
              </p>
              <p className="text-[11px] text-cream/80">{t("carteDivision")}</p>
              <p className="mt-1 whitespace-nowrap text-sm font-bold tracking-wide text-cream">
                {displayId}
              </p>
            </div>
          </div>
          <div className="rounded-md bg-white px-2 pb-1 pt-1.5">
            <div className="flex h-8 w-full items-stretch" aria-hidden>
              <div style={{ flexGrow: 10 }}/>
              {segments.map((s, i) => s.plein ? (<div key={i} className="bg-neutral-900" style={{ flexGrow: s.n }}/>) : (<div key={i} style={{ flexGrow: s.n }}/>))}
              <div style={{ flexGrow: 10 }}/>
            </div>
            <p className="text-center text-[10px] font-semibold tracking-[0.3em] text-navy">
              {displayId}
            </p>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-[3px] bg-cream"/>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 print:hidden">
        <button type="button" onClick={telechargerPdf} disabled={occupe} className="rounded-xl bg-navy px-4 py-2.5 text-sm font-bold text-cream transition hover:bg-navy-light disabled:opacity-50">
          {t("carteDownload")}
        </button>
        <button type="button" onClick={() => window.print()} className="rounded-xl bg-gold px-4 py-2.5 text-sm font-bold text-navy transition hover:bg-gold-light">
          {t("cartePrint")}
        </button>
      </div>
    </div>);
}

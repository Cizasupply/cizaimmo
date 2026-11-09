"use strict";
// ============================================================================
// CizaImmo — TALON DE PAIE de l'employé plateforme (2026-11-08, ajout
// VALIDÉ par le fondateur).
//
// Génération AUTOMATIQUE et DYNAMIQUE à chaque demande, patron des
// PDF de contrats déjà en place : rien n'est stocké, rien n'est codé
// en dur — le talon est régénéré depuis la LIGNE DE PAIE ÉMISE (ses
// instantanés figés : montant, devise, modalités, moyen + destination
// de paiement, référence, émis par / émis le) et l'identité de
// l'employé lue en base (nom, Display ID, fonction).
//
// Contenu verrouillé par le brief : en-tête aux DEUX logos (CizaImmo
// + Ciza Group, patron des cartes de fin vidéo : les deux marques
// ensemble) sur bandeau marine ; titre « Talon de paie / Pay stub » ;
// employé, mois de paie ; ligne « Salaire selon contrat
// d'engagement » ; « Total à payer » = le même montant — AUCUNE
// retenue n'est modélisée (pas d'INSS, rien d'inventé) ; destination
// de paiement (l'instantané de la paie) ; référence si présente ;
// « Émis par … le … » ; pied entreprise sobre.
//
// LANGUE : celle du COMPTE de l'employé (profils.langue), patron du
// contrat employé (la langue suit le compte, pas l'interface de
// celui qui télécharge — le Super Admin obtient le talon dans la
// langue de l'employé).
// ============================================================================
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
exports.TALON_LOGO_CIZAGROUP_URL = exports.TALON_LOGO_CIZAIMMO_URL = void 0;
exports.nomFichierTalonPaie = nomFichierTalonPaie;
exports.formaterMoisTalon = formaterMoisTalon;
exports.assemblerDonneesTalonPaie = assemblerDonneesTalonPaie;
exports.textesTalonPaie = textesTalonPaie;
exports.genererTalonPaiePdf = genererTalonPaiePdf;
const contrat_employe_1 = require("./contrat-employe");
/** Nom de fichier stable du talon (Display ID + mois de paie). */
function nomFichierTalonPaie(displayId, mois) {
    return `talon-paie-${displayId ?? "sans-id"}-${mois}.pdf`;
}
const MOIS_FR = [
    "janvier", "février", "mars", "avril", "mai", "juin", "juillet",
    "août", "septembre", "octobre", "novembre", "décembre",
];
const MOIS_EN = [
    "January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December",
];
/** « 2026-12 » -> « Décembre 2026 » / « December 2026 ». */
function formaterMoisTalon(mois, langue) {
    const [annee, num] = mois.split("-").map(Number);
    const noms = langue === "en" ? MOIS_EN : MOIS_FR;
    const nom = noms[num - 1] ?? mois;
    return `${nom.charAt(0).toUpperCase()}${nom.slice(1)} ${annee}`;
}
/**
 * Assemble les données du talon depuis la paie ÉMISE (instantanés) et
 * l'identité de l'employé — fonction PURE partagée par les deux
 * fournisseurs et verrouillée par les tests (les données d'entrée de
 * la génération, pas le binaire PDF).
 */
function assemblerDonneesTalonPaie(paie, employe, emisParNom) {
    return {
        employeNom: employe.nom,
        employeDisplayId: employe.display_id,
        fonction: employe.role,
        langue: employe.langue === "en" ? "en" : "fr",
        mois: paie.mois,
        montant: paie.montant,
        devise: paie.devise,
        modalites: paie.modalites,
        moyen: paie.paiement_moyen,
        destination: paie.paiement_destination,
        reference: paie.reference,
        emisParNom,
        emisLe: paie.emis_le,
    };
}
/** Tous les libellés du talon, selon la langue du compte de l'employé. */
function textesTalonPaie(d) {
    const en = d.langue === "en";
    const dateEmission = (0, contrat_employe_1.formaterDateContrat)(d.emisLe.slice(0, 10), d.langue);
    return {
        division: en
            ? "CizaImmo — a division of Ciza Group"
            : "CizaImmo — division de Ciza Group",
        titre: en ? "Pay stub" : "Talon de paie",
        employe: en ? "Employee" : "Employé",
        fonctionAdmin: "Admin",
        fonctionSuperAdmin: "Super Admin",
        fonction: en ? "Role" : "Fonction",
        moisPaie: en ? "Pay month" : "Mois de paie",
        ligneSalaire: en
            ? "Salary per engagement contract"
            : "Salaire selon contrat d'engagement",
        modalites: en ? "Terms" : "Modalités",
        totalPayer: en ? "Total to pay" : "Total à payer",
        destination: en ? "Payment destination" : "Destination de paiement",
        reference: en ? "Reference" : "Référence",
        emisPar: d.emisParNom
            ? en
                ? `Issued by ${d.emisParNom} on ${dateEmission}`
                : `Émis par ${d.emisParNom} le ${dateEmission}`
            : en
                ? `Issued on ${dateEmission}`
                : `Émis le ${dateEmission}`,
        pied: en
            ? "CizaImmo, a division of Ciza Group · Bujumbura, Burundi · infos@cizagroup.com"
            : "CizaImmo, division de Ciza Group · Bujumbura, Burundi · infos@cizagroup.com",
    };
}
// ---------------------------------------------------------------------------
// Logos de l'en-tête : les DEUX marques ensemble (décision du
// fondateur). CizaImmo : la version COMPACTE du logo v4 (même artwork
// blanc/or sur transparent, recadrée — le PNG v4 brut porte un large
// padding transparent qui rendrait le logo illisible à cette taille).
// Ciza Group : le logo transparent or posé par le correctif carte.
// Les deux PNG sont TRANSPARENTS : aucun fond blanc parasite sur le
// bandeau marine (vérifié par rastérisation, comme pour la carte).
// ---------------------------------------------------------------------------
exports.TALON_LOGO_CIZAIMMO_URL = "/cizaimmo-logo-compact.png";
exports.TALON_LOGO_CIZAGROUP_URL = "/cizagroup-logo-transparent.png";
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
        // tel quel, il gonflerait le talon à plusieurs Mo. On le
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
const NAVY = [27, 42, 74];
const GOLD = [212, 175, 55];
const NOIR = [30, 41, 59];
const GRIS = [100, 116, 139];
/**
 * Génère le PDF du talon et le retourne en base64 — téléchargement
 * par l'employé (« Ma paie ») ou par le Super Admin (historique
 * Finances). `images` peut être fourni préchargé (tests / contrôles
 * de rendu) ; sinon les logos publics sont chargés au mieux (en cas
 * d'échec, l'en-tête retombe sur le texte, patron des contrats).
 */
async function genererTalonPaiePdf(donnees, images) {
    const t = textesTalonPaie(donnees);
    const nomFichier = nomFichierTalonPaie(donnees.employeDisplayId, donnees.mois);
    const logos = images ?? {
        logoCizaImmo: await chargerImageDataUrl(exports.TALON_LOGO_CIZAIMMO_URL),
        logoCizaGroup: await chargerImageDataUrl(exports.TALON_LOGO_CIZAGROUP_URL),
    };
    const { jsPDF } = await Promise.resolve().then(() => __importStar(require("jspdf")));
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const largeur = 210;
    const marge = 18;
    const largeurTexte = largeur - marge * 2;
    let y = 0;
    // --- En-tête marine aux DEUX logos + filet or.
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, largeur, 32, "F");
    doc.setFillColor(...GOLD);
    doc.rect(0, 32, largeur, 1.6, "F");
    if (logos.logoCizaImmo) {
        // Artwork compact 820x260 : boîte 54 mm de large, hauteur ~17 mm,
        // centrée verticalement dans le bandeau — nettement lisible.
        doc.addImage(logos.logoCizaImmo, "PNG", marge, 7.4, 54, 17.1);
    }
    else {
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(19);
        doc.text("CizaImmo", marge, 14);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(201, 210, 224);
        doc.text(t.division, marge, 21);
    }
    if (logos.logoCizaGroup) {
        // Logo Ciza Group (carré 2000x2000, visuel ~1799x1375) : boîte
        // 26x26 mm à droite du bandeau — les deux marques se font face.
        doc.addImage(logos.logoCizaGroup, "PNG", largeur - marge - 26, 3, 26, 26);
    }
    // --- Titre.
    y = 46;
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(t.titre, marge, y);
    y += 4;
    doc.setFillColor(...GOLD);
    doc.rect(marge, y, 26, 1.1, "F");
    y += 10;
    // --- Identité de l'employé.
    const champ = (libelle, valeur) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(...NAVY);
        doc.text(`${libelle} :`, marge + 4, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...NOIR);
        doc.text(valeur, marge + 48, y);
        y += 6.4;
    };
    champ(t.employe, donnees.employeNom);
    if (donnees.employeDisplayId)
        champ("Display ID", donnees.employeDisplayId);
    champ(t.fonction, donnees.fonction === "super_admin" ? t.fonctionSuperAdmin : t.fonctionAdmin);
    champ(t.moisPaie, formaterMoisTalon(donnees.mois, donnees.langue));
    y += 4;
    // --- Ligne de salaire (aucune retenue modélisée : total = salaire).
    const montantTexte = `${(0, contrat_employe_1.formaterMontantContrat)(donnees.montant)} ${donnees.devise}`;
    doc.setDrawColor(...GRIS);
    doc.setLineWidth(0.3);
    doc.line(marge, y, largeur - marge, y);
    y += 8;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...NOIR);
    doc.text(t.ligneSalaire, marge + 4, y);
    doc.setFont("helvetica", "bold");
    doc.text(montantTexte, largeur - marge - doc.getTextWidth(montantTexte), y);
    y += 6;
    if (donnees.modalites) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(...GRIS);
        doc.text(`${t.modalites} : ${donnees.modalites}`, marge + 4, y);
        y += 6;
    }
    y += 2;
    doc.setFillColor(...GOLD);
    doc.rect(marge, y, largeurTexte, 0.9, "F");
    y += 9;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...NAVY);
    doc.text(t.totalPayer, marge + 4, y);
    doc.setTextColor(...NOIR);
    doc.text(montantTexte, largeur - marge - doc.getTextWidth(montantTexte), y);
    y += 12;
    // --- Destination de paiement (instantané de la paie émise).
    if (donnees.destination) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(...NAVY);
        doc.text(`${t.destination} :`, marge + 4, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        doc.setTextColor(...NOIR);
        const lignesDest = doc.splitTextToSize(donnees.destination, largeurTexte - 8);
        for (const ligne of lignesDest) {
            doc.text(ligne, marge + 4, y);
            y += 5.6;
        }
        y += 4;
    }
    if (donnees.reference) {
        champ(t.reference, donnees.reference);
        y += 2;
    }
    // --- Émission.
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...GRIS);
    doc.text(t.emisPar, marge + 4, y);
    // --- Pied entreprise sobre.
    doc.setFontSize(8.5);
    doc.setTextColor(...GRIS);
    const piedLignes = doc.splitTextToSize(t.pied, largeurTexte);
    doc.text(piedLignes, largeur / 2, 282, { align: "center" });
    return { nomFichier, contenuBase64: doc.output("datauristring").split(",")[1] };
}

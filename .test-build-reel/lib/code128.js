"use strict";
/**
 * CizaImmo — encodeur Code 128 (jeu B) PUR, sans dépendance.
 *
 * Sert à la CARTE EMPLOYÉ du pack employé (2026-11-08) : le
 * code-barres de la carte encode le Display ID de l'employé
 * (« CIM-000003 »). Jeu B : ASCII 32..126 (lettres, chiffres,
 * ponctuation — tout ce qu'un Display ID peut contenir).
 *
 * Sortie : la suite des VALEURS Code 128 (départ B = 104, symboles,
 * contrôle, arrêt = 106) et la suite des MODULES (true = barre,
 * false = espace) prête à dessiner (DOM, canvas ou rectangles PDF).
 * Chaque symbole fait 11 modules, l'arrêt 13. La table des largeurs
 * est celle de la spécification Code 128 (ISO/IEC 15417).
 *
 * Fonction pure, verrouillée par scripts/test-pack-employe.cjs
 * (vecteurs connus : sommes de contrôle calculées à la main).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CODE128_ARRET = exports.CODE128_DEPART_B = void 0;
exports.encoderCode128B = encoderCode128B;
/** Largeurs des éléments (barre/espace alternés) par valeur 0..106. */
const LARGEURS = [
    "212222", "222122", "222221", "121223", "121322", "131222", "122213",
    "122312", "132212", "221213", "221312", "231212", "112232", "122132",
    "122231", "113222", "123122", "123221", "223211", "221132", "221231",
    "213212", "223112", "312131", "311222", "321122", "321221", "312212",
    "322112", "322211", "212123", "212321", "232121", "111323", "131123",
    "131321", "112313", "132113", "132311", "211313", "231113", "231311",
    "112133", "112331", "132131", "113123", "113321", "133121", "313121",
    "211331", "231131", "213113", "213311", "213131", "311123", "311321",
    "331121", "312113", "312311", "332111", "314111", "221411", "431111",
    "111224", "111422", "121124", "121421", "141122", "141221", "112214",
    "112412", "122114", "122411", "142112", "142211", "241211", "221114",
    "413111", "241112", "134111", "111242", "121142", "121241", "114212",
    "124112", "124211", "411212", "421112", "421211", "212141", "214121",
    "412121", "111143", "111341", "131141", "114113", "114311", "411113",
    "411311", "113141", "114131", "311141", "411131", "211412", "211214",
    "211232", "2331112",
];
exports.CODE128_DEPART_B = 104;
exports.CODE128_ARRET = 106;
/** Valeur Code 128 jeu B d'un caractère (ASCII 32..126). */
function valeurCaractere(caractere) {
    const code = caractere.charCodeAt(0);
    if (code < 32 || code > 126) {
        throw new Error("ERR_CODE128_CARACTERE");
    }
    return code - 32;
}
/** Déploie une valeur en modules (barre d'abord, alternance). */
function modulesDeValeur(valeur, sortie) {
    const largeurs = LARGEURS[valeur];
    let barre = true;
    for (const chiffre of largeurs) {
        const n = Number(chiffre);
        for (let i = 0; i < n; i++)
            sortie.push(barre);
        barre = !barre;
    }
}
/**
 * Encode un texte en Code 128 jeu B, avec zones silencieuses NON
 * incluses (à ajouter au rendu : 10 modules de chaque côté en usage
 * réel — le composant de la carte s'en charge).
 */
function encoderCode128B(texte) {
    const propre = (texte ?? "").trim();
    if (!propre)
        throw new Error("ERR_CODE128_VIDE");
    const symboles = propre.split("").map(valeurCaractere);
    // Somme de contrôle : départ + Σ (valeur × position), position dès 1.
    let somme = exports.CODE128_DEPART_B;
    symboles.forEach((v, i) => {
        somme += v * (i + 1);
    });
    const controle = somme % 103;
    const valeurs = [exports.CODE128_DEPART_B, ...symboles, controle, exports.CODE128_ARRET];
    const modules = [];
    for (const v of valeurs)
        modulesDeValeur(v, modules);
    return { valeurs, modules };
}

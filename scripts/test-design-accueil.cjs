// Test — Design « Marine & Or premium » de la PAGE D'ACCUEIL
// PUBLIQUE (2026-11-08, ordre du fondateur : « il reste page
// d'accueil » — dernière surface non traitée après l'espace
// client et la console ; précisions : « Pas de hero ? » -> vrai
// héros ; règle boutons : aucun doublon de CTA).
//
// Patron appliqué, identique à celui validé par le fondateur :
//   1. VRAI HÉROS pleine largeur marine (dégradé sobre marine
//      -> marine foncé) : logo v4 dans l'en-tête, titre blanc,
//      slogan or, LE bouton d'essai unique de la page (héros,
//      libellé le plus clair des chaînes existantes, primaire
//      or), secondaire « Demander une démonstration » -> contact
//      (libellé existant contact.demoTitle), sélecteur de devise
//      visible (état PARTAGÉ avec la mini-grille via
//      components/DeviseAffichage), photo réelle Pexels en carte
//      encadrée qui chevauche la section crème suivante.
//   2. DOUBLON ÉLIMINÉ : l'en-tête masque son « Essai gratuit »
//      SUR L'ACCUEIL SEULEMENT (prop masquerEssai, défaut faux —
//      les autres pages publiques sont inchangées). Unicité de
//      l'essai vérifiée statiquement : une seule référence au
//      libellé d'essai court dans le rendu de la page (en-tête
//      conditionnel) et une seule au libellé long (héros).
//   3. Sections alternées crème #F7F5F0 / blanc, titres marine
//      SemiBold avec filet or, cartes blanches bordées au patron.
//      Boutons : système uniforme — pastilles min-h-12 (>= 48 px),
//      UN seul primaire or par section (grille : pack Pro en
//      avant marine/or, son CTA or ; packs standard en cartes
//      blanches, CTA contour marine secondaire).
//   4. Mini-grille : MÉCANIQUE INTACTE — prix des tables finance
//      (getTarifsPlateforme), taux via /api/taux/publics avec
//      DATE affichée (pricing.rateDate), jamais « en direct ».
//   5. En-tête / pied publics alignés bg-navy #1B2A4A.
//
// Aucun texte nouveau hors l'alt de la photo (heroPhotoAlt,
// FR+EN, libellé manquant pour le nouveau visuel). La clé
// landing.ctaSecondary reste définie mais n'est plus affichée
// dans le héros (remplacée par la démo). Test STATIQUE.
const fs = require("fs");
const path = require("path");

const ROOT = process.env.CIZAIMMO_SRC_ROOT || path.join(__dirname, "..");

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}
function lire(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
function occurrences(texte, motif) { return texte.split(motif).length - 1; }

const CARTE = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";

// ---------- 1. Page d'accueil : héros et structure ----------
const accueil = lire("app/[locale]/page.tsx");
check("accueil : racine crème, texte marine (plus de fond tout marine)",
  accueil.includes("min-h-screen bg-cream text-navy") && !accueil.includes("bg-navy-dark"));
check("héros : pleine largeur marine en dégradé sobre (from-navy to-navy-dark)",
  accueil.includes('<section className="bg-gradient-to-b from-navy to-navy-dark text-white">'));
check("héros : titre + slogan + sous-titre existants",
  accueil.includes('t("headline")') && accueil.includes('tb("slogan")') && accueil.includes('t("subheadline")'));
check("héros : CTA essai UNIQUE en primaire or (libellé long, le plus clair)",
  // ADAPTATION 2026-11-08 (correctif boutons une ligne) : le bouton
  // garde min-h-12 et le primaire or, mais le libellé est désormais
  // en whitespace-nowrap centré, taille réduite sur mobile
  // (text-[13px], px-4) — voir test-correctif-apropos-header.cjs.
  accueil.includes("inline-flex min-h-12 items-center justify-center whitespace-nowrap rounded-full bg-gold px-4 py-3 text-center text-[13px] font-semibold tracking-tight text-navy hover:bg-gold-light sm:px-8 sm:text-base sm:tracking-normal") &&
  accueil.includes('t("ctaTrial")') && occurrences(accueil, 't("ctaTrial")') === 1);
check("héros : secondaire = Demander une démonstration (libellé existant) -> /contact, contour clair",
  accueil.includes('tc("demoTitle")') && accueil.includes('href="/contact"') &&
  accueil.includes("border border-white/70") && accueil.includes("hover:bg-white hover:text-navy"));
check("héros : plus de bouton « Voir les tarifs » dans le héros (dédoublonnage des actions)",
  !accueil.includes('href="#tarifs"') && !accueil.includes('t("ctaSecondary")'));
check("héros : sélecteur de devise visible (composant partagé)",
  accueil.includes("<SelecteurDeviseHero />") && accueil.includes("<FournisseurDevise>"));
check("héros : photo réelle en carte encadrée, alt bilingue, prioritaire",
  accueil.includes('src="/hero-residence.jpg"') && accueil.includes('alt={t("heroPhotoAlt")}') &&
  accueil.includes("priority") && accueil.includes("rounded-2xl border border-white/40 object-cover shadow-2xl"));
check("héros : photo en chevauchement sur la section suivante (marge négative + dégagement)",
  accueil.includes("-mb-20 mt-12 md:-mb-28") && accueil.includes("pt-36") && accueil.includes("md:pt-48"));
check("héros : fichier photo présent dans public/ et poids mobile raisonnable (< 300 Ko)",
  fs.existsSync(path.join(ROOT, "public/hero-residence.jpg")) &&
  fs.statSync(path.join(ROOT, "public/hero-residence.jpg")).size < 300 * 1024);
check("accueil : ancre #tarifs conservée sur la section tarifs",
  accueil.includes('id="tarifs"'));
check("accueil : en-tête appelé avec masquerEssai (doublon d'essai éliminé à la source)",
  accueil.includes("<PublicHeader masquerEssai />"));
check("accueil : sections alternées crème / blanc présentes",
  (accueil.match(/bg-cream/g) || []).length >= 3 && (accueil.match(/bg-white/g) || []).length >= 2);
check("accueil : cartes blanches bordées au patron (fonctionnalités + bénéfices + étapes)",
  (accueil.split(CARTE).length - 1) >= 3);
check("accueil : titres de section marine SemiBold + filet or",
  accueil.includes("font-semibold text-navy") && accueil.includes("h-1 w-16 rounded-full bg-gold"));
check("accueil : aucun ancien patron marine-sur-marine (cartes bg-navy bordées navy-light)",
  !accueil.includes("bg-navy p-6 border border-navy-light") && !accueil.includes("rounded-2xl bg-navy p-6"));
check("accueil : contenu intact — mêmes clés de sections",
  accueil.includes('t("benefitsTitle")') && accueil.includes('t("howTitle")') &&
  accueil.includes('t("currenciesTitle")') && accueil.includes('t("pricing.title")') &&
  accueil.includes("<MiniGrilleTarifs />"));
check("accueil : signal multi-devises conservé (liste des devises affichée)",
  accueil.includes('t("currenciesList")'));

// ---------- 2. Devise partagée héros <-> grille ----------
const deviseCmp = lire("components/DeviseAffichage.tsx");
check("devise : contexte partagé + sélecteur héros (12 devises libellées, pastille or)",
  deviseCmp.includes("FournisseurDevise") && deviseCmp.includes("SelecteurDeviseHero") &&
  deviseCmp.includes('"$ USD"') && deviseCmp.includes('"€ EUR"') && deviseCmp.includes('"BIF"') &&
  deviseCmp.includes('id="hero-devise"') && deviseCmp.includes("border-gold"));

// ---------- 3. En-tête : masquage conditionnel de l'essai ----------
const header = lire("components/PublicHeader.tsx");
check("en-tête : prop masquerEssai (défaut faux = autres pages inchangées)",
  header.includes("masquerEssai = false") && header.includes("masquerEssai ? null"));
check("en-tête : le bouton « Essai gratuit » reste le code par défaut (ctaTrialShort)",
  header.includes('t("ctaTrialShort")') && occurrences(header, 't("ctaTrialShort")') === 1);
check("en-tête : fond marine exact #1B2A4A (bg-navy)",
  header.includes('className="bg-navy px-4 py-4 text-white sm:px-6"') && !header.includes("bg-navy-dark"));
check("en-tête : logo v4 et navigation inchangés",
  header.includes("/cizaimmo-logo-v4.png"));

// ---------- 4. Mini-grille : patron visuel, hiérarchie CTA, mécanique ----------
const grille = lire("components/MiniGrilleTarifs.tsx");
check("grille : devise lue depuis le contexte partagé (repli local conservé)",
  grille.includes("useDeviseAffichage()") && grille.includes("deviseLocale"));
check("grille : invitation devise en marine (lisible sur crème)",
  grille.includes("font-semibold text-navy") && !grille.includes("font-semibold text-white"));
check("grille : cartes blanches bordées au patron pour les packs standard",
  grille.includes('"rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"'));
check("grille : pack Pro mis en avant en marine/or (visuel seul)",
  grille.includes('vedette = plan === "pro"') && grille.includes("bg-navy p-6 text-white shadow-sm ring-1 ring-gold") &&
  grille.includes('"text-xl font-bold text-gold"'));
check("grille : prix des packs standard en marine gras",
  grille.includes('"text-xl font-bold text-navy"') && grille.includes("text-2xl font-bold"));
check("grille : UN seul primaire or dans la section — CTA or réservé au pack Pro",
  grille.includes("min-h-12 rounded-full bg-gold px-5 py-3 text-center font-semibold text-navy hover:bg-gold-light") &&
  occurrences(grille, "bg-gold px-5") === 1);
check("grille : CTA des packs standard en secondaire contour marine",
  grille.includes("min-h-12 rounded-full border border-navy bg-white px-5 py-3 text-center font-semibold text-navy hover:bg-navy hover:text-white"));
check("grille : MÉCANIQUE intacte — prix lus via la couche data (tables finance)",
  grille.includes("getTarifsPlateforme()") && grille.includes("construirePrixPlans"));
check("grille : MÉCANIQUE intacte — taux via la route publique datée, jamais « en direct »",
  grille.includes('fetch("/api/taux/publics")') && grille.includes('t("pricing.rateDate"') &&
  grille.includes("convertirPrixAffichage"));
check("grille : sélecteur de devise de section conservé (même état partagé)",
  grille.includes('id="mini-grille-devise"') && grille.includes("LIBELLES_DEVISE"));

// ---------- 5. Pied public : palette alignée ----------
const footer = lire("components/PublicFooter.tsx");
check("pied public : fond marine exact #1B2A4A (bg-navy)",
  footer.includes("bg-navy px-4 py-10") && !footer.includes("bg-navy-dark"));
check("pied public : contenu inchangé (lien site mère présent)",
  footer.includes("cizagroup.com"));

// ---------- 6. Alt bilingue de la photo ----------
const fr = JSON.parse(lire("messages/fr.json"));
const en = JSON.parse(lire("messages/en.json"));
check("i18n : heroPhotoAlt défini en FR et en EN (parité du libellé de la photo)",
  typeof fr.landing.heroPhotoAlt === "string" && fr.landing.heroPhotoAlt.length > 0 &&
  typeof en.landing.heroPhotoAlt === "string" && en.landing.heroPhotoAlt.length > 0);

console.log(`\nDesign accueil : ${ok} OK, ${ko} KO`);
process.exit(ko ? 1 : 0);

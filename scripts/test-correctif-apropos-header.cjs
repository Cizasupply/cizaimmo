// Test — Micro-correctifs des captures annotées du fondateur
// sur la page À propos mobile (2026-11-08) :
//   1. En-tête public mobile : les QUATRE liens de navigation
//      (Tarifs · Appartements à louer · À propos · Contact) sur
//      UNE SEULE ligne, au même niveau — avant, « Contact »
//      tombait sur une deuxième ligne (flex-wrap). Nav en
//      flex-nowrap, taille (text-xs) et espacements réduits sur
//      mobile, liens en whitespace-nowrap, aucun débordement ;
//      bureau (xl) strictement inchangé (xl:gap-x-5, sm:text-sm,
//      sm:px-1 = valeurs d'origine à partir de sm).
//   2. Boutons CTA publics au libellé long (héros de l'accueil,
//      CTA final de l'accueil = héros, et CTA final À propos) :
//      libellé CENTRÉ et sur UNE SEULE ligne — avant, « Commencer
//      l'essai gratuit de 30 jours » cassait (« jours » en dessous,
//      texte à gauche). Patron : whitespace-nowrap + text-center +
//      taille responsive (text-[13px] tracking-tight, px-4 sur
//      mobile ; sm:text-base, sm:px-8 ensuite), hauteur du système
//      inchangée (min-h-12). FR et EN vérifiés par budget largeur.
//   3. Ligne entreprise/contact de la page À propos : le texte
//      VALIDÉ (about.companyLine, inchangé caractère pour
//      caractère) est rendu par SEGMENTS séparés par « · » —
//      l'e-mail et « WhatsApp +1 514 502 9503 » en spans
//      whitespace-nowrap : les retours à la ligne ne se font
//      qu'ENTRE segments, jamais dans l'e-mail ni dans le numéro
//      (avant, le numéro cassait : « +1 514 / 502 9503 »).
// Test STATIQUE (fichiers sources + JSON de messages) + budgets
// de largeur estimés (largeur moyenne d'un glyphe SemiBold
// ≈ 0,56 × taille de police — marge incluse).
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
function bloc(texte, debut, fin) {
  const a = texte.indexOf(debut);
  const b = a < 0 ? -1 : texte.indexOf(fin, a);
  return a < 0 || b < 0 ? "" : texte.slice(a, b + fin.length);
}

const fr = JSON.parse(lire("messages/fr.json"));
const en = JSON.parse(lire("messages/en.json"));

// ---------- 1. En-tête public : navigation sur UNE ligne (mobile) ----------
const header = lire("components/PublicHeader.tsx");
const nav = bloc(header, "<nav", "</nav>");
check("en-tête : la balise <nav> existe et est extraite", nav.length > 0);
check("nav : flex-nowrap (plus AUCUN retour à la ligne des liens)",
  nav.includes("flex-nowrap") && !nav.includes("flex-wrap"));
check("nav : taille réduite sur mobile (text-xs) puis text-sm dès sm (origine)",
  nav.includes("text-xs") && nav.includes("sm:text-sm"));
check("nav : espacements resserrés sur mobile (gap-x-2, sm:gap-x-4)",
  nav.includes("gap-x-2") && nav.includes("sm:gap-x-4"));
check("nav : bureau inchangé — écart xl d'origine (xl:gap-x-5) et ordre (xl:order-2)",
  nav.includes("xl:gap-x-5") && nav.includes("xl:order-2"));
check("nav : les 4 liens sont en whitespace-nowrap (aucun libellé coupé)",
  occurrences(nav, "whitespace-nowrap") === 4);
check("nav : les 4 destinations sont présentes (tarifs, a-louer, a-propos, contact)",
  nav.includes('href="/tarifs"') && nav.includes('href="/a-louer"') &&
  nav.includes('href="/a-propos"') && nav.includes('href="/contact"'));
check("nav : padding des liens réduit sur mobile (px-0.5) puis d'origine (sm:px-1)",
  occurrences(nav, "px-0.5") === 4 && occurrences(nav, "sm:px-1") === 4);
// Budget largeur 360 px (pire cas) : conteneur = 360 − 2×16 (px-4 de
// l'en-tête) = 328 px. Texte FR (le plus long) à 12 px SemiBold
// ≈ 0,56 × 12 = 6,7 px/car. + 3 écarts gap-x-2 (8 px) + padding des
// liens 4 × 2×2 px (px-0.5).
const libellesNav = [fr.nav.pricing, fr.landing.navRent, fr.nav.about, fr.nav.contact];
const largeurNav = libellesNav.join("").length * 6.7 + 3 * 8 + 4 * 4;
check("nav : budget largeur FR à 360 px — les 4 liens tiennent sur une ligne",
  largeurNav <= 328, `estimé=${Math.round(largeurNav)} px pour 328 px dispo`);
const libellesNavEn = [en.nav.pricing, en.landing.navRent, en.nav.about, en.nav.contact];
check("nav : budget largeur EN à 360 px — tient aussi sur une ligne",
  libellesNavEn.join("").length * 6.7 + 3 * 8 + 4 * 4 <= 328);
check("en-tête : le reste est inchangé (masquerEssai, conteneur xl:flex-nowrap)",
  header.includes("masquerEssai = false") && header.includes("xl:flex-nowrap"));

// ---------- 2. Boutons CTA : libellé centré, UNE ligne ----------
const accueil = lire("app/[locale]/page.tsx");
const apropos = lire("app/[locale]/a-propos/page.tsx");
const PATRON_BOUTON = ["whitespace-nowrap", "text-center", "text-[13px]", "sm:text-base", "sm:px-8", "min-h-12", "tracking-tight"];
function checkBouton(nom, source, marqueur) {
  const b = bloc(source, marqueur === "ctaTrial" ? 'href="/inscription"' : 'href="/contact"', "</Link>");
  check(`${nom} : bouton présent`, b.length > 0);
  check(`${nom} : libellé sur UNE ligne, centré, taille responsive (hauteur min-h-12 inchangée)`,
    PATRON_BOUTON.every((c) => b.includes(c)));
}
checkBouton("accueil héros — essai (or)", accueil, "ctaTrial");
checkBouton("accueil héros — démo (contour clair)", accueil, "demo");
checkBouton("à propos final — essai (or)", apropos, "ctaTrial");
checkBouton("à propos final — démo (contour marine)", apropos, "demo");
check("boutons : aucun CTA au libellé long sans le patron une-ligne (héros + finaux)",
  occurrences(accueil, "whitespace-nowrap") >= 2 && occurrences(apropos, "whitespace-nowrap") >= 3);
// Budget largeur 360 px : bouton pleine largeur dans un conteneur
// px-6 -> 312 px ; padding bouton px-4 x2 = 32 px -> 280 px utiles.
// Libellé FR « Commencer l'essai gratuit de 30 jours » à 13 px
// SemiBold resserré (tracking-tight) ≈ 7,0 px/car.
check("boutons : budget largeur FR à 360 px — le libellé d'essai tient sur une ligne",
  fr.landing.ctaTrial.length * 7.0 <= 280,
  `libellé=${fr.landing.ctaTrial.length} car., estimé=${Math.round(fr.landing.ctaTrial.length * 7.0)} px pour 280 px utiles`);
check("boutons : budget largeur EN à 360 px — « Start the free 30-day trial » tient aussi",
  en.landing.ctaTrial === "Start the free 30-day trial" &&
  en.landing.ctaTrial.length * 7.0 <= 280);
check("boutons : les libellés eux-mêmes sont inchangés (FR validé + EN)",
  fr.landing.ctaTrial === "Commencer l'essai gratuit de 30 jours" &&
  fr.contact.demoTitle === "Demander une démonstration" && en.contact.demoTitle === "Request a demo");

// ---------- 3. Ligne entreprise À propos : segments insécables ----------
check("ligne entreprise : rendue par segments (split sur « · »)",
  apropos.includes('t("companyLine")') && apropos.includes('.split(" · ")'));
check("ligne entreprise : segments de contact en span whitespace-nowrap",
  apropos.includes('<span className="whitespace-nowrap">{segment}</span>'));
const LIGNE_FR = "CizaImmo, division de CIZA GROUP SURL — Bujumbura, Burundi · infos@cizagroup.com · WhatsApp +1 514 502 9503";
const LIGNE_EN = "CizaImmo, a division of CIZA GROUP SURL — Bujumbura, Burundi · infos@cizagroup.com · WhatsApp +1 514 502 9503";
check("ligne entreprise : texte FR inchangé, caractère pour caractère (égalité exacte)",
  fr.about.companyLine === LIGNE_FR);
check("ligne entreprise : texte EN inchangé, caractère pour caractère (égalité exacte)",
  en.about.companyLine === LIGNE_EN);
const segments = LIGNE_FR.split(" · ");
check("ligne entreprise : 3 segments — société / e-mail / WhatsApp",
  segments.length === 3 && segments[1] === "infos@cizagroup.com");
check("ligne entreprise : le numéro complet « +1 514 502 9503 » vit dans UN seul segment insécable",
  segments[2] === "WhatsApp +1 514 502 9503" && segments[2].includes("502 9503"));

console.log(`\nCorrectif À propos / en-tête : ${ok} OK, ${ko} KO`);
process.exit(ko ? 1 : 0);

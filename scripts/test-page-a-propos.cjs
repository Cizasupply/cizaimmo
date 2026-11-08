// Test — Page publique « À propos » (2026-11-08, demande du
// fondateur : « Apropos aussi », puis TEXTE VALIDÉ MOT POUR MOT
// par lui avant création ; photo : décision finale = PHOTO DU
// FONDATEUR, déjà publique dans l'app Ciza Group, avec légende).
//
// Verrouille :
//   1. La route /a-propos existe et suit le patron public
//      (en-tête masquerEssai — même règle anti-doublon que
//      l'accueil — pied partagé, héros marine, sections
//      alternées crème/blanc, titres marine SemiBold + filet or).
//   2. Le héros porte la PHOTO DU FONDATEUR en carte encadrée
//      blanche en chevauchement, avec sa LÉGENDE sous la photo ;
//      aucune photo de résidence sur cette page (ni celle de
//      l'accueil ni une autre).
//   3. Le TEXTE VALIDÉ FR est présent À L'IDENTIQUE dans
//      messages/fr.json (égalité exacte, bloc par bloc) et le
//      namespace « about » est en parité stricte FR/EN.
//   4. Le CTA final est UNIQUE (un seul primaire or, libellé
//      existant landing.ctaTrial -> /inscription ; secondaire
//      démo existant contact.demoTitle -> /contact) et la ligne
//      entreprise validée est affichée.
//   5. Le lien « À propos » (nav.about) est présent dans
//      l'en-tête public ET dans le pied public.
// Test STATIQUE (fichiers sources + JSON de messages).
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
function clesFeuilles(d, prefixe = "") {
  const out = new Set();
  for (const [k, v] of Object.entries(d)) {
    const p = prefixe ? `${prefixe}.${k}` : k;
    if (v && typeof v === "object") for (const s of clesFeuilles(v, p)) out.add(s);
    else out.add(p);
  }
  return out;
}

const CARTE = "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";

// ---------- 1. Route et structure ----------
const ROUTE = "app/[locale]/a-propos/page.tsx";
check("route : app/[locale]/a-propos/page.tsx existe", fs.existsSync(path.join(ROOT, ROUTE)));
const page = lire(ROUTE);
check("page : racine crème, texte marine (patron public)",
  page.includes("min-h-screen bg-cream text-navy"));
check("page : en-tête public avec masquerEssai (anti-doublon, comme l'accueil)",
  page.includes("<PublicHeader masquerEssai />"));
check("page : pied public partagé", page.includes("<PublicFooter />"));
check("héros : pleine largeur marine en dégradé sobre (from-navy to-navy-dark)",
  page.includes('<section className="bg-gradient-to-b from-navy to-navy-dark text-white">'));
check("héros : titre de la page (about.title) + slogan de marque",
  page.includes('t("title")') && page.includes('tb("slogan")'));

// ---------- 2. Photo du fondateur + légende ----------
check("héros : photo du fondateur (fondateur-ceo.jpg), alt du namespace, prioritaire",
  page.includes('src="/fondateur-ceo.jpg"') && page.includes('alt={t("heroPhotoAlt")}') &&
  page.includes("priority"));
check("héros : carte encadrée blanche en chevauchement (marge négative + figure)",
  page.includes("<figure") && page.includes("-mb-20 mt-12") && page.includes("md:-mb-28") &&
  page.includes("bg-white p-2 shadow-2xl"));
check("héros : LÉGENDE sous la photo (about.founderCaption en figcaption)",
  page.includes("<figcaption") && page.includes('t("founderCaption")'));
check("héros : AUCUNE photo de résidence sur cette page",
  !page.includes("hero-residence") && !page.includes("apropos-residence"));
const photoPath = path.join(ROOT, "public/fondateur-ceo.jpg");
check("photo : fichier présent dans public/ et poids <= ~250 Ko",
  fs.existsSync(photoPath) && fs.statSync(photoPath).size <= 250 * 1024,
  fs.existsSync(photoPath) ? `poids=${fs.statSync(photoPath).size}` : "absente");
check("photo : différente de celle de l'accueil (contenus distincts)",
  fs.existsSync(photoPath) &&
  !fs.readFileSync(photoPath).equals(fs.readFileSync(path.join(ROOT, "public/hero-residence.jpg"))));

// ---------- 3. Sections et blocs du texte validé ----------
check("sections : les 4 titres de blocs sont rendus (who/problem/platform/commitment)",
  page.includes('t("whoTitle")') && page.includes('t("problemTitle")') &&
  page.includes('t("platformTitle")') && page.includes('t("commitmentTitle")'));
check("sections : les textes des blocs 1 et 2 sont rendus",
  page.includes('t("whoText")') && page.includes('t("problemText")'));
check("sections : alternance crème / blanc + cartes bordées au patron",
  (page.match(/bg-cream/g) || []).length >= 2 && (page.match(/bg-white/g) || []).length >= 2 &&
  page.includes(CARTE));
check("sections : titres marine SemiBold + filet or",
  page.includes("font-semibold text-navy") && page.includes("h-1 w-16 rounded-full bg-gold"));
check("bloc plateforme : liste de 8 éléments en cartes à puces (items.item1..item8)",
  page.includes("items.${k}") && occurrences(page, '"item') >= 8 &&
  page.includes('className="mt-8 grid gap-4 sm:grid-cols-2"'));
check("bloc engagement : carte MARINE mise en valeur (bg-navy)",
  page.includes("rounded-2xl bg-navy p-6 text-white shadow-sm md:p-10"));
check("bloc engagement : texte riche avec le gras <gras> (n'encaisse jamais vos loyers)",
  page.includes('t.rich("commitmentText"') && page.includes("gras:") &&
  page.includes("font-bold text-gold"));

// ---------- 4. CTA final unique + ligne entreprise ----------
check("cta : UN SEUL primaire or (libellé existant landing.ctaTrial -> /inscription)",
  occurrences(page, 'tl("ctaTrial")') === 1 && page.includes('href="/inscription"') &&
  page.includes("rounded-full bg-gold px-8 py-3 font-semibold text-navy hover:bg-gold-light"));
check("cta : secondaire = Demander une démonstration (libellé existant) -> /contact, contour marine",
  page.includes('tc("demoTitle")') && page.includes('href="/contact"') &&
  page.includes("border border-navy"));
check("cta : aucun libellé d'essai court en plus (pas de doublon ctaTrialShort)",
  !page.includes("ctaTrialShort"));
check("pied de page de la page : ligne entreprise validée affichée (about.companyLine)",
  page.includes('t("companyLine")'));

// ---------- 5. Lien « À propos » : en-tête + pied publics ----------
const header = lire("components/PublicHeader.tsx");
check("en-tête : lien /a-propos avec le libellé nav.about",
  header.includes('href="/a-propos"') && header.includes('tn("about")'));
const footer = lire("components/PublicFooter.tsx");
check("pied public : lien /a-propos avec le libellé nav.about",
  footer.includes('href="/a-propos"') && footer.includes('tn("about")'));

// ---------- 6. i18n : parité + texte validé FR à l'identique ----------
const fr = JSON.parse(lire("messages/fr.json"));
const en = JSON.parse(lire("messages/en.json"));
check("i18n : nav.about = « À propos » (FR) / « About » (EN)",
  fr.nav.about === "À propos" && en.nav.about === "About");
const kf = clesFeuilles(fr.about || {});
const ke = clesFeuilles(en.about || {});
check("i18n : namespace « about » en parité stricte FR/EN",
  kf.size > 0 && kf.size === ke.size && [...kf].every((k) => ke.has(k)),
  `FR=${kf.size} EN=${ke.size}`);
const A = fr.about;
check("texte validé FR : titre + slogan de bloc (égalité exacte)",
  A.title === "À propos de CizaImmo");
check("texte validé FR : bloc « Qui sommes-nous » (égalité exacte)",
  A.whoTitle === "Qui sommes-nous" &&
  A.whoText === "CizaImmo est la plateforme de gestion immobilière de Ciza Group. Nous aidons les propriétaires et les gestionnaires à suivre leurs immeubles, leurs locataires et leurs loyers depuis un seul endroit — au bureau, à la maison ou depuis l'étranger. La plateforme fonctionne en français et en anglais, en plusieurs devises, sur téléphone comme sur ordinateur.");
check("texte validé FR : bloc « Le problème que nous réglons » (égalité exacte)",
  A.problemTitle === "Le problème que nous réglons" &&
  A.problemText === "Gérer des biens à la main — cahiers, reçus éparpillés, retards découverts trop tard — fait perdre du temps et de l'argent. Et quand on vit loin de ses immeubles, tout devient plus compliqué. CizaImmo met de l'ordre dans la gestion : chaque immeuble, chaque porte, chaque bail et chaque paiement au même endroit, avec des alertes avant que les problèmes n'arrivent.");
check("texte validé FR : bloc « Ce que fait la plateforme » — la liste jointe par « · » est exacte",
  A.platformTitle === "Ce que fait la plateforme" &&
  ["item1", "item2", "item3", "item4", "item5", "item6", "item7", "item8"].map((k) => A.items[k]).join(" · ") ===
  "Immeubles et appartements · Locataires et baux · Suivi des loyers et reçus PDF · Alertes de retard · Dépenses et rentabilité de chaque bien · Documents conservés au dossier · 12 devises, dont le franc burundais, l'euro et le dollar · Annonces vérifiées pour les biens à louer");
check("texte validé FR : bloc « Notre engagement » (égalité exacte, gras <gras> sur « n'encaisse jamais vos loyers »)",
  A.commitmentTitle === "Notre engagement" &&
  A.commitmentText === "CizaImmo <gras>n'encaisse jamais vos loyers</gras> : notre seul revenu, c'est l'abonnement. La plateforme enregistre les paiements que vous déclarez — votre argent reste entre vos mains. Chaque compte est vérifié par notre équipe avant son activation, et vos données restent les vôtres.");
check("texte validé FR : ligne entreprise + légende fondateur (égalité exacte)",
  A.companyLine === "CizaImmo, division de CIZA GROUP SURL — Bujumbura, Burundi · infos@cizagroup.com · WhatsApp +1 514 502 9503" &&
  A.founderCaption === "Ciza Misigaro — Fondateur & CEO, Ciza Group");
check("i18n EN : légende fondateur exacte + engagement fidèle (never collects your rents, en gras)",
  en.about.founderCaption === "Ciza Misigaro — Founder & CEO, Ciza Group" &&
  en.about.commitmentText.includes("<gras>never collects your rents</gras>") &&
  en.about.title === "About CizaImmo");
check("i18n : alt de la photo du fondateur défini en FR et en EN",
  typeof A.heroPhotoAlt === "string" && A.heroPhotoAlt.includes("Ciza Misigaro") &&
  typeof en.about.heroPhotoAlt === "string" && en.about.heroPhotoAlt.includes("Ciza Misigaro"));

console.log(`\nPage À propos : ${ok} OK, ${ko} KO`);
process.exit(ko ? 1 : 0);

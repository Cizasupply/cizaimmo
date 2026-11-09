// Test — Organisation desktop « ultra premium » des pages console
// (2026-11-08, ordre du fondateur sur captures bureau : trop
// d'espace vide sur écran large — cartes étirées pleine largeur,
// contenu collé à gauche).
//
// Traitement, DESKTOP SEULEMENT (préfixes lg:/xl:) :
//   1. ConsoleShell : contenu plafonné à 1600 px centré (md+),
//      coque mobile h-dvh et barre inférieure dans le flux
//      INCHANGÉES.
//   2. Dossier client : grille xl 3 colonnes — zone principale
//      (2 colonnes dès lg ; Identité large : photo à gauche,
//      définitions en 2 colonnes en xl ; Immeubles en cartes) +
//      Historique en colonne latérale timeline (sticky).
//   3. Finances : totaux en tuiles de statistiques (xl), lignes
//      de paie en grille xl 2 colonnes, dépenses = liste 2/3 +
//      formulaire 1/3 sticky (xl, ordre DOM inchangé).
//   4. Mon dossier employé : grilles xl 2 colonnes
//      (Identité | Adresse ; Coordonnées | Charte+Contrat ;
//      Carte centrée | Ma paie).
//   5. Vue d'ensemble : KPI 4 colonnes (existant) + Messages et
//      Activité récente côte à côte en xl.
//   6. Équipe : cartes membres en grille xl 2 colonnes,
//      formulaires côte à côte. Vérifier un employé : page
//      élargie, recherche/liste | fiche en xl. Messages console :
//      cartes en grille xl 2 colonnes.
//   7. Bordures de cartes teintées OR à 40 % (Marine & Or) via
//      les constantes CARTE et les patrons de cartes des pages —
//      le slate très pâle disparaît des cartes neutres ; les
//      bordures d'état (ambre/rouge/vert) sont inchangées.
//
// Test STATIQUE (lecture des sources) : présence des classes de
// grille bureau sur les sections ciblées ET présence des classes
// de base non préfixées (branches mobiles structurellement
// identiques). Aucune logique, donnée, route, libellé ni règle
// de périmètre par rôle n'est touché par la passe.
const fs = require("fs");
const path = require("path");

const ROOT = process.env.CIZAIMMO_SRC_ROOT || path.join(__dirname, "..");

let ok = 0, ko = 0;
function check(nom, cond, detail = "") {
  if (cond) { ok++; console.log(`  OK  ${nom}`); }
  else { ko++; console.log(`  KO  ${nom} ${detail}`); }
}
function lire(rel) { return fs.readFileSync(path.join(ROOT, rel), "utf8"); }
function contient(src, extrait) { return src.includes(extrait); }
function compte(src, extrait) { return src.split(extrait).length - 1; }

// ---------- 1. ConsoleShell : conteneur bureau, coque mobile intacte ----------
const shell = lire("components/ConsoleShell.tsx");
check("Shell : contenu plafonné 1600 px centré (md+)", contient(shell, "md:max-w-[1600px]"));
check("Shell : coque mobile h-dvh inchangée", contient(shell, "h-dvh"));
check("Shell : décalage sidebar bureau inchangé", contient(shell, "md:ml-60"));
check("Shell : barre inférieure mobile dans le flux (md:hidden conservé)", contient(shell, "md:hidden"));

// ---------- 2. Dossier client ----------
const dossier = lire("app/[locale]/console/comptes/[id]/page.tsx");
check("Dossier : grille bureau xl 3 colonnes", contient(dossier, "grid grid-cols-1 gap-6 xl:grid-cols-3"));
check("Dossier : zone principale 2 colonnes dès lg", contient(dossier, "content-start gap-6 lg:grid-cols-2"));
check("Dossier : Identité large (lg:col-span-2)", compte(dossier, "lg:col-span-2") >= 2);
check("Dossier : définitions Identité en 2 colonnes (xl)", contient(dossier, "xl:grid xl:grid-cols-2 xl:gap-x-8"));
check("Dossier : photo + informations côte à côte (lg:flex)", contient(dossier, "lg:flex lg:items-start lg:gap-6"));
check("Dossier : Immeubles en cartes (lg)", contient(dossier, "lg:grid lg:grid-cols-2 lg:gap-3"));
check("Dossier : Historique timeline latérale (xl:border-l + sticky)", contient(dossier, "xl:border-l") && contient(dossier, "xl:sticky xl:top-6"));
check("Dossier : bordures de sections teintées or", compte(dossier, "border-gold/40") >= 7);

// ---------- 3. Finances plateforme ----------
const fin = lire("app/[locale]/console/finances-plateforme/page.tsx");
check("Finances : patron CARTE teinté or", contient(fin, 'const CARTE = "rounded-2xl border border-gold/40 bg-white p-5 shadow-sm"'));
check("Finances : totaux en tuiles statistiques (xl 3 colonnes)", contient(fin, "xl:grid xl:grid-cols-3 xl:gap-2 xl:space-y-0"));
check("Finances : lignes de paie en grille xl 2 colonnes", contient(fin, "xl:grid xl:grid-cols-2 xl:gap-3 xl:space-y-0"));
check("Finances : dépenses liste 2/3 + formulaire 1/3 (xl:order)", contient(fin, "xl:order-2") && contient(fin, "xl:order-1 xl:col-span-2"));
check("Finances : formulaire sticky en colonne latérale", contient(fin, "xl:sticky xl:top-6 xl:grid-cols-1"));
check("Finances : racine mobile inchangée (pile space-y-5)", contient(fin, '<div className="space-y-5">'));

// Équilibrage bureau Finances (captures du fondateur, 2026-11-08) :
// la page restait déséquilibrée — carte de paie unique en
// demi-cellule avec un grand vide à droite (vue Admin), liste de
// dépenses vide laissant un vaste blanc pendant que le formulaire
// flottait étroit à l'extrême droite. Traitement xl seulement.
check("Équilibrage Finances : vue Admin — paie 7/12 | historique 5/12 côte à côte (grille xl 12 colonnes)",
  contient(fin, "xl:grid xl:grid-cols-12 xl:items-start xl:gap-6") &&
  contient(fin, "min-w-0 xl:col-span-7") && contient(fin, "min-w-0 xl:col-span-5"));
check("Équilibrage Finances : titre historique Admin aligné sur le haut de la carte paie (xl:mt-4)",
  contient(fin, "tracking-wide text-slate-500 xl:mt-4"));
check("Équilibrage Finances : vue Admin — lignes de paie en pile pleine colonne (pas de grille xl)",
  contient(fin, ': "mt-4 space-y-3"'));
check("Équilibrage Finances : singleton paie Super Admin en pleine largeur (xl:col-span-2 conditionnel)",
  contient(fin, "estSuper && (vue?.lignes_paie.length ?? 0) === 1") &&
  contient(fin, '" xl:col-span-2"'));
check("Équilibrage Finances : proportions dépenses par rôle (Super grille 3, Admin grille 5)",
  contient(fin, 'estSuper ? "xl:grid-cols-3" : "xl:grid-cols-5"'));
check("Équilibrage Finances : dépenses Admin — liste 3/5, formulaire 2/5",
  contient(fin, "xl:order-1 xl:col-span-3 min-w-0") &&
  contient(fin, "xl:order-2 xl:col-span-2 min-w-0"));
check("Équilibrage Finances : formulaire = panneau latéral teinté (xl : crème, bordure or/40, arrondi, padding)",
  contient(fin, "xl:rounded-2xl xl:border xl:border-gold/40 xl:bg-cream xl:p-5"));
check("Équilibrage Finances : état vide des dépenses centré verticalement (grille stretch + colonne flex + flex-1)",
  contient(fin, "xl:items-stretch") &&
  contient(fin, "xl:flex xl:flex-1 xl:items-center xl:justify-center"));
check("Équilibrage Finances : totaux — une seule devise = carte pleine largeur (pas de tiers de grille vide)",
  contient(fin, "vue.totaux.length === 1") && contient(fin, '"mt-3 grid gap-3"'));
check("Équilibrage Finances : mobile intact — base du formulaire sans préfixe conservée",
  contient(fin, 'className="grid gap-3 md:grid-cols-2 xl:sticky'));

// ---------- 4. Mon dossier employé ----------
const monDossier = lire("app/[locale]/console/mon-dossier/page.tsx");
check("Mon dossier : patron CARTE teinté or", contient(monDossier, 'const CARTE = "rounded-2xl border border-gold/40 bg-white p-5 shadow-sm"'));
check("Mon dossier : grilles xl 2 colonnes (au moins 2 zones)", compte(monDossier, "xl:grid xl:grid-cols-2 xl:items-start xl:gap-5 xl:space-y-0") >= 2);
check("Mon dossier : base mobile conservée dans les grilles", contient(monDossier, '"space-y-5 xl:grid xl:grid-cols-2'));
check("Mon dossier : carte employé centrée en xl", contient(monDossier, "xl:flex xl:justify-center"));
check("Mon dossier : racine mobile inchangée (pile space-y-5)", contient(monDossier, '<div className="space-y-5">'));

// ---------- 5. Vue d'ensemble ----------
const vue = lire("app/[locale]/console/page.tsx");
check("Vue d'ensemble : bande KPI 4 colonnes (lg) conservée", contient(vue, "lg:grid-cols-4"));
check("Vue d'ensemble : Messages | Activité côte à côte (xl)", contient(vue, "xl:order-2") && contient(vue, "xl:order-1 xl:col-span-2"));
check("Vue d'ensemble : file d'attente empilée sous Messages", contient(vue, "space-y-8 xl:space-y-6"));
check("Vue d'ensemble : cartes KPI teintées or", contient(vue, "border-gold/40"));

// ---------- 6. Équipe / Vérifier / Messages / Journal / Vitrine ----------
const equipe = lire("app/[locale]/console/admins/page.tsx");
check("Équipe : cartes membres en grille xl 2 colonnes", contient(equipe, "xl:grid xl:grid-cols-2 xl:items-start xl:gap-4 xl:space-y-0"));
check("Équipe : formulaires côte à côte (xl)", contient(equipe, "xl:grid xl:grid-cols-2 xl:items-start xl:gap-6"));

const verifier = lire("app/[locale]/console/verifier-employe/page.tsx");
check("Vérifier : page élargie en xl seulement", contient(verifier, "max-w-2xl xl:max-w-6xl"));
check("Vérifier : recherche/liste | fiche en xl 2 colonnes", contient(verifier, "xl:grid xl:grid-cols-2 xl:items-start xl:gap-5"));

const messages = lire("app/[locale]/console/messages/page.tsx");
check("Messages : cartes en grille xl 2 colonnes, pile mobile conservée", contient(messages, "mt-6 space-y-3 xl:grid xl:grid-cols-2 xl:items-start xl:gap-4 xl:space-y-0"));

const journal = lire("app/[locale]/console/journal/page.tsx");
check("Journal : tableau pleine largeur conservé (min-w-720)", contient(journal, "min-w-[720px]"));
check("Journal : pagination inchangée", contient(journal, "pagination.totalPages"));
check("Journal : cartes teintées or", contient(journal, "border-gold/40"));

const vitrine = lire("app/[locale]/console/vitrine/page.tsx");
check("Vitrine : cartes teintées or (structure dense inchangée)", contient(vitrine, "border-gold/40"));

// ---------- 7. Espace client : DossierBloc ----------
const dossierBloc = lire("components/DossierBloc.tsx");
check("DossierBloc client : bordure teintée or, structure inchangée", contient(dossierBloc, "rounded-xl border border-gold/40 p-3"));

// ---------- 8. Correctif grille Dossier (captures bureau du
// fondateur, 2026-11-08) : la passe desktop avait laissé la zone
// principale SANS xl:col-span-2 dans la grille xl 3 colonnes —
// affamée au tiers de la largeur, ses cartes internes (grille lg
// 2 colonnes) tombaient à ~1/6 de page : « Immeubles » rendu
// lettre par lettre, paires de définitions chevauchées, dates
// cassées. Correctif : col-span retrouvé, items de grille en
// min-w-0 partout, valeurs atomiques en whitespace-nowrap. Même
// famille balayée sur Finances, Mon dossier, Équipe, Vérifier et
// Vue d'ensemble. ----------
check("Correctif Dossier : zone principale xl:col-span-2 + min-w-0",
  contient(dossier, "lg:grid-cols-2 xl:col-span-2 min-w-0"));
check("Correctif Dossier : Immeubles pleine largeur de la zone (lg:col-span-2, 3 sections larges)",
  compte(dossier, "lg:col-span-2") >= 3);
check("Correctif Dossier : lignes de définitions réductibles (min-w-0, 12 lignes)",
  compte(dossier, "gap-y-0.5 min-w-0") === 12);
check("Correctif Dossier : téléphone en nowrap (valeur atomique)",
  contient(dossier, '<dd className="min-w-0 whitespace-nowrap text-right">{compte.telephone'));
check("Correctif Dossier : dates documents en nowrap (2 listes)",
  compte(dossier, '<span className="whitespace-nowrap">{formatDate(d.created_at, locale)}</span>') === 2);
check("Correctif Dossier : cartes immeuble réductibles (min-w-0, 2 listes)",
  compte(dossier, "lg:p-3 min-w-0") === 2);
check("Correctif Dossier : sections items de grille en min-w-0",
  compte(dossier, "bg-white p-5 min-w-0") >= 4 &&
  contient(dossier, "lg:col-span-2 min-w-0") && contient(dossier, "xl:self-start min-w-0"));

check("Correctif Finances : colonnes dépenses xl réductibles (min-w-0)",
  contient(fin, "xl:order-1 xl:col-span-2 min-w-0") && contient(fin, "xl:order-2 xl:col-span-1 min-w-0"));
check("Correctif Finances : tuiles des totaux réductibles + montants nowrap",
  compte(fin, "xl:p-2.5 min-w-0") === 3 &&
  compte(fin, "xl:text-base whitespace-nowrap") === 3 &&
  contient(fin, 'key={t.devise} className="rounded-xl border border-slate-200 p-3 min-w-0"'));

check("Correctif Mon dossier : sections items des grilles xl en min-w-0 (8)",
  compte(monDossier, "${CARTE} min-w-0") === 8);
check("Correctif Mon dossier : sous-cartes Identité (photo/pièce) en min-w-0 (2)",
  compte(monDossier, "rounded-xl border border-slate-200 p-3 min-w-0") === 2);

const admins = lire("app/[locale]/console/admins/page.tsx");
check("Correctif Équipe : items de la grille détail dossier en min-w-0 (5)",
  compte(admins, '<div className="min-w-0">') >= 4 && contient(admins, "min-w-0 md:col-span-2"));
check("Correctif Équipe : sections formulaires côte à côte en min-w-0",
  contient(admins, "bg-white p-5 min-w-0") && contient(admins, "xl:mt-0 min-w-0"));

check("Correctif Vérifier : colonnes xl réductibles (min-w-0)",
  contient(verifier, 'xl:gap-5">\n      <div className="min-w-0">') &&
  contient(verifier, "xl:mt-5 xl:space-y-5 min-w-0"));
check("Correctif Vue d'ensemble : colonnes xl réductibles (min-w-0)",
  contient(vue, "space-y-8 xl:space-y-6 min-w-0") && contient(vue, "xl:mt-0 min-w-0"));

// ---------------------------------------------------------------------------
// Bandeau de titre marine (2026-11-08, ordre du fondateur : « Donne
// le fond d'écran au titre ») — la zone d'en-tête des pages console
// repose sur le composant PARTAGÉ BandeauPage (fond marine #1B2A4A,
// coins arrondis, bordure or/40 assortie aux cartes) au lieu du fond
// crème : titre en blanc, méta/sous-titre en slate-300, accents or.
// Aucune structure de grille ajoutée par le bandeau (le mobile garde
// sa structure ; seule la teinte de la zone titre change).
const bandeau = lire("components/BandeauPage.tsx");
check("Bandeau : composant partagé — marine, bordure or/40, arrondi, texte blanc",
  contient(bandeau, "rounded-2xl border border-gold/40 bg-navy") &&
  contient(bandeau, "text-white shadow-sm"));
check("Bandeau : aucune structure de grille/bureau dans le composant (cosmétique)",
  !contient(bandeau, "grid") && !contient(bandeau, "xl:") && !contient(bandeau, "lg:"));

const comptesListe = lire("app/[locale]/console/comptes/page.tsx");
const financesParametres = lire("app/[locale]/console/finances/page.tsx");
const mesDossiers = lire("app/[locale]/console/mes-dossiers/page.tsx");
const gestionnaires = lire("app/[locale]/console/gestionnaires/page.tsx");
const messagesSupervises = lire("app/[locale]/console/messages-supervises/page.tsx");
const suppressions = lire("app/[locale]/console/suppressions/page.tsx");
const supervision = lire("app/[locale]/console/supervision/[rattachementId]/page.tsx");

const pagesBandeau = [
  ["Dossier client", dossier],
  ["Finances plateforme", fin],
  ["Mon dossier employé", monDossier],
  ["Équipe", equipe],
  ["Vérifier un employé", verifier],
  ["Journal d'audit", journal],
  ["Messages", messages],
  ["Messages supervisés", messagesSupervises],
  ["Vitrine (supervision)", vitrine],
  ["Mes dossiers", mesDossiers],
  ["Gestionnaires", gestionnaires],
  ["Comptes", comptesListe],
  ["Finances (paramètres)", financesParametres],
  ["Suppressions", suppressions],
  ["Supervision (détail)", supervision],
];
for (const [nom, src] of pagesBandeau) {
  check(`Bandeau : page ${nom} — BandeauPage présent, titre H1 en blanc`,
    contient(src, "<BandeauPage>") && /<h1 className="[^"]*text-white/.test(src));
}
check("Bandeau : Dossier — lien retour en accent or",
  contient(dossier, "font-semibold text-gold underline"));
check("Bandeau : Dossier — méta en slate-300 sur marine",
  contient(dossier, "break-words text-sm text-slate-300"));
check("Bandeau : Messages supervisés — pastille lecture seule en variante or translucide",
  contient(messagesSupervises, "border-gold/40 bg-gold/15") &&
  contient(messagesSupervises, "text-gold"));
check("Bandeau : Vue d'ensemble — héros marine harmonisé (bordure or/40, pas de doublon)",
  contient(vue, "rounded-2xl border border-gold/40 bg-navy p-5 text-white shadow-sm") &&
  !contient(vue, "<BandeauPage>"));

// ---------------------------------------------------------------------------
// Accordéon Messages du Dossier (2026-11-08) : section repliée par
// défaut (seul l'en-tête reste visible), ouverture par clic
// (aria-expanded) et arrivée par l'ancre #messages = dépliée ;
// l'ancre elle-même (id de la section) est inchangée.
check("Accordéon Messages : état replié par défaut (useState(false))",
  contient(dossier, "const [messagesOuverts, setMessagesOuverts] = useState(false)"));
check("Accordéon Messages : bouton accessible (aria-expanded + aria-controls)",
  contient(dossier, "aria-expanded={messagesOuverts}") &&
  contient(dossier, 'aria-controls="messages-contenu"') &&
  contient(dossier, 'id="messages-contenu"'));
check("Accordéon Messages : ouverture à l'arrivée par l'ancre #messages",
  contient(dossier, 'window.location.hash === "#messages"') &&
  contient(dossier, '"hashchange"'));
check("Accordéon Messages : ancre #messages inchangée (id de la section)",
  contient(dossier, '<section id="messages"'));
check("Accordéon Messages : fil monté seulement une fois déplié (rendu conditionnel)",
  contient(dossier, "{messagesOuverts ? (") &&
  contient(dossier, "<FilMessages conversationId={conversation.id} />"));
check("Accordéon Messages : pastille des non-lus déjà chargés (aucun nouvel appel)",
  contient(dossier, "conversation?.non_lus"));
check("Accordéon Messages : chevron qui pivote à l'ouverture",
  contient(dossier, 'messagesOuverts ? "rotate-180" : ""'));

// ---------------------------------------------------------------------------
// SYSTÈME D'ORGANISATION DES PAGES (2026-11-08) — déploiement de la
// maquette validée par le fondateur (4 modèles : Tableau de bord,
// Fiche/Dossier, Liste + panneau, Cartes ; anatomie de carte
// premium ; règles anti-vide) à TOUT l'espace connecté (console +
// client). Pages publiques NON touchées.
//   - Anatomie : en-tête de section avec tuile or portant l'icône
//     EXISTANTE de la section (composant partagé TuileIcone, jeu
//     IconeNav) — insérée en ligne dans le titre, sans changer ni
//     ses classes ni sa structure.
//   - États vides centrés : composant partagé EtatVideCentre
//     (anneau or pâle en CSS + texte existant), et le même anneau
//     dans EmptyState (pleine page).
//   - Dossier : Documents et Historique en accordéon MOBILE
//     (repliés sous lg, toujours ouverts en lg+ par lg:block).
//   - Vue d'ensemble console : modèle 1 — Activité 2/3 (xl:order-1
//     xl:col-span-2), colonne Messages 1/3 (xl:order-2), l'ordre
//     DOM (mobile) est inchangé.
//   - Dashboard client : modèle 1 — paire Fins de bail (2/3) |
//     Dépenses du mois (1/3) en lg. Fiche immeuble : modèle 2 —
//     principale (Appartements, Dépenses) 2/3 | latérale
//     (Documents, Passeport) 1/3 en lg, grille interne du
//     passeport ramenée à 1 colonne dans la latérale.
//   - Équipe : panneau de création teinté crème (bg-cream).
//   - AppShell client : contenu plafonné à 1600 px comme la
//     console (md:max-w-[1600px]).
//   - ZÉRO DÉBORDEMENT MOBILE (exigence du fondateur) : garde
//     statique — aucune largeur rigide w-[NNNpx] dans les fichiers
//     touchés ; les seuls min-w-[...]px sont les tableaux bureau
//     préexistants, contenus dans des overflow-x-auto ; chaque
//     nouvelle grille a ses items en min-w-0.
const tuile = lire("components/TuileIcone.tsx");
check("Système : TuileIcone — tuile or + jeu d'icônes existant (IconeNav), aucune icône dessinée",
  contient(tuile, "bg-gold") && contient(tuile, 'from "./IconeNav"') && !contient(tuile, "<path"));
check("Système : TuileIcone — en ligne dans le titre (inline-flex, flex-none)",
  contient(tuile, "inline-flex") && contient(tuile, "flex-none"));
const etatVide = lire("components/EtatVideCentre.tsx");
check("Système : EtatVideCentre — centré (flex col, items/justify center) + anneau or pâle",
  contient(etatVide, "items-center justify-center") && contient(etatVide, "border-gold/50"));
const emptyState = lire("components/EmptyState.tsx");
check("Système : EmptyState pleine page — même anneau or centré",
  contient(emptyState, "border-gold/50") && contient(emptyState, "mx-auto mb-4 block"));

const tuilesParPage = [
  ["Vue d'ensemble", vue, 4],
  ["Dossier client", dossier, 8],
  ["Finances plateforme", fin, 3],
  ["Mon dossier employé", monDossier, 7],
  ["Équipe", equipe, 2],
  ["Gestionnaires", gestionnaires, 1],
  ["Mes dossiers", mesDossiers, 1],
  ["Finances (paramètres)", financesParametres, 2],
  ["Vérifier un employé", verifier, 1],
];
for (const [nom, src, min] of tuilesParPage) {
  check(`Système : tuiles d'en-tête — ${nom} (≥ ${min})`, compte(src, "<TuileIcone") >= min);
}
const dash = lire("app/[locale]/dashboard/page.tsx");
const fiche = lire("app/[locale]/immeubles/[id]/page.tsx");
const rapports = lire("app/[locale]/rapports/page.tsx");
const alertes = lire("app/[locale]/alertes/page.tsx");
const abonnement = lire("app/[locale]/abonnement/page.tsx");
const parametres = lire("app/[locale]/parametres/page.tsx");
const contratClient = lire("app/[locale]/contrat/page.tsx");
const tuilesClient = [
  ["Dashboard client", dash, 6],
  ["Fiche immeuble", fiche, 4],
  ["Rapports", rapports, 4],
  ["Alertes", alertes, 2],
  ["Abonnement", abonnement, 7],
  ["Paramètres", parametres, 7],
  ["Contrat client", contratClient, 2],
];
for (const [nom, src, min] of tuilesClient) {
  check(`Système : tuiles d'en-tête — ${nom} (≥ ${min})`, compte(src, "<TuileIcone") >= min);
}

check("Système : Vue d'ensemble — grille xl 3 colonnes (modèle 1)",
  contient(vue, "xl:grid xl:grid-cols-3 xl:items-start xl:gap-6"));
check("Système : Dashboard client — paire principale 2/3 | latérale 1/3 (lg:grid-cols-3 + col-span-2)",
  contient(dash, "mt-4 grid gap-4 lg:grid-cols-3") && compte(dash, "sm:p-6 lg:col-span-2") === 1);
check("Système : Dashboard client — items de la paire en min-w-0 (anti-débordement)",
  compte(dash, "min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6") === 2);
check("Système : Fiche immeuble — enveloppe modèle 2 (lg:grid-cols-3, items-start)",
  contient(fiche, "lg:grid lg:grid-cols-3 lg:items-start lg:gap-6 lg:mt-6"));
check("Système : Fiche immeuble — principale en col-span-2 (3 sections : Appartements, Dépenses, Passeport), sections en min-w-0 (4)",
  compte(fiche, "lg:col-span-2 lg:mt-0 min-w-0") === 3 && compte(fiche, "lg:mt-0 min-w-0") === 4);
check("Système : Fiche immeuble — grille interne du passeport adaptée à la principale (lg 2 col., xl 3 col. ; plus de lg:grid-cols-1)",
  contient(fiche, "md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3") && !contient(fiche, "lg:grid-cols-1"));
check("Système : Équipe — panneau de création teinté crème à bordure or",
  contient(equipe, "border-gold/40 bg-cream p-5 xl:mt-0 min-w-0"));
check("Système : AppShell client — contenu plafonné 1600 px (md:max-w-[1600px])",
  contient(lire("components/AppShell.tsx"), "md:p-10 md:max-w-[1600px]"));

// Dossier : accordéons mobiles Documents + Historique.
check("Système : Dossier — états des accordéons mobiles (docsOuverts / auditOuvert, repliés par défaut)",
  contient(dossier, "const [docsOuverts, setDocsOuverts] = useState(false)") &&
  contient(dossier, "const [auditOuvert, setAuditOuvert] = useState(false)"));
check("Système : Dossier — accordéon Documents (aria, chevron lg:hidden, contenu forcé lg:block)",
  contient(dossier, 'aria-controls="documents-contenu"') && contient(dossier, 'id="documents-contenu"') &&
  contient(dossier, '${docsOuverts ? "block" : "hidden"} lg:block'));
check("Système : Dossier — accordéon Historique (aria, chevron lg:hidden, contenu forcé lg:block)",
  contient(dossier, 'aria-controls="historique-contenu"') && contient(dossier, 'id="historique-contenu"') &&
  contient(dossier, '${auditOuvert ? "block" : "hidden"} lg:block'));
check("Système : Dossier — la Revue/Décision et l'Identité restent toujours visibles (aucun accordéon)",
  !contient(dossier, 'aria-controls="revue-contenu"') && !contient(dossier, 'aria-controls="identite-contenu"'));

// États vides centrés (EtatVideCentre) sur les listes console + client.
const etatsVides = [
  ["Vue d'ensemble (aucune activité)", vue],
  ["Dossier (documents / rattachements / historique)", dossier],
  ["Comptes (aucun compte)", comptesListe],
  ["Mes dossiers (vide)", mesDossiers],
  ["Gestionnaires (aucun)", gestionnaires],
  ["Messages console (vide)", messages],
  ["Messages supervisés (vide)", messagesSupervises],
  ["Vitrine supervision (vide)", vitrine],
  ["Suppressions (vide)", suppressions],
  ["Journal (vide / aucun résultat)", journal],
  ["Immeubles client (aucun résultat)", lire("app/[locale]/immeubles/page.tsx")],
  ["Fiche immeuble (aucune dépense)", fiche],
  ["Dépenses client (aucun résultat)", lire("app/[locale]/depenses/page.tsx")],
  ["Vitrine client (vide)", lire("app/[locale]/vitrine/page.tsx")],
];
for (const [nom, src] of etatsVides) {
  check(`Système : état vide centré — ${nom}`, contient(src, "<EtatVideCentre"));
}
check("Système : Journal — les deux états vides centrés (vide + aucun résultat)",
  compte(journal, "<EtatVideCentre") >= 2);
check("Système : Dossier — trois états vides centrés (documents, rattachements, historique)",
  compte(dossier, "<EtatVideCentre") >= 3);

// ZÉRO DÉBORDEMENT MOBILE — garde statique sur les fichiers touchés :
// aucune largeur rigide w-[NNNpx] (les max-w/min-w préexistants des
// tableaux bureau vivent dans des conteneurs overflow-x-auto).
const fichiersTouches = [
  "app/[locale]/console/page.tsx", "app/[locale]/console/comptes/[id]/page.tsx",
  "app/[locale]/console/finances-plateforme/page.tsx", "app/[locale]/console/mon-dossier/page.tsx",
  "app/[locale]/console/admins/page.tsx", "app/[locale]/console/gestionnaires/page.tsx",
  "app/[locale]/console/mes-dossiers/page.tsx", "app/[locale]/console/comptes/page.tsx",
  "app/[locale]/console/messages/page.tsx", "app/[locale]/console/messages-supervises/page.tsx",
  "app/[locale]/console/vitrine/page.tsx", "app/[locale]/console/suppressions/page.tsx",
  "app/[locale]/console/journal/page.tsx", "app/[locale]/console/finances/page.tsx",
  "app/[locale]/console/verifier-employe/page.tsx", "app/[locale]/dashboard/page.tsx",
  "app/[locale]/immeubles/[id]/page.tsx", "app/[locale]/immeubles/page.tsx",
  "app/[locale]/rapports/page.tsx", "app/[locale]/alertes/page.tsx",
  "app/[locale]/abonnement/page.tsx", "app/[locale]/parametres/page.tsx",
  "app/[locale]/contrat/page.tsx", "app/[locale]/depenses/page.tsx",
  "app/[locale]/vitrine/page.tsx", "components/AppShell.tsx",
  "components/EmptyState.tsx", "components/EtatVideCentre.tsx",
  "components/DocumentList.tsx",
];
// TuileIcone est volontairement hors balayage : ses seules tailles
// fixes sont la tuile (h-8 w-8) et l'icône interne (18 px), toutes
// deux flex-none dans le flux du titre — elles ne peuvent pas
// élargir la page. Contrôle dédié :
check("Anti-débordement : TuileIcone — tailles fixes bornées au composant (tuile 32 px, icône 18 px, flex-none)",
  contient(tuile, "h-8 w-8 flex-none") && contient(tuile, 'className="h-[18px] w-[18px]"'));
for (const f of fichiersTouches) {
  const src = lire(f);
  check(`Anti-débordement : aucune largeur rigide w-[NNNpx] — ${f.split("/").slice(-2).join("/")}`,
    !/(^|[\s"'])w-\[\d+px\]/.test(src));
}
check("Anti-débordement : tableaux bureau à min-w contenus dans un overflow-x-auto (journal, suppressions, rapports)",
  contient(journal, "overflow-x-auto") && contient(suppressions, "overflow-x-auto") && contient(rapports, "overflow-x-auto"));
check("Anti-débordement : les accordéons mobiles n'ajoutent aucune largeur (bouton en p-1.5, shrink-0)",
  compte(dossier, "shrink-0 rounded-full border border-slate-300 bg-white p-1.5 text-navy hover:border-gold lg:hidden") === 2);

// ---------- Correctif fiche immeuble (captures bureau du fondateur,
// Kaneza Home) ----------
// Défauts photographiés : (1) le Passeport du bien (contenu long)
// vivait dans la latérale 1/3 — carte étroite étirée, grand vide à
// droite ; il passe dans la colonne principale 2/3, à la suite
// d'Appartements et Dépenses ; la latérale ne garde que Documents.
// (2) la carte Documents de la latérale était écrasée (pastille
// catégorie cassée au milieu, méta sur plusieurs lignes, boutons
// serrés) : DocumentList reçoit un mode `compact` pour colonnes
// étroites. (3) l'état vide des Dépenses n'était pas centré.
const docList = lire("components/DocumentList.tsx");
check("Correctif fiche immeuble : Passeport en colonne principale — il suit Dépenses dans le DOM (ordre Appartements < Dépenses < Passeport)",
  fiche.indexOf("buildings.detailExpenses") < fiche.indexOf("passport.title") &&
  compte(fiche, "lg:col-span-2 lg:mt-0 min-w-0") === 3);
check("Correctif fiche immeuble : latérale réduite aux Documents (1 section sans col-span dans la grille)",
  compte(fiche, "lg:mt-0 min-w-0") - compte(fiche, "lg:col-span-2 lg:mt-0 min-w-0") === 1);
check("Correctif fiche immeuble : Documents de la latérale rendus en mode compact",
  contient(fiche, "<DocumentList documents={documents} onChange={charger} compact />"));
check("Correctif fiche immeuble : état vide des Dépenses centré (EtatVideCentre importé et rendu)",
  contient(fiche, "import EtatVideCentre from \"@/components/EtatVideCentre\"") &&
  contient(fiche, "<EtatVideCentre><p className=\"text-slate-600\">{t(\"expenses.empty\")}</p></EtatVideCentre>") &&
  !contient(fiche, "<p className=\"mt-2 text-slate-600\">{t(\"expenses.empty\")}</p>"));
check("DocumentList : prop compact dédiée (défaut false)",
  contient(docList, "compact = false") && contient(docList, "compact?: boolean"));
check("DocumentList : ligne compacte toujours en colonne (jamais la rangée sm), en min-w-0",
  contient(docList, "\"flex min-w-0 flex-col gap-2 py-3\""));
check("DocumentList : pastille catégorie sans casse interne (whitespace-nowrap dans les deux modes)",
  compte(docList, "whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold") === 2);
check("DocumentList compact : pastille sous le nom, en bloc (inline-block)",
  contient(docList, "inline-block whitespace-nowrap rounded-full"));
check("DocumentList compact : méta date · taille sur une ligne (truncate + whitespace-nowrap)",
  contient(docList, "truncate whitespace-nowrap text-sm text-slate-600"));
check("DocumentList compact : actions en rangée de petits boutons tenant dans la carte (gap-1.5, px-2.5 py-1 text-xs ×3)",
  contient(docList, "\"flex flex-wrap gap-1.5\"") && compte(docList, "px-2.5 py-1 text-xs font-semibold") === 3);
check("DocumentList : mode standard inchangé (rangée dès sm, boutons px-3 py-1.5 text-sm)",
  contient(docList, "\"flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between\"") &&
  compte(docList, "px-3 py-1.5 text-sm font-semibold") === 3);

console.log(`\nOrganisation desktop premium : ${ok} OK / ${ko} KO`);
process.exit(ko ? 1 : 0);

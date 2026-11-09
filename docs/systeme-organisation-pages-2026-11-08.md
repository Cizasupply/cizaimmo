# Système d'organisation des pages — déploiement « partout » (2026-11-08)

Déploiement du système d'organisation validé par le fondateur sur
maquette (`~/workspace/goals/lancer-cizaimmo-en-saas/files/cizaimmo-systeme-organisation-visuel.html`) :
4 modèles de pages, anatomie de carte premium, règles anti-vide,
mobile d'abord et grille bureau. Périmètre : **espace connecté
(console + client)**. Les pages publiques (accueil, à propos,
tarifs, contact, vitrine publique, page locataire par lien) gardent
leur design déjà validé et ne sont **pas touchées**.

## Ce que la passe ajoute (par-dessus les passes précédentes)

Les passes antérieures avaient déjà livré : bordures de cartes
or/40 (console), bandeau de titre marine partagé (`BandeauPage`),
grilles bureau des pages console, pilote Finances (liste +
panneau), accordéon Messages du Dossier, plafond console 1600 px.
Cette passe généralise le reste du système :

1. **Anatomie de carte premium — tuile d'en-tête** : nouveau
   composant partagé `components/TuileIcone.tsx` — petite tuile
   arrondie or portant l'icône de la section prise dans le jeu
   **existant** `IconeNav` (aucune icône nouvelle dessinée ;
   section sans icône existante = en-tête texte conservé). La
   tuile s'insère **en ligne** dans le titre existant
   (`inline-flex flex-none`) : ni les classes ni la structure du
   titre ne changent.
2. **États vides centrés** : nouveau composant partagé
   `components/EtatVideCentre.tsx` — anneau or pâle en CSS pur
   au-dessus du texte existant, bloc centré dans sa colonne. Le
   même anneau est ajouté à `EmptyState` (états vides pleine page,
   espace client). Textes inchangés partout.
3. **Accordéons mobiles du Dossier** : les sections longues
   **Documents** et **Historique** sont repliées sous `lg`
   (en-tête toujours visible, chevron `lg:hidden`,
   `aria-expanded`/`aria-controls`) et **toujours ouvertes en
   lg+** (contenu forcé par `lg:block`). La Revue/Décision et
   l'Identité restent toujours visibles, comme exigé.
4. **Plafond client 1600 px** : `AppShell` reçoit
   `md:max-w-[1600px]` (placé en fin de classe pour conserver la
   chaîne historique vérifiée par le test scroll/tuiles), comme la
   console.

## Tableau page → modèle

### Console

| Page | Modèle | État après la passe |
|---|---|---|
| Vue d'ensemble | 1 — Tableau de bord | **Conformée** : en xl, Activité récente 2/3 (`xl:order-1 xl:col-span-2`) + colonne Messages/files 1/3 (`xl:order-2`) ; tuiles KPI inchangées (déjà conformes) ; tuiles d'en-tête (Messages, Comptes en attente, Retards, Activité) ; état « aucune activité » centré |
| Comptes | Liste pleine largeur | Déjà conforme (cartes + tableau) ; état vide centré |
| Dossier client | 2 — Fiche | Déjà conforme pour la grille ; **ajouts** : tuiles d'en-tête (Identité, Abonnement, Documents, Rattachements, Immeubles, Décisions, Historique, Messages), accordéons mobiles Documents + Historique, 3 états vides centrés |
| Mes dossiers | Liste | Déjà conforme ; tuile Messages ; état vide centré |
| Gestionnaires | Liste + panneau | Déjà conforme ; tuile sur le formulaire de rattachement ; état vide centré |
| Messages | 4 — Cartes | Déjà conforme (grille xl 2 colonnes) ; état vide centré |
| Messages supervisés | Liste + détail | Déjà conforme ; état vide centré (dans la latérale) |
| Vitrine (supervision) | Liste | Déjà conforme ; état vide centré |
| Équipe | 4 — Cartes | Déjà conforme ; tuiles (Promouvoir, Créer) ; **panneau de création teinté crème** (`bg-cream`, bordure or/40) |
| Vérifier un employé | 3 — Liste + panneau | Déjà conforme (recherche/liste \| fiche en xl) ; tuile sur la liste des employés |
| Finances plateforme | 3 — Liste + panneau | Pilote déjà livré ; tuiles d'en-tête (Totaux, Paie, Dépenses) ; état vide des dépenses déjà centré (pilote) |
| Finances (paramètres) | Formulaires | Tuiles d'en-tête (grilles tarifaires, paramètres) ; grilles déjà conformes |
| Journal | Tableau pleine largeur | Déjà conforme (défilement interne) ; les 2 états vides centrés |
| Suppressions | Tableau pleine largeur | Déjà conforme ; état vide centré |
| Mon dossier employé | 2/4 — Fiche + cartes | Déjà conforme (grilles xl, carte + Ma paie côte à côte) ; tuiles d'en-tête (Progression, Identité, Coordonnées de paiement, Charte, Contrat, Carte, Ma paie). Section Adresse : pas de tuile (aucune icône existante adaptée) |

### Client

| Page | Modèle | État après la passe |
|---|---|---|
| Tableau de bord | 1 — Tableau de bord | **Conformé** : KPI déjà en tuiles ; paire « Fins de bail » 2/3 + « Dépenses du mois » 1/3 en lg (`lg:grid-cols-3` + `lg:col-span-2`, items `min-w-0`) ; tuiles d'en-tête (×6) |
| Immeubles (liste) | Liste (cartes mobile / tableau bureau) | Déjà conforme (organisation validée antérieurement) ; état « aucun résultat » centré ; `EmptyState` gagne l'anneau |
| Fiche immeuble / passeport | 2 — Fiche | **Conformée** : dès lg, principale (Appartements, Dépenses) 2/3 \| latérale (Documents, Passeport) 1/3 ; grille interne du passeport ramenée à 1 colonne dans la latérale (`lg:grid-cols-1`) ; sections en `min-w-0` ; tuiles d'en-tête (×4). Mobile : colonne unique, ordre DOM inchangé. **Corrigée depuis** : voir la section « Correctif fiche immeuble » ci-dessous (le passeport a rejoint la principale) |
| Appartements, Locataires, Reçus | Listes/tableaux | Déjà conformes (cartes mobile, tableaux bureau en `overflow-x-auto`) ; `EmptyState` gagne l'anneau |
| Loyers | Liste + formulaire | Déjà conforme (tuiles de totaux, tableau contenu) ; en-têtes `text-sm` sans tuile (voir écarts) |
| Finances du client (Dépenses) | Liste + totaux | Déjà conforme (formulaires en modales, pas de panneau latéral applicable) ; état « aucun résultat » centré |
| Documents | 4 — Cartes | Déjà conforme (grille de cartes + filtres) ; `EmptyState` gagne l'anneau |
| Rapports | 1/4 | Déjà conforme (bande de tuiles + cartes) ; tuiles d'en-tête (×4) |
| Alertes | Liste | Tuiles d'en-tête (×2) ; `EmptyState` gagne l'anneau |
| Abonnement | 4 — Cartes (grilles tarifaires) | Déjà conforme ; tuiles d'en-tête (×7) |
| Paramètres | Formulaires par sections | Tuiles d'en-tête (×7) ; grilles de champs déjà conformes |
| Mon dossier (écran d'attente) | — | Anatomie seulement : `DossierBloc` déjà teinté or passe précédente ; aucun changement |
| Mon contrat | Fiche document | Tuiles d'en-tête (×2) |
| Messages (client) | Liste + conversation | Déjà conforme (`320px + minmax(0,1fr)` en lg seulement) ; aucun changement |
| Mes annonces (Vitrine client) | Liste de cartes de gestion | Déjà conforme (cartes pleine largeur : contrôles de publication riches) ; état vide centré |

## Zéro débordement mobile — méthode du contrôle statique

Exigence explicite du fondateur : aucun défilement horizontal sur
mobile. Contrôles ajoutés au bloc `test-organisation-desktop.cjs` :

- **Aucune largeur rigide `w-[NNNpx]`** dans les 28 fichiers
  touchés (regex sur les sources). Les seules tailles fixes
  tolérées sont internes à `TuileIcone` (tuile 32 px + icône
  18 px, `flex-none`, dans le flux du titre — contrôle dédié).
- Les `min-w-[...]px` restants sont les **tableaux bureau
  préexistants** (Journal, Suppressions, Rapports), vérifiés
  **contenus dans des `overflow-x-auto`** : ils défilent dans leur
  carte, jamais dans la page ; sur mobile ces tableaux sont
  remplacés par des cartes (patron déjà en place).
- Chaque nouvelle grille a ses **items en `min-w-0`** (paire du
  dashboard client, 4 sections de la fiche immeuble) ; les
  accordéons mobiles n'ajoutent aucune largeur (bouton `p-1.5
  shrink-0`, masqué en lg+).
- Coques mobiles `h-dvh` et barres inférieures dans le flux :
  inchangées (vérifiées par les blocs antérieurs du même fichier
  de test).

## Invariants respectés

Aucun texte modifié (parité i18n intacte : 2 137 clés FR = EN,
aucun fichier de messages touché), aucune règle métier, aucun
fournisseur, aucun SQL, aucun périmètre de rôle. Les verrouillages
restent fonctionnellement identiques (Super Admin seul, périmètres
finances Admin, accordéon Messages avec ouverture sur ancre
`#messages` — contrôlé par le bloc existant).

## Écarts justifiés

- **Sections d'état colorées** (Revue du Dossier en ambre,
  revues de contrats en ciel, Décisions en vert — la tuile y est
  posée pour Décisions ; sections Revue/contrats sans tuile) et
  **en-têtes `text-sm`** (totaux Loyers/Dépenses client, libellés
  de listes) : pas de tuile — la tuile 32 px écraserait ces
  libellés compacts ; l'anatomie s'applique aux en-têtes de
  section principaux.
- **Bordures des cartes client** : la teinte or/40 couvre la
  console et `DossierBloc` (passes précédentes) ; l'espace client
  conserve ses bordures slate uniformisées lors de la passe design
  client validée — non remises en cause par la maquette, dont les
  exemples bureau sont des pages console.
- **Dépenses client** : les formulaires vivent en modales
  (patron validé) — le modèle 3 s'y applique par les tuiles de
  totaux et la liste, pas par un panneau latéral.
- **Fiche immeuble** : l'Indivision reste pleine largeur sous la
  grille (section autonome). Le passeport, d'abord placé dans la
  latérale en hauteur naturelle, a depuis rejoint la colonne
  principale — voir « Correctif fiche immeuble » ci-dessous.

## Correctif fiche immeuble (captures bureau du fondateur — Kaneza Home)

Trois défauts photographiés sur la fiche de « Kaneza Home », corrigés
dans la même organisation (modèle 2 — Fiche) :

1. **Passeport dans la mauvaise colonne** : le passeport du bien
   (identité, photos, valeur, travaux, historique complet, documents
   du bien) vivait dans la latérale 1/3 — carte étroite étirée en
   hauteur, grand vide à droite sous la carte Documents. Il passe
   dans la **colonne principale 2/3** (`lg:col-span-2`), à la suite
   d'Appartements et Dépenses ; sa grille interne suit la largeur
   (`md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3`, le
   `lg:grid-cols-1` de la latérale disparaît). La latérale ne garde
   que **Documents**, bloc court. Mobile : ordre DOM et colonne
   unique inchangés.
2. **Carte Documents écrasée dans la latérale** : nom tronqué sans
   garde, pastille catégorie cassée au milieu (« Justificati / f de
   paiement »), méta date · taille sur plusieurs lignes, boutons
   serrés. `DocumentList` reçoit un mode **`compact`** (fiche
   immeuble seule l'active) : ligne toujours en colonne, nom sur une
   ligne (`min-w-0` + truncate), pastille entière sous le nom
   (`whitespace-nowrap` — appliqué aussi au mode standard, où la
   casse interne disparaît partout), méta sur une ligne
   (`truncate whitespace-nowrap`), actions en rangée de petits
   boutons (`px-2.5 py-1 text-xs`, `flex-wrap`).
   **Balayage colonnes étroites côté client** : fiche locataire —
   section Documents en pleine largeur (sections empilées, aucune
   latérale), aucun changement ; fiche appartement — pas de
   `DocumentList` (liste texte du passeport en pleine largeur),
   aucun changement ; page Documents — liste en carte pleine
   largeur sans latérale, aucun changement. La fiche immeuble était
   le seul rendu en colonne étroite.
3. **État vide des Dépenses non centré** : « Aucune dépense pour
   l'instant » passe par `EtatVideCentre`, comme les autres listes.

Tests : bloc organisation étendu — les deux assertions qui
verrouillaient l'ancien placement du passeport sont mises à jour
(même protection, patron corrigé, commentées) et 11 contrôles
« Correctif fiche immeuble / DocumentList compact » sont ajoutés
(181 OK / 0 KO) ; suite complète **1 868 OK / 3 KO** (les 3 KO
préexistants du Module 3, fixtures sensibles à la date) ; `tsc` et
build propres ; aucun texte, aucune règle, aucun fournisseur
touchés.

## Tests

- Bloc `test-organisation-desktop.cjs` étendu (section
  « Système ») : **168 OK / 0 KO**.
- Suite complète `bash scripts/run-tests.sh` : **1 855 OK / 3 KO**
  — les 3 KO sont les préexistants connus du Module 3 (fixtures
  démo sensibles à la date), signalés et non corrigés.
- `npx tsc --noEmit` propre ; `npm run build` propre (101/101
  pages) ; parité i18n vérifiée par la suite.

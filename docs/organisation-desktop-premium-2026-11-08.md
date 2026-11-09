# Organisation desktop « ultra premium » des pages console — 2026-11-08

Ordre du fondateur (captures bureau du 2026-11-08) : sur écran large, la
console laissait de grands vides — cartes étirées en pleine largeur,
contenu collé à gauche. Réorganisation par la **grille** (jamais par
l'étirement), **desktop seulement** (préfixes `lg:`/`xl:`), puis ajout du
même jour : **bordures de cartes légèrement colorées** pour casser le blanc.

## Règles respectées

- **Mobile structurellement identique** : colonne unique, coque `h-dvh`,
  barre inférieure dans le flux, ordres DOM et espacements de base
  inchangés (les classes sans préfixe restent en place ; les grilles
  bureau ne s'activent qu'en `lg:`/`xl:`).
- Aucun changement de contenu, de règle métier, de fournisseur, ni de
  périmètre par rôle : les vues conditionnelles `estSuper` et les
  verrouillages Admin / Super Admin sont exactement en place.
- Système Marine & Or, aucune nouvelle couleur, aucune dépendance,
  aucun nouveau texte (parité i18n inchangée : 2 137 clés).

## Bordures de cartes teintées (choix retenu)

Les cartes neutres (blanc sur crème, bordure slate très pâle) reçoivent
une **bordure or à 40 % d'opacité** : `border-gold/40` (or `#D4AF37` du
système Marine & Or). Traitement appliqué **via les patrons partagés** :
constantes `CARTE` des pages Finances et Mon dossier employé, et chaînes
de classes de cartes répétées des autres pages (Dossier client, Vue
d'ensemble, Équipe, Vérifier un employé, Journal, Messages, Vitrine,
`DossierBloc` côté client). Les bordures d'**état** (ambre, rouge, vert,
ciel : alertes, files d'attente, bandeaux) sont inchangées — la teinte or
ne concerne que les cartes neutres. Les sous-tuiles internes gardent le
slate pour la hiérarchie visuelle. Cosmetique seulement : la teinte
s'applique à toutes les tailles d'écran, la structure mobile ne change pas.

## Conteneur console (`components/ConsoleShell.tsx`)

| Avant | Après |
|---|---|
| `<main>` sans largeur max : le contenu s'étirait sur toute la largeur de l'écran | Children enveloppés dans `md:mx-auto md:w-full md:max-w-[1600px]` : plafond 1600 px centré sur très grand écran ; enveloppe neutre sur mobile |

## Grille avant / après par page

### Dossier client — `console/comptes/[id]`

| Avant | Après |
|---|---|
| Grille unique `lg:grid-cols-2` pleine largeur : Identité et Abonnement côte à côte avec des listes de définitions en lignes étirées ; Historique en pleine largeur en bas | Grille `xl:grid-cols-3` : **zone principale (2/3)** en 2 colonnes dès `lg` + **Historique en colonne latérale (1/3)** |
| Identité : photo au-dessus d'une longue liste de définitions | Identité large (`lg:col-span-2`) : **photo à gauche, informations à droite** (`lg:flex`) ; la liste de définitions passe en **2 colonnes en xl** |
| Abonnement, Documents, Rattachements : cartes pleines ou demi-largeur, lignes étirées | Rangées équilibrées dans la zone principale : Abonnement \| Documents, Rattachements \| Immeubles ; Revue des immeubles en pleine zone (`lg:col-span-2`) |
| Immeubles : lignes de liste | **Cartes** dès `lg` (bordure + padding, grille 2 colonnes dans la section) |
| Historique (audit) : section pleine largeur vide | **Timeline latérale** en xl : filet vertical, points or, carte `sticky` en haut de colonne |
| Bandeau « Décisions enregistrées » | Inchangé : pleine largeur sous l'en-tête ; fil Messages pleine largeur sous la grille, inchangé |

### Finances de la plateforme — `console/finances-plateforme`

Vues conditionnelles par rôle **inchangées** (la boîte Totaux reste
Super Admin seul).

| Avant | Après |
|---|---|
| Totaux par devise : 3 lignes libellé/valeur étirées dans chaque boîte | **Bande de statistiques** en xl : les 3 métriques deviennent des **tuiles** (libellé au-dessus, montant en avant, fond slate-50) |
| Lignes de paie : pile pleine largeur | **Grille xl 2 colonnes** |
| Dépenses : formulaire pleine largeur au-dessus de la liste pleine largeur | En xl : **liste à gauche (2/3)**, **formulaire en colonne droite (1/3, sticky)** — ordre DOM inchangé (formulaire d'abord), `xl:order-*` n'échange que la présentation bureau ; le formulaire repasse en 1 colonne dans sa colonne latérale |
| Vue Admin (« Ma paie » / « Mes demandes de dépenses ») | Mêmes zones séparées, chacune utilisant la largeur : historique et demandes en colonnes via les grilles ci-dessus |

### Mon dossier employé — `console/mon-dossier`

| Avant | Après |
|---|---|
| Toutes les sections en cartes pleine largeur empilées | Parcours (statut, progression) pleine largeur inchangé, puis **grilles xl 2 colonnes** |
| Identité, puis Adresse en dessous | **Identité \| Adresse** côte à côte |
| Coordonnées, puis Charte, puis Contrat en dessous | **Coordonnées \| (Charte + Contrat empilés)** |
| Carte employé petite, perdue à gauche d'une grande carte vide | **Carte employé \| Ma paie** côte à côte ; la carte est **centrée à taille réelle** dans sa section en xl |
| Sans pack employé | Coordonnées et Ma paie restent pleine largeur (grilles conditionnées à la présence du pack) |

### Vue d'ensemble — `console/page.tsx`

| Avant | Après |
|---|---|
| Bande KPI `lg:grid-cols-4` | **Confirmée, inchangée** |
| Carte Messages, files d'attente, Activité récente : empilées pleine largeur | En xl : colonne gauche = **Messages + files d'attente empilées**, **Activité récente à droite** (grille 2 colonnes) |

### Équipe — `console/admins`

| Avant | Après |
|---|---|
| Cartes membres en rangées pleine largeur | **Grille xl 2 colonnes** (le détail dépliable reste dans la carte) |
| « Promouvoir » puis « Créer un admin » pleine largeur | **Côte à côte en xl** |

### Vérifier un employé — `console/verifier-employe`

| Avant | Après |
|---|---|
| Page centrée `max-w-2xl` sur tous les écrans : formulaire, liste, puis fiche en dessous | `xl:max-w-6xl` : **recherche + liste à gauche**, **alertes + fiche de vérification à droite** (xl 2 colonnes) ; la vue refus (non Super Admin) reste `max-w-2xl` |

### Messages console — `console/messages`

| Avant | Après |
|---|---|
| Cartes-conversations en rangées pleine largeur | **Grille xl 2 colonnes** |

### Journal — `console/journal` : aucun changement de structure

Déjà dense : filtres + tableau pleine largeur (min. 720 px) + cartes
mobiles + **pagination inchangée**. Seule la teinte de bordure or est
appliquée aux cartes et au conteneur du tableau.

### Vitrine (supervision) — `console/vitrine` : aucun changement de structure

Cartes de revue déjà denses (photo 240 px + contenu). Seule la teinte de
bordure or est appliquée.

### Espace client — « Mon dossier » (`components/DossierBloc.tsx`) : aucun changement de structure

Le « Mon dossier » client est rendu dans l'écran d'attente d'approbation,
une **carte centrée `max-w-md`** par conception : pas de vide d'étirement
sur bureau, la grille 2 colonnes n'y a pas lieu. Seule la bordure des deux
lignes de dossier (photo, pièce d'identité) reçoit la teinte or, pour la
cohérence visuelle.

## Vérifications

- Contrôle statique dédié : `scripts/test-organisation-desktop.cjs`
  (**37 OK / 0 KO**) — présence des classes de grille bureau sur les
  sections ciblées et présence des classes de base mobiles.
- Deux contrôles statiques antérieurs ajustés à la nouvelle structure
  (même protection vérifiée, compteurs/structure à jour) :
  `scripts/test-correctif-mobile-annotations.cjs` (grille Dossier en
  colonne unique aux deux niveaux ; la ligne « Photo de profil » sortie
  de la liste de définitions garde son libellé `shrink-0` dans le bloc
  photo — 14 libellés protégés au total, comme avant) et
  `scripts/test-journal-details.cjs` (barre de filtres : bordure teintée
  or dans le patron de carte attendu).
- Parité i18n : aucun texte ajouté (2 137 clés, inchangée).
- Suite complète `bash scripts/run-tests.sh`, `npx tsc --noEmit` et
  `npm run build` : voir le rapport de livraison (3 KO préexistants du
  Module 3 — fixtures démo sensibles à la date — signalés, non corrigés).

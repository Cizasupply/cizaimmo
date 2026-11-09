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

## Correctif — grille Dossier écrasée (captures bureau du fondateur, 2026-11-08)

Le fondateur, en session Admin sur le Dossier de Kaneza (bureau), montre
la nouvelle grille xl… qui écrase ses propres cartes. Trois défauts,
une cause racine commune, et un balayage de la même famille.

### Cause racine (Dossier)

Le commentaire de la passe annonçait « zone principale (2/3) +
Historique (1/3) », mais la zone principale
(`<div class="grid … lg:grid-cols-2">`) n'a **jamais reçu son
`xl:col-span-2`** dans la grille parente `xl:grid-cols-3` : elle était
donc affamée à **1/3 de la largeur**, et ses cartes internes (grille
`lg` 2 colonnes) tombaient à ~1/6 de page. S'y ajoutait la famille
habituelle : items de grille sans `min-w-0` (min-content supérieur à
la piste → débordement/chevauchement) et valeurs atomiques en
`break-words` (cassées au milieu).

### Corrections — page Dossier (`console/comptes/[id]`)

1. **Immeubles écrasés** (libellé « Kaneza Home — 226 Avenue Pie
   Ngendanumwe, Bujumbura » rendu lettre par lettre) : zone principale
   `xl:col-span-2 min-w-0` retrouvée ; la section Immeubles passe en
   **pleine largeur de la zone** (`lg:col-span-2`) ; cartes immeuble
   `min-w-0`, libellé en `break-words` normal — lignes normales à
   toutes les largeurs lg/xl. Les photos déjà envoyées ne bougent pas
   (stockage inchangé, seule la présentation change).
2. **Identité** : les 13 lignes libellé/valeur (Identité +
   Abonnement + Responsable) reçoivent `min-w-0` — fini les paires
   qui se chevauchent (« Contrat gestionnaire » / « Contrat
   propriétaire ») ; **5 valeurs atomiques en `whitespace-nowrap`** :
   téléphone, date d'inscription, statut du contrat gestionnaire,
   statut du contrat propriétaire, fin d'essai. Les pistes Tailwind
   `grid-cols-*` sont déjà en `minmax(0,1fr)` par construction ; ce
   sont les items qui devaient devenir réductibles.
3. **Documents du dossier** : noms déjà tronqués proprement
   (`min-w-0 flex-1` + `truncate`, inchangés) ; les **dates passent en
   `whitespace-nowrap`** (fini « 7 / nov. / 2026 » sur 3 lignes), dans
   les deux listes (documents du compte + preuves de propriété).
   Sections de la zone et Historique : `min-w-0` complété.

### Balayage même famille (pages réorganisées par la passe desktop)

- **Finances** : carte par devise et 3 tuiles de métriques des totaux
  en `min-w-0`, montants des tuiles en `whitespace-nowrap` ; colonnes
  xl des dépenses (liste 2/3, formulaire 1/3) en `min-w-0`.
- **Mon dossier employé** : les 8 sections `CARTE` (items des grilles
  xl) en `min-w-0` ; sous-cartes Identité photo/pièce en `min-w-0`.
- **Équipe** : les 5 items de la grille détail d'un dossier
  (`md:grid-cols-2`) et les 2 sections formulaires côte à côte en
  `min-w-0` (les cartes membres l'avaient déjà).
- **Vérifier un employé** : les 2 colonnes xl (recherche/liste,
  fiche) en `min-w-0`.
- **Vue d'ensemble** : les 2 colonnes xl (Messages/files, Activité
  récente) en `min-w-0` (KPI déjà protégés).

Aucun contenu, aucune règle, aucune branche mobile (classes sans
préfixe) ni bordure or n'est touché ; aucun libellé modifié (parité
i18n intacte).

### Vérifications du correctif

- `scripts/test-organisation-desktop.cjs` : **52 OK / 0 KO** (15
  contrôles ajoutés : col-span retrouvé, min-w-0 et nowrap aux zones
  corrigées, dates et téléphone du Dossier).
- `scripts/test-correctif-mobile-annotations.cjs` : compteur des
  valeurs du Dossier ajusté au patron complété (7 `break-words` +
  5 `nowrap` = 12 valeurs protégées, comme avant) — **40 OK / 0 KO**.
- Suite complète : **1 739 OK / 3 KO** — les 3 KO sont exactement les
  préexistants du Module 3 (fixtures démo sensibles à la date :
  « dû » devenu « en retard »), signalés et non corrigés.
- `npx tsc --noEmit` propre ; `npm run build` propre (101/101 pages).

## Ajout du même jour — Bandeau de titre marine (« Donne le fond d'écran au titre »)

Ordre du fondateur sur la capture du Dossier corrigé : le titre
(« Kaneza Rehema ») reposait directement sur le fond crème. La **zone
d'en-tête** des pages console (lien retour éventuel + titre H1 + ligne
méta/sous-titre + pastilles d'état) reçoit désormais un **bandeau
marine** assorti aux cartes.

### Patron retenu — composant partagé `components/BandeauPage.tsx`

- Classes : `rounded-2xl border border-gold/40 bg-navy p-4 text-white
  shadow-sm md:p-5` — marine #1B2A4A, coins arrondis comme les cartes,
  bordure or/40 assortie à celle des cartes, ombre légère.
- À l'intérieur : titre en **blanc** (gras conservé), méta et
  sous-titre en **slate-300**, accents **or** pour le lien retour et le
  Display ID (insécable conservé — le test « Display ID insécable » a
  été ajusté à la nouvelle couleur, protection inchangée).
- Pastilles présentes dans la zone : celles du Dossier (ambre/vert
  claires) restent telles quelles — lisibles sur marine ; la pastille
  or des non-lus (Messages) ressort sur le marine ; la pastille
  « lecture seule » des Messages supervisés passe en variante or
  translucide (`border-gold/40 bg-gold/15 text-gold`), l'ancienne
  slate-700 étant illisible sur marine.
- Mobile ET bureau : même bandeau (compact sur mobile, pleine largeur
  du conteneur 1600 px sur bureau). Aucun texte, aucune règle, aucun
  fournisseur modifiés ; les bordures des cartes hors zone titre sont
  inchangées.

### Pages traitées

Dossier client (`comptes/[id]` — lien retour + titre + méta +
pastilles dans le bandeau), Finances plateforme, Mon dossier employé,
Équipe (`admins`), Vérifier un employé (vue normale **et** vue refus),
Journal d'audit (vue normale **et** vue refus), Messages, Messages
supervisés, Vitrine (supervision), Mes dossiers, Gestionnaires — plus,
au même patron (en-tête titre + sous-titre identique) : Comptes,
Finances (paramètres), Suppressions (les deux vues) et la page détail
Supervision (titre + méta bannerés ; son lien retour et sa bannière de
supervision or, au-dessus, sont inchangés).

**Vue d'ensemble** : son héros marine existant n'est PAS doublé — il
est seulement harmonisé par l'ajout de la bordure `border-gold/40` du
patron (le test « design console » a été ajusté à la nouvelle chaîne).

### Accordéon Messages du Dossier (ajout du même jour)

La section « Messages » du Dossier client (bas de page) devient un
**accordéon** pour raccourcir la page :

- **Repliée par défaut** : seul l'en-tête reste visible — titre,
  chevron (SVG, pivote à l'ouverture), pastille or des **non-lus déjà
  chargés** par la page (`conversation.non_lus`, aucun nouvel appel ;
  le nombre total de messages n'étant pas chargé par la page, aucun
  compteur total n'est affiché).
- Clic sur l'en-tête (`<button aria-expanded aria-controls>`) :
  déplie le fil complet et le formulaire de réponse, strictement
  identiques. Le fil (`FilMessages`) ne se monte qu'à l'ouverture :
  il marque donc le fil comme lu **à l'ouverture de la section**
  (avant : dès l'affichage du Dossier).
- **Exception ancre `#messages`** : arrivée avec le hash (lien de la
  page console Messages, carte Vue d'ensemble) = section **dépliée**
  (état initial + écoute `hashchange`), ancrage inchangé — la section
  porte toujours `id="messages"`, et son haut ne bouge pas selon
  l'état, donc l'ancrage natif reste exact.

### Vérifications

- `scripts/test-organisation-desktop.cjs` : **80 OK / 0 KO** (28
  contrôles ajoutés : composant partagé, présence du bandeau et titre
  blanc sur les 15 pages/vues, variantes de pastilles, héros
  harmonisé, accordéon — repli par défaut, aria, ancre, pastille).
- `scripts/test-display-id-insecable.cjs` : **10 OK / 0 KO** ;
  `scripts/test-design-console.cjs` : **54 OK / 0 KO**.
- Suite complète : **1 767 OK / 3 KO** — les 3 KO sont exactement les
  préexistants du Module 3 (fixtures démo sensibles à la date),
  signalés et non corrigés.
- `npx tsc --noEmit` propre ; `npm run build` propre ; parité i18n
  intacte (2 137 clés, aucun texte ajouté).

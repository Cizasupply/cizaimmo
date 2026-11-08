# Design « Marine & Or premium » — passe tableau de bord (2026-11-07)

Proposition du fondateur **validée** (« Go — applique d'abord au tableau de
bord »), puis **ajout du fondateur en cours de passe** : le menu doit être
**premium, ultra mobile-first, et complet sur bureau**. Les deux demandes
sont livrées dans le même commit.

**Périmètre strict de cette passe** : le cadre de l'espace connecté
(`AppShell`, partagé par toutes les pages clientes et le mode démo) et la
page **Tableau de bord** cliente. La console n'est pas touchée ; les pages
publiques non plus ; le contenu des autres pages clientes ne change pas
(seul le fond crème s'y applique via l'AppShell). Aucune donnée ni logique
métier modifiée.

## Palette

| Rôle | Couleur | Valeur |
|---|---|---|
| Fond général de l'espace connecté | Blanc crème chaud | `#F7F5F0` (nouvelle couleur Tailwind `cream`) |
| Marine (sidebar, barres, carte héros) | Marine CizaImmo | `#1B2A4A` (`navy`, existant) |
| Or (accents, actif, montants héros) | Or CizaImmo | `#D4AF37` (`gold`, existant) |
| Accents métier KPI | vert / rouge / ambre | `green-500` / `red-500` / `amber-500` (barres) |

Les couleurs métier gardent leur sens partout : vert = ok/collecté,
rouge = retard/problème, ambre = attention/vacant, marine/or = marque.

## Cadre — AppShell (`components/AppShell.tsx`)

- **Fond crème** : le conteneur racine passe de `bg-slate-50` à `bg-cream`
  (`#F7F5F0`, ajouté à `tailwind.config.ts`). Toutes les pages héritent du
  fond ; leurs contenus sont inchangés dans cette passe.
- **Barre latérale bureau** : fond `bg-navy` `#1B2A4A` (était `navy-dark`
  `#121D33`), logo compact blanc/or en haut, navigation défilante,
  **pied de barre** : sélecteur de contexte (gestionnaire multi-rattaché),
  bloc utilisateur, sélecteur de langue, déconnexion (avec icône).
- **État actif** (nouveau — il n'existait pas) : entrée courante détectée
  par le chemin (`usePathname`, préfixe de locale retiré) → fond
  `navy-light`, texte **or**, gras, liseré or à gauche (ombre interne 4 px).
- Le `<select>` du sélecteur de contexte passe en `bg-navy-light` pour
  rester lisible sur la sidebar marine.

## Page Tableau de bord (`app/[locale]/dashboard/page.tsx`)

- **Carte « héros » marine** insérée après le sélecteur de devise et avant
  les KPI : fond `bg-navy`, libellé « Loyers collectés du mois », montant
  collecté en **or** (`text-3xl/4xl`), ligne « Attendus : … · Taux de
  collecte : … % ». Données = les totaux **déjà convertis** par la page
  (`collectesConv` / `attendusConv`) ; le taux est le simple rapport des
  deux totaux affichés — aucun nouveau calcul métier. Repli propre
  (montants par devise) si un taux de change manque.
- **4 KPI** : cartes **blanches** (bordure slate-200 conservée) avec
  **barre d'accent métier de 4 px** à gauche — occupation marine, collecté
  vert, retard rouge, vacants ambre. Chiffres agrandis (figures uniques en
  `text-3xl`, lignes par devise en `text-2xl`). Libellés et valeurs
  inchangés ; les couleurs des valeurs (vert/rouge/ambre selon l'état)
  sont conservées.
- **Actions rapides** : « Déclarer un paiement » devient le bouton **or**
  (fond `#D4AF37`, texte marine, gras) ; « Ajouter une dépense » et
  « Créer un immeuble » deviennent secondaires (fond blanc, **contour
  marine**, texte marine).
- **Sections** (Retards, Fins de bail, Dépenses du mois, graphique
  « Collecte des 6 derniers mois », Fil d'actualité, + titre de l'écran
  de démarrage) : cartes blanches sur fond crème, titres en **marine
  SemiBold** (`font-semibold`, étaient `font-bold`). Le graphique n'est
  pas touché (déjà réduit plus tôt dans la soirée).

## Menu premium mobile-first + bureau (ajout du fondateur)

### Mobile — priorité absolue, rendu « vraie application »

- **Barre supérieure marine** : logo compact, prénom, **sélecteur de
  langue** (variante sombre), **cloche** d'alertes (avec sa pastille
  existante) et **avatar** (initiale or, patron du bloc utilisateur)
  menant aux Paramètres. Le bouton hamburger disparaît.
- **Barre de navigation inférieure fixe** (`md:hidden`) : 5 emplacements —
  **Tableau de bord, Immeubles, Loyers, Locataires, « Plus »** — mêmes
  routes et mêmes libellés `nav.*` que la barre latérale. Icône + libellé
  court dessous, **état actif en or** (texte or + indicateur or en haut de
  l'emplacement, `aria-current`), zones tactiles **≥ 44 px**
  (`min-h-[3.5rem]`), **safe-area iPhone** respectée
  (`pb-[env(safe-area-inset-bottom)]`), et padding bas du contenu porté à
  `pb-28` sur mobile pour que rien ne soit masqué par la barre.
- **« Plus » = le menu complet** : panneau **plein écran marine**
  (remplace l'ancien tiroir latéral — un seul mécanisme) reprenant
  **toutes** les entrées existantes, groupées comme sur bureau, + bloc
  utilisateur, sélecteur de contexte et déconnexion. Fermeture par ✕ ou
  Échap (comportement conservé), défilement de la page bloqué derrière.
- Sur mobile, langue et cloche ne sont plus dupliquées dans la rangée du
  titre (elles vivent dans la barre supérieure) ; sur bureau, elles
  restent dans la rangée du titre comme avant.

### Bureau

- Barre latérale marine **avec icônes + libellés** pour chaque entrée
  (jeu d'icônes **SVG inline uniformes** créé pour l'app — aucune
  librairie d'icônes n'était présente ; tracés 24×24, stroke
  `currentColor`, composant `IconeNav` + table `ICONES` dans l'AppShell).
- **Regroupement visuel sobre** en deux groupes : **Gestion** (Tableau de
  bord, Immeubles, Appartements, Locataires, Loyers, Reçus, Dépenses,
  Documents, Alertes, Messages, Rapports, Vitrine) et **Compte**
  (Abonnement, Mon contrat, Paramètres). Aucune entrée supprimée, aucune
  route ni aucun libellé changé — seul l'ordre d'affichage est regroupé
  (les Paramètres rejoignent « Compte »).
- Pied de barre : bloc utilisateur + langue + déconnexion (voir Cadre).

### i18n

Nouvelles clés (parité FR/EN stricte) : `dashboard.collectionRate`
(« Taux de collecte » / « Collection rate »), `nav.more` (« Plus » /
« More »), `nav.groupManagement` (« Gestion » / « Management »),
`nav.groupAccount` (« Compte » / « Account »). Toutes les autres chaînes
réutilisent les clés existantes.

## Fichiers touchés

- `tailwind.config.ts` — couleur `cream`.
- `components/AppShell.tsx` — fond crème, sidebar marine à pied de barre,
  état actif, icônes SVG, regroupement, barre supérieure mobile, barre
  inférieure mobile, menu complet plein écran.
- `app/[locale]/dashboard/page.tsx` — carte héros, KPI, actions rapides,
  titres SemiBold.
- `messages/fr.json`, `messages/en.json` — 4 clés ajoutées (voir i18n).
- `scripts/test-correctif-cartes-graphique.cjs` — assertions adaptées
  (§2) + nouvelle section (§4), voir ci-dessous.

## Adaptations de tests (documentées, aucune assertion fonctionnelle affaiblie)

`scripts/test-correctif-cartes-graphique.cjs` :

- **§2 (KPI)** : les anciennes assertions exigeaient les fonds teintés des
  cartes KPI (`bg-green-50`, `bg-red-50`, `bg-amber-50`) — patron visuel
  légitimement remplacé par le design validé (cartes blanches + barres
  d'accent). Elles vérifient maintenant : 4 cartes blanches bordées au
  nouveau patron, une barre d'accent par métier (marine/vert/rouge/ambre),
  et les **couleurs métier conservées sur les valeurs**
  (`text-green-700` / `text-red-700` / `text-amber-700`) — l'assertion
  fonctionnelle « la couleur code l'état » est préservée.
- **§4 (nouveau)** : fond crème + couleur Tailwind, sidebar/barre
  supérieure/panneau plein écran marines, barre inférieure (fixe,
  safe-area, zones tactiles), actif en or, carte héros + taux de
  collecte, actions rapides, et **présence des 15 destinations de
  navigation historiques** dans l'AppShell (garantie « aucune entrée
  supprimée » de la refonte du menu).
- Le recensement du §1 (aucune carte blanche/teintée sans bordure) passe
  sans changement : les nouvelles cartes KPI sont blanches **et** bordées ;
  la carte héros marine est hors périmètre du recensement (fond ni blanc
  ni teinté pâle).

## Vérifications

- `bash scripts/run-tests.sh` : suite complète verte (0 KO).
- `npm run build` : OK.
- Reste au fondateur : validation visuelle sur le compte réel de Kaneza
  (téléphone + ordinateur) avant l'extension du design aux autres pages.

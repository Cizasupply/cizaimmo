# Correctif « ligne au scroll + tuiles statistiques » — 2026-11-08

Deux défauts signalés par le fondateur, avec preuves : un
enregistrement d'écran du tableau de bord client (iPhone/Safari) et
une capture annotée du passeport de « Kaneza Home ». Design et
rendu uniquement : aucune donnée, aucune logique, aucun libellé
modifié.

## Défaut A — « Quand tu scroll, il y a une ligne qui passe au milieu »

**Symptôme (vidéo, frames analysées)** : pendant le défilement,
une bande horizontale marine/grisâtre translucide traverse l'écran
au milieu, par-dessus les cartes « Collecte des 6 derniers mois »
et « Fil d'actualité ». Sur une frame, elle est **dédoublée** : la
vraie barre inférieure est visible à sa place en bas ET la bande
fantôme flotte au milieu (~100 px de haut, soit la hauteur de la
barre). Sur une autre frame, la barre apparaît **étirée** vers le
haut. C'est la signature d'un élément `fixed` repeint par WebKit à
une position périmée pendant le scroll.

**Cause retenue** : la barre de navigation inférieure fixe des
coques (`AppShell` / `ConsoleShell`). Indices, tous vérifiés dans
le code :

1. C'est le **seul élément fixe visible pendant le défilement
   mobile** : la sidebar bureau est `hidden` sur mobile, l'en-tête
   mobile est en flux (ni `fixed` ni `sticky`), les panneaux plein
   écran sont conditionnels (menu fermé pendant le scroll).
2. **Aucun** des aggravants classiques n'est présent : balayage
   complet du dépôt — zéro `backdrop-blur`/`backdrop-filter`,
   zéro `sticky`, zéro `transform`/`filter`/`perspective`/
   `will-change` sur la barre ou ses ancêtres, fond `bg-navy`
   **plein** (#1B2A4A, aucune translucidité — la teinte « grisâtre
   translucide » de la bande est l'aspect d'une couche en cours de
   re-rastérisation). La barre est déjà au niveau racine de la
   coque.
3. En revanche, la barre n'avait **aucune couche de composition
   propre** : WebKit la re-rastérisait dans la couche de
   défilement et la repeignait à d'anciens décalages pendant le
   scroll (d'où le fantôme au milieu, parfois doublé, parfois
   étiré quand la hauteur du viewport visuel change).

**Correction** (patron robuste iOS, les deux coques) : nouvelle
classe utilitaire `.barre-fixe-ios` dans `app/globals.css` —
`transform: translateZ(0)` + `backface-visibility: hidden`
(préfixes `-webkit-` inclus) — appliquée aux deux barres
inférieures fixes. La barre est promue en couche de composition
propre : elle se repeint d'un bloc, à sa place. `translateZ(0)`
est visuellement neutre : **le rendu à l'arrêt ne change pas d'un
pixel** ; fond marine plein, hauteurs (`min-h-[3.5rem]`) et
`pb-[env(safe-area-inset-bottom)]` inchangés. Non appliquée aux
panneaux plein écran (visibles seulement menu ouvert, défilement
verrouillé) ni aux sidebars bureau (masquées sur mobile, pas de
repeint tactile).

## Défaut B — Le montant « 300 000 000 BIF » déborde de sa tuile

**Symptôme (capture)** : passeport du bien, tuile « Valeur du
bien » — le montant sort à droite, hors de la tuile ; « 850 000
BIF » (tuile « Loyers du mois ») touche déjà le bord.

**Cause** : un montant formaté par Intl est un **jeton
insécable** — séparateurs de milliers en U+202F (espace fine
insécable) et espace U+00A0 avant la devise (vérifié :
`300␍000␍000 BIF`). Il ne peut ni se couper ni retourner à la
ligne : trop large, il **déborde**. Mesures (métriques Liberation
Sans Bold ≈ police système iOS) : « 300 000 000 BIF » = **145,9 px
à text-xl (20 px)**, alors que la tuile du passeport n'offre que
**~107 px utiles** sur un téléphone de 390 px (page px-6 → carte
p-6 → grille 2 colonnes → tuile p-4). Le correctif précédent
couvrait les KPI du tableau de bord et de la console, pas ces
tuiles.

**Correction — passeport du bien** (`immeubles/[id]`) : grille en
`minmax(0,1fr)` (`grid-cols-*`), 3 colonnes repoussées de `md` à
`lg` (à md, sidebar 240 px + 3 colonnes ne laissaient que ~91 px
utiles), tuiles `p-3` sur mobile (`sm:p-4`), montants en
`whitespace-nowrap` avec taille par paliers : **13 px** (mobile)
→ `min-[420px]:text-sm` → `sm:text-base` → `md:text-lg` →
`lg:text-xl`. Vérifié par le calcul à chaque palier (pire cas
360 px : 94,9 px de texte pour 100 px utiles ; bureau ≥ lg :
rendu identique à l'original — 3 colonnes, p-4, text-xl).

**Balayage — même patron partout** :

- **Détail appartement** (`appartements/[id]`) : grille stats
  2 colonnes, 4 colonnes à `lg` ; valeurs en `whitespace-nowrap`,
  `text-base` → `lg:text-lg`.
- **Indivision** (`components/IndivisionSection.tsx`) : les 3
  tuiles (Revenus / Dépenses / Résultat net) étaient en 3 colonnes
  dès le mobile (~66 px utiles — débordement latent pour tout
  montant) : empilées en pleine largeur sur petit téléphone,
  3 colonnes dès 560 px, montants `whitespace-nowrap` par paliers
  (16 px empilé → 12 px à 560 px → 14 px à 900 px → 16 px à lg).
- **Montants encore en `break-all`** (ils cassaient en plein
  milieu quand la place manquait) → `whitespace-nowrap` : totaux
  du mois des **Loyers** (4 lignes), totaux et lignes des
  **Dépenses** (3), **Rapports** — cartes par devise et lignes par
  immeuble (6), dépenses du mois du **tableau de bord** (1),
  « Loyers du mois » des cartes de la **liste des immeubles** (1),
  loyer des cartes de la **liste des appartements** (1), montant
  des cartes de la **liste des reçus** (1). Tous ces emplacements
  ont la largeur suffisante (lignes pleine largeur ou cellules
  ≥ ~139 px) : le montant tient entier, sans coupure.
- **Vérifiés sans changement** : détail locataire (lignes
  libellé/valeur pleine largeur, aucun montant en tuile), cartes
  KPI client/console (patron déjà appliqué), héros du tableau de
  bord (pleine largeur), `break-all` conservé là où il est juste :
  URL de documents, lien locataire, e-mails et téléphones.

**Format d'affichage inchangé partout** : montant complet, jamais
d'abréviation (« 300 M »), jamais de troncature.

## Vérifications

- Nouveau bloc statique `scripts/test-correctif-scroll-tuiles.cjs`
  (**33 contrôles**) enregistré dans `scripts/run-tests.sh` :
  promotion des deux barres (couche propre, fond plein, safe-area),
  absence de backdrop-blur/transform dans les coques, patron des
  tuiles (passeport 6/6, appartement 4/4, indivision 3/3), zéro
  montant résiduel en `break-all`.
- **Suite complète VERTE** (`bash scripts/run-tests.sh`, 0 KO),
  y compris le bloc « annotations » précédent sans adaptation.
- **Build OK** (`npm run build`).
- Preuve finale chez le fondateur : scroller le tableau de bord
  sur son iPhone (plus de bande au milieu) et ouvrir le passeport
  de Kaneza Home (« 300 000 000 BIF » entier, dans sa tuile).

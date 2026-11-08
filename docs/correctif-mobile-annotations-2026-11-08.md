# Correctifs mobile — annotations du fondateur (2026-11-08)

Le fondateur a transmis **3 captures annotées au doigt** sur son téléphone
(console Vue d'ensemble, page Dossier d'un compte, tableau de bord client).
4 défauts exacts, corrigés en une passe. **Design uniquement** : aucune
donnée, aucune logique, aucun libellé modifié ; la logique et la
présentation validées du badge Messages sont intactes (le compteur
plateforme et son recalcul à la navigation ne bougent pas — le test
`test-correctif-mobile-annotations.cjs` le revérifie, et
`test-console-messages-badge.cjs` continue de passer sans adaptation).

Nouveau verrouillage : `scripts/test-correctif-mobile-annotations.cjs`
(29 contrôles statiques sur les classes clés anti-débordement /
anti-coupure), enregistré dans `scripts/run-tests.sh`.

---

## Défaut 1 — Console mobile : « Se déconnecter » déborde de la barre supérieure

**Capture** : Vue d'ensemble console — logo + pastille « English » +
pastille « Se déconnecter » tronquée au bord droit de l'écran.

**Cause** : la barre supérieure mobile de `ConsoleShell` alignait, dans
une rangée à largeur fixe : logo 120 px + titre (tronqué) + pastille de
langue pleine (« English » / « Français », `px-4`, texte 14 px) + pastille
texte « Se déconnecter » (`px-4`). Sur un téléphone étroit, la somme des
largeurs fixes dépasse la fenêtre : la dernière pastille sort de l'écran.

**Correction** (`components/ConsoleShell.tsx`, `components/LanguageSwitcher.tsx`,
`components/AppShell.tsx`) :
- Logo de la barre mobile réduit : 120 → **96 px** (console ET client).
- Langue en **pastille compacte** : nouvelle variante `compact` du
  `LanguageSwitcher` — code court « EN » / « FR », pastille réduite
  (`px-3`, texte 12 px) ; le nom complet de la langue reste annoncé par
  l'`aria-label` existant.
- Déconnexion en **bouton icône seul** dans la barre console (icône
  `logout` du jeu partagé `IconeNav`, cible tactile 44 × 44 px,
  `aria-label` + `title` = « Se déconnecter »). La déconnexion **en
  texte** reste présente là où la place le permet : panneau « Plus »
  plein écran et pied de la barre latérale bureau — inchangés.
- Même discipline appliquée à la barre supérieure mobile de
  l'`AppShell` cliente (logo 120 → 96 px, langue compacte) : logo +
  prénom + langue + cloche (40 px) + avatar (40 px) tiennent désormais
  dans la largeur, même sur petit téléphone.

## Défaut 2 — Console mobile, page Dossier : la carte « Identité » déborde

**Capture** : dossier de Kaneza Rehema — les valeurs de droite sont
coupées au bord de l'écran (« ✓ Reç… », téléphone tronqué, « Burund… »,
« Canada (CA… », « 7 nov. 202… »).

**Cause** : deux facteurs combinés. (a) La grille des cartes du dossier
était `grid lg:grid-cols-2` **sans colonne explicite sur mobile** : la
colonne implicite se dimensionne au contenu le plus large (`auto`), une
carte peut donc s'élargir au-delà de la fenêtre et pousser ses voisines.
(b) Les lignes libellé/valeur des `<dl>` (Identité, Abonnement) étaient
des `flex justify-between` rigides : libellé et valeur ne pouvaient pas
s'enrouler, la valeur partait hors champ.

**Correction** (`app/[locale]/console/comptes/[id]/page.tsx`) :
- Grille : `grid grid-cols-1 gap-6 lg:grid-cols-2` — colonne unique
  explicite `minmax(0, 1fr)` sur mobile : la piste ne peut plus dépasser
  la fenêtre et les cartes peuvent rétrécir.
- Les 11 lignes libellé/valeur (Identité + Abonnement) passent en
  `flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5` :
  le **libellé** est `shrink-0` (jamais compressé), la **valeur** est
  `min-w-0 break-words text-right` (s'enroule proprement, jamais
  coupée). La ligne « Responsable » (nom + bouton « Assigner »)
  s'enroule aussi (`flex-wrap`, valeur justifiée à droite).
- Balayage de la même page : listes de documents (bloc nom `flex-1`
  pour que le `truncate` s'applique réellement), rattachements
  (paragraphes en `break-words` — e-mails et téléphones), immeubles
  (nom + adresse en `min-w-0 break-words`), revue des immeubles
  (nom/adresse et propriétaire déclaré en `break-words`), journal
  d'audit du dossier (`break-words`), en-tête (e-mail + Display ID en
  `break-words`).
- **Balayage des autres pages console** — même famille (grille sans
  colonne mobile explicite) corrigée de la même façon, rendu bureau
  inchangé : Messages supervisés (`lg:grid-cols-[340px_1fr]`), Vitrine
  (`md:grid-cols-[240px_1fr]`), Finances (`md:grid-cols-3` et
  `md:grid-cols-2`), Gestionnaires (`md:grid-cols-2`) → `grid-cols-1`
  ajouté partout.
- Les tableaux console étaient déjà sains (Journal : cartes mobiles +
  tableau contenu `overflow-x-auto` dès `md` ; Suppressions : tableau
  contenu dans un `overflow-x-auto`) — aucun changement.

## Défaut 3 — Client mobile, KPI « Montant en retard » : montant cassé en plein milieu

**Capture** : tableau de bord de Kaneza — la carte demi-largeur affiche
« 680 000 B » puis « IF » à la ligne suivante.

**Cause** : les montants des cartes KPI (collecté, retard) et le montant
de la carte héros utilisaient **`break-all`**, qui autorise la coupure
entre n'importe quels caractères — y compris au milieu d'un montant.

**Correction** :
- **Cartes KPI du tableau de bord client** (`app/[locale]/dashboard/page.tsx`) :
  montants en **`whitespace-nowrap`** + taille responsive — collecté et
  retard : `text-xl` sur mobile, `sm:text-2xl` (taille pleine) ensuite ;
  valeurs numériques (occupation, retard à zéro, vacants) :
  `text-2xl` mobile, `sm:text-3xl`. Les **libellés et sous-lignes**
  continuent de s'enrouler normalement ; la sous-ligne de conversion
  (« ≈ … · taux du … »), imbriquée dans le paragraphe du montant,
  repasse explicitement en flux normal (`whitespace-normal break-words`)
  pour garder son retour à la ligne.
- **Carte héros client** : `break-all` retiré du montant. Un montant
  formaté par Intl est un jeton insécable (séparateurs de milliers et
  espace avant la devise sont des espaces insécables) : il reste entier
  sur sa ligne sans `break-all` ; le repli multi-devises (taux manquant)
  ne peut couper qu'**entre** les montants, jamais dedans.
- **Cartes KPI console, même patron** : Vue d'ensemble (valeur des 11
  cartes), Comptes (KPI non-assignés), Mes dossiers (4 cartes
  d'actions) → `whitespace-nowrap text-xl sm:text-2xl`.

## Défaut 4 — Console mobile, héros Vue d'ensemble : les libellés se touchent

**Capture** : héros marine — « EN ATTENTE D'APPROBATION » colle à
« COMPTES CLIENTS » et « MESSAGES CLIENTS NON LUS » s'entasse, en
3 colonnes étroites.

**Cause** : la grille du héros était `grid-cols-3` à toutes les
tailles ; sur mobile chaque colonne fait ~100 px, moins que la largeur
des libellés en capitales.

**Correction** (`app/[locale]/console/page.tsx`) : `grid grid-cols-1
gap-5 sm:grid-cols-3 sm:gap-4` — les 3 compteurs **s'empilent** sur
mobile (chiffre or + libellé, jamais en contact), 3 colonnes dès `sm`,
bureau inchangé. Les chiffres restent `text-3xl` or et les compteurs
sont toujours ceux déjà calculés par la page (en attente, comptes,
messages non lus).

---

## Vérifications

- `bash scripts/run-tests.sh` : **suite complète VERTE, 0 KO** (dont
  les 29 nouveaux contrôles du correctif mobile ; badge Messages et
  design console/client sans adaptation).
- `npm run build` : **OK**.
- Fichiers touchés : `components/ConsoleShell.tsx`,
  `components/AppShell.tsx`, `components/LanguageSwitcher.tsx`,
  `app/[locale]/dashboard/page.tsx`, `app/[locale]/console/page.tsx`,
  `app/[locale]/console/comptes/page.tsx`,
  `app/[locale]/console/comptes/[id]/page.tsx`,
  `app/[locale]/console/mes-dossiers/page.tsx`,
  `app/[locale]/console/messages-supervises/page.tsx`,
  `app/[locale]/console/vitrine/page.tsx`,
  `app/[locale]/console/finances/page.tsx`,
  `app/[locale]/console/gestionnaires/page.tsx`,
  `scripts/test-correctif-mobile-annotations.cjs`,
  `scripts/run-tests.sh`, cette doc.

**Preuve finale restant au fondateur** (déploiement Vercel automatique) :
sur son téléphone —
1. Console, Vue d'ensemble : barre du haut complète dans l'écran
   (logo, « EN », icône de déconnexion), héros empilé lisible.
2. Console, dossier de Kaneza : carte Identité entièrement visible,
   aucune valeur coupée.
3. Tableau de bord de Kaneza : « 680 000 BIF » entier sur une ligne
   dans la carte « Montant en retard ».

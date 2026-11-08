# Design « Marine & Or premium » — page d'accueil publique (2026-11-08)

Ordres du fondateur, dans l'ordre : « il reste page d'accueil »
(dernière surface non traitée après l'espace client et la
console) ; « Pas de hero ? » (un VRAI héros, pas un bloc titre) ;
règle boutons (aucun doublon de CTA, boutons « bien organisés,
mobile first ultra premium, desktop aussi ») ; « Apropos aussi »
(voir §6 — la page n'existe pas, elle n'a PAS été créée).

Palette du patron validé : marine #1B2A4A, marine foncé #121D33,
or #D4AF37, crème #F7F5F0. Contenu, sections, textes et
mécaniques STRICTEMENT inchangés (seule copie nouvelle : l'alt
de la photo du héros, libellé manquant pour le nouveau visuel).

## 1. Héros — composition livrée

Section pleine largeur en tête de page, fond marine en dégradé
sobre (`from-navy` → `to-navy-dark`), hauteur généreuse
(pt-14 → md:pt-20 + photo) :

- **Logo v4** : porté par l'en-tête public (fond aligné
  `bg-navy`, voir §4), dans le prolongement direct du héros —
  un seul champ marine continu, logo blanc/or sur fond sombre
  comme prévu par son design.
- **Titre** existant (`landing.headline`), **slogan** existant
  (« Vos biens, gérés simplement. », or, SemiBold), **sous-titre**
  existant (slate-300 sur marine).
- **CTA** : voir §2 (essai unique or + démo en secondaire).
- **Sélecteur de devise visible** dans le héros : nouveau
  composant `SelecteurDeviseHero` (components/DeviseAffichage)
  — même contrôle que celui de la mini-grille (12 devises
  libellées « $ USD », « € EUR », « BIF »…, pastille blanche
  bordée or, libellé `pricing.currencyLabel` visible). Les deux
  sélecteurs partagent UN état (contexte `FournisseurDevise`
  autour du `main` de l'accueil) : choisir une devise dans le
  héros convertit la grille tarifaire plus bas, et inversement.
  La conversion elle-même ne change pas (fonctions pures de la
  grille) ; la grille garde un état local de repli si elle est
  rendue sans le fournisseur.
- **Photo réelle** : résidence premium (immeuble blanc/brique à
  balcons, arbres au premier plan) — **photo réelle Pexels
  n° 14998334 (Nino Sanger, licence libre Pexels)**, aucune
  image générée, aucun effet IA. Fichier local optimisé
  `public/hero-residence.jpg` (1440×960, **167 Ko**), affichée
  via `next/image` en `priority` (image principale du haut de
  page), alt bilingue `landing.heroPhotoAlt` (FR/EN).
  Présentation : **carte encadrée** (coins arrondis 2xl, bordure
  fine blanc/40, ombre 2xl) en `max-w-3xl`, qui **chevauche** la
  section crème suivante (marge basse négative -mb-20 /
  md:-mb-28 ; la section suivante dégage avec pt-36 / md:pt-48).
  À 360-390 px : photo pleine largeur du conteneur (px-6),
  aucun débordement, boutons pleine largeur empilés.

## 2. Boutons — avant / après (règle du fondateur)

**Avant** (page rendue, en-tête compris) :
- En-tête : « Essai gratuit » (or plein) → /inscription.
- Héros : « Commencer l'essai gratuit de 30 jours » (or plein)
  → /inscription + « Voir les tarifs » (contour or) → #tarifs.
  → DEUX boutons d'essai or disaient la même chose.
- Grille : 3 boutons or identiques « Choisir ce plan ».

**Après** — un seul bouton d'essai sur la page, système
uniforme (pastilles, `min-h-12` = cibles ≥ 48 px, pleine
largeur empilées sur mobile, rangée alignée sur bureau) :
- **Héros** : « Commencer l'essai gratuit de 30 jours »
  (libellé existant le plus clair, conservé tel quel) en
  **primaire or** → /inscription ; « **Demander une
  démonstration** » (libellé existant `contact.demoTitle`) en
  **secondaire contour clair** → /contact (premier choix de la
  préférence du fondateur). « Voir les tarifs » quitte le
  héros (la section tarifs reste atteignable par la navigation
  et le défilement ; la clé `landing.ctaSecondary` reste
  définie dans les locales, simplement plus affichée ici).
- **En-tête** : nouvelle prop `masquerEssai` sur PublicHeader
  (défaut `false`). L'accueil la passe : le bouton « Essai
  gratuit » de l'en-tête y est masqué. **Toutes les autres
  pages publiques gardent l'en-tête complet, à l'identique.**
  Restent dans l'en-tête de l'accueil : logo, navigation,
  « Connexion » (secondaire contour or).
- **Grille tarifaire** : un seul primaire or dans la section —
  le CTA « Choisir ce plan » du **pack Pro** (carte marine en
  avant) ; les CTA Starter et Agence passent en **secondaire
  contour marine** sur leurs cartes blanches.
- Aucun autre bouton sur la page (sections de contenu sans
  CTA) ; pied de page inchangé dans ses liens.

## 3. Sections (patron validé)

Alternance crème / blanc, titres marine SemiBold (`font-semibold
text-navy`) soulignés d'un **filet or** (h-1 w-16 arrondi),
cartes blanches bordées au patron de l'espace connecté
(`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm`),
textes slate-600 (lisibilité téléphone) :
fonctionnalités (crème) ; bénéfices (blanc) ; fonctionnement
(crème) ; devises (blanc — la liste des devises en or foncé
`text-gold-dark` pour rester lisible sur fond clair, le signal
multi-devises Afrique « $ USD, € EUR, BIF… » est conservé) ;
tarifs (crème).

**Mini-grille tarifaire** : cartes blanches bordées (prix en
marine gras `text-2xl font-bold`, suffixes slate-500, listes
slate-600), **pack Pro mis en avant en marine/or** (carte
`bg-navy`, nom et prix en avant, anneau or — visuel seul, aucun
libellé ajouté). **Mécanique intacte** : prix toujours lus dans
les tables finance via `getTarifsPlateforme`, taux via
`/api/taux/publics` avec **date affichée** (`pricing.rateDate`),
jamais « en direct », arrondis existants inchangés ; sélecteur
de la section conservé (même état partagé, §1).

## 4. En-tête / pied publics partagés

Alignement palette exact : `bg-navy-dark` → **`bg-navy`**
(#1B2A4A) sur PublicHeader et PublicFooter — l'en-tête prolonge
le héros sans couture, et les autres pages publiques (tarifs,
à-louer, contact, légales — corps clairs) héritent de la même
teinte, leurs corps ne changent pas. Structure, navigation,
logo, liens et langues : inchangés.

## 5. Vérifications

- Nouveau bloc `scripts/test-design-accueil.cjs` (**36 OK**),
  enregistré dans `scripts/run-tests.sh` (avec i18n-check +
  clés utilisées) : héros (composition, photo présente < 300
  Ko, chevauchement), unicité statique du CTA essai (héros :
  1× `ctaTrial` ; en-tête : bouton court conditionnel à
  `masquerEssai`), hiérarchie des CTA de la grille (1 seul
  `bg-gold` de carte, réservé au Pro), mécanique de la grille
  verrouillée (data + route taux datée), parité de l'alt FR/EN.
- **Suite complète VERTE : 1 191 OK / 0 KO** (aucune adaptation
  de test existant nécessaire).
- **Build OK** (`npm run build`).
- i18n : une seule clé ajoutée, `landing.heroPhotoAlt`, en FR
  et en EN (parité stricte vérifiée) — aucun autre texte touché.

**Preuve finale restant au fondateur** : ouvrir
https://cizaimmo.vercel.app sur téléphone et ordinateur —
héros marine avec photo encadrée en chevauchement, UN bouton
or « Commencer l'essai gratuit de 30 jours », « Demander une
démonstration » en contour, sélecteur de devise qui convertit
la grille du bas, sections crème/blanc au niveau du reste du
site.

## 6. Page « À propos » — N'EXISTE PAS (non créée)

Vérifié dans tout le dépôt : **aucune page À propos publique**
dans l'app — pas de route (`a-propos` / `about` absents de
`app/[locale]/`), aucun namespace i18n, aucun lien dans
l'en-tête ni le pied de page. Conformément à la consigne reçue
(« si la page n'existe pas, ne la crée pas »), elle n'a **pas
été créée** dans cette livraison : son texte serait à valider
avec le fondateur. Décision à trancher avec lui : créer une
page À propos (il faudra son texte ou son Go sur une
proposition) ou s'en passer (le site mère cizagroup.com porte
déjà la présentation de l'entreprise).

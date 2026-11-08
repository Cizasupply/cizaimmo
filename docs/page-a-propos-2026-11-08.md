# Page publique « À propos » — 2026-11-08

## Origine

Le fondateur, après le design de l'accueil (commit `ac056b55`), a demandé
« Apropos aussi ». Vérification faite : **la page n'existait pas** dans l'app
(aucune route, aucun lien) — elle n'avait donc pas été créée sans validation.
Le fondateur a choisi de la créer et a **validé le texte mot pour mot** avant
création (FR) ; la version EN est sa traduction fidèle (même sens, même
structure, aucune phrase ajoutée ni retirée). Décision finale photo : **photo
du fondateur** dans le héros (pas une photo de résidence).

## La page

- Route : `app/[locale]/a-propos/page.tsx` → `/a-propos` (FR, locale par
  défaut) et `/en/a-propos`, même convention que `/contact`.
- Lien « À propos » ajouté (`nav.about`) dans la navigation de l'en-tête
  public (après « Appartements à louer ») et dans le pied public (colonne
  Entreprise). Aucune autre page modifiée hors en-tête/pied.
- En-tête appelé avec `masquerEssai` : la page porte son propre CTA d'essai
  unique (CTA final), donc le bouton « Essai gratuit » de l'en-tête est masqué
  — même règle anti-doublon que l'accueil.

### Structure (design « Marine & Or premium », patron de l'accueil)

1. **Héros marine** pleine largeur (dégradé `from-navy` → `to-navy-dark`) :
   titre « À propos de CizaImmo » + slogan de marque en or. **Pas de
   sélecteur de devise** (il n'a pas sa place ici).
2. **Photo du fondateur en carte encadrée blanche** qui chevauche la section
   crème suivante (`-mb-20 / md:-mb-28`, dégagement `pt-36 / md:pt-48`) :
   source `fondateur-bureau.jpg` de l'app Ciza Group (« Ciza Misigaro —
   Fondateur & CEO » — Ciza au bureau, déjà publique), recopiée dans
   `public/fondateur-ceo.jpg`, ré-encodée qualité 88 → **154 Ko**
   (1125×883, sans perte visible). **Légende sous la photo** dans la carte :
   « Ciza Misigaro — Fondateur & CEO, Ciza Group » / EN « Ciza Misigaro —
   Founder & CEO, Ciza Group » (copie déjà utilisée dans son app). Aucune
   autre photo sur la page.
3. **Qui sommes-nous** (crème) et **Le problème que nous réglons** (blanc) :
   titre marine SemiBold + filet or, texte dans une carte blanche bordée.
4. **Ce que fait la plateforme** (crème) : les 8 éléments de la liste validée
   en cartes à puces soignées (pastille or ✓), grille 2 colonnes dès `sm`.
5. **Notre engagement** (blanc) : **carte marine** mise en valeur ; le passage
   « n'encaisse jamais vos loyers » est en **gras or**, porté par la balise
   `<gras>` du message i18n (texte riche next-intl) — le texte reste une seule
   chaîne, identique au texte validé.
6. **Pied de page de la page** : ligne entreprise validée, puis boutons —
   « Commencer l'essai gratuit » (libellé existant `landing.ctaTrial`,
   primaire or → `/inscription`) et « Demander une démonstration » (libellé
   existant `contact.demoTitle`, contour marine → `/contact`). **Un seul
   primaire or sur la page.**

## i18n

Nouveau namespace **`about`** (parité stricte FR/EN, 21 clés feuilles dont 8
éléments de liste) + **`nav.about`**. Textes FR appliqués **tels quels**,
tels que validés :

- Héros : « À propos de CizaImmo » / « Vos biens, gérés simplement. » (slogan
  de marque existant).
- « Qui sommes-nous », « Le problème que nous réglons », « Ce que fait la
  plateforme » (8 items), « Notre engagement » (gras sur « n'encaisse jamais
  vos loyers »), ligne « CizaImmo, division de CIZA GROUP SURL — Bujumbura,
  Burundi · infos@cizagroup.com · WhatsApp +1 514 502 9503 », légende et alt
  de la photo du fondateur.

Parité globale après ajout : **1 802 clés FR = EN** ; contrôle des clés
utilisées OK.

## Vérifications

- Nouveau bloc `scripts/test-page-a-propos.cjs` (**35 OK / 0 KO**),
  enregistré dans `scripts/run-tests.sh` : route, patron public, photo du
  fondateur (présence, ≤ 250 Ko, différente de celle de l'accueil, aucune
  photo de résidence), légende, sections, CTA unique, liens en-tête/pied,
  parité du namespace et **égalité exacte du texte validé FR** (bloc par
  bloc, liste jointe par « · » incluse).
- Suite complète `bash scripts/run-tests.sh` : **VERTE (exit 0)**.
- Build `npm run build` : OK — routes `/fr/a-propos` et `/en/a-propos`
  générées ; contrôle de rendu local : le HTML FR contient titre, slogan,
  engagement en `<strong>`, légende, ligne entreprise, les 4 blocs et la
  liste complète.
